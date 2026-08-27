import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { masterPool, masterQuery } from '../config/masterDb';
import { getTenantPool } from '../config/tenantDbManager';

export interface ProvisionTenantInput {
  name: string;
  slug: string;
  country?: string;
  currency?: string;
  business_domain?: string;
  logo_url?: string;
  admin_name: string;
  admin_email: string;
  admin_password: string;
  features?: {
    feature_accounting?: boolean;
    feature_expenses?: boolean;
    feature_party_ledger?: boolean;
    feature_sales_invoicing?: boolean;
    feature_purchases?: boolean;
    feature_inventory_stock?: boolean;
    feature_garment_production?: boolean;
    feature_staff_piece_log?: boolean;
    feature_payroll?: boolean;
    feature_zatca_einvoicing?: boolean;
  };
}

function getDatabaseSql(filename: string): string {
  const candidatePaths = [
    path.resolve(__dirname, '../../database', filename),
    path.resolve(__dirname, '../../../database', filename),
    path.resolve(process.cwd(), 'database', filename),
    path.resolve(process.cwd(), '../database', filename),
    path.resolve(__dirname, '../database', filename),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        return fs.readFileSync(p, 'utf8');
      } catch {}
    }
  }

  // Built-in fallbacks if file cannot be read from disk
  if (filename === 'tenant_base_schema.sql') {
    return `
      CREATE TABLE IF NOT EXISTS partners (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT,
        name VARCHAR(255) NOT NULL,
        committed_capital DECIMAL(12,2) NOT NULL DEFAULT 0,
        paid_capital DECIMAL(12,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS capital_payments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        partner_id INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        payment_date DATE NOT NULL,
        mode ENUM('cash','upi','cheque','bank_transfer') DEFAULT 'cash',
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS reminders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        body TEXT,
        type ENUM('warning','critical','info') DEFAULT 'warning',
        status ENUM('open','resolved') DEFAULT 'open',
        is_resolved BOOLEAN DEFAULT FALSE,
        resolved_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS clients (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        city VARCHAR(100),
        phone VARCHAR(50),
        vat_number VARCHAR(50),
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS sales_orders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        client_id INT NOT NULL,
        invoice_number VARCHAR(50) NOT NULL UNIQUE,
        order_date DATE NOT NULL,
        notes TEXT,
        include_gst BOOLEAN DEFAULT FALSE,
        gst_percent DECIMAL(5,2) DEFAULT 0.00,
        discount_percent DECIMAL(5,2) DEFAULT 0.00,
        discount DECIMAL(10,2) DEFAULT 0.00,
        status ENUM('paid','pending','partial') DEFAULT 'pending',
        amount_paid DECIMAL(12,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT
      );
      CREATE TABLE IF NOT EXISTS sales_order_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        category VARCHAR(100) NOT NULL,
        size VARCHAR(50),
        quantity INT NOT NULL,
        rate_per_pc DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS sales_payments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        payment_date DATE NOT NULL,
        payment_mode ENUM('cash','upi','bank_transfer','cheque') DEFAULT 'cash',
        reference_note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS vendors (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        city VARCHAR(100),
        vat_number VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS purchases (
        id INT PRIMARY KEY AUTO_INCREMENT,
        vendor_id INT NOT NULL,
        invoice_date DATE NOT NULL,
        subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
        discount DECIMAL(12,2) NOT NULL DEFAULT 0,
        tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
        tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        total DECIMAL(12,2) NOT NULL,
        status ENUM('paid','pending','partial') DEFAULT 'paid',
        note TEXT,
        tax_inclusive BOOLEAN DEFAULT FALSE,
        advance_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT
      );
      CREATE TABLE IF NOT EXISTS purchase_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        purchase_id INT NOT NULL,
        category VARCHAR(100) NOT NULL,
        quantity INT NOT NULL,
        rate_per_pc DECIMAL(10,2) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS purchase_transport (
        id INT PRIMARY KEY AUTO_INCREMENT,
        purchase_id INT NOT NULL,
        freight DECIMAL(10,2) DEFAULT 0,
        coolie DECIMAL(10,2) DEFAULT 0,
        total DECIMAL(10,2) GENERATED ALWAYS AS (freight + coolie) STORED,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS purchase_disputes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        purchase_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        status ENUM('pending','resolved','adjusted_in_next_bill') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS expense_reasons (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL DEFAULT 'other',
        icon VARCHAR(10) DEFAULT '💰',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS expenses (
        id INT PRIMARY KEY AUTO_INCREMENT,
        reason_id INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        expense_date DATE NOT NULL,
        note TEXT,
        paid_by VARCHAR(255),
        reimbursed_at TIMESTAMP NULL,
        is_archived BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reason_id) REFERENCES expense_reasons(id) ON DELETE RESTRICT
      );
      CREATE TABLE IF NOT EXISTS staff (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(100) NOT NULL DEFAULT 'tailor',
        rate_per_pc DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        phone VARCHAR(50),
        can_stitch BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS staff_work_entries (
        id INT PRIMARY KEY AUTO_INCREMENT,
        staff_id INT NOT NULL,
        entry_date DATE NOT NULL,
        completion_date DATE,
        category VARCHAR(100) NOT NULL,
        work_type VARCHAR(50) NOT NULL,
        allocated_pcs INT NOT NULL DEFAULT 0,
        completed_pcs INT NOT NULL DEFAULT 0,
        is_settled BOOLEAN DEFAULT FALSE,
        settled_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS payroll_settlements (
        id INT PRIMARY KEY AUTO_INCREMENT,
        staff_id INT NOT NULL,
        month INT NOT NULL,
        year INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        settled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS product_configs (
        id INT PRIMARY KEY AUTO_INCREMENT,
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
      );
      CREATE TABLE IF NOT EXISTS product_size_selling_rates (
        id INT PRIMARY KEY AUTO_INCREMENT,
        product_config_id INT NOT NULL,
        size_label VARCHAR(50) NOT NULL,
        selling_rate DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_config_id) REFERENCES product_configs(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS stock_movements (
        id INT PRIMARY KEY AUTO_INCREMENT,
        category VARCHAR(100) NOT NULL,
        vendor_id INT,
        type ENUM('in','out','adjustment') NOT NULL,
        quantity INT NOT NULL,
        reference VARCHAR(100),
        movement_date DATE NOT NULL,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
      );
    `;
  }

  if (filename === 'garment_production_schema.sql') {
    return `
      CREATE TABLE IF NOT EXISTS production_batches (
        id INT PRIMARY KEY AUTO_INCREMENT,
        batch_number VARCHAR(100) NOT NULL UNIQUE,
        category VARCHAR(100) NOT NULL,
        quantity INT NOT NULL,
        cut_rate DECIMAL(10,2) DEFAULT 0,
        stitch_rate DECIMAL(10,2) DEFAULT 0,
        status ENUM('allocated','cutting','stitching','finished') DEFAULT 'allocated',
        batch_date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS production_batch_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        batch_id INT NOT NULL,
        size_label VARCHAR(50) NOT NULL,
        quantity INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES production_batches(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS staff_work_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        staff_id INT NOT NULL,
        batch_id INT NOT NULL,
        pieces INT NOT NULL,
        rate DECIMAL(10,2) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        log_date DATE NOT NULL,
        is_settled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
        FOREIGN KEY (batch_id) REFERENCES production_batches(id) ON DELETE CASCADE
      );
    `;
  }

  if (filename === 'zatca_schema.sql') {
    return `
      CREATE TABLE IF NOT EXISTS zatca_config (
        id INT PRIMARY KEY AUTO_INCREMENT,
        vat_registration_number VARCHAR(15) NOT NULL,
        commercial_registration VARCHAR(50) NOT NULL,
        organization_name VARCHAR(255) NOT NULL,
        organization_unit VARCHAR(100) NOT NULL,
        city VARCHAR(100) DEFAULT 'Riyadh',
        country VARCHAR(2) DEFAULT 'SA',
        environment ENUM('sandbox', 'simulation', 'production') DEFAULT 'sandbox',
        egs_uuid VARCHAR(36) NOT NULL,
        private_key_pem TEXT,
        csr_pem TEXT,
        compliance_csid TEXT,
        compliance_secret TEXT,
        production_csid TEXT,
        production_secret TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS zatca_invoices (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        invoice_number VARCHAR(50) NOT NULL,
        uuid VARCHAR(36) NOT NULL,
        invoice_type ENUM('standard', 'simplified') NOT NULL,
        issue_datetime DATETIME NOT NULL,
        invoice_hash VARCHAR(64) NOT NULL,
        previous_invoice_hash VARCHAR(64) NOT NULL,
        invoice_counter INT NOT NULL,
        qr_code_tlv TEXT NOT NULL,
        signed_xml LONGTEXT NOT NULL,
        clearance_status ENUM('not_submitted', 'cleared', 'reported', 'rejected', 'warning') DEFAULT 'not_submitted',
        zatca_response_json JSON,
        cleared_at DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE
      );
    `;
  }

  return '';
}

