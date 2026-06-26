-- Migration v45: Gas station closeout descuentos

CREATE TABLE IF NOT EXISTS gas_station_closeout_descuentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    closeout_id INT NOT NULL,
    documento VARCHAR(50) NOT NULL DEFAULT '',
    cliente_id INT NULL,
    cliente_nombre VARCHAR(255) NOT NULL DEFAULT '',
    producto_codigo VARCHAR(50) NOT NULL DEFAULT '',
    producto_descripcion VARCHAR(255) NOT NULL DEFAULT '',
    cantidad DECIMAL(12,2) NOT NULL DEFAULT 0,
    valor DECIMAL(12,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (closeout_id) REFERENCES gas_station_closeouts(id) ON DELETE CASCADE,
    FOREIGN KEY (cliente_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
