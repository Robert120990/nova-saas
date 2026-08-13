-- Migration v133: Entregas de Efectivo (Control de Pozo)

CREATE TABLE IF NOT EXISTS pozo_entregas_efectivo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    branch_id INT NOT NULL DEFAULT 0,
    persona_entrega VARCHAR(255) NOT NULL DEFAULT '',
    persona_recibe VARCHAR(255) NOT NULL DEFAULT '',
    fecha DATE NOT NULL,
    monto DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_pozo_entregas_fecha (company_id, branch_id, fecha),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
