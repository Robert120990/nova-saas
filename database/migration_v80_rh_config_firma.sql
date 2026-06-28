-- Migration v80: Add firma_url to rh_config

ALTER TABLE rh_config ADD COLUMN firma_url VARCHAR(500) AFTER responsable_nombre;
