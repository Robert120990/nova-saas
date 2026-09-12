-- Migración v193: Agregar num_quedan a purchase_headers
ALTER TABLE purchase_headers 
    ADD COLUMN num_quedan VARCHAR(50) NULL DEFAULT NULL AFTER observaciones;
