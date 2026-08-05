// File: sync-cron.js (CHẠY ĐỘC LẬP - KHÔNG IMPORT VÀO SERVER.JS)
require('dotenv').config();
const { Pool } = require('pg');
const { Redis } = require('@upstash/redis');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = Redis.fromEnv();

async function syncStockFromRedisToDB() {
  console.log('⏰ [CRONJOB - PROCESS SEPARATE] Đang đồng bộ tồn kho từ Redis về PostgreSQL...');

  try {
    const result = await pool.query('SELECT id FROM tickets');
    const tickets = result.rows;

    for (const ticket of tickets) {
      const redisStockKey = `ticket:${ticket.id}:stock`;
      const currentRedisStock = await redis.get(redisStockKey);

      if (currentRedisStock !== null) {
        await pool.query(
          'UPDATE tickets SET total_stock = $1 WHERE id = $2',
          [parseInt(currentRedisStock, 10), ticket.id]
        );
        console.log(` ✅ [Ticket ID: ${ticket.id}] Đã cập nhật Postgres = ${currentRedisStock}`);
      }
    }
  } catch (error) {
    console.error('❌ Lỗi Cronjob:', error.message);
  }
}

// 1. Chạy lần đầu ngay khi bật file
syncStockFromRedisToDB();

// 2. Thiết lập chạy định kỳ mỗi 60 giây (60,000 ms)
const ONE_MINUTE = 60 * 1000;
setInterval(syncStockFromRedisToDB, ONE_MINUTE);