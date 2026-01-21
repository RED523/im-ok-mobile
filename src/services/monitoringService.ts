// 监测服务 - React Native 版本（使用 AsyncStorage）
import storage from '../utils/storage';
import { MonitoringRecord, MonitoringSettings } from '../types';
import notificationService from './notificationService';

class MonitoringService {
  private static instance: MonitoringService;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastActivityTime: number = Date.now();
  private hasTriggeredToday: boolean = false; // 防止重复触发
  private onAbnormalCallback: (() => void) | null = null;
  private scheduledNotificationId: string | null = null; // 定时通知 ID

  private constructor() {
    // React Native 版本不需要浏览器事件监听
    // 活动追踪由 activityTracker 服务负责
  }

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  // ============ 活动记录 ============

  /**
   * 记录用户活动（由外部调用，如 App 状态监听）
   */
  async recordActivity(): Promise<void> {
    this.lastActivityTime = Date.now();
    await storage.setItem('lastActivityTime', this.lastActivityTime.toString());
    
    // 如果在监测时段内，记录使用
    const settings = await this.getSettings();
    if (settings && this.isInMonitoringPeriod(new Date(), settings)) {
      const today = this.getTodayDateKey();
      let record = await this.getTodayRecord();
      
      if (!record) {
        record = this.createRecord(today, settings);
      }
      
      if (!record.hasUsage) {
        record.hasUsage = true;
        record.lastUsageTime = new Date().toISOString();
        await this.saveRecord(record);
        console.log('✅ 记录使用行为:', record.lastUsageTime);
        
        // 如果有定时通知，取消它（因为用户有活动）
        if (this.scheduledNotificationId) {
          await notificationService.cancelNotification(this.scheduledNotificationId);
          this.scheduledNotificationId = null;
          console.log('🚫 已取消定时通知（用户有活动）');
        }
        
        // 清除待处理的异常提醒（因为用户有活动，通知不需要了）
        await this.clearPendingAbnormalAlert();
      }
    }
  }

  /**
   * 获取最后活动时间
   */
  async getLastActivityTime(): Promise<number> {
    const saved = await storage.getItem<string>('lastActivityTime');
    return saved ? parseInt(saved) : Date.now();
  }

  // ============ 时间判断 ============

  /**
   * 判断当前是否在监测时间段内
   * 注意：包含开始时间，不包含结束时间（左闭右开区间）
   * 例如：22:00 - 22:11 表示 [22:00, 22:11)，即 22:00 在时段内，22:11 不在
   */
  isInMonitoringPeriod(date: Date, settings: MonitoringSettings): boolean {
    const currentTime = date.getHours() * 60 + date.getMinutes();
    const [startHour, startMin] = settings.startTime.split(':').map(Number);
    const [endHour, endMin] = settings.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // 处理跨夜的情况
    if (startMinutes > endMinutes) {
      // 跨夜：当前时间 >= 开始时间 或 当前时间 < 结束时间
      // 例如 23:00 - 08:00: [23:00, 23:59] 或 [00:00, 07:59]
      return currentTime >= startMinutes || currentTime < endMinutes;
    } else {
      // 不跨夜：当前时间在开始和结束之间（左闭右开）
      // 例如 22:00 - 22:11: [22:00, 22:10]
      return currentTime >= startMinutes && currentTime < endMinutes;
    }
  }

  /**
   * 获取今天的日期键
   */
  private getTodayDateKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * 创建新记录
   */
  private createRecord(dateKey: string, settings: MonitoringSettings): MonitoringRecord {
    return {
      date: dateKey,
      startTime: settings.startTime,
      endTime: settings.endTime,
      hasUsage: false,
      isAbnormal: false,
      userConfirmed: false,
      notificationSent: false,
    };
  }

  // ============ 数据存储 ============

  /**
   * 获取所有记录
   */
  async getAllRecords(): Promise<MonitoringRecord[]> {
    const records = await storage.getItem<MonitoringRecord[]>('monitoringRecords', []);
    return records || [];
  }

