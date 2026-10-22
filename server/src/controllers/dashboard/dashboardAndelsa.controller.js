const pool = require('../../config/db');
const { getOrSetDashboard } = require('../../services/dashboardCache.service');

/**
 * Andelsa (Industrial Plant / Ovoproductos) Dashboard Statistics
 */
const getAndelsaStats = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) {
            return res.json({
                calendarOperations: [],
                weeklyWarehousePrep: { nextDays: [], rawMaterials: [] },
                dispatchControl: [],
                productionCosts: { avgCostPerLb: 0, totalCost: 0, totalPounds: 0 },
                productionPipeline: [],
                batchApprovals: []
            });
        }

        const force = req.query?.force === 'true';
        const cacheKey = `dashboard:andelsa:${companyId}`;

        const data = await getOrSetDashboard(cacheKey, async () => {
            const [
                spRowsRes,
                nextDaysRowsRes,
                rawMatRowsRes,
                dRowsRes,
                costRowsRes,
                pRowsRes,
                qRowsRes
            ] = await Promise.all([
                // 1. Calendar Operations
                pool.query(`
                    SELECT 
                        id, 
                        production_date, 
                        start_time, 
                        lot_code, 
                        product_profile, 
                        presentation, 
                        target_quantity_lbs, 
                        status, 
                        assigned_operator_name, 
                        notes
                    FROM egg_scheduled_productions
                    WHERE company_id = ? AND production_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                    ORDER BY production_date ASC
                    LIMIT 15
                `, [companyId]).catch(e => { console.error('ANDELSA CALENDAR ERR:', e); return [[]]; }),

                // 2a. Weekly Scheduled Next Days
                pool.query(`
                    SELECT 
                        DATE(production_date) as scheduled_date, 
                        SUM(target_quantity_lbs) as total_lbs, 
                        COUNT(*) as total_batches
                    FROM egg_scheduled_productions
                    WHERE company_id = ? 
                      AND production_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
                    GROUP BY DATE(production_date)
                    ORDER BY scheduled_date ASC
                `, [companyId]).catch(e => { console.error('ANDELSA WAREHOUSE NEXT DAYS ERR:', e); return [[]]; }),

                // 2b. Raw Materials in Stock
                pool.query(`
                    SELECT 
                        erm.id, 
                        COALESCE(erm.provider_lot, CAST(erm.id AS CHAR)) as lot_number, 
                        COALESCE(pr.nombre, erm.driver_name, 'Proveedor') as provider_name, 
                        COALESCE(erm.total_boxes, 0) as quantity_boxes, 
                        COALESCE(erm.weight_lbs, erm.stock_lbs, 0) as total_weight_lb, 
                        erm.status, 
                        erm.created_at
                    FROM egg_raw_materials erm
                    LEFT JOIN providers pr ON erm.provider_id = pr.id
                    WHERE erm.company_id = ? AND erm.status IN ('received', 'in_inspection', 'approved')
                    ORDER BY erm.created_at DESC
                    LIMIT 8
                `, [companyId]).catch(e => { console.error('ANDELSA WAREHOUSE RAW MAT ERR:', e); return [[]]; }),

                // 3. Dispatch Control (Today & Tomorrow)
                pool.query(`
                    SELECT 
                        co.id, 
                        co.order_number, 
                        co.customer_name, 
                        co.required_delivery_date, 
                        co.product_type, 
                        co.presentation, 
                        co.quantity_lbs, 
                        co.status, 
                        co.delivery_status, 
                        co.recipient_name, 
                        co.recipient_phone, 
                        COALESCE(dr.codigo_ruta, 'Ruta Programada') as route_name, 
                        COALESCE(dr.driver_name, co.recipient_name, 'Sin Asignar') as driver_name
                    FROM egg_customer_orders co
                    LEFT JOIN egg_dispatch_routes dr ON co.dispatch_route_id = dr.id
                    WHERE co.company_id = ? 
                      AND co.required_delivery_date >= CURDATE()
                      AND co.required_delivery_date < DATE_ADD(CURDATE(), INTERVAL 2 DAY)
                    ORDER BY co.required_delivery_date ASC, co.id ASC
                    LIMIT 20
                `, [companyId]).catch(e => { console.error('ANDELSA DISPATCH ERR:', e); return [[]]; }),

                // 4. Production Costs (Current month range query)
                pool.query(`
                    SELECT 
                        SUM(ic.total_cost) as total_cost, 
                        SUM(pb.yield_liquid_lbs) as total_yield_lbs
                    FROM egg_industrial_costs ic
                    JOIN egg_production_batches pb ON ic.batch_id = pb.id
                    WHERE ic.company_id = ? 
                      AND ic.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01 00:00:00')
                      AND ic.created_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01 00:00:00'), INTERVAL 1 MONTH)
                `, [companyId]).catch(e => { console.error('ANDELSA COSTS ERR:', e); return [[]]; }),

                // 5. Active Production Pipeline
                pool.query(`
                    SELECT 
                        pb.id, 
                        pb.batch_code_display as batch_number, 
                        pb.status, 
                        pb.started_at, 
                        pb.product_type, 
                        pb.presentation, 
                        pb.input_weight_lbs, 
                        pb.yield_liquid_lbs, 
                        pb.waste_loss_lbs, 
                        pb.measured_brix, 
                        pb.measured_solids_pct, 
                        pb.operator_name
                    FROM egg_production_batches pb
                    WHERE pb.company_id = ? AND pb.status != 'completed' AND pb.status != 'closed'
                    ORDER BY pb.started_at DESC, pb.id DESC
                    LIMIT 10
                `, [companyId]).catch(e => { console.error('ANDELSA PIPELINE ERR:', e); return [[]]; }),

                // 6. Quality Approvals & Lab Logs
                pool.query(`
                    SELECT 
                        l.id, 
                        l.batch_id, 
                        l.sample_date, 
                        l.status, 
                        l.ph, 
                        l.brix, 
                        l.solids_percentage, 
                        l.mesophilic_aerobic_cfu, 
                        l.total_coliforms_mpn, 
                        l.analyst_name, 
                        pb.batch_code_display as batch_number, 
                        pb.product_type
                    FROM egg_lab_micro_logs l
                    JOIN egg_production_batches pb ON l.batch_id = pb.id
                    WHERE l.company_id = ?
                    ORDER BY l.created_at DESC
                    LIMIT 10
                `, [companyId]).catch(e => { console.error('ANDELSA QUALITY ERR:', e); return [[]]; })
            ]);

            const calendarOperations = (spRowsRes[0] || []).map(s => ({
                id: s.id,
                production_date: s.production_date,
                start_time: s.start_time,
                lot_code: s.lot_code,
                product_profile: s.product_profile,
                presentation: s.presentation,
                target_quantity_lbs: parseFloat(s.target_quantity_lbs || 0),
                status: s.status,
                assigned_operator_name: s.assigned_operator_name,
                notes: s.notes
            }));

            const weeklyWarehousePrep = {
                nextDays: (nextDaysRowsRes[0] || []).map(r => ({
                    date: r.scheduled_date,
                    total_lbs: parseFloat(r.total_lbs || 0),
                    total_batches: parseInt(r.total_batches || 0)
                })),
                rawMaterials: (rawMatRowsRes[0] || []).map(r => ({
                    id: r.id,
                    lot_number: r.lot_number,
                    provider_name: r.provider_name,
                    quantity_boxes: parseFloat(r.quantity_boxes || 0),
                    total_weight_lb: parseFloat(r.total_weight_lb || 0),
                    status: r.status,
                    created_at: r.created_at
                }))
            };

            const dispatchControl = (dRowsRes[0] || []).map(d => ({
                id: d.id,
                order_number: d.order_number,
                customer_name: d.customer_name,
                required_delivery_date: d.required_delivery_date,
                is_today: new Date(d.required_delivery_date).toDateString() === new Date().toDateString(),
                product_type: d.product_type,
                presentation: d.presentation,
                quantity_lbs: parseFloat(d.quantity_lbs || 0),
                status: d.status,
                delivery_status: d.delivery_status || 'pending',
                recipient_name: d.recipient_name,
                recipient_phone: d.recipient_phone,
                route_name: d.route_name,
                driver_name: d.driver_name
            }));

            const costRows = costRowsRes[0] || [];
            const totalCost = parseFloat(costRows[0]?.total_cost || 0);
            const totalLbs = parseFloat(costRows[0]?.total_yield_lbs || 0);
            const avgCostPerLb = totalLbs > 0 ? (totalCost / totalLbs) : 0;
            const productionCosts = {
                avgCostPerLb: parseFloat(avgCostPerLb.toFixed(4)),
                totalCost,
                totalPounds: totalLbs
            };

            const productionPipeline = (pRowsRes[0] || []).map(p => ({
                id: p.id,
                batch_number: p.batch_number,
                status: p.status,
                started_at: p.started_at,
                product_type: p.product_type,
                presentation: p.presentation,
                input_weight_lbs: parseFloat(p.input_weight_lbs || 0),
                yield_liquid_lbs: parseFloat(p.yield_liquid_lbs || 0),
                waste_loss_lbs: parseFloat(p.waste_loss_lbs || 0),
                measured_brix: parseFloat(p.measured_brix || 0),
                measured_solids_pct: parseFloat(p.measured_solids_pct || 0),
                operator_name: p.operator_name
            }));

            const batchApprovals = (qRowsRes[0] || []).map(q => ({
                id: q.id,
                batch_id: q.batch_id,
                batch_number: q.batch_number,
                product_type: q.product_type,
                sample_date: q.sample_date,
                status: q.status,
                ph: parseFloat(q.ph || 0),
                brix: parseFloat(q.brix || 0),
                solids_percentage: parseFloat(q.solids_percentage || 0),
                mesophilic_aerobic_cfu: q.mesophilic_aerobic_cfu,
                total_coliforms_mpn: q.total_coliforms_mpn,
                analyst_name: q.analyst_name
            }));

            return {
                calendarOperations,
                weeklyWarehousePrep,
                dispatchControl,
                productionCosts,
                productionPipeline,
                batchApprovals
            };
        }, 45, force);

        return res.json(data);
    } catch (error) {
        console.error('CRITICAL ANDELSA DASHBOARD ERROR:', error);
        return res.status(500).json({ message: 'Error al obtener estadísticas de Andelsa', error: error.message });
    }
};

module.exports = {
    getAndelsaStats
};
