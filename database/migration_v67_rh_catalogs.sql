-- Migration v67: Recursos Humanos - Catálogos básicos

CREATE TABLE IF NOT EXISTS rh_afp (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  codigo VARCHAR(20) NOT NULL,
  descripcion VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY uq_afp_company_codigo (company_id, codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rh_cargos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  codigo VARCHAR(20) NOT NULL,
  descripcion VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY uq_cargo_company_codigo (company_id, codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rh_descuentos_programados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  codigo VARCHAR(20) NOT NULL,
  descripcion VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY uq_descuento_company_codigo (company_id, codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
