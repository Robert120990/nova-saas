const pool = require('../config/db');

// 1. OBTENER CONFIGURACIONES GENERALES DE COSTEO
const getCostingConfig = async (req, res) => {
    try {
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
        const [rows] = await pool.query(
            `SELECT a.*, c.nombre as customer_registered_name, c.telefono, c.email
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
        const {
            product_type = 'Huevo Entero Pasteurizado',
            presentation = 'cubeta 30LB',
            raw_egg_box_cost = 38.00, // Costo de caja de 360 huevos
            raw_egg_lbs_per_box = 43.50, // Peso aprox de caja
            batch_size_lbs = 12000.00, // Batch estándar
            water_added_pct = 0.00, // Para Huevo Entero Plus (ej. 8% a 10%)
            sugar_added_pct = 0.00, // Para Yema Azucarada (ej. 4%)
            salt_added_pct = 0.00,  // Para Yema Salada (ej. 10%)
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
        // 1 caja = raw_egg_lbs_per_box. Costo por libra cáscara = raw_egg_box_cost / raw_egg_lbs_per_box
        const costPerLbRawEgg = raw_egg_box_cost / (raw_egg_lbs_per_box || 43.50);

        // Rendimiento según producto
        let liquidYieldPct = 0.83; // 83% líquido para huevo entero (17% cáscara)
        let productBase = product_type.toLowerCase();

        if (productBase.includes('clara')) {
            // De huevo cáscara: 83% líquido * 65% clara = 53.95%
            liquidYieldPct = 0.5395;
        } else if (productBase.includes('yema')) {
            // De huevo cáscara: 83% líquido * 35% yema = 29.05%
            liquidYieldPct = 0.2905;
        }

        // Si es Huevo Entero Plus, el agua adicionada incrementa el rendimiento final
        let effectiveWaterPct = (productBase.includes('plus') || water_added_pct > 0) ? (water_added_pct || 8.0) / 100 : 0;
        let effectiveSugarPct = (productBase.includes('azucarada') || sugar_added_pct > 0) ? (sugar_added_pct || 4.0) / 100 : 0;
        let effectiveSaltPct = (productBase.includes('salada') || salt_added_pct > 0) ? (salt_added_pct || 10.0) / 100 : 0;

        // Costo base por libra de líquido producido
        // Costo MP / yield
        let baseLiquidCostPerLb = costPerLbRawEgg / liquidYieldPct;

        // Factor de dilución o aditivos
        // Formula: Si agregamos 8% agua (costo $0.00), el costo por libra se diluye:
        // Costo final MP por libra = baseLiquidCostPerLb * (1 - effectiveWaterPct - effectiveSugarPct - effectiveSaltPct)
        let additiveCostPerLb = 0;
        if (effectiveSugarPct > 0) {
            additiveCostPerLb += effectiveSugarPct * 0.45; // Azúcar industrial ~$0.45/lb
        }
        if (effectiveSaltPct > 0) {
            additiveCostPerLb += effectiveSaltPct * 0.15; // Sal yodada ~$0.15/lb
        }
        if (effectiveWaterPct > 0) {
            additiveCostPerLb += effectiveWaterPct * 0.001; // Agua purificada insignificante
        }

        const mpCostPerLb = (baseLiquidCostPerLb * (1 - effectiveWaterPct - effectiveSugarPct - effectiveSaltPct)) + additiveCostPerLb;

        // B. COSTO DE EMPAQUE POR LIBRA SEGÚN PRESENTACIÓN
        let packagingCostPerUnit = 0;
        let presentationLbs = 30.0;

        if (presentation.includes('30')) {
            presentationLbs = 30.0;
            packagingCostPerUnit = (packMap['CUBETA-30LB'] || 2.40) + 
                                  (packMap['TAPA-30LB'] || 0.65) + 
                                  (packMap['LINER-30LB'] || 0.30) + 
                                  (packMap['ETIQ-4X2'] || 0.035);
        } else if (presentation.includes('32')) {
            presentationLbs = 32.0;
            packagingCostPerUnit = (packMap['CUBETA-30LB'] || 2.40) + 
                                  (packMap['TAPA-30LB'] || 0.65) + 
                                  (packMap['LINER-30LB'] || 0.30) + 
                                  (packMap['ETIQ-4X2'] || 0.035);
        } else if (presentation.includes('8') || presentation.includes('galón') || presentation.includes('galon')) {
            presentationLbs = 8.0;
            packagingCostPerUnit = (packMap['GALON-8LB'] || 0.85) + 
                                  (packMap['TAPA-GALON'] || 0.15) + 
                                  (packMap['ETIQ-4X2'] || 0.035);
        } else if (presentation.includes('4') || presentation.includes('medio gal')) {
            presentationLbs = 4.0;
            packagingCostPerUnit = 0.55 + 0.10 + 0.035;
        } else if (presentation.includes('2') || presentation.includes('litro')) {
            presentationLbs = 2.0;
            packagingCostPerUnit = 0.35 + 0.08 + 0.035;
        } else {
            presentationLbs = 1.0;
            packagingCostPerUnit = 0.25 + 0.05 + 0.035;
        }

        const packagingCostPerLb = packagingCostPerUnit / presentationLbs;

        // C. COSTO DE LIMPIEZA CIP POR BATCH Y POR LIBRA
        let totalCipBatchCost = 0;
        cipRows.forEach(item => {
            const unitPrice = parseFloat(item.presentation_cost) / (parseFloat(item.presentation_qty) || 1);
            totalCipBatchCost += unitPrice * parseFloat(item.dose_per_batch);
        });
        if (totalCipBatchCost === 0) totalCipBatchCost = 50.85; // Default ANDELSA model
        const cipCostPerLb = totalCipBatchCost / (batch_size_lbs || 12000);

        // D. COSTO DE CALDERA, ENERGÍA, DIESEL Y AGUA (PASTEURIZADOR)
        const dieselGal = configs.boiler_diesel_gal_batch || 20.84;
        const dieselPrice = configs.boiler_diesel_price_gal || 4.14;
        const dieselTotal = dieselGal * dieselPrice; // ~$86.28
        const electricityTotal = configs.boiler_kwh_cost_batch || 386.00;
        const waterTotal = configs.boiler_water_cost_batch || 17.34;
        const totalBoilerEnergyBatchCost = dieselTotal + electricityTotal + waterTotal; // ~$538.26
        const boilerEnergyCostPerLb = totalBoilerEnergyBatchCost / (batch_size_lbs || 12000); // ~$0.0135 / lb

        // E. MANO DE OBRA DIRECTA (MOD)
        const modCostPerLb = configs.mod_cost_per_lb || 0.0500;

        // F. GASTOS INDIRECTOS DE FABRICACIÓN (GIF) PRORRATEADOS
        const monthlyGifTotal = custom_gif_monthly !== null ? custom_gif_monthly : (configs.monthly_gif_total || 24537.00);
        const monthlyProjectedLbs = custom_monthly_volume_lbs !== null ? custom_monthly_volume_lbs : (configs.monthly_projected_lbs || 100000.00);
        const gifCostPerLb = monthlyGifTotal / (monthlyProjectedLbs || 100000); // ~$0.2454 / lb

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

            // Cálculo de Bono comercial simulado:
            // Regla ANDELSA: Si margen >= 20% -> 1.5% bono sobre venta; Si margen 15-20% -> 1.0%; Si margen 10-15% -> 0.5%; Si <10% -> 0%
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

        // Simulación con precio libre si se indicó
        let targetSimulation = null;
        if (target_sale_price_per_lb) {
            const targetPrice = parseFloat(target_sale_price_per_lb);
            const marginLb = targetPrice - totalCostPerLb;
            const marginPct = targetPrice > 0 ? (marginLb / targetPrice) * 100 : 0;
            targetSimulation = {
                price: targetPrice,
                cost: totalCostPerLb,
                margin_per_lb: marginLb,
                margin_pct: marginPct,
                status: marginPct >= 20 ? 'green' : (marginPct >= 10 ? 'yellow' : 'red')
            };
        }

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
            clients_comparison: clientsComparison,
            target_simulation: targetSimulation,
            parameters_used: {
                liquid_yield_pct: liquidYieldPct * 100,
                water_added_pct: effectiveWaterPct * 100,
                sugar_added_pct: effectiveSugarPct * 100,
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
    getCostingHistory
};
