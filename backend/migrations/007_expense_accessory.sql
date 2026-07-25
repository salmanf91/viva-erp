-- Tag expense reasons with an accessory type (zip | thread | canvas | plastic | lace)
ALTER TABLE expense_reasons ADD COLUMN accessory_type VARCHAR(50) NULL AFTER category;

-- Store qty when an accessory expense is logged
ALTER TABLE expenses ADD COLUMN qty_purchased DECIMAL(10,2) NULL AFTER paid_by;
