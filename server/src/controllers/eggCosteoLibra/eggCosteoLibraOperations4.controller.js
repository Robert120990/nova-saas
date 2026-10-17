const { pool, ensureSeedData } = require('./shared');
const { getRealRawEggMetrics, ensureHistoricalBatchCosts } = require('../../services/eggIndustrial/eggCostsSync.service');

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
        await ensureSeedData(req.company_id);
        await ensureHistoricalBatchCosts(req.company_id, false);
        const { start_date, end_date } = req.query;

        const baseSelect = `
            SELECT
                DATE_FORMAT(b.started_at, '%Y-%m') as period,
                b.product_type,
                COUNT(b.id) as batches_count,
                SUM(b.input_weight_lbs) as total_input_lbs,
                SUM(b.yield_liquid_lbs) as total_yield_lbs,
                COALESCE(SUM(COALESCE(c.total_cost, 0) + COALESCE(vc.mp_cost, 0)), 0) as total_cost,
                CASE WHEN SUM(b.yield_liquid_lbs) > 0
                     THEN COALESCE(SUM(COALESCE(c.total_cost, 0) + COALESCE(vc.mp_cost, 0)), 0) / SUM(b.yield_liquid_lbs)
                     ELSE 0 END as avg_cost_per_lb
             FROM egg_production_batches b
             LEFT JOIN (
                 SELECT company_id, batch_id, SUM(total_cost) AS total_cost
                 FROM egg_industrial_costs
                 GROUP BY company_id, batch_id
             ) c ON b.id = c.batch_id AND b.company_id = c.company_id
             LEFT JOIN (
                 SELECT company_id, batch_id, SUM(amount) AS mp_cost
                 FROM egg_batch_variable_costs
                 WHERE concept_name LIKE '%Materia Prima%'
                 GROUP BY company_id, batch_id
             ) vc ON b.id = vc.batch_id AND b.company_id = vc.company_id
             WHERE b.company_id = ? AND b.status != 'cancelado'
        `;

        let query = baseSelect;
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
        const groupOrder = ` GROUP BY period, b.product_type ORDER BY period DESC, b.product_type ASC LIMIT 36`;

        let [history] = await pool.query(query + groupOrder, params);
        if (history.length === 0 && (start_date || end_date)) {
            [history] = await pool.query(baseSelect + groupOrder, [req.company_id]);
        }

        res.json(history);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getActualOperationalCost = async (req, res) => {
    try {
        await ensureSeedData(req.company_id);
        const { start_date, end_date } = req.query;

        // 1. Recepciones de Materia Prima reales (corrige reception_date -> COALESCE(fecha, DATE(created_at)) e initial_boxes)
        const rawMetrics = await getRealRawEggMetrics(req.company_id, start_date, end_date);
        const realBoxCost = rawMetrics.real_box_cost;
        const lbsPerBox = rawMetrics.avg_lbs_per_box;

        // 2. Lotes de Producción y Rendimiento Real de Quebrado
        const baseBatchSql = `
            SELECT
                COUNT(*) as total_batches,
                COALESCE(SUM(CASE WHEN is_coproduct = 1 THEN 0 ELSE input_weight_lbs END), 0) as total_input_lbs,
                COALESCE(SUM(yield_liquid_lbs), 0) as total_liquid_lbs,
                COALESCE(SUM(CASE WHEN is_coproduct = 1 AND parent_batch_id IS NOT NULL THEN 0 ELSE waste_shell_lbs END), 0) as total_shell_lbs
            FROM egg_production_batches
            WHERE company_id = ? AND status != 'cancelado'
        `;
        let batchSql = baseBatchSql;
        const batchParams = [req.company_id];
        if (start_date && end_date) {
            batchSql += ' AND DATE(started_at) BETWEEN ? AND ?';
            batchParams.push(start_date, end_date);
        } else if (start_date) {
            batchSql += ' AND DATE(started_at) >= ?';
            batchParams.push(start_date);
        } else if (end_date) {
            batchSql += ' AND DATE(started_at) <= ?';
            batchParams.push(end_date);
        }

        let [batchStats] = await pool.query(batchSql, batchParams);
        if ((parseInt(batchStats[0]?.total_batches) || 0) === 0 && (start_date || end_date)) {
            [batchStats] = await pool.query(baseBatchSql, [req.company_id]);
        }

        const totalBatches = parseInt(batchStats[0]?.total_batches) || 0;
        const totalInput = parseFloat(batchStats[0]?.total_input_lbs) || 0;
        const totalLiquid = parseFloat(batchStats[0]?.total_liquid_lbs) || 0;
        const totalShell = parseFloat(batchStats[0]?.total_shell_lbs) || 0;
        const avgBatchLbs = totalBatches > 0 && totalInput > 0 ? Math.round(totalInput / totalBatches) : 12000;

        const actualYieldPct = totalInput > 0 && totalLiquid > 0
            ? Math.min(98, Math.max(50, (totalLiquid / totalInput) * 100))
            : 83.00;
        const actualShellPct = totalInput > 0 && totalShell > 0
            ? (totalShell / totalInput) * 100
            : Math.max(0, 100 - actualYieldPct);

        // 3. Precios de Venta Pactados + Ventas Reales Facturadas (sales_headers / sales_items)
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
            agrSql += ` AND ((valid_from IS NULL AND valid_to IS NULL) OR (valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?)))`;
            agrParams.push(end_date, start_date);
        }
        const [agreements] = await pool.query(agrSql, agrParams);

        const [salesStats] = await pool.query(`
            SELECT COUNT(DISTINCT sh.id) as sales_count,
                   COALESCE(SUM(COALESCE(si.venta_gravada, 0) + COALESCE(si.venta_exenta, 0)), 0) as total_sales_usd
            FROM sales_headers sh
            JOIN sales_items si ON sh.id = si.sale_id
            LEFT JOIN products p ON si.product_id = p.id
            WHERE sh.company_id = ? AND (sh.estado IS NULL OR sh.estado != 'ANULADO')
              AND (p.nombre LIKE '%huevo%' OR p.nombre LIKE '%clara%' OR p.nombre LIKE '%yema%' OR si.descripcion LIKE '%huevo%' OR si.descripcion LIKE '%clara%' OR si.descripcion LIKE '%yema%')
        `, [req.company_id]);

        const totalVolume = parseFloat(agreements[0]?.total_contract_volume) || 0;
        const avgSalePrice = totalVolume > 0
            ? parseFloat(agreements[0].total_contract_revenue) / totalVolume
            : (parseFloat(agreements[0]?.avg_contract_price) || 1.25);

        // 4. Costos dinámicos reales de Empaque, CIP, Caldera, MOD y GIF
        const [configRows] = await pool.query('SELECT * FROM egg_costing_configurations WHERE company_id = ?', [req.company_id]);
        const configs = {};
        configRows.forEach(c => { configs[c.setting_key] = parseFloat(c.setting_value) || 0; });

        const [indCostTotals] = await pool.query(`
            SELECT
                COALESCE(SUM(ic.packaging_materials_cost), 0) as pkg_cost,
                COALESCE(SUM(ic.chemicals_cip_cost), 0) as cip_cost,
                COALESCE(SUM(ic.diesel_cost + ic.electricity_cost + ic.water_cost), 0) as boiler_cost,
                COALESCE(SUM(b.yield_liquid_lbs), 0) as costed_liquid_lbs
            FROM egg_industrial_costs ic
            JOIN egg_production_batches b ON ic.batch_id = b.id
            WHERE ic.company_id = ? AND b.status != 'cancelado'
        `, [req.company_id]);

        const costedLiquid = parseFloat(indCostTotals[0]?.costed_liquid_lbs) || 0;
        const mpCostPerLbRaw = lbsPerBox > 0 ? (realBoxCost / lbsPerBox) : (38.00 / 47.88);
        const actualMpCostPerLbLiquid = mpCostPerLbRaw / (actualYieldPct / 100);

        const packagingCostPerLb = costedLiquid > 0 ? (parseFloat(indCostTotals[0].pkg_cost) / costedLiquid) : 0.1128;
        const cipCostPerLb = costedLiquid > 0 ? (parseFloat(indCostTotals[0].cip_cost) / costedLiquid) : 0.0042;
        const boilerEnergyCostPerLb = costedLiquid > 0 ? (parseFloat(indCostTotals[0].boiler_cost) / costedLiquid) : 0.0408;
        const modCostPerLb = configs.mod_cost_per_lb || 0.0500;

        const currentMonthlyVolume = totalLiquid > 0 ? Math.max(totalLiquid, configs.monthly_projected_lbs || 100000) : (configs.monthly_projected_lbs || 100000);
        const gifTotal = configs.monthly_gif_total || 24537;
        const actualGifCostPerLb = gifTotal / currentMonthlyVolume;

        const actualTotalCostPerLb = actualMpCostPerLbLiquid + packagingCostPerLb + cipCostPerLb + boilerEnergyCostPerLb + modCostPerLb + actualGifCostPerLb;
        const actualMarginPerLb = avgSalePrice - actualTotalCostPerLb;
        const actualMarginPct = avgSalePrice > 0 ? (actualMarginPerLb / avgSalePrice) * 100 : 0;

        res.json({
            date_range: {
                start_date: start_date || null,
                end_date: end_date || null,
                is_filtered: !!(start_date || end_date),
                is_historical_fallback: rawMetrics.is_historical_fallback
            },
            operational_summary: {
                total_receptions: rawMetrics.total_receptions,
                total_lbs_received: rawMetrics.total_lbs_received,
                total_boxes_received: rawMetrics.total_boxes_received,
                avg_lbs_per_box: lbsPerBox,
                real_box_cost: realBoxCost,
                total_batches: totalBatches,
                avg_batch_size_lbs: avgBatchLbs,
                total_input_lbs: totalInput,
                total_liquid_lbs: totalLiquid,
                total_shell_lbs: totalShell,
                actual_yield_pct: +actualYieldPct.toFixed(2),
                actual_shell_pct: +actualShellPct.toFixed(2),
                total_contract_volume: totalVolume,
                avg_sale_price_per_lb: +avgSalePrice.toFixed(4),
                invoiced_sales_count: parseInt(salesStats[0]?.sales_count) || 0,
                invoiced_revenue_total: parseFloat(salesStats[0]?.total_sales_usd) || 0
            },
            actual_cost_breakdown: {
                mp_cost_per_lb: +actualMpCostPerLbLiquid.toFixed(4),
                packaging_cost_per_lb: +packagingCostPerLb.toFixed(4),
                cip_cost_per_lb: +cipCostPerLb.toFixed(4),
                boiler_energy_cost_per_lb: +boilerEnergyCostPerLb.toFixed(4),
                mod_cost_per_lb: +modCostPerLb.toFixed(4),
                gif_cost_per_lb: +actualGifCostPerLb.toFixed(4),
                total_actual_cost_per_lb: +actualTotalCostPerLb.toFixed(4),
                actual_margin_per_lb: +actualMarginPerLb.toFixed(4),
                actual_margin_pct: +actualMarginPct.toFixed(2),
                volume_basis_lbs: currentMonthlyVolume
            }
        });
    } catch (error) {
        console.error('Error calculando costo operacional:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getScenarios, saveScenario, deleteScenario, getCostingHistory, getActualOperationalCost };
