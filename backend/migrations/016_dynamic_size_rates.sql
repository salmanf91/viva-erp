-- Drop temporary hardcoded size selling rates from product_config
ALTER TABLE product_config 
  DROP COLUMN selling_rate_s,
  DROP COLUMN selling_rate_m,
  DROP COLUMN selling_rate_l,
  DROP COLUMN selling_rate_xl,
  DROP COLUMN selling_rate_xxl,
  DROP COLUMN selling_rate_xxxl,
  DROP COLUMN selling_rate_xxxxl;

-- Create dynamic size rates table
CREATE TABLE IF NOT EXISTS product_size_rates (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id    INT NOT NULL,
  category     VARCHAR(100) NOT NULL,
  size_label   VARCHAR(50) NOT NULL,
  selling_rate DECIMAL(10,2) NOT NULL,
  UNIQUE KEY uq_tenant_cat_size (tenant_id, category, size_label),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Modify size column in sales_order_items to support longer labels
ALTER TABLE sales_order_items MODIFY COLUMN size VARCHAR(50) NULL DEFAULT NULL;
