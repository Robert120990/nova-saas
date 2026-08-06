ALTER TABLE gas_station_remesa_deliveries
    ADD COLUMN referencia VARCHAR(50) NOT NULL DEFAULT '' AFTER comentario;
