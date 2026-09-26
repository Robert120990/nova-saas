-- Migration v206: Optimización de índices para Customers y Providers
-- Agiliza búsquedas y elimina filesort en catálogos masivos (>25,000 registros)

ALTER TABLE customers ADD INDEX idx_customers_company_nombre (company_id, nombre);
ALTER TABLE customers ADD INDEX idx_customers_company_nit (company_id, nit);
ALTER TABLE customers ADD INDEX idx_customers_company_nrc (company_id, nrc);
ALTER TABLE customers ADD INDEX idx_customers_company_numdoc (company_id, numero_documento);

ALTER TABLE providers ADD INDEX idx_providers_company_nombre (company_id, nombre);
ALTER TABLE providers ADD INDEX idx_providers_company_nit (company_id, nit);
ALTER TABLE providers ADD INDEX idx_providers_company_nrc (company_id, nrc);
