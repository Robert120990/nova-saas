-- Migration v268: Agregar codigo_generacion a expense_headers
ALTER TABLE expense_headers 
    ADD COLUMN codigo_generacion VARCHAR(36) NULL DEFAULT NULL AFTER numero_documento;

ALTER TABLE expense_headers 
    ADD INDEX idx_expense_headers_codigo_gen (company_id, codigo_generacion);
