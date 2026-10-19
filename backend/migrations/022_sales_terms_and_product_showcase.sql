-- Add terms_conditions to sales_orders
ALTER TABLE sales_orders ADD COLUMN terms_conditions TEXT NULL;

-- Create product_showcase table for digital catalog & multi-tier pricing
CREATE TABLE IF NOT EXISTS product_showcase (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL DEFAULT 1,
  name VARCHAR(255) NOT NULL,
  item_code VARCHAR(100) NULL,
  category VARCHAR(100) NULL,
  description TEXT NULL,
  image_url LONGTEXT NULL,
  product_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  expense DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  wholesale_rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  retail_vendor_rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  retail_customer_rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  uom VARCHAR(50) DEFAULT 'pcs',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_showcase (tenant_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
