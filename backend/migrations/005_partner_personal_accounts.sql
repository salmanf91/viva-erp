CREATE TABLE IF NOT EXISTS partner_personal_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  partner_id INT NOT NULL,
  entry_date DATE NOT NULL,
  type ENUM('credit', 'debit') NOT NULL,
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  payment_mode ENUM('cash', 'bank_transfer', 'upi', 'cheque') DEFAULT 'cash',
  reference_no VARCHAR(100) NULL,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant_partner (tenant_id, partner_id),
  INDEX idx_entry_date (entry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
