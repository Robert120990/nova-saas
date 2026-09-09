-- Migración v175: Parámetros de Calidad y Mejoras al Certificado de Análisis (COA)
CREATE TABLE IF NOT EXISTS egg_quality_parameters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    category ENUM('microbiologico', 'fisicoquimico', 'organoleptico', 'otro') NOT NULL DEFAULT 'microbiologico',
    parameter_name VARCHAR(150) NOT NULL,
    specification VARCHAR(255) NOT NULL,
    default_value VARCHAR(100) NULL,
    unit VARCHAR(50) NULL,
    applicable_product VARCHAR(100) NOT NULL DEFAULT 'todos',
    expected_criterion VARCHAR(100) NOT NULL DEFAULT 'CONFORME',
    sort_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_eqp_comp (company_id),
    INDEX idx_eqp_cat (category),
    INDEX idx_eqp_prod (applicable_product)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Modificaciones a egg_lab_micro_logs
ALTER TABLE egg_lab_micro_logs ADD COLUMN IF NOT EXISTS customer_id INT NULL AFTER batch_id;
ALTER TABLE egg_lab_micro_logs ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255) NULL AFTER customer_id;
ALTER TABLE egg_lab_micro_logs ADD COLUMN IF NOT EXISTS presentation VARCHAR(100) NULL DEFAULT 'Cubeta 30 Lb' AFTER customer_name;
ALTER TABLE egg_lab_micro_logs ADD COLUMN IF NOT EXISTS custom_parameters JSON NULL AFTER observations;
