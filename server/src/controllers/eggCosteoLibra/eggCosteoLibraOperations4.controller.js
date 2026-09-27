const { pool, ensureSeedData } = require('./shared');

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

const getCostingHistory = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        let query = `
            SELECT
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
             LEFT JOIN (SELECT company_id, batch_id, SUM(total_cost) AS total_cost FROM egg_industrial_costs GROUP BY company_id, batch_id) c ON b.id = c.batch_id AND b.company_id = c.company_id
             WHERE b.company_id = ?
        `;
        const params = [req.company_id];

        if (start_date && end_date) {
            query += ' AND DATE(b.started_at) BETWEEN ? AND ?';
            params.push(start_date, end_date);
        } else if (start_date) {
            query += ' AND DATE(b.started_at) >= ?';
            params.push(start_date);
        } else if (end_date) {
            query += ' AND DATE(b.started_at) <= ?';
            params.push(end_date);
        }

        query += `
             GROUP BY period, b.product_type
             ORDER BY period DESC, b.product_type ASC
             LIMIT 36
        `;
        const [history] = await pool.query(query, params);
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getActualOperationalCost = async (req, res) => {
    try {
        await ensureSeedData(req.company_id);
        const { start_date, end_date } = req.query;

        // 1. Recepciones de Materia Prima (Huevo Cáscara)
        let rawSql = `
            SELECT
                COUNT(*) as total_receptions,
                COALESCE(SUM(weight_lbs), 0) as total_lbs_received,
                COALESCE(SUM(total_boxes), 0) as total_boxes_received,
                AVG(CASE WHEN total_boxes > 0 THEN weight_lbs / total_boxes ELSE 43.5 END) as avg_lbs_per_box
            FROM egg_raw_materials
            WHERE company_id = ? AND status = 'aprobado'
        `;
        const rawParams = [req.company_id];
        if (start_date && end_date) {
            rawSql += ` AND (
                (reception_date BETWEEN ? AND ?) OR
                (reception_date IS NULL AND DATE(created_at) BETWEEN ? AND ?)
            )`;
            rawParams.push(start_date, end_date, start_date, end_date);
        } else if (start_date) {
            rawSql += ` AND (reception_date >= ? OR (reception_date IS NULL AND DATE(created_at) >= ?))`;
            rawParams.push(start_date, start_date);
        } else if (end_date) {
            rawSql += ` AND (reception_date <= ? OR (reception_date IS NULL AND DATE(created_at) <= ?))`;
            rawParams.push(end_date, end_date);
        }

        const [rawStats] = await pool.query(rawSql, rawParams);

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
        let batchSql = `
            SELECT
                COUNT(*) as total_batches,
                COALESCE(SUM(input_weight_lbs), 0) as total_input_lbs,
                COALESCE(SUM(yield_liquid_lbs), 0) as total_liquid_lbs,
                COALESCE(SUM(waste_shell_lbs), 0) as total_shell_lbs
            FROM egg_production_batches
            WHERE company_id = ? AND status != 'cancelado'
        `;
        const batchParams = [req.company_id];
        if (start_date && end_date) {
            batchSql += ` AND DATE(started_at) BETWEEN ? AND ?`;
            batchParams.push(start_date, end_date);
        } else if (start_date) {
            batchSql += ` AND DATE(started_at) >= ?`;
            batchParams.push(start_date);
        } else if (end_date) {
            batchSql += ` AND DATE(started_at) <= ?`;
            batchParams.push(end_date);
        }

        const [batchStats] = await pool.query(batchSql, batchParams);

        const totalInput = parseFloat(batchStats[0].total_input_lbs) || 0;
        const totalLiquid = parseFloat(batchStats[0].total_liquid_lbs) || 0;
        const totalShell = parseFloat(batchStats[0].total_shell_lbs) || 0;

        const actualYieldPct = totalInput > 0 && totalLiquid > 0
            ? Math.min(100, Math.max(50, (totalLiquid / totalInput) * 100))
            : 83.00;
        const actualShellPct = totalInput > 0 && totalShell > 0
            ? (totalShell / totalInput) * 100
            : 17.00;

        // 3. Precios de Venta Pactados / Facturados vigentes en el rango
        let agrSql = `
            SELECT
                COUNT(*) as count_agreements,
                COALESCE(AVG(agreed_price_per_lb), 0) as avg_contract_price,
                COALESCE(SUM(monthly_volume_lbs), 0) as total_contract_volume,
                COALESCE(SUM(agreed_price_per_lb * monthly_volume_lbs), 0) as total_contract_revenue
            FROM egg_costing_customer_agreements
            WHERE company_id = ? AND status = 'activo'
        `;
        const agrParams = [req.company_id];
        if (start_date && end_date) {
            agrSql += ` AND (
                (valid_from IS NULL AND valid_to IS NULL) OR
                (valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?))
            )`;
            agrParams.push(end_date, start_date);
        }

        const [agreements] = await pool.query(agrSql, agrParams);

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
        const modCostPerLb = configs.mod_cost_per_lb ?? 0.0500;

        const currentMonthlyVolume = totalLiquid > 0 ? Math.max(totalLiquid, 10000) : (configs.monthly_projected_lbs ?? 100000);
        const gifTotal = configs.monthly_gif_total ?? 24537;
        const actualGifCostPerLb = gifTotal / currentMonthlyVolume;

        const actualTotalCostPerLb = actualMpCostPerLbLiquid + packagingCostPerLb + cipCostPerLb + boilerEnergyCostPerLb + modCostPerLb + actualGifCostPerLb;
        const actualMarginPerLb = avgSalePrice - actualTotalCostPerLb;
        const actualMarginPct = avgSalePrice > 0 ? (actualMarginPerLb / avgSalePrice) * 100 : 0;

        res.json({
            date_range: {
                start_date: start_date || null,
                end_date: end_date || null,
                is_filtered: !!(start_date || end_date)
            },
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
module.exports = { getScenarios, saveScenario, deleteScenario, getCostingHistory, getActualOperationalCost };
