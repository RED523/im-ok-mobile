// 短信 API 服务 - 与后端通信
import { MonitoringSettings } from '../types';

// 后端服务地址（开发时使用本地地址，生产时改为真实地址）
// 注意：真机需要使用电脑的实际 IP 地址，不能用 localhost
// TODO: 生产环境请改为真实服务器地址
const API_BASE_URL = __DEV__ 
  ? 'http://192.168.188.30:3000'  // 开发环境（电脑的 IP 地址）
  : 'https://your-production-server.com'; // 生产环境

class SMSApiService {
  private static instance: SMSApiService;

  private constructor() {}

  static getInstance(): SMSApiService {
    if (!SMSApiService.instance) {
      SMSApiService.instance = new SMSApiService();
    }
    return SMSApiService.instance;
  }

  /**
   * 生成唯一的任务ID
   */
  private generateTaskId(userPhone: string): string {
    const today = new Date().toISOString().split('T')[0];
    return `sms-${userPhone}-${today}-${Date.now()}`;
  }

  /**
   * 安排发送短信
   * @param settings 监测设置
   * @param delaySeconds 延迟秒数（倒计时时间）
   * @returns taskId 任务ID，用于后续取消
   */
  async scheduleSMS(settings: MonitoringSettings, delaySeconds: number): Promise<string | null> {
    try {
      const taskId = this.generateTaskId(settings.userPhone);
      const scheduledTime = new Date(Date.now() + delaySeconds * 1000);
      
      const message = `这是一条安全提醒。在【${settings.startTime}–${settings.endTime}】这个时间段内，未检测到手机使用记录。建议你尝试联系 TA 确认情况。`;

      console.log('📡 调用后端 API 安排短信:', {
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
        console.log('✅ 短信任务已安排到后端:', taskId);
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

export default SMSApiService.getInstance();

