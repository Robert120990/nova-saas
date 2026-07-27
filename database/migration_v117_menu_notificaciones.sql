-- Migration v117: Add missing notification and log-viewer menu items

-- 1. Bandeja de Notificaciones under Seguridad
INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
SELECT id, 'Bandeja de Notificaciones', '/notificaciones', 'Bell', 'view_notifications', 7, TRUE, FALSE
FROM menu_items
WHERE label = 'Seguridad' AND parent_id IS NULL
LIMIT 1;

-- 2. Visor de Logs under Configuración
INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
SELECT id, 'Visor de Logs', '/configuracion/logs', 'ScrollText', 'view_logs', 4, TRUE, FALSE
FROM menu_items
WHERE label = 'Configuración' AND parent_id IS NULL
LIMIT 1;

-- 3. Notificaciones under Configuración
INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
SELECT id, 'Notificaciones', '/configuracion/notificaciones', 'Bell', 'manage_notifications', 5, TRUE, FALSE
FROM menu_items
WHERE label = 'Configuración' AND parent_id IS NULL
LIMIT 1;

-- 4. WhatsApp under Configuración
INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
SELECT id, 'WhatsApp', '/configuracion/whatsapp', 'MessageCircle', 'manage_whatsapp', 6, TRUE, FALSE
FROM menu_items
WHERE label = 'Configuración' AND parent_id IS NULL
LIMIT 1;
