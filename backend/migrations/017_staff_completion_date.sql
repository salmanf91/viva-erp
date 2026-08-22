-- Add completion_date to staff_work_entries
ALTER TABLE staff_work_entries 
ADD COLUMN completion_date DATE NULL AFTER completed_pcs;
