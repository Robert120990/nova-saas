-- Migration v74: RRHH - Tipos de Contrato

CREATE TABLE IF NOT EXISTS rh_tipos_contrato (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  codigo VARCHAR(20) NOT NULL,
  descripcion VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY uq_tipo_contrato_company (company_id, codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
