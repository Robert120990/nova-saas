-- Migration v122: Backfill gas_station_settings globales (branch_id IS NULL) a cada sucursal
-- Las filas creadas antes de la migración v48 quedaron huérfanas: ningún usuario con sucursal las lee.

INSERT INTO gas_station_settings (company_id, branch_id, setting_key, setting_value, created_at, updated_at)
SELECT gs.company_id, b.id, gs.setting_key, gs.setting_value, NOW(), NOW()
FROM gas_station_settings gs
JOIN branches b ON b.company_id = gs.company_id
WHERE gs.branch_id IS NULL
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW();
