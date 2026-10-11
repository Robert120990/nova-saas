-- Migration v265: Soporte para Factura de Sujeto Excluido (DTE-14) en Gastos y Compras

-- 1. Soporte en tabla 'dtes' para vincular gastos y compras
ALTER TABLE dtes ADD COLUMN gasto_id INT NULL DEFAULT NULL AFTER venta_id;
ALTER TABLE dtes ADD COLUMN compra_id INT NULL DEFAULT NULL AFTER gasto_id;
ALTER TABLE dtes ADD INDEX idx_dtes_gasto_id (company_id, gasto_id);
ALTER TABLE dtes ADD INDEX idx_dtes_compra_id (company_id, compra_id);

-- 2. Soporte en tabla 'expense_headers' para estado DTE
ALTER TABLE expense_headers ADD COLUMN estado_dte VARCHAR(50) NULL DEFAULT NULL AFTER sello_recepcion;

-- 3. Soporte en tabla 'purchase_headers' para código de generación y estado DTE
ALTER TABLE purchase_headers ADD COLUMN codigo_generacion VARCHAR(36) NULL DEFAULT NULL AFTER numero_documento;
ALTER TABLE purchase_headers ADD COLUMN estado_dte VARCHAR(50) NULL DEFAULT NULL AFTER sello_recepcion;

-- 4. Soporte en tabla 'purchase_items' para clasificar Bienes (1) vs Servicios (2)
ALTER TABLE purchase_items ADD COLUMN tipo_item TINYINT NOT NULL DEFAULT 1 AFTER product_id;
