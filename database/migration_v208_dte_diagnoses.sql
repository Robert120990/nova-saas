-- Migration v208: Create dte_diagnoses table
-- Caching for intelligent DTE rejection diagnosis generated via DeepSeek / Gemini

CREATE TABLE IF NOT EXISTS `dte_diagnoses` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `sale_id` INT NOT NULL,
  `codigo_generacion` VARCHAR(36) NULL,
  `company_id` INT NOT NULL,
  `codigo_msg` VARCHAR(50) NULL,
  `error_raw` TEXT NULL,
  `que_paso` TEXT NOT NULL,
  `normativa` TEXT NULL,
  `solucion` TEXT NOT NULL,
  `tipo_correccion` VARCHAR(50) DEFAULT 'CLIENTE',
  `provider` VARCHAR(50) DEFAULT 'deepseek',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_dte_diag_sale` (`sale_id`),
  INDEX `idx_dte_diag_cod_gen` (`codigo_generacion`),
  INDEX `idx_dte_diag_company` (`company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
