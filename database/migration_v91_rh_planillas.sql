-- Migration v91: Recursos Humanos - Planillas Quincenales
-- Tablas para planillas generales + ajuste a cuentas_planillas

ALTER TABLE rh_cuentas_planillas ADD COLUMN valor_base DECIMAL(12,4) NULL AFTER tipo_valor;

CREATE TABLE IF NOT EXISTS rh_planillas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  empleado_id INT NOT NULL,
  periodo_anio INT NOT NULL,
  periodo_mes INT NOT NULL,
  quincena ENUM('primera','segunda') NOT NULL DEFAULT 'primera',
  dias_trabajados INT NOT NULL DEFAULT 15,
  sueldo_base DECIMAL(10,2),
  bonificacion_fija DECIMAL(10,2),
  total_percepciones DECIMAL(10,2) DEFAULT 0,
  total_deducciones DECIMAL(10,2) DEFAULT 0,
  descuento_isss DECIMAL(10,2) DEFAULT 0,
  descuento_afp DECIMAL(10,2) DEFAULT 0,
  descuento_renta DECIMAL(10,2) DEFAULT 0,
  monto_recibir DECIMAL(10,2) DEFAULT 0,
  estado ENUM('pendiente','pagada','anulada') DEFAULT 'pendiente',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (empleado_id) REFERENCES rh_empleados(id),
  UNIQUE KEY uq_planilla (company_id, empleado_id, periodo_anio, periodo_mes, quincena)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rh_planilla_detalles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  planilla_id INT NOT NULL,
  cuenta_id INT NOT NULL,
  codigo VARCHAR(20),
  descripcion VARCHAR(255),
  operacion ENUM('sumar','restar'),
  tipo_valor ENUM('valor','dias','horas','porcentaje'),
  valor_base DECIMAL(12,4),
  valor_ingresado DECIMAL(10,2) DEFAULT 0,
  orden INT DEFAULT 0,
  FOREIGN KEY (planilla_id) REFERENCES rh_planillas(id) ON DELETE CASCADE,
  FOREIGN KEY (cuenta_id) REFERENCES rh_cuentas_planillas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
