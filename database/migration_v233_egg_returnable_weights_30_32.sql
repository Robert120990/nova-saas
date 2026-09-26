-- Migración v233: Trazabilidad de Presentaciones de Cubeta (30 LB y 32 LB) en Movimientos de Envases Retornables
-- Añade campos numéricos específicos para clasificar las cubetas según peso facturado (30 LB vs 32 LB),
-- manteniendo el saldo físico de cubetas y tapaderas unificado según la operación física en bodega/ruta.

ALTER TABLE egg_returnable_movements
ADD COLUMN cubetas_30lb_qty INT NOT NULL DEFAULT 0 AFTER cubetas_qty,
ADD COLUMN cubetas_32lb_qty INT NOT NULL DEFAULT 0 AFTER cubetas_30lb_qty;
