const {
    pool,
    nodemailer,
    broadcastToCompany,
    notificationService,
    eggExportService,
    eggReportsExportService,
    eggQualityLetterExport,
    eggRawMaterialLabReport,
    eggOriginCertificate,
    reportPdfHelper,
    excelService,
    resolveEggCatalogProduct,
    safeNum,
    safeInt,
    computeJulianLotCode,
    ensureEggSchema
} = require('./eggUtils');


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

        // Evento
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

// 10. PREVISIÓN Y FORECASTING

// --- CONCEPTOS DE COSTO Y SINCRONIZACIÓN DE FUENTES DEL SISTEMA ---
const getCostConcepts = async (req, res) => {
    try {
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
        const companyId = req.company_id;
        const { month, year } = req.query;
        const currentYear = parseInt(year) || new Date().getFullYear();
        const currentMonth = parseInt(month) || (new Date().getMonth() + 1);

        // 1. Planillas de RRHH (Sueldos y Mano de Obra)
        let payrollQuery = `
            SELECT 
                p.id, p.empleado_id, p.periodo_mes, p.periodo_anio, p.quincena, p.estado,
                COALESCE(p.sueldo_base, 0) as sueldo_base,
                COALESCE(p.total_percepciones, 0) as total_percepciones,
                COALESCE(p.monto_recibir, 0) as monto_recibir,
                COALESCE(p.bonificacion_fija, 0) as bonificacion_fija
            FROM rh_planillas p
            WHERE p.company_id = ? AND p.estado != 'anulada'
        `;
        const payrollParams = [companyId];
        if (month && year) {
            payrollQuery += ' AND p.periodo_mes = ? AND p.periodo_anio = ?';
            payrollParams.push(currentMonth, currentYear);
        }
        payrollQuery += ' ORDER BY p.periodo_anio DESC, p.periodo_mes DESC, p.id DESC LIMIT 50';

        const [payrolls] = await pool.query(payrollQuery, payrollParams);

        const totalPayrollPerceptions = payrolls.reduce((sum, p) => sum + parseFloat(p.total_percepciones || 0), 0);
        const totalPayrollBase = payrolls.reduce((sum, p) => sum + parseFloat(p.sueldo_base || 0), 0);

        // 2. Gastos Fijos y Operativos de Planta (Facturas / Comprobantes)
        let expensesQuery = `
            SELECT 
                h.id, h.fecha, h.numero_documento, h.monto_total, h.observaciones,
                i.description as item_description, i.total as item_total,
                t.name as expense_type_name
            FROM expense_headers h
            LEFT JOIN expense_items i ON h.id = i.expense_id
            LEFT JOIN cat_expense_types t ON i.expense_type_id = t.id
            WHERE h.company_id = ? AND h.status = 'ACTIVO'
        `;
        const expensesParams = [companyId];
        if (month && year) {
            expensesQuery += ' AND ((h.period_month = ? AND h.period_year = ?) OR (MONTH(h.fecha) = ? AND YEAR(h.fecha) = ?))';
            expensesParams.push(currentMonth, currentYear, currentMonth, currentYear);
        }
        expensesQuery += ' ORDER BY h.fecha DESC LIMIT 100';

        const [expenseRows] = await pool.query(expensesQuery, expensesParams);

        let energyTotal = 0;
        let boilerFuelTotal = 0;
        let maintenanceTotal = 0;
        let otherOpsTotal = 0;

        expenseRows.forEach(row => {
            const desc = ((row.item_description || '') + ' ' + (row.observaciones || '') + ' ' + (row.expense_type_name || '')).toLowerCase();
            const amount = parseFloat(row.item_total || row.monto_total || 0);

            if (/energ[ií]a|luz|electric|delsur|caess|clea|edesal/i.test(desc)) {
                energyTotal += amount;
            } else if (/diesel|di[eé]sel|combustible|gas\b|glp|bunker|caldera/i.test(desc)) {
                boilerFuelTotal += amount;
            } else if (/mantenimiento|reparaci[oó]n|repuesto|t[eé]cnico|taller/i.test(desc)) {
                maintenanceTotal += amount;
            } else {
                otherOpsTotal += amount;
            }
        });

        // 3. Obtener volumen proyectado de planta para cálculo por lote y por libra
        const [costingCfg] = await pool.query(
            "SELECT setting_key, setting_value FROM egg_costing_configurations WHERE company_id = ? AND setting_key IN ('monthly_projected_lbs', 'standard_batch_weight_lbs')",
            [companyId]
        );
        const cfgMap = {};
        costingCfg.forEach(c => { cfgMap[c.setting_key] = parseFloat(c.setting_value) || 0; });
        const monthlyProjectedLbs = cfgMap.monthly_projected_lbs || 100000;
        const standardBatchLbs = cfgMap.standard_batch_weight_lbs || 12000;
        const estimatedBatchesPerMonth = standardBatchLbs > 0 ? (monthlyProjectedLbs / standardBatchLbs) : 8;

        const suggestedConcepts = [
            {
                concept_name: 'Mano de Obra Operativa (Planilla RRHH)',
                monthly_total: totalPayrollPerceptions,
                default_value: estimatedBatchesPerMonth > 0 ? +(totalPayrollPerceptions / estimatedBatchesPerMonth).toFixed(2) : 0,
                source_type: 'rh_planillas',
                details: `${payrolls.length} registros de nómina encontrados. Total mensual: $${totalPayrollPerceptions.toFixed(2)}. Distribuido en ${estimatedBatchesPerMonth.toFixed(1)} lotes mensuales proyectados.`
            },
            {
                concept_name: 'Energía Eléctrica de Planta',
                monthly_total: energyTotal,
                default_value: estimatedBatchesPerMonth > 0 ? +(energyTotal / estimatedBatchesPerMonth).toFixed(2) : 0,
                source_type: 'expenses_energy',
                details: `Facturación eléctrica del período: $${energyTotal.toFixed(2)}.`
            },
            {
                concept_name: 'Combustible / Caldera (Diesel/Gas)',
                monthly_total: boilerFuelTotal,
                default_value: estimatedBatchesPerMonth > 0 ? +(boilerFuelTotal / estimatedBatchesPerMonth).toFixed(2) : 0,
                source_type: 'expenses_boiler',
                details: `Consumo de combustibles y caldera del período: $${boilerFuelTotal.toFixed(2)}.`
            },
            {
                concept_name: 'Mantenimiento Técnico y Repuestos',
                monthly_total: maintenanceTotal,
                default_value: estimatedBatchesPerMonth > 0 ? +(maintenanceTotal / estimatedBatchesPerMonth).toFixed(2) : 0,
                source_type: 'expenses_maintenance',
                details: `Servicios de mantenimiento y refacciones del período: $${maintenanceTotal.toFixed(2)}.`
            },
            {
                concept_name: 'Gastos Operativos e Indirectos Generales',
                monthly_total: otherOpsTotal,
                default_value: estimatedBatchesPerMonth > 0 ? +(otherOpsTotal / estimatedBatchesPerMonth).toFixed(2) : 0,
                source_type: 'expenses_general',
                details: `Otros gastos operativos registrados: $${otherOpsTotal.toFixed(2)}.`
            }
        ];

        res.json({
            period: { month: currentMonth, year: currentYear },
            payrolls_summary: {
                count: payrolls.length,
                total_perceptions: totalPayrollPerceptions,
                total_base: totalPayrollBase,
                items: payrolls
            },
            expenses_summary: {
                count: expenseRows.length,
                total: energyTotal + boilerFuelTotal + maintenanceTotal + otherOpsTotal,
                breakdown: {
                    energy: energyTotal,
                    boiler_fuel: boilerFuelTotal,
                    maintenance: maintenanceTotal,
                    other_ops: otherOpsTotal
                }
            },
            production_basis: {
                monthly_projected_lbs: monthlyProjectedLbs,
                standard_batch_lbs: standardBatchLbs,
                estimated_batches: estimatedBatchesPerMonth
            },
            suggested_concepts: suggestedConcepts
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const syncCostsSystemSources = async (req, res) => {
    try {
        const companyId = req.company_id;
        const { concepts, update_gif_config } = req.body;

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

        // Si se solicitó actualizar los GIF en egg_costing_configurations
        if (update_gif_config) {
            const totalMonthly = concepts.reduce((sum, c) => sum + (parseFloat(c.monthly_total) || 0), 0);
            if (totalMonthly > 0) {
                await pool.query(
                    `UPDATE egg_costing_configurations 
                     SET setting_value = ? 
                     WHERE company_id = ? AND setting_key = 'monthly_gif_total'`,
                    [totalMonthly, companyId]
                );
            }
        }

        res.json({ success: true, message: 'Conceptos de costos fijos y operativos sincronizados exitosamente.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 14.2 PARAMETRIZACIÓN DE PREFIJOS DE LOTE POR PROVEEDOR

// --- COSTOS VARIABLES POR LOTE ---
const getBatchVariableCosts = async (req, res) => {
    try {
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

// 16. CONTROL MICROBIOLÓGICO Y CALIDAD LAB-004 CON PARAMETRIZACIÓN DINÁMICA

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
