ALTER TABLE expenses
  ADD COLUMN reimbursed_at DATETIME NULL AFTER qty_purchased,
  ADD COLUMN reimbursed_by VARCHAR(100) NULL AFTER reimbursed_at;
