-- Migración v230: Permiso especial para edición de lotes de producción/pasteurización, cierre de pasteurización y reapertura de envasado
-- 1. Columnas en egg_production_batches
ALTER TABLE egg_production_batches ADD COLUMN pasteurization_lot VARCHAR(100) NULL AFTER batch_code_display;
ALTER TABLE egg_production_batches ADD COLUMN pasteurization_status ENUM('pendiente', 'en_proceso', 'pasteurizado', 'cerrado') NOT NULL DEFAULT 'pendiente' AFTER status;
ALTER TABLE egg_production_batches ADD COLUMN pasteurization_closed_at DATETIME NULL AFTER completed_at;
ALTER TABLE egg_production_batches ADD COLUMN pasteurization_closed_by VARCHAR(150) NULL AFTER pasteurization_closed_at;

-- 2. Columna en egg_pasteurization_logs
ALTER TABLE egg_pasteurization_logs ADD COLUMN pasteurization_lot VARCHAR(100) NULL AFTER batch_id;

-- 3. Insertar nuevo permiso en menu_items para matriz de roles (permiso especial oculto del menú)
INSERT INTO menu_items (label, path, icon, permission_key, parent_id, sort_order, is_active, hide_in_menu)
SELECT 'Editar Lotes y Cierre Pasteurización', NULL, 'Layers', 'manage_egg_production_lots', 67, 99, 1, 1
WHERE NOT EXISTS (
    SELECT 1 FROM menu_items WHERE permission_key = 'manage_egg_production_lots'
);

-- 4. Actualizar roles de SuperAdmin y Admin para asignar el nuevo permiso
UPDATE roles 
SET permissions = JSON_ARRAY_APPEND(
    permissions, 
    '$', 
    'manage_egg_production_lots'
)
WHERE id IN (1, 2) 
  AND NOT JSON_CONTAINS(permissions, '"manage_egg_production_lots"');