  /**
   * 保存记录
   */
  private async saveRecord(record: MonitoringRecord): Promise<void> {
    const records = await this.getAllRecords();
    const index = records.findIndex(r => r.date === record.date);
    
    if (index >= 0) {
      records[index] = record;
    } else {
      records.push(record);
    }

    // 只保留最近 30 天的记录
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const filtered = records.filter(r => new Date(r.date) >= thirtyDaysAgo);

    await storage.setItem('monitoringRecords', filtered);
  }

  /**
   * 获取今天的记录
   */
  async getTodayRecord(): Promise<MonitoringRecord | null> {
    const today = this.getTodayDateKey();
    const records = await this.getAllRecords();
    return records.find(r => r.date === today) || null;
  }

  /**
   * 重置今日记录（用于重新设置时间段）
   */
  async resetTodayRecord(): Promise<void> {
    const today = this.getTodayDateKey();
    const records = await this.getAllRecords();
    const filteredRecords = records.filter(r => r.date !== today);
    await storage.setItem('monitoringRecords', filteredRecords);
    
    // 重置所有相关状态
    this.hasTriggeredToday = false;
    
    // 取消旧的定时通知
    await this.cancelScheduledNotification();
    
    // 清除今天已发送通知的标记（允许重新设置后可以再次发送）
    const lastNotificationDate = await storage.getItem<string>('lastNotificationDate');
    const todayDateKey = this.getTodayDateKey();
    if (lastNotificationDate === todayDateKey) {
      await storage.removeItem('lastNotificationDate');
      console.log('  🗑️ 已清除今日通知标记');
    }
    
    // 清除通知发送标记和时间戳
    await storage.removeItem('notificationSentToday');
    await storage.removeItem('notificationSentTime');
    await storage.removeItem('scheduledNotificationTime');
    
    // 清除待处理的异常提醒状态
    await this.clearPendingAbnormalAlert();
    
    console.log('=====================================================');
    console.log('  🗑️ 已清除通知发送标记和时间戳');
    
    console.log('🔄 今日记录已重置，所有相关状态已清除');
  }

  // ============ 设置管理 ============

  /**
   * 获取设置
   */
  async getSettings(): Promise<MonitoringSettings | null> {
    const saved = await storage.getItem<any>('safetyMonitorSettings');
    if (!saved) return null;

    return {
      userPhone: saved.userPhone,
      startTime: saved.startTime,
      endTime: saved.endTime,
      emergencyContact: saved.emergencyContact,
      notificationDelay: 30, // 默认 30 秒（测试用）
    };
  }

  /**
   * 保存设置
   */
  async saveSettings(settings: MonitoringSettings): Promise<void> {
    await storage.setItem('safetyMonitorSettings', settings);
  }

  /**
   * 校验时间段设置
   */
  validateTimeRange(startTime: string, endTime: string): {
    valid: boolean;
    error?: string;
  } {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // 计算时长（分钟）
    let duration: number;
    if (startMinutes > endMinutes) {
      // 跨夜
      duration = (24 * 60 - startMinutes) + endMinutes;
      console.log('跨夜时长：===========>', `${duration} 分钟`);
    } else {
      duration = endMinutes - startMinutes;
      console.log('不跨夜时长：===========>', `${duration} 分钟`);
    }    

    // TODO:【测试模式】暂时注释 6 小时限制，方便测试(后面会放开)
    // if (duration < 6 * 60) {
    //   return {
    //     valid: false,
    //     error: '时间段不能少于 6 小时',
    //   };
    // }

    // 检查是否跨夜（推荐）
    const isCrossMidnight = startMinutes > endMinutes;
    if (!isCrossMidnight) {
      // 不强制跨夜，但给出提示
      return {
        valid: true,
        error: '建议设置跨夜的时间段以覆盖睡眠时段',
      };
    }

    return { valid: true };
  }

  // ============ 监测控制 ============

  /**
   * 开始监测
   */
  startMonitoring(onAbnormalDetected: () => void): void {
    this.onAbnormalCallback = onAbnormalDetected;
    
    // 清除旧的定时器
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // 重置触发标记
    this.hasTriggeredToday = false;
    
    // 确保取消旧的定时通知（如果有）
    this.cancelScheduledNotification();

    console.log('🔍 监测服务已启动');

    // 每 30 秒检查一次
    this.checkInterval = setInterval(() => {
      this.checkMonitoringStatus();
    }, 30000);

    // 立即执行一次检查
    this.checkMonitoringStatus();
  }

