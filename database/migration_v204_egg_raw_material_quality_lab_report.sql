-- Migración v204: Soporte para Formato Oficial de Calidad LAB 001 en egg_raw_materials
ALTER TABLE egg_raw_materials
    ADD COLUMN quality_lab_report_json JSON NULL AFTER quality_brix,
    ADD COLUMN quality_reviewed_by VARCHAR(150) NULL AFTER quality_inspector_name,
    ADD COLUMN remission_note VARCHAR(100) NULL AFTER provider_lot,
    ADD COLUMN farm_name VARCHAR(150) NULL AFTER remission_note,
    ADD COLUMN production_date DATE NULL AFTER farm_name,
    ADD COLUMN expiration_date DATE NULL AFTER production_date,
    ADD COLUMN sample_egg_weight_g DECIMAL(6,2) NULL AFTER expiration_date;
