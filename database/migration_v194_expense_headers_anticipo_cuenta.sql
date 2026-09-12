-- Migración v194: Agregar anticipo_cuenta a expense_headers
ALTER TABLE expense_headers 
    ADD COLUMN anticipo_cuenta DECIMAL(18, 6) DEFAULT 0.000000 AFTER cotrans;
