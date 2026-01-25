import express from 'express';
import cors from 'cors';
import schedule from 'node-schedule';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 存储定时任务
const scheduledTasks = new Map();

// 中间件
app.use(cors());
app.use(express.json());

// 请求日志
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleString()}] ${req.method} ${req.path}`);
  next();
});

// 创建邮件传输器
// 支持多种邮件服务：SMTP、Gmail、QQ邮箱等
const createMailTransporter = () => {
  // 优先使用环境变量配置
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE !== 'false',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  
  // 默认使用模拟模式（开发测试用）
  return null;
};

const mailTransporter = createMailTransporter();

/**
 * 发送邮件通知
 * @param email 收件人邮箱
 * @param subject 邮件主题
 * @param message 邮件内容
 */
async function sendEmail(email, subject, message) {
  console.log(`
====================================
📧 发送邮件通知
====================================
发送至: ${email}
主题: ${subject}
内容: ${message}
时间: ${new Date().toLocaleString()}
====================================
  `);
  
  // 如果配置了邮件服务，发送真实邮件
  if (mailTransporter) {
    try {
      const info = await mailTransporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: subject,
        text: message,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ 安全提醒</h1>
            </div>
            <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                ${message.replace(/\n/g, '<br>')}
              </p>
              <div style="background: #fef3c7; border-radius: 8px; padding: 15px; margin-top: 20px;">
                <p style="color: #92400e; font-size: 14px; margin: 0;">
                  💡 建议：请尝试通过电话或其他方式联系 TA 确认情况。
                </p>
              </div>
            </div>
            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 20px;">
              此邮件由「我还好」安全守护应用自动发送
            </p>
          </div>
        `,
      });
      console.log('✅ 邮件发送成功:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ 邮件发送失败:', error);
      return { success: false, error: error.message };
    }
  }
  
  // 模拟模式（未配置邮件服务）
  console.log('⚠️ 邮件服务未配置，使用模拟模式');
  return { success: true, simulated: true };
}

/**
 * 发送短信（模拟）
 * TODO: 接入真实短信服务（阿里云/腾讯云等）
 * 注意：短信功能即将推出，当前版本暂不可用
 */
async function sendSMS(phone, message) {
  console.log(`
====================================
📱 发送短信（功能即将推出）
====================================
发送至: ${phone}
内容: ${message}
时间: ${new Date().toLocaleString()}
状态: 短信功能即将推出，当前仅记录日志
====================================
  `);
  
  // TODO: 在这里接入真实短信服务
  // 示例：阿里云短信
  // const China = require('aliyun-sdk').China;
  // const sms = new China.SMS({...});
  // await sms.sendSms({PhoneNumbers: phone, ...});
  
  return { success: true, pending: true, message: '短信功能即将推出' };
}

/**
 * 安排发送邮件通知（当前使用）
 * POST /schedule-email
 * Body: { taskId, email, message, scheduledTime, userPhone, startTime, endTime }
 */
