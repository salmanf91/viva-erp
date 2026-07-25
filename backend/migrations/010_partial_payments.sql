ALTER TABLE sales_orders
  MODIFY COLUMN status ENUM('pending','partial','paid') NOT NULL DEFAULT 'pending',
  ADD COLUMN amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER status;

-- Backfill: orders already marked 'paid' have full amount paid
UPDATE sales_orders o
SET amount_paid = (
  SELECT COALESCE(SUM(i.quantity * i.rate_per_pc), 0) * (1 + o.gst_percent / 100)
  FROM sales_order_items i WHERE i.order_id = o.id
)
WHERE o.status = 'paid';
