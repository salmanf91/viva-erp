import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const MASTER_DB_NAME = process.env.MASTER_DB_NAME || 'erp_master';

// Connection pool for master administrative operations & tenant directory
export const masterPool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
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
    // 1. Ensure master database exists
    await masterPool.query(
      `CREATE DATABASE IF NOT EXISTS \`${MASTER_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );

    // 2. Ensure master tables exist
    await masterPool.query(`
      CREATE TABLE IF NOT EXISTS \`${MASTER_DB_NAME}\`.master_tenants (
        id INT PRIMARY KEY AUTO_INCREMENT,
        slug VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        country VARCHAR(3) NOT NULL DEFAULT 'SA',
        currency VARCHAR(10) NOT NULL DEFAULT 'SAR',
        business_domain VARCHAR(50) NOT NULL DEFAULT 'trading',
        db_name VARCHAR(100) NOT NULL UNIQUE,
        db_host VARCHAR(255) DEFAULT 'localhost',
        db_port INT DEFAULT 3306,
        db_user VARCHAR(100) DEFAULT 'root',
        db_password VARCHAR(255) DEFAULT '',
        status ENUM('active', 'provisioning', 'suspended') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await masterPool.query(`
      CREATE TABLE IF NOT EXISTS \`${MASTER_DB_NAME}\`.master_tenant_modules (
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
        FOREIGN KEY (tenant_id) REFERENCES \`${MASTER_DB_NAME}\`.master_tenants(id) ON DELETE CASCADE
      )
    `);

    await masterPool.query(`
      CREATE TABLE IF NOT EXISTS \`${MASTER_DB_NAME}\`.master_users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role ENUM('owner','partner','manager','staff_admin') DEFAULT 'owner',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_tenant_user (tenant_id, email),
        FOREIGN KEY (tenant_id) REFERENCES \`${MASTER_DB_NAME}\`.master_tenants(id) ON DELETE CASCADE
      )
    `);

    // 3. Check if default Viva Studio tenant exists in master, if not seed it
    const [existingTenants] = await masterPool.query<any[]>(
      `SELECT * FROM \`${MASTER_DB_NAME}\`.master_tenants WHERE slug = 'viva_studio' LIMIT 1`
    );

    if (!existingTenants || existingTenants.length === 0) {
      const defaultDb = process.env.DB_NAME || 'viva_erp';
      const [res] = await masterPool.query<any>(
        `INSERT INTO \`${MASTER_DB_NAME}\`.master_tenants (slug, name, country, currency, business_domain, db_name)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['viva_studio', 'Viva Studio', 'IN', 'INR', 'garment_mfg', defaultDb]
      );
      const vivaTenantId = res.insertId;

      await masterPool.query(
        `INSERT INTO \`${MASTER_DB_NAME}\`.master_tenant_modules 
         (tenant_id, feature_accounting, feature_expenses, feature_party_ledger, feature_sales_invoicing, feature_purchases, feature_inventory_stock, feature_garment_production, feature_staff_piece_log, feature_payroll, feature_zatca_einvoicing)
         VALUES (?, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0)`,
        [vivaTenantId]
      );

      console.log(`[MasterDB] Initialized master database with default tenant 'Viva Studio' (DB: ${defaultDb})`);
    }
  } catch (error) {
    console.error('[MasterDB] Initialization error:', error);
  }
}
