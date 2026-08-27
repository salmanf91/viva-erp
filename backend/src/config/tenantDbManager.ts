import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { masterQuery } from './masterDb';

dotenv.config();

interface TenantDbConfig {
  db_name: string;
  db_host?: string;
  db_port?: number;
  db_user?: string;
  db_password?: string;
}

// Memory cache for tenant connection pools
const tenantPools = new Map<string, mysql.Pool>();
const schemaChecked = new Set<string>();

export function getTenantPool(dbName: string, config?: TenantDbConfig): mysql.Pool {
  if (tenantPools.has(dbName)) {
    const pool = tenantPools.get(dbName)!;
    if (!schemaChecked.has(dbName)) {
      schemaChecked.add(dbName);
      ensureTenantSchema(pool, dbName).catch(e => console.warn(`[TenantDB] Schema check notice for ${dbName}:`, e.message));
    }
    return pool;
  }

  const pool = mysql.createPool({
    host:     config?.db_host || process.env.DB_HOST || 'localhost',
    port:     config?.db_port || parseInt(process.env.DB_PORT || '3306'),
    user:     config?.db_user || process.env.DB_USER || 'root',
    password: config?.db_password ?? (process.env.DB_PASSWORD || ''),
    database: dbName,
    waitForConnections: true,
    connectionLimit:    10,
    dateStrings:        true,
  });

  tenantPools.set(dbName, pool);
  schemaChecked.add(dbName);
  ensureTenantSchema(pool, dbName).catch(e => console.warn(`[TenantDB] Schema check notice for ${dbName}:`, e.message));

  return pool;
}

async function addColumnIfMissing(pool: mysql.Pool, table: string, column: string, definition: string): Promise<void> {
  try {
    const [cols] = await pool.query<any[]>(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
    if (!cols || cols.length === 0) {
      await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    }
  } catch (err) {
    // Table might not exist yet, ignore
  }
}

export async function ensureTenantSchema(pool: mysql.Pool, _dbName?: string): Promise<void> {
  // 1. Ensure Essential Missing Tables
  const coreTables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL DEFAULT 1,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'partner',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS product_config (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL DEFAULT 1,
      category VARCHAR(100) NOT NULL UNIQUE,
      fabric_cost DECIMAL(10,2) DEFAULT 0,
      selling_rate DECIMAL(10,2) DEFAULT 0,
      lace_cost DECIMAL(10,2) DEFAULT 0,
      zip_cost DECIMAL(10,2) DEFAULT 0,
      thread_cost DECIMAL(10,2) DEFAULT 0,
      canvas_cost DECIMAL(10,2) DEFAULT 0,
      plastic_cost DECIMAL(10,2) DEFAULT 0,
      logistics_cost DECIMAL(10,2) DEFAULT 0,
      cut_rate DECIMAL(10,2) DEFAULT 0,
      stitch_rate DECIMAL(10,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS product_size_selling_rates (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL DEFAULT 1,
      product_config_id INT NOT NULL,
      size_label VARCHAR(50) NOT NULL,
      selling_rate DECIMAL(10,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS monthly_overhead (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL DEFAULT 1,
      month TINYINT NOT NULL,
      year SMALLINT NOT NULL,
      rent DECIMAL(10,2) NOT NULL DEFAULT 0,
      electricity DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  ];

  for (const sql of coreTables) {
    try {
      await pool.query(sql);
    } catch {}
  }

  // 2. Ensure Essential Missing Columns across all tables
  const tableColumns = [
    { table: 'clients', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'clients', column: 'is_active', def: 'BOOLEAN DEFAULT TRUE' },
    { table: 'clients', column: 'vat_number', def: 'VARCHAR(50) DEFAULT NULL' },
    { table: 'vendors', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'vendors', column: 'is_active', def: 'BOOLEAN DEFAULT TRUE' },
    { table: 'vendors', column: 'vat_number', def: 'VARCHAR(50) DEFAULT NULL' },
    { table: 'sales_orders', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'sales_order_items', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'sales_payments', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'purchases', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'purchase_items', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'purchase_transport', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'purchase_disputes', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'expense_reasons', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'expense_reasons', column: 'is_active', def: 'BOOLEAN DEFAULT TRUE' },
    { table: 'expenses', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'staff', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'staff', column: 'is_active', def: 'BOOLEAN DEFAULT TRUE' },
    { table: 'staff', column: 'can_stitch', def: 'BOOLEAN DEFAULT FALSE' },
    { table: 'staff_work_entries', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'payroll_settlements', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'stock_movements', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'production_batches', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'production_batch_items', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'staff_work_logs', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'zatca_config', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'zatca_invoices', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
  ];

  for (const item of tableColumns) {
    await addColumnIfMissing(pool, item.table, item.column, item.def);
  }

  // 3. Seed default expense reasons if table is empty
  try {
    const [reasons] = await pool.query<any[]>('SELECT id FROM expense_reasons LIMIT 1');
    if (!reasons || reasons.length === 0) {
      await pool.query(`
        INSERT INTO expense_reasons (tenant_id, name, category, icon) VALUES
          (1, 'General Transport', 'transport', '🚚'),
          (1, 'Office & Utilities', 'setup', '💡'),
          (1, 'Stationery & Supplies', 'materials', '📦'),
          (1, 'Rent / Facility', 'setup', '🏢'),
          (1, 'Miscellaneous', 'other', '💰')
      `);
    }
  } catch {}
}

export async function resolveTenantBySlug(slug: string): Promise<any | null> {
  const rows = await masterQuery<any[]>(
    `SELECT t.*, m.feature_accounting, m.feature_expenses, m.feature_party_ledger,
            m.feature_sales_invoicing, m.feature_purchases, m.feature_inventory_stock,
            m.feature_garment_production, m.feature_staff_piece_log, m.feature_payroll,
            m.feature_zatca_einvoicing
     FROM master_tenants t
     LEFT JOIN master_tenant_modules m ON m.tenant_id = t.id
     WHERE t.slug = ? LIMIT 1`,
    [slug]
  );
  return rows[0] || null;
}

export async function resolveTenantById(id: number): Promise<any | null> {
  const rows = await masterQuery<any[]>(
    `SELECT t.*, m.feature_accounting, m.feature_expenses, m.feature_party_ledger,
            m.feature_sales_invoicing, m.feature_purchases, m.feature_inventory_stock,
            m.feature_garment_production, m.feature_staff_piece_log, m.feature_payroll,
            m.feature_zatca_einvoicing
     FROM master_tenants t
     LEFT JOIN master_tenant_modules m ON m.tenant_id = t.id
     WHERE t.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}
