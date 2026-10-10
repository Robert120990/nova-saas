-- Migration v264: Agregar columna rrs_num_cheque a purchase_quedans
ALTER TABLE purchase_quedans ADD COLUMN rrs_num_cheque VARCHAR(50) DEFAULT NULL AFTER status;
