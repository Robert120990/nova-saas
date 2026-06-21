-- Migration v42: Create gas_station_closeout_tank_readings table

CREATE TABLE IF NOT EXISTS gas_station_closeout_tank_readings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    closeout_id INT NOT NULL,
    tank_id INT NOT NULL,
    codigo_tanque VARCHAR(4) NOT NULL,
    descripcion_tanque VARCHAR(255) NOT NULL,
    lectura_anterior DECIMAL(14,5) NOT NULL DEFAULT 0,
    recarga DECIMAL(14,5) NOT NULL DEFAULT 0,
    lectura_actual DECIMAL(14,5) NOT NULL DEFAULT 0,
    diferencia DECIMAL(14,5) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (closeout_id) REFERENCES gas_station_closeouts(id) ON DELETE CASCADE,
    FOREIGN KEY (tank_id) REFERENCES gas_station_tanks(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
