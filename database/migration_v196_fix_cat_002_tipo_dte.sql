-- Migration v196: Corregir catálogo oficial MH CAT-002 (Tipos de DTE) y alinear compras históricas

-- 1. Vaciar y repoblar cat_002_tipo_dte con la normativa oficial del Ministerio de Hacienda (CAT-002)
DELETE FROM cat_002_tipo_dte;

INSERT INTO cat_002_tipo_dte (code, description) VALUES
('01', 'Factura Electrónica'),
('03', 'Comprobante de Crédito Fiscal Electrónico'),
('04', 'Nota de Remisión Electrónica'),
('05', 'Nota de Crédito Electrónica'),
('06', 'Nota de Débito Electrónica'),
('07', 'Comprobante de Retención Electrónico'),
('08', 'Comprobante de Liquidación Electrónico'),
('09', 'Documento Contable de Liquidación Electrónico'),
('11', 'Factura de Exportación Electrónica'),
('14', 'Factura de Sujeto Excluido Electrónica'),
('15', 'Comprobante de Donación Electrónico');

-- 2. Migrar las 8 compras históricas registradas erróneamente como '06' a '05' (Nota de Crédito oficial)
UPDATE purchase_headers 
SET tipo_documento_id = '05' 
WHERE id IN (33, 74, 76, 102, 123, 143, 149, 157) AND tipo_documento_id = '06';

-- 3. Migrar la compra histórica registrada erróneamente como '05' a '04' (Nota de Remisión oficial)
UPDATE purchase_headers 
SET tipo_documento_id = '04' 
WHERE id = 155 AND tipo_documento_id = '05';
