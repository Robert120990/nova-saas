-- Migración v199: Mejoras Integrales al Módulo de Huevo Industrial
-- 1. Tabla de Registro de Mermas por Lote y Etapa de Producción
CREATE TABLE IF NOT EXISTS egg_batch_waste_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    batch_id INT NOT NULL,
    stage ENUM('quebraje', 'pasteurizacion', 'tuberias', 'envasado', 'almacenamiento', 'calidad', 'otro') NOT NULL DEFAULT 'quebraje',
    waste_type VARCHAR(100) NOT NULL DEFAULT 'merma_operativa',
    quantity_lbs DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    reason TEXT NULL,
    operator_name VARCHAR(150) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ebw_comp_batch (company_id, batch_id),
    INDEX idx_ebw_stage (company_id, stage),
    INDEX idx_ebw_created (company_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla de Remanentes, Reprocesos y Reutilizables de Producción
CREATE TABLE IF NOT EXISTS egg_batch_remanentes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    batch_id INT NOT NULL,
    product_type VARCHAR(100) NOT NULL,
    remanente_type ENUM('pasteurizado', 'no_pasteurizado', 'reproceso', 'reutilizable') NOT NULL DEFAULT 'pasteurizado',
    quantity_lbs DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    storage_location VARCHAR(150) NULL,
    status ENUM('disponible', 'asignado_a_lote', 'descartado') NOT NULL DEFAULT 'disponible',
    target_batch_id INT NULL,
    notes TEXT NULL,
    operator_name VARCHAR(150) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ebr_comp_batch (company_id, batch_id),
    INDEX idx_ebr_status (company_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabla de Vinculación de Códigos de Catálogo (Mapeo de Productos y Presentaciones)
CREATE TABLE IF NOT EXISTS egg_product_code_mappings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    industrial_product_type VARCHAR(100) NOT NULL,
    presentation VARCHAR(100) NOT NULL,
    catalog_codes TEXT NOT NULL,
    unit_weight_lbs DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    unit_weight_kg DECIMAL(10,2) NOT NULL DEFAULT 0.45,
    notes VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_epcm_comp_type (company_id, industrial_product_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
