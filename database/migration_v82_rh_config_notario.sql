-- Migration v82: Add notario fields to rh_config

ALTER TABLE rh_config ADD COLUMN notario_nombre VARCHAR(255) AFTER sello_url;
ALTER TABLE rh_config ADD COLUMN notario_domicilio VARCHAR(255) AFTER notario_nombre;
ALTER TABLE rh_config ADD COLUMN notario_departamento VARCHAR(255) AFTER notario_domicilio;
