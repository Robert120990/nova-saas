-- Migration v38: Gas station closeouts (lectures) and readings

CREATE TABLE IF NOT EXISTS gas_station_closeouts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    seller_id INT NOT NULL,
    seller_name VARCHAR(255) NOT NULL DEFAULT '',
    fecha_turno DATE NOT NULL,
    numero_turno VARCHAR(20) NOT NULL,
    estado VARCHAR(20) DEFAULT 'abierto',
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gas_station_closeout_readings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    closeout_id INT NOT NULL,
    nozzle_id INT NOT NULL,
    product_id INT NOT NULL,
    codigo_pistola VARCHAR(4) NOT NULL,
    codigo_producto VARCHAR(255) NOT NULL,
    descripcion_producto VARCHAR(255) NOT NULL,
    precio DECIMAL(12,2) NOT NULL DEFAULT 0,
    lectura_anterior DECIMAL(12,2) NOT NULL DEFAULT 0,
    lectura_actual DECIMAL(12,2) NOT NULL DEFAULT 0,
    calibracion DECIMAL(12,2) NOT NULL DEFAULT 0,
    diferencia DECIMAL(12,2) NOT NULL DEFAULT 0,
    monto DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (closeout_id) REFERENCES gas_station_closeouts(id) ON DELETE CASCADE,
    FOREIGN KEY (nozzle_id) REFERENCES gas_station_nozzles(id) ON DELETE RESTRICT,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
