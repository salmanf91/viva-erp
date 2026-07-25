ALTER TABLE capital_payments
  ADD COLUMN type   ENUM('investment','drawing') NOT NULL DEFAULT 'investment' AFTER amount,
  ADD COLUMN source VARCHAR(100) NULL AFTER type;

-- source for investments: 'own', 'external_credit', 'income'
-- source for drawings:    'personal', 'expense_repay', 'loan_repay', 'other'
