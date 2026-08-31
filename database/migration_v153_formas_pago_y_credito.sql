-- Migration v153: Códigos oficiales de Forma de Pago (Cat-017) + plazos de crédito

-- 1. Reescribir cat_017_forma_pago con los 12 códigos oficiales del Catálogo 017 de Hacienda
CREATE TABLE IF NOT EXISTS cat_017_forma_pago (code VARCHAR(10) PRIMARY KEY, description VARCHAR(255));
DELETE FROM cat_017_forma_pago;
INSERT INTO cat_017_forma_pago (code, description) VALUES
  ('01', 'Billetes y monedas'),
  ('02', 'Tarjeta de débito'),
  ('03', 'Tarjeta de crédito'),
  ('04', 'Cheque'),
  ('05', 'Transferencia - Depósito bancario'),
  ('08', 'Dinero electrónico'),
  ('09', 'Monedero electrónico'),
  ('11', 'Bitcoin'),
  ('12', 'Otras Criptomonedas'),
  ('13', 'Cuentas por pagar del receptor'),
  ('14', 'Giro bancario'),
  ('99', 'Otros (se debe indicar el medio de pago)');

-- 2. Crear cat_018_plazo (Días, Meses, Años) si no existe
CREATE TABLE IF NOT EXISTS cat_018_plazo (code VARCHAR(10) PRIMARY KEY, description VARCHAR(255));
DELETE FROM cat_018_plazo;
INSERT INTO cat_018_plazo (code, description) VALUES
  ('01', 'Días'),
  ('02', 'Meses'),
  ('03', 'Años');

-- 3. Migrar sales_payments.metodo_pago de códigos internos viejos a los oficiales Cat-017
--    10 (Cheque) -> 04 | 20 (Transferencia) -> 05 | 30 (Vales) -> 99 (Otros)
--    01/02/03/99 se conservan igual (ya coinciden o se mantienen).
UPDATE sales_payments SET metodo_pago = '04' WHERE metodo_pago = '10';
UPDATE sales_payments SET metodo_pago = '05' WHERE metodo_pago = '20';
UPDATE sales_payments SET metodo_pago = '99' WHERE metodo_pago = '30';

-- 4. Columna días de crédito en customers (por defecto 15)
ALTER TABLE customers
  ADD COLUMN dias_credito INT NOT NULL DEFAULT 15;
