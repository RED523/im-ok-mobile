// 类型定义

export interface MonitoringRecord {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  hasUsage: boolean; // 是否有使用记录
  lastUsageTime?: string; // 最后使用时间戳
  isAbnormal: boolean; // 是否异常
  userConfirmed: boolean; // 用户是否确认安全
  notificationSent: boolean; // 是否已发送通知
}

export interface MonitoringSettings {
  userPhone: string;
  startTime: string;
  endTime: string;
  emergencyContact: string; // 紧急联系人手机号（短信功能，即将推出）
  emergencyEmail: string; // 紧急联系人邮箱（当前使用）
  notificationDelay: number; // 延迟通知时间（秒），默认 30 秒（测试用）
}

/**
 * 用户设置
 * @param userPhone 用户手机号码
 * @param startTime 开始时间
 * @param endTime 结束时间
 * @param emergencyContact 紧急联系人手机号（短信功能，即将推出）
 * @param emergencyEmail 紧急联系人邮箱（当前使用）
 */
export interface UserSettings {
  userPhone: string;
  startTime: string;
  endTime: string;
  emergencyContact: string; // 短信功能，即将推出
  emergencyEmail: string; // 当前使用邮箱通知
}

