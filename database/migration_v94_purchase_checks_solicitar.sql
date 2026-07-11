-- Migration v94: Agregar status SOLICITADO y tabla branch_chq_config

ALTER TABLE purchase_checks
    MODIFY COLUMN status ENUM('PENDIENTE','ENTREGADO','SOLICITADO') DEFAULT 'PENDIENTE';

CREATE TABLE IF NOT EXISTS branch_chq_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    rrs_id_empresa VARCHAR(3) NOT NULL COMMENT 'ID de la empresa en RRS (ej: 014, 015)',
    cod_destino CHAR(2) NOT NULL COMMENT 'Código destino por defecto (destinos_cheques.id)',
    id_rubro VARCHAR(3) NOT NULL DEFAULT '038',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_company_branch (company_id, branch_id)
);
