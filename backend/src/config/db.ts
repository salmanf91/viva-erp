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

    // 2. Ensure staff_work_entries has size, completion_date, and batch_id columns
    const [sweCols] = await defaultPool.query<any[]>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'staff_work_entries' AND COLUMN_NAME IN ('size', 'completion_date', 'batch_id')`,
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
    if (!sweExistingCols.includes('batch_id')) {
      await defaultPool.query('ALTER TABLE staff_work_entries ADD COLUMN batch_id INT NULL DEFAULT NULL AFTER completion_date, ADD INDEX idx_swe_batch (batch_id)');
      console.log('Added column batch_id to staff_work_entries');
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
        person_name VARCHAR(255) NULL,
        reference_no VARCHAR(100) NULL,
        description TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_partner_personal (tenant_id, partner_id),
        INDEX idx_personal_entry_date (entry_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure person_name exists in partner_personal_accounts
    try {
      const [ppaCols] = await defaultPool.query<any[]>(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'partner_personal_accounts' AND COLUMN_NAME = 'person_name'`,
        [dbName]
      );
      if (!ppaCols || ppaCols.length === 0) {
        await defaultPool.query('ALTER TABLE partner_personal_accounts ADD COLUMN person_name VARCHAR(255) NULL AFTER payment_mode');
        console.log('Added person_name column to partner_personal_accounts');
      }
    } catch {}

    // 5. Ensure payment_mode, receipt_no, and notes exist in sales_payments and purchases
    try {
      const [spCols] = await defaultPool.query<any[]>(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sales_payments'`,
        [dbName]
      );
      const existingSpCols = (spCols as any[]).map(c => c.COLUMN_NAME);
      if (!existingSpCols.includes('payment_mode')) {
        await defaultPool.query("ALTER TABLE sales_payments ADD COLUMN payment_mode VARCHAR(50) NOT NULL DEFAULT 'cash' AFTER payment_date");
        console.log('Added payment_mode column to sales_payments');
      }
      if (!existingSpCols.includes('receipt_no')) {
        await defaultPool.query("ALTER TABLE sales_payments ADD COLUMN receipt_no VARCHAR(100) NULL AFTER payment_mode");
        console.log('Added receipt_no column to sales_payments');
      }
      if (!existingSpCols.includes('notes')) {
        await defaultPool.query("ALTER TABLE sales_payments ADD COLUMN notes TEXT NULL AFTER receipt_no");
        console.log('Added notes column to sales_payments');
      }

      // Backfill any sales_payments missing a receipt_no with a unique sequential receipt number
      await defaultPool.query(
        "UPDATE sales_payments SET receipt_no = CONCAT('RCP-', YEAR(payment_date), '-', LPAD(id, 4, '0')) WHERE receipt_no IS NULL OR receipt_no = ''"
      );
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

    // 6. Ensure staff_advances table exists
    await defaultPool.query(`
      CREATE TABLE IF NOT EXISTS staff_advances (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL DEFAULT 1,
        staff_id INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        advance_date DATE NOT NULL,
        payment_mode VARCHAR(50) DEFAULT 'cash',
        notes TEXT DEFAULT NULL,
        is_deducted BOOLEAN DEFAULT FALSE,
        deducted_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant_staff_adv (tenant_id, staff_id),
        INDEX idx_tenant_adv_date (tenant_id, advance_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Ensure raw_materials table exists and has default seeds
    await defaultPool.query(`
      CREATE TABLE IF NOT EXISTS raw_materials (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL DEFAULT 1,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) NULL,
        uom VARCHAR(20) DEFAULT 'pcs',
        default_rate DECIMAL(10,2) DEFAULT 0.00,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_raw_mat_tenant (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Seed default raw materials if not present
    try {
      const [existingRm] = await defaultPool.query<any[]>(
        `SELECT name FROM raw_materials WHERE tenant_id = 1`
      );
      const names = (existingRm || []).map(r => (r.name || '').trim().toLowerCase());
      if (!names.includes('mixed fabric (salwar)')) {
        await defaultPool.query(
          `INSERT INTO raw_materials (tenant_id, name, uom) VALUES (1, 'Mixed Fabric (Salwar)', 'pcs')`
        );
      }
      if (!names.includes('mixed fabric (nighty)')) {
        await defaultPool.query(
          `INSERT INTO raw_materials (tenant_id, name, uom) VALUES (1, 'Mixed Fabric (Nighty)', 'pcs')`
        );
      }
    } catch {}

    // Ensure production_batches has raw fabric tracking columns
    try {
      const [pbCols] = await defaultPool.query<any[]>(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'production_batches'`,
        [dbName]
      );
      const existingPbCols = (pbCols as any[]).map(c => c.COLUMN_NAME);
      if (!existingPbCols.includes('raw_material_id')) {
        await defaultPool.query('ALTER TABLE production_batches ADD COLUMN raw_material_id INT NULL AFTER category');
        console.log('Added raw_material_id column to production_batches');
      }
      if (!existingPbCols.includes('raw_material_name')) {
        await defaultPool.query('ALTER TABLE production_batches ADD COLUMN raw_material_name VARCHAR(255) NULL AFTER raw_material_id');
        console.log('Added raw_material_name column to production_batches');
      }
      if (!existingPbCols.includes('raw_quantity_used')) {
        await defaultPool.query('ALTER TABLE production_batches ADD COLUMN raw_quantity_used INT NOT NULL DEFAULT 0 AFTER raw_material_name');
        console.log('Added raw_quantity_used column to production_batches');
      }
    } catch {}

    // Ensure category columns are wide enough for raw material names
    try {
      await defaultPool.query('ALTER TABLE stock_movements MODIFY category VARCHAR(255) NOT NULL');
      await defaultPool.query('ALTER TABLE purchase_items MODIFY category VARCHAR(255) NOT NULL');
      await defaultPool.query('ALTER TABLE production_batches MODIFY category VARCHAR(255) NOT NULL');
    } catch {}

  } catch (err) {
    console.warn('initDb warning (schema check):', err instanceof Error ? err.message : String(err));
  }
}

export default dynamicPoolProxy;
