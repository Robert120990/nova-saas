-- Migración v167: Acceso definitivo a CRM y Calendario Industrial
-- Corrige enlaces de menús huérfanos, permisos y módulos activos

-- 1. Asegurar grupo raíz Huevo Industrial activo
UPDATE menu_items 
SET permission_key = NULL, is_active = 1, hide_in_menu = 0 
WHERE parent_id IS NULL AND (label = 'Huevo Industrial' OR label LIKE '%Industrial%' OR label LIKE '%Huevo%');

-- 2. Asegurar grupo raíz CRM activo
UPDATE menu_items 
SET permission_key = NULL, is_active = 1, hide_in_menu = 0 
WHERE parent_id IS NULL AND label = 'CRM';

-- 3. Asegurar submenú Calendario de Producción activo
UPDATE menu_items 
SET is_active = 1, hide_in_menu = 0, permission_key = 'manage_production_calendar'
WHERE path = '/industrial/calendario';

-- 4. Asegurar submenú Acuerdos con Clientes activo
UPDATE menu_items 
SET is_active = 1, hide_in_menu = 0, permission_key = 'manage_customer_agreements'
WHERE path = '/crm/acuerdos';

-- 4.1. Asegurar submenú Configuración de CRM activo
INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
SELECT 
    (SELECT id FROM menu_items WHERE parent_id IS NULL AND label = 'CRM' LIMIT 1),
    'Configuración de CRM',
    '/crm/configuracion',
    'Settings',
    'manage_crm_settings',
    2,
    1,
    0
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE path = '/crm/configuracion');

UPDATE menu_items 
SET is_active = 1, hide_in_menu = 0, permission_key = 'manage_crm_settings'
WHERE path = '/crm/configuracion';

-- 5. Vincular Calendario de Producción con el grupo raíz Huevo Industrial
UPDATE menu_items 
SET parent_id = (
    SELECT id FROM (
        SELECT id FROM menu_items 
        WHERE parent_id IS NULL AND (label = 'Huevo Industrial' OR label LIKE '%Industrial%' OR label LIKE '%Huevo%')
        ORDER BY id ASC LIMIT 1
    ) AS tmp_industrial
)
WHERE path = '/industrial/calendario';

-- 6. Vincular Acuerdos con Clientes y Configuración con el grupo raíz CRM
UPDATE menu_items 
SET parent_id = (
    SELECT id FROM (
        SELECT id FROM menu_items 
        WHERE parent_id IS NULL AND label = 'CRM'
        ORDER BY id ASC LIMIT 1
    ) AS tmp_crm
)
WHERE path IN ('/crm/acuerdos', '/crm/configuracion');

-- 7. Tabla de configuración comercial de CRM
CREATE TABLE IF NOT EXISTS crm_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    default_target_margin_pct DECIMAL(5,2) DEFAULT 22.00,
    default_payment_terms_days INT DEFAULT 30,
    default_freight_per_lb DECIMAL(8,4) DEFAULT 0.0000,
    min_monthly_volume_lbs DECIMAL(12,2) DEFAULT 5000.00,
    contract_alert_days INT DEFAULT 15,
    auto_apply_agreements_in_pos TINYINT(1) DEFAULT 1,
    require_supervisor_override TINYINT(1) DEFAULT 1,
    grace_period_days INT DEFAULT 5,
    default_terms_conditions TEXT NULL,
    notification_email VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_crm_settings_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