  /**
   * 停止监测
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    // 取消定时通知
    this.cancelScheduledNotification();
    console.log('🛑 监测服务已停止');
  }

  /**
   * 检查监测状态（核心逻辑）
   */
  private async checkMonitoringStatus(): Promise<void> {
    const settings = await this.getSettings();
    if (!settings) return;

    const now = new Date();
    const isInPeriod = this.isInMonitoringPeriod(now, settings);
    const today = this.getTodayDateKey();
    const currentTime = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

    console.log(`⏰ [${currentTime}] 检查状态:`, {
      监测时段: `${settings.startTime} - ${settings.endTime}`,
      当前在时段内: isInPeriod,
      今日日期: today,
    });

    // 如果不在监测时段内，检查时段是否刚刚结束
    if (!isInPeriod) {
      await this.checkPeriodEnd(settings, now);
    } else {
      console.log('  ℹ️ 当前在监测时段内');
      // 在监测时段内，确保记录存在
      const record = await this.getTodayRecord();
      if (!record) {
        const newRecord = this.createRecord(today, settings);
        await this.saveRecord(newRecord);
        console.log('  📝 创建今日监测记录');
      }
      
      // 设置定时通知（在监测时段结束时发送）
      await this.scheduleEndTimeNotification(settings, now);
    }
  }

  /**
   * 检查是否有未处理的异常需要显示弹框
   * 用于应用从后台进入前台时检查
   */
  async checkPendingAbnormal(): Promise<boolean> {
    console.log('🔍 开始检查未处理的异常...');
    
    const settings = await this.getSettings();
    if (!settings) {
      console.log('  ❌ 未找到设置');
      return false;
    }

    let record = await this.getTodayRecord();
    const now = new Date();
    const today = this.getTodayDateKey();
    const isInPeriod = this.isInMonitoringPeriod(now, settings);
    
    // 【关键】首先检查是否有待处理的异常提醒（后台通知场景）
    // 这是为了处理应用在后台或被杀死时，定时通知已发送的情况
    const hasPendingAlert = await this.hasPendingAbnormalAlertToShow();
    if (hasPendingAlert) {
      console.log('  ⚠️ 检测到待处理的异常提醒（后台通知已触发）');
      
      // 确保记录存在并标记为异常
      if (!record) {
        record = this.createRecord(today, settings);
        record.isAbnormal = true;
        record.hasUsage = false;
        await this.saveRecord(record);
        console.log('  📝 已创建异常记录');
      } else if (!record.isAbnormal && !record.hasUsage && !record.userConfirmed) {
        record.isAbnormal = true;
        await this.saveRecord(record);
        console.log('  📝 已标记为异常');
      }
      
      // 如果用户已确认或有使用记录，不显示弹框
      if (record.userConfirmed) {
        console.log('  ✅ 用户已确认，不需要显示弹框');
        return false;
      }
      if (record.hasUsage) {
        console.log('  ✅ 有使用记录，不需要显示弹框');
        return false;
      }
      
      // 确保有通知时间戳
      await this.ensureNotificationTimeExists(settings);
      
      // 同时设置 notificationSentToday 标记，确保状态一致
      await storage.setItem('notificationSentToday', today);
      
      return true;
    }
    
    // 【关键修复】如果记录不存在，说明今天还没开始过监测，不应该判定为异常
    // 只有在"有记录但无使用"的情况下才可能是异常
    if (!record) {
      console.log('  ℹ️ 未找到今日记录，可能还未开始首次监测，不判定为异常');
      return false;
    }

    console.log('  📊 记录状态:', {
      有使用: record.hasUsage,
      已确认: record.userConfirmed,
      已异常: record.isAbnormal,
      最后使用: record.lastUsageTime,
    });

    // 如果用户已确认，不需要显示弹框
    if (record.userConfirmed) {
      console.log('  ✅ 用户已确认，不需要显示弹框');
      return false;
    }

    // 如果有使用记录，不需要显示弹框
    if (record.hasUsage) {
      console.log('  ✅ 有使用记录，不需要显示弹框');
      return false;
    }

    // 检查今天是否已经发送过通知
    const notificationSentDate = await storage.getItem<string>('notificationSentToday');
    const notificationSentToday = notificationSentDate === today;
    
    console.log('  ⏰ 时间检查:', {
      当前时间: `${now.getHours()}:${now.getMinutes()}`,
      监测时段: `${settings.startTime} - ${settings.endTime}`,
      在时段内: isInPeriod,
      通知已发送: notificationSentToday,
    });
    
    // 【关键】如果今天已经发送过通知，说明时段已结束且无使用记录
    // 立即标记为异常并显示弹框
    if (notificationSentToday) {
      console.log('  ⚠️ 检测到未处理的异常状态（通知已发送，无使用记录）');
      
      // 如果还没有标记为异常，先标记
      if (!record.isAbnormal) {
        record.isAbnormal = true;
        await this.saveRecord(record);
        console.log('  📝 已标记为异常');
      }
      
      // 确保有通知时间戳
      await this.ensureNotificationTimeExists(settings);
      
      return true;
    }
    
    // 如果有记录，且当前不在监测时段内，说明时段已经结束
    // （因为记录是在进入时段时创建的）
    if (!isInPeriod) {
      // 时段已结束，且没有使用记录，且未确认，需要显示弹框
      console.log('  ⚠️ 检测到未处理的异常状态（时段已结束，无使用记录）');
      
      // 如果还没有标记为异常，先标记
      if (!record.isAbnormal) {
        record.isAbnormal = true;
        await this.saveRecord(record);
        console.log('  📝 已标记为异常');
      }
      
      // 确保有通知时间戳
      await this.ensureNotificationTimeExists(settings);
      
      return true;
    }

    // 如果已经在监测时段内，但已标记为异常，也需要显示弹框
    if (record.isAbnormal) {
      console.log('  ⚠️ 检测到未处理的异常状态（已标记为异常）');
      
      // 确保有通知时间戳
      await this.ensureNotificationTimeExists(settings);
      
      return true;
    }

    console.log('  ✅ 无需显示弹框');
    return false;
  }

