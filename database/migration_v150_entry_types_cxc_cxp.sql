-- Migration v150: Partidas automaticas de CxC (cobranzas) y CxP (pagos)
INSERT IGNORE INTO entry_types (code, name) VALUES
    ('CXC', 'Partida de Cobranzas'),
    ('CXP', 'Partida de Pagos');

-- Hijo "CxC/CxP" bajo el grupo Contabilizar
SET @contabilizar_id = (SELECT id FROM menu_items WHERE label = 'Contabilizar' AND parent_id = 21 AND path IS NULL LIMIT 1);

INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active)
SELECT @contabilizar_id, 'CxC/CxP', '/contabilidad/contabilizar/cxc-cxp', 'Calculator', 'manage_accounting_entries', 2, 1
WHERE @contabilizar_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM (SELECT 1 FROM menu_items WHERE path = '/contabilidad/contabilizar/cxc-cxp') x);
