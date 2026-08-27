import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Use DB_NAME as the master database unless explicitly configured otherwise
export const MASTER_DB_NAME = process.env.MASTER_DB_NAME || process.env.DB_NAME || 'viva_erp';

// Connection pool for master administrative operations & tenant directory
export const masterPool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: MASTER_DB_NAME,
  waitForConnections: true,
  connectionLimit:    5,
  dateStrings:        true,
});

export async function masterQuery<T>(sql: string, params?: any[]): Promise<T> {
  const [rows] = await masterPool.query(sql, params);
  return rows as T;
}

export async function initMasterDb(): Promise<void> {
  try {
    // 1. Ensure master tables exist in MASTER_DB_NAME
    await masterPool.query(`
      CREATE TABLE IF NOT EXISTS master_tenants (
        id INT PRIMARY KEY AUTO_INCREMENT,
        slug VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        country VARCHAR(3) NOT NULL DEFAULT 'SA',
        currency VARCHAR(10) NOT NULL DEFAULT 'SAR',
        business_domain VARCHAR(50) NOT NULL DEFAULT 'trading',
        logo_url MEDIUMTEXT,
        db_name VARCHAR(100) NOT NULL UNIQUE,
        db_host VARCHAR(255) DEFAULT 'localhost',
        db_port INT DEFAULT 3306,
        db_user VARCHAR(100) DEFAULT 'root',
        db_password VARCHAR(255) DEFAULT '',
        status ENUM('active', 'provisioning', 'suspended') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure logo_url column exists if table already existed
    try {
      const [cols] = await masterPool.query<any[]>(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'master_tenants' AND COLUMN_NAME = 'logo_url'`,
        [MASTER_DB_NAME]
      );
      if (!cols || cols.length === 0) {
        await masterPool.query('ALTER TABLE master_tenants ADD COLUMN logo_url MEDIUMTEXT AFTER business_domain');
      }
    } catch {}

    await masterPool.query(`
      CREATE TABLE IF NOT EXISTS master_tenant_modules (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL UNIQUE,
        feature_accounting BOOLEAN DEFAULT TRUE,
        feature_expenses BOOLEAN DEFAULT TRUE,
        feature_party_ledger BOOLEAN DEFAULT TRUE,
        feature_sales_invoicing BOOLEAN DEFAULT TRUE,
        feature_purchases BOOLEAN DEFAULT TRUE,
        feature_inventory_stock BOOLEAN DEFAULT FALSE,
        feature_garment_production BOOLEAN DEFAULT FALSE,
        feature_staff_piece_log BOOLEAN DEFAULT FALSE,
        feature_payroll BOOLEAN DEFAULT TRUE,
        feature_zatca_einvoicing BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES master_tenants(id) ON DELETE CASCADE
      )
    `);

    await masterPool.query(`
      CREATE TABLE IF NOT EXISTS master_users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role ENUM('super_admin','owner','partner','manager','staff_admin') DEFAULT 'owner',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_tenant_user (tenant_id, email),
        FOREIGN KEY (tenant_id) REFERENCES master_tenants(id) ON DELETE CASCADE
      )
    `);

    // Ensure tenant_id is nullable and role has super_admin if table already existed
    try {
      await masterPool.query('ALTER TABLE master_users MODIFY COLUMN tenant_id INT NULL');
      await masterPool.query("ALTER TABLE master_users MODIFY COLUMN role ENUM('super_admin','owner','partner','manager','staff_admin') DEFAULT 'owner'");
    } catch {}

    // 2. Check if default Super Admin exists in master_users, if not seed it
    const defaultAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@platform.com';
    const [existingSuperAdmin] = await masterPool.query<any[]>(
      'SELECT id FROM master_users WHERE role = ? OR email = ? LIMIT 1',
      ['super_admin', defaultAdminEmail]
    );

    if (!existingSuperAdmin || existingSuperAdmin.length === 0) {
      const bcrypt = require('bcryptjs');
      const defaultPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin123';
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      await masterPool.query(
        `INSERT INTO master_users (tenant_id, email, password_hash, name, role)
         VALUES (NULL, ?, ?, 'Platform Super Admin', 'super_admin')`,
        [defaultAdminEmail.toLowerCase().trim(), passwordHash]
      );
      console.log(`[MasterDB] Seeded platform super admin '${defaultAdminEmail}' (default password: ${defaultPassword})`);
    }

    // 3. Check if default Viva Studio tenant exists in master, if not seed it
    const [existingTenants] = await masterPool.query<any[]>(
      `SELECT * FROM master_tenants WHERE slug = 'viva_studio' LIMIT 1`
    );

    if (!existingTenants || existingTenants.length === 0) {
      const defaultDb = process.env.DB_NAME || 'viva_erp';
      const [res] = await masterPool.query<any>(
        `INSERT INTO master_tenants (slug, name, country, currency, business_domain, db_name)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['viva_studio', 'Viva Studio', 'IN', 'INR', 'garment_mfg', defaultDb]
      );
      const vivaTenantId = res.insertId;

      await masterPool.query(
        `INSERT INTO master_tenant_modules 
         (tenant_id, feature_accounting, feature_expenses, feature_party_ledger, feature_sales_invoicing, feature_purchases, feature_inventory_stock, feature_garment_production, feature_staff_piece_log, feature_payroll, feature_zatca_einvoicing)
         VALUES (?, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0)`,
        [vivaTenantId]
      );

      console.log(`[MasterDB] Initialized master tables with default tenant 'Viva Studio' in database '${MASTER_DB_NAME}'`);
    }
  } catch (error) {
    console.error('[MasterDB] Initialization error:', error);
  }
}
