-- Migration v114: Asegurar columna actividad_economica en companies
-- Algunas bases de datos pueden no tener esta columna si se crearon desde un schema anterior

SET @dbname = (SELECT DATABASE());
SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'actividad_economica');

SET @sql = IF(@exists = 0,
    'ALTER TABLE companies ADD COLUMN actividad_economica TEXT DEFAULT NULL AFTER nombre_comercial',
    'SELECT 1 AS already_exists'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
