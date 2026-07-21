-- Migration v112: Add view_amounts as hidden menu item under Seguridad
-- This makes the permission appear as a checkbox in the role editor UI

INSERT INTO menu_items (parent_id, label, path, icon, permission_key, extra_permissions, sort_order, is_active, hide_in_menu)
SELECT id, 'Ver Montos', NULL, 'Eye', 'view_amounts', NULL, 99, TRUE, TRUE
FROM menu_items
WHERE label = 'Seguridad' AND parent_id IS NULL
LIMIT 1;
