-- Migración v181: Agregar numero_control y sello_recepcion a purchase_headers
ALTER TABLE purchase_headers 
    ADD COLUMN numero_control VARCHAR(100) NULL DEFAULT NULL AFTER numero_documento,
    ADD COLUMN sello_recepcion VARCHAR(255) NULL DEFAULT NULL AFTER numero_control;
