const {
    pool,
    notificationService,
    ensureEggSchema
} = require('./eggUtils');
const {
    computeSystemCostsData,
    ensureHistoricalBatchCosts
} = require('../../services/eggIndustrial/eggCostsSync.service');

// --- REGISTROS DE MANTENIMIENTO Y COSTOS INDUSTRIALES ---
const getMaintenanceLogs = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM egg_machinery_maintenance WHERE company_id = ? ORDER BY created_at DESC`,
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        console.warn('[getMaintenanceLogs] Notice:', error.message);
        res.json([]);
    }
};

const createMaintenanceLog = async (req, res) => {
    try {
        const { equipment_name, maintenance_type, description, spare_parts_used, usage_hours_count, technician_name, cost } = req.body;
        const [result] = await pool.query(
            `INSERT INTO egg_machinery_maintenance (company_id, equipment_name, maintenance_type, description, spare_parts_used, usage_hours_count, technician_name, cost) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.company_id, equipment_name, maintenance_type, description, spare_parts_used, usage_hours_count, technician_name, cost]
        );

        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'maintenance.logged', 'info', ?, ?, ?)`,
            [req.company_id, `Mantenimiento ${maintenance_type} registrado para ${equipment_name}. Costo: $${cost}.`, JSON.stringify({ maintenance_id: result.insertId, equipment_name }), technician_name]
        );

        notificationService.notify('maintenance_log_created', req.company_id, req.user?.branch_id, {
            equipo: equipment_name || '',
            tipo_mantenimiento: maintenance_type || '',
            descripcion: description || '',
            fecha: new Date().toISOString().split('T')[0],
            sucursal: ''
        }).catch(() => { });

        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 9. COSTEO OPERATIVO INDUSTRIAL
const getIndustrialCosts = async (req, res) => {
    try {
        await ensureEggSchema();
        await ensureHistoricalBatchCosts(req.company_id, false);
        const [rows] = await pool.query(
            `SELECT ic.*, b.product_type, b.batch_uuid, b.yield_liquid_lbs, b.presentation 
             FROM egg_industrial_costs ic
             LEFT JOIN egg_production_batches b ON ic.batch_id = b.id
             WHERE ic.company_id = ? 
             ORDER BY ic.created_at DESC`,
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        console.warn('[getIndustrialCosts] Notice:', error.message);
        res.json([]);
    }
};

const createIndustrialCosts = async (req, res) => {
    try {
        const { batch_id, diesel_cost, electricity_cost, water_cost, labor_cost, packaging_materials_cost, chemicals_cip_cost, quality_tests_cost } = req.body;
        const [result] = await pool.query(
            `INSERT INTO egg_industrial_costs (company_id, batch_id, diesel_cost, electricity_cost, water_cost, labor_cost, packaging_materials_cost, chemicals_cip_cost, quality_tests_cost) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.company_id, batch_id, diesel_cost, electricity_cost, water_cost, labor_cost, packaging_materials_cost, chemicals_cip_cost, quality_tests_cost]
        );
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- CONCEPTOS DE COSTO Y SINCRONIZACIÓN DE FUENTES DEL SISTEMA ---
const getCostConcepts = async (req, res) => {
    try {
        await ensureHistoricalBatchCosts(req.company_id, false);
        const [rows] = await pool.query(
            'SELECT * FROM egg_cost_concepts WHERE company_id = ? ORDER BY concept_name',
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        console.warn('[getCostConcepts] Notice:', error.message);
        res.json([]);
    }
};

const saveCostConcept = async (req, res) => {
    try {
        const { id, concept_name, default_value } = req.body;
        if (id) {
            await pool.query('UPDATE egg_cost_concepts SET concept_name = ?, default_value = ? WHERE id = ? AND company_id = ?',
                [concept_name, default_value, id, req.company_id]);
        } else {
            await pool.query('INSERT INTO egg_cost_concepts (company_id, concept_name, default_value) VALUES (?, ?, ?)',
                [req.company_id, concept_name, default_value]);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteCostConcept = async (req, res) => {
    try {
        await pool.query('DELETE FROM egg_cost_concepts WHERE id = ? AND company_id = ?', [req.params.id, req.company_id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 14.1 CARGA AUTOMÁTICA DE COSTOS DESDE PLANILLAS RRHH Y GASTOS OPERATIVOS
const getCostsSystemSources = async (req, res) => {
    try {
        const data = await computeSystemCostsData(req.company_id, req.query || {});
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const syncCostsSystemSources = async (req, res) => {
    try {
        const companyId = req.company_id;
        let { concepts, update_gif_config, month, year, projected_batches } = req.body || {};

        let computedData = null;
        if (!Array.isArray(concepts) || concepts.length === 0) {
            computedData = await computeSystemCostsData(companyId, { month, year, projected_batches });
            concepts = computedData.suggested_concepts;
            if (update_gif_config === undefined) update_gif_config = true;
        }

        if (!Array.isArray(concepts) || concepts.length === 0) {
            return res.status(400).json({ message: 'No se recibieron conceptos para sincronizar.' });
        }

        for (const c of concepts) {
            const name = (c.concept_name || '').trim();
            const val = parseFloat(c.default_value) || 0;
            if (!name) continue;

            const [existing] = await pool.query(
                'SELECT id FROM egg_cost_concepts WHERE company_id = ? AND concept_name = ?',
                [companyId, name]
            );

            if (existing.length > 0) {
                await pool.query(
                    'UPDATE egg_cost_concepts SET default_value = ? WHERE id = ? AND company_id = ?',
                    [val, existing[0].id, companyId]
                );
            } else {
                await pool.query(
                    'INSERT INTO egg_cost_concepts (company_id, concept_name, default_value) VALUES (?, ?, ?)',
                    [companyId, name, val]
                );
            }
        }

        if (update_gif_config) {
            const totalMonthly = concepts.reduce((sum, c) => sum + (parseFloat(c.monthly_total) || (parseFloat(c.default_value) || 0) * (parseInt(projected_batches) || 10)), 0);
            if (totalMonthly > 0) {
                await pool.query(
                    `UPDATE egg_costing_configurations 
                     SET setting_value = ? 
                     WHERE company_id = ? AND setting_key = 'monthly_gif_total'`,
                    [totalMonthly, companyId]
                );
            }
        }

        await ensureHistoricalBatchCosts(companyId, true);

        res.json({
            success: true,
            message: 'Conceptos de costos fijos, nómina y costos por lote sincronizados exitosamente.'
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- COSTOS VARIABLES POR LOTE ---
const getBatchVariableCosts = async (req, res) => {
    try {
        await ensureHistoricalBatchCosts(req.company_id, false);
        const [rows] = await pool.query(
            'SELECT * FROM egg_batch_variable_costs WHERE batch_id = ? AND company_id = ?',
            [req.params.batchId, req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const saveBatchVariableCost = async (req, res) => {
    try {
        const { concept_name, amount } = req.body;
        const [result] = await pool.query(
            'INSERT INTO egg_batch_variable_costs (company_id, batch_id, concept_name, amount) VALUES (?, ?, ?, ?)',
            [req.company_id, req.params.batchId, concept_name, amount]
        );
        res.json({ id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteBatchVariableCost = async (req, res) => {
    try {
        await pool.query('DELETE FROM egg_batch_variable_costs WHERE id = ? AND company_id = ?', [req.params.id, req.company_id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getMaintenanceLogs,
    createMaintenanceLog,
    getIndustrialCosts,
    createIndustrialCosts,
    getCostConcepts,
    saveCostConcept,
    deleteCostConcept,
    getCostsSystemSources,
    syncCostsSystemSources,
    getBatchVariableCosts,
    saveBatchVariableCost,
    deleteBatchVariableCost
};
