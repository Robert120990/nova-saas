-- Migration v34: Gas Station module tables
-- Distribuidoras de Cupones e Islas

CREATE TABLE IF NOT EXISTS gas_station_distributors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    codigo VARCHAR(4) NOT NULL,
    descripcion VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'activo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uq_distributor_company_code (company_id, codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gas_station_islands (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    codigo VARCHAR(4) NOT NULL,
    descripcion VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'activo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uq_island_company_code (company_id, codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
