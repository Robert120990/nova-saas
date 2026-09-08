-- =========================================================================
-- Migración v166: Rango de Fechas e Histórico en Acuerdos de Clientes y Costeo
-- =========================================================================

-- 1. Agregar columnas valid_from y valid_to a egg_costing_customer_agreements si no existen
ALTER TABLE egg_costing_customer_agreements 
ADD COLUMN IF NOT EXISTS valid_from DATE NULL DEFAULT NULL AFTER target_margin_pct,
ADD COLUMN IF NOT EXISTS valid_to DATE NULL DEFAULT NULL AFTER valid_from;

-- 2. Crear tabla de historial y auditoría de acuerdos de precios
CREATE TABLE IF NOT EXISTS egg_costing_agreement_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agreement_id INT NOT NULL,
    company_id INT NOT NULL,
    customer_id INT NULL,
    customer_name VARCHAR(150) NOT NULL,
    product_id INT NULL,
    product_type VARCHAR(100) NOT NULL,
    presentation VARCHAR(100) NOT NULL DEFAULT 'cubeta 30LB',
    agreed_price_per_lb DECIMAL(8,4) NOT NULL DEFAULT 0.0000,
    agreed_unit_price DECIMAL(10,4) NULL,
    monthly_volume_lbs DECIMAL(12,2) DEFAULT 0.00,
    target_margin_pct DECIMAL(5,2) DEFAULT 20.00,
    freight_cost_per_lb DECIMAL(8,4) DEFAULT 0.0000,
    payment_terms_days INT DEFAULT 30,
    valid_from DATE NULL,
    valid_to DATE NULL,
    change_reason VARCHAR(255) NULL,
    recorded_by VARCHAR(100) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ecah_agr (agreement_id),
    INDEX idx_ecah_comp (company_id),
    INDEX idx_ecah_cust (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
