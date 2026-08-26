-- Migration v149: Generacion automatica de partidas de ventas/compras
-- 1) Tipos de partida nuevos (entry_types es global desde v142)
INSERT IGNORE INTO entry_types (code, name) VALUES
    ('VENTAS', 'Partida de Ventas'),
    ('COMPRAS', 'Partida de Compras');

-- 2) Columna auxiliar de cuenta contable por cliente/proveedor
--    (los ALTER se ejecutan condicionalmente en el runner)

-- 3) Menu "Contabilizar" como grupo con hijo unico "Ventas/Compras"
INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active)
SELECT 21, 'Contabilizar', NULL, 'Calculator', NULL, 2, 1
WHERE NOT EXISTS (SELECT 1 FROM (SELECT 1 FROM menu_items WHERE label = 'Contabilizar' AND parent_id = 21 AND path IS NULL) x);

SET @contabilizar_id = (SELECT id FROM menu_items WHERE label = 'Contabilizar' AND parent_id = 21 AND path IS NULL LIMIT 1);

INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active)
SELECT @contabilizar_id, 'Ventas/Compras', '/contabilidad/contabilizar', 'Calculator', 'manage_accounting_entries', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM (SELECT 1 FROM menu_items WHERE path = '/contabilidad/contabilizar') x);

