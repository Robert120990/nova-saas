-- Migración v227: Mejoras en flujo de materia prima y producción de huevo industrial
-- 1. Ampliar ENUM de status en egg_raw_materials para incluir 'pendiente_aprobacion' como valor por defecto
ALTER TABLE egg_raw_materials 
    MODIFY COLUMN status ENUM('pendiente_aprobacion', 'aprobado', 'cuarentena', 'rechazado', 'anulado') 
    NOT NULL DEFAULT 'pendiente_aprobacion';

-- 2. Modificar columnas product_type y presentation en egg_production_batches para admitir múltiples fórmulas y presentaciones
ALTER TABLE egg_production_batches 
    MODIFY COLUMN product_type VARCHAR(255) NOT NULL DEFAULT 'huevo entero',
    MODIFY COLUMN presentation VARCHAR(255) NOT NULL DEFAULT 'cubeta 30LB';
