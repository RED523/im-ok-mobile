# im-ok App - React Native 版本

一个极简的 im-ok 应用，用于监测用户在设定时间段内的手机使用情况。

## 功能特性

- ✅ **自动监测**：在设定的时间段内自动监测手机使用
- ✅ **异常提醒**：检测到异常时发送本地通知并显示提醒对话框
- ✅ **延迟通知**：给用户 5 分钟时间确认安全，避免误报
- ✅ **数据持久化**：使用 AsyncStorage 保存所有设置和监测记录
- ✅ **App 状态监听**：通过监听 App 激活状态来检测用户使用
- ✅ **本地通知**：使用 Expo Notifications 发送本地通知

## 技术栈

- **框架**：React Native + Expo
- **语言**：TypeScript
- **存储**：AsyncStorage
- **通知**：expo-notifications
- **状态管理**：React Hooks

## 项目结构

```
im-ok-mobile/
├── src/
│   ├── services/           # 服务层
│   │   ├── monitoringService.ts    # 监测服务（核心逻辑）
│   │   ├── notificationService.ts  # 通知服务
│   │   └── activityTracker.ts      # 活动追踪服务
│   ├── screens/            # 屏幕组件
│   │   ├── OnboardingScreen.tsx    # 引导页
│   │   ├── HomeScreen.tsx          # 主屏幕
│   │   └── SettingsScreen.tsx      # 设置页
│   ├── components/         # 通用组件
│   │   └── AbnormalAlertDialog.tsx # 异常提醒对话框
│   ├── utils/              # 工具函数
│   │   └── storage.ts      # AsyncStorage 封装
│   └── types/              # 类型定义
│       └── index.ts
├── App.tsx                 # 应用入口
└── app.json                # Expo 配置

```

## 开发指南

### 环境要求

- Node.js 18+ (推荐 20+)
- npm 或 yarn
- iOS 模拟器（macOS）或 Android 模拟器
- 真机测试（推荐，后台功能必须在真机上测试）

### 安装依赖

```bash
cd /Users/zzm/development/im-ok-mobile
npm install
```

### 启动开发服务器

```bash
npm start
```

然后：
- 按 `i` 在 iOS 模拟器中打开
- 按 `a` 在 Android 模拟器中打开
- 扫描二维码在真机（Expo Go App）中打开

### 在真机上测试（推荐）

1. 在手机上安装 **Expo Go** App
   - iOS: App Store 搜索 "Expo Go"
   - Android: Google Play 搜索 "Expo Go"

2. 运行 `npm start`

3. 用 Expo Go 扫描终端显示的二维码

4. App 会在手机上启动

### 构建独立 App（可选）

```bash
# 安装 EAS CLI
npm install -g eas-cli

# 登录 Expo 账号
eas login

# 配置构建
eas build:configure

# 构建 iOS
eas build --platform ios

# 构建 Android
eas build --platform android
```

## 核心功能说明

### 1. 监测服务 (`monitoringService`)

- **启动监测**：`startMonitoring(onAbnormalDetected)`
- **记录活动**：`recordActivity()`（由 activityTracker 调用）
- **检查状态**：每 30 秒自动检查一次监测状态
- **异常检测**：时段结束后检查是否有使用记录

### 2. 活动追踪 (`activityTracker`)

- 监听 App 状态变化（`AppState.addEventListener`）
- 当 App 从后台回到前台时，记录为一次活动
- 自动调用 `monitoringService.recordActivity()`

### 3. 通知服务 (`notificationService`)

- 请求通知权限
- 发送立即通知：`sendImmediateNotification(title, body)`
- 安排延迟通知：`scheduleNotification(title, body, delaySeconds)`
- 取消通知：`cancelNotification(notificationId)`

### 4. 数据存储 (`AsyncStorage`)

所有数据存储在本地：
- `safetyMonitorSettings`: 用户设置
- `monitoringRecords`: 监测记录（最近 30 天）
- `lastActivityTime`: 最后活动时间

## 与 Web 版本的主要区别

| 特性 | Web 版本 | React Native 版本 |
|-----|---------|------------------|
| 数据存储 | `localStorage`（同步） | `AsyncStorage`（异步） |
| 活动检测 | DOM 事件监听 | App 状态监听 |
| 通知 | 浏览器弹窗 | 本地通知（expo-notifications） |
| UI 组件 | HTML + CSS | React Native 组件 + StyleSheet |
| 后台运行 | ❌ 不支持 | ✅ 有限支持（iOS 限制） |

## iOS 后台限制

⚠️ **重要提示**：iOS 系统对后台运行有严格限制：

- 后台任务最短间隔 15 分钟
- 系统不保证一定会执行后台任务
- 用户可以在系统设置中关闭后台刷新

**推荐策略**：
- App 打开时立即检测
- 配合本地通知提醒用户定期打开 App
- 依赖 App 状态监听（更可靠）

## 测试建议

### 基础功能测试

1. **引导流程**：完成所有步骤，检查数据是否保存
2. **监测功能**：设置短时间段（如 5 分钟），测试监测逻辑
3. **异常提醒**：不在监测时段内活动，检查是否触发提醒
4. **用户确认**：点击"我没事"，检查是否取消通知
5. **延迟通知**：等待倒计时结束，检查是否发送通知

### 后台测试（真机）

1. App 打开后切到后台
2. 等待一段时间（如 1 分钟）
3. 重新打开 App
4. 检查是否记录了活动

## 常见问题

### Q: 为什么通知没有发送？

A: 检查以下几点：
1. 是否授予了通知权限
2. iOS：系统设置 > 通知 > im-ok > 确保已开启
3. Android：应用信息 > 通知 > 确保已开启

### Q: 后台监测不工作？

A: iOS 限制后台运行，推荐策略：
1. 依赖 App 打开时的状态检测
2. 使用本地通知提醒用户定期打开 App
3. 考虑使用 HealthKit 等系统 API（需要额外开发）

### Q: 如何调试？

A: 
1. 使用 `console.log`（在终端查看日志）
2. 使用 React Native Debugger
3. 真机：摇一摇设备打开开发菜单

## 下一步开发

- [ ] 实现真实的 SMS 发送（需要后端支持）
- [ ] 添加后台任务（BackgroundFetch）
- [ ] 集成 HealthKit（iOS）检测设备使用
- [ ] 添加历史记录查看功能
- [ ] 添加更多自定义设置（通知延迟时间等）
- [ ] 添加深色模式支持

## 联系方式

如有问题或建议，请联系开发团队。

## 许可证

MIT License

