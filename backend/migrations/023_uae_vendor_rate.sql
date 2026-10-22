-- Migration 023: Add UAE vendor rate column to product_showcase for Viva Studio UAE export catalog
ALTER TABLE product_showcase 
ADD COLUMN IF NOT EXISTS uae_vendor_rate DECIMAL(12,2) NOT NULL DEFAULT 0.00 
AFTER retail_customer_rate;
