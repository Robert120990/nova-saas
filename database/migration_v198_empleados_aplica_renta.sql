-- Migration v198: Agregar columna aplica_renta a rh_empleados
-- Permite controlar por empleado si se le descuenta renta en la segunda quincena

ALTER TABLE rh_empleados
ADD COLUMN IF NOT EXISTS aplica_renta TINYINT NOT NULL DEFAULT 1
    COMMENT 'Si 1, se aplica descuento de renta en 2da quincena. Si 0, no se aplica renta.'
    AFTER es_jubilado;
