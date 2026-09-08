-- migration_v105_rh_descuentos_cuenta.sql
-- Add cuenta_id to rh_descuentos_programados to link scheduled discounts with payroll accounts

ALTER TABLE rh_descuentos_programados 
ADD COLUMN IF NOT EXISTS cuenta_id INT NULL AFTER company_id;

-- Add foreign key constraint if not exists
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.table_constraints 
    WHERE table_schema = DATABASE() 
      AND table_name = 'rh_descuentos_programados' 
      AND constraint_name = 'fk_rh_descuentos_cuenta'
);

SET @sql = IF(@fk_exists = 0, 
    'ALTER TABLE rh_descuentos_programados ADD CONSTRAINT fk_rh_descuentos_cuenta FOREIGN KEY (cuenta_id) REFERENCES rh_cuentas_planillas(id) ON DELETE SET NULL;', 
    'SELECT "FK already exists";'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Link existing discounts to their corresponding accounts
-- 1. 'Pago de Prestamo' -> Cuenta '09' (PRESTAMOS)
UPDATE rh_descuentos_programados dp
JOIN rh_cuentas_planillas cp ON cp.company_id = dp.company_id AND cp.codigo = '09'
SET dp.cuenta_id = cp.id
WHERE dp.codigo = '01' OR LOWER(dp.descripcion) LIKE '%prestamo%';

-- 2. Insert standard discounts if they don't exist for company_id = 1
INSERT INTO rh_descuentos_programados (company_id, codigo, descripcion, cuenta_id)
SELECT 1, '02', 'Descuento de Procuraduría', cp.id
FROM rh_cuentas_planillas cp
WHERE cp.company_id = 1 AND cp.codigo = '10'
AND NOT EXISTS (
    SELECT 1 FROM rh_descuentos_programados WHERE company_id = 1 AND codigo = '02'
);

INSERT INTO rh_descuentos_programados (company_id, codigo, descripcion, cuenta_id)
SELECT 1, '03', 'Fondo Social para la Vivienda', cp.id
FROM rh_cuentas_planillas cp
WHERE cp.company_id = 1 AND cp.codigo = '12'
AND NOT EXISTS (
    SELECT 1 FROM rh_descuentos_programados WHERE company_id = 1 AND codigo = '03'
);

INSERT INTO rh_descuentos_programados (company_id, codigo, descripcion, cuenta_id)
SELECT 1, '04', 'Anticipos de Sueldo', cp.id
FROM rh_cuentas_planillas cp
WHERE cp.company_id = 1 AND cp.codigo = '06'
AND NOT EXISTS (
    SELECT 1 FROM rh_descuentos_programados WHERE company_id = 1 AND codigo = '04'
);
