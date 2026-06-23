-- Migration v59: Create gas_station_closeout_vales table

CREATE TABLE IF NOT EXISTS gas_station_closeout_vales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  closeout_id INT NOT NULL,
  documento VARCHAR(50) NOT NULL DEFAULT '',
  tipo_documento ENUM('CCF','FAC') NOT NULL DEFAULT 'FAC',
  cliente_id INT DEFAULT NULL,
  cliente_nombre VARCHAR(255) NOT NULL DEFAULT '',
  producto_codigo VARCHAR(50) NOT NULL DEFAULT '',
  producto_descripcion VARCHAR(255) NOT NULL DEFAULT '',
  despachador_id INT DEFAULT NULL,
  cantidad DECIMAL(12,5) NOT NULL DEFAULT 0,
  precio DECIMAL(12,2) NOT NULL DEFAULT 0,
  monto DECIMAL(12,2) NOT NULL DEFAULT 0,
  placa VARCHAR(20) DEFAULT '',
  kilometraje VARCHAR(20) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (closeout_id) REFERENCES gas_station_closeouts(id) ON DELETE CASCADE,
  FOREIGN KEY (cliente_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
