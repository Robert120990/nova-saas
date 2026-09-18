-- Migración v205: Soporte para Facturación Automática de Rutas de Despacho de Ovoproductos
-- Agrega columna sale_id para vincular pedidos y paradas con sales_headers e impedir refacturaciones.

-- 1. Columna sale_id en egg_dispatch_stops
ALTER TABLE egg_dispatch_stops
ADD COLUMN sale_id INT NULL AFTER dte_codigo_generacion,
ADD INDEX idx_eds_sale (sale_id);

-- 2. Columna sale_id en egg_customer_orders
ALTER TABLE egg_customer_orders
ADD COLUMN sale_id INT NULL AFTER dte_codigo_generacion,
ADD INDEX idx_eco_sale (sale_id);
