-- Migration v44: Gas station closeout cupones

CREATE TABLE IF NOT EXISTS gas_station_closeout_cupones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    closeout_id INT NOT NULL,
    cupon VARCHAR(50) NOT NULL DEFAULT '',
    distribuidora_id INT NULL,
    distribuidora_nombre VARCHAR(255) NOT NULL DEFAULT '',
    producto_codigo VARCHAR(50) NOT NULL DEFAULT '',
    producto_descripcion VARCHAR(255) NOT NULL DEFAULT '',
    monto DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (closeout_id) REFERENCES gas_station_closeouts(id) ON DELETE CASCADE,
    FOREIGN KEY (distribuidora_id) REFERENCES gas_station_distributors(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
