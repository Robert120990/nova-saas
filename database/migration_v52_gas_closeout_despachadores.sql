-- Migration v52: Closeout-despachador pivot table

CREATE TABLE IF NOT EXISTS gas_station_closeout_despachadores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    closeout_id INT NOT NULL,
    despachador_id INT NOT NULL,
    nombre VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_closeout_despachador (closeout_id, despachador_id),
    FOREIGN KEY (closeout_id) REFERENCES gas_station_closeouts(id) ON DELETE CASCADE,
    FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
