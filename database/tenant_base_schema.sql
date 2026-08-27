-- ============================================================
-- Tenant Base Database Schema (Created per independent tenant DB)
-- ============================================================

-- ── PARTNERS & CAPITAL ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS partners (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  user_id INT,
  name VARCHAR(255) NOT NULL,
  committed_capital DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_capital DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS capital_payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
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
  tenant_id INT NOT NULL DEFAULT 1,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  type ENUM('warning','critical','info') DEFAULT 'warning',
  status ENUM('open','resolved') DEFAULT 'open',
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── CLIENTS & SALES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  name VARCHAR(255) NOT NULL,
  city VARCHAR(100),
  phone VARCHAR(50),
  vat_number VARCHAR(50),
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
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
  tenant_id INT NOT NULL DEFAULT 1,
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
  tenant_id INT NOT NULL DEFAULT 1,
  order_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_mode ENUM('cash','upi','bank_transfer','cheque') DEFAULT 'cash',
  reference_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE
);

-- ── VENDORS & PURCHASES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  city VARCHAR(100),
  vat_number VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchases (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
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
  tenant_id INT NOT NULL DEFAULT 1,
  purchase_id INT NOT NULL,
  category VARCHAR(100) NOT NULL,
  quantity INT NOT NULL,
  rate_per_pc DECIMAL(10,2) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS purchase_transport (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  purchase_id INT NOT NULL,
  freight DECIMAL(10,2) DEFAULT 0,
  coolie DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) GENERATED ALWAYS AS (freight + coolie) STORED,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS purchase_disputes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  purchase_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  status ENUM('pending','resolved','adjusted_in_next_bill') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
);

-- ── EXPENSES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_reasons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'other',
  icon VARCHAR(10) DEFAULT '💰',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
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

-- ── STAFF & PAYROLL ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
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
  tenant_id INT NOT NULL DEFAULT 1,
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
  tenant_id INT NOT NULL DEFAULT 1,
  staff_id INT NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  settled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- ── PRODUCT CONFIGS & STOCK ──────────────────────────────────
CREATE TABLE IF NOT EXISTS product_configs (
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
);

CREATE TABLE IF NOT EXISTS product_size_selling_rates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  product_config_id INT NOT NULL,
  size_label VARCHAR(50) NOT NULL,
  selling_rate DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_config_id) REFERENCES product_configs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
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
