-- Migración v167: Acceso definitivo a CRM y Calendario Industrial
-- Corrige enlaces de menús huérfanos, permisos y módulos activos

-- 1. Asegurar grupo raíz Huevo Industrial activo
UPDATE menu_items 
SET permission_key = NULL, is_active = 1, hide_in_menu = 0 
WHERE parent_id IS NULL AND (label = 'Huevo Industrial' OR label LIKE '%Industrial%' OR label LIKE '%Huevo%');

-- 2. Asegurar grupo raíz CRM activo
UPDATE menu_items 
SET permission_key = NULL, is_active = 1, hide_in_menu = 0 
WHERE parent_id IS NULL AND label = 'CRM';

-- 3. Asegurar submenú Calendario de Producción activo
UPDATE menu_items 
SET is_active = 1, hide_in_menu = 0, permission_key = 'manage_production'
WHERE path = '/industrial/calendario';

-- 4. Asegurar submenú Acuerdos con Clientes activo
UPDATE menu_items 
SET is_active = 1, hide_in_menu = 0, permission_key = 'manage_customer_agreements'
WHERE path = '/crm/acuerdos';

-- 5. Vincular Calendario de Producción con el grupo raíz Huevo Industrial
UPDATE menu_items 
SET parent_id = (
    SELECT id FROM (
        SELECT id FROM menu_items 
        WHERE parent_id IS NULL AND (label = 'Huevo Industrial' OR label LIKE '%Industrial%' OR label LIKE '%Huevo%')
        ORDER BY id ASC LIMIT 1
    ) AS tmp_industrial
)
WHERE path = '/industrial/calendario';

-- 6. Vincular Acuerdos con Clientes con el grupo raíz CRM
UPDATE menu_items 
SET parent_id = (
    SELECT id FROM (
        SELECT id FROM menu_items 
        WHERE parent_id IS NULL AND label = 'CRM'
        ORDER BY id ASC LIMIT 1
    ) AS tmp_crm
)
WHERE path = '/crm/acuerdos';
