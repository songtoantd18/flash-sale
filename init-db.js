require('dotenv').config();
const { Pool } = require('pg');
const { Redis } = require('@upstash/redis');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = Redis.fromEnv();

async function init() {
  try {
    console.log('🔄 1. Đang tạo bảng orders trên Neon Postgres...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_code VARCHAR(1) UNIQUE NOT NULL,
        user_id INT NOT NULL,
        ticket_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Đã tạo xong bảng orders (Có khóa UNIQUE chống trùng)!');

    console.log('🔄 2. Đang nạp kho 100 vé vào Redis (Key: ticket:1:stock)...');
    await redis.set('ticket:1:stock', 100);
    console.log('✅ Đã nạp 100 vé vào Redis!');

    process.exit(0);
  } catch (err) {
    console.error('❌ Khởi tạo thất bại:', err);
    process.exit(1);
  }
}

init();