-- Migration v55: Add despachador_id to remesas

ALTER TABLE gas_station_closeout_remesas
ADD COLUMN despachador_id INT NULL AFTER descripcion,
ADD FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE SET NULL;
