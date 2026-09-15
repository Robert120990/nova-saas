-- migration_v184_purchase_items_nullable_product_and_description.sql
-- Permite que purchase_items tenga product_id NULL y agrega columna descripcion

ALTER TABLE purchase_items MODIFY COLUMN product_id INT NULL;

SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'purchase_items' 
      AND COLUMN_NAME = 'descripcion'
);

SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE purchase_items ADD COLUMN descripcion VARCHAR(255) NULL AFTER product_id', 
    'SELECT "Column descripcion already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