export async function provisionNewTenant(input: ProvisionTenantInput): Promise<{ tenantId: number; dbName: string }> {
  const {
    name, slug, country = 'SA', currency = 'SAR', business_domain = 'trading',
    logo_url, admin_name, admin_email, admin_password, features = {}
  } = input;

  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 32);
  const dbName = `erp_tenant_${cleanSlug}`;

  // Check if slug or db already exists in master_tenants
  const existing = await masterQuery<any[]>(
    `SELECT id FROM master_tenants WHERE slug = ? OR db_name = ? LIMIT 1`,
    [cleanSlug, dbName]
  );
  if (existing && existing.length > 0) {
    throw new Error(`Workspace identifier '${cleanSlug}' already exists. Please choose a different slug.`);
  }

  // 1. Insert into master_tenants
  const [tenantRes] = await masterPool.query<any>(
    `INSERT INTO master_tenants (slug, name, country, currency, business_domain, logo_url, db_name)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [cleanSlug, name, country, currency, business_domain, logo_url || null, dbName]
  );
  const tenantId = tenantRes.insertId;

  // 2. Insert into master_tenant_modules
  await masterPool.query(
    `INSERT INTO master_tenant_modules (
      tenant_id, feature_accounting, feature_expenses, feature_party_ledger,
      feature_sales_invoicing, feature_purchases, feature_inventory_stock,
      feature_garment_production, feature_staff_piece_log, feature_payroll,
      feature_zatca_einvoicing
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      features.feature_accounting ?? true,
      features.feature_expenses ?? true,
      features.feature_party_ledger ?? true,
      features.feature_sales_invoicing ?? true,
      features.feature_purchases ?? true,
      features.feature_inventory_stock ?? false,
      features.feature_garment_production ?? false,
      features.feature_staff_piece_log ?? false,
      features.feature_payroll ?? true,
      features.feature_zatca_einvoicing ?? (country === 'SA'),
    ]
  );

  // 3. Create Admin User in master_users
  const passwordHash = await bcrypt.hash(admin_password, 10);
  await masterPool.query(
    `INSERT INTO master_users (tenant_id, email, password_hash, name, role)
     VALUES (?, ?, ?, ?, 'owner')`,
    [tenantId, admin_email.toLowerCase().trim(), passwordHash, admin_name.trim()]
  );

  // 4. Create the physical isolated MySQL database
  try {
    await masterPool.query(
      `CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } catch (err: any) {
    if (err.code === 'ER_DBACCESS_DENIED_ERROR' || err.code === 'ER_ACCESS_DENIED_ERROR') {
      const dbUser = process.env.DB_USER || 'vivauser';
      throw new Error(
        `MySQL Permission Needed: The database user '${dbUser}' does not have permission to execute 'CREATE DATABASE'. ` +
        `Please grant permissions in MySQL: GRANT ALL PRIVILEGES ON \`erp_%\`.* TO '${dbUser}'@'localhost'; FLUSH PRIVILEGES;`
      );
    }
    throw err;
  }

  // 5. Execute schema scripts on the new database
  const tenantPool = getTenantPool(dbName);
  
  // A. Execute Base Schema
  const baseSql = getDatabaseSql('tenant_base_schema.sql');
  if (baseSql) {
    await executeSqlScript(tenantPool, baseSql);
  }

  // B. Execute Garment Production Schema (if enabled)
  if (features.feature_garment_production) {
    const garmentSql = getDatabaseSql('garment_production_schema.sql');
    if (garmentSql) {
      await executeSqlScript(tenantPool, garmentSql);
    }
  }

  // C. Execute ZATCA Schema (if enabled)
  if (features.feature_zatca_einvoicing || country === 'SA') {
    const zatcaSql = getDatabaseSql('zatca_schema.sql');
    if (zatcaSql) {
      await executeSqlScript(tenantPool, zatcaSql);
    }
  }

  console.log(`[Provisioner] Successfully created isolated database '${dbName}' for tenant '${name}' (${cleanSlug})`);

  return { tenantId, dbName };
}

async function executeSqlScript(pool: any, sqlContent: string): Promise<void> {
  const statements = sqlContent
    .replace(/--.*$/gm, '')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (err: any) {
      console.warn(`[Provisioner] Schema statement notice:`, err.message);
    }
  }
}
