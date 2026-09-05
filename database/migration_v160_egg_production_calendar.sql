-- ====================================================================
-- MIGRACIÓN V160: CALENDARIO DE PRODUCCIÓN INTELIGENTE, ROLES DE PLANTA
-- Y PEDIDOS DE OVOPRODUCTOS (MÓDULO HUEVO INDUSTRIAL)
-- ====================================================================

-- 1. Tabla de Producciones Programadas en Calendario
CREATE TABLE IF NOT EXISTS egg_scheduled_productions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    branch_id INT NULL,
    production_date DATE NOT NULL,
    start_time TIME NOT NULL DEFAULT '06:00:00',
    end_time TIME NOT NULL DEFAULT '14:00:00',
    lot_code VARCHAR(100) NOT NULL,
    product_profile VARCHAR(100) NOT NULL DEFAULT 'Huevo Entero Pasteurizado',
    presentation VARCHAR(100) NOT NULL DEFAULT 'cubeta 30LB',
    target_quantity_lbs DECIMAL(12,2) NOT NULL DEFAULT 12000.00,
    target_solids_pct DECIMAL(5,2) NOT NULL DEFAULT 21.50,
    status ENUM('programado', 'en_preparacion', 'en_proceso', 'completado', 'cancelado') NOT NULL DEFAULT 'programado',
    priority ENUM('baja', 'media', 'alta', 'urgente') NOT NULL DEFAULT 'media',
    mix_formula_json JSON NULL,
    assigned_operator_id INT NULL,
    assigned_operator_name VARCHAR(150) NULL,
    batch_id INT NULL,
    suggestion_source VARCHAR(100) NOT NULL DEFAULT 'manual',
    notes TEXT NULL,
    created_by VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_esp_comp_date (company_id, production_date),
    INDEX idx_esp_status (company_id, status),
    INDEX idx_esp_lot (company_id, lot_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla de Asignación de Roles por Fábrica y Tareas de Preparación
CREATE TABLE IF NOT EXISTS egg_scheduled_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    scheduled_production_id INT NOT NULL,
    user_id INT NULL,
    user_name VARCHAR(150) NOT NULL,
    factory_role VARCHAR(100) NOT NULL,
    task_description VARCHAR(255) NOT NULL,
    checklist_status ENUM('pendiente', 'en_progreso', 'completado') NOT NULL DEFAULT 'pendiente',
    completed_at DATETIME NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_est_prod (scheduled_production_id),
    INDEX idx_est_user (company_id, user_id),
    CONSTRAINT fk_est_sched_prod FOREIGN KEY (scheduled_production_id) 
        REFERENCES egg_scheduled_productions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabla de Pedidos de Clientes de Ovoproductos
CREATE TABLE IF NOT EXISTS egg_customer_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    customer_id INT NULL,
    customer_name VARCHAR(150) NOT NULL,
    order_number VARCHAR(50) NULL,
    product_type VARCHAR(100) NOT NULL DEFAULT 'Huevo Entero Pasteurizado',
    presentation VARCHAR(100) NOT NULL DEFAULT 'cubeta 30LB',
    quantity_lbs DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    required_delivery_date DATE NOT NULL,
    status ENUM('pendiente', 'programado', 'en_proceso', 'entregado', 'cancelado') NOT NULL DEFAULT 'pendiente',
    price_per_lb DECIMAL(8,4) NOT NULL DEFAULT 0.0000,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_eco_comp_date (company_id, required_delivery_date),
    INDEX idx_eco_comp_status (company_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Registrar opción en menu_items para Calendario de Producción si no existe
INSERT INTO menu_items (label, path, icon, parent_id, permission_key, hide_in_menu, sort_order, is_active)
SELECT 'Calendario de Producción', '/industrial/calendario', 'Calendar', 67, 'manage_production', 0, 3, 1
WHERE NOT EXISTS (
    SELECT 1 FROM menu_items WHERE path = '/industrial/calendario'
);
