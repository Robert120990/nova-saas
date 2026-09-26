-- Migración v88: Integración Oficial de Control de Calidad FQ & MB (Mario)
-- Ovoproductos Industriales ANDELSA / Eggcelent

ALTER TABLE egg_lab_micro_logs
    ADD COLUMN IF NOT EXISTS temperature_c DECIMAL(4,1) NULL AFTER ph,
    ADD COLUMN IF NOT EXISTS salinity_pct DECIMAL(5,2) NULL AFTER temperature_c,
    ADD COLUMN IF NOT EXISTS density DECIMAL(6,4) NULL AFTER salinity_pct,
    ADD COLUMN IF NOT EXISTS staph_aureus ENUM('negativo','positivo','ausencia','presencia') DEFAULT 'negativo' AFTER fungi_yeasts_cfu,
    ADD COLUMN IF NOT EXISTS fq_status ENUM('pendiente','aprobado','observacion','rechazado') DEFAULT 'pendiente' AFTER solids_percentage,
    ADD COLUMN IF NOT EXISTS mb_status ENUM('pendiente','en_incubacion','aprobado','rechazado') DEFAULT 'pendiente' AFTER fq_status,
    ADD COLUMN IF NOT EXISTS incubation_started_at DATETIME NULL AFTER mb_status,
    ADD COLUMN IF NOT EXISTS incubation_hours INT DEFAULT 48 AFTER incubation_started_at,
    ADD COLUMN IF NOT EXISTS release_status ENUM('cuarentena','liberado','bloqueado_haccp') DEFAULT 'cuarentena' AFTER mb_status,
    ADD COLUMN IF NOT EXISTS released_at DATETIME NULL AFTER release_status,
    ADD COLUMN IF NOT EXISTS released_by VARCHAR(100) NULL AFTER released_at,
    ADD COLUMN IF NOT EXISTS commercial_lot_code VARCHAR(60) NULL AFTER batch_id;

-- Agregar columna quality_status a empaque de ovoproductos
ALTER TABLE egg_packaging_records
    ADD COLUMN IF NOT EXISTS quality_status ENUM('cuarentena','liberado','bloqueado_haccp') DEFAULT 'cuarentena' AFTER product_state;

-- Sembrar perfiles oficiales de Mario en egg_quality_parameters para todas las empresas activas
INSERT INTO egg_quality_parameters (company_id, category, parameter_name, specification, default_value, unit, applicable_product, expected_criterion, sort_order, is_active)
SELECT c.id, 'fisicoquimico', 'pH (Acidez / Alcalinidad)', '7.00 - 8.00 (Nominal 7.50)', '7.50', 'pH', 'huevo entero', 'CONFORME', 1, 1
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM egg_quality_parameters q WHERE q.company_id = c.id AND q.parameter_name LIKE 'pH%' AND q.applicable_product = 'huevo entero'
);

INSERT INTO egg_quality_parameters (company_id, category, parameter_name, specification, default_value, unit, applicable_product, expected_criterion, sort_order, is_active)
SELECT c.id, 'fisicoquimico', 'Sólidos Totales (%)', '23.70% - 24.70% (Nominal 24.20%)', '24.20', '%', 'huevo entero', 'CONFORME', 2, 1
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM egg_quality_parameters q WHERE q.company_id = c.id AND q.parameter_name LIKE 'Sólidos Totales%' AND q.applicable_product = 'huevo entero'
);

INSERT INTO egg_quality_parameters (company_id, category, parameter_name, specification, default_value, unit, applicable_product, expected_criterion, sort_order, is_active)
SELECT c.id, 'fisicoquimico', 'Densidad', '0.115 - 0.145 (Nominal 0.130)', '0.130', 'g/ml', 'huevo entero', 'CONFORME', 3, 1
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM egg_quality_parameters q WHERE q.company_id = c.id AND q.parameter_name LIKE 'Densidad%' AND q.applicable_product = 'huevo entero'
);

INSERT INTO egg_quality_parameters (company_id, category, parameter_name, specification, default_value, unit, applicable_product, expected_criterion, sort_order, is_active)
SELECT c.id, 'microbiologico', 'Staphylococcus Aureus', 'Negativo / Ausente', 'Negativo', 'UFC/g', 'todos', 'CONFORME', 6, 1
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM egg_quality_parameters q WHERE q.company_id = c.id AND q.parameter_name LIKE 'Staphylococcus%'
);
