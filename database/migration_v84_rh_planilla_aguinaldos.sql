-- Migration v84: RRHH - Planilla de Aguinaldos

CREATE TABLE IF NOT EXISTS rh_planilla_aguinaldos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  empleado_id INT NOT NULL,
  departamento_personal_id INT,
  periodo_año INT NOT NULL,
  periodo_mes INT NOT NULL,
  sueldo_base DECIMAL(10,2) NOT NULL DEFAULT 0,
  fecha_ingreso DATE,
  fecha_base DATE,
  dias_antiguedad INT NOT NULL DEFAULT 0,
  dias_segun_tabla DECIMAL(6,2) NOT NULL DEFAULT 0,
  aguinaldo_calculado DECIMAL(10,2) NOT NULL DEFAULT 0,
  excedente DECIMAL(10,2) NOT NULL DEFAULT 0,
  renta DECIMAL(10,2) NOT NULL DEFAULT 0,
  monto_recibir DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (empleado_id) REFERENCES rh_empleados(id) ON DELETE CASCADE,
  UNIQUE KEY uq_empleado_periodo (empleado_id, periodo_año, periodo_mes, company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
