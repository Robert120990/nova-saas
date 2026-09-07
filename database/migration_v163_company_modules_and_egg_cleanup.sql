-- ============================================================================
-- MIGRACIÓN V163: VISIBILIDAD DE MÓDULOS POR EMPRESA Y AISLAMIENTO DE HUEVO / CRM
-- ============================================================================

-- 1. Agregar columna enabled_modules a la tabla companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS enabled_modules JSON NULL AFTER dte_active;

-- 2. Limpieza de datos de CRM y Huevo Industrial en empresas no avícolas (IDs 1, 2, 8)
-- Los datos de CRM y ovoproductos quedan única y exclusivamente para ANDELSA (Empresa 9).
DELETE FROM egg_costing_customer_agreements WHERE company_id != 9;
DELETE FROM egg_costing_configurations WHERE company_id != 9;
DELETE FROM egg_costing_cip_items WHERE company_id != 9;
DELETE FROM egg_costing_packaging WHERE company_id != 9;
DELETE FROM egg_costing_scenarios WHERE company_id != 9;
DELETE FROM egg_raw_materials WHERE company_id != 9;
DELETE FROM egg_production_batches WHERE company_id != 9;
DELETE FROM egg_cip_logs WHERE company_id != 9;
DELETE FROM egg_industrial_costs WHERE company_id != 9;
DELETE FROM egg_batch_variable_costs WHERE company_id != 9;
DELETE FROM egg_packaging_records WHERE company_id != 9;
DELETE FROM egg_pasteurization_logs WHERE company_id != 9;
DELETE FROM egg_blast_freezer_logs WHERE company_id != 9;
DELETE FROM egg_industrial_events WHERE company_id != 9;
DELETE FROM egg_lab_micro_logs WHERE company_id != 9;
DELETE FROM egg_returnable_packaging WHERE company_id != 9;
DELETE FROM egg_returnable_movements WHERE company_id != 9;
DELETE FROM egg_scheduled_productions WHERE company_id != 9;
DELETE FROM egg_scheduled_tasks WHERE company_id != 9;
DELETE FROM egg_customer_orders WHERE company_id != 9;
DELETE FROM egg_product_config WHERE company_id != 9;

-- 3. Configuración inicial de módulos por empresa
-- Gasolineras (Empresas 1, 2, 8):
UPDATE companies 
SET enabled_modules = JSON_ARRAY('sales', 'purchases', 'inventory', 'gas_station', 'accounting', 'human_resources')
WHERE id IN (1, 2, 8);

-- ANDELSA (Empresa 9):
UPDATE companies 
SET enabled_modules = JSON_ARRAY('sales', 'purchases', 'inventory', 'egg_industrial', 'crm', 'accounting', 'human_resources')
WHERE id = 9;

-- Cualquier otra empresa sin módulos definidos:
UPDATE companies 
SET enabled_modules = JSON_ARRAY('sales', 'purchases', 'inventory', 'accounting', 'human_resources')
WHERE enabled_modules IS NULL;

-- 4. Registrar ítem de menú para "Módulos por Empresa" en Configuración (parent_id: 121)
INSERT IGNORE INTO menu_items (id, parent_id, label, path, icon, permission_key, extra_permissions, sort_order, is_active, hide_in_menu)
VALUES (178, 121, 'Módulos por Empresa', '/configuracion/modulos-empresa', 'Layers', 'manage_company_modules', NULL, 2, 1, 0)
ON DUPLICATE KEY UPDATE 
    parent_id = 121,
    label = 'Módulos por Empresa',
    path = '/configuracion/modulos-empresa',
    icon = 'Layers',
    permission_key = 'manage_company_modules',
    sort_order = 2,
    is_active = 1,
    hide_in_menu = 0;
