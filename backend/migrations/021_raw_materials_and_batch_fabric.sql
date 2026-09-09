-- ============================================================
-- Migration 021: Raw Materials catalog and Batch Fabric tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS raw_materials (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NULL,
  uom VARCHAR(20) DEFAULT 'pcs',
  default_rate DECIMAL(10,2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_raw_mat_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add raw material tracking columns to production_batches if they don't exist
-- Handled dynamically in initDb() or direct statements
