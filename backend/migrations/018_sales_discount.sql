-- Add discount fields to sales_orders
ALTER TABLE sales_orders
  ADD COLUMN discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER gst_percent,
  ADD COLUMN discount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER discount_percent;
