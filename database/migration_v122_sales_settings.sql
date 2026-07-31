-- Migración v122: Configuración de tienda (módulo Ventas)
-- Espejo de gas_station_settings (v47+v48): key/value por empresa + sucursal.
-- Claves: cuenta_bancaria_tienda, empresa_rrs, puntos_venta_tienda (JSON array)
CREATE TABLE IF NOT EXISTS sales_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    branch_id INT DEFAULT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_company_branch_setting (company_id, branch_id, setting_key),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);