app.post('/schedule-email', (req, res) => {
  try {
    const { taskId, email, message, scheduledTime, userPhone, startTime, endTime } = req.body;
    
    // 参数验证
    if (!taskId || !email || !message || !scheduledTime) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数' 
      });
    }

    // 检查任务是否已存在
    if (scheduledTasks.has(taskId)) {
      console.log(`⚠️ 任务 ${taskId} 已存在，先取消旧任务`);
      const oldJob = scheduledTasks.get(taskId);
      oldJob.job.cancel();
      scheduledTasks.delete(taskId);
    }

    const scheduledDate = new Date(scheduledTime);
    const now = new Date();
    
    console.log(`📅 安排邮件任务:`, {
      taskId,
      email,
      userPhone,
      scheduledTime: scheduledDate.toLocaleString(),
      距离发送: `${Math.round((scheduledDate - now) / 1000)} 秒`,
    });

    const subject = '⚠️ 安全提醒 - 请确认联系人状况';

    // 如果时间已经过了，立即发送
    if (scheduledDate <= now) {
      console.log(`⚠️ 预定时间已过，立即发送邮件`);
      sendEmail(email, subject, message);
      return res.json({ 
        success: true, 
        message: '邮件已立即发送',
        taskId 
      });
    }

    // 使用 node-schedule 在指定时间发送邮件
    const job = schedule.scheduleJob(scheduledDate, async () => {
      console.log(`⏰ 定时任务触发: ${taskId}`);
      
      try {
        // 发送邮件
        await sendEmail(email, subject, message);
        console.log(`✅ 邮件发送成功: ${taskId}`);
      } catch (error) {
        console.error(`❌ 邮件发送失败: ${taskId}`, error);
      }
      
      // 任务完成后从 Map 中删除
      scheduledTasks.delete(taskId);
    });

    // 存储任务
    scheduledTasks.set(taskId, {
      job,
      email,
      userPhone,
      message,
      type: 'email',
      scheduledTime: scheduledDate,
      createdAt: now,
    });

    console.log(`✅ 邮件任务已安排: ${taskId}`);
    console.log(`📊 当前任务数量: ${scheduledTasks.size}`);

    res.json({ 
      success: true, 
      message: '邮件任务已安排',
      taskId,
      scheduledTime: scheduledDate.toISOString(),
    });
  } catch (error) {
    console.error('❌ 安排邮件任务失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 取消发送邮件
 * POST /cancel-email
 * Body: { taskId }
 */
app.post('/cancel-email', (req, res) => {
  try {
    const { taskId } = req.body;
    
    if (!taskId) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少 taskId' 
      });
    }

    const task = scheduledTasks.get(taskId);
    
    if (task) {
      task.job.cancel();
      scheduledTasks.delete(taskId);
      console.log(`🚫 邮件任务已取消: ${taskId}`);
      console.log(`📊 当前任务数量: ${scheduledTasks.size}`);
      
      res.json({ 
        success: true, 
        message: '邮件任务已取消',
        taskId 
      });
    } else {
      console.log(`ℹ️ 任务不存在或已执行: ${taskId}`);
      res.json({ 
        success: true, 
        message: '任务不存在或已执行',
        taskId 
      });
    }
  } catch (error) {
    console.error('❌ 取消邮件任务失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 安排发送短信（功能即将推出）
 * POST /schedule-sms
 * Body: { taskId, phone, message, scheduledTime, userPhone }
 * 
 * 注意：短信功能即将推出，当前仅记录日志不实际发送
 */
app.post('/schedule-sms', (req, res) => {
  try {
    const { taskId, phone, message, scheduledTime, userPhone } = req.body;
    
    // 参数验证
    if (!taskId || !phone || !message || !scheduledTime) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数' 
      });
    }

    // 短信功能即将推出提示
    console.log(`📱 [即将推出] 短信任务请求:`, {
      taskId,
      phone,
      userPhone,
      scheduledTime: new Date(scheduledTime).toLocaleString(),
      message: '短信功能即将推出，当前版本仅记录不发送',
    });

    // 检查任务是否已存在
    if (scheduledTasks.has(taskId)) {
      console.log(`⚠️ 任务 ${taskId} 已存在，先取消旧任务`);
      const oldJob = scheduledTasks.get(taskId);
      oldJob.job.cancel();
      scheduledTasks.delete(taskId);
    }

    const scheduledDate = new Date(scheduledTime);
    const now = new Date();
    
    console.log(`📅 安排短信任务（即将推出）:`, {
      taskId,
      phone,
      userPhone,
      scheduledTime: scheduledDate.toLocaleString(),
      距离发送: `${Math.round((scheduledDate - now) / 1000)} 秒`,
    });

    // 如果时间已经过了，立即发送
    if (scheduledDate <= now) {
      console.log(`⚠️ 预定时间已过，立即发送短信（模拟）`);
      sendSMS(phone, message);
      return res.json({ 
        success: true, 
        message: '短信功能即将推出',
        pending: true,
        taskId 
      });
    }

    // 使用 node-schedule 在指定时间发送短信
    const job = schedule.scheduleJob(scheduledDate, async () => {
      console.log(`⏰ 定时任务触发: ${taskId}`);
      
      try {
        // 发送短信（模拟）
        await sendSMS(phone, message);
        console.log(`✅ 短信任务完成（模拟）: ${taskId}`);
      } catch (error) {
        console.error(`❌ 短信发送失败: ${taskId}`, error);
      }
      
      // 任务完成后从 Map 中删除
      scheduledTasks.delete(taskId);
    });

    // 存储任务
    scheduledTasks.set(taskId, {
      job,
      phone,
      userPhone,
      message,
      type: 'sms',
      pending: true,
      scheduledTime: scheduledDate,
      createdAt: now,
    });

    console.log(`✅ 短信任务已安排（即将推出）: ${taskId}`);
    console.log(`📊 当前任务数量: ${scheduledTasks.size}`);

    res.json({ 
      success: true, 
      message: '短信功能即将推出，任务已记录',
      pending: true,
      taskId,
      scheduledTime: scheduledDate.toISOString(),
    });
  } catch (error) {
    console.error('❌ 安排短信任务失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 取消发送短信
 * POST /cancel-sms
 * Body: { taskId }
 */
app.post('/cancel-sms', (req, res) => {
  try {
    const { taskId } = req.body;
    
    if (!taskId) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少 taskId' 
      });
    }

    const task = scheduledTasks.get(taskId);
    
    if (task) {
      task.job.cancel();
      scheduledTasks.delete(taskId);
      console.log(`🚫 短信任务已取消: ${taskId}`);
      console.log(`📊 当前任务数量: ${scheduledTasks.size}`);
      
      res.json({ 
        success: true, 
        message: '短信任务已取消',
        taskId 
      });
    } else {
      console.log(`ℹ️ 任务不存在或已执行: ${taskId}`);
      res.json({ 
        success: true, 
        message: '任务不存在或已执行',
        taskId 
      });
    }
  } catch (error) {
    console.error('❌ 取消短信任务失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 查询任务状态
 * GET /task-status/:taskId
 */
app.get('/task-status/:taskId', (req, res) => {
  const { taskId } = req.params;
  const task = scheduledTasks.get(taskId);
  
  if (task) {
    res.json({
      success: true,
      exists: true,
      taskId,
      phone: task.phone,
      scheduledTime: task.scheduledTime.toISOString(),
      createdAt: task.createdAt.toISOString(),
    });
  } else {
    res.json({
      success: true,
      exists: false,
      taskId,
    });
  }
});

/**
 * 查询所有任务
 * GET /tasks
 */
app.get('/tasks', (req, res) => {
  const tasks = [];
  scheduledTasks.forEach((task, taskId) => {
    tasks.push({
      taskId,
      phone: task.phone,
      userPhone: task.userPhone,
      scheduledTime: task.scheduledTime.toISOString(),
      createdAt: task.createdAt.toISOString(),
    });
  });
  
  res.json({
    success: true,
    count: tasks.length,
    tasks,
  });
});

/**
 * 健康检查
 * GET /health
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    tasksCount: scheduledTasks.size,
  });
});

// 启动服务器
app.listen(PORT, () => {
  const emailConfigured = !!mailTransporter;
  console.log(`
====================================
🚀 安全监测后端服务已启动
====================================
端口: ${PORT}
地址: http://localhost:${PORT}
时间: ${new Date().toLocaleString()}
邮件服务: ${emailConfigured ? '✅ 已配置' : '⚠️ 未配置（模拟模式）'}

API 接口:
  📧 邮件通知（当前使用）:
  POST /schedule-email - 安排发送邮件
  POST /cancel-email   - 取消发送邮件

  📱 短信通知（即将推出）:
  POST /schedule-sms   - 安排发送短信
  POST /cancel-sms     - 取消发送短信

  📊 通用接口:
  GET  /task-status/:taskId - 查询任务状态
  GET  /tasks          - 查询所有任务
  GET  /health         - 健康检查

${!emailConfigured ? `
💡 配置邮件服务:
  在 .env 文件中添加以下配置:
  SMTP_HOST=smtp.example.com
  SMTP_PORT=465
  SMTP_SECURE=true
  SMTP_USER=your-email@example.com
  SMTP_PASS=your-password
  SMTP_FROM=your-email@example.com
` : ''}====================================
  `);
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭服务...');
  
  // 取消所有定时任务
  scheduledTasks.forEach((task, taskId) => {
    task.job.cancel();
    console.log(`  取消任务: ${taskId}`);
  });
  
  console.log('👋 服务已关闭');
  process.exit(0);
});

