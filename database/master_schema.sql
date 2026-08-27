-- ============================================================
-- Central Master Database: erp_master
-- Stores tenant metadata, connection configs, and module subscriptions
-- ============================================================

CREATE DATABASE IF NOT EXISTS erp_master CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE erp_master;

-- ── MASTER TENANTS DIRECTORY ─────────────────────────────────
CREATE TABLE IF NOT EXISTS master_tenants (
  id INT PRIMARY KEY AUTO_INCREMENT,
  slug VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  country VARCHAR(3) NOT NULL DEFAULT 'SA',
  currency VARCHAR(10) NOT NULL DEFAULT 'SAR',
  business_domain VARCHAR(50) NOT NULL DEFAULT 'trading',
  
  -- Database connection settings
  db_name VARCHAR(100) NOT NULL UNIQUE,
  db_host VARCHAR(255) DEFAULT 'localhost',
  db_port INT DEFAULT 3306,
  db_user VARCHAR(100) DEFAULT 'root',
  db_password VARCHAR(255) DEFAULT '',
  
  status ENUM('active', 'provisioning', 'suspended') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── TENANT MODULES & FEATURE FLAGS ───────────────────────────
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
);

-- ── CENTRAL USERS DIRECTORY ─────────────────────────────────
CREATE TABLE IF NOT EXISTS master_users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('owner','partner','manager','staff_admin') DEFAULT 'owner',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tenant_user (tenant_id, email),
  FOREIGN KEY (tenant_id) REFERENCES master_tenants(id) ON DELETE CASCADE
);
