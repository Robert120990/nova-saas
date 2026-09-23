-- Migración v227: Índices de rendimiento para Kárdex, Ventas y Compras
-- Tabla: inventory_movements
ALTER TABLE inventory_movements ADD INDEX idx_mov_prod_branch_date (product_id, branch_id, created_at DESC);
ALTER TABLE inventory_movements ADD INDEX idx_mov_origin (tipo_documento, documento_id);

-- Tabla: sales_headers
ALTER TABLE sales_headers ADD INDEX idx_sales_company_fecha (company_id, fecha_emision);

-- Tabla: purchase_headers
ALTER TABLE purchase_headers ADD INDEX idx_purchases_company_fecha (company_id, fecha);
