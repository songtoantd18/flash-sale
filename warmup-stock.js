require('dotenv').config();
const { Pool } = require('pg');
const { Redis } = require('@upstash/redis');

// Khởi tạo kết nối DB & Redis từ file .env
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = Redis.fromEnv();

async function warmupStockFromDB() {
  console.log('🚀 Đang bắt đầu tiến trình Sync Tồn kho từ DB sang Redis...\n');

  try {
    // 1. Đọc toàn bộ vé hiện có trong Database
    const result = await pool.query('SELECT id, title, total_stock FROM tickets');
    const tickets = result.rows;

    if (tickets.length === 0) {
      console.log('⚠️ Không tìm thấy vé nào trong bảng `tickets`!');
      return;
    }

    console.log(`📌 Tìm thấy ${tickets.length} loại vé trong Database. Tiến hành nạp lên Redis:\n`);

    // 2. Lặp qua từng loại vé và nạp con số chính xác lên Redis
    for (const ticket of tickets) {
      const redisStockKey = `ticket:${ticket.id}:stock`;
      
      // Nạp số lượng tồn kho từ DB (cột total_stock) sang Redis
      await redis.set(redisStockKey, ticket.total_stock);

      console.log(
        ` ✅ [Ticket ID: ${ticket.id}] - "${ticket.title}"` +
        ` | DB Stock: ${ticket.total_stock} -> Redis Key [${redisStockKey}] = ${ticket.total_stock}`
      );
    }

    console.log('\n🎉 NẠP TỒN KHO THÀNH CÔNG! Hệ thống đã sẵn sàng đón Flash Sale.');

  } catch (error) {
    console.error('❌ Lỗi khi nạp dữ liệu tồn kho:', error.message);
  } finally {
    // Đóng kết nối DB sau khi hoàn thành công việc
    await pool.end();
  }
}

// Chạy kịch bản
warmupStockFromDB();