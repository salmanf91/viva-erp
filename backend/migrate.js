const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'viva_studio_erp',
    multipleStatements: true // Allow multiple SQL statements in one query
  });

  const sqlPath = path.join(__dirname, 'migrations', '018_sales_discount.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  console.log('Applying database migration (018_sales_discount.sql)...');
  try {
    await connection.query(sql);
    console.log('Migration applied successfully!');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Columns already exist. Migration is already applied.');
    } else {
      throw err;
    }
  } finally {
    await connection.end();
  }
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
