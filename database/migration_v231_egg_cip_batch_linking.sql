-- Migration v231: Agregar vinculación a lote de producción en historial de sanitización CIP
ALTER TABLE `egg_cip_logs` 
ADD COLUMN `batch_id` INT NULL AFTER `operator_name`,
ADD INDEX `idx_cip_batch` (`batch_id`);
