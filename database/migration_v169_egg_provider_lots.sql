-- Migración v169: Parametrización de Prefijos de Lote por Proveedor para Huevo Industrial
CREATE TABLE IF NOT EXISTS `egg_provider_lot_configurations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NOT NULL,
  `provider_id` INT NOT NULL,
  `lot_prefix` VARCHAR(50) NOT NULL,
  `format_pattern` VARCHAR(50) NOT NULL DEFAULT 'PREFIX-DATE',
  `next_correlative` INT NOT NULL DEFAULT 1,
  `notes` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_egg_prov_lot` (`company_id`, `provider_id`),
  INDEX `idx_egg_prov_lot_company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permitir temperatura de huevo opcional en recepción
ALTER TABLE `egg_raw_materials` MODIFY COLUMN `temperature_c` DECIMAL(5,2) NULL DEFAULT NULL;
