-- Migration v79: RH Company Config (responsable y sello)

CREATE TABLE IF NOT EXISTS rh_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  responsable_nombre VARCHAR(255),
  sello_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY uq_rh_config_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
