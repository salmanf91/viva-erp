-- Migration to convert category ENUMs to VARCHAR(100)
ALTER TABLE product_config MODIFY category VARCHAR(100) NOT NULL;
ALTER TABLE production_batches MODIFY category VARCHAR(100) NOT NULL;
ALTER TABLE stock_movements MODIFY category VARCHAR(100) NOT NULL;
ALTER TABLE purchase_items MODIFY category VARCHAR(100) NOT NULL;
