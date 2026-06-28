-- Migration v75: RRHH - Empleados

CREATE TABLE IF NOT EXISTS rh_empleados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  codigo VARCHAR(10) NOT NULL,
  nombres VARCHAR(255) NOT NULL,
  apellidos VARCHAR(255) NOT NULL,
  fecha_nacimiento DATE NULL,
  num_dui VARCHAR(12) NULL,
  num_nit VARCHAR(17) NULL,
  afp_id INT NULL,
  ocupacion VARCHAR(255) NULL,
  direccion TEXT NULL,
  departamento VARCHAR(100) NULL,
  municipio VARCHAR(100) NULL,
  distrito VARCHAR(10) NULL,
  telefono VARCHAR(50) NULL,
  correo VARCHAR(255) NULL,
  contacto_emergencia_nombre VARCHAR(255) NULL,
  contacto_emergencia_telefono VARCHAR(50) NULL,
  cargo_id INT NULL,
  departamento_personal_id INT NULL,
  num_isss VARCHAR(50) NULL,
  num_nup VARCHAR(50) NULL,
  fecha_ingreso DATE NULL,
  tipo_contrato_id INT NULL,
  sueldo_base DECIMAL(10,2) DEFAULT 0,
  bonificacion_fija DECIMAL(10,2) DEFAULT 0,
  cuenta_planillera VARCHAR(100) NULL,
  es_activo TINYINT(1) DEFAULT 1,
  es_jubilado TINYINT(1) DEFAULT 0,
  en_vacaciones TINYINT(1) DEFAULT 0,
  incapacitado TINYINT(1) DEFAULT 0,
  comentarios TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (afp_id) REFERENCES rh_afp(id) ON DELETE SET NULL,
  FOREIGN KEY (cargo_id) REFERENCES rh_cargos(id) ON DELETE SET NULL,
  FOREIGN KEY (departamento_personal_id) REFERENCES rh_departamentos(id) ON DELETE SET NULL,
  FOREIGN KEY (tipo_contrato_id) REFERENCES rh_tipos_contrato(id) ON DELETE SET NULL,
  UNIQUE KEY uq_empleado_company_codigo (company_id, codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rh_empleado_descuentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  empleado_id INT NOT NULL,
  descuento_id INT NOT NULL,
  quincena ENUM('primera', 'segunda', 'ambas') NOT NULL DEFAULT 'primera',
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  numero_cuotas INT DEFAULT 1,
  cuotas_restantes INT DEFAULT 1,
  numero_credito VARCHAR(50) NULL,
  activo TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (empleado_id) REFERENCES rh_empleados(id) ON DELETE CASCADE,
  FOREIGN KEY (descuento_id) REFERENCES rh_descuentos_programados(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rh_indemnizaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  empleado_id INT NOT NULL,
  motivo TEXT NULL,
  monto DECIMAL(10,2) NOT NULL DEFAULT 0,
  fecha_aplicacion DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (empleado_id) REFERENCES rh_empleados(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rh_empleado_ausencias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  empleado_id INT NOT NULL,
  tipo ENUM('falta', 'inasistencia', 'incapacidad') NOT NULL DEFAULT 'falta',
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NULL,
  motivo TEXT NULL,
  justificada TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (empleado_id) REFERENCES rh_empleados(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
