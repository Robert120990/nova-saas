ALTER TABLE gas_station_tanks
ADD COLUMN tipo_combustible INT DEFAULT 0
COMMENT '0: Ninguno, 1: Regular, 2: Especial, 3: Diesel'
AFTER reserva;
