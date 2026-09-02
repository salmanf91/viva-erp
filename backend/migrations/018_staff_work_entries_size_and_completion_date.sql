-- Add size and completion_date columns to staff_work_entries
ALTER TABLE staff_work_entries 
  ADD COLUMN IF NOT EXISTS size VARCHAR(50) NULL DEFAULT NULL AFTER category,
  ADD COLUMN IF NOT EXISTS completion_date DATE NULL DEFAULT NULL AFTER completed_pcs;
