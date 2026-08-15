-- v137: Tabla de historial de cambios en cierres de lecturas (gasolinera)
-- Registra cada modificación realizada cuando un cierre es reabierto.

CREATE TABLE IF NOT EXISTS gas_station_closeout_changes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  branch_id INT NULL,
  closeout_id INT NOT NULL,
  user_id INT NULL,
  username VARCHAR(100) NULL,
  section VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL DEFAULT 'update',
  description VARCHAR(500) NULL,
  details JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_changes_closeout (closeout_id),
  KEY idx_changes_company (company_id, created_at),
  CONSTRAINT fk_changes_closeout FOREIGN KEY (closeout_id) REFERENCES gas_station_closeouts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
