ALTER TABLE gas_station_remesa_deliveries
    ADD COLUMN entregado TINYINT(1) NOT NULL DEFAULT 0 AFTER comentario;
