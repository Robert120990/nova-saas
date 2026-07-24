-- Migration v113: Physical Inventory Scan Sessions and Scans
-- Allows generating QR codes for mobile scanning during physical inventory counts

-- Sessions: QR codes linked to a physical inventory count
CREATE TABLE IF NOT EXISTS physical_inventory_scan_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    physical_inventory_id INT NOT NULL,
    branch_id INT NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    nombre_sesion VARCHAR(255) NOT NULL,
    created_by INT NOT NULL,
    expires_at DATETIME NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (physical_inventory_id) REFERENCES physical_inventories(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id),
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_token (token),
    INDEX idx_inventory (physical_inventory_id)
);

-- Individual scan records from mobile devices
CREATE TABLE IF NOT EXISTS physical_inventory_scans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    product_id INT NOT NULL,
    codigo_barras VARCHAR(100),
    cantidad_fisica DECIMAL(15,4) NOT NULL,
    escaneado_por_nombre VARCHAR(255) NOT NULL,
    observaciones TEXT,
    estado ENUM('PENDIENTE','APLICADO','RECHAZADO') DEFAULT 'PENDIENTE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES physical_inventory_scan_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_session (session_id),
    INDEX idx_session_product (session_id, product_id)
);