ALTER TABLE dte_contingencies ADD COLUMN company_id INT AFTER id;
ALTER TABLE dte_contingencies ADD COLUMN branch_id INT AFTER company_id;
ALTER TABLE dte_contingencies ADD COLUMN tipo_contingencia INT DEFAULT 1 AFTER motivo;

ALTER TABLE dte_contingency_documents ADD COLUMN retry_count INT DEFAULT 0 AFTER estado_envio;
ALTER TABLE dte_contingency_documents ADD COLUMN last_error TEXT AFTER retry_count;
