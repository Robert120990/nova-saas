const { pool } = require('../../../controllers/eggIndustrial/eggPlanning/shared');

const getRawMaterialPlanning = async (req) => {
    const responseHeaders = {};
    try {
        const company_id = req.company_id || req.user?.company_id;
        const now = new Date();
        const targetYear = parseInt(req.query.year) || now.getFullYear();
        const targetMonth = parseInt(req.query.month) || (now.getMonth() + 1);

        // 1. Obtener todas las producciones programadas del mes
        const [scheduledProds] = await pool.query(
            `SELECT * FROM egg_scheduled_productions
             WHERE company_id = ? AND MONTH(production_date) = ? AND YEAR(production_date) = ?
               AND status != 'cancelado'
             ORDER BY production_date ASC`,
            [company_id, targetMonth, targetYear]
        );

        // 2. Obtener inventario actual de materia prima aprobado
        const [rmRows] = await pool.query(
            `SELECT SUM(stock_lbs) as total_stock_lbs, SUM(total_boxes) as total_boxes
             FROM egg_raw_materials
             WHERE company_id = ? AND status = 'aprobado' AND stock_lbs > 0`,
            [company_id]
        );
        const currentStockLbs = parseFloat(rmRows[0]?.total_stock_lbs || 0);
        const currentStockBoxes = parseInt(rmRows[0]?.total_boxes || 0);

        // 3. Obtener lista de proveedores activos
        let providers = [];
        let allProviders = [];
        try {
            const [provRows] = await pool.query(
                `SELECT id, nombre, nombre_comercial, telefono, correo FROM providers
                 WHERE company_id = ? AND status = 'activo'
                 ORDER BY nombre ASC`,
                [company_id]
            );
            allProviders = provRows;
            providers = provRows.filter(p => {
                const n = (p.nombre || '').toLowerCase();
                return n.includes('avicol') || n.includes('granja') || n.includes('huevo') || n.includes('agro') || n.includes('el salvador') || n.includes('guatemala');
            });
            if (providers.length === 0) providers = allProviders.slice(0, 5);
        } catch (provErr) {
            console.warn('Aviso: no se pudieron cargar proveedores específicos en MRP:', provErr.message);
        }

        // 3.1 Obtener pedidos de clientes del CRM para ovoproductos en el mes
        let customerOrders = [];
        try {
            const [coRows] = await pool.query(
                `SELECT * FROM egg_customer_orders
                 WHERE company_id = ? AND MONTH(required_delivery_date) = ? AND YEAR(required_delivery_date) = ?
                   AND status IN ('pendiente', 'programado')
                 ORDER BY required_delivery_date ASC`,
                [company_id, targetMonth, targetYear]
            );
            customerOrders = coRows;
        } catch (coErr) {
            console.warn('Aviso: error consultando pedidos de ovoproductos en MRP:', coErr.message);
        }

        // 3.2 Obtener ventas reales de ovoproductos de los últimos meses (para sugerir pedidos basados en ventas)
        let salesRows = [];
        let salesMonthlyAvgLbs = 0;
        let salesMonthlyAvgBoxes = 0;
        try {
            const [sRows] = await pool.query(
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
            salesRows = sRows;
            if (salesRows.length > 0) {
                const totalLbs = salesRows.reduce((acc, r) => acc + (parseFloat(r.total_lbs) || 0), 0);
                const maxMonths = Math.max(1, Math.max(...salesRows.map(r => r.months_count || 1)));
                salesMonthlyAvgLbs = Math.round(totalLbs / maxMonths);
                salesMonthlyAvgBoxes = Math.round(salesMonthlyAvgLbs / 36.1);
            }
        } catch (salesErr) {
            console.warn('Aviso: error consultando ventas de ovoproductos en MRP:', salesErr.message);
        }

        // 4. Calcular consumos consolidados de producciones y órdenes
        let totalLiquidLbsNeeded = 0;
        let totalRawEggBoxesNeeded = 0;
        let totalWaterH2oLbs = 0;
        let totalCitricAcidLbs = 0;
        let totalSugarLbs = 0;
        let totalSaltLbs = 0;
        let totalMilkLbs = 0;
        let totalBuckets30Lb = 0;

        scheduledProds.forEach(p => {
            const qty = parseFloat(p.target_quantity_lbs || 0);
            let formula = {};
            try {
                formula = typeof p.mix_formula_json === 'string' ? JSON.parse(p.mix_formula_json) : (p.mix_formula_json || {});
            } catch (e) {
                formula = {};
            }

            const pBoxes = parseInt(formula.raw_egg_boxes) || Math.round(qty / 36.1);
            const pLiquid = parseFloat(formula.raw_liquid_lbs) || qty;
            const pWater = parseFloat(formula.water_h2o_lbs || 0);
            const pCitric = parseFloat(formula.citric_acid_lbs || 0);
            const pSugar = parseFloat(formula.sugar_lbs || 0);
            const pSalt = parseFloat(formula.salt_lbs || 0);
            const pMilk = parseFloat(formula.milk_powder_lbs || 0);

            totalLiquidLbsNeeded += pLiquid;
            totalRawEggBoxesNeeded += pBoxes;
            totalWaterH2oLbs += pWater;
            totalCitricAcidLbs += pCitric;
            totalSugarLbs += pSugar;
            totalSaltLbs += pSalt;
            totalMilkLbs += pMilk;
            totalBuckets30Lb += Math.ceil(qty / 30);
        });

        // Si no hay producciones programadas pero sí pedidos de clientes del CRM, calcular con base en pedidos
        if (scheduledProds.length === 0 && customerOrders.length > 0) {
            customerOrders.forEach(o => {
                const qty = parseFloat(o.quantity_lbs || 0);
                const pBoxes = Math.round(qty / 36.1);
                totalLiquidLbsNeeded += qty;
                totalRawEggBoxesNeeded += pBoxes;
                totalWaterH2oLbs += Math.round(qty * 0.077);
                totalCitricAcidLbs += parseFloat((qty * 0.00015).toFixed(2));
                totalBuckets30Lb += Math.ceil(qty / 30);
            });
        }

        // Si no hay producciones programadas ni pedidos aún, proyectar una base estándar mensual para simulación
        const isProjectedSimulation = scheduledProds.length === 0 && customerOrders.length === 0;
        if (isProjectedSimulation) {
            totalLiquidLbsNeeded = 54000;
            totalRawEggBoxesNeeded = Math.round(54000 / 36.1); // ~1496 cajas
            totalWaterH2oLbs = 4200;
            totalCitricAcidLbs = 8.1;
            totalSugarLbs = 480;
            totalSaltLbs = 600;
            totalBuckets30Lb = Math.ceil(54000 / 30); // ~1800 cubetas
        }

        // 5. Histórico de recepciones y consumos (mismo mes en años anteriores y meses recientes)
        let sameMonthPriorYears = [];
        let recentPriorMonths = [];
        try {
            const [smRows] = await pool.query(
                `SELECT YEAR(fecha) as year, MONTH(fecha) as month,
                        COALESCE(SUM(total_boxes), 0) as total_boxes,
                        COALESCE(SUM(weight_lbs), 0) as total_weight_lbs,
                        COUNT(id) as count_receptions
                 FROM egg_raw_materials
                 WHERE company_id = ? AND MONTH(fecha) = ? AND YEAR(fecha) < ? AND status != 'anulado'
                 GROUP BY YEAR(fecha), MONTH(fecha)
                 ORDER BY year DESC
                 LIMIT 3`,
                [company_id, targetMonth, targetYear]
            );
            sameMonthPriorYears = smRows;

            const [pmRows] = await pool.query(
                `SELECT YEAR(fecha) as year, MONTH(fecha) as month,
                        COALESCE(SUM(total_boxes), 0) as total_boxes,
                        COALESCE(SUM(weight_lbs), 0) as total_weight_lbs,
                        COUNT(id) as count_receptions
                 FROM egg_raw_materials
                 WHERE company_id = ?
                   AND (
                       (YEAR(fecha) = ? AND MONTH(fecha) < ?)
                       OR (YEAR(fecha) = ? - 1 AND MONTH(fecha) > ? + 9)
                   )
                   AND status != 'anulado'
                 GROUP BY YEAR(fecha), MONTH(fecha)
                 ORDER BY year DESC, month DESC
                 LIMIT 4`,
                [company_id, targetYear, targetMonth, targetYear, targetMonth]
            );
            recentPriorMonths = pmRows;
        } catch (histErr) {
            console.warn('Aviso: error obteniendo datos históricos de materia prima:', histErr.message);
        }

        const allHist = [...sameMonthPriorYears, ...recentPriorMonths];
        const histAvgBoxes = allHist.length > 0
            ? Math.round(allHist.reduce((s, h) => s + parseFloat(h.total_boxes || 0), 0) / allHist.length)
            : Math.round(totalRawEggBoxesNeeded || 1500);
        const histAvgLbs = allHist.length > 0
            ? Math.round(allHist.reduce((s, h) => s + parseFloat(h.total_weight_lbs || 0), 0) / allHist.length)
            : Math.round(histAvgBoxes * 36.1);

        const netBalanceBoxes = currentStockBoxes - totalRawEggBoxesNeeded;
        const netBalanceLbs = currentStockLbs - totalLiquidLbsNeeded;
        const boxesToPurchase = Math.max(0, -netBalanceBoxes);

        // Sugerencia de pedidos calculada según los 3 métodos:
        // A. Según Ventas Reales (Promedio de ventas descontando inventario disponible)
        const suggestedBoxesFromSales = Math.max(0, salesMonthlyAvgBoxes - currentStockBoxes);
        // B. Según Plan de Producción / Pedidos
        const suggestedBoxesFromSchedule = boxesToPurchase;
        // C. Según Histórico Multianual
        const suggestedBoxesFromHistory = Math.max(0, histAvgBoxes - currentStockBoxes);

        // Cronograma semanal de camiones sugerido (para evitar saturar cámaras de frío)
        // Capacidad típica de camión refrigerado: 350 a 500 cajas
        const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
        const trucksSchedule = [];
        const truckBatches = 4; // 1 por semana
        const boxesPerTruck = Math.ceil((boxesToPurchase > 0 ? boxesToPurchase : totalRawEggBoxesNeeded) / truckBatches);

        const supplierName = providers[0]?.nombre || 'Avícola La Granja / Agropecuaria Central';

        for (let w = 1; w <= truckBatches; w++) {
            const dayNum = Math.min(daysInMonth, (w - 1) * 7 + 3); // Martes o Miércoles de cada semana
            const deliveryDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            trucksSchedule.push({
                delivery_number: `CAMION-${targetYear}${String(targetMonth).padStart(2, '0')}-0${w}`,
                week_label: `Semana ${w}`,
                suggested_delivery_date: deliveryDate,
                boxes_count: boxesPerTruck,
                weight_lbs: Math.round(boxesPerTruck * 36.1),
                suggested_provider: supplierName,
                egg_type: 'Huevo Blanco Cáscara Grado A',
                cold_chain_requirements: '4.0°C a 8.0°C en termógrafo de furgón',
                haccp_status: 'Muestreo LAB-004 de recepción obligatorio'
            });
        }

        return ({ status: 200, body: {
            month: targetMonth,
            year: targetYear,
            is_simulation: isProjectedSimulation,
            scheduled_productions_count: scheduledProds.length,
            customer_orders_count: customerOrders.length,
            customer_orders: customerOrders,
            raw_egg_balance: {
                total_liquid_lbs_needed: Math.round(totalLiquidLbsNeeded),
                total_boxes_needed: totalRawEggBoxesNeeded,
                current_stock_lbs: currentStockLbs,
                current_stock_boxes: currentStockBoxes,
                net_balance_boxes: netBalanceBoxes,
                net_balance_lbs: Math.round(netBalanceLbs),
                status: netBalanceBoxes >= 0 ? 'suficiente' : 'deficit_critico',
                boxes_to_purchase: boxesToPurchase,
                estimated_purchase_cost_usd: boxesToPurchase * 38.00 // ~$38/caja costo estándar
            },
            sales_demand_suggestion: {
                monthly_sales_avg_lbs: salesMonthlyAvgLbs,
                monthly_sales_avg_boxes: salesMonthlyAvgBoxes,
                current_stock_boxes: currentStockBoxes,
                suggested_boxes_to_order: suggestedBoxesFromSales > 0 ? suggestedBoxesFromSales : (salesMonthlyAvgBoxes || totalRawEggBoxesNeeded),
                suggested_boxes_from_sales: suggestedBoxesFromSales > 0 ? suggestedBoxesFromSales : (salesMonthlyAvgBoxes || totalRawEggBoxesNeeded),
                suggested_boxes_from_schedule: suggestedBoxesFromSchedule > 0 ? suggestedBoxesFromSchedule : totalRawEggBoxesNeeded,
                suggested_boxes_from_history: suggestedBoxesFromHistory > 0 ? suggestedBoxesFromHistory : histAvgBoxes,
                sales_breakdown: salesRows
            },
            ingredients_balance: {
                purified_water: {
                    lbs: Math.round(totalWaterH2oLbs),
                    bottles_5gal: Math.ceil(totalWaterH2oLbs / 41.8),
                    description: 'liquido a para balance de yema coproducto'
                },
                citric_acid: {
                    lbs: parseFloat(totalCitricAcidLbs.toFixed(2)),
                    kg: parseFloat((totalCitricAcidLbs * 0.453592).toFixed(2)),
                    description: 'Ácido cítrico anhidro grado alimentario para estabilización de pH'
                },
                sugar: {
                    lbs: Math.round(totalSugarLbs),
                    sacks_50kg: Math.ceil(totalSugarLbs / 110.23),
                    description: 'Azúcar estándar para Yema Azucarada (4% - 10%)'
                },
                salt: {
                    lbs: Math.round(totalSaltLbs),
                    sacks_50kg: Math.ceil(totalSaltLbs / 110.23),
                    description: 'Sal fina desyodada para Yema Salada (10%)'
                },
                milk_powder: {
                    lbs: Math.round(totalMilkLbs),
                    sacks_25kg: Math.ceil(totalMilkLbs / 55.11),
                    description: 'Leche entera en polvo para fórmulas institucionales'
                },
                cip_chemicals: {
                    peracetic_acid_liters: scheduledProds.length * 1.5 || 18,
                    caustic_soda_liters: scheduledProds.length * 2.0 || 24,
                    description: 'Químicos sanitizantes para lavado CIP diario del pasteurizador'
                }
            },
            packaging_balance: {
                buckets_30lb: totalBuckets30Lb,
                lids: totalBuckets30Lb,
                food_grade_liners: Math.ceil(totalBuckets30Lb * 1.02), // 2% margen
                julian_traceability_labels: Math.ceil(totalBuckets30Lb * 1.05) // 5% margen
            },
            historical_comparison: {
                same_month_prior_years: sameMonthPriorYears,
                recent_prior_months: recentPriorMonths,
                average_monthly_boxes: histAvgBoxes,
                average_monthly_lbs: histAvgLbs,
                data_points_count: allHist.length
            },
            providers_catalog: allProviders,
            trucks_schedule: trucksSchedule
        }, headers: responseHeaders });
    } catch (error) {
        console.error('Error en planificador de materia prima:', error);
        return ({ status: 500, body: { message: error.message }, headers: responseHeaders });
    }
};
module.exports = getRawMaterialPlanning;
