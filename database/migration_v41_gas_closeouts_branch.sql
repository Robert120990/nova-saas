-- Migration v41: Add branch_id to gas_station_closeouts

ALTER TABLE gas_station_closeouts
ADD COLUMN branch_id INT NULL AFTER company_id,
ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
