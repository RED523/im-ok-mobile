# 安全监测后端服务

用于处理定时短信发送的后端服务。

## 🚀 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 启动服务

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

### 3. 测试 API

```bash
# 健康检查
curl http://localhost:3000/health

# 安排发送短信
curl -X POST http://localhost:3000/schedule-sms \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "test-123",
    "phone": "13800138000",
    "message": "这是一条测试短信",
    "scheduledTime": "2026-01-22T10:30:00.000Z",
    "userPhone": "13900139000"
  }'

# 取消发送短信
curl -X POST http://localhost:3000/cancel-sms \
  -H "Content-Type: application/json" \
  -d '{"taskId": "test-123"}'

# 查询所有任务
curl http://localhost:3000/tasks
```

## 📡 API 接口

### POST /schedule-sms
安排发送短信

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

**响应:**
```json
{
  "success": true,
  "message": "短信任务已安排",
  "taskId": "unique-task-id",
  "scheduledTime": "2026-01-22T10:30:00.000Z"
}
```

### POST /cancel-sms
取消发送短信

**请求体:**
```json
{
  "taskId": "unique-task-id"
}
```

### GET /task-status/:taskId
查询任务状态

### GET /tasks
查询所有任务

### GET /health
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

```
PORT=3000

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

