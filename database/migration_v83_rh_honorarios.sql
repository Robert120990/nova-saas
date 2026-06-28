-- Migration v83: RRHH - Honorarios y Servicios

CREATE TABLE IF NOT EXISTS rh_honorarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  numero VARCHAR(5) NOT NULL,
  fecha DATE NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  num_dui VARCHAR(12),
  num_nit VARCHAR(17),
  concepto TEXT,
  monto DECIMAL(10,2) NOT NULL DEFAULT 0,
  renta_isr DECIMAL(10,2) NOT NULL DEFAULT 0,
  liquido_pagar DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY uq_honorario_company_numero (company_id, numero)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
