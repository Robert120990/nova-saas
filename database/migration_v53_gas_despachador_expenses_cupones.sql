-- Migration v53: Add despachador_id to expenses and cupones

ALTER TABLE gas_station_closeout_expenses
ADD COLUMN despachador_id INT NULL AFTER valor,
ADD FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE SET NULL;

ALTER TABLE gas_station_closeout_cupones
ADD COLUMN despachador_id INT NULL AFTER monto,
ADD FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE SET NULL;
