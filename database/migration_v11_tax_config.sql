CREATE TABLE IF NOT EXISTS tax_configurations (
    company_id INT NOT NULL,
    iva_rate DECIMAL(5,2) DEFAULT 13.00,
    fovial_rate DECIMAL(5,2) DEFAULT 0.20,
    cotrans_rate DECIMAL(5,2) DEFAULT 0.10,
    retencion_rate DECIMAL(5,2) DEFAULT 1.00,
    percepcion_rate DECIMAL(5,2) DEFAULT 1.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (company_id),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Initialize for existing companies
INSERT IGNORE INTO tax_configurations (company_id)
SELECT id FROM companies;
