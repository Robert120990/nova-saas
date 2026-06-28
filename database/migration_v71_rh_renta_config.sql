-- Migration v71: RRHH - Configuración de Renta (ISR) por tramos

CREATE TABLE IF NOT EXISTS rh_renta_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  tipo ENUM('Q', 'M') NOT NULL COMMENT 'Q=Quincenal, M=Mensual',
  fecha_desde DATE NOT NULL,
  fecha_hasta DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY uq_renta_config (company_id, tipo, fecha_desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rh_renta_config_detalle (
  id INT AUTO_INCREMENT PRIMARY KEY,
  renta_config_id INT NOT NULL,
  sueldo_inicial DECIMAL(12,2) NOT NULL,
  sueldo_final DECIMAL(12,2) NOT NULL,
  porcentaje DECIMAL(5,2) NOT NULL,
  valor_descuento DECIMAL(12,2) NOT NULL,
  exceso DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (renta_config_id) REFERENCES rh_renta_config(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
