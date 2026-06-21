-- Migration v36: Gas station tanks
CREATE TABLE IF NOT EXISTS gas_station_tanks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    codigo VARCHAR(4) NOT NULL,
    descripcion VARCHAR(255) NOT NULL,
    capacidad DECIMAL(12,2) NOT NULL DEFAULT 0,
    reserva DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY uq_tank_company_code (company_id, codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
