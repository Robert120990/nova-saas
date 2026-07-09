ALTER TABLE gas_station_closeouts
ADD COLUMN rrs_enviado_at TIMESTAMP NULL DEFAULT NULL AFTER closed_at;
