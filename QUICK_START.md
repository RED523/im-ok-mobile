# 快速启动指南 🚀

## 1. 启动开发服务器

```bash
cd /Users/zzm/development/im-ok-mobile
npm start
```

## 2. 选择运行平台

### 选项 A：iOS 模拟器（macOS）
```bash
# 启动后按 'i' 键
# 或运行：
npm run ios
```

### 选项 B：Android 模拟器
```bash
# 启动后按 'a' 键
# 或运行：
npm run android
```

### 选项 C：真机测试（推荐）⭐

1. **在手机上安装 Expo Go**
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **启动开发服务器**
   ```bash
   npm start
   ```

3. **扫描二维码**
   - iOS: 使用相机 App 扫描
   - Android: 打开 Expo Go 点击"扫描二维码"

## 3. 测试功能

### 基础流程测试

1. **引导流程**
   - 输入手机号（11位数字）
   - 设置监测时间段（建议：23:00 - 08:00）
   - 添加紧急联系人

2. **主屏幕**
   - 查看监测状态
   - 查看监测时间段
   - 查看紧急联系人

3. **设置页面**
   - 点击右上角设置图标
   - 修改时间段
   - 修改紧急联系人
   - 保存更改

### 监测功能测试

**方案 1：快速测试（推荐）**

1. 设置一个短时间段（如：当前时间 + 2分钟 到 当前时间 + 5分钟）
2. 在时间段内保持 App 打开或切换到后台再回来
3. 等待时间段结束
4. 观察是否触发异常提醒

**方案 2：完整测试**

1. 设置跨夜时间段（23:00 - 08:00）
2. 等到晚上 23:00 后测试
3. 在时间段内使用 App
4. 第二天早上 8:00 后检查状态

### 异常提醒测试

1. 设置短时间段（如 5 分钟）
2. **不要**在时间段内使用 App
3. 时间段结束后，应该：
   - 收到本地通知 ✅
   - 显示异常提醒对话框 ✅
   - 开始 5 分钟倒计时 ✅

4. 测试两种情况：
   - **情况 A**：点击"我没事"→ 取消通知
   - **情况 B**：等待倒计时结束 → 发送通知（模拟）

## 4. 常见问题

### Q: 启动失败？

```bash
# 清除缓存并重新安装
rm -rf node_modules
npm install
npm start -- --clear
```

### Q: iOS 模拟器打不开？

```bash
# 确保已安装 Xcode
xcode-select --install

# 打开模拟器
open -a Simulator
```

### Q: 通知不显示？

1. 检查是否授予了通知权限
2. iOS：设置 > 通知 > im-ok > 允许通知
3. Android：应用信息 > 通知 > 允许通知

### Q: 看到很多警告（WARN）？

这是正常的！主要是 Node 版本警告，不影响使用。

## 5. 开发工具

### 打开开发菜单

- **iOS 模拟器**: `Cmd + D`
- **Android 模拟器**: `Cmd + M` 或 `Ctrl + M`
- **真机**: 摇一摇设备

### 重新加载

- **开发菜单**: 点击 "Reload"
- **快捷键**: `R` (在终端中)

### 查看日志

所有 `console.log` 输出都会显示在启动终端中。

## 6. 项目结构速览

```
im-ok-mobile/
├── App.tsx                         # ⭐ 应用入口
├── src/
│   ├── services/
│   │   ├── monitoringService.ts   # ⭐ 核心监测逻辑
│   │   ├── notificationService.ts  # 通知服务
│   │   └── activityTracker.ts      # 活动追踪
│   ├── screens/
│   │   ├── OnboardingScreen.tsx   # 引导页
│   │   ├── HomeScreen.tsx          # 主屏幕
│   │   └── SettingsScreen.tsx      # 设置页
│   └── components/
│       └── AbnormalAlertDialog.tsx # 异常提醒
└── app.json                        # Expo 配置
```

## 7. 下一步

- ✅ 测试所有功能
- ✅ 在真机上测试通知
- ✅ 测试后台切换
- 📝 记录任何 bug
- 🚀 准备上架 App Store

## 需要帮助？

1. 查看 `README.md` 了解详细文档
2. 查看 `MIGRATION_COMPLETE.md` 了解迁移详情
3. 查看终端日志了解运行状态

---

**祝测试顺利！** 🎉

