const pool = require('../../config/db');

const STANDARD_PACKAGING_ITEMS = [
    ['CUBETA-30LB', 'Cubeta Plástica Blanca 30 LBS Grado Alimenticio', 2.4000, 'recipiente'],
    ['TAPA-30LB', 'Tapadera Hermética para Cubeta 30 LBS', 0.6500, 'tapadera'],
    ['LINER-30LB', 'Bolsa Plástica Liner Polietileno Virgen', 0.3000, 'liner'],
    ['ETIQ-4X2', 'Etiqueta Térmica Polipropileno 4x2 Pulgadas', 0.0350, 'etiqueta'],
    ['ETIQ-4X4', 'Etiqueta Térmica de Lote y Trazabilidad 4x4 Pulgadas', 0.0500, 'etiqueta'],
    ['GALON-8LB', 'Envase Plástico Galón 8 LBS con Asa', 0.8500, 'recipiente'],
    ['TAPA-GALON', 'Tapa con Sello de Seguridad para Galón', 0.1500, 'tapadera'],
    ['MEDIO-GALON', 'Envase Plástico Medio Galón 4 LBS', 0.5500, 'recipiente'],
    ['TAPA-MEDIO-GALON', 'Tapa con Sello para Medio Galón', 0.1000, 'tapadera'],
    ['LITRO-2LB', 'Botella Plástica Litro 2 LBS', 0.3500, 'recipiente'],
    ['TAPA-LITRO', 'Tapa con Sello para Botella 2 LBS', 0.0800, 'tapadera'],
    ['MEDIO-LITRO-1LB', 'Botella Plástica Medio Litro 1 LB', 0.2500, 'recipiente'],
    ['TAPA-MEDIO-LITRO', 'Tapa con Sello para Botella 1 LB', 0.0500, 'tapadera']
];

const matchCatalogProductForPackaging = (itemCode, products) => {
    const code = (itemCode || '').toUpperCase();
    const byExactSku = (skus) => products.find(p => skus.includes((p.codigo || '').trim().toUpperCase()));
    if (code === 'GALON-8LB') return byExactSku(['ENVASE1GLN', 'ENV-1GLN']) || products.find(p => /envase.*1\s*gal/i.test(p.nombre || ''));
    if (code === 'MEDIO-GALON') return byExactSku(['ENVASE1/2GLN', 'ENV-1/2GLN']) || products.find(p => /envase.*1\/2\s*gal|envase.*medio\s*gal/i.test(p.nombre || ''));
    if (code === 'LITRO-2LB') return byExactSku(['ENVASE1L', 'ENV-1L']) || products.find(p => /envase.*1\s*l\b|botella.*litro/i.test(p.nombre || ''));
    if (code === 'MEDIO-LITRO-1LB') return byExactSku(['ENVASE1/2L', 'ENV-1/2L']) || products.find(p => /envase.*1\/2\s*l|medio\s*litro/i.test(p.nombre || ''));
    if (code === 'TAPA-GALON' || code === 'TAPA-MEDIO-GALON') return byExactSku(['TAPADERA35MM', 'TAPA35MM']) || products.find(p => /tapadera.*35\s*mm|tapa.*gal/i.test(p.nombre || ''));
    if (code === 'TAPA-LITRO' || code === 'TAPA-MEDIO-LITRO') return byExactSku(['TAPADERA38MM', 'TAPA38MM']) || products.find(p => /tapadera.*38\s*mm|tapa.*litro/i.test(p.nombre || ''));
    if (code === 'LINER-30LB') return byExactSku(['BOLSA30LB', 'LINER30LB']) || products.find(p => /bolsa.*cubeta|bolsa.*30\s*lb|liner/i.test(p.nombre || ''));
    if (code === 'CUBETA-30LB') return byExactSku(['CUBETA30LB', 'CUBETA32LB', 'ENV-CUB30']) || products.find(p => /^cubeta\s*(pl[aá]stica|30|32)/i.test(p.nombre || ''));
    if (code === 'TAPA-30LB') return byExactSku(['TAPACUBETA', 'TAPA-CUB30']) || products.find(p => /tapa.*cubeta/i.test(p.nombre || ''));
    return null;
};

const ensureAndLinkCostingCatalog = async (companyId, syncCostsFromCatalog = false) => {
    if (!companyId) return { updatedCount: 0, details: [] };
    const [existingPack] = await pool.query('SELECT id, item_code, item_name, unit_cost, product_id FROM egg_costing_packaging WHERE company_id = ?', [companyId]);
    const existingCodes = new Set(existingPack.map(r => (r.item_code || '').toUpperCase()));

    for (const [item_code, item_name, unit_cost, category] of STANDARD_PACKAGING_ITEMS) {
        if (!existingCodes.has(item_code)) {
            await pool.query(
                'INSERT IGNORE INTO egg_costing_packaging (company_id, item_code, item_name, unit_cost, category) VALUES (?, ?, ?, ?, ?)',
                [companyId, item_code, item_name, unit_cost, category]
            );
        }
    }

    const [products] = await pool.query(
        'SELECT id, codigo, nombre, costo FROM products WHERE company_id = ? AND (status IS NULL OR status = "activo")',
        [companyId]
    );
    const [packRows] = await pool.query('SELECT id, item_code, item_name, unit_cost, product_id FROM egg_costing_packaging WHERE company_id = ?', [companyId]);

    let updatedCount = 0;
    const details = [];

    for (const pack of packRows) {
        let targetProductId = pack.product_id;
        let matchedProd = targetProductId ? products.find(p => p.id === targetProductId) : null;

        if (!targetProductId) {
            matchedProd = matchCatalogProductForPackaging(pack.item_code, products);
            if (matchedProd) {
                targetProductId = matchedProd.id;
                await pool.query('UPDATE egg_costing_packaging SET product_id = ? WHERE id = ?', [targetProductId, pack.id]);
            }
        }

        if (matchedProd) {
            const catCost = parseFloat(matchedProd.costo) || 0;
            const currentCost = parseFloat(pack.unit_cost) || 0;
            // Actualizar si se pidió sincronizar o si aún tiene el costo semilla por defecto y el catálogo tiene costo real
            const stdItem = STANDARD_PACKAGING_ITEMS.find(s => s[0] === pack.item_code);
            const isDefaultSeedCost = stdItem && Math.abs(currentCost - stdItem[2]) < 0.0001;
            if (catCost > 0 && (syncCostsFromCatalog || isDefaultSeedCost) && Math.abs(currentCost - catCost) > 0.0001) {
                await pool.query('UPDATE egg_costing_packaging SET unit_cost = ? WHERE id = ?', [catCost, pack.id]);
                updatedCount++;
                details.push({
                    type: 'Empaque (Catálogo)',
                    name: pack.item_name,
                    code: pack.item_code,
                    old_cost: currentCost,
                    new_cost: catCost,
                    invoice: `CAT-${matchedProd.codigo}`,
                    provider: 'Catálogo de Productos'
                });
            }
        }
    }

    return { updatedCount, details };
};

