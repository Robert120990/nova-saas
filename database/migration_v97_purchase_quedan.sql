CREATE TABLE purchase_quedans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    branch_id INT,
    num_quedan VARCHAR(50),
    provider_id INT,
    dias_credito INT DEFAULT 0,
    fecha DATE,
    fecha_vencimiento DATE,
    status ENUM('PENDIENTE','SOLICITADO','ENTREGADO') DEFAULT 'PENDIENTE',
    total_gravadas DECIMAL(12,2) DEFAULT 0,
    total_iva DECIMAL(12,2) DEFAULT 0,
    total_retencion DECIMAL(12,2) DEFAULT 0,
    total_percepcion DECIMAL(12,2) DEFAULT 0,
    total_exentas DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    fecha_entrega DATE NULL,
    usuario_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE purchase_quedan_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quedan_id INT NOT NULL,
    fecha DATE,
    documento VARCHAR(50),
    tipo ENUM('CCF','NCR'),
    gravadas DECIMAL(12,2) DEFAULT 0,
    iva DECIMAL(12,2) DEFAULT 0,
    retencion DECIMAL(12,2) DEFAULT 0,
    percepcion DECIMAL(12,2) DEFAULT 0,
    exentas DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    FOREIGN KEY (quedan_id) REFERENCES purchase_quedans(id) ON DELETE CASCADE
);
