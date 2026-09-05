-- ============================================================================
-- MIGRACIÓN V159: MEJORAS INTEGRALES DEL MÓDULO INDUSTRIAL HUEVO (LITERALES A - F)
-- ============================================================================

-- 1. Ampliación de egg_raw_materials para pesaje de tarimas y control de transporte LOG-004
ALTER TABLE egg_raw_materials 
    ADD COLUMN truck_temperature_c DECIMAL(5,2) NULL AFTER temperature_c,
    ADD COLUMN truck_plate VARCHAR(50) NULL AFTER truck_temperature_c,
    ADD COLUMN driver_name VARCHAR(100) NULL AFTER truck_plate,
    ADD COLUMN total_boxes INT DEFAULT 0 AFTER weight_lbs,
    ADD COLUMN tarimas_json JSON NULL AFTER certificate_urls;

-- 2. Detalle de tarimas para recepción (opcional relación normalizada)
CREATE TABLE IF NOT EXISTS egg_raw_material_tarimas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    raw_material_id INT NOT NULL,
    tarima_number INT NOT NULL,
    gross_weight_lbs DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tare_weight_lbs DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    net_weight_lbs DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    boxes_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ermt_rm (raw_material_id),
    INDEX idx_ermt_comp (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Ampliación de egg_production_batches para receta BOM e identificación oficial
ALTER TABLE egg_production_batches
    ADD COLUMN batch_code_display VARCHAR(100) NULL AFTER batch_uuid,
    ADD COLUMN ingredients_json JSON NULL AFTER presentation,
    ADD COLUMN target_brix DECIMAL(5,2) NULL AFTER waste_loss_lbs,
    ADD COLUMN measured_brix DECIMAL(5,2) NULL AFTER target_brix,
    ADD COLUMN target_solids_pct DECIMAL(5,2) NULL AFTER measured_brix,
    ADD COLUMN measured_solids_pct DECIMAL(5,2) NULL AFTER target_solids_pct;

-- 4. Ampliación de egg_packaging_records para zonas de frío y tipo de etiqueta
ALTER TABLE egg_packaging_records
    ADD COLUMN warehouse_zone ENUM('BLAST','COOLER','HOLDING') DEFAULT 'COOLER' AFTER units_packaged,
    ADD COLUMN product_state ENUM('liquido','congelado') DEFAULT 'liquido' AFTER warehouse_zone,
    ADD COLUMN label_type VARCHAR(50) DEFAULT 'etiqueta_4x2' AFTER barcode,
    ADD COLUMN customer_destination VARCHAR(100) NULL AFTER label_type;

-- 5. Tabla de Laboratorio & Calidad Microbiológica LAB-004
CREATE TABLE IF NOT EXISTS egg_lab_micro_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    batch_id INT NOT NULL,
    sample_date DATE NOT NULL,
    mesophilic_aerobic_cfu INT DEFAULT NULL COMMENT 'Recuento de Aeróbicos Mesófilos UFC/g (<10,000)',
    total_coliforms_mpn DECIMAL(8,2) DEFAULT NULL COMMENT 'Coliformes Totales NMP/g (<10)',
    e_coli_mpn DECIMAL(8,2) DEFAULT NULL COMMENT 'Escherichia Coli NMP/g (<10 o Ausencia)',
    salmonella_25g ENUM('ausencia','presencia') DEFAULT 'ausencia' COMMENT 'Salmonella en 25g',
    fungi_yeasts_cfu INT DEFAULT NULL COMMENT 'Hongos y Levaduras UFC/g (<100)',
    ph DECIMAL(4,2) DEFAULT NULL,
    brix DECIMAL(4,2) DEFAULT NULL,
    solids_percentage DECIMAL(5,2) DEFAULT NULL,
    status ENUM('aprobado','cuarentena','rechazado','observacion') DEFAULT 'aprobado',
    observations TEXT NULL,
    analyst_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_elml_batch (batch_id),
    INDEX idx_elml_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Configuración de Costeo por Libra (Parámetros Generales)
CREATE TABLE IF NOT EXISTS egg_costing_configurations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_label VARCHAR(150) NOT NULL,
    setting_value DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    unit_label VARCHAR(50) DEFAULT 'USD',
    category VARCHAR(50) DEFAULT 'general',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_ecc_key (company_id, setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Catálogo de Insumos / Químicos CIP para Costeo
CREATE TABLE IF NOT EXISTS egg_costing_cip_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    presentation_qty DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    presentation_unit VARCHAR(50) NOT NULL DEFAULT 'kg',
    presentation_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    dose_per_batch DECIMAL(10,3) NOT NULL DEFAULT 0.000,
    dose_unit VARCHAR(50) NOT NULL DEFAULT 'kg',
    status ENUM('activo','inactivo') DEFAULT 'activo',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ecci_comp (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Catálogo de Empaques y Materiales
CREATE TABLE IF NOT EXISTS egg_costing_packaging (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    item_code VARCHAR(50) NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    unit_cost DECIMAL(8,4) NOT NULL DEFAULT 0.0000,
    category ENUM('recipiente','tapadera','liner','etiqueta','cinta','otro') DEFAULT 'recipiente',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_ecp_code (company_id, item_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Acuerdos de Precios con Clientes & Semáforo de Margen
CREATE TABLE IF NOT EXISTS egg_costing_customer_agreements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    customer_id INT NULL,
    customer_name VARCHAR(150) NOT NULL,
    product_type VARCHAR(100) NOT NULL,
    presentation VARCHAR(100) NOT NULL DEFAULT 'cubeta 30LB',
    agreed_price_per_lb DECIMAL(8,4) NOT NULL DEFAULT 0.0000,
    monthly_volume_lbs DECIMAL(12,2) DEFAULT 0.00,
    target_margin_pct DECIMAL(5,2) DEFAULT 20.00,
    freight_cost_per_lb DECIMAL(8,4) DEFAULT 0.0000,
    payment_terms_days INT DEFAULT 30,
    notes TEXT NULL,
    status ENUM('activo','inactivo') DEFAULT 'activo',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ecca_comp (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Escenarios Guardados de Simulación de Costeo
CREATE TABLE IF NOT EXISTS egg_costing_scenarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    scenario_name VARCHAR(150) NOT NULL,
    product_type VARCHAR(100) NOT NULL,
    presentation VARCHAR(100) NOT NULL,
    base_raw_egg_cost_per_box DECIMAL(8,2) NOT NULL DEFAULT 38.00,
    batch_size_lbs DECIMAL(10,2) NOT NULL DEFAULT 12000.00,
    yield_liquid_pct DECIMAL(5,2) NOT NULL DEFAULT 83.00,
    calculated_cost_per_lb DECIMAL(8,4) NOT NULL DEFAULT 0.0000,
    target_sale_price_per_lb DECIMAL(8,4) NOT NULL DEFAULT 0.0000,
    margin_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    full_breakdown_json JSON NOT NULL,
    created_by VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ecs_comp (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Control de Cubetas y Tapaderas Retornables por Cliente
CREATE TABLE IF NOT EXISTS egg_returnable_packaging (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    customer_id INT NULL,
    customer_name VARCHAR(150) NOT NULL,
    packaging_type ENUM('cubeta_30lb','tapadera','cubeta_32lb','otra') DEFAULT 'cubeta_30lb',
    initial_balance INT DEFAULT 0,
    delivered_qty INT DEFAULT 0,
    returned_qty INT DEFAULT 0,
    current_balance INT GENERATED ALWAYS AS (initial_balance + delivered_qty - returned_qty) STORED,
    last_movement_date DATE NULL,
    notes TEXT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_erp_cust (company_id, customer_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Movimientos detallados de empaque retornable
CREATE TABLE IF NOT EXISTS egg_returnable_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    returnable_id INT NOT NULL,
    movement_type ENUM('entrega','devolucion','ajuste') NOT NULL,
    quantity INT NOT NULL,
    reference_document VARCHAR(100) NULL COMMENT 'Remisión / Factura / Conduce',
    notes TEXT NULL,
    registered_by VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_erm_parent (returnable_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Población inicial de configuraciones de costeo (Valores del modelo COSTEO POR LIBRA de ANDELSA)
INSERT IGNORE INTO egg_costing_configurations (company_id, setting_key, setting_label, setting_value, unit_label, category)
VALUES 
    (1, 'monthly_gif_total', 'Gastos Indirectos de Fabricación (GIF) Mensual', 24537.0000, 'USD/mes', 'gif'),
    (1, 'monthly_projected_lbs', 'Volumen Base Mensual Proyectado', 100000.0000, 'LBS', 'gif'),
    (1, 'boiler_diesel_gal_batch', 'Consumo Diesel Caldera por Batch', 20.8400, 'Galones', 'boiler'),
    (1, 'boiler_diesel_price_gal', 'Precio Diesel por Galón', 4.1400, 'USD/Gal', 'boiler'),
    (1, 'boiler_kwh_cost_batch', 'Costo Electricidad Pasteurizador/Caldera', 386.0000, 'USD/batch', 'boiler'),
    (1, 'boiler_water_cost_batch', 'Costo Agua Suavizada Caldera', 17.3400, 'USD/batch', 'boiler'),
    (1, 'mod_cost_per_lb', 'Mano de Obra Directa (MOD) por Libra', 0.0500, 'USD/LB', 'labor'),
    (1, 'he_plus_citric_acid_pct', 'Dosis Ácido Cítrico HE Plus', 0.0010, '% p/p', 'additive'),
    (1, 'yolk_sugar_pct', 'Porcentaje Azúcar Yema Azucarada', 0.0400, '% p/p', 'additive'),
    (1, 'standard_batch_weight_lbs', 'Peso Batch Estándar', 12000.0000, 'LBS', 'production');

-- 14. Población inicial de Químicos CIP
INSERT IGNORE INTO egg_costing_cip_items (company_id, item_name, presentation_qty, presentation_unit, presentation_cost, dose_per_batch, dose_unit)
VALUES
    (1, 'Soda Cáustica (Hidróxido de Sodio)', 250.00, 'kg', 262.50, 15.000, 'kg'),
    (1, 'Hipoclorito de Sodio 13%', 55.00, 'gal', 66.00, 3.500, 'gal'),
    (1, 'Ácido Fosfórico / Nítrico (Desincrustante)', 60.00, 'kg', 145.00, 4.000, 'kg'),
    (1, 'Detergente Espumante Clean Foam', 20.00, 'kg', 55.00, 2.000, 'kg');

-- 15. Población inicial de Empaques
INSERT IGNORE INTO egg_costing_packaging (company_id, item_code, item_name, unit_cost, category)
VALUES
    (1, 'CUBETA-30LB', 'Cubeta Plástica Blanca 30 LBS Grado Alimenticio', 2.4000, 'recipiente'),
    (1, 'TAPA-30LB', 'Tapadera Hermética para Cubeta 30 LBS', 0.6500, 'tapadera'),
    (1, 'LINER-30LB', 'Bolsa Plástica Liner Polietileno Virgen', 0.3000, 'liner'),
    (1, 'ETIQ-4X2', 'Etiqueta Térmica Polipropileno 4x2 Pulgadas', 0.0350, 'etiqueta'),
    (1, 'ETIQ-4X4', 'Etiqueta Térmica de Lote y Trazabilidad 4x4 Pulgadas', 0.0500, 'etiqueta'),
    (1, 'GALON-8LB', 'Envase Plástico Galón 8 LBS con Asa', 0.8500, 'recipiente'),
    (1, 'TAPA-GALON', 'Tapa con Sello de Seguridad para Galón', 0.1500, 'tapadera');

-- 16. Población inicial de Acuerdos de Clientes (Clientes Reales ANDELSA)
INSERT IGNORE INTO egg_costing_customer_agreements (company_id, customer_name, product_type, presentation, agreed_price_per_lb, monthly_volume_lbs, target_margin_pct, notes)
VALUES
    (1, 'PriceSmart El Salvador', 'Huevo Entero Pasteurizado', 'cubeta 30LB', 1.1900, 35000.00, 22.00, 'Contrato corporativo, entrega refrigerada en centros de distribución'),
    (1, 'Panadería y Pastelería Lorena', 'Huevo Entero Plus', 'cubeta 30LB', 1.0500, 20000.00, 18.00, 'Despacho semanal, devolución de cubetas'),
    (1, 'Cocina de Vuelos (Gate Gourmet)', 'Huevo con Leche Pasteurizado', 'galón 8LB', 1.2000, 15000.00, 25.00, 'Especificación de vuelo, empaque galón con sello'),
    (1, 'Denny\'s El Salvador', 'Clara de Huevo Pasteurizada', 'galón 8LB', 1.5000, 10000.00, 28.00, 'Menú fit / desayunos proteicos'),
    (1, 'Denny\'s El Salvador', 'Huevo Entero Pasteurizado', 'cubeta 30LB', 1.3500, 12000.00, 24.00, 'Consumo cocina central'),
    (1, 'Panadería La Francesa', 'Yema Azucarada', 'cubeta 30LB', 1.1500, 8000.00, 20.00, 'Uso repostería fina');
