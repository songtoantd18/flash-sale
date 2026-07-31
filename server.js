require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const { Redis } = require('@upstash/redis');
const { Client: QStashClient } = require('@upstash/qstash');

const app = express();
app.use(express.json());
// 2. Đọc dữ liệu dạng URL-encoded (Cho Form submitting)
app.use(express.urlencoded({ extended: true }));

// Khởi tạo các kết nối Cloud
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = Redis.fromEnv();
const isLocal = process.env.QSTASH_URL?.includes('127.0.0.1') || process.env.QSTASH_URL?.includes('localhost');

const qstash = new QStashClient({
  baseUrl: process.env.QSTASH_URL,
  token: process.env.QSTASH_TOKEN,
  ...(isLocal ? { disableEnvVerification: true } : {}), // Dòng này giúp bỏ qua check Region Cloud
});

// =========================================================================
// 🚀 1. API RECEIVER: Tiếp nhận mua vé & Trừ kho Redis (Thời gian phản hồi ~20ms)
// =========================================================================
app.post('/api/buy-ticket', async (req, res) => {
    // Kiểm tra nếu không có req.body
  if (!req.body) {
    return res.status(400).json({ success: false, error: 'Thiếu Request Body!' });
  }
  const { user_id, ticket_id } = req.body;
  const stockKey = `ticket:${ticket_id}:stock`;

  try {
    // TẦNG 1: Trừ kho Atomic trên Redis
    const stockLeft = await redis.decr(stockKey);

    // Nếu kho âm (Hết vé)
    if (stockLeft < 0) {
      // Hoàn lại kho cho chuẩn số 0
      await redis.incr(stockKey);
      return res.status(400).json({
        success: false,
        message: '❌ Rất tiếc, vé đã được bán hết!',
      });
    }

    // Tạo mã đơn hàng duy nhất
    const orderCode = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // TẦNG 2: Ném đơn hàng sang QStash Queue (Chờ Worker xử lý ngầm)
    // Lưu ý: Target URL chính là endpoint Worker của chúng ta
    const workerTargetUrl = `${process.env.MY_WORKER_BASE_URL}`;

    const qstashRes = await qstash.publishJSON({
      url: workerTargetUrl,
      body: {
        order_code: orderCode,
        user_id: user_id,
        ticket_id: ticket_id,
      },
    });

    // Trả lời phản hồi cho User NGAY LẬP TỨC!
    return res.status(200).json({
      success: true,
      message: '🎉 Đặt vé thành công! Đang khởi tạo hóa đơn...',
      order_code: orderCode,
      queue_msg_id: qstashRes.messageId,
      remaining_stock: stockLeft,
    });

  } catch (error) {
    console.error('❌ Lỗi xử lý Mua vé:', error.message);
    return res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

// =========================================================================
// 👷 2. WORKER ENDPOINT: QStash gọi về đây để ghi đơn chính thức vào Postgres
// =========================================================================
app.post('/api/worker/process-order', async (req, res) => {
  const { order_code, user_id, ticket_id } = req.body;

  console.log(`👷 WORKER: Đang xử lý đơn hàng [${order_code}]...`);

  try {
    // Ghi chính thức vào Neon Postgres DB
    await pool.query(
      'INSERT INTO orders (order_code, user_id, ticket_id) VALUES ($1, $2, $3)',
      [order_code, user_id, ticket_id]
    );

    console.log(`✅ WORKER: Ghi thành công đơn [${order_code}] vào Postgres!`);
    
    // Báo cho QStash biết đã hoàn thành (Mã 200)
    return res.status(200).json({ success: true, status: 'DELIVERED_TO_DB' });

  } catch (error) {
    // Nếu bị trùng khóa order_code (Postgres khóa unique)
    if (error.code === '23505') {
      console.warn(`⚠️ WORKER: Đơn hàng [${order_code}] đã tồn tại (Chống ghi trùng thành công).`);
      return res.status(200).json({ message: 'Order already processed' });
    }

    console.error('❌ WORKER LỖI GHI DB:', error.message);
    // Trả về 500 để QStash biết và tự động RETRY lại sau!
    return res.status(500).json({ error: 'Database write failed' });
  }
});

// =========================================================================
// 🔍 3. API Kiểm tra kho & Danh sách đơn trong DB
// =========================================================================
app.get('/api/admin/status', async (req, res) => {
  const stock = await redis.get('ticket:1:stock');
  const dbOrders = await pool.query('SELECT * FROM orders ORDER BY id DESC LIMIT 10');

  return res.json({
    redis_stock: stock,
    total_orders_in_db: dbOrders.rowCount,
    latest_orders: dbOrders.rows,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server Flash Sale đang chạy tại: http://localhost:${PORT}`);
});