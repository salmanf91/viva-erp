-- Migration 025: Create Job Work & Client Salwar Stitching Tables
-- Completely isolated tables for client salwar intake, branch assignment, staff stitching wages, and expenses

CREATE TABLE IF NOT EXISTS job_work_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  order_no VARCHAR(50) NOT NULL,
  client_name VARCHAR(150) NOT NULL,
  client_phone VARCHAR(50) NULL,
  received_date DATE NOT NULL,
  target_delivery_date DATE NULL,
  delivered_date DATE NULL,
  branch VARCHAR(50) NOT NULL DEFAULT 'Bajpe',
  total_pcs INT NOT NULL DEFAULT 0,
  client_rate_per_pc DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  client_total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  status VARCHAR(20) NOT NULL DEFAULT 'received',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_jwo_tenant_date (tenant_id, received_date),
  INDEX idx_jwo_branch (tenant_id, branch),
  INDEX idx_jwo_status (tenant_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS job_work_staff_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  order_id INT NOT NULL,
  staff_id INT NULL,
  staff_name VARCHAR(150) NOT NULL,
  branch VARCHAR(50) NOT NULL DEFAULT 'Bajpe',
  pcs_assigned INT NOT NULL DEFAULT 0,
  pcs_completed INT NOT NULL DEFAULT 0,
  rate_per_pc DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_wage DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'assigned',
  assigned_date DATE NOT NULL,
  completed_date DATE NULL,
  notes VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_jwsa_order (order_id),
  INDEX idx_jwsa_staff (tenant_id, staff_id),
  INDEX idx_jwsa_branch (tenant_id, branch)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS job_work_expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  order_id INT NOT NULL,
  expense_title VARCHAR(150) NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  expense_date DATE NOT NULL,
  notes VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_jwe_order (order_id),
  INDEX idx_jwe_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS job_work_staff_payouts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  staff_id INT NULL,
  staff_name VARCHAR(150) NOT NULL,
  branch VARCHAR(50) NOT NULL DEFAULT 'Bajpe',
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_mode VARCHAR(30) NOT NULL DEFAULT 'cash',
  payment_date DATE NOT NULL,
  reference_order_id INT NULL,
  notes VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_jwsp_staff (tenant_id, staff_id),
  INDEX idx_jwsp_tenant_date (tenant_id, payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS job_work_branches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_jwb_tenant (tenant_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