const getRealRawEggMetrics = async (companyId, startDate = null, endDate = null) => {
    let rawSql = `
        SELECT
            COUNT(*) as total_receptions,
            COALESCE(SUM(weight_lbs), 0) as total_lbs_received,
            COALESCE(SUM(COALESCE(NULLIF(initial_boxes, 0), total_boxes)), 0) as total_boxes_received,
            COALESCE(SUM(CASE WHEN egg_type LIKE '%cáscara%' OR egg_type LIKE '%cascara%' OR egg_type IS NULL THEN weight_lbs ELSE 0 END), 0) as shell_lbs,
            COALESCE(SUM(CASE WHEN egg_type LIKE '%cáscara%' OR egg_type LIKE '%cascara%' OR egg_type IS NULL THEN COALESCE(NULLIF(initial_boxes, 0), total_boxes) ELSE 0 END), 0) as shell_boxes
        FROM egg_raw_materials
        WHERE company_id = ? AND status = 'aprobado'
    `;
    const rawParams = [companyId];
    if (startDate && endDate) {
        rawSql += ' AND COALESCE(fecha, DATE(created_at)) BETWEEN ? AND ?';
        rawParams.push(startDate, endDate);
    } else if (startDate) {
        rawSql += ' AND COALESCE(fecha, DATE(created_at)) >= ?';
        rawParams.push(startDate);
    } else if (endDate) {
        rawSql += ' AND COALESCE(fecha, DATE(created_at)) <= ?';
        rawParams.push(endDate);
    }

    let [rawStats] = await pool.query(rawSql, rawParams);
    let isHistoricalFallback = false;
    if ((parseInt(rawStats[0]?.total_receptions) || 0) === 0 && (startDate || endDate)) {
        const [allRaw] = await pool.query(`
            SELECT
                COUNT(*) as total_receptions,
                COALESCE(SUM(weight_lbs), 0) as total_lbs_received,
                COALESCE(SUM(COALESCE(NULLIF(initial_boxes, 0), total_boxes)), 0) as total_boxes_received,
                COALESCE(SUM(CASE WHEN egg_type LIKE '%cáscara%' OR egg_type LIKE '%cascara%' OR egg_type IS NULL THEN weight_lbs ELSE 0 END), 0) as shell_lbs,
                COALESCE(SUM(CASE WHEN egg_type LIKE '%cáscara%' OR egg_type LIKE '%cascara%' OR egg_type IS NULL THEN COALESCE(NULLIF(initial_boxes, 0), total_boxes) ELSE 0 END), 0) as shell_boxes
            FROM egg_raw_materials
            WHERE company_id = ? AND status = 'aprobado'
        `, [companyId]);
        if ((parseInt(allRaw[0]?.total_receptions) || 0) > 0) {
            rawStats = allRaw;
            isHistoricalFallback = true;
        }
    }

    const shellBoxes = parseFloat(rawStats[0]?.shell_boxes) || 0;
    const shellLbs = parseFloat(rawStats[0]?.shell_lbs) || 0;
    const rawAvg = shellBoxes > 0 ? (shellLbs / shellBoxes) : 47.88;
    const avgLbsPerBox = (rawAvg >= 30 && rawAvg <= 65) ? rawAvg : 47.88;

    const [productCost] = await pool.query(
        `SELECT costo FROM products
         WHERE company_id = ? AND (codigo = 'H1' OR nombre LIKE '%huevo cáscara%' OR nombre LIKE '%huevo cascara%' OR nombre LIKE '%huevo en cascara%' OR nombre LIKE '%cajas de huevo%')
         ORDER BY CASE WHEN costo > 0 THEN 0 ELSE 1 END, id DESC LIMIT 1`,
        [companyId]
    );
    const [cfgCost] = await pool.query(
        "SELECT setting_value FROM egg_costing_configurations WHERE company_id = ? AND setting_key = 'raw_egg_box_cost' LIMIT 1",
        [companyId]
    );
    const prodCostoVal = productCost.length > 0 ? parseFloat(productCost[0].costo) : 0;
    const cfgCostoVal = cfgCost.length > 0 ? parseFloat(cfgCost[0].setting_value) : 0;
    const realBoxCost = prodCostoVal > 0 ? prodCostoVal : (cfgCostoVal > 0 ? cfgCostoVal : 38.00);

    return {
        total_receptions: parseInt(rawStats[0]?.total_receptions) || 0,
        total_lbs_received: parseFloat(rawStats[0]?.total_lbs_received) || 0,
        total_boxes_received: parseFloat(rawStats[0]?.total_boxes_received) || 0,
        avg_lbs_per_box: +avgLbsPerBox.toFixed(2),
        real_box_cost: +realBoxCost.toFixed(2),
        is_historical_fallback: isHistoricalFallback
    };
};

