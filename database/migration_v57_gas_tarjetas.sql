-- Migration v57: Create gas_station_closeout_tarjetas table

CREATE TABLE IF NOT EXISTS gas_station_closeout_tarjetas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  closeout_id INT NOT NULL,
  num_tarjeta VARCHAR(10) NOT NULL DEFAULT '',
  num_autorizacion VARCHAR(50) DEFAULT '',
  pos_type_id INT DEFAULT NULL,
  despachador_id INT DEFAULT NULL,
  tipo_operacion ENUM('venta_combustible','recuperacion_credito','pago_anticipado') NOT NULL DEFAULT 'venta_combustible',
  monto DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (closeout_id) REFERENCES gas_station_closeouts(id) ON DELETE CASCADE,
  FOREIGN KEY (pos_type_id) REFERENCES gas_station_pos_types(id) ON DELETE SET NULL,
  FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE SET NULL
);
