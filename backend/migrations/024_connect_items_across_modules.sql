-- ============================================================
-- Migration 024: Connect Items & Products across Purchases, Stock, Batches, and Sales
-- ============================================================

-- 1. purchase_items: Track specific product ID, SKU code, display name, size, and UOM
ALTER TABLE purchase_items
  ADD COLUMN item_id INT NULL AFTER purchase_id,
  ADD COLUMN item_code VARCHAR(100) NULL AFTER item_id,
  ADD COLUMN item_name VARCHAR(255) NULL AFTER item_code,
  ADD COLUMN size VARCHAR(50) NULL AFTER category,
  ADD COLUMN uom VARCHAR(20) DEFAULT 'pcs' AFTER size;

-- 2. production_batch_items: Track product ID, SKU code, name, and snapshot selling rate
ALTER TABLE production_batch_items
  ADD COLUMN product_id INT NULL AFTER batch_id,
  ADD COLUMN item_code VARCHAR(100) NULL AFTER product_id,
  ADD COLUMN product_name VARCHAR(255) NULL AFTER item_code,
  ADD COLUMN selling_rate DECIMAL(10,2) NULL AFTER quantity;

-- 3. sales_order_items: Track product ID and SKU code
ALTER TABLE sales_order_items
  ADD COLUMN product_id INT NULL AFTER order_id,
  ADD COLUMN item_code VARCHAR(100) NULL AFTER product_id,
  ADD COLUMN item_name VARCHAR(255) NULL AFTER item_code;

-- 4. stock_movements: Track product ID, SKU code, name, size, and unit rate
ALTER TABLE stock_movements
  ADD COLUMN product_id INT NULL AFTER vendor_id,
  ADD COLUMN item_code VARCHAR(100) NULL AFTER product_id,
  ADD COLUMN item_name VARCHAR(255) NULL AFTER item_code,
  ADD COLUMN size VARCHAR(50) NULL AFTER category,
  ADD COLUMN unit_rate DECIMAL(10,2) NULL AFTER quantity;

