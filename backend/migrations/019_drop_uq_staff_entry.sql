-- Allow multiple size entries per staff member, date, category and work_type
-- Drop rigid unique constraint uq_staff_entry and replace with non-unique lookup index

ALTER TABLE staff_work_entries ADD INDEX IF NOT EXISTS idx_swe_tenant (tenant_id);
ALTER TABLE staff_work_entries ADD INDEX IF NOT EXISTS idx_staff_entry_lookup (tenant_id, staff_id, entry_date, category, work_type);
ALTER TABLE staff_work_entries DROP INDEX IF EXISTS uq_staff_entry;
