import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'viva_erp',
  waitForConnections: true,
  connectionLimit:    10,
  dateStrings:        true,   // return DATE/DATETIME as strings, not JS Date objects
});

export async function query<T>(sql: string, params?: any[]): Promise<T> {
  const [rows] = await pool.query(sql, params);
  return rows as T;
}

export async function initDb(): Promise<void> {
  try {
    const cols = await query<any[]>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sales_orders' AND COLUMN_NAME IN ('discount_percent', 'discount')`,
      [process.env.DB_NAME || 'viva_erp']
    );
    const existing = (cols || []).map(c => c.COLUMN_NAME);
    if (!existing.includes('discount_percent')) {
      await pool.query('ALTER TABLE sales_orders ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0.00 AFTER gst_percent');
      console.log('Added column discount_percent to sales_orders');
    }
    if (!existing.includes('discount')) {
      await pool.query('ALTER TABLE sales_orders ADD COLUMN discount DECIMAL(10,2) DEFAULT 0.00 AFTER discount_percent');
      console.log('Added column discount to sales_orders');
    }
  } catch (err) {
    console.warn('initDb warning (schema check):', err instanceof Error ? err.message : String(err));
  }
}

export default pool;
