-- Migration v78: RRHH - Planilla de Vacaciones

CREATE TABLE IF NOT EXISTS rh_planilla_vacaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  empleado_id INT NOT NULL,
  periodo_año INT NOT NULL,
  periodo_mes INT NOT NULL,
  quincena ENUM('primera', 'segunda') NOT NULL DEFAULT 'primera',
  fecha_inicial DATE NOT NULL,
  fecha_final DATE NOT NULL,
  dias_transcurridos INT NOT NULL DEFAULT 0,
  vacaciones_monto DECIMAL(10,2) NOT NULL DEFAULT 0,
  descuento_isss DECIMAL(10,2) NOT NULL DEFAULT 0,
  descuento_afp DECIMAL(10,2) NOT NULL DEFAULT 0,
  descuento_renta DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_devengado DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_deducciones DECIMAL(10,2) NOT NULL DEFAULT 0,
  monto_recibir DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (empleado_id) REFERENCES rh_empleados(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
