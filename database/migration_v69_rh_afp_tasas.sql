-- Migration v69: RRHH - Tasas de AFP (porcentajes por rango de fechas)

CREATE TABLE IF NOT EXISTS rh_afp_tasas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  afp_id INT NOT NULL,
  fecha_desde DATE NOT NULL,
  fecha_hasta DATE NULL,
  porcentaje_empleado DECIMAL(5,2) NOT NULL,
  porcentaje_patrono DECIMAL(5,2) NOT NULL,
  tope_quincenal DECIMAL(10,2) NOT NULL,
  tope_mensual DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (afp_id) REFERENCES rh_afp(id) ON DELETE CASCADE,
  UNIQUE KEY uq_afp_tasa_company (company_id, afp_id, fecha_desde)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
