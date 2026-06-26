-- Migration v46: Gas station closeout adelantos

CREATE TABLE IF NOT EXISTS gas_station_closeout_adelantos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    closeout_id INT NOT NULL,
    empleado VARCHAR(255) NOT NULL DEFAULT '',
    monto DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (closeout_id) REFERENCES gas_station_closeouts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
