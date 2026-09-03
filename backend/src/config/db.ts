import { AsyncLocalStorage } from 'async_hooks';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { getTenantPool } from './tenantDbManager';

dotenv.config();

export interface TenantContext {
  tenantId: number;
  dbName: string;
  slug?: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

const defaultPool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'viva_erp',
  waitForConnections: true,
  connectionLimit:    10,
  dateStrings:        true,
});

export async function query<T>(sql: string, params?: any[]): Promise<T> {
  const store = tenantStorage.getStore();
  const targetPool = store?.dbName ? getTenantPool(store.dbName) : defaultPool;
  const [rows] = await targetPool.query(sql, params);
  return rows as T;
}

// Dynamic Proxy for pool (getConnection, query, execute) that transparently uses tenant DB
const dynamicPoolProxy = new Proxy(defaultPool, {
  get(target, prop, receiver) {
    const store = tenantStorage.getStore();
    const currentPool = store?.dbName ? getTenantPool(store.dbName) : defaultPool;
    const value = Reflect.get(currentPool, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(currentPool);
    }
    return value;
  }
});

export async function initDb(): Promise<void> {
  const dbName = process.env.DB_NAME || 'viva_erp';
  try {
    // 1. Check & add discount columns in sales_orders
    const [cols] = await defaultPool.query<any[]>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sales_orders' AND COLUMN_NAME IN ('discount_percent', 'discount')`,
      [dbName]
    );
    const existing = (cols || []).map(c => c.COLUMN_NAME);
    if (!existing.includes('discount_percent')) {
      await defaultPool.query('ALTER TABLE sales_orders ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0.00 AFTER gst_percent');
      console.log('Added column discount_percent to sales_orders');
    }
    if (!existing.includes('discount')) {
      await defaultPool.query('ALTER TABLE sales_orders ADD COLUMN discount DECIMAL(10,2) DEFAULT 0.00 AFTER discount_percent');
      console.log('Added column discount to sales_orders');
    }

    // 2. Ensure staff_work_entries has size and completion_date columns
    const [sweCols] = await defaultPool.query<any[]>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'staff_work_entries' AND COLUMN_NAME IN ('size', 'completion_date')`,
      [dbName]
    );
    const sweExistingCols = (sweCols || []).map(c => c.COLUMN_NAME);
    if (!sweExistingCols.includes('size')) {
      await defaultPool.query('ALTER TABLE staff_work_entries ADD COLUMN size VARCHAR(50) NULL DEFAULT NULL AFTER category');
      console.log('Added column size to staff_work_entries');
    }
    if (!sweExistingCols.includes('completion_date')) {
      await defaultPool.query('ALTER TABLE staff_work_entries ADD COLUMN completion_date DATE NULL DEFAULT NULL AFTER completed_pcs');
      console.log('Added column completion_date to staff_work_entries');
    }

    // 3. Drop legacy uq_staff_entry unique constraint on staff_work_entries if it exists
    const [sweIndexes] = await defaultPool.query<any[]>(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'staff_work_entries' AND INDEX_NAME IN ('uq_staff_entry', 'idx_swe_tenant', 'idx_staff_entry_lookup')`,
      [dbName]
    );
    const indexNames = (sweIndexes || []).map(i => i.INDEX_NAME);
    if (!indexNames.includes('idx_swe_tenant')) {
      await defaultPool.query('ALTER TABLE staff_work_entries ADD INDEX idx_swe_tenant (tenant_id)');
      console.log('Added idx_swe_tenant index to staff_work_entries');
    }
    if (!indexNames.includes('idx_staff_entry_lookup')) {
      await defaultPool.query('ALTER TABLE staff_work_entries ADD INDEX idx_staff_entry_lookup (tenant_id, staff_id, entry_date, category, work_type)');
      console.log('Added idx_staff_entry_lookup index to staff_work_entries');
    }
    if (indexNames.includes('uq_staff_entry')) {
      await defaultPool.query('ALTER TABLE staff_work_entries DROP INDEX uq_staff_entry');
      console.log('Successfully dropped legacy uq_staff_entry unique index on staff_work_entries');
    }

    // 4. Ensure partner_personal_accounts table exists
    await defaultPool.query(`
      CREATE TABLE IF NOT EXISTS partner_personal_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        partner_id INT NOT NULL,
        entry_date DATE NOT NULL,
        type ENUM('credit', 'debit') NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'other',
        amount DECIMAL(12, 2) NOT NULL,
        payment_mode VARCHAR(30) DEFAULT 'cash',
        reference_no VARCHAR(100) NULL,
        description TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_partner_personal (tenant_id, partner_id),
        INDEX idx_personal_entry_date (entry_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Ensure payment_mode exists in sales_payments and purchases
    try {
      const [spCols] = await defaultPool.query<any[]>(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sales_payments' AND COLUMN_NAME = 'payment_mode'`,
        [dbName]
      );
      if (!(spCols as any[]).length) {
        await defaultPool.query("ALTER TABLE sales_payments ADD COLUMN payment_mode VARCHAR(50) NOT NULL DEFAULT 'cash' AFTER payment_date");
        console.log('Added payment_mode column to sales_payments');
      }
    } catch {}

    try {
      const [purCols] = await defaultPool.query<any[]>(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'purchases' AND COLUMN_NAME = 'payment_mode'`,
        [dbName]
      );
      if (!(purCols as any[]).length) {
        await defaultPool.query("ALTER TABLE purchases ADD COLUMN payment_mode VARCHAR(50) NOT NULL DEFAULT 'cash' AFTER advance_paid");
        console.log('Added payment_mode column to purchases');
      }
    } catch {}

  } catch (err) {
    console.warn('initDb warning (schema check):', err instanceof Error ? err.message : String(err));
  }
}

export default dynamicPoolProxy;
