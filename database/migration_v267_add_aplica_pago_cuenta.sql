ALTER TABLE tax_configurations 
ADD COLUMN aplica_pago_cuenta BOOLEAN NOT NULL DEFAULT TRUE 
AFTER compras_afectan_libro_compras;

-- Asegurar registro inicial para personas naturales de servicios profesionales (como JOSUE ROBERTO ORELLANA) con Pago a Cuenta deshabilitado
INSERT INTO tax_configurations (company_id, iva_rate, fovial_rate, cotrans_rate, retencion_rate, percepcion_rate, compras_afectan_libro_compras, aplica_pago_cuenta)
SELECT id, 13.00, 0.20, 0.10, 1.00, 1.00, 0, 0
FROM companies
WHERE tipo_persona = '1' AND (codigo_actividad = '62010' OR razon_social LIKE '%JOSUE%')
ON DUPLICATE KEY UPDATE aplica_pago_cuenta = 0;
