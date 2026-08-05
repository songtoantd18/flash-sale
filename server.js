require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const { Redis } = require('@upstash/redis');
const { spawn } = require('child_process');
const { Client: QStashClient } = require('@upstash/qstash');

function startLocalQStash() {
  const isWindows = process.platform === 'win32';
  const npxCmd = isWindows ? 'npx.cmd' : 'npx';

  console.log('🔄 Đang khởi động QStash Local CLI trên cổng 4000...');

  // Chạy lệnh: npx @upstash/qstash-cli@latest dev --port 4000
  const qstashProcess = spawn(npxCmd, ['@upstash/qstash-cli@latest', 'dev', '--port', '4000'], {
    stdio: 'inherit', // In trực tiếp log của QStash CLI ra màn hình Terminal hiện tại
    shell: true,
  });

  // Tự động tắt QStash CLI khi bạn nhấn Ctrl+C để dừng Node.js server
  process.on('SIGINT', () => {
    console.log('\n🛑 Đang tắt QStash Local CLI...');
    qstashProcess.kill();
    process.exit();
  });
}
// Bật QStash CLI (Chỉ bật khi đang chạy ở môi trường Local)
const isLocal = process.env.QSTASH_URL?.includes('127.0.0.1') || process.env.QSTASH_URL?.includes('localhost');
if (isLocal) {
  startLocalQStash();
}

const app = express();
app.use(express.json());
// 2. Đọc dữ liệu dạng URL-encoded (Cho Form submitting)
app.use(express.urlencoded({ extended: true }));

// Khởi tạo các kết nối Cloud
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = Redis.fromEnv();
const qstash = new QStashClient({
  baseUrl: process.env.QSTASH_URL,
  token: process.env.QSTASH_TOKEN,
  ...(isLocal ? { disableEnvVerification: true } : {}), // Dòng này giúp bỏ qua check Region Cloud
});

// =========================================================================
// 🚀 1. API RECEIVER: Tiếp nhận mua vé & Trừ kho Redis (Thời gian phản hồi ~20ms)
// =========================================================================
app.post('/api/buy-ticket', async (req, res) => {
  if (!req.body || !Array.isArray(req.body.items) || req.body.items.length === 0) {
    return res.status(400).json({ success: false, error: 'Danh sách vé mua (items) không hợp lệ!' });
  }

  const { user_id, items } = req.body;
  const deductedItems = []; // Mảng lưu các item đã trừ thành công để Rollback khi cần

  try {
    let isStockOut = false;
    let failedTicketId = null;
    let remainingOfFailed = 0;

    // TẦNG 1: Duyệt qua từng loại vé và trừ kho trên Redis
    for (const item of items) {
      const ticketId = parseInt(item.ticket_id, 10);
      const buyQty = parseInt(item.quantity, 10);

      if (isNaN(buyQty) || buyQty <= 0) continue;

      const stockKey = `ticket:${ticketId}:stock`;
      const stockLeft = await redis.decrby(stockKey, buyQty);

      if (stockLeft < 0) {
        // Hết kho ở loại vé này!
        isStockOut = true;
        failedTicketId = ticketId;
        remainingOfFailed = stockLeft + buyQty;
        // Cộng trả lại vé vừa trừ bị âm
        await redis.incrby(stockKey, buyQty);
        break;
      }

      // Lưu lại thông tin đã trừ thành công để đề phòng bị thất bại ở vé sau
      deductedItems.push({ ticketId, stockKey, buyQty });
    }

    // NẾU CÓ 1 LOẠI VÉ BỊ HẾT KHO -> ROLLBACK TOÀN BỘ CÁC VÉ ĐÃ TRỪ TRƯỚC ĐÓ
    if (isStockOut) {
      for (const item of deductedItems) {
        await redis.incrby(item.stockKey, item.buyQty); // Hoàn vé về Redis
      }
      return res.status(400).json({
        success: false,
        message: `❌ Không đủ số lượng cho Vé ID [${failedTicketId}]! Kho chỉ còn ${remainingOfFailed} vé.`,
      });
    }

    // TẦNG 2: Nếu tất cả loại vé đều còn đủ kho -> Bắn gói tin Dynamic sang QStash Queue
    const orderCode = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const workerTargetUrl = `${process.env.MY_WORKER_BASE_URL}`;

    const qstashRes = await qstash.publishJSON({
      url: workerTargetUrl,
      body: {
        order_code: orderCode,
        user_id: user_id,
        items: items, // 👈 Gửi toàn bộ danh sách items dynamic sang Worker
      },
    });

    return res.status(200).json({
      success: true,
      message: `🎉 Đặt thành công ${items.length} loại vé! Đang khởi tạo hóa đơn...`,
      order_code: orderCode,
      bought_items: items,
    });

  } catch (error) {
    // Nếu có lỗi hệ thống -> Rollback lại toàn bộ kho đã trừ
    for (const item of deductedItems) {
      await redis.incrby(item.stockKey, item.buyQty);
    }
    console.error('❌ Lỗi xử lý Mua vé Dynamic:', error.message);
    return res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
  }
});

// =========================================================================
// 👷 2. WORKER ENDPOINT: QStash gọi về đây để ghi đơn chính thức vào Postgres
// =========================================================================
app.post('/api/worker/process-order', async (req, res) => {
  const { order_code, user_id, items } = req.body;

  console.log(`👷 WORKER: Đang xử lý đơn hàng Dynamic [${order_code}] gồm ${items.length} mặt hàng...`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN'); // Bắt đầu Transaction

    // Lặp qua danh sách items và Insert từng dòng vào bảng orders
    for (const item of items) {
      await client.query(
        'INSERT INTO orders (order_code, user_id, ticket_id, quantity) VALUES ($1, $2, $3, $4)',
        [order_code, user_id, item.ticket_id, item.quantity]
      );
    }

    await client.query('COMMIT'); // Xác nhận lưu thành công toàn bộ
    console.log(`✅ WORKER: Đã ghi thành công toàn bộ items của đơn [${order_code}] vào Postgres!`);

    return res.status(200).json({ success: true, status: 'DELIVERED_TO_DB' });

  } catch (error) {
    await client.query('ROLLBACK'); // Hủy bỏ nếu có lỗi

    if (error.code === '23505') {
      return res.status(200).json({ message: 'Order already processed' });
    }

    console.error('❌ WORKER LỖI GHI DB:', error.message);
    return res.status(500).json({ error: 'Database write failed' });
  } finally {
    client.release(); // Giải phóng kết nối DB
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