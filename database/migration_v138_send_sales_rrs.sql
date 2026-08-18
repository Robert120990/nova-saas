-- Migration v138: Permiso especial 'send_sales_rrs' (hidden menu item bajo Corte de Caja)
-- No se asigna a ningún rol; queda disponible para asignarlo manualmente desde Roles.
INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
SELECT id, 'Enviar Ventas a RRS', NULL, 'CloudUpload', 'send_sales_rrs', 100, TRUE, TRUE
FROM menu_items WHERE label = 'Corte de Caja' LIMIT 1;