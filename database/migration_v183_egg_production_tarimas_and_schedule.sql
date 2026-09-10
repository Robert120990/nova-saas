-- ============================================================================
-- MIGRACIÓN V183: DETALLE DE TARIMAS EN PRODUCCIÓN Y VÍNCULO CON CALENDARIO
-- ============================================================================

-- 1. Soporte de tarimas desglosadas en materias primas utilizadas por lote
ALTER TABLE batch_raw_materials
    ADD COLUMN tarimas_json JSON NULL AFTER quantity_lbs,
    ADD COLUMN boxes_count INT DEFAULT 0 AFTER tarimas_json;

-- 2. Vínculo directo de lote de producción con la programación del calendario
ALTER TABLE egg_production_batches
    ADD COLUMN scheduled_production_id INT NULL AFTER batch_code_display;

CREATE INDEX idx_epb_scheduled_prod ON egg_production_batches(scheduled_production_id);
