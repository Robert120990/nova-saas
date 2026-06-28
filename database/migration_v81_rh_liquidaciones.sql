-- Migration v81: RRHH - Planilla de Liquidaciones

CREATE TABLE IF NOT EXISTS rh_planilla_liquidaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  empleado_id INT NOT NULL,
  periodo_año INT NOT NULL,
  periodo_mes INT NOT NULL,

  -- Periods
  periodo_indemnizacion_desde DATE,
  periodo_indemnizacion_hasta DATE,
  periodo_vacaciones_desde DATE,
  periodo_vacaciones_hasta DATE,
  periodo_aguinaldo_desde DATE,
  periodo_aguinaldo_hasta DATE,
  dias_indemnizacion INT NOT NULL DEFAULT 0,
  dias_vacaciones INT NOT NULL DEFAULT 0,
  dias_aguinaldo INT NOT NULL DEFAULT 0,

  -- Last worked days
  ultimos_dias_laborados DATE,
  pago_ultimos_dias DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Partial amounts
  total_indemnizacion DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_vacaciones DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_aguinaldo DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_devengado DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Deductions
  descuento_isss DECIMAL(10,2) NOT NULL DEFAULT 0,
  descuento_afp DECIMAL(10,2) NOT NULL DEFAULT 0,
  descuento_renta DECIMAL(10,2) NOT NULL DEFAULT 0,
  otros_descuentos DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_deducciones DECIMAL(10,2) NOT NULL DEFAULT 0,
  monto_recibir DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Cuotas
  pago_cuotas BOOLEAN NOT NULL DEFAULT FALSE,
  cuotas INT NOT NULL DEFAULT 1,
  pago_por_cuota DECIMAL(10,2) NOT NULL DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (empleado_id) REFERENCES rh_empleados(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
