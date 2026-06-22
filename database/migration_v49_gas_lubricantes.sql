-- Migration v49: Gas station closeout lubricant readings

CREATE TABLE IF NOT EXISTS gas_station_closeout_lubricant_readings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    closeout_id INT NOT NULL,
    producto_id INT NULL,
    producto_codigo VARCHAR(50) NOT NULL DEFAULT '',
    producto_descripcion VARCHAR(255) NOT NULL DEFAULT '',
    lectura_inicial DECIMAL(14,5) NOT NULL DEFAULT 0,
    recarga DECIMAL(14,5) NOT NULL DEFAULT 0,
    lectura_final DECIMAL(14,5) NOT NULL DEFAULT 0,
    ventas DECIMAL(14,5) NOT NULL DEFAULT 0,
    precio DECIMAL(12,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (closeout_id) REFERENCES gas_station_closeouts(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
