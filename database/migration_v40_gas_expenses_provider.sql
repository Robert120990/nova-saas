-- Migration v40: Add provider_id to gas_station_closeout_expenses

ALTER TABLE gas_station_closeout_expenses
ADD COLUMN provider_id INT NULL AFTER proveedor,
ADD FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE SET NULL;
