-- DTE Indexes for performance
-- Agrega índices en dtes para evitar full table scan en JOINs con OR

-- Nota: idx_dtes_venta_id ya existe previamente
-- Los siguientes índices se crean con verificacion previa via script
-- ALTER TABLE dtes ADD INDEX idx_dtes_company_venta (company_id, venta_id);
-- ALTER TABLE dtes ADD INDEX idx_dtes_company_codigo (company_id, codigo_generacion);