  /**
   * 确保通知时间戳存在（如果不存在，使用预期通知时间或监测时段结束时间）
   */
  private async ensureNotificationTimeExists(settings: MonitoringSettings): Promise<void> {
    const existingTime = await storage.getItem<string>('notificationSentTime');
    if (!existingTime) {
      const now = new Date();
      const [endHour, endMin] = settings.endTime.split(':').map(Number);
      const endDate = new Date();
      endDate.setHours(endHour, endMin, 0, 0);
      
      // 计算今天的结束时间（不加一天）
      const todayEndTime = endDate.getTime();
      
      // 优先使用预期的通知时间（如果有的话）
      const scheduledTime = await storage.getItem<string>('scheduledNotificationTime');
      
      if (scheduledTime) {
        const scheduledTimestamp = parseInt(scheduledTime);
        const scheduledDate = new Date(scheduledTimestamp);
        const timeDiff = scheduledTimestamp - now.getTime();
        
        // 检查预期时间是否合理（应该在过去24小时内）
        if (timeDiff < 0 && timeDiff > -24 * 60 * 60 * 1000) {
          // 预期时间在过去24小时内，是合理的
          await storage.setItem('notificationSentTime', scheduledTime);
          console.log(`  ⏰ [ensureNotificationTimeExists] 使用预期通知时间: ${scheduledDate.toLocaleString()}`);
        } else {
          // 预期时间不合理（可能是未来的或太久以前的），使用今天的结束时间
          console.log(`  ⚠️ [ensureNotificationTimeExists] 预期时间不合理(${scheduledDate.toLocaleString()})，使用今天的结束时间`);
          await storage.setItem('notificationSentTime', todayEndTime.toString());
          console.log(`  ⏰ [ensureNotificationTimeExists] 使用今天的结束时间: ${new Date(todayEndTime).toLocaleString()}`);
        }
      } else {
        // 如果没有预期时间，使用今天的监测时段结束时间作为基准
        await storage.setItem('notificationSentTime', todayEndTime.toString());
        console.log(`  ⏰ [ensureNotificationTimeExists] 使用今天的结束时间作为基准: ${new Date(todayEndTime).toLocaleString()}`);
      }
    }
  }

