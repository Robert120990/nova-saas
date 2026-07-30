-- Migration v100: Agregar permiso 'manage_shifts_edit' como hidden menu item bajo Corte de Caja
INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
SELECT id, 'Editar Turnos', NULL, 'Edit', 'manage_shifts_edit', 99, TRUE, TRUE
FROM menu_items WHERE label = 'Corte de Caja' LIMIT 1;
