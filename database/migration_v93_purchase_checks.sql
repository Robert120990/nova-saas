CREATE TABLE IF NOT EXISTS purchase_checks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    provider_id INT NOT NULL,
    fecha DATE NOT NULL,
    monto DECIMAL(12,2) NOT NULL DEFAULT 0,
    destino CHAR(1) NOT NULL COMMENT 'P = Pista, T = Tienda',
    fecha_entrega DATE NULL,
    documento VARCHAR(100) NULL,
    status ENUM('PENDIENTE', 'ENTREGADO') DEFAULT 'PENDIENTE',
    usuario_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_company (company_id),
    INDEX idx_branch (branch_id),
    INDEX idx_provider (provider_id),
    INDEX idx_status (status)
);
