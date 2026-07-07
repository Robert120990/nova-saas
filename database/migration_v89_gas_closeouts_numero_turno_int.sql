-- Migration v89: Change numero_turno from VARCHAR(20) to INT
-- This ensures consistent numeric comparison across the codebase

ALTER TABLE gas_station_closeouts MODIFY COLUMN numero_turno INT NOT NULL;
