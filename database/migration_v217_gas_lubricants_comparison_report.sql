-- Migration v217: Menu item and permissions for Gas Lubricants Comparison Report
-- Module: Gasolinera > Reportes > Comparativo Lubricantes
-- Permission Key: view_gas_lubricants_comparison_report

INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
SELECT 
    m.id AS parent_id,
    'Comparativo Lubricantes' AS label,
    '/gas-station/reporte-comparativo-lubricantes' AS path,
    'GitCompare' AS icon,
    'view_gas_lubricants_comparison_report' AS permission_key,
    11 AS sort_order,
    1 AS is_active,
    0 AS hide_in_menu
FROM menu_items m
WHERE m.label = 'Reportes' 
  AND m.parent_id = (SELECT id FROM menu_items WHERE label = 'Gasolinera' AND parent_id IS NULL LIMIT 1)
LIMIT 1
ON DUPLICATE KEY UPDATE 
    label = VALUES(label),
    path = VALUES(path),
    icon = VALUES(icon),
    sort_order = VALUES(sort_order);
