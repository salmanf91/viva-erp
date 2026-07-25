-- Add paid_by column to expenses table
ALTER TABLE expenses ADD COLUMN paid_by VARCHAR(100) NULL AFTER note;
