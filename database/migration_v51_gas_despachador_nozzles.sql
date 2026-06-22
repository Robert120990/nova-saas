-- Migration v51: Gas station despachador nozzle assignments

CREATE TABLE IF NOT EXISTS gas_station_despachador_nozzles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    despachador_id INT NOT NULL,
    nozzle_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_despachador_nozzle (despachador_id, nozzle_id),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE CASCADE,
    FOREIGN KEY (nozzle_id) REFERENCES gas_station_nozzles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
