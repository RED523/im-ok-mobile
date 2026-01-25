import express from 'express';
import cors from 'cors';
import schedule from 'node-schedule';
import dotenv from 'dotenv';

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

/**
 * 发送短信（模拟）
 * TODO: 接入真实短信服务（阿里云/腾讯云等）
 */
async function sendSMS(phone, message) {
  console.log(`
====================================
📧 发送短信
====================================
发送至: ${phone}
内容: ${message}
时间: ${new Date().toLocaleString()}
====================================
  `);
  
  // TODO: 在这里接入真实短信服务
  // 示例：阿里云短信
  // const China = require('aliyun-sdk').China;
  // const sms = new China.SMS({...});
  // await sms.sendSms({PhoneNumbers: phone, ...});
  
  return { success: true };
}

/**
 * 安排发送短信
 * POST /schedule-sms
 * Body: { taskId, phone, message, scheduledTime, userPhone }
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

    // 检查任务是否已存在
    if (scheduledTasks.has(taskId)) {
      console.log(`⚠️ 任务 ${taskId} 已存在，先取消旧任务`);
      const oldJob = scheduledTasks.get(taskId);
      oldJob.cancel();
      scheduledTasks.delete(taskId);
    }

    const scheduledDate = new Date(scheduledTime);
    const now = new Date();
    
    console.log(`📅 安排短信任务:`, {
      taskId,
      phone,
      userPhone,
      scheduledTime: scheduledDate.toLocaleString(),
      距离发送: `${Math.round((scheduledDate - now) / 1000)} 秒`,
    });

    // 如果时间已经过了，立即发送
    if (scheduledDate <= now) {
      console.log(`⚠️ 预定时间已过，立即发送短信`);
      sendSMS(phone, message);
      return res.json({ 
        success: true, 
        message: '短信已立即发送',
        taskId 
      });
    }

    // 使用 node-schedule 在指定时间发送短信
    const job = schedule.scheduleJob(scheduledDate, async () => {
      console.log(`⏰ 定时任务触发: ${taskId}`);
      
      try {
        // 发送短信
        await sendSMS(phone, message);
        console.log(`✅ 短信发送成功: ${taskId}`);
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
      scheduledTime: scheduledDate,
      createdAt: now,
    });

    console.log(`✅ 短信任务已安排: ${taskId}`);
    console.log(`📊 当前任务数量: ${scheduledTasks.size}`);

    res.json({ 
      success: true, 
      message: '短信任务已安排',
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
  console.log(`
====================================
🚀 安全监测后端服务已启动
====================================
端口: ${PORT}
地址: http://localhost:${PORT}
时间: ${new Date().toLocaleString()}

API 接口:
  POST /schedule-sms  - 安排发送短信
  POST /cancel-sms    - 取消发送短信
  GET  /task-status/:taskId - 查询任务状态
  GET  /tasks         - 查询所有任务
  GET  /health        - 健康检查
====================================
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

