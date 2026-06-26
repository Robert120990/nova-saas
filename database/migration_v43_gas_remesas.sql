-- Migration v43: Gas station closeout remesas

CREATE TABLE IF NOT EXISTS gas_station_closeout_remesas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    closeout_id INT NOT NULL,
    documento VARCHAR(50) NOT NULL DEFAULT '',
    descripcion VARCHAR(255) NOT NULL DEFAULT '',
    tipo_operacion ENUM('venta_combustible','recuperacion_credito','pago_anticipado') NOT NULL DEFAULT 'venta_combustible',
    monto DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (closeout_id) REFERENCES gas_station_closeouts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
