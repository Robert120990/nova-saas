-- Migration v151: Correlativos de partidas contables
CREATE TABLE IF NOT EXISTS accounting_entry_correlativos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    entry_type_id INT NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL,
    current_number INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_correlativo (company_id, entry_type_id, year, month)
);

-- Menu "Correlativos de Partidas"
INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active)
SELECT 21, 'Correlativos de Partidas', '/contabilidad/correlativos', 'RefreshCcw', 'manage_accounting_entries', 7, 1
WHERE NOT EXISTS (SELECT 1 FROM (SELECT 1 FROM menu_items WHERE path = '/contabilidad/correlativos') x);
