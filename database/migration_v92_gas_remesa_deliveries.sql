-- Migration v92: Gas station remesa deliveries
-- Adds delivery tracking for remesas (physical handover)

CREATE TABLE IF NOT EXISTS gas_station_remesa_deliveries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    responsable VARCHAR(255) NOT NULL DEFAULT '',
    comentario TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_deliveries_company_branch (company_id, branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE gas_station_closeout_remesas
    ADD COLUMN codigo VARCHAR(50) NULL AFTER id,
    ADD COLUMN entregada TINYINT(1) NOT NULL DEFAULT 0 AFTER monto,
    ADD COLUMN entrega_id INT NULL AFTER entregada,
    ADD UNIQUE INDEX idx_remesa_codigo (codigo),
    ADD INDEX idx_remesa_entregada (entregada),
    ADD CONSTRAINT fk_remesa_entrega
        FOREIGN KEY (entrega_id) REFERENCES gas_station_remesa_deliveries(id)
        ON DELETE SET NULL;
