const pool = require('../config/db');

// Helper para auto-sembrar parámetros iniciales si la empresa no tiene registros aún
const ensureSeedData = async (companyId) => {
    try {
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
                    (?, 'TAPA-GALON', 'Tapa con Sello de Seguridad para Galón', 0.1500, 'tapadera')
            `, [companyId, companyId, companyId, companyId, companyId, companyId, companyId]);
        }

        const [aRows] = await pool.query('SELECT COUNT(*) as c FROM egg_costing_customer_agreements WHERE company_id = ?', [companyId]);
        if (aRows[0].c === 0) {
            await pool.query(`
                INSERT IGNORE INTO egg_costing_customer_agreements (company_id, customer_name, product_type, presentation, agreed_price_per_lb, monthly_volume_lbs, target_margin_pct, notes)
                VALUES
                    (?, 'PriceSmart El Salvador', 'Huevo Entero Pasteurizado', 'cubeta 30LB', 1.1900, 35000.00, 22.00, 'Contrato corporativo, entrega refrigerada en centros de distribución'),
                    (?, 'Panadería y Pastelería Lorena', 'Huevo Entero Plus', 'cubeta 30LB', 1.0500, 20000.00, 18.00, 'Despacho semanal, devolución de cubetas'),
                    (?, 'Cocina de Vuelos (Gate Gourmet)', 'Huevo con Leche Pasteurizado', 'galón 8LB', 1.2000, 15000.00, 25.00, 'Especificación de vuelo, empaque galón con sello'),
                    (?, 'Denny\\'s El Salvador', 'Clara de Huevo Pasteurizada', 'galón 8LB', 1.5000, 10000.00, 28.00, 'Menú fit / desayunos proteicos'),
                    (?, 'Denny\\'s El Salvador', 'Huevo Entero Pasteurizado', 'cubeta 30LB', 1.3500, 12000.00, 24.00, 'Consumo cocina central'),
                    (?, 'Panadería La Francesa', 'Yema Azucarada', 'cubeta 30LB', 1.1500, 8000.00, 20.00, 'Uso repostería fina')
            `, [companyId, companyId, companyId, companyId, companyId, companyId]);
        }
    } catch (err) {
        console.warn('Advertencia en ensureSeedData:', err.message);
    }
};

// 1. OBTENER CONFIGURACIONES GENERALES DE COSTEO
const getCostingConfig = async (req, res) => {
    try {
        await ensureSeedData(req.company_id);
        const [rows] = await pool.query(
            'SELECT * FROM egg_costing_configurations WHERE company_id = ? ORDER BY category, id',
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. ACTUALIZAR O GUARDAR CONFIGURACIONES DE COSTEO
const updateCostingConfig = async (req, res) => {
    try {
        const { settings } = req.body; // array of { setting_key, setting_value, setting_label, unit_label, category }
        if (!Array.isArray(settings)) {
            return res.status(400).json({ message: 'Se esperaba un arreglo de configuraciones.' });
        }

        for (const item of settings) {
            await pool.query(
                `INSERT INTO egg_costing_configurations (company_id, setting_key, setting_label, setting_value, unit_label, category)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                    setting_value = VALUES(setting_value),
                    setting_label = COALESCE(VALUES(setting_label), setting_label),
                    unit_label = COALESCE(VALUES(unit_label), unit_label),
                    category = COALESCE(VALUES(category), category)`,
                [req.company_id, item.setting_key, item.setting_label || item.setting_key, item.setting_value, item.unit_label || 'USD', item.category || 'general']
            );
        }

        res.json({ message: 'Configuraciones de costeo actualizadas con éxito.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 3. CATÁLOGO DE QUÍMICOS CIP
const getCipItems = async (req, res) => {
    try {
        await ensureSeedData(req.company_id);
        const [rows] = await pool.query(
            'SELECT * FROM egg_costing_cip_items WHERE company_id = ? ORDER BY id',
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const saveCipItem = async (req, res) => {
    try {
        const { id, item_name, presentation_qty, presentation_unit, presentation_cost, dose_per_batch, dose_unit, status } = req.body;
        if (id) {
            await pool.query(
                `UPDATE egg_costing_cip_items 
                 SET item_name = ?, presentation_qty = ?, presentation_unit = ?, presentation_cost = ?, dose_per_batch = ?, dose_unit = ?, status = ?
                 WHERE id = ? AND company_id = ?`,
                [item_name, presentation_qty, presentation_unit, presentation_cost, dose_per_batch, dose_unit, status || 'activo', id, req.company_id]
            );
            res.json({ message: 'Químico CIP actualizado con éxito.', id });
        } else {
            const [result] = await pool.query(
                `INSERT INTO egg_costing_cip_items (company_id, item_name, presentation_qty, presentation_unit, presentation_cost, dose_per_batch, dose_unit, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [req.company_id, item_name, presentation_qty, presentation_unit, presentation_cost, dose_per_batch, dose_unit, status || 'activo']
            );
            res.status(201).json({ message: 'Químico CIP creado.', id: result.insertId });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteCipItem = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM egg_costing_cip_items WHERE id = ? AND company_id = ?', [id, req.company_id]);
        res.json({ message: 'Químico CIP eliminado.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 4. CATÁLOGO DE EMPAQUES
const getPackagingItems = async (req, res) => {
    try {
        await ensureSeedData(req.company_id);
        const [rows] = await pool.query(
            'SELECT * FROM egg_costing_packaging WHERE company_id = ? ORDER BY category, id',
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const savePackagingItem = async (req, res) => {
    try {
        const { id, item_code, item_name, unit_cost, category } = req.body;
        if (id) {
            await pool.query(
                `UPDATE egg_costing_packaging 
                 SET item_code = ?, item_name = ?, unit_cost = ?, category = ?
                 WHERE id = ? AND company_id = ?`,
                [item_code, item_name, unit_cost, category || 'recipiente', id, req.company_id]
            );
            res.json({ message: 'Empaque actualizado con éxito.', id });
        } else {
            const [result] = await pool.query(
                `INSERT INTO egg_costing_packaging (company_id, item_code, item_name, unit_cost, category)
                 VALUES (?, ?, ?, ?, ?)`,
                [req.company_id, item_code, item_name, unit_cost, category || 'recipiente']
            );
            res.status(201).json({ message: 'Empaque registrado.', id: result.insertId });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deletePackagingItem = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM egg_costing_packaging WHERE id = ? AND company_id = ?', [id, req.company_id]);
        res.json({ message: 'Empaque eliminado.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 5. ACUERDOS DE PRECIOS CON CLIENTES (CONTRATOS)
const getCustomerAgreements = async (req, res) => {
    try {
        await ensureSeedData(req.company_id);
        const [rows] = await pool.query(
            `SELECT a.*, c.nombre as customer_registered_name, c.telefono, c.correo as email
             FROM egg_costing_customer_agreements a
             LEFT JOIN customers c ON a.customer_id = c.id
             WHERE a.company_id = ?
             ORDER BY a.agreed_price_per_lb DESC`,
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const saveCustomerAgreement = async (req, res) => {
    try {
        const { id, customer_id, customer_name, product_type, presentation, agreed_price_per_lb, monthly_volume_lbs, target_margin_pct, freight_cost_per_lb, payment_terms_days, notes, status } = req.body;
        if (id) {
            await pool.query(
                `UPDATE egg_costing_customer_agreements 
                 SET customer_id = ?, customer_name = ?, product_type = ?, presentation = ?, agreed_price_per_lb = ?, monthly_volume_lbs = ?, target_margin_pct = ?, freight_cost_per_lb = ?, payment_terms_days = ?, notes = ?, status = ?
                 WHERE id = ? AND company_id = ?`,
                [customer_id || null, customer_name, product_type, presentation || 'cubeta 30LB', agreed_price_per_lb, monthly_volume_lbs || 0, target_margin_pct || 20, freight_cost_per_lb || 0, payment_terms_days || 30, notes || null, status || 'activo', id, req.company_id]
            );
            res.json({ message: 'Acuerdo comercial actualizado.', id });
        } else {
            const [result] = await pool.query(
                `INSERT INTO egg_costing_customer_agreements (company_id, customer_id, customer_name, product_type, presentation, agreed_price_per_lb, monthly_volume_lbs, target_margin_pct, freight_cost_per_lb, payment_terms_days, notes, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [req.company_id, customer_id || null, customer_name, product_type, presentation || 'cubeta 30LB', agreed_price_per_lb, monthly_volume_lbs || 0, target_margin_pct || 20, freight_cost_per_lb || 0, payment_terms_days || 30, notes || null, status || 'activo']
            );
            res.status(201).json({ message: 'Acuerdo comercial registrado.', id: result.insertId });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteCustomerAgreement = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM egg_costing_customer_agreements WHERE id = ? AND company_id = ?', [id, req.company_id]);
        res.json({ message: 'Acuerdo comercial eliminado.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 6. MOTOR MATEMÁTICO DE COSTEO DINÁMICO POR LIBRA
const calculateDynamicCost = async (req, res) => {
    try {
        await ensureSeedData(req.company_id);

        const {
            product_type = 'Huevo Entero Pasteurizado',
            presentation = 'cubeta 30LB',
            raw_egg_box_cost = 38.00, // Costo de caja de 360 huevos
            raw_egg_lbs_per_box = 43.50, // Peso aprox de caja
            batch_size_lbs = 12000.00, // Batch estándar
            water_added_pct = null, // % Agua directa
            sugar_added_pct = null, // % Azúcar
            salt_added_pct = null,  // % Sal
            milk_added_pct = null,  // % Leche
            base_egg_solids = null, // Sólidos base medidos refractómetro
            target_solids = null,   // Sólidos objetivo deseados
            custom_gif_monthly = null,
            custom_monthly_volume_lbs = null,
            target_sale_price_per_lb = null
        } = req.body;

        // Cargar configuraciones del sistema
        const [configRows] = await pool.query('SELECT * FROM egg_costing_configurations WHERE company_id = ?', [req.company_id]);
        const configs = {};
        configRows.forEach(c => { configs[c.setting_key] = parseFloat(c.setting_value) || 0; });

        // Cargar Químicos CIP
        const [cipRows] = await pool.query('SELECT * FROM egg_costing_cip_items WHERE company_id = ? AND status = "activo"', [req.company_id]);
        
        // Cargar Empaques
        const [packRows] = await pool.query('SELECT * FROM egg_costing_packaging WHERE company_id = ?', [req.company_id]);
        const packMap = {};
        packRows.forEach(p => { packMap[p.item_code] = parseFloat(p.unit_cost) || 0; });

        // Cargar Acuerdos de Clientes
        const [agreements] = await pool.query('SELECT * FROM egg_costing_customer_agreements WHERE company_id = ? AND status = "activo"', [req.company_id]);

        // A. CÁLCULO DE COSTO DE MATERIA PRIMA (HUEVO CÁSCARA -> LÍQUIDO)
        const safeLbsPerBox = Math.max(parseFloat(raw_egg_lbs_per_box) || 43.50, 1);
        const safeBoxCost = Math.max(parseFloat(raw_egg_box_cost) || 0, 0);
        const costPerLbRawEgg = safeBoxCost / safeLbsPerBox;
        const safeBatchSize = Math.max(parseFloat(batch_size_lbs) || 12000, 1);

        // Rendimiento base de quebrado según producto
        let liquidYieldPct = 0.83; // 83% líquido para huevo entero (17% cáscara)
        let productBase = (product_type || '').toLowerCase();

        if (productBase.includes('clara')) {
            liquidYieldPct = 0.5395;
        } else if (productBase.includes('yema')) {
            liquidYieldPct = 0.2905;
        }

        // Sólidos y Balance Hídrico
        const bSolids = parseFloat(base_egg_solids) || 24.20;
        let tSolids = parseFloat(target_solids);
        if (isNaN(tSolids) || tSolids <= 0) {
            tSolids = productBase.includes('plus') ? 21.50 : bSolids;
        }

        // Determinar % de agua a añadir
        let effectiveWaterPct = 0;
        if (productBase.includes('plus') || water_added_pct !== null || (base_egg_solids && target_solids)) {
            if (water_added_pct !== null && water_added_pct !== undefined && !isNaN(parseFloat(water_added_pct))) {
                effectiveWaterPct = Math.max(0, parseFloat(water_added_pct)) / 100;
                // Si el agua fue ingresada directamente, calcular sólidos resultantes
                tSolids = bSolids * (1 - effectiveWaterPct);
            } else if (bSolids > tSolids && bSolids > 0) {
                // Fórmula estequiométrica: % Agua = ((Sólidos Base - Sólidos Target) / Sólidos Base) * 100
                effectiveWaterPct = Math.max(0, (bSolids - tSolids) / bSolids);
            } else if (productBase.includes('plus')) {
                effectiveWaterPct = 0.08; // 8% estándar ANDELSA
                tSolids = bSolids * (1 - effectiveWaterPct);
            }
        }

        // Otros aditivos
        let effectiveSugarPct = (sugar_added_pct !== null && sugar_added_pct !== undefined && !isNaN(parseFloat(sugar_added_pct)))
            ? Math.max(0, parseFloat(sugar_added_pct)) / 100
            : (productBase.includes('azucarada') ? 0.04 : 0);

        let effectiveSaltPct = (salt_added_pct !== null && salt_added_pct !== undefined && !isNaN(parseFloat(salt_added_pct)))
            ? Math.max(0, parseFloat(salt_added_pct)) / 100
            : (productBase.includes('salada') ? 0.10 : 0);

        let effectiveMilkPct = (milk_added_pct !== null && milk_added_pct !== undefined && !isNaN(parseFloat(milk_added_pct)))
            ? Math.max(0, parseFloat(milk_added_pct)) / 100
            : (productBase.includes('leche') ? 0.05 : 0);

        // Costo del huevo líquido puro por libra
        let baseLiquidCostPerLb = costPerLbRawEgg / Math.max(liquidYieldPct, 0.01);

        // Costo de aditivos por libra
        let additiveCostPerLb = 0;
        if (effectiveSugarPct > 0) additiveCostPerLb += effectiveSugarPct * 0.45; // Azúcar $0.45/lb
        if (effectiveSaltPct > 0) additiveCostPerLb += effectiveSaltPct * 0.15; // Sal $0.15/lb
        if (effectiveMilkPct > 0) additiveCostPerLb += effectiveMilkPct * 1.80; // Leche en polvo $1.80/lb
        if (effectiveWaterPct > 0) {
            // Agua purificada ($0.001/lb) + Ácido cítrico 0.1% a $1.50/lb de insumo ($0.0015/lb producto)
            additiveCostPerLb += (effectiveWaterPct * 0.001) + 0.0015;
        }

        const effectivePureEggFraction = Math.max(0, 1 - effectiveWaterPct - effectiveSugarPct - effectiveSaltPct - effectiveMilkPct);
        const mpCostPerLb = (baseLiquidCostPerLb * effectivePureEggFraction) + additiveCostPerLb;

        // Desglose de formulación física para el batch
        const formulation = {
            product_type,
            base_liquid_pure_lbs: safeBatchSize * effectivePureEggFraction,
            water_added_pct: effectiveWaterPct * 100,
            water_lbs: safeBatchSize * effectiveWaterPct,
            water_garrafones: (safeBatchSize * effectiveWaterPct) / 42.0,
            citric_acid_pct: effectiveWaterPct > 0 ? 0.10 : 0,
            citric_acid_lbs: effectiveWaterPct > 0 ? safeBatchSize * 0.001 : 0,
            sugar_pct: effectiveSugarPct * 100,
            sugar_lbs: safeBatchSize * effectiveSugarPct,
            salt_pct: effectiveSaltPct * 100,
            salt_lbs: safeBatchSize * effectiveSaltPct,
            milk_pct: effectiveMilkPct * 100,
            milk_lbs: safeBatchSize * effectiveMilkPct,
            base_egg_solids: bSolids,
            target_solids: tSolids,
            is_solids_compliant: tSolids >= 21.0,
            pure_egg_cost_per_lb: baseLiquidCostPerLb,
            formulated_mp_cost_per_lb: mpCostPerLb,
            mp_cost_savings_per_lb: Math.max(0, baseLiquidCostPerLb - mpCostPerLb)
        };

        // B. COSTO DE EMPAQUE POR LIBRA SEGÚN PRESENTACIÓN
        let packagingCostPerUnit = 0;
        let presentationLbs = 30.0;

        const presLower = (presentation || '').toLowerCase();
        if (presLower.includes('30')) {
            presentationLbs = 30.0;
            packagingCostPerUnit = (packMap['CUBETA-30LB'] || 2.40) + 
                                  (packMap['TAPA-30LB'] || 0.65) + 
                                  (packMap['LINER-30LB'] || 0.30) + 
                                  (packMap['ETIQ-4X2'] || 0.035);
        } else if (presLower.includes('32')) {
            presentationLbs = 32.0;
            packagingCostPerUnit = (packMap['CUBETA-30LB'] || 2.40) + 
                                  (packMap['TAPA-30LB'] || 0.65) + 
                                  (packMap['LINER-30LB'] || 0.30) + 
                                  (packMap['ETIQ-4X2'] || 0.035);
        } else if (presLower.includes('8') || presLower.includes('galón') || presLower.includes('galon')) {
            presentationLbs = 8.0;
            packagingCostPerUnit = (packMap['GALON-8LB'] || 0.85) + 
                                  (packMap['TAPA-GALON'] || 0.15) + 
                                  (packMap['ETIQ-4X2'] || 0.035);
        } else if (presLower.includes('4') || presLower.includes('medio gal')) {
            presentationLbs = 4.0;
            packagingCostPerUnit = 0.55 + 0.10 + 0.035;
        } else if (presLower.includes('2') || presLower.includes('litro')) {
            presentationLbs = 2.0;
            packagingCostPerUnit = 0.35 + 0.08 + 0.035;
        } else {
            presentationLbs = 1.0;
            packagingCostPerUnit = 0.25 + 0.05 + 0.035;
        }

        const packagingCostPerLb = packagingCostPerUnit / Math.max(presentationLbs, 0.1);

        // C. COSTO DE LIMPIEZA CIP POR BATCH Y POR LIBRA
        let totalCipBatchCost = 0;
        cipRows.forEach(item => {
            const unitPrice = parseFloat(item.presentation_cost) / (parseFloat(item.presentation_qty) || 1);
            totalCipBatchCost += unitPrice * parseFloat(item.dose_per_batch);
        });
        if (totalCipBatchCost === 0) totalCipBatchCost = 50.85;
        const cipCostPerLb = totalCipBatchCost / safeBatchSize;

        // D. COSTO DE CALDERA, ENERGÍA, DIESEL Y AGUA (PASTEURIZADOR)
        const dieselGal = configs.boiler_diesel_gal_batch || 20.84;
        const dieselPrice = configs.boiler_diesel_price_gal || 4.14;
        const dieselTotal = dieselGal * dieselPrice;
        const electricityTotal = configs.boiler_kwh_cost_batch || 386.00;
        const waterTotal = configs.boiler_water_cost_batch || 17.34;
        const totalBoilerEnergyBatchCost = dieselTotal + electricityTotal + waterTotal;
        const boilerEnergyCostPerLb = totalBoilerEnergyBatchCost / safeBatchSize;

        // E. MANO DE OBRA DIRECTA (MOD)
        const modCostPerLb = configs.mod_cost_per_lb || 0.0500;

        // F. GASTOS INDIRECTOS DE FABRICACIÓN (GIF) PRORRATEADOS
        const monthlyGifTotal = custom_gif_monthly !== null ? custom_gif_monthly : (configs.monthly_gif_total || 24537.00);
        const monthlyProjectedLbs = Math.max(custom_monthly_volume_lbs !== null ? custom_monthly_volume_lbs : (configs.monthly_projected_lbs || 100000.00), 1);
        const gifCostPerLb = monthlyGifTotal / monthlyProjectedLbs;

        // G. COSTO TOTAL POR LIBRA
        const totalCostPerLb = mpCostPerLb + packagingCostPerLb + cipCostPerLb + boilerEnergyCostPerLb + modCostPerLb + gifCostPerLb;

        // H. ANÁLISIS DE RENTABILIDAD CON CLIENTES
        const clientsComparison = agreements.map(agr => {
            const clientPrice = parseFloat(agr.agreed_price_per_lb) || 0;
            const freight = parseFloat(agr.freight_cost_per_lb) || 0;
            const effectiveCost = totalCostPerLb + freight;
            const marginPerLb = clientPrice - effectiveCost;
            const marginPct = clientPrice > 0 ? (marginPerLb / clientPrice) * 100 : 0;

            let status = 'red';
            if (marginPct >= (parseFloat(agr.target_margin_pct) || 20)) {
                status = 'green';
            } else if (marginPct >= 10) {
                status = 'yellow';
            }

            let bonoRate = 0;
            if (marginPct >= 20) bonoRate = 0.015;
            else if (marginPct >= 15) bonoRate = 0.010;
            else if (marginPct >= 10) bonoRate = 0.005;

            const monthlyVol = parseFloat(agr.monthly_volume_lbs) || 0;
            const monthlyRevenue = monthlyVol * clientPrice;
            const monthlyProfit = monthlyVol * marginPerLb;
            const simulatedBonus = monthlyRevenue * bonoRate;

            return {
                id: agr.id,
                customer_name: agr.customer_name,
                product_type: agr.product_type,
                presentation: agr.presentation,
                agreed_price: clientPrice,
                freight_per_lb: freight,
                effective_cost: effectiveCost,
                margin_per_lb: marginPerLb,
                margin_pct: marginPct,
                target_margin_pct: parseFloat(agr.target_margin_pct) || 20,
                status,
                monthly_volume_lbs: monthlyVol,
                monthly_revenue: monthlyRevenue,
                monthly_profit: monthlyProfit,
                simulated_bonus: simulatedBonus,
                bono_rate_pct: bonoRate * 100
            };
        });

        // Matriz de Precios Sugeridos por Margen (10%, 15%, 20%, 25%, 30%)
        const marginTargets = [10, 15, 20, 25, 30];
        const marginMatrix = marginTargets.map(pct => {
            const suggestedPrice = totalCostPerLb > 0 ? totalCostPerLb / (1 - (pct / 100)) : 0;
            const gainPerLb = suggestedPrice - totalCostPerLb;
            const batchGain = gainPerLb * safeBatchSize;
            return {
                margin_target_pct: pct,
                suggested_price_per_lb: suggestedPrice,
                suggested_price_per_presentation: suggestedPrice * presentationLbs,
                gain_per_lb: gainPerLb,
                batch_gain: batchGain
            };
        });

        // Simulación con precio libre
        const targetPrice = parseFloat(target_sale_price_per_lb) || 0;
        const marginLb = targetPrice - totalCostPerLb;
        const marginPct = targetPrice > 0 ? (marginLb / targetPrice) * 100 : 0;
        const targetSimulation = {
            price: targetPrice,
            cost: totalCostPerLb,
            margin_per_lb: marginLb,
            margin_pct: marginPct,
            status: marginPct >= 20 ? 'green' : (marginPct >= 10 ? 'yellow' : 'red'),
            margin_matrix: marginMatrix
        };

        res.json({
            product_type,
            presentation,
            presentation_lbs: presentationLbs,
            batch_size_lbs,
            raw_egg_box_cost,
            breakdown: {
                mp_cost_per_lb: mpCostPerLb,
                packaging_cost_per_lb: packagingCostPerLb,
                packaging_cost_per_unit: packagingCostPerUnit,
                cip_cost_per_lb: cipCostPerLb,
                cip_total_batch_cost: totalCipBatchCost,
                boiler_energy_cost_per_lb: boilerEnergyCostPerLb,
                boiler_total_batch_cost: totalBoilerEnergyBatchCost,
                mod_cost_per_lb: modCostPerLb,
                gif_cost_per_lb: gifCostPerLb,
                gif_monthly_total: monthlyGifTotal,
                total_cost_per_lb: totalCostPerLb,
                cost_per_unit: totalCostPerLb * presentationLbs
            },
            formulation,
            clients_comparison: clientsComparison,
            target_simulation: targetSimulation,
            parameters_used: {
                liquid_yield_pct: liquidYieldPct * 100,
                water_added_pct: effectiveWaterPct * 100,
                sugar_added_pct: effectiveSugarPct * 100,
                salt_added_pct: effectiveSaltPct * 100,
                milk_added_pct: effectiveMilkPct * 100,
                base_egg_solids: bSolids,
                target_solids: tSolids,
                monthly_projected_lbs: monthlyProjectedLbs,
                monthly_gif: monthlyGifTotal
            }
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 7. ESCENARIOS GUARDADOS DE COSTEO
const getScenarios = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM egg_costing_scenarios WHERE company_id = ? ORDER BY created_at DESC',
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const saveScenario = async (req, res) => {
    try {
        const { scenario_name, product_type, presentation, base_raw_egg_cost_per_box, batch_size_lbs, yield_liquid_pct, calculated_cost_per_lb, target_sale_price_per_lb, margin_pct, full_breakdown_json } = req.body;
        const [result] = await pool.query(
            `INSERT INTO egg_costing_scenarios (company_id, scenario_name, product_type, presentation, base_raw_egg_cost_per_box, batch_size_lbs, yield_liquid_pct, calculated_cost_per_lb, target_sale_price_per_lb, margin_pct, full_breakdown_json, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.company_id, scenario_name, product_type, presentation, base_raw_egg_cost_per_box, batch_size_lbs, yield_liquid_pct, calculated_cost_per_lb, target_sale_price_per_lb, margin_pct, JSON.stringify(full_breakdown_json || {}), req.user?.nombre || 'Analista de Costos']
        );
        res.status(201).json({ id: result.insertId, message: 'Escenario guardado con éxito.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteScenario = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM egg_costing_scenarios WHERE id = ? AND company_id = ?', [id, req.company_id]);
        res.json({ message: 'Escenario eliminado.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 8. HISTÓRICO DE COSTOS Y MIX DE PRODUCTO
const getCostingHistory = async (req, res) => {
    try {
        // Datos agregados por mes desde egg_production_batches y egg_industrial_costs
        const [history] = await pool.query(
            `SELECT 
                DATE_FORMAT(b.started_at, '%Y-%m') as period,
                b.product_type,
                COUNT(b.id) as batches_count,
                SUM(b.input_weight_lbs) as total_input_lbs,
                SUM(b.yield_liquid_lbs) as total_yield_lbs,
                COALESCE(SUM(c.total_cost), 0) as total_cost,
                CASE WHEN SUM(b.yield_liquid_lbs) > 0 
                     THEN COALESCE(SUM(c.total_cost), 0) / SUM(b.yield_liquid_lbs) 
                     ELSE 0 END as avg_cost_per_lb
             FROM egg_production_batches b
             LEFT JOIN egg_industrial_costs c ON b.id = c.batch_id
             WHERE b.company_id = ?
             GROUP BY period, b.product_type
             ORDER BY period DESC, b.product_type ASC
             LIMIT 24`,
            [req.company_id]
        );
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 9. COSTO ACTUAL REAL DE OPERACIÓN (EN VIVO SEGÚN RECEPCIONES, PRODUCCIÓN Y VENTAS)
const getActualOperationalCost = async (req, res) => {
    try {
        await ensureSeedData(req.company_id);

        // 1. Recepciones de Materia Prima (Huevo Cáscara)
        const [rawStats] = await pool.query(
            `SELECT 
                COUNT(*) as total_receptions,
                COALESCE(SUM(weight_lbs), 0) as total_lbs_received,
                COALESCE(SUM(total_boxes), 0) as total_boxes_received,
                AVG(CASE WHEN total_boxes > 0 THEN weight_lbs / total_boxes ELSE 43.5 END) as avg_lbs_per_box
             FROM egg_raw_materials
             WHERE company_id = ? AND status = 'aprobado'`,
            [req.company_id]
        );

        // Buscar si hay costo promedio registrado en producto 'huevo cáscara' o default $38.00
        const [productCost] = await pool.query(
            `SELECT costo FROM products 
             WHERE company_id = ? AND (nombre LIKE '%huevo cáscara%' OR nombre LIKE '%huevo cascara%' OR nombre LIKE '%huevo en cascara%') 
             ORDER BY id DESC LIMIT 1`,
            [req.company_id]
        );
        const realBoxCost = productCost.length > 0 && parseFloat(productCost[0].costo) > 0 
            ? parseFloat(productCost[0].costo) 
            : 38.00;

        // 2. Lotes de Producción y Rendimiento Real de Quebrado
        const [batchStats] = await pool.query(
            `SELECT 
                COUNT(*) as total_batches,
                COALESCE(SUM(input_weight_lbs), 0) as total_input_lbs,
                COALESCE(SUM(yield_liquid_lbs), 0) as total_liquid_lbs,
                COALESCE(SUM(waste_shell_lbs), 0) as total_shell_lbs
             FROM egg_production_batches
             WHERE company_id = ? AND status != 'cancelado'`,
            [req.company_id]
        );

        const totalInput = parseFloat(batchStats[0].total_input_lbs) || 0;
        const totalLiquid = parseFloat(batchStats[0].total_liquid_lbs) || 0;
        const totalShell = parseFloat(batchStats[0].total_shell_lbs) || 0;

        const actualYieldPct = totalInput > 0 && totalLiquid > 0 
            ? Math.min(100, Math.max(50, (totalLiquid / totalInput) * 100)) 
            : 83.00;
        const actualShellPct = totalInput > 0 && totalShell > 0 
            ? (totalShell / totalInput) * 100 
            : 17.00;

        // 3. Precios de Venta Pactados / Facturados
        const [agreements] = await pool.query(
            `SELECT 
                COUNT(*) as count_agreements,
                COALESCE(AVG(agreed_price_per_lb), 0) as avg_contract_price,
                COALESCE(SUM(monthly_volume_lbs), 0) as total_contract_volume,
                COALESCE(SUM(agreed_price_per_lb * monthly_volume_lbs), 0) as total_contract_revenue
             FROM egg_costing_customer_agreements
             WHERE company_id = ? AND status = 'activo'`,
            [req.company_id]
        );

        const totalVolume = parseFloat(agreements[0].total_contract_volume) || 0;
        const avgSalePrice = totalVolume > 0 
            ? parseFloat(agreements[0].total_contract_revenue) / totalVolume 
            : (parseFloat(agreements[0].avg_contract_price) || 1.25);

        // 4. Configs para costos fijos
        const [configRows] = await pool.query('SELECT * FROM egg_costing_configurations WHERE company_id = ?', [req.company_id]);
        const configs = {};
        configRows.forEach(c => { configs[c.setting_key] = parseFloat(c.setting_value) || 0; });

        const lbsPerBox = parseFloat(rawStats[0].avg_lbs_per_box) || 43.50;
        const mpCostPerLbRaw = realBoxCost / lbsPerBox;
        const actualMpCostPerLbLiquid = mpCostPerLbRaw / (actualYieldPct / 100);

        const packagingCostPerLb = 0.1128;
        const cipCostPerLb = 0.0042;
        const boilerEnergyCostPerLb = 0.0408;
        const modCostPerLb = configs.mod_cost_per_lb || 0.0500;
        
        const currentMonthlyVolume = totalLiquid > 0 ? Math.max(totalLiquid, 10000) : (configs.monthly_projected_lbs || 100000);
        const gifTotal = configs.monthly_gif_total || 24537;
        const actualGifCostPerLb = gifTotal / currentMonthlyVolume;

        const actualTotalCostPerLb = actualMpCostPerLbLiquid + packagingCostPerLb + cipCostPerLb + boilerEnergyCostPerLb + modCostPerLb + actualGifCostPerLb;
        const actualMarginPerLb = avgSalePrice - actualTotalCostPerLb;
        const actualMarginPct = avgSalePrice > 0 ? (actualMarginPerLb / avgSalePrice) * 100 : 0;

        res.json({
            operational_summary: {
                total_receptions: rawStats[0].total_receptions,
                total_lbs_received: parseFloat(rawStats[0].total_lbs_received),
                total_boxes_received: parseFloat(rawStats[0].total_boxes_received),
                avg_lbs_per_box: lbsPerBox,
                real_box_cost: realBoxCost,
                total_batches: batchStats[0].total_batches,
                total_input_lbs: totalInput,
                total_liquid_lbs: totalLiquid,
                total_shell_lbs: totalShell,
                actual_yield_pct: actualYieldPct,
                actual_shell_pct: actualShellPct,
                total_contract_volume: totalVolume,
                avg_sale_price_per_lb: avgSalePrice
            },
            actual_cost_breakdown: {
                mp_cost_per_lb: actualMpCostPerLbLiquid,
                packaging_cost_per_lb: packagingCostPerLb,
                cip_cost_per_lb: cipCostPerLb,
                boiler_energy_cost_per_lb: boilerEnergyCostPerLb,
                mod_cost_per_lb: modCostPerLb,
                gif_cost_per_lb: actualGifCostPerLb,
                total_actual_cost_per_lb: actualTotalCostPerLb,
                actual_margin_per_lb: actualMarginPerLb,
                actual_margin_pct: actualMarginPct,
                volume_basis_lbs: currentMonthlyVolume
            }
        });
    } catch (error) {
        console.error('Error calculando costo operacional:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getCostingConfig,
    updateCostingConfig,
    getCipItems,
    saveCipItem,
    deleteCipItem,
    getPackagingItems,
    savePackagingItem,
    deletePackagingItem,
    getCustomerAgreements,
    saveCustomerAgreement,
    deleteCustomerAgreement,
    calculateDynamicCost,
    getScenarios,
    saveScenario,
    deleteScenario,
    getCostingHistory,
    getActualOperationalCost
};

