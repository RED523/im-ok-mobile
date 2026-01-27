# im-ok 后端服务

用于处理定时通知发送的后端服务。当前版本使用邮件通知，短信功能即将推出。

## 🚀 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置邮件服务（可选）

创建 `.env` 文件并配置邮件服务：

```bash
# 后端服务端口
PORT=3000

# 邮件服务配置（SMTP）
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@qq.com
SMTP_PASS=your-authorization-code
SMTP_FROM="我还好安全守护" <your-email@qq.com>
```

> 📝 **注意**: 如果不配置邮件服务，系统将以模拟模式运行（仅记录日志，不实际发送邮件）。

### 3. 启动服务

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

### 4. 测试 API

```bash
# 健康检查
curl http://localhost:3000/health

# 安排发送邮件（当前使用）
curl -X POST http://localhost:3000/schedule-email \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "test-123",
    "email": "contact@example.com",
    "message": "这是一条测试邮件",
    "scheduledTime": "2026-01-22T10:30:00.000Z",
    "userPhone": "13900139000"
  }'

# 取消发送邮件
curl -X POST http://localhost:3000/cancel-email \
  -H "Content-Type: application/json" \
  -d '{"taskId": "test-123"}'

# 安排发送短信（即将推出）
curl -X POST http://localhost:3000/schedule-sms \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "test-456",
    "phone": "13800138000",
    "message": "这是一条测试短信",
    "scheduledTime": "2026-01-22T10:30:00.000Z",
    "userPhone": "13900139000"
  }'

# 查询所有任务
curl http://localhost:3000/tasks
```

## 📡 API 接口

### 📧 邮件通知（当前使用）

#### POST /schedule-email
安排发送邮件

**请求体:**
```json
{
  "taskId": "unique-task-id",
  "email": "接收邮件的邮箱地址",
  "message": "邮件内容",
  "scheduledTime": "2026-01-22T10:30:00.000Z",
  "userPhone": "用户手机号（可选）"
}
```

**响应:**
```json
{
  "success": true,
  "message": "邮件任务已安排",
  "taskId": "unique-task-id",
  "scheduledTime": "2026-01-22T10:30:00.000Z"
}
```

#### POST /cancel-email
取消发送邮件

**请求体:**
```json
{
  "taskId": "unique-task-id"
}
```

### 📱 短信通知（即将推出）

#### POST /schedule-sms
安排发送短信（功能即将推出，当前仅记录日志）

**请求体:**
```json
{
  "taskId": "unique-task-id",
  "phone": "接收短信的手机号",
  "message": "短信内容",
  "scheduledTime": "2026-01-22T10:30:00.000Z",
  "userPhone": "用户手机号（可选）"
}
```

#### POST /cancel-sms
取消发送短信

### 📊 通用接口

#### GET /task-status/:taskId
查询任务状态

#### GET /tasks
查询所有任务

#### GET /health
健康检查

## 🔧 接入真实短信服务

编辑 `src/server.js` 中的 `sendSMS` 函数：

### 阿里云短信示例

```javascript
import China from '@alicloud/dysmsapi20170525';
import * as China from '@alicloud/openapi-client';

async function sendSMS(phone, message) {
  const config = new China.Config({
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
  });
  config.endpoint = 'dysmsapi.aliyuncs.com';
  
  const client = new China(config);
  
  const sendSmsRequest = new China.SendSmsRequest({
    phoneNumbers: phone,
    signName: process.env.ALIYUN_SMS_SIGN_NAME,
    templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE,
    templateParam: JSON.stringify({ message }),
  });
  
  const result = await client.sendSms(sendSmsRequest);
  return result;
}
```

### 腾讯云短信示例

```javascript
import tencentcloud from 'tencentcloud-sdk-nodejs';

async function sendSMS(phone, message) {
  const SmsClient = tencentcloud.sms.v20210111.Client;
  
  const client = new SmsClient({
    credential: {
      secretId: process.env.TENCENT_SECRET_ID,
      secretKey: process.env.TENCENT_SECRET_KEY,
    },
    region: 'ap-guangzhou',
  });
  
  const result = await client.SendSms({
    SmsSdkAppId: process.env.TENCENT_SMS_APP_ID,
    SignName: process.env.TENCENT_SMS_SIGN,
    TemplateId: process.env.TENCENT_SMS_TEMPLATE_ID,
    PhoneNumberSet: [`+86${phone}`],
    TemplateParamSet: [message],
  });
  
  return result;
}
```

## 🌐 部署建议

### 使用 PM2 管理进程

```bash
npm install -g pm2
pm2 start src/server.js --name im-ok-backend
pm2 save
```

### Docker 部署

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
```

## 📝 环境变量

创建 `.env` 文件：

```bash
PORT=3000

# ==========================================
# 📧 邮件服务配置（当前使用）
# ==========================================
# 支持各种 SMTP 邮件服务：QQ邮箱、163邮箱、Gmail、企业邮箱等

# SMTP 服务器地址
# QQ邮箱: smtp.qq.com
# 163邮箱: smtp.163.com
# Gmail: smtp.gmail.com
# 阿里企业邮箱: smtp.mxhichina.com
SMTP_HOST=smtp.qq.com

# SMTP 端口（通常为 465 或 587）
SMTP_PORT=465

# 是否使用 SSL/TLS（端口 465 通常为 true，端口 587 通常为 false）
SMTP_SECURE=true

# 发件邮箱账号
SMTP_USER=your-email@qq.com

# 邮箱授权码（注意：不是登录密码，需要在邮箱设置中生成）
# QQ邮箱：设置 -> 账户 -> POP3/IMAP/SMTP 服务 -> 生成授权码
# 163邮箱：设置 -> POP3/SMTP/IMAP -> 开启并获取授权码
SMTP_PASS=your-authorization-code

# 发件人显示名称和邮箱（可选，默认使用 SMTP_USER）
SMTP_FROM="我还好安全守护" <your-email@qq.com>

# ==========================================
# 📱 短信服务配置（即将推出）
# ==========================================

# 阿里云短信
ALIYUN_ACCESS_KEY_ID=your_key
ALIYUN_ACCESS_KEY_SECRET=your_secret
ALIYUN_SMS_SIGN_NAME=your_sign
ALIYUN_SMS_TEMPLATE_CODE=your_template

# 腾讯云短信
TENCENT_SECRET_ID=your_id
TENCENT_SECRET_KEY=your_key
TENCENT_SMS_APP_ID=your_app_id
TENCENT_SMS_SIGN=your_sign
TENCENT_SMS_TEMPLATE_ID=your_template
```

## 📧 邮件服务配置说明

### QQ 邮箱配置步骤

1. 登录 QQ 邮箱网页版
2. 进入「设置」→「账户」
3. 找到「POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务」
4. 开启 SMTP 服务并生成授权码
5. 将授权码填入 `SMTP_PASS`

### 163 邮箱配置步骤

1. 登录 163 邮箱网页版
2. 进入「设置」→「POP3/SMTP/IMAP」
3. 开启 SMTP 服务并设置客户端授权密码
4. 将授权密码填入 `SMTP_PASS`

### Gmail 配置步骤

1. 启用两步验证
2. 生成应用专用密码：Google 账户 → 安全 → 应用专用密码
3. 将应用专用密码填入 `SMTP_PASS`

