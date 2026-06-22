-- Migration v54: Add despachador_id to descuentos and adelantos

ALTER TABLE gas_station_closeout_descuentos
ADD COLUMN despachador_id INT NULL AFTER total,
ADD FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE SET NULL;

ALTER TABLE gas_station_closeout_adelantos
ADD COLUMN despachador_id INT NULL AFTER monto,
ADD FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE SET NULL;
