-- Migration v128: Sales remesa deliveries (Entrega de Remesas - Ventas/Tienda)
-- Espejo de gas_station_remesa_deliveries (v92/v110/v125) para el módulo de ventas.

CREATE TABLE IF NOT EXISTS sales_remesa_deliveries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    responsable VARCHAR(255) NOT NULL DEFAULT '',
    comentario TEXT,
    referencia VARCHAR(50) NOT NULL DEFAULT '',
    monto_entregado DECIMAL(12,2) DEFAULT NULL,
    diferencia DECIMAL(12,2) DEFAULT NULL,
    entregado TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sales_deliveries_company_branch (company_id, branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE pos_shift_remesas
    ADD COLUMN codigo VARCHAR(50) NULL AFTER shift_id,
    ADD COLUMN entregada TINYINT(1) NOT NULL DEFAULT 0 AFTER amount,
    ADD COLUMN entrega_id INT NULL AFTER entregada;

UPDATE pos_shift_remesas SET codigo = CONCAT('SR-', shift_id, '-', numero) WHERE codigo IS NULL;

ALTER TABLE pos_shift_remesas
    ADD UNIQUE INDEX idx_shift_remesa_codigo (codigo),
    ADD INDEX idx_shift_remesa_entregada (entregada),
    ADD CONSTRAINT fk_shift_remesa_entrega
        FOREIGN KEY (entrega_id) REFERENCES sales_remesa_deliveries(id)
        ON DELETE SET NULL;

INSERT INTO notification_actions (code, name, description, category, icon, color, available_variables, default_title_template, default_body_template)
VALUES ('sales_remesa_delivered', 'Remesa entregada', 'Cuando se entrega una remesa de ventas (tienda)', 'ventas', 'Handshake', '#7c3aed',
 '["responsable","monto_entregado","turno","fecha","sucursal"]',
 'Remesa entregada - ${{monto_entregado}}',
 'Responsable: {{responsable}}\nMonto: ${{monto_entregado}}\nTurno: {{turno}}\nSucursal: {{sucursal}}')
ON DUPLICATE KEY UPDATE name = VALUES(name);
