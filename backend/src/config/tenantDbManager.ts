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
  // 0. Auto-fix plural table name if provisioned with product_configs
  try {
    const [hasOld] = await pool.query<any[]>("SHOW TABLES LIKE 'product_configs'");
    const [hasNew] = await pool.query<any[]>("SHOW TABLES LIKE 'product_config'");
    if (hasOld && hasOld.length > 0 && (!hasNew || hasNew.length === 0)) {
      await pool.query('RENAME TABLE product_configs TO product_config');
    }
  } catch {}

  // Ensure product_config.category is VARCHAR(100) to support dynamic categories (e.g. salwar_suit) without enum limits
  try {
    await pool.query('ALTER TABLE product_config MODIFY category VARCHAR(100) NOT NULL');
  } catch {}

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
    `CREATE TABLE IF NOT EXISTS production_batches (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL DEFAULT 1,
      batch_number VARCHAR(100) NOT NULL,
      category VARCHAR(100) NOT NULL,
      quantity INT NOT NULL DEFAULT 0,
      cut_rate DECIMAL(10,2) DEFAULT 0.00,
      stitch_rate DECIMAL(10,2) DEFAULT 0.00,
      status ENUM('allocated','cutting','stitching','finished') DEFAULT 'allocated',
      batch_date DATE NOT NULL,
      notes TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tenant_batch (tenant_id, batch_date)
    )`,
    `CREATE TABLE IF NOT EXISTS production_batch_items (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL DEFAULT 1,
      batch_id INT NOT NULL,
      category VARCHAR(100) NOT NULL,
      size VARCHAR(50) DEFAULT NULL,
      quantity INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_batch_id (batch_id)
    )`,
    `CREATE TABLE IF NOT EXISTS staff_work_logs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL DEFAULT 1,
      staff_id INT NOT NULL,
      work_date DATE NOT NULL,
      category VARCHAR(100) NOT NULL,
      operation ENUM('cutting','stitching','ironing','packing') NOT NULL,
      pieces_completed INT NOT NULL DEFAULT 0,
      rate_applied DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      is_paid BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tenant_work (tenant_id, work_date)
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
    `CREATE TABLE IF NOT EXISTS quotations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL DEFAULT 1,
      client_id INT NOT NULL,
      quotation_number VARCHAR(50) NOT NULL,
      quote_date DATE NOT NULL,
      expiry_date DATE DEFAULT NULL,
      status ENUM('draft','sent','accepted','rejected','expired','converted') DEFAULT 'draft',
      subtotal DECIMAL(12,2) DEFAULT 0.00,
      discount_percent DECIMAL(5,2) DEFAULT 0.00,
      discount DECIMAL(12,2) DEFAULT 0.00,
      gst_percent DECIMAL(5,2) DEFAULT 0.00,
      gst_amount DECIMAL(12,2) DEFAULT 0.00,
      total DECIMAL(12,2) DEFAULT 0.00,
      notes TEXT DEFAULT NULL,
      terms_conditions TEXT DEFAULT NULL,
      converted_order_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tenant_quote (tenant_id, quote_date),
      INDEX idx_tenant_client (tenant_id, client_id)
    )`,
    `CREATE TABLE IF NOT EXISTS quotation_items (
      id INT PRIMARY KEY AUTO_INCREMENT,
      quotation_id INT NOT NULL,
      tenant_id INT NOT NULL DEFAULT 1,
      category VARCHAR(100) NOT NULL,
      description VARCHAR(255) DEFAULT NULL,
      uom VARCHAR(20) DEFAULT 'pcs',
      quantity INT NOT NULL DEFAULT 1,
      rate_per_pc DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      INDEX idx_quote_id (quotation_id)
    )`,
    `CREATE TABLE IF NOT EXISTS delivery_notes (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL DEFAULT 1,
      client_id INT NOT NULL,
      order_id INT DEFAULT NULL,
      delivery_note_number VARCHAR(50) NOT NULL,
      delivery_date DATE NOT NULL,
      status ENUM('draft','dispatched','delivered','cancelled') DEFAULT 'dispatched',
      shipping_address TEXT DEFAULT NULL,
      transporter_name VARCHAR(100) DEFAULT NULL,
      vehicle_number VARCHAR(50) DEFAULT NULL,
      tracking_lr_number VARCHAR(100) DEFAULT NULL,
      total_pieces INT DEFAULT 0,
      notes TEXT DEFAULT NULL,
      received_by VARCHAR(100) DEFAULT NULL,
      received_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tenant_dn (tenant_id, delivery_date),
      INDEX idx_tenant_dn_client (tenant_id, client_id)
    )`,
    `CREATE TABLE IF NOT EXISTS delivery_note_items (
      id INT PRIMARY KEY AUTO_INCREMENT,
      delivery_note_id INT NOT NULL,
      tenant_id INT NOT NULL DEFAULT 1,
      category VARCHAR(100) NOT NULL,
      description VARCHAR(255) DEFAULT NULL,
      uom VARCHAR(20) DEFAULT 'pcs',
      quantity INT NOT NULL DEFAULT 1,
      remarks VARCHAR(255) DEFAULT NULL,
      INDEX idx_dn_id (delivery_note_id)
    )`,
    `CREATE TABLE IF NOT EXISTS zatca_config (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL DEFAULT 1,
      seller_name VARCHAR(255) NOT NULL,
      vat_number VARCHAR(50) NOT NULL,
      building_number VARCHAR(10) DEFAULT NULL,
      street_name VARCHAR(255) DEFAULT NULL,
      district VARCHAR(100) DEFAULT NULL,
      city VARCHAR(100) DEFAULT NULL,
      postal_code VARCHAR(10) DEFAULT NULL,
      is_production BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS zatca_invoices (
      id INT PRIMARY KEY AUTO_INCREMENT,
      tenant_id INT NOT NULL DEFAULT 1,
      order_id INT NOT NULL,
      uuid VARCHAR(100) NOT NULL,
      invoice_hash TEXT NOT NULL,
      qr_code TEXT NOT NULL,
      signed_xml LONGTEXT,
      zatca_status ENUM('PENDING','REPORTED','ACCEPTED','REJECTED') DEFAULT 'REPORTED',
      reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_order_id (order_id)
    )`,
    `CREATE TABLE IF NOT EXISTS staff_advances (
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
    { table: 'sales_payments', column: 'payment_mode', def: "VARCHAR(50) NOT NULL DEFAULT 'cash'" },
    { table: 'sales_payments', column: 'receipt_no', def: 'VARCHAR(100) NULL' },
    { table: 'sales_payments', column: 'notes', def: 'TEXT NULL' },
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
    { table: 'staff_work_entries', column: 'size', def: 'VARCHAR(50) DEFAULT NULL' },
    { table: 'staff_work_entries', column: 'completion_date', def: 'DATE DEFAULT NULL' },
    { table: 'staff_work_entries', column: 'batch_id', def: 'INT DEFAULT NULL' },
    { table: 'payroll_settlements', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'stock_movements', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'production_batches', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'production_batches', column: 'raw_material_id', def: 'INT DEFAULT NULL' },
    { table: 'production_batches', column: 'raw_material_name', def: 'VARCHAR(150) DEFAULT NULL' },
    { table: 'production_batches', column: 'raw_quantity_used', def: 'INT NOT NULL DEFAULT 0' },
    { table: 'production_batches', column: 'notes', def: 'TEXT DEFAULT NULL' },
    { table: 'production_batch_items', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'production_batch_items', column: 'category', def: 'VARCHAR(100) DEFAULT NULL' },
    { table: 'production_batch_items', column: 'size', def: 'VARCHAR(50) DEFAULT NULL' },
    { table: 'production_batch_items', column: 'cut_rate', def: 'DECIMAL(10,2) DEFAULT 0.00' },
    { table: 'production_batch_items', column: 'stitch_rate', def: 'DECIMAL(10,2) DEFAULT 0.00' },
    { table: 'production_batch_items', column: 'zip_cost', def: 'DECIMAL(10,2) DEFAULT 0.00' },
    { table: 'production_batch_items', column: 'thread_cost', def: 'DECIMAL(10,2) DEFAULT 0.00' },
    { table: 'production_batch_items', column: 'canvas_cost', def: 'DECIMAL(10,2) DEFAULT 0.00' },
    { table: 'production_batch_items', column: 'plastic_cost', def: 'DECIMAL(10,2) DEFAULT 0.00' },
    { table: 'production_batch_items', column: 'lace_cost', def: 'DECIMAL(10,2) DEFAULT 0.00' },
    { table: 'production_batch_items', column: 'logistics_cost', def: 'DECIMAL(10,2) DEFAULT 0.00' },
    { table: 'staff_work_logs', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'zatca_config', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    { table: 'zatca_invoices', column: 'tenant_id', def: 'INT NOT NULL DEFAULT 1' },
    // Universal Item & UOM attributes
    { table: 'product_config', column: 'name', def: 'VARCHAR(255) DEFAULT NULL' },
    { table: 'product_config', column: 'item_code', def: 'VARCHAR(100) DEFAULT NULL' },
    { table: 'product_config', column: 'item_type', def: "VARCHAR(50) DEFAULT 'product'" },
    { table: 'product_config', column: 'uom', def: "VARCHAR(20) DEFAULT 'pcs'" },
    { table: 'product_config', column: 'purchase_cost', def: 'DECIMAL(12,2) DEFAULT 0.00' },
    { table: 'product_config', column: 'tax_rate', def: 'DECIMAL(5,2) DEFAULT 0.00' },
    { table: 'product_config', column: 'hsn_code', def: 'VARCHAR(50) DEFAULT NULL' },
    { table: 'product_config', column: 'description', def: 'TEXT DEFAULT NULL' },
    { table: 'product_config', column: 'is_active', def: 'BOOLEAN DEFAULT TRUE' },
    { table: 'sales_order_items', column: 'uom', def: "VARCHAR(20) DEFAULT 'pcs'" },
    { table: 'purchase_items', column: 'uom', def: "VARCHAR(20) DEFAULT 'pcs'" },
    { table: 'quotation_items', column: 'uom', def: "VARCHAR(20) DEFAULT 'pcs'" },
    { table: 'delivery_note_items', column: 'uom', def: "VARCHAR(20) DEFAULT 'pcs'" },
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

  // 4. Auto-repair purchase totals if freight/coolie exists in purchase_transport but was omitted from purchases.total
  try {
    await pool.query(`
      UPDATE purchases p
      JOIN purchase_transport pt ON pt.purchase_id = p.id
      SET p.total = ROUND(p.subtotal - COALESCE(p.discount, 0) + COALESCE(p.tax_amount, 0) + COALESCE(pt.freight, 0) + COALESCE(pt.coolie, 0), 2)
      WHERE (COALESCE(pt.freight, 0) > 0 OR COALESCE(pt.coolie, 0) > 0)
        AND p.subtotal > 0
        AND p.total != ROUND(p.subtotal - COALESCE(p.discount, 0) + COALESCE(p.tax_amount, 0) + COALESCE(pt.freight, 0) + COALESCE(pt.coolie, 0), 2)
    `);
  } catch {}

  // 5. Ensure Salwar Batches 007 & 008 exist and link August work entries
  try {
    const [b7] = await pool.query<any[]>("SELECT id FROM production_batches WHERE batch_number = 'BATCH-007' LIMIT 1");
    let b7Id = b7 && b7.length > 0 ? b7[0].id : null;
    if (!b7Id) {
      const [res7] = await pool.query<any[]>(`
        INSERT INTO production_batches (tenant_id, batch_number, category, raw_material_name, raw_quantity_used, quantity, cut_rate, stitch_rate, status, batch_date, notes)
        VALUES (1, 'BATCH-007', 'salwar_suit', 'Mixed Fabric (Salwar)', 96, 96, 28.00, 22.00, 'finished', '2026-08-10', 'Fabric purchase 10th August 2026 (96 pcs)')
      `);
      b7Id = (res7 as any).insertId;
      await pool.query(`
        INSERT INTO production_batch_items (tenant_id, batch_id, category, size, quantity, cut_rate, stitch_rate)
        VALUES (1, ?, 'salwar_suit', 'Free Size', 96, 28.00, 22.00)
      `, [b7Id]);
    }

    const [b8] = await pool.query<any[]>("SELECT id FROM production_batches WHERE batch_number = 'BATCH-008' LIMIT 1");
    let b8Id = b8 && b8.length > 0 ? b8[0].id : null;
    if (!b8Id) {
      const [res8] = await pool.query<any[]>(`
        INSERT INTO production_batches (tenant_id, batch_number, category, raw_material_name, raw_quantity_used, quantity, cut_rate, stitch_rate, status, batch_date, notes)
        VALUES (1, 'BATCH-008', 'salwar_suit', 'Mixed Fabric (Salwar)', 50, 50, 28.00, 22.00, 'finished', '2026-08-24', 'Fabric purchase 24th August 2026 (50 pcs)')
      `);
      b8Id = (res8 as any).insertId;
      await pool.query(`
        INSERT INTO production_batch_items (tenant_id, batch_id, category, size, quantity, cut_rate, stitch_rate)
        VALUES (1, ?, 'salwar_suit', 'Free Size', 50, 28.00, 22.00)
      `, [b8Id]);
    }

    // 6. Ensure Salwar Initial Batch BATCH-000 (170 pcs) and all 492 pcs Salwar fabric purchases exist
    const [b0] = await pool.query<any[]>("SELECT id FROM production_batches WHERE batch_number = 'BATCH-000' OR batch_number = 'BATCH-SALWAR-INIT' LIMIT 1");
    if (!b0 || b0.length === 0) {
      const [res0] = await pool.query<any[]>(`
        INSERT INTO production_batches (tenant_id, batch_number, category, raw_material_name, raw_quantity_used, quantity, cut_rate, stitch_rate, status, batch_date, notes)
        VALUES (1, 'BATCH-000', 'salwar_suit', 'Mixed Fabric (Salwar)', 170, 170, 28.00, 22.00, 'finished', '2026-08-15', 'Initial bulk salwar batch - settled 15th Aug (170 pcs)')
      `);
      const b0Id = (res0 as any).insertId;
      await pool.query(`
        INSERT INTO production_batch_items (tenant_id, batch_id, category, size, quantity, cut_rate, stitch_rate)
        VALUES (1, ?, 'salwar_suit', 'Free Size', 170, 28.00, 22.00)
      `, [b0Id]);
    }

    // 6. Ensure Salwar fabric stock movements exist (inward stock without affecting cash-in-hand)
    // Clean up any artificial purchase records that drained cash-in-hand by 86,500
    try {
      const [oldPurch] = await pool.query<any[]>(`
        SELECT id FROM purchases
        WHERE note LIKE 'Salwar bulk fabric purchase - 169 pcs%'
           OR note LIKE 'Salwar fabric purchase - 80 pcs%'
           OR note LIKE 'Salwar fabric purchase - 49 pcs%'
           OR note LIKE 'Salwar fabric purchase - 48 pcs%'
      `);
      if (oldPurch && oldPurch.length > 0) {
        const ids = oldPurch.map((p: any) => p.id);
        await pool.query(`DELETE FROM purchase_items WHERE purchase_id IN (?)`, [ids]);
        await pool.query(`DELETE FROM purchases WHERE id IN (?)`, [ids]);
      }
    } catch {}

    const salwarMovements = [
      { date: '2026-08-01', qty: 171, ref: 'SALWAR-STOCK-171' },
      { date: '2026-08-29', qty: 80,  ref: 'SALWAR-STOCK-80' },
      { date: '2026-09-05', qty: 49,  ref: 'SALWAR-STOCK-49' },
      { date: '2026-09-08', qty: 48,  ref: 'SALWAR-STOCK-48' }
    ];
    // Clean up old 169-ref if present
    try {
      await pool.query("UPDATE stock_movements SET reference='SALWAR-STOCK-171', quantity=171 WHERE reference='SALWAR-STOCK-169'");
    } catch {}

    for (const sm of salwarMovements) {
      const [exist] = await pool.query<any[]>('SELECT id FROM stock_movements WHERE reference = ? LIMIT 1', [sm.ref]);
      if (!exist || exist.length === 0) {
        await pool.query(`
          INSERT INTO stock_movements (tenant_id, category, vendor_id, type, quantity, reference, movement_date)
          VALUES (1, 'Mixed Fabric (Salwar)', 5, 'in', ?, ?, ?)
        `, [sm.qty, sm.ref, sm.date]);
      } else {
        await pool.query('UPDATE stock_movements SET quantity = ? WHERE reference = ?', [sm.qty, sm.ref]);
      }
    }

    // 7. Close out legacy nighty and generic mixed fabric batches (marking them finished so available = 0)
    const [bNighty] = await pool.query<any[]>("SELECT id FROM production_batches WHERE batch_number = 'BATCH-LEGACY-NIGHTY' LIMIT 1");
    if (!bNighty || bNighty.length === 0) {
      const [resN] = await pool.query<any[]>(`
        INSERT INTO production_batches (tenant_id, batch_number, category, raw_material_name, raw_quantity_used, quantity, cut_rate, stitch_rate, status, batch_date, notes)
        VALUES (1, 'BATCH-LEGACY-NIGHTY', 'shawl_nighty', 'Mixed Fabric (Nighty)', 382, 382, 0.00, 0.00, 'finished', '2026-07-31', 'Closed legacy nighty fabric (382 pcs)')
      `);
      const bId = (resN as any).insertId;
      await pool.query(`
        INSERT INTO production_batch_items (tenant_id, batch_id, category, size, quantity, cut_rate, stitch_rate)
        VALUES (1, ?, 'shawl_nighty', 'Free Size', 382, 0.00, 0.00)
      `, [bId]);
    }

    const [bMixed] = await pool.query<any[]>("SELECT id FROM production_batches WHERE batch_number = 'BATCH-LEGACY-MIXED' LIMIT 1");
    if (!bMixed || bMixed.length === 0) {
      const [resM] = await pool.query<any[]>(`
        INSERT INTO production_batches (tenant_id, batch_number, category, raw_material_name, raw_quantity_used, quantity, cut_rate, stitch_rate, status, batch_date, notes)
        VALUES (1, 'BATCH-LEGACY-MIXED', 'mixed', 'Mixed Fabric', 620, 620, 0.00, 0.00, 'finished', '2026-07-31', 'Closed legacy mixed fabric (620 pcs)')
      `);
      const bId = (resM as any).insertId;
      await pool.query(`
        INSERT INTO production_batch_items (tenant_id, batch_id, category, size, quantity, cut_rate, stitch_rate)
        VALUES (1, ?, 'mixed', 'Free Size', 620, 0.00, 0.00)
      `, [bId]);
    }

    // 8. Ensure item_name column exists in sales_order_items
    try {
      await pool.query("ALTER TABLE sales_order_items ADD COLUMN item_name VARCHAR(255) NULL AFTER category");
    } catch {}
    try {
      await pool.query("UPDATE sales_order_items SET item_name = category WHERE item_name IS NULL OR item_name = ''");
    } catch {}
  } catch (e) {
    console.error('Error ensuring batches & salwar stock:', e);
  }

  // Tenant database schema migrations complete
}

export async function resolveTenantBySlug(slug: string): Promise<any | null> {
  const rows = await masterQuery<any[]>(
    `SELECT t.*, m.feature_accounting, m.feature_expenses, m.feature_party_ledger,
            m.feature_sales_invoicing, m.feature_purchases, m.feature_inventory_stock,
            m.feature_garment_production, m.feature_staff_piece_log, m.feature_payroll,
            m.feature_zatca_einvoicing, m.feature_quotations, m.feature_delivery_notes
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
            m.feature_zatca_einvoicing, m.feature_quotations, m.feature_delivery_notes
     FROM master_tenants t
     LEFT JOIN master_tenant_modules m ON m.tenant_id = t.id
     WHERE t.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}
