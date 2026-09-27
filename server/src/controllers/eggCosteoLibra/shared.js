const pool = require('../../config/db');
const ensureSeedData = async (companyId) => {
    try {
        if (!companyId) return;
        const [comp] = await pool.query('SELECT id FROM companies WHERE id = ?', [companyId]);
        if (comp.length === 0) return;

        const [cRows] = await pool.query('SELECT COUNT(*) as c FROM egg_costing_configurations WHERE company_id = ?', [companyId]);
        if (cRows[0].c === 0) {
            await pool.query(`
                INSERT IGNORE INTO egg_costing_configurations (company_id, setting_key, setting_label, setting_value, unit_label, category)
                VALUES
                    (?, 'monthly_gif_total', 'Gastos Indirectos de Fabricación (GIF) Mensual', 24537.0000, 'USD/mes', 'gif'),
                    (?, 'monthly_projected_lbs', 'Volumen Base Mensual Proyectado', 100000.0000, 'LBS', 'gif'),
                    (?, 'boiler_diesel_gal_batch', 'Consumo Diesel Caldera por Batch', 20.8400, 'Galones', 'boiler'),
                    (?, 'boiler_diesel_price_gal', 'Precio Diesel por Galón', 4.1400, 'USD/Gal', 'boiler'),
                    (?, 'boiler_kwh_cost_batch', 'Costo Electricidad Pasteurizador/Caldera', 386.0000, 'USD/batch', 'boiler'),
                    (?, 'boiler_water_cost_batch', 'Costo Agua Suavizada Caldera', 17.3400, 'USD/batch', 'boiler'),
                    (?, 'mod_cost_per_lb', 'Mano de Obra Directa (MOD) por Libra', 0.0500, 'USD/LB', 'labor'),
                    (?, 'he_plus_citric_acid_pct', 'Dosis Ácido Cítrico HE Plus', 0.0010, '% p/p', 'additive'),
                    (?, 'yolk_sugar_pct', 'Porcentaje Azúcar Yema Azucarada', 0.0400, '% p/p', 'additive'),
                    (?, 'standard_batch_weight_lbs', 'Peso Batch Estándar', 12000.0000, 'LBS', 'production')
            `, [companyId, companyId, companyId, companyId, companyId, companyId, companyId, companyId, companyId, companyId]);
        }

        const [cipRows] = await pool.query('SELECT COUNT(*) as c FROM egg_costing_cip_items WHERE company_id = ?', [companyId]);
        if (cipRows[0].c === 0) {
            await pool.query(`
                INSERT IGNORE INTO egg_costing_cip_items (company_id, item_name, presentation_qty, presentation_unit, presentation_cost, dose_per_batch, dose_unit)
                VALUES
                    (?, 'Soda Cáustica (Hidróxido de Sodio)', 250.00, 'kg', 262.50, 15.000, 'kg'),
                    (?, 'Hipoclorito de Sodio 13%', 55.00, 'gal', 66.00, 3.500, 'gal'),
                    (?, 'Ácido Fosfórico / Nítrico (Desincrustante)', 60.00, 'kg', 145.00, 4.000, 'kg'),
                    (?, 'Detergente Espumante Clean Foam', 20.00, 'kg', 55.00, 2.000, 'kg')
            `, [companyId, companyId, companyId, companyId]);
        }

        const [pRows] = await pool.query('SELECT COUNT(*) as c FROM egg_costing_packaging WHERE company_id = ?', [companyId]);
        if (pRows[0].c === 0) {
            await pool.query(`
                INSERT IGNORE INTO egg_costing_packaging (company_id, item_code, item_name, unit_cost, category)
                VALUES
                    (?, 'CUBETA-30LB', 'Cubeta Plástica Blanca 30 LBS Grado Alimenticio', 2.4000, 'recipiente'),
                    (?, 'TAPA-30LB', 'Tapadera Hermética para Cubeta 30 LBS', 0.6500, 'tapadera'),
                    (?, 'LINER-30LB', 'Bolsa Plástica Liner Polietileno Virgen', 0.3000, 'liner'),
                    (?, 'ETIQ-4X2', 'Etiqueta Térmica Polipropileno 4x2 Pulgadas', 0.0350, 'etiqueta'),
                    (?, 'ETIQ-4X4', 'Etiqueta Térmica de Lote y Trazabilidad 4x4 Pulgadas', 0.0500, 'etiqueta'),
                    (?, 'GALON-8LB', 'Envase Plástico Galón 8 LBS con Asa', 0.8500, 'recipiente'),
                    (?, 'TAPA-GALON', 'Tapa con Sello de Seguridad para Galón', 0.1500, 'tapadera'),
                    (?, 'MEDIO-GALON', 'Envase Plástico Medio Galón 4 LBS', 0.5500, 'recipiente'),
                    (?, 'TAPA-MEDIO-GALON', 'Tapa con Sello para Medio Galón', 0.1000, 'tapadera'),
                    (?, 'LITRO-2LB', 'Botella Plástica Litro 2 LBS', 0.3500, 'recipiente'),
                    (?, 'TAPA-LITRO', 'Tapa con Sello para Botella 2 LBS', 0.0800, 'tapadera'),
                    (?, 'MEDIO-LITRO-1LB', 'Botella Plástica Medio Litro 1 LB', 0.2500, 'recipiente'),
                    (?, 'TAPA-MEDIO-LITRO', 'Tapa con Sello para Botella 1 LB', 0.0500, 'tapadera')
            `, [companyId, companyId, companyId, companyId, companyId, companyId, companyId]);
        }

        // Asegurar columnas de vinculación con productos y compras
        const [cipCols] = await pool.query("SHOW COLUMNS FROM egg_costing_cip_items LIKE 'product_id'");
        if (cipCols.length === 0) {
            await pool.query("ALTER TABLE egg_costing_cip_items ADD COLUMN product_id INT NULL AFTER company_id");
        }
        const [packCols] = await pool.query("SHOW COLUMNS FROM egg_costing_packaging LIKE 'product_id'");
        if (packCols.length === 0) {
            await pool.query("ALTER TABLE egg_costing_packaging ADD COLUMN product_id INT NULL AFTER company_id");
        }

        // Asegurar columnas de vigencia en egg_costing_customer_agreements
        const [agrCols] = await pool.query("SHOW COLUMNS FROM egg_costing_customer_agreements LIKE 'valid_from'");
        if (agrCols.length === 0) {
            await pool.query('ALTER TABLE egg_costing_customer_agreements ADD COLUMN valid_from DATE NULL DEFAULT NULL AFTER target_margin_pct');
        }
        const [agrColsTo] = await pool.query("SHOW COLUMNS FROM egg_costing_customer_agreements LIKE 'valid_to'");
        if (agrColsTo.length === 0) {
            await pool.query('ALTER TABLE egg_costing_customer_agreements ADD COLUMN valid_to DATE NULL DEFAULT NULL AFTER valid_from');
        }

        // Asegurar tabla de auditoría e historial de acuerdos de clientes
        await pool.query(`
            CREATE TABLE IF NOT EXISTS egg_costing_agreement_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                agreement_id INT NOT NULL,
                company_id INT NOT NULL,
                customer_id INT NULL,
                customer_name VARCHAR(150) NOT NULL,
                product_id INT NULL,
                product_type VARCHAR(100) NOT NULL,
                presentation VARCHAR(100) NOT NULL DEFAULT 'cubeta 30LB',
                agreed_price_per_lb DECIMAL(8,4) NOT NULL DEFAULT 0.0000,
                agreed_unit_price DECIMAL(10,4) NULL,
                monthly_volume_lbs DECIMAL(12,2) DEFAULT 0.00,
                target_margin_pct DECIMAL(5,2) DEFAULT 20.00,
                freight_cost_per_lb DECIMAL(8,4) DEFAULT 0.0000,
                payment_terms_days INT DEFAULT 30,
                valid_from DATE NULL,
                valid_to DATE NULL,
                change_reason VARCHAR(255) NULL,
                recorded_by VARCHAR(100) NULL,
                notes TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ecah_agr (agreement_id),
                INDEX idx_ecah_comp (company_id),
                INDEX idx_ecah_cust (customer_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
    } catch (err) {
        console.warn('Advertencia en ensureSeedData:', err.message);
    }
};
module.exports = { pool, ensureSeedData };
