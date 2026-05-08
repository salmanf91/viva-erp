-- ============================================================
-- Viva Studio ERP — MySQL Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS viva_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE viva_erp;

-- ── TENANTS ──────────────────────────────────────────────────
CREATE TABLE tenants (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  name       VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── USERS / PARTNERS ─────────────────────────────────────────
CREATE TABLE users (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id     INT NOT NULL,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('owner','partner','manager') DEFAULT 'partner',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_email_tenant (email, tenant_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ── PARTNER CAPITAL ───────────────────────────────────────────
CREATE TABLE partners (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id        INT NOT NULL,
  user_id          INT,
  name             VARCHAR(255) NOT NULL,
  committed_capital DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_capital     DECIMAL(12,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE SET NULL
);

CREATE TABLE capital_payments (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id    INT NOT NULL,
  partner_id   INT NOT NULL,
  amount       DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  mode         ENUM('cash','upi','cheque') DEFAULT 'cash',
  note         TEXT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id)  REFERENCES tenants(id)  ON DELETE CASCADE,
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
);

-- ── REMINDERS ─────────────────────────────────────────────────
CREATE TABLE reminders (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id  INT NOT NULL,
  title      VARCHAR(255) NOT NULL,
  body       TEXT,
  type       ENUM('warning','critical','info') DEFAULT 'warning',
  status     ENUM('open','resolved') DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ── VENDORS ───────────────────────────────────────────────────
CREATE TABLE vendors (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id  INT NOT NULL,
  name       VARCHAR(255) NOT NULL,
  phone      VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ── PURCHASES ─────────────────────────────────────────────────
CREATE TABLE purchases (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id    INT NOT NULL,
  vendor_id    INT NOT NULL,
  invoice_date DATE NOT NULL,
  subtotal     DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount     DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_rate     DECIMAL(5,2)  NOT NULL DEFAULT 0,
  tax_amount   DECIMAL(12,2) NOT NULL DEFAULT 0,
  total        DECIMAL(12,2) NOT NULL,
  status       ENUM('paid','pending','partial') DEFAULT 'paid',
  note         TEXT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)  ON DELETE CASCADE,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id)  ON DELETE RESTRICT
);

CREATE TABLE purchase_items (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  purchase_id INT NOT NULL,
  category    ENUM('shawl_nighty','ordinary_nighty','mixed') NOT NULL,
  quantity    INT NOT NULL,
  rate_per_pc DECIMAL(10,2) NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
);

CREATE TABLE purchase_transport (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  purchase_id INT NOT NULL,
  freight     DECIMAL(10,2) DEFAULT 0,
  coolie      DECIMAL(10,2) DEFAULT 0,
  total       DECIMAL(10,2) GENERATED ALWAYS AS (freight + coolie) STORED,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
);

CREATE TABLE purchase_disputes (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  purchase_id INT NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  description TEXT,
  status      ENUM('pending','resolved','adjusted_in_next_bill') DEFAULT 'pending',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
);

-- ── EXPENSE REASONS (master list) ────────────────────────────
CREATE TABLE expense_reasons (
  id        INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  name      VARCHAR(255) NOT NULL,
  category  ENUM('transport','materials','setup','fabric','staff','other') NOT NULL,
  icon      VARCHAR(10)  DEFAULT '💰',
  is_active BOOLEAN      DEFAULT TRUE,
  created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ── EXPENSES ──────────────────────────────────────────────────
CREATE TABLE expenses (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id    INT NOT NULL,
  reason_id    INT NOT NULL,
  amount       DECIMAL(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  note         TEXT,
  is_archived  BOOLEAN   DEFAULT FALSE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)       ON DELETE CASCADE,
  FOREIGN KEY (reason_id) REFERENCES expense_reasons(id) ON DELETE RESTRICT
);

-- ── MONTHLY OVERHEAD ──────────────────────────────────────────
CREATE TABLE monthly_overhead (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id   INT NOT NULL,
  month       TINYINT NOT NULL,
  year        SMALLINT NOT NULL,
  rent        DECIMAL(10,2) NOT NULL DEFAULT 5000,
  electricity DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_overhead (tenant_id, month, year),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ── PRODUCT CONFIG ────────────────────────────────────────────
CREATE TABLE product_config (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id     INT NOT NULL,
  category      ENUM('shawl_nighty','shawl_nighty_lace','ordinary_nighty') NOT NULL,
  fabric_cost   DECIMAL(10,2) NOT NULL DEFAULT 0,
  selling_rate  DECIMAL(10,2) NOT NULL DEFAULT 0,
  lace_cost     DECIMAL(10,2) NOT NULL DEFAULT 0,
  zip_cost      DECIMAL(10,2) NOT NULL DEFAULT 2.00,
  thread_cost   DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  canvas_cost   DECIMAL(10,2) NOT NULL DEFAULT 2.00,
  plastic_cost  DECIMAL(10,2) NOT NULL DEFAULT 2.50,
  logistics_cost DECIMAL(10,2) NOT NULL DEFAULT 5.30,
  cut_rate      DECIMAL(10,2) NOT NULL DEFAULT 5.00,
  stitch_rate   DECIMAL(10,2) NOT NULL DEFAULT 15.00,
  UNIQUE KEY uq_product (tenant_id, category),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ── STAFF ─────────────────────────────────────────────────────
CREATE TABLE staff (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id  INT NOT NULL,
  name       VARCHAR(255) NOT NULL,
  role       ENUM('cutting_master','tailor') NOT NULL,
  rate_per_pc DECIMAL(10,2) NOT NULL,
  phone      VARCHAR(20),
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ── PRODUCTION BATCHES ────────────────────────────────────────
CREATE TABLE production_batches (
  id                INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id         INT NOT NULL,
  batch_number      VARCHAR(20) NOT NULL,
  category          ENUM('shawl_nighty','shawl_nighty_lace','ordinary_nighty') NOT NULL,
  quantity          INT NOT NULL,
  cutting_master_id INT,
  tailor_id         INT,
  status            ENUM('allocated','cutting','stitching','finished') DEFAULT 'allocated',
  batch_date        DATE NOT NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id)         REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (cutting_master_id) REFERENCES staff(id)   ON DELETE SET NULL,
  FOREIGN KEY (tailor_id)         REFERENCES staff(id)   ON DELETE SET NULL
);

-- ── STAFF WORK LOGS (payroll source) ─────────────────────────
CREATE TABLE staff_work_logs (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id   INT NOT NULL,
  staff_id    INT NOT NULL,
  batch_id    INT NOT NULL,
  pieces      INT NOT NULL,
  rate        DECIMAL(10,2) NOT NULL,
  amount      DECIMAL(12,2) GENERATED ALWAYS AS (pieces * rate) STORED,
  log_date    DATE NOT NULL,
  is_settled  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id)  REFERENCES staff(id)   ON DELETE RESTRICT,
  FOREIGN KEY (batch_id)  REFERENCES production_batches(id) ON DELETE RESTRICT
);

-- ── STOCK MOVEMENTS ───────────────────────────────────────────
CREATE TABLE stock_movements (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id   INT NOT NULL,
  category    ENUM('shawl_nighty','ordinary_nighty') NOT NULL,
  vendor_id   INT,
  type        ENUM('in','allocated','finished','sold') NOT NULL,
  quantity    INT NOT NULL,
  reference   VARCHAR(100),
  movement_date DATE NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
);

-- ============================================================
-- SEED DATA — Tenant + users only (no hardcoded business data)
-- ============================================================

INSERT INTO tenants (name) VALUES ('Viva Studio');

-- Login accounts (password: admin123)
INSERT INTO users (tenant_id, name, email, password_hash, role) VALUES
  (1, 'Partner A', 'partner_a@vivastudio.com', '$2a$10$8UYkHJeZ5n6w8HMpndldFelmARdSWT3sGNn6REXenyP/zNu6HJSsu', 'owner'),
  (1, 'Partner B', 'partner_b@vivastudio.com', '$2a$10$C3cOyMbcldSoM1QJqAda7.8ecDYCDhycpQuM4C9LW.yiNOn1ptv3y', 'owner');

-- Partners (committed capital set, paid_capital starts at 0 — record via app)
INSERT INTO partners (tenant_id, user_id, name, committed_capital, paid_capital) VALUES
  (1, 1, 'Partner A', 75000.00, 0.00),
  (1, 2, 'Partner B', 75000.00, 0.00);

-- Default expense reasons (lookup data, not business transactions)
INSERT INTO expense_reasons (tenant_id, name, category, icon) VALUES
  (1, 'Freight Charge',    'transport',  '🚚'),
  (1, 'Coolie / Labour',   'transport',  '👷'),
  (1, 'Thread',            'materials',  '🪡'),
  (1, 'Nighty Zip',        'materials',  '🔗'),
  (1, 'Canvas',            'materials',  '🧵'),
  (1, 'Plastic Bags',      'materials',  '🛍'),
  (1, 'Lace',              'materials',  '✨'),
  (1, 'Shop Deposit',      'setup',      '🏪'),
  (1, 'Monthly Rent',      'setup',      '🏠'),
  (1, 'Electricity Bill',  'setup',      '⚡'),
  (1, 'Company Seal',      'setup',      '🔖'),
  (1, 'Miscellaneous',     'other',      '💰');
