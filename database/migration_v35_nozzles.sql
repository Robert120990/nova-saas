-- Migration v35: Gas station nozzles (pistolas)
-- Each nozzle links to an island and a fuel product

CREATE TABLE IF NOT EXISTS gas_station_nozzles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    codigo VARCHAR(4) NOT NULL,
    descripcion VARCHAR(255) NOT NULL,
    island_id INT NOT NULL,
    product_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (island_id) REFERENCES gas_station_islands(id) ON DELETE RESTRICT,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    UNIQUE KEY uq_nozzle_company_code (company_id, codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
