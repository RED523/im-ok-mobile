// 通知 API 服务 - 与后端通信
// 当前阶段使用邮件通知，短信功能即将推出
import { MonitoringSettings } from '../types';

// 后端服务地址（开发时使用本地地址，生产时改为真实地址）
// 注意：
// - iOS 模拟器：可以使用 localhost
// - Android 模拟器：需要使用 10.0.2.2
// - 真机测试：需要使用电脑的实际 IP 地址（运行 ipconfig getifaddr en0 查看）
// TODO: 生产环境请改为真实服务器地址
const API_BASE_URL = __DEV__ 
  ? 'http://192.168.1.47:3000'  // 开发环境（真机使用电脑 IP 地址）
  : 'https://your-production-server.com'; // 生产环境

class NotificationApiService {
  private static instance: NotificationApiService;

  private constructor() {}

  static getInstance(): NotificationApiService {
    if (!NotificationApiService.instance) {
      NotificationApiService.instance = new NotificationApiService();
    }
    return NotificationApiService.instance;
  }

  /**
   * 生成唯一的任务ID
   */
  private generateTaskId(userPhone: string, type: 'email' | 'sms' = 'email'): string {
    const today = new Date().toISOString().split('T')[0];
    return `${type}-${userPhone}-${today}-${Date.now()}`;
  }

  /**
   * 安排发送邮件通知（当前使用）
   * @param settings 监测设置
   * @param delaySeconds 延迟秒数（倒计时时间）
   * @returns taskId 任务ID，用于后续取消
   */
  async scheduleEmail(settings: MonitoringSettings, delaySeconds: number): Promise<string | null> {
    try {
      // 检查是否配置了邮箱
      if (!settings.emergencyEmail) {
        console.warn('⚠️ 未配置紧急联系人邮箱，跳过邮件通知');
        return null;
      }

      const taskId = this.generateTaskId(settings.userPhone, 'email');
      const scheduledTime = new Date(Date.now() + delaySeconds * 1000);
      
      const message = `这是一条安全提醒。\n\n在【${settings.startTime} – ${settings.endTime}】这个时间段内，未检测到手机使用记录。\n\n建议你尝试联系 TA 确认情况。`;

      console.log('📡 调用后端 API 安排邮件通知:', {
        taskId,
        email: settings.emergencyEmail,
        scheduledTime: scheduledTime.toLocaleString(),
        delaySeconds,
      });

      const response = await fetch(`${API_BASE_URL}/schedule-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId,
          email: settings.emergencyEmail,
          message,
          scheduledTime: scheduledTime.toISOString(),
          userPhone: settings.userPhone,
          startTime: settings.startTime,
          endTime: settings.endTime,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ 邮件任务已安排到后端:', taskId);
        return taskId;
      } else {
        console.error('❌ 安排邮件失败:', result.error);
        return null;
      }
    } catch (error) {
      console.error('❌ 调用后端 API 失败:', error);
      return null;
    }
  }

  /**
   * 取消发送邮件
   * @param taskId 任务ID
   */
  async cancelEmail(taskId: string): Promise<boolean> {
    try {
      console.log('📡 调用后端 API 取消邮件:', taskId);

      const response = await fetch(`${API_BASE_URL}/cancel-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ 邮件任务已取消:', taskId);
        return true;
      } else {
        console.error('❌ 取消邮件失败:', result.error);
        return false;
      }
    } catch (error) {
      console.error('❌ 调用后端 API 失败:', error);
      return false;
    }
  }

  /**
   * 安排发送短信（功能即将推出）
   * @param settings 监测设置
   * @param delaySeconds 延迟秒数（倒计时时间）
   * @returns taskId 任务ID，用于后续取消
   * 
   * 注意：短信功能即将推出，当前仅记录日志不实际发送
   */
  async scheduleSMS(settings: MonitoringSettings, delaySeconds: number): Promise<string | null> {
    try {
      const taskId = this.generateTaskId(settings.userPhone, 'sms');
      const scheduledTime = new Date(Date.now() + delaySeconds * 1000);
      
      const message = `这是一条安全提醒。在【${settings.startTime}–${settings.endTime}】这个时间段内，未检测到手机使用记录。建议你尝试联系 TA 确认情况。`;

      console.log('📡 调用后端 API 安排短信（即将推出）:', {
        taskId,
        phone: settings.emergencyContact,
        scheduledTime: scheduledTime.toLocaleString(),
        delaySeconds,
      });

      const response = await fetch(`${API_BASE_URL}/schedule-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId,
          phone: settings.emergencyContact,
          message,
          scheduledTime: scheduledTime.toISOString(),
          userPhone: settings.userPhone,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ 短信任务已安排到后端（即将推出）:', taskId);
        return taskId;
      } else {
        console.error('❌ 安排短信失败:', result.error);
        return null;
      }
    } catch (error) {
      console.error('❌ 调用后端 API 失败:', error);
      return null;
    }
  }

  /**
   * 取消发送短信
   * @param taskId 任务ID
   */
  async cancelSMS(taskId: string): Promise<boolean> {
    try {
      console.log('📡 调用后端 API 取消短信:', taskId);

      const response = await fetch(`${API_BASE_URL}/cancel-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ 短信任务已取消:', taskId);
        return true;
      } else {
        console.error('❌ 取消短信失败:', result.error);
        return false;
      }
    } catch (error) {
      console.error('❌ 调用后端 API 失败:', error);
      return false;
    }
  }

  /**
   * 取消通知（通用方法，自动识别类型）
   * @param taskId 任务ID
   */
  async cancelNotification(taskId: string): Promise<boolean> {
    if (taskId.startsWith('email-')) {
      return this.cancelEmail(taskId);
    } else if (taskId.startsWith('sms-')) {
      return this.cancelSMS(taskId);
    }
    // 兼容旧的 taskId 格式，默认尝试取消邮件
    return this.cancelEmail(taskId);
  }

  /**
   * 查询任务状态
   * @param taskId 任务ID
   */
  async getTaskStatus(taskId: string): Promise<{ exists: boolean; scheduledTime?: string } | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/task-status/${taskId}`);
      const result = await response.json();

      if (result.success) {
        return {
          exists: result.exists,
          scheduledTime: result.scheduledTime,
        };
      }
      return null;
    } catch (error) {
      console.error('❌ 查询任务状态失败:', error);
      return null;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const result = await response.json();
      return result.status === 'ok';
    } catch (error) {
      console.error('❌ 后端服务不可用:', error);
      return false;
    }
  }
}

// 导出实例（保持向后兼容）
const notificationApiService = NotificationApiService.getInstance();

// 向后兼容的别名导出
export default notificationApiService;
export { notificationApiService };

