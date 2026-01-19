// 通知服务 - 本地通知
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 配置通知行为（系统级通知，息屏也能显示）
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true, // 显示横幅
    shouldShowList: true,    // 显示在通知列表
  }),
});

class NotificationService {
  private permissionGranted = false;

  /**
   * 初始化通知服务
   */
  async init(): Promise<void> {
    await this.requestPermission();
  }

  /**
   * 请求通知权限
   */
  async requestPermission(): Promise<boolean> {
    // Android 需要设置通知频道
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    this.permissionGranted = finalStatus === 'granted';
    console.log('📢 通知权限:', this.permissionGranted ? '已授予' : '被拒绝');
    
    return this.permissionGranted;
  }

  /**
   * 发送立即通知（系统级通知，息屏也能显示）
   */
  async sendImmediateNotification(title: string, body: string): Promise<void> {
    if (!this.permissionGranted) {
      console.warn('⚠️ 没有通知权限');
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true, // 播放提示音
          priority: Notifications.AndroidNotificationPriority.MAX, // Android 最高优先级
          badge: 1, // iOS 显示角标
        },
        trigger: null, // 立即发送
      });
      
      console.log('📢 系统通知已发送:', title);
    } catch (error) {
      console.error('❌ 发送通知失败:', error);
    }
  }

  /**
   * 安排延迟通知（系统级通知，息屏也能显示）
   */
  async scheduleNotification(
    title: string,
    body: string,
    delaySeconds: number
  ): Promise<string> {
    if (!this.permissionGranted) {
      console.warn('⚠️ 没有通知权限');
      return '';
    }

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true, // 播放提示音
          priority: Notifications.AndroidNotificationPriority.MAX, // Android 最高优先级
          badge: 1, // iOS 显示角标
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: delaySeconds,
        },
      });
      
      console.log(`📢 系统通知已安排: ${delaySeconds}秒后发送`, notificationId);
      return notificationId;
    } catch (error) {
      console.error('❌ 安排通知失败:', error);
      return '';
    }
  }

  /**
   * 取消通知
   */
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('🚫 通知已取消:', notificationId);
    } catch (error) {
      console.error('❌ 取消通知失败:', error);
    }
  }

  /**
   * 取消所有通知
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('🚫 所有通知已取消');
    } catch (error) {
      console.error('❌ 取消所有通知失败:', error);
    }
  }
}

export default new NotificationService();

