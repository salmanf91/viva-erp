-- ============================================================
-- Garment Production Add-on Schema (Created only if feature_garment_production is enabled)
-- ============================================================

CREATE TABLE IF NOT EXISTS production_batches (
  id INT PRIMARY KEY AUTO_INCREMENT,
  batch_number VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(100) NOT NULL,
  quantity INT NOT NULL,
  cut_rate DECIMAL(10,2) DEFAULT 0,
  stitch_rate DECIMAL(10,2) DEFAULT 0,
  status ENUM('allocated','cutting','stitching','finished') DEFAULT 'allocated',
  batch_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS production_batch_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  batch_id INT NOT NULL,
  size_label VARCHAR(50) NOT NULL,
  quantity INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES production_batches(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS staff_work_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  staff_id INT NOT NULL,
  batch_id INT NOT NULL,
  pieces INT NOT NULL,
  rate DECIMAL(10,2) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  log_date DATE NOT NULL,
  is_settled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES production_batches(id) ON DELETE CASCADE
);
