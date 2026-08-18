-- v140: Control de Pozo - cierre de cortes y odometro final manual
-- 1) estado: 'abierto' | 'cerrado' - al cerrar un corte no puede editarse ni eliminarse
-- 2) odometro_final_manual: valor manual del odometro final a nivel de corte (no afecta despachos)
-- Nota: el pendiente de entrega de efectivo se calcula (cortes - entregas registradas), sin flag en cortes.

ALTER TABLE pozo_cortes
  ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'abierto' AFTER encargado,
  ADD COLUMN odometro_final_manual DECIMAL(12,2) NULL AFTER estado;

-- Permiso especial 'close_pozo_cortes' (hidden menu item bajo Control de Pozo)
-- No se asigna a ningún rol; queda disponible para asignarlo manualmente desde Roles.
INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
SELECT parent_id, 'Cerrar/Reabrir Cortes de Pozo', NULL, 'Lock', 'close_pozo_cortes', 100, TRUE, TRUE
FROM menu_items WHERE path = '/pozo/corte' LIMIT 1;