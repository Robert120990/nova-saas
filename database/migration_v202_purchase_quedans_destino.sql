-- Migration v202: Agregar columna destino a purchase_quedans (Default 'T' = Tienda)
ALTER TABLE purchase_quedans
    ADD COLUMN destino CHAR(1) NOT NULL DEFAULT 'T' COMMENT 'P = Pista, T = Tienda' AFTER dias_credito,
    ADD INDEX idx_destino (destino);
