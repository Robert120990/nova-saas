-- Migration v39: Gas station expense categories and closeout expenses

CREATE TABLE IF NOT EXISTS gas_station_expense_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO gas_station_expense_categories (company_id, name)
SELECT id, 'Electricidad' FROM companies
UNION ALL
SELECT id, 'Agua' FROM companies
UNION ALL
SELECT id, 'Alquiler' FROM companies
UNION ALL
SELECT id, 'Sueldos' FROM companies
UNION ALL
SELECT id, 'Mantenimiento' FROM companies
UNION ALL
SELECT id, 'Papelería' FROM companies
UNION ALL
SELECT id, 'Otros' FROM companies;

CREATE TABLE IF NOT EXISTS gas_station_closeout_expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    closeout_id INT NOT NULL,
    rubro VARCHAR(100) NOT NULL,
    fecha DATE NOT NULL,
    documento VARCHAR(50) NOT NULL DEFAULT '',
    tipo VARCHAR(10) NOT NULL DEFAULT 'ccf',
    proveedor VARCHAR(255) NOT NULL DEFAULT '',
    valor DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (closeout_id) REFERENCES gas_station_closeouts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
