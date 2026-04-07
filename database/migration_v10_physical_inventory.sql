-- Migration v10: Physical Inventory Tables
-- Created At: 2026-03-30
-- Author: Antigravity

CREATE TABLE IF NOT EXISTS physical_inventories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    fecha DATE NOT NULL,
    responsable VARCHAR(255),
    observaciones TEXT,
    status ENUM('PENDIENTE', 'APLICADO', 'ANULADO') DEFAULT 'PENDIENTE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (branch_id) REFERENCES branches(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS physical_inventory_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    physical_inventory_id INT NOT NULL,
    product_id INT NOT NULL,
    stock_sistema DECIMAL(12,4) NOT NULL,
    stock_fisico DECIMAL(12,4) NOT NULL,
    diferencia DECIMAL(12,4) NOT NULL,
    costo DECIMAL(12,4) NOT NULL,
    total DECIMAL(12,4) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (physical_inventory_id) REFERENCES physical_inventories(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
