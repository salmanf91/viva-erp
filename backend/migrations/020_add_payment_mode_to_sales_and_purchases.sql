-- Add payment_mode column to sales_payments and purchases tables

ALTER TABLE sales_payments
  ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) NOT NULL DEFAULT 'cash' AFTER payment_date;

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) NOT NULL DEFAULT 'cash' AFTER advance_paid;
