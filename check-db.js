require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Chỉ khai báo tên bảng cần xem
const targets = [
  { key: 'users' },
  { key: 'orders' },
  { key: 'tickets' },
];

async function check() {
  console.log("=== KIỂM TRA DATABASE ===\n");

  for (const target of targets) {
    const table = target.key;

    console.log(`📋 Bảng: ${table}`);

    try {
      // chống SQL Injection
      if (!/^[a-zA-Z0-9_]+$/.test(table)) {
        throw new Error(`Tên bảng "${table}" không hợp lệ.`);
      }

      const sql = `SELECT * FROM ${table}`;
      const result = await pool.query(sql);

      console.log(`Tổng bản ghi: ${result.rowCount}`);

      if (result.rowCount > 0) {
        console.table(result.rows);
      } else {
        console.log("Bảng trống.");
      }
    } catch (err) {
      console.error(`Lỗi: ${err.message}`);
    }

    console.log("\n" + "-".repeat(60) + "\n");
  }

  await pool.end();
}

check();