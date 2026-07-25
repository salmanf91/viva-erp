-- Tracks accessory purchases (zip, thread, canvas, plastic, lace)
-- cost_per_unit is derived: total_cost / qty_purchased
-- yield_pcs = how many nighties one unit covers (e.g. thread spool = 20)
CREATE TABLE IF NOT EXISTS accessory_costs (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id     INT NOT NULL,
  accessory     VARCHAR(50)    NOT NULL,   -- zip | thread | canvas | plastic | lace
  qty_purchased DECIMAL(10,2)  NOT NULL,
  unit          VARCHAR(20)    NOT NULL,   -- pcs | spools | rolls
  total_cost    DECIMAL(10,2)  NOT NULL,
  yield_pcs     INT            NOT NULL DEFAULT 1,  -- units of nighty per purchased unit
  purchase_date DATE           NOT NULL,
  note          VARCHAR(255),
  created_at    TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant_acc (tenant_id, accessory),
  INDEX idx_tenant_date (tenant_id, purchase_date)
);
