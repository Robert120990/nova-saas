-- Migración v214: Parámetros de tara por proveedor (separadores y cajas/jabas) para Huevo Industrial
ALTER TABLE `egg_provider_lot_configurations`
    ADD COLUMN `tare_separador_lbs` DECIMAL(8,2) NOT NULL DEFAULT 48.00 COMMENT 'Tara de separadores para tarima estándar (lbs)',
    ADD COLUMN `tare_caja_lbs` DECIMAL(8,2) NOT NULL DEFAULT 30.00 COMMENT 'Tara de jaba o caja para tarima estándar (lbs)',
    ADD COLUMN `base_boxes_per_tarima` INT NOT NULL DEFAULT 24 COMMENT 'Cantidad base de cajas por tarima estándar',
    ADD COLUMN `default_has_caja` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = con caja/jaba por defecto, 0 = a granel (solo separador)';

-- Actualizar o sembrar valores para INAVI (Inversiones Avícolas de Honduras)
UPDATE `egg_provider_lot_configurations`
SET `tare_separador_lbs` = 48.00,
    `tare_caja_lbs` = 30.00,
    `base_boxes_per_tarima` = 24,
    `default_has_caja` = 1
WHERE `provider_id` IN (SELECT id FROM providers WHERE nombre LIKE '%INAVI%' OR nombre_comercial LIKE '%INAVI%' OR nombre LIKE '%Honduras%');