  /**
   * 检查时段是否刚结束
   */
  private async checkPeriodEnd(settings: MonitoringSettings, now: Date): Promise<void> {
    const [endHour, endMin] = settings.endTime.split(':').map(Number);
    const endMinutes = endHour * 60 + endMin;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 检查是否刚过结束时间（容忍30分钟窗口，方便测试）
    let timeSinceEnd: number;
    
    // 处理跨夜情况
    if (currentMinutes < endMinutes) {
      timeSinceEnd = currentMinutes + (24 * 60 - endMinutes);
      if (timeSinceEnd > 60) {
        timeSinceEnd = Math.abs(currentMinutes - endMinutes);
      }
    } else {
      timeSinceEnd = currentMinutes - endMinutes;
    }

    const justEnded = timeSinceEnd >= 0 && timeSinceEnd <= 30;

    console.log('  ⏱️ 时段已结束，检查:', {
      结束时间: settings.endTime,
      距离结束: `${timeSinceEnd} 分钟`,
      在检测窗口内: justEnded,
    });

    if (justEnded && !this.hasTriggeredToday) {
      // 时段刚结束，检查使用记录
      const record = await this.getTodayRecord();
      
      if (!record) {
        console.log('  ℹ️ 没有找到今日记录，跳过检查（可能是刚重置或首次启动）');
        return;
      }

      console.log('  📊 今日记录:', {
        有使用: record.hasUsage,
        已异常: record.isAbnormal,
        已确认: record.userConfirmed,
        最后使用: record.lastUsageTime,
      });

      // 检查是否需要触发异常
      if (!record.hasUsage && !record.isAbnormal && !record.userConfirmed) {
        console.log('  🚨 检测到异常：时段内无使用记录');
        record.isAbnormal = true;
        await this.saveRecord(record);
        this.hasTriggeredToday = true;
        
        // 调用异常回调
        if (this.onAbnormalCallback) {
          this.onAbnormalCallback();
        }
      } else if (record.hasUsage) {
        console.log('  ✅ 正常：时段内有使用记录');
      } else if (record.isAbnormal) {
        console.log('  ℹ️ 已标记为异常（不重复触发）');
      } else if (record.userConfirmed) {
        console.log('  ✅ 用户已确认安全');
      }
    }
  }

  // ============ 用户操作 ============

  /**
   * 用户确认安全
   */
  async confirmSafe(): Promise<void> {
    const record = await this.getTodayRecord();
    if (record) {
      record.userConfirmed = true;
      record.isAbnormal = false;
      await this.saveRecord(record);
      console.log('✅ 用户确认安全');
    }
    
    // 【关键】标记待处理的异常提醒为已处理
    await this.markPendingAbnormalAlertAsHandled();
  }

  /**
   * 标记今日记录为异常（用于通知触发时）
   */
  async markTodayAsAbnormal(): Promise<void> {
    const record = await this.getTodayRecord();
    if (record && !record.isAbnormal && !record.hasUsage && !record.userConfirmed) {
      record.isAbnormal = true;
      await this.saveRecord(record);
      console.log('⚠️ 今日记录已标记为异常');
    }
  }

  /**
   * 发送通知（模拟）
   */
  async sendNotification(settings: MonitoringSettings): Promise<void> {
    const record = await this.getTodayRecord();
    
    if (!record) {
      console.warn('❌ 无法发送通知：记录不存在');
      return;
    }

    if (record.notificationSent) {
      console.log('ℹ️ 通知已发送，跳过');
      return;
    }

    // 模拟发送短信
    console.log(`
====================================
📧 短信通知模拟
====================================
发送至: ${settings.emergencyContact}

内容：
这是一条安全提醒。
在【${settings.startTime}–${settings.endTime}】这个时间段内，未检测到手机使用记录。
建议你尝试联系 TA 确认情况。

====================================
    `);

    // 标记为已发送
    record.notificationSent = true;
    await this.saveRecord(record);
  }

