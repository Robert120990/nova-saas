-- Migration v37: Add tipo column to gas_station_nozzles
-- A=Autoservicio, C=Servicio completo, M=Combustible master
ALTER TABLE gas_station_nozzles
ADD COLUMN tipo CHAR(1) NOT NULL DEFAULT 'C' AFTER descripcion;
