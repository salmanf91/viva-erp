-- Sales module: clients, orders, items

CREATE TABLE IF NOT EXISTS clients (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT          NOT NULL,
  name        VARCHAR(200) NOT NULL,
  phone       VARCHAR(20),
  address     TEXT,
  city        VARCHAR(100),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_client_tenant (tenant_id)
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id      INT          NOT NULL,
  client_id      INT          NOT NULL,
  invoice_number VARCHAR(50)  NOT NULL,
  order_date     DATE         NOT NULL,
  status         ENUM('pending','paid') DEFAULT 'pending',
  include_gst    TINYINT(1)   DEFAULT 0,
  gst_percent    DECIMAL(5,2) DEFAULT 0,
  notes          TEXT,
  paid_at        TIMESTAMP    NULL,
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_invoice (tenant_id, invoice_number),
  INDEX idx_order_tenant (tenant_id),
  INDEX idx_order_client (client_id)
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  order_id    INT            NOT NULL,
  category    VARCHAR(100)   NOT NULL,
  quantity    INT            NOT NULL,
  rate_per_pc DECIMAL(10,2)  NOT NULL,
  INDEX idx_item_order (order_id)
);
