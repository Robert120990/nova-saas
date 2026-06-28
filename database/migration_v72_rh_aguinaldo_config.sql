-- Migration v72: RRHH - Configuración de Aguinaldo por años de antigüedad

CREATE TABLE IF NOT EXISTS rh_aguinaldo_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  fecha_desde DATE NOT NULL,
  fecha_hasta DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY uq_aguinaldo_config (company_id, fecha_desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rh_aguinaldo_config_detalle (
  id INT AUTO_INCREMENT PRIMARY KEY,
  aguinaldo_config_id INT NOT NULL,
  anios_desde INT NOT NULL COMMENT 'Años desde (inclusive)',
  anios_hasta INT NOT NULL COMMENT 'Años hasta (inclusive)',
  dias_aguinaldo DECIMAL(6,2) NOT NULL COMMENT 'Días de aguinaldo',
  FOREIGN KEY (aguinaldo_config_id) REFERENCES rh_aguinaldo_config(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
