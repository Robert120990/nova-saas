-- Migration v73: RRHH - Configuración de Salario Mínimo

CREATE TABLE IF NOT EXISTS rh_salario_minimo_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  fecha_desde DATE NOT NULL,
  fecha_hasta DATE NULL,
  monto DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY uq_salario_config (company_id, fecha_desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
