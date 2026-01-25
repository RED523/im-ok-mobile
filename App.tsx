import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AbnormalAlertDialog from './src/components/AbnormalAlertDialog';
import monitoringService from './src/services/monitoringService';
import notificationService from './src/services/notificationService';
import activityTracker from './src/services/activityTracker';
import storage from './src/utils/storage';
import { UserSettings } from './src/types';

export default function App() {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    userPhone: '',
    startTime: '23:00',
    endTime: '08:00',
    emergencyContact: '', // 短信功能，即将推出
    emergencyEmail: '', // 当前使用邮箱通知
  });
  const [isLoading, setIsLoading] = useState(true);

  // 初始化：从存储加载设置并启动监测
  useEffect(() => {
    const init = async () => {
      try {
        // 初始化通知服务
        await notificationService.init();

        // 设置通知接收监听器
        const notificationListener = Notifications.addNotificationReceivedListener(async (notification) => {
          console.log('📢 收到通知:', notification.request.content.title);
          console.log('📊 通知对象调试:', {
            'notification.date': notification.date,
            'notification.date 类型': typeof notification.date,
            '当前时间': new Date().toLocaleTimeString(),
          });
          
          // 如果是安全确认提醒通知，检查是否需要显示弹框
          if (notification.request.content.title?.includes('安全确认提醒')) {
            const record = await monitoringService.getTodayRecord();
            
            // 只有在没有使用记录时才显示弹框
            if (record && !record.hasUsage && !record.userConfirmed) {
              console.log('⚠️ 通知触发：检测到异常，标记并显示弹框');
              // 标记为异常，这样后续从应用图标进入时也能检测到
              await monitoringService.markTodayAsAbnormal();
              
              // 【关键修复】只在第一次收到通知时保存时间，避免重复触发时覆盖
              const existingTime = await storage.getItem<string>('notificationSentTime');
              if (!existingTime) {
                // 在前台收到通知时，应该使用当前时间，而不是 notification.date
                // 因为 notification.date 可能是通知被安排的时间，不是实际发送的时间
                const notificationTime = Date.now();
                await storage.setItem('notificationSentTime', notificationTime.toString());
                await storage.setItem('notificationSentToday', new Date().toISOString().split('T')[0]);
                console.log(`⏰ 保存通知时间（当前时间）: ${new Date(notificationTime).toLocaleTimeString()}`);
              } else {
                console.log(`  ℹ️ 通知时间已存在，不重复保存（避免覆盖原始时间）`);
              }
              
              // 使用函数式更新，避免重复触发
              setShowAlert(prev => {
                if (prev) {
                  console.log('  ℹ️ 弹框已打开，跳过重复触发');
                  return prev;
                }
                return true;
              });
            } else if (record && record.hasUsage) {
              console.log('✅ 通知触发：有使用记录，不显示弹框');
            }
          }
        });

        // 设置通知点击监听器
        const responseListener = Notifications.addNotificationResponseReceivedListener(async (response) => {
          console.log('👆 用户点击通知:', response.notification.request.content.title);
          
          // 如果点击的是安全确认提醒通知，检查是否需要显示弹框
          if (response.notification.request.content.title?.includes('安全确认提醒')) {
            const record = await monitoringService.getTodayRecord();
            
            // 只有在没有使用记录时才显示弹框
            if (record && !record.hasUsage && !record.userConfirmed) {
              console.log('⚠️ 点击通知：检测到异常，标记并显示弹框');
              // 标记为异常，这样后续从应用图标进入时也能检测到
              await monitoringService.markTodayAsAbnormal();
              
              // 如果还没有保存通知发送时间，使用预期的通知时间（后台场景）
              const existingTime = await storage.getItem<string>('notificationSentTime');
              if (!existingTime) {
                // 优先使用预期的通知时间（更准确），否则使用当前时间
                const scheduledTime = await storage.getItem<string>('scheduledNotificationTime');
                const notificationTime = scheduledTime ? parseInt(scheduledTime) : Date.now();
                await storage.setItem('notificationSentTime', notificationTime.toString());
                console.log(`⏰ [responseListener] 保存通知时间: ${new Date(notificationTime).toLocaleTimeString()}${scheduledTime ? '（使用预期时间）' : '（使用当前时间）'}`);
                if (scheduledTime) {
                  console.log(`  📊 详细: scheduledTime=${scheduledTime}, 完整时间=${new Date(parseInt(scheduledTime)).toLocaleString()}, 当前时间=${new Date().toLocaleString()}`);
                }
              }
              await storage.setItem('notificationSentToday', new Date().toISOString().split('T')[0]);
              
              // 使用函数式更新，避免重复触发
              setShowAlert(prev => {
                if (prev) {
                  console.log('  ℹ️ 弹框已打开，跳过重复触发');
                  return prev;
                }
                return true;
              });
            } else if (record && record.hasUsage) {
              console.log('✅ 点击通知：有使用记录，不显示弹框');
            }
          }
        });

        // 检查是否已完成引导
        const savedSettings = await storage.getItem<UserSettings>('safetyMonitorSettings');
        if (savedSettings) {
          setSettings(savedSettings);
          setIsOnboarded(true);

          // 启动监测服务
          monitoringService.startMonitoring(handleAbnormalAlert);

          // 启动活动追踪，设置异常检查回调
          await activityTracker.start((hasAbnormal: boolean) => {
            if (hasAbnormal) {
              console.log('⚠️ 应用激活时检测到异常，显示弹框');
              // 使用函数式更新，避免重复触发
              setShowAlert(prev => {
                if (prev) {
                  console.log('  ℹ️ 弹框已打开，跳过重复触发');
                  return prev;
                }
                return true;
              });
            }
          });

          // 应用启动时也检查是否有未处理的异常
          // 注意：这里不立即显示弹框，因为界面可能还没渲染完成
          // 会在下面的 useEffect 中检查
          const hasPendingAbnormal = await monitoringService.checkPendingAbnormal();
          console.log('📱 应用启动时检查结果:', hasPendingAbnormal);
        }

        // 清理监听器
        return () => {
          notificationListener.remove();
          responseListener.remove();
        };
      } catch (error) {
        console.error('❌ 初始化失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const cleanup = init();

    return () => {
      // 清理监测服务
      monitoringService.stopMonitoring();
      activityTracker.stop();
      // 清理通知监听器
      cleanup?.then(cleanupFn => cleanupFn?.());
    };
  }, []);

  // 保存设置到存储
  const saveSettings = async (newSettings: UserSettings) => {
    setSettings(newSettings);
    await storage.setItem('safetyMonitorSettings', newSettings);
    await monitoringService.saveSettings({
      ...newSettings,
      emergencyEmail: newSettings.emergencyEmail || '', // 确保邮箱字段存在
      notificationDelay: 30,
    });

    // 重置今日记录（清除旧状态，重新开始）
    await monitoringService.resetTodayRecord();

    // 重启监测服务
    monitoringService.stopMonitoring();
    monitoringService.startMonitoring(handleAbnormalAlert);
  };

  const handleOnboardingComplete = async (data: UserSettings) => {
    // 清除可能存在的旧数据
    await monitoringService.clearAllData();
    await saveSettings(data);
    setIsOnboarded(true);

    // 启动活动追踪
    await activityTracker.start();
  };

  const handleUpdateSettings = async (data: Omit<UserSettings, 'userPhone'>) => {
    const newSettings = { ...settings, ...data };
    await saveSettings(newSettings);
    setShowSettings(false);
  };

  const handleReset = async () => {
    // 清理所有数据
    await storage.removeItem('safetyMonitorSettings');
    await monitoringService.clearAllData();

    // 停止活动追踪
    activityTracker.stop();

    setIsOnboarded(false);
    setShowSettings(false);
    setShowAlert(false);
    setSettings({
      userPhone: '',
      startTime: '23:00',
      endTime: '08:00',
      emergencyContact: '', // 短信功能，即将推出
      emergencyEmail: '', // 当前使用邮箱通知
    });
  };

  const handleAbnormalAlert = async () => {
    console.log('⚠️ 检测到异常，显示提醒对话框');
    
    // 先保存通知发送的时间戳（必须在显示弹框之前）
    // 优先使用预期的通知时间（如果存在），这样可以准确反映通知实际发送的时间
    const scheduledTime = await storage.getItem<string>('scheduledNotificationTime');
    let notificationTime: number;
    
    if (scheduledTime) {
      const scheduledTimestamp = parseInt(scheduledTime);
      const now = Date.now();
      const timeDiff = now - scheduledTimestamp;
      
      // 如果预期时间在过去10分钟内，使用预期时间（更准确）
      if (timeDiff >= 0 && timeDiff < 10 * 60 * 1000) {
        notificationTime = scheduledTimestamp;
        console.log(`⏰ [handleAbnormalAlert] 使用预期通知时间: ${new Date(notificationTime).toLocaleTimeString()}`);
      } else {
        // 预期时间太久远或不合理，使用当前时间
        notificationTime = now;
        console.log(`⏰ [handleAbnormalAlert] 预期时间不合理，使用当前时间: ${new Date(notificationTime).toLocaleTimeString()}`);
      }
    } else {
      // 没有预期时间，使用当前时间
      
      notificationTime = Date.now();
      console.log(`⏰ [handleAbnormalAlert] 无预期时间，使用当前时间: ${new Date(notificationTime).toLocaleTimeString()}`);
    }
    
    await storage.setItem('notificationSentTime', notificationTime.toString());
    await storage.setItem('notificationSentToday', new Date().toISOString().split('T')[0]);

    // 然后显示弹框
    setShowAlert(true);

    // 发送本地通知（提醒用户）
    await notificationService.sendImmediateNotification(
      '⚠️ 安全确认提醒',
      '在监测时段内未检测到使用记录，请确认安全'
    );

    // 注意：短信发送已由后端服务处理（在 monitoringService.scheduleEndTimeNotification 中安排）
    // 不再需要本地 setTimeout，避免重复发送
  };

  const handleConfirmSafe = useCallback(async () => {
    setShowAlert(false);

    // 记录用户确认（内部会标记 pendingAbnormalAlert 为已处理，并取消后端短信任务）
    await monitoringService.confirmSafe();
    
    // 用户确认后，记录一次活动（表示用户现在有活动了）
    await monitoringService.recordActivity();
    
    // 清除通知发送标记和时间戳
    await storage.removeItem('notificationSentToday');
    await storage.removeItem('notificationSentTime');
    await storage.removeItem('scheduledNotificationTime');
    
    // 清除待处理的异常提醒状态（确保完全清除）
    await monitoringService.clearPendingAbnormalAlert();
    
    console.log('✅ 用户确认安全后，已记录活动并清除所有通知相关标记');
  }, []);

  const handleCloseAlert = useCallback(async () => {
    // 倒计时结束后关闭弹框（邮件已发送）
    setShowAlert(false);
    
    // 【关键】标记待处理的异常提醒为已处理，避免重复弹出
    await monitoringService.markPendingAbnormalAlertAsHandled();
    
    // 清除通知相关标记
    await storage.removeItem('notificationSentToday');
    await storage.removeItem('notificationSentTime');
    await storage.removeItem('scheduledNotificationTime');
    
    console.log('🔕 弹框已关闭（邮件已发送，状态已标记为已处理）');
  }, []);

  // 应用完全加载后，检查是否有未处理的异常
  // 确保从应用图标进入时也能显示弹框
  useEffect(() => {
    if (!isLoading && isOnboarded && !showSettings) {
      const checkAbnormal = async () => {
        console.log('🔍 应用加载完成，开始检查未处理的异常...');
        const hasPendingAbnormal = await monitoringService.checkPendingAbnormal();
        if (hasPendingAbnormal) {
          console.log('⚠️ 应用加载完成后检测到未处理的异常，显示弹框');
          setShowAlert(true);
        } else {
          console.log('✅ 应用加载完成，无需显示弹框');
        }
      };
      
      // 延迟一点检查，确保界面已完全渲染
      const timer = setTimeout(checkAbnormal, 800);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isOnboarded, showSettings]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="auto" />
      </View>
    );
  }

  if (!isOnboarded) {
    return (
      <>
        <OnboardingScreen onComplete={handleOnboardingComplete} />
        <StatusBar style="auto" />
      </>
    );
  }

  // 设置页面
  if (showSettings) {
    return (
      <>
        <SettingsScreen
          settings={settings}
          onBack={() => setShowSettings(false)}
          onUpdate={handleUpdateSettings}
          onReset={handleReset}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  return (
    <>
      <HomeScreen settings={settings} onSettings={() => setShowSettings(true)} />
      <AbnormalAlertDialog
        isOpen={showAlert}
        onConfirmSafe={handleConfirmSafe}
        onClose={handleCloseAlert}
        startTime={settings.startTime}
        endTime={settings.endTime}
      />
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f5f8fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
