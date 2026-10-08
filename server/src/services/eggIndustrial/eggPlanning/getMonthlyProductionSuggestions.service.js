const { pool, computeJulianLotCode } = require('../../../controllers/eggIndustrial/eggPlanning/shared');
const { extractCustomerMap, resolveCustomerSelection, getCustomerKey } = require('./eggPlanningCustomerHelper');
const getMonthlyProductionSuggestions = async (req) => {
    const responseHeaders = {};
    try {
        const company_id = req.company_id || req.user?.company_id;
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const targetYear = parseInt(req.query.year) || now.getFullYear();
        const targetMonth = parseInt(req.query.month) || (now.getMonth() + 1); // 1-12
        const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

        // Determinar rango de fechas exacto (evitando retroactivos pasados por defecto)
        let startDateStr = req.query.start_date;
        let endDateStr = req.query.end_date;

        if (!startDateStr || !endDateStr) {
            const isCurrentMonthAndYear = (targetYear === now.getFullYear() && targetMonth === (now.getMonth() + 1));
            const startDay = isCurrentMonthAndYear ? now.getDate() : 1;
            startDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
            endDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
        }

        const preventPast = req.query.prevent_past !== 'false';
        if (preventPast && startDateStr < todayStr) {
            startDateStr = todayStr;
            if (endDateStr < startDateStr) {
                endDateStr = startDateStr;
            }
        }

        const separationBatchLbs = Math.min(12000, Math.max(3000, parseFloat(req.query.separation_batch_lbs) || 6000));

        // 1. Obtener pedidos de clientes en el rango o pendientes
        const [orders] = await pool.query(
            `SELECT * FROM egg_customer_orders
             WHERE company_id = ?
               AND ((required_delivery_date >= ? AND required_delivery_date <= ?) OR status = 'pendiente')
             ORDER BY required_delivery_date ASC`,
            [company_id, startDateStr, endDateStr]
        );

        // 2. Acuerdos comerciales mensuales
        const [agreements] = await pool.query(
            `SELECT * FROM egg_costing_customer_agreements
             WHERE company_id = ? AND status = 'activo'`,
            [company_id]
        );

        // Mapeo unificado de clientes elegibles (pedidos + acuerdos) y filtrado dinámico
        const rawAvailableCustomers = extractCustomerMap(orders, agreements);
        const { selectedKeys: selectedCustomerKeys, availableCustomers } = resolveCustomerSelection(rawAvailableCustomers, req.query.customer_ids);

        const filteredOrders = orders.filter(o => selectedCustomerKeys.has(getCustomerKey(o)));
        const filteredAgreements = agreements.filter(a => selectedCustomerKeys.has(getCustomerKey(a)));

        // 3. Ventas de ovoproductos de los últimos 6 meses (para calcular promedios reales)
        const [salesRows] = await pool.query(
            `SELECT p.nombre as product_name, SUM(si.cantidad) as total_lbs, COUNT(DISTINCT sh.id) as trans_count,
                    COUNT(DISTINCT DATE_FORMAT(sh.fecha_emision, '%Y-%m')) as months_count
             FROM sales_items si
             JOIN sales_headers sh ON si.sale_id = sh.id
             JOIN products p ON si.product_id = p.id
             WHERE sh.company_id = ? AND sh.estado != 'ANULADO'
               AND sh.fecha_emision >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
               AND (p.nombre LIKE '%huevo%' OR p.nombre LIKE '%clara%' OR p.nombre LIKE '%yema%')
             GROUP BY p.nombre`,
            [company_id]
        );

        // 4. Stock disponible en bodega
        const [rmRows] = await pool.query(
            `SELECT SUM(stock_lbs) as total_stock_lbs, SUM(total_boxes) as total_boxes
             FROM egg_raw_materials
             WHERE company_id = ? AND status = 'aprobado' AND stock_lbs > 0`,
            [company_id]
        );
        const availableStockLbs = parseFloat(rmRows[0]?.total_stock_lbs || 0);
        const availableStockBoxes = parseInt(rmRows[0]?.total_boxes || 0);

        // 5. Producciones ya programadas en el rango
        const [existingSchedule] = await pool.query(
            `SELECT id, production_date, lot_code, product_profile, target_quantity_lbs, status
             FROM egg_scheduled_productions
             WHERE company_id = ? AND production_date >= ? AND production_date <= ?
               AND status != 'cancelado'`,
            [company_id, startDateStr, endDateStr]
        );
        const scheduledDatesSet = new Set(
            existingSchedule.map(p => new Date(p.production_date).toISOString().split('T')[0])
        );

        // Agregación de demanda exacta de clientes seleccionados
        let demandClara = 0;
        let demandYema = 0;
        let demandEntero = 0;
        let demandFormulado = 0;
        let demandLeche = 0;

        filteredOrders.forEach(o => {
            const qty = parseFloat(o.quantity_lbs || 0);
            const p = (o.product_type || '').toLowerCase();
            if (p.includes('clara')) demandClara += qty;
            else if (p.includes('yema')) demandYema += qty;
            else if (p.includes('formulado') || p.includes('separaci')) demandFormulado += qty;
            else if (p.includes('leche')) demandLeche += qty;
            else demandEntero += qty;
        });

        filteredAgreements.forEach(a => {
            const vol = parseFloat(a.monthly_volume_lbs || 0);
            const p = (a.product_type || '').toLowerCase();
            if (p.includes('clara')) demandClara += vol;
            else if (p.includes('yema')) demandYema += vol;
            else if (p.includes('formulado') || p.includes('separaci')) demandFormulado += vol;
            else if (p.includes('leche')) demandLeche += vol;
            else demandEntero += vol;
        });

        // Promedio de ventas históricas mensuales
        let historyMonthlyAvgLbs = 0;
        if (salesRows.length > 0) {
            const sumLbs = salesRows.reduce((acc, r) => acc + (parseFloat(r.total_lbs) || 0), 0);
            const maxMonths = Math.max(1, Math.max(...salesRows.map(r => r.months_count || 1)));
            historyMonthlyAvgLbs = sumLbs / maxMonths;
        }

        // Si la empresa no tiene ningún pedido ni acuerdo cargado, proveer base de simulación
        const hasAnyCustomerData = (orders.length > 0 || agreements.length > 0);
        const baseDemandTotal = demandClara + demandYema + demandEntero + demandFormulado + demandLeche;

        if (!hasAnyCustomerData && baseDemandTotal === 0) {
            const targetMonthlyVolumeLbs = historyMonthlyAvgLbs > 10000 ? historyMonthlyAvgLbs : 54000;
            demandEntero = targetMonthlyVolumeLbs * 0.60;
            demandClara = targetMonthlyVolumeLbs * 0.25;
            demandFormulado = targetMonthlyVolumeLbs * 0.15;
        }

        const monthlyRuns = [];
        let totalProjectedLbs = 0;
        let totalBoxesNeeded = 0;
        let totalCoproductSavingsUsd = 0;

        // Iterar dentro del rango seleccionado [startDateStr, endDateStr]
        const [sYear, sMonth, sDay] = startDateStr.split('-').map(Number);
        const [eYear, eMonth, eDay] = endDateStr.split('-').map(Number);
        const startD = new Date(sYear, sMonth - 1, sDay);
        const endD = new Date(eYear, eMonth - 1, eDay);

        const totalDaysDiff = Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const allowAllWeekdays = totalDaysDiff <= 5;

        const currDate = new Date(startD);
        while (currDate <= endD) {
            const dayOfWeek = currDate.getDay(); // 0: Dom, 1: Lun, 2: Mar, 3: Mié, 4: Jue, 5: Vie, 6: Sáb
            const yStr = currDate.getFullYear();
            const mStr = String(currDate.getMonth() + 1).padStart(2, '0');
            const dStr = String(currDate.getDate()).padStart(2, '0');
            const dateStr = `${yStr}-${mStr}-${dStr}`;

            // Programar corridas operativas en Lunes (1), Miércoles (3) y Viernes (5), o en cualquier día hábil si el rango es corto
            const shouldSchedule = allowAllWeekdays
                ? (dayOfWeek >= 1 && dayOfWeek <= 5)
                : (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5);

            if (shouldSchedule) {
                let profile = 'Huevo Entero Pasteurizado';
                let targetLbs = 12000;
                let targetSolids = 23.5;
                let reason = 'Reposición de stock comercial según promedio histórico de ventas';
                let priority = 'media';
                let mixFormula = {};

                if (dayOfWeek === 1) {
                    // Lunes: Corrida de Separación / Clara de alta demanda
                    profile = 'Clara de Huevo Pasteurizada';
                    // Sizing de separación calibrado por lote operativo (evita saturar maquinaria y tanques)
                    const maxClaraPerBatch = Math.round(separationBatchLbs * 0.5395);
                    const weeklyClaraDemand = Math.round(demandClara / 4);
                    targetLbs = Math.min(maxClaraPerBatch, Math.max(1500, weeklyClaraDemand || maxClaraPerBatch));
                    targetSolids = 11.5;
                    const rawNeeded = Math.round(targetLbs / 0.5395);
                    const coprodYolk = Math.round(rawNeeded * 0.308);
                    const boxes = Math.round(rawNeeded / 36.1);
                    reason = `Separación en lote calibrado de ${rawNeeded.toLocaleString()} Lbs (${boxes} cajas). Genera ${targetLbs.toLocaleString()} Lbs de clara y ${coprodYolk.toLocaleString()} Lbs de yema coproducto sin sobrecargar tanques de frío.`;
                    priority = 'alta';
                    mixFormula = {
                        raw_egg_boxes: boxes,
                        raw_liquid_lbs: rawNeeded,
                        clara_produced_lbs: targetLbs,
                        yema_coproduct_lbs: coprodYolk,
                        water_h2o_lbs: 0,
                        separation_batch_limit_lbs: separationBatchLbs,
                        notes: `Separación centrífuga en lote controlado de ${rawNeeded.toLocaleString()} Lbs (máx ${separationBatchLbs.toLocaleString()} Lbs). Enfriar y almacenar yema en tanque HOLDING-2.`
                    };
                } else if (dayOfWeek === 3) {
                    // Miércoles: Corrida de Huevo Formulado (Yema coproducto + MP liquida A) -> Arbitraje
                    profile = 'Huevo Formulado por Separación';
                    const maxClaraPerBatch = Math.round(separationBatchLbs * 0.5395);
                    const weeklyClaraDemand = Math.round(demandClara / 4);
                    const plannedClara = Math.min(maxClaraPerBatch, Math.max(1500, weeklyClaraDemand || maxClaraPerBatch));
                    const surplusYolk = Math.round(plannedClara * (0.308 / 0.5395));
                    const waterAdded = Math.round(surplusYolk * 1.22);
                    targetLbs = surplusYolk + waterAdded;
                    targetSolids = 22.5;
                    const citricAcid = (targetLbs * 0.0015).toFixed(2);
                    const boxesSaved = Math.round(targetLbs / 36.1);
                    const moneySaved = boxesSaved * 38.00;
                    totalCoproductSavingsUsd += moneySaved;
                    reason = `Arbitraje Coproducto: Reincorporar ${surplusYolk.toLocaleString()} Lbs de yema del lunes con ${waterAdded.toLocaleString()} Lbs MP liquida A y ácido cítrico en lote de ${targetLbs.toLocaleString()} Lbs. Ahorro de $${moneySaved.toLocaleString()}`;
                    priority = 'alta';
                    mixFormula = {
                        raw_egg_boxes: 0,
                        raw_liquid_lbs: surplusYolk,
                        yema_reutilized_lbs: surplusYolk,
                        water_h2o_lbs: waterAdded,
                        water_bottles: Math.ceil(waterAdded / 41.8),
                        citric_acid_lbs: citricAcid,
                        notes: 'Balance yema coproducto + MP liquida A a 22.5% Brix. Validación LAB-004 obligatoria.'
                    };
                } else {
                    // Viernes: Huevo Entero Pasteurizado Puro
                    profile = 'Huevo Entero Pasteurizado';
                    targetLbs = 12000;
                    targetSolids = 23.5;
                    const boxes = Math.round(targetLbs / 36.1);
                    reason = 'Corrida estándar de huevo entero para entrega de fin de semana e inventario de rotación.';
                    priority = 'media';
                    mixFormula = {
                        raw_egg_boxes: boxes,
                        raw_liquid_lbs: targetLbs,
                        clara_separated_pct: 0,
                        water_h2o_lbs: 0,
                        notes: 'Pasteurización directa 64.5°C por 210s CCP-1.'
                    };
                }

                const julianLot = computeJulianLotCode(dateStr, 1);
                const boxesRun = mixFormula.raw_egg_boxes || Math.round(targetLbs / 36.1);

                totalProjectedLbs += targetLbs;
                totalBoxesNeeded += boxesRun;

                monthlyRuns.push({
                    production_date: dateStr,
                    start_time: '06:00:00',
                    end_time: '14:00:00',
                    lot_code: julianLot,
                    product_profile: profile,
                    presentation: 'cubeta 30LB',
                    target_quantity_lbs: targetLbs,
                    target_solids_pct: targetSolids,
                    priority,
                    suggestion_source: 'ai_plan_mensual',
                    reason,
                    mix_formula_json: mixFormula,
                    already_scheduled: scheduledDatesSet.has(dateStr),
                    tasks: [
                        { factory_role: 'Sanitización CIP', task_description: 'CIP térmico/químico a 78°C antes de encendido' },
                        { factory_role: 'Quebrado y Carga', task_description: `Alinear y quebrar ${boxesRun > 0 ? boxesRun + ' cajas de huevo' : 'cargar yema de tanque'}` },
                        { factory_role: 'Pasteurización HACCP', task_description: 'Monitorear CCP-1 a 64.5°C y flujo 12.5 GPM' },
                        { factory_role: 'Control de Calidad LAB-004', task_description: `Verificar Brix ${targetSolids}% y ausencia coliformes` },
                        { factory_role: 'Empaque y Cuarto Frío', task_description: `Envasar ${Math.ceil(targetLbs / 30)} cubetas de 30 Lb sanitizadas` }
                    ]
                });
            }

            currDate.setDate(currDate.getDate() + 1);
        }

        return ({ status: 200, body: {
            month: targetMonth,
            year: targetYear,
            date_range: {
                start_date: startDateStr,
                end_date: endDateStr,
                prevent_past: preventPast
            },
            separation_batch_lbs: separationBatchLbs,
            available_customers: availableCustomers,
            selected_customer_ids: Array.from(selectedCustomerKeys),
            summary: {
                target_month: targetMonth,
                target_year: targetYear,
                total_runs_suggested: monthlyRuns.length,
                total_projected_lbs: Math.round(totalProjectedLbs),
                total_egg_boxes_needed: totalBoxesNeeded,
                coproduct_savings_usd: Math.round(totalCoproductSavingsUsd),
                available_stock_boxes: availableStockBoxes,
                available_stock_lbs: Math.round(availableStockLbs),
                coverage_status: availableStockBoxes >= totalBoxesNeeded ? 'Stock Suficiente' : 'Requiere Compra de MP'
            },
            kpis: {
                total_projected_lbs: totalProjectedLbs,
                total_boxes_needed: totalBoxesNeeded,
                available_stock_lbs: availableStockLbs,
                available_stock_boxes: availableStockBoxes,
                stock_balance_boxes: availableStockBoxes - totalBoxesNeeded,
                total_coproduct_savings_usd: Math.round(totalCoproductSavingsUsd),
                batches_count: monthlyRuns.length,
                pending_orders_count: filteredOrders.length,
                active_agreements_count: filteredAgreements.length,
                sales_history_monthly_avg_lbs: Math.round(historyMonthlyAvgLbs),
                already_scheduled_count: existingSchedule.length,
                selected_customers_count: selectedCustomerKeys.size,
                total_customers_count: availableCustomers.length,
                separation_batch_lbs: separationBatchLbs
            },
            monthly_plan: monthlyRuns
        }, headers: responseHeaders });
    } catch (error) {
        console.error('Error al generar sugerencia mensual de producción:', error);
        return ({ status: 500, body: { message: error.message }, headers: responseHeaders });
    }
};
module.exports = getMonthlyProductionSuggestions;
