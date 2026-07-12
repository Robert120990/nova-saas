-- Migration v98: Snapshot nozzle assignments per closeout
-- Stores which nozzles were assigned to each despachador at the time the closeout was created

CREATE TABLE IF NOT EXISTS gas_station_closeout_despachador_nozzles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    closeout_id INT NOT NULL,
    despachador_id INT NOT NULL,
    nozzle_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_closeout_desp_nozzle (closeout_id, despachador_id, nozzle_id),
    FOREIGN KEY (closeout_id) REFERENCES gas_station_closeouts(id) ON DELETE CASCADE,
    FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE RESTRICT,
    FOREIGN KEY (nozzle_id) REFERENCES gas_station_nozzles(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
