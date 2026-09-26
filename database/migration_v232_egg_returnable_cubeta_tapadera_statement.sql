-- Migración v232: Control Integral de Cubetas y Tapaderas Retornables y Estado de Cuenta por Cliente
-- Permite separar el saldo de Cubetas del saldo de Tapaderas y registrar movimientos vinculados a Facturas (sales_headers).

-- 1. Ampliar egg_returnable_packaging con soporte para Tapaderas
ALTER TABLE egg_returnable_packaging
ADD COLUMN initial_tapaderas INT NOT NULL DEFAULT 0 AFTER returned_qty,
ADD COLUMN delivered_tapaderas INT NOT NULL DEFAULT 0 AFTER initial_tapaderas,
ADD COLUMN returned_tapaderas INT NOT NULL DEFAULT 0 AFTER delivered_tapaderas,
ADD COLUMN current_tapaderas INT GENERATED ALWAYS AS (initial_tapaderas + delivered_tapaderas - returned_tapaderas) STORED AFTER returned_tapaderas;

-- 2. Ampliar egg_returnable_movements con cubetas_qty, tapaderas_qty, sale_id y movement_date
ALTER TABLE egg_returnable_movements
ADD COLUMN sale_id INT NULL AFTER returnable_id,
ADD COLUMN cubetas_qty INT NOT NULL DEFAULT 0 AFTER quantity,
ADD COLUMN tapaderas_qty INT NOT NULL DEFAULT 0 AFTER cubetas_qty,
ADD COLUMN movement_date DATE NULL AFTER tapaderas_qty,
ADD INDEX idx_erm_sale (sale_id),
ADD INDEX idx_erm_date (movement_date);
