import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import monitoringService from '../services/monitoringService';
import storage from '../utils/storage';

const { width } = Dimensions.get('window');

interface AbnormalAlertDialogProps {
  isOpen: boolean;
  onConfirmSafe: () => void;
  onClose: () => void; // 纯粹的关闭弹框，不改变状态
  startTime: string;
  endTime: string;
}

export default function AbnormalAlertDialog({
  isOpen,
  onConfirmSafe,
  onClose,
  startTime,
  endTime,
}: AbnormalAlertDialogProps) {
  const [countdown, setCountdown] = useState(300); // 默认 5分钟 = 300秒
  const [initialCountdown, setInitialCountdown] = useState(300);
  const [closeCountdown, setCloseCountdown] = useState(2); // 关闭倒计时
  const [shouldStartCountdown, setShouldStartCountdown] = useState(false);

  // 计算倒计时的函数（可复用）
  const calculateCountdown = async () => {
    const settings = await monitoringService.getSettings();
    if (settings) {
      const totalDelay = settings.notificationDelay;
      
      // 检查是否有通知发送时间
      const notificationSentTime = await storage.getItem<string>('notificationSentTime');
      
      if (notificationSentTime) {
        // 计算从通知发送到现在经过的时间（秒）
        const sentTime = parseInt(notificationSentTime);
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - sentTime) / 1000);
        
        console.log('📊 倒计时计算:', {
          通知发送时间: new Date(sentTime).toLocaleTimeString(),
          当前时间: new Date(now).toLocaleTimeString(),
          已经过时间: `${elapsedSeconds}秒`,
          总倒计时: `${totalDelay}秒`,
        });
        
        // 计算剩余倒计时时间
        const remainingTime = Math.max(0, totalDelay - elapsedSeconds);
        
        console.log(`⏱️ 倒计时应从 ${Math.floor(remainingTime / 60)}:${(remainingTime % 60).toString().padStart(2, '0')} 开始`);
        
        setInitialCountdown(totalDelay);
        setCountdown(remainingTime);
      } else {
        // 没有通知发送时间，使用默认倒计时
        console.log('⏱️ 未找到通知发送时间，使用默认倒计时');
        setInitialCountdown(totalDelay);
        setCountdown(totalDelay);
      }
      
      // 设置完倒计时后，启动倒计时
      setShouldStartCountdown(true);
    }
  };

  // 当弹框打开时，重新计算剩余倒计时
  useEffect(() => {
    if (!isOpen) {
      setCloseCountdown(2);
      setShouldStartCountdown(false);
      return;
    }

    calculateCountdown();
  }, [isOpen]); // 依赖 isOpen，每次打开时重新计算

  // 监听应用状态变化，当从后台回到前台时重新计算倒计时
  useEffect(() => {
    if (!isOpen) return;

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // 应用回到前台，重新计算倒计时
        console.log('📱 [AbnormalAlertDialog] 应用回到前台，重新计算倒计时');
        calculateCountdown();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isOpen]); // 依赖 isOpen，确保只在弹框打开时监听

  // 倒计时逻辑
  useEffect(() => {
    if (!isOpen || !shouldStartCountdown) {
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, shouldStartCountdown]);

  // 倒计时结束后 2 秒自动关闭弹框（短信已发送，只是关闭弹框）
  useEffect(() => {
    if (countdown === 0 && isOpen) {
      // 重置关闭倒计时
      setCloseCountdown(2);
      
      // 开始关闭倒计时
      const closeTimer = setInterval(() => {
        setCloseCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(closeTimer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(closeTimer);
    }
  }, [countdown, isOpen]);

  // 当关闭倒计时为 0 时，关闭弹框
  useEffect(() => {
    if (closeCountdown === 0 && countdown === 0 && isOpen) {
      // 使用 setTimeout 确保在下一个事件循环中执行，避免在渲染过程中更新状态
      const timer = setTimeout(() => {
        onClose();
      }, 0);
      
      return () => clearTimeout(timer);
    }
  }, [closeCountdown, countdown, isOpen, onClose]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={countdown === 0 ? onClose : undefined}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="warning" size={48} color="#ef4444" />
          </View>

          {/* Title */}
          <Text style={styles.title}>安全确认提醒</Text>

          {/* Description */}
          <Text style={styles.description}>
            在你设置的时间段{' '}
            <Text style={styles.timeText}>
              {startTime} - {endTime}
            </Text>{' '}
            内，没有检测到手机使用记录。
          </Text>

          {/* Warning Box */}
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              如果你一切正常，请点击下方按钮确认。
              {'\n'}
              <Text style={styles.warningHighlight}>
                {countdown > 0
                  ? `${formatTime(countdown)} 后将通知你的信任联系人。`
                  : '正在通知你的信任联系人...'}
              </Text>
            </Text>
          </View>

          {/* Progress Bar */}
          {countdown > 0 && (
            <View style={styles.progressContainer}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${(countdown / initialCountdown) * 100}%` },
                ]}
              />
            </View>
          )}

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.button, countdown === 0 && styles.buttonDisabled]}
            onPress={onConfirmSafe}
            disabled={countdown === 0}
          >
            <Text style={styles.buttonText}>
              {countdown === 0
                ? `已发送通知 (${closeCountdown}秒后关闭)`
                : '我没事，取消通知'}
            </Text>
          </TouchableOpacity>

          {/* Info */}
          <Text style={styles.infoText}>
            点击确认后，将不会通知你的信任联系人
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 32,
    paddingBottom: 48,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  timeText: {
    fontWeight: '600',
    color: '#0f172a',
  },
  warningBox: {
    backgroundColor: '#fef3c7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  warningText: {
    fontSize: 14,
    color: '#78350f',
    lineHeight: 20,
  },
  warningHighlight: {
    fontWeight: '600',
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 24,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#ef4444',
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  infoText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

