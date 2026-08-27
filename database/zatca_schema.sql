-- ============================================================
-- Saudi ZATCA Fatoora E-Invoicing Add-on Schema (Created only if feature_zatca_einvoicing is enabled)
-- ============================================================

CREATE TABLE IF NOT EXISTS zatca_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  vat_registration_number VARCHAR(15) NOT NULL,
  commercial_registration VARCHAR(50) NOT NULL,
  organization_name VARCHAR(255) NOT NULL,
  organization_unit VARCHAR(100) NOT NULL,
  city VARCHAR(100) DEFAULT 'Riyadh',
  country VARCHAR(2) DEFAULT 'SA',
  environment ENUM('sandbox', 'simulation', 'production') DEFAULT 'sandbox',
  
  -- Cryptographic credentials
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
  
  -- ZATCA Security & Hash Chain
  invoice_hash VARCHAR(64) NOT NULL,
  previous_invoice_hash VARCHAR(64) NOT NULL,
  invoice_counter INT NOT NULL,
  qr_code_tlv TEXT NOT NULL,
  signed_xml LONGTEXT NOT NULL,
  
  -- ZATCA API Status
  clearance_status ENUM('not_submitted', 'cleared', 'reported', 'rejected', 'warning') DEFAULT 'not_submitted',
  zatca_response_json JSON,
  cleared_at DATETIME,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE
);
