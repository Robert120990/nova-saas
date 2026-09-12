-- Migración v195: Agregar monto_sujeto a expense_headers
ALTER TABLE expense_headers 
    ADD COLUMN monto_sujeto DECIMAL(18, 6) DEFAULT 0.000000 AFTER anticipo_cuenta;