  // ============ 定时通知 ============

  /**
   * 设置监测时段结束时的定时通知
   */
  private async scheduleEndTimeNotification(settings: MonitoringSettings, now: Date): Promise<void> {
    // 如果已经有定时通知，先取消旧的
    if (this.scheduledNotificationId) {
      await this.cancelScheduledNotification();
    }

    // 计算到结束时间的秒数
    const [endHour, endMin] = settings.endTime.split(':').map(Number);
    const [startHour, startMin] = settings.startTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const isCrossMidnight = startMinutes > endMinutes; // 是否跨夜
    
    const endDate = new Date();
    endDate.setHours(endHour, endMin, 0, 0);
    
    // 如果是跨夜的情况，并且当前时间在午夜之后、结束时间之前，结束时间就是今天
    // 否则，如果结束时间已经过了，就是明天
    if (isCrossMidnight) {
      // 跨夜情况：如果当前时间在午夜到结束时间之间，endDate 就是今天
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      if (currentMinutes > endMinutes) {
        // 当前时间已过结束时间，说明是明天的结束时间
        endDate.setDate(endDate.getDate() + 1);
      }
    } else {
      // 非跨夜情况：如果结束时间已经过了，就是明天
      if (endDate < now) {
        endDate.setDate(endDate.getDate() + 1);
      }
    }
    
    const secondsUntilEnd = Math.floor((endDate.getTime() - now.getTime()) / 1000);
    
    console.log(`  ⏰ 计算结束时间: 当前=${now.toLocaleString()}, 结束=${endDate.toLocaleString()}, 跨夜=${isCrossMidnight}, 距离=${secondsUntilEnd}秒`);
    
    // 如果已经过了结束时间，不设置通知
    if (secondsUntilEnd <= 0) {
      console.log(`  ❌ 结束时间已过，不设置通知`);
      return;
    }

    // 检查今天是否已经发送过通知
    const lastNotificationDate = await storage.getItem<string>('lastNotificationDate');
    const today = this.getTodayDateKey();
    if (lastNotificationDate === today) {
      console.log('  ℹ️ 今天已发送过通知，不设置定时通知');
      return;
    }

    // 【重要】只有在时段还没结束时才保存预期通知时间
    // 如果时段已经结束，不应该保存，因为那是下一个周期的时间
    if (secondsUntilEnd > 0) {
      // 保存预期的通知发送时间（用于后台场景）
      const existingScheduledTime = await storage.getItem<string>('scheduledNotificationTime');
      const shouldUpdate = !existingScheduledTime || 
                           parseInt(existingScheduledTime) !== endDate.getTime();
      
      if (shouldUpdate) {
        // 保存或更新预期的通知发送时间
        await storage.setItem('scheduledNotificationTime', endDate.getTime().toString());
        console.log(`  ⏰ 保存预期通知时间: ${endDate.toLocaleTimeString()}（用于后台场景）`);
        console.log(`  📊 详细信息: 时间戳=${endDate.getTime()}, 完整时间=${endDate.toLocaleString()}, 日期=${endDate.toLocaleDateString()}`);
        
        // 【关键】保存待处理的异常提醒状态
        // 当通知发送时，无论应用是否在前台，都能检测到需要显示弹框
        await this.savePendingAbnormalAlert(endDate.getTime(), today);
      } else if (existingScheduledTime) {
        const existingDate = new Date(parseInt(existingScheduledTime));
        console.log(`  ℹ️ 预期通知时间已存在: ${existingDate.toLocaleTimeString()}, 不需要更新`);
      }
    } else {
      console.log(`  ⚠️ 时段已结束，不保存预期通知时间（避免保存下一个周期的时间）`);
    }

    // 设置定时通知
    const notificationId = await notificationService.scheduleNotification(
      '⚠️ 安全确认提醒',
      `在监测时段 ${settings.startTime} - ${settings.endTime} 内未检测到活动记录，请确认你的安全状态`,
      secondsUntilEnd
    );

    if (notificationId) {
      this.scheduledNotificationId = notificationId;
      console.log(`  📅 已设置定时通知: ${Math.floor(secondsUntilEnd / 60)}分钟后发送`);
    }
  }

