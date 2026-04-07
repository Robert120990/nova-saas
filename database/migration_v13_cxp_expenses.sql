-- Migración V13: Agregar expense_id a provider_payments
ALTER TABLE provider_payments ADD COLUMN expense_id INT DEFAULT NULL AFTER purchase_id;
ALTER TABLE provider_payments ADD CONSTRAINT fk_provider_payments_expense FOREIGN KEY (expense_id) REFERENCES expense_headers(id) ON DELETE SET NULL;