const computeSystemCostsData = async (companyId, { month, year, projected_batches } = {}) => {
    const now = new Date();
    const currentYear = parseInt(year) || now.getFullYear();
    const currentMonth = parseInt(month) || (now.getMonth() + 1);

    // 1. Planillas RRHH (o fallback a empleados activos de rh_empleados)
    const [payrolls] = await pool.query(`
        SELECT p.id, p.empleado_id, p.periodo_mes, p.periodo_anio, p.quincena, p.estado,
               COALESCE(p.sueldo_base, 0) as sueldo_base,
               COALESCE(p.total_percepciones, 0) as total_percepciones,
               COALESCE(p.monto_recibir, 0) as monto_recibir,
               COALESCE(p.bonificacion_fija, 0) as bonificacion_fija
        FROM rh_planillas p
        WHERE p.company_id = ? AND p.estado != 'anulada'
          AND p.periodo_mes = ? AND p.periodo_anio = ?
        ORDER BY p.id DESC
    `, [companyId, currentMonth, currentYear]);

    let employeeCount = 0;
    let totalBaseSalary = 0;
    let totalBonuses = 0;
    let totalPayroll = 0;

    if (payrolls.length > 0) {
        const uniqueEmps = new Set(payrolls.map(p => p.empleado_id).filter(Boolean));
        employeeCount = uniqueEmps.size || payrolls.length;
        totalBaseSalary = payrolls.reduce((s, p) => s + parseFloat(p.sueldo_base || 0), 0);
        totalPayroll = payrolls.reduce((s, p) => s + parseFloat(p.total_percepciones || p.sueldo_base || 0), 0);
        totalBonuses = Math.max(0, totalPayroll - totalBaseSalary);
    } else {
        const [empRows] = await pool.query(`
            SELECT COUNT(*) as emp_count,
                   COALESCE(SUM(sueldo_base), 0) as total_base,
                   COALESCE(SUM(bonificacion_fija), 0) as total_bonus
            FROM rh_empleados
            WHERE company_id = ? AND (es_activo = 1 OR es_activo IS NULL)
        `, [companyId]);
        employeeCount = parseInt(empRows[0]?.emp_count) || 0;
        totalBaseSalary = parseFloat(empRows[0]?.total_base) || 0;
        totalBonuses = parseFloat(empRows[0]?.total_bonus) || 0;
        totalPayroll = totalBaseSalary + totalBonuses;
    }

    // 2. Configuraciones de planta y lotes proyectados
    const [costingCfg] = await pool.query(
        'SELECT setting_key, setting_value FROM egg_costing_configurations WHERE company_id = ?',
        [companyId]
    );
    const cfgMap = {};
    costingCfg.forEach(c => { cfgMap[c.setting_key] = parseFloat(c.setting_value) || 0; });
    const monthlyProjectedLbs = cfgMap.monthly_projected_lbs || 100000;
    const standardBatchLbs = cfgMap.standard_batch_weight_lbs || 12000;
    const defaultBatches = standardBatchLbs > 0 ? Math.max(1, Math.round(monthlyProjectedLbs / standardBatchLbs)) : 10;
    const batchesCount = parseInt(projected_batches) > 0 ? parseInt(projected_batches) : defaultBatches;

    // 3. Gastos contables (expense_headers) + Costos operativos de planta configurados
    const [expenseRows] = await pool.query(`
        SELECT h.id, h.fecha, h.monto_total, h.observaciones,
               i.description as item_description, i.total as item_total,
               t.name as expense_type_name
        FROM expense_headers h
        LEFT JOIN expense_items i ON h.id = i.expense_id
        LEFT JOIN cat_expense_types t ON i.expense_type_id = t.id
        WHERE h.company_id = ? AND h.status = 'ACTIVO'
          AND ((h.period_month = ? AND h.period_year = ?) OR (MONTH(h.fecha) = ? AND YEAR(h.fecha) = ?))
    `, [companyId, currentMonth, currentYear, currentMonth, currentYear]);

    let energyTotal = 0;
    let boilerFuelTotal = 0;
    let maintenanceTotal = 0;
    let waterAndCipTotal = 0;
    let otherOpsTotal = 0;

    expenseRows.forEach(row => {
        const desc = `${row.item_description || ''} ${row.observaciones || ''} ${row.expense_type_name || ''}`.toLowerCase();
        const amount = parseFloat(row.item_total || row.monto_total || 0);
        if (/energ[ií]a|luz|electric|delsur|caess|clea|edesal/i.test(desc)) energyTotal += amount;
        else if (/diesel|di[eé]sel|combustible|gas\b|glp|bunker|caldera/i.test(desc)) boilerFuelTotal += amount;
        else if (/mantenimiento|reparaci[oó]n|repuesto|t[eé]cnico|taller/i.test(desc)) maintenanceTotal += amount;
        else if (/agua|cip|qu[ií]mico|sanitiz/i.test(desc)) waterAndCipTotal += amount;
        else otherOpsTotal += amount;
    });

    // Si no hay facturas contables en expense_headers para ese rubro, calcular con los parámetros técnicos reales de planta
    const [cipRows] = await pool.query("SELECT * FROM egg_costing_cip_items WHERE company_id = ? AND status = 'activo'", [companyId]);
    const cipBatchCost = cipRows.reduce((s, item) => {
        const unitCost = (parseFloat(item.presentation_qty) || 0) > 0
            ? (parseFloat(item.presentation_cost) || 0) / parseFloat(item.presentation_qty)
            : 0;
        return s + unitCost * (parseFloat(item.dose_per_batch) || 0);
    }, 0) || 50.45;

    if (energyTotal === 0) energyTotal = (cfgMap.boiler_kwh_cost_batch || 386.00) * batchesCount;
    if (boilerFuelTotal === 0) boilerFuelTotal = ((cfgMap.boiler_diesel_gal_batch || 20.84) * (cfgMap.boiler_diesel_price_gal || 4.14)) * batchesCount;
    if (waterAndCipTotal === 0) waterAndCipTotal = ((cfgMap.boiler_water_cost_batch || 17.34) + cipBatchCost) * batchesCount;
    if (maintenanceTotal === 0) {
        const [mRows] = await pool.query('SELECT COALESCE(SUM(cost), 0) as total_m FROM egg_machinery_maintenance WHERE company_id = ?', [companyId]);
        maintenanceTotal = parseFloat(mRows[0]?.total_m) > 0 ? parseFloat(mRows[0].total_m) : +(batchesCount * 45.00).toFixed(2);
    }

    const categoryBreakdown = [
        { categoria: 'Energía Eléctrica Pasteurizador y Planta', total: +energyTotal.toFixed(2) },
        { categoria: 'Combustible Caldera (Diesel / Vapor)', total: +boilerFuelTotal.toFixed(2) },
        { categoria: 'Agua Suavizada y Químicos CIP', total: +waterAndCipTotal.toFixed(2) },
        { categoria: 'Mantenimiento Técnico y Laboratorio', total: +maintenanceTotal.toFixed(2) }
    ];
    if (otherOpsTotal > 0) {
        categoryBreakdown.push({ categoria: 'Otros Gastos Indirectos Operativos', total: +otherOpsTotal.toFixed(2) });
    }
    let containersColdStorageTotal = 0;
    let containersDaysTotal = 0;
    try {
        const [activeContRows] = await pool.query(
            'SELECT COALESCE(SUM(days_on), 0) AS active_days, COALESCE(SUM(days_on * daily_rate), 0) AS active_subtotal FROM egg_storage_containers WHERE company_id = ? AND days_on > 0',
            [companyId]
        );
        const [closedCycleRows] = await pool.query(
            `SELECT COALESCE(SUM(days_on), 0) AS closed_days, COALESCE(SUM(subtotal), 0) AS closed_subtotal
             FROM egg_storage_container_logs
             WHERE company_id = ? AND action_type = 'cierre_ciclo'
               AND MONTH(created_at) = ? AND YEAR(created_at) = ?`,
            [companyId, currentMonth, currentYear]
        );
        containersDaysTotal = +((parseFloat(activeContRows[0]?.active_days) || 0) + (parseFloat(closedCycleRows[0]?.closed_days) || 0)).toFixed(2);
        containersColdStorageTotal = +((parseFloat(activeContRows[0]?.active_subtotal) || 0) + (parseFloat(closedCycleRows[0]?.closed_subtotal) || 0)).toFixed(2);
        if (containersColdStorageTotal > 0) {
            categoryBreakdown.push({
                categoria: `Contenedores de Almacenamiento en Frío (${containersDaysTotal} días)`,
                total: containersColdStorageTotal
            });
            otherOpsTotal += containersColdStorageTotal;
        }
    } catch {
        // Ignorar si la tabla aún no existe
    }
    if (true) {
    }

    const totalExpenses = +(energyTotal + boilerFuelTotal + waterAndCipTotal + maintenanceTotal + otherOpsTotal).toFixed(2);
    const payrollPerBatch = batchesCount > 0 ? +(totalPayroll / batchesCount).toFixed(2) : 0;
    const expensesPerBatch = batchesCount > 0 ? +(totalExpenses / batchesCount).toFixed(2) : 0;
    const totalMonthlyCosts = +(totalPayroll + totalExpenses).toFixed(2);
    const totalCostPerBatch = +(payrollPerBatch + expensesPerBatch).toFixed(2);

    const suggestedConcepts = [
        {
            concept_name: 'Mano de Obra Operativa (Planilla RRHH)',
            monthly_total: +totalPayroll.toFixed(2),
            default_value: payrollPerBatch,
            source_type: 'rh_planillas',
            details: `${employeeCount} empleados activos ($${totalPayroll.toFixed(2)}/mes) entre ${batchesCount} lotes.`
        },
        {
            concept_name: 'Energía Eléctrica de Planta',
            monthly_total: +energyTotal.toFixed(2),
            default_value: +(energyTotal / batchesCount).toFixed(2),
            source_type: 'expenses_energy',
            details: `Costo eléctrico mensual estimado: $${energyTotal.toFixed(2)}.`
        },
        {
            concept_name: 'Combustible / Caldera (Diesel/Vapor)',
            monthly_total: +boilerFuelTotal.toFixed(2),
            default_value: +(boilerFuelTotal / batchesCount).toFixed(2),
            source_type: 'expenses_boiler',
            details: `Consumo térmico de caldera: $${boilerFuelTotal.toFixed(2)}.`
        },
        {
            concept_name: 'Agua Suavizada y Sanitización CIP',
            monthly_total: +waterAndCipTotal.toFixed(2),
            default_value: +(waterAndCipTotal / batchesCount).toFixed(2),
            source_type: 'expenses_cip',
            details: `Agua suavizada y químicos CIP: $${waterAndCipTotal.toFixed(2)}.`
        },
        {
            concept_name: 'Mantenimiento Técnico y Control Calidad',
            monthly_total: +maintenanceTotal.toFixed(2),
            default_value: +(maintenanceTotal / batchesCount).toFixed(2),
            source_type: 'expenses_maintenance',
            details: `Mantenimiento preventivo y pruebas de calidad: $${maintenanceTotal.toFixed(2)}.`
        }
    ];

    return {
        period: { month: currentMonth, year: currentYear },
        payroll: {
            employee_count: employeeCount,
            total_base_salary: +totalBaseSalary.toFixed(2),
            total_bonuses: +totalBonuses.toFixed(2),
            total_payroll: +totalPayroll.toFixed(2),
            cost_per_batch: payrollPerBatch
        },
        expenses: {
            category_breakdown: categoryBreakdown,
            total_expenses: totalExpenses,
            cost_per_batch: expensesPerBatch
        },
        summary: {
            total_monthly_costs: totalMonthlyCosts,
            projected_batches: batchesCount,
            cost_per_batch: totalCostPerBatch
        },
        payrolls_summary: { count: employeeCount, total_perceptions: +totalPayroll.toFixed(2), total_base: +totalBaseSalary.toFixed(2), items: payrolls },
        expenses_summary: { count: categoryBreakdown.length, total: totalExpenses, breakdown: { energy: energyTotal, boiler_fuel: boilerFuelTotal, maintenance: maintenanceTotal, other_ops: waterAndCipTotal + otherOpsTotal } },
        production_basis: { monthly_projected_lbs: monthlyProjectedLbs, standard_batch_lbs: standardBatchLbs, estimated_batches: batchesCount },
        suggested_concepts: containersColdStorageTotal > 0
            ? [
                ...suggestedConcepts,
                {
                    concept_name: 'Almacenamiento en Contenedores de Frío',
                    monthly_total: +containersColdStorageTotal.toFixed(2),
                    default_value: +(containersColdStorageTotal / batchesCount).toFixed(2),
                    source_type: 'egg_storage_containers',
                    details: `${containersDaysTotal} día(s) acumulados en contenedores de frío ($${containersColdStorageTotal.toFixed(2)} sin IVA).`
                }
            ]
            : suggestedConcepts
    };
};

