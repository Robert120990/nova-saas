-- Migración v121: Ambiente de facturación por sucursal
-- '1' = Pruebas, '2' = Producción (catálogo cat_001_ambiente, mismo formato que companies.ambiente)
-- Por defecto '2' (Producción). La resolución en dte-api verifica primero la sucursal y luego la empresa.
ALTER TABLE branches ADD COLUMN ambiente VARCHAR(10) NOT NULL DEFAULT '2' AFTER codigo_mh;
