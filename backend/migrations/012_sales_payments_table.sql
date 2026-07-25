CREATE TABLE sales_payments (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id    INT NOT NULL,
  order_id     INT NOT NULL,
  amount       DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id)  REFERENCES sales_orders(id) ON DELETE CASCADE
);

-- Backfill existing payments
INSERT INTO sales_payments (tenant_id, order_id, amount, payment_date)
SELECT tenant_id, id, amount_paid, COALESCE(paid_at, order_date)
FROM sales_orders
WHERE amount_paid > 0;