const ensureHistoricalBatchCosts = async (companyId, forceRecalculate = false) => {
    if (!companyId) return;
    await ensureAndLinkCostingCatalog(companyId, false);

    // 1. Si egg_cost_concepts está vacío, poblar con conceptos reales del sistema
    const [existingConcepts] = await pool.query('SELECT COUNT(*) as c FROM egg_cost_concepts WHERE company_id = ?', [companyId]);
    if ((existingConcepts[0]?.c || 0) === 0) {
        const sysData = await computeSystemCostsData(companyId, {});
        for (const c of sysData.suggested_concepts) {
            await pool.query(
                'INSERT INTO egg_cost_concepts (company_id, concept_name, default_value) VALUES (?, ?, ?)',
                [companyId, c.concept_name, c.default_value]
            );
        }
    }

    // 2. Sincronizar costos por lote en egg_industrial_costs y egg_batch_variable_costs
    const [batches] = await pool.query(
        "SELECT id, product_type, presentation, input_weight_lbs, yield_liquid_lbs, is_coproduct FROM egg_production_batches WHERE company_id = ? AND status != 'cancelado'",
        [companyId]
    );
    if (batches.length === 0) return;

    const [existingIndCosts] = await pool.query('SELECT batch_id FROM egg_industrial_costs WHERE company_id = ?', [companyId]);
    const indBatchSet = new Set(existingIndCosts.map(r => r.batch_id));
    if (!forceRecalculate && indBatchSet.size >= batches.length) return;

    const rawMetrics = await getRealRawEggMetrics(companyId);
    const mpCostPerLbInput = rawMetrics.avg_lbs_per_box > 0 ? (rawMetrics.real_box_cost / rawMetrics.avg_lbs_per_box) : (38 / 47.88);

    const [packRows] = await pool.query('SELECT item_code, unit_cost FROM egg_costing_packaging WHERE company_id = ?', [companyId]);
    const packMap = {};
    packRows.forEach(p => { packMap[(p.item_code || '').toUpperCase()] = parseFloat(p.unit_cost) || 0; });

    const [pkgRecords] = await pool.query(
        'SELECT batch_id, presentation, units_packaged, total_batch_weight_lbs FROM egg_packaging_records WHERE company_id = ?',
        [companyId]
    );

    const getUnitPackCost = (pres) => {
        const p = (pres || '').toLowerCase();
        if (p.includes('medio gal')) return (packMap['MEDIO-GALON'] || 0.2441) + (packMap['TAPA-MEDIO-GALON'] || 0.0215) + (packMap['ETIQ-4X2'] || 0.035);
        if (p.includes('gal')) return (packMap['GALON-8LB'] || 0.3639) + (packMap['TAPA-GALON'] || 0.0215) + (packMap['ETIQ-4X2'] || 0.035);
        if (p.includes('medio litro')) return (packMap['MEDIO-LITRO-1LB'] || 0.25) + (packMap['TAPA-MEDIO-LITRO'] || 0.0215) + (packMap['ETIQ-4X2'] || 0.035);
        if (p.includes('litro')) return (packMap['LITRO-2LB'] || 0.1522) + (packMap['TAPA-LITRO'] || 0.0215) + (packMap['ETIQ-4X2'] || 0.035);
        return (packMap['CUBETA-30LB'] || 2.40) + (packMap['TAPA-30LB'] || 0.65) + (packMap['LINER-30LB'] || 0.30) + (packMap['ETIQ-4X4'] || 0.05);
    };

    for (const b of batches) {
        const yieldLbs = parseFloat(b.yield_liquid_lbs) || 0;
        const inputLbs = parseFloat(b.input_weight_lbs) || yieldLbs;
        const batchPkgs = pkgRecords.filter(r => r.batch_id === b.id);
        let pkgCost = 0;
        if (batchPkgs.length > 0) {
            pkgCost = batchPkgs.reduce((s, r) => s + (parseFloat(r.units_packaged) || 0) * getUnitPackCost(r.presentation), 0);
        } else {
            const estUnits = Math.max(1, Math.round(yieldLbs / 30));
            pkgCost = estUnits * getUnitPackCost(b.presentation || 'cubeta 30LB');
        }

        const scale = Math.max(0.25, Math.min(1.5, yieldLbs / 10000));
        const dieselCost = +(86.28 * scale).toFixed(2);
        const elecCost = +(386.00 * scale).toFixed(2);
        const waterCost = +(17.34 * scale).toFixed(2);
        const laborCost = +(yieldLbs * 0.05).toFixed(2);
        const cipCost = +(50.45 * scale).toFixed(2);
        const qualityCost = 25.00;
        const rawMaterialCost = b.is_coproduct ? +(yieldLbs * mpCostPerLbInput * 0.85).toFixed(2) : +(inputLbs * mpCostPerLbInput).toFixed(2);

        if (indBatchSet.has(b.id)) {
            if (forceRecalculate) {
                await pool.query(
                    `UPDATE egg_industrial_costs
                     SET diesel_cost = ?, electricity_cost = ?, water_cost = ?, labor_cost = ?, packaging_materials_cost = ?, chemicals_cip_cost = ?, quality_tests_cost = ?
                     WHERE company_id = ? AND batch_id = ?`,
                    [dieselCost, elecCost, waterCost, laborCost, +pkgCost.toFixed(2), cipCost, qualityCost, companyId, b.id]
                );
            }
        } else {
            await pool.query(
                `INSERT INTO egg_industrial_costs (company_id, batch_id, diesel_cost, electricity_cost, water_cost, labor_cost, packaging_materials_cost, chemicals_cip_cost, quality_tests_cost)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [companyId, b.id, dieselCost, elecCost, waterCost, laborCost, +pkgCost.toFixed(2), cipCost, qualityCost]
            );
        }

        // Asegurar costos variables del lote (Materia Prima + Empaque) para Centro de Costos de Producción
        const [vcCount] = await pool.query('SELECT COUNT(*) as c FROM egg_batch_variable_costs WHERE company_id = ? AND batch_id = ?', [companyId, b.id]);
        if ((vcCount[0]?.c || 0) === 0 && rawMaterialCost > 0) {
            await pool.query(
                `INSERT INTO egg_batch_variable_costs (company_id, batch_id, concept_name, amount) VALUES (?, ?, ?, ?), (?, ?, ?, ?)`,
                [
                    companyId, b.id, 'Materia Prima (Huevo en Cáscara Procesado)', rawMaterialCost,
                    companyId, b.id, 'Material de Empaque y Envasado del Lote', +pkgCost.toFixed(2)
                ]
            );
        }
    }
};

module.exports = {
    STANDARD_PACKAGING_ITEMS,
    ensureAndLinkCostingCatalog,
    getRealRawEggMetrics,
    computeSystemCostsData,
    ensureHistoricalBatchCosts
};
