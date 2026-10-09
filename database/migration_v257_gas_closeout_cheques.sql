CREATE TABLE IF NOT EXISTS gas_station_closeout_cheques (
    id INT AUTO_INCREMENT PRIMARY KEY,
    closeout_id INT NOT NULL,
    numero_cheque VARCHAR(50) NOT NULL DEFAULT '',
    banco VARCHAR(100) NOT NULL DEFAULT '',
    despachador_id INT DEFAULT NULL,
    tipo_operacion ENUM('venta_combustible', 'recuperacion_credito') NOT NULL DEFAULT 'venta_combustible',
    monto DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cheques_closeout (closeout_id),
    CONSTRAINT fk_closeout_cheques_closeout FOREIGN KEY (closeout_id) REFERENCES gas_station_closeouts(id) ON DELETE CASCADE,
    CONSTRAINT fk_closeout_cheques_despachador FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
