// 活动追踪服务 - 监听 App 状态变化
import { AppState, AppStateStatus } from 'react-native';
import monitoringService from './monitoringService';

// 回调函数类型
type OnAbnormalCheckCallback = (hasAbnormal: boolean) => void;

class ActivityTracker {
  private appStateSubscription: any = null;
  private lastActivityTime: Date | null = null;
  private onAbnormalCheckCallback: OnAbnormalCheckCallback | null = null;

  /**
   * 启动活动追踪
   */
  async start(onAbnormalCheck?: OnAbnormalCheckCallback): Promise<void> {
    console.log('🎯 活动追踪已启动');
    
    // 设置异常检查回调
    if (onAbnormalCheck) {
      this.onAbnormalCheckCallback = onAbnormalCheck;
    }
    
    // 记录启动时的活动
    await monitoringService.recordActivity();
    this.lastActivityTime = new Date();
    
    // 监听 App 状态变化
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange
    );
  }

  /**
   * 停止活动追踪
   */
  stop(): void {
    console.log('🛑 活动追踪已停止');
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  /**
   * 处理 App 状态变化
   */
  private handleAppStateChange = async (nextAppState: AppStateStatus): Promise<void> => {
    console.log('📱 App 状态变化:', nextAppState);
    
    if (nextAppState === 'active') {
      // App 从后台回到前台
      this.lastActivityTime = new Date();
      
      // 【重要】先检查是否有未处理的异常，再记录活动
      // 这样可以避免记录活动时将异常状态清除
      let hasAbnormal = false;
      if (this.onAbnormalCheckCallback) {
        console.log('🔍 应用激活，开始检查未处理的异常...');
        hasAbnormal = await monitoringService.checkPendingAbnormal();
        if (hasAbnormal) {
          console.log('⚠️ 应用激活：检测到未处理的异常，触发弹框检查');
          this.onAbnormalCheckCallback(true);
        } else {
          console.log('✅ 应用激活：无需显示弹框');
        }
      }
      
      // 只有在没有未处理的异常时，才记录活动
      // 如果有异常，等用户确认后再记录活动
      if (!hasAbnormal) {
        await monitoringService.recordActivity();
        console.log('✅ 记录活动: App 激活');
      } else {
        console.log('⚠️ 检测到异常，暂不记录活动（等待用户确认）');
      }
    }
  };

  /**
   * 获取最后活动时间
   */
  getLastActivityTime(): Date | null {
    return this.lastActivityTime;
  }
}

export default new ActivityTracker();

