-- Migration to add size-specific selling rates to product_config and size to sales_order_items
ALTER TABLE product_config 
  ADD COLUMN selling_rate_s DECIMAL(10,2) NULL DEFAULT NULL,
  ADD COLUMN selling_rate_m DECIMAL(10,2) NULL DEFAULT NULL,
  ADD COLUMN selling_rate_l DECIMAL(10,2) NULL DEFAULT NULL,
  ADD COLUMN selling_rate_xl DECIMAL(10,2) NULL DEFAULT NULL,
  ADD COLUMN selling_rate_xxl DECIMAL(10,2) NULL DEFAULT NULL,
  ADD COLUMN selling_rate_xxxl DECIMAL(10,2) NULL DEFAULT NULL,
  ADD COLUMN selling_rate_xxxxl DECIMAL(10,2) NULL DEFAULT NULL;

ALTER TABLE sales_order_items 
  ADD COLUMN size VARCHAR(20) NULL DEFAULT NULL;