  // ============ 待处理异常提醒状态管理 ============

  /**
   * 保存待处理的异常提醒状态
   * 当定时通知被设置时调用，记录通知预计发送时间
   */
  private async savePendingAbnormalAlert(scheduledTime: number, dateKey: string): Promise<void> {
    const pendingAlert = {
      scheduledTime,
      dateKey,
      handled: false, // 用户是否已处理
    };
    await storage.setItem('pendingAbnormalAlert', pendingAlert);
    console.log(`  📌 已保存待处理异常提醒: 预计 ${new Date(scheduledTime).toLocaleTimeString()} 触发`);
  }

  /**
   * 检查是否有待处理的异常提醒需要显示
   * 当应用激活时调用，检查通知是否已经发送（时间已过）
   */
  async hasPendingAbnormalAlertToShow(): Promise<boolean> {
    const pendingAlert = await storage.getItem<{
      scheduledTime: number;
      dateKey: string;
      handled: boolean;
    }>('pendingAbnormalAlert');

    if (!pendingAlert) {
      return false;
    }

    const now = Date.now();
    const today = this.getTodayDateKey();

    // 检查是否是今天的提醒
    if (pendingAlert.dateKey !== today) {
      console.log('  ℹ️ 待处理提醒不是今天的，清除');
      await storage.removeItem('pendingAbnormalAlert');
      return false;
    }

    // 检查用户是否已处理
    if (pendingAlert.handled) {
      console.log('  ℹ️ 待处理提醒已被用户处理');
      return false;
    }

    // 检查通知是否已经发送（当前时间已过预计发送时间）
    if (now >= pendingAlert.scheduledTime) {
      console.log(`  ⚠️ 检测到待处理的异常提醒: 通知应该已在 ${new Date(pendingAlert.scheduledTime).toLocaleTimeString()} 发送`);
      return true;
    }

    console.log(`  ℹ️ 通知尚未发送（预计 ${new Date(pendingAlert.scheduledTime).toLocaleTimeString()}）`);
    return false;
  }

  /**
   * 标记待处理的异常提醒已被用户处理
   */
  async markPendingAbnormalAlertAsHandled(): Promise<void> {
    const pendingAlert = await storage.getItem<{
      scheduledTime: number;
      dateKey: string;
      handled: boolean;
    }>('pendingAbnormalAlert');

    if (pendingAlert) {
      pendingAlert.handled = true;
      await storage.setItem('pendingAbnormalAlert', pendingAlert);
      console.log('  ✅ 已标记待处理异常提醒为已处理');
    }
  }

  /**
   * 清除待处理的异常提醒状态
   */
  async clearPendingAbnormalAlert(): Promise<void> {
    await storage.removeItem('pendingAbnormalAlert');
    console.log('  🗑️ 已清除待处理异常提醒');
  }

  /**
   * 取消定时通知
   */
  async cancelScheduledNotification(): Promise<void> {
    if (this.scheduledNotificationId) {
      await notificationService.cancelNotification(this.scheduledNotificationId);
      this.scheduledNotificationId = null;
      console.log('  🚫 已取消定时通知');
    }
  }

  // ============ 数据清理 ============

  /**
   * 清理所有数据
   */
  async clearAllData(): Promise<void> {
    // 清除所有存储的数据
    await storage.removeItem('monitoringRecords');
    await storage.removeItem('lastActivityTime');
    await storage.removeItem('notificationSentToday');
    await storage.removeItem('notificationSentTime');
    await storage.removeItem('scheduledNotificationTime');
    await storage.removeItem('lastNotificationDate');
    await storage.removeItem('pendingAbnormalAlert');
    
    // 取消所有通知
    await this.cancelScheduledNotification();
    
    // 重置内部状态
    this.hasTriggeredToday = false;
    
    // 停止监测服务
    this.stopMonitoring();
    
    console.log('🗑️ 所有监测数据已清除');
  }
}

export default MonitoringService.getInstance();

