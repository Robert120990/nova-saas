const pool = require('../../config/db');
const { getOrSetDashboard } = require('../../services/dashboardCache.service');

/**
 * Global statistics for General Dashboard
 */
const getStats = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) {
            return res.json({ summary: {}, recentActivity: [], branches: [] });
        }

        const force = req.query?.force === 'true';
        const cacheKey = `dashboard:general:${companyId}`;

        const data = await getOrSetDashboard(cacheKey, async () => {
            const summary = {
                totalPurchases: 0,
                totalSales: 0,
                todaySales: 0,
                products: 0,
                providers: 0,
                customers: 0,
                monthlySales: 0,
                totalCashInHand: 0,
                activeShiftsCount: 0,
                todaySalesByBranch: [],
                monthlySalesByBranch: [],
                cashInHandByBranch: []
            };

            const [
                pStatsRes,
                sStatsRes,
                bStatsRes,
                prodRes,
                provRes,
                custRes,
                rPurchasesRes,
                rSalesRes,
                rExpensesRes,
                mSalesRes,
                tProductsRes,
                bQuantitiesRes,
                activeShiftsRes,
                catRowsRes
            ] = await Promise.all([
                // 1. Total Purchases
                pool.query(`
                    SELECT COALESCE(SUM(monto_total), 0) as total
                    FROM purchase_headers
                    WHERE company_id = ? AND status != 'ANULADO'
                `, [companyId]).catch(e => { console.error('PSTATS ERR', e); return [[]]; }),

                // 2. Monthly and Today Sales (Range queries instead of MONTH/DATE functions)
                pool.query(`
                    SELECT 
                        COALESCE(SUM(CASE WHEN sh.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01 00:00:00') 
                                           AND sh.created_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01 00:00:00'), INTERVAL 1 MONTH) 
                                     THEN sh.total_pagar ELSE 0 END), 0) as monthly,
                        COALESCE(SUM(CASE WHEN sh.created_at >= CURDATE() 
                                           AND sh.created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY) 
                                     THEN sh.total_pagar ELSE 0 END), 0) as today
                    FROM sales_headers sh
                    WHERE sh.company_id = ? AND (sh.estado != 'anulado' AND sh.estado != 'ANULADO')
                      AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = sh.id AND status = 'INVALIDADO')
                `, [companyId]).catch(e => { console.error('SSTATS ERR', e); return [[]]; }),

                // 3. Sales By Branch
                pool.query(`
                    SELECT sh.branch_id, b.nombre as branch_name,
                        COALESCE(SUM(CASE WHEN sh.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01 00:00:00') 
                                           AND sh.created_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01 00:00:00'), INTERVAL 1 MONTH) 
                                     THEN sh.total_pagar ELSE 0 END), 0) as monthly,
                        COALESCE(SUM(CASE WHEN sh.created_at >= CURDATE() 
                                           AND sh.created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY) 
                                     THEN sh.total_pagar ELSE 0 END), 0) as today
                    FROM sales_headers sh
                    JOIN branches b ON sh.branch_id = b.id
                    WHERE sh.company_id = ? AND (sh.estado != 'anulado' AND sh.estado != 'ANULADO')
                      AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = sh.id AND status = 'INVALIDADO')
                    GROUP BY sh.branch_id, b.nombre
                `, [companyId]).catch(e => { console.error('BSTATS ERR', e); return [[]]; }),

                // 4. Products Count
                pool.query('SELECT COUNT(*) as c FROM products WHERE company_id = ?', [companyId])
                    .catch(e => { console.error('COUNT PROD ERR', e); return [[]]; }),

                // 5. Providers Count
                pool.query('SELECT COUNT(*) as c FROM providers WHERE company_id = ?', [companyId])
                    .catch(e => { console.error('COUNT PROV ERR', e); return [[]]; }),

                // 6. Customers Count
                pool.query('SELECT COUNT(*) as c FROM customers WHERE company_id = ?', [companyId])
                    .catch(e => { console.error('COUNT CUST ERR', e); return [[]]; }),

                // 7. Recent Purchases
                pool.query(`
                    SELECT ph.id, COALESCE(ph.numero_documento, CAST(ph.id AS CHAR)) as numero_documento, 
                           ph.fecha as date, ph.monto_total as amount, ph.status,
                           COALESCE(p.nombre, 'Proveedor') as entity, 'PURCHASE' as type
                    FROM purchase_headers ph
                    LEFT JOIN providers p ON ph.provider_id = p.id
                    WHERE ph.company_id = ?
                    ORDER BY ph.fecha DESC, ph.id DESC LIMIT 5
                `, [companyId]).catch(e => { console.error('RPURCHASES ERR', e); return [[]]; }),

                // 8. Recent Sales
                pool.query(`
                    SELECT sh.id, CAST(sh.id AS CHAR) as numero_documento, 
                           sh.created_at as date, sh.total_pagar as amount, sh.estado as status,
                           COALESCE(c.nombre, sh.cliente_nombre, 'Consumidor Final') as entity, 'SALE' as type
                    FROM sales_headers sh
                    LEFT JOIN customers c ON sh.customer_id = c.id
                    WHERE sh.company_id = ?
                      AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = sh.id AND status = 'INVALIDADO')
                    ORDER BY sh.created_at DESC, sh.id DESC LIMIT 5
                `, [companyId]).catch(e => { console.error('RSALES ERR', e); return [[]]; }),

                // 9. Recent Expenses
                pool.query(`
                    SELECT eh.id, COALESCE(eh.numero_documento, CAST(eh.id AS CHAR)) as numero_documento, 
                           eh.fecha as date, eh.monto_total as amount, eh.status,
                           COALESCE(p.nombre, 'Proveedor') as entity, 'EXPENSE' as type
                    FROM expense_headers eh
                    LEFT JOIN providers p ON eh.provider_id = p.id
                    WHERE eh.company_id = ?
                    ORDER BY eh.fecha DESC, eh.id DESC LIMIT 5
                `, [companyId]).catch(e => { console.error('REXPENSES ERR', e); return [[]]; }),

                // 10. Monthly Branch Sales
                pool.query(`
                    SELECT b.id as branch_id, b.nombre as branch_name, b.ambiente, COALESCE(SUM(sh.total_pagar), 0) as total
                    FROM branches b
                    LEFT JOIN sales_headers sh ON b.id = sh.branch_id 
                      AND sh.estado != 'anulado' 
                      AND sh.estado != 'ANULADO'
                      AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = sh.id AND status = 'INVALIDADO')
                      AND sh.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01 00:00:00')
                      AND sh.created_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01 00:00:00'), INTERVAL 1 MONTH)
                    WHERE b.company_id = ?
                    GROUP BY b.id, b.nombre
                `, [companyId]).catch(e => { console.error('MSALES ERR', e); return [[]]; }),

                // 11. Top Products by Branch
                pool.query(`
                    SELECT sh.branch_id, p.nombre as product_name, SUM(si.cantidad) as total_qty
                    FROM sales_items si
                    JOIN sales_headers sh ON si.sale_id = sh.id
                    JOIN products p ON si.product_id = p.id
                    WHERE sh.company_id = ? AND sh.estado != 'anulado' AND sh.estado != 'ANULADO'
                      AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = sh.id AND status = 'INVALIDADO')
                      AND sh.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01 00:00:00')
                      AND sh.created_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01 00:00:00'), INTERVAL 1 MONTH)
                    GROUP BY sh.branch_id, p.id, p.nombre
                    ORDER BY sh.branch_id, total_qty DESC
                `, [companyId]).catch(e => { console.error('TPRODUCTS ERR', e); return [[]]; }),

                // 12. Quantities by Branch
                pool.query(`
                    SELECT sh.branch_id, SUM(si.cantidad) as total_qty
                    FROM sales_items si
                    JOIN sales_headers sh ON si.sale_id = sh.id
                    WHERE sh.company_id = ? AND sh.estado != 'anulado' AND sh.estado != 'ANULADO'
                      AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = sh.id AND status = 'INVALIDADO')
                      AND sh.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01 00:00:00')
                      AND sh.created_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01 00:00:00'), INTERVAL 1 MONTH)
                    GROUP BY sh.branch_id
                `, [companyId]).catch(e => { console.error('BQUANTITIES ERR', e); return [[]]; }),

                // 13. Active Shifts
                pool.query(`
                    SELECT 
                        s.id, 
                        s.shift_number,
                        sel.nombre as seller_name, 
                        p.nombre as pos_name, 
                        s.branch_id,
                        b.nombre as branch_name,
                        s.opening_balance,
                        s.start_time,
                        COALESCE((
                            SELECT SUM(CASE WHEN a.metodo_pago = '01' THEN GREATEST(0, COALESCE(a.total_pagar, 0) - a.non_cash) ELSE 0 END)
                            FROM (
                                SELECT 
                                    h.id,
                                    h.total_pagar,
                                    h.non_cash,
                                    p.metodo_pago,
                                    SUM(p.monto) as sum_monto
                                FROM (
                                    SELECT 
                                        h.id, 
                                        h.total_pagar,
                                        COALESCE(SUM(CASE WHEN p.metodo_pago != '01' THEN p.monto ELSE 0 END), 0) as non_cash
                                    FROM sales_headers h
                                    JOIN sales_payments p ON p.sale_id = h.id
                                    WHERE h.shift_id = s.id AND h.estado != 'anulado'
                                      AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = h.id AND status = 'INVALIDADO')
                                    GROUP BY h.id
                                ) h
                                JOIN sales_payments p ON p.sale_id = h.id
                                GROUP BY h.id, h.total_pagar, h.non_cash, p.metodo_pago
                            ) a
                        ), 0) as cash_sales,
                        COALESCE((
                            SELECT SUM(amount) 
                            FROM pos_shift_incomes 
                            WHERE shift_id = s.id AND (payment_method = '01' OR payment_method IS NULL)
                        ), 0) as cash_incomes,
                        COALESCE((
                            SELECT SUM(amount) 
                            FROM pos_shift_expenses 
                            WHERE shift_id = s.id
                        ), 0) as cash_expenses
                    FROM pos_shifts s
                    JOIN sellers sel ON s.seller_id = sel.id
                    JOIN points_of_sale p ON s.pos_id = p.id
                    JOIN branches b ON s.branch_id = b.id
                    WHERE s.company_id = ? AND s.status = 'open'
                `, [companyId]).catch(e => { console.error('SHIFTS QUERY ERR', e); return [[]]; }),

                // 14. Monthly Sales By Category
                pool.query(`
                    SELECT COALESCE(pc.name, 'Sin Categoría') as category,
                           SUM(si.cantidad * si.precio_unitario) as total
                    FROM sales_items si
                    JOIN sales_headers sh ON si.sale_id = sh.id
                    LEFT JOIN products p ON si.product_id = p.id
                    LEFT JOIN product_categories pc ON p.category_id = pc.id
                    WHERE sh.company_id = ? 
                      AND sh.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01 00:00:00')
                      AND sh.created_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01 00:00:00'), INTERVAL 1 MONTH)
                      AND sh.estado != 'anulado' AND sh.estado != 'ANULADO'
                      AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = sh.id AND status = 'INVALIDADO')
                    GROUP BY pc.name
                    ORDER BY total DESC LIMIT 10
                `, [companyId]).catch(e => { console.error('CAT SALES ERR', e); return [[]]; })
            ]);

            // Assign Summary Values
            summary.totalPurchases = parseFloat(pStatsRes[0]?.[0]?.total || 0);
            summary.monthlySales = parseFloat(sStatsRes[0]?.[0]?.monthly || 0);
            summary.todaySales = parseFloat(sStatsRes[0]?.[0]?.today || 0);

            summary.todaySalesByBranch = (bStatsRes[0] || []).map(r => ({
                branch_id: r.branch_id,
                branch_name: r.branch_name,
                total: parseFloat(r.today || 0)
            }));
            summary.monthlySalesByBranch = (bStatsRes[0] || []).map(r => ({
                branch_id: r.branch_id,
                branch_name: r.branch_name,
                total: parseFloat(r.monthly || 0)
            }));

            summary.products = prodRes[0]?.[0]?.c || 0;
            summary.providers = provRes[0]?.[0]?.c || 0;
            summary.customers = custRes[0]?.[0]?.c || 0;

            const recentActivity = [
                ...(rPurchasesRes[0] || []),
                ...(rSalesRes[0] || []),
                ...(rExpensesRes[0] || [])
            ]
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 10);

            // Group top products by branch
            const topByBranch = {};
            (tProductsRes[0] || []).forEach(tp => {
                if (!topByBranch[tp.branch_id]) topByBranch[tp.branch_id] = [];
                if (topByBranch[tp.branch_id].length < 3) {
                    topByBranch[tp.branch_id].push(tp);
                }
            });

            const branchQtyMap = {};
            (bQuantitiesRes[0] || []).forEach(bq => {
                branchQtyMap[bq.branch_id] = parseFloat(bq.total_qty || 0);
            });

            const branches = (mSalesRes[0] || []).map(ms => ({
                id: ms.branch_id,
                name: ms.branch_name,
                ambiente: ms.ambiente,
                monthlyTotal: parseFloat(ms.total || 0),
                totalQty: branchQtyMap[ms.branch_id] || 0,
                topProducts: topByBranch[ms.branch_id] || [],
                status: 'Online'
            }));

            const activeShifts = (activeShiftsRes[0] || []).map(s => ({
                id: s.id,
                shift_number: s.shift_number,
                seller_name: s.seller_name,
                pos_name: s.pos_name,
                branch_id: s.branch_id,
                branch_name: s.branch_name,
                start_time: s.start_time,
                expected_cash: parseFloat(s.opening_balance || 0) + parseFloat(s.cash_sales || 0) + parseFloat(s.cash_incomes || 0) - parseFloat(s.cash_expenses || 0)
            }));

            summary.totalCashInHand = activeShifts.reduce((acc, s) => acc + s.expected_cash, 0);
            summary.activeShiftsCount = activeShifts.length;

            const cashByBranch = {};
            activeShifts.forEach(s => {
                if (!cashByBranch[s.branch_id]) cashByBranch[s.branch_id] = { branch_id: s.branch_id, branch_name: s.branch_name, total: 0 };
                cashByBranch[s.branch_id].total += s.expected_cash;
            });
            summary.cashInHandByBranch = Object.values(cashByBranch).map(b => ({ ...b, total: parseFloat(b.total || 0) }));

            // Process Category Sales
            const catRows = catRowsRes[0] || [];
            const grandTotal = catRows.reduce((s, r) => s + parseFloat(r.total || 0), 0);
            const salesByCategory = catRows.map(r => ({
                category: r.category,
                total: parseFloat(r.total || 0),
                pct: grandTotal > 0 ? ((r.total / grandTotal) * 100).toFixed(1) : '0'
            }));

            return {
                summary,
                recentActivity,
                branches,
                activeShifts,
                salesByCategory
            };
        }, 45, force);

        return res.json(data);
    } catch (error) {
        console.error('CRITICAL DASHBOARD ERROR:', error);
        return res.status(500).json({ 
            message: 'Error al obtener estadísticas del dashboard',
            error: error.message 
        });
    }
};

/**
 * Filtered Category Sales
 */
const getCategorySales = async (req, res) => {
    try {
        const { start_date, end_date, branch_id, force } = req.query;
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) {
            return res.json([]);
        }

        const isForce = force === 'true';
        const cacheKey = `dashboard:category-sales:${companyId}:${branch_id || 'all'}:${start_date || ''}:${end_date || ''}`;

        const data = await getOrSetDashboard(cacheKey, async () => {
            let sql = `SELECT COALESCE(pc.name, 'Sin Categoría') as category,
                              SUM(si.cantidad * si.precio_unitario) as total
                       FROM sales_items si
                       JOIN sales_headers sh ON si.sale_id = sh.id
                       LEFT JOIN products p ON si.product_id = p.id
                       LEFT JOIN product_categories pc ON p.category_id = pc.id
                       WHERE sh.company_id = ? AND sh.estado != 'anulado' AND sh.estado != 'ANULADO'
                       AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = sh.id AND status = 'INVALIDADO')`;
            const params = [companyId];

            if (start_date) { sql += ' AND sh.created_at >= ?'; params.push(start_date); }
            if (end_date) { sql += ' AND sh.created_at <= ?'; params.push(end_date + ' 23:59:59'); }
            if (branch_id) { sql += ' AND sh.branch_id = ?'; params.push(branch_id); }

            sql += ' GROUP BY pc.name ORDER BY total DESC LIMIT 10';

            const [rows] = await pool.query(sql, params);
            const grandTotal = rows.reduce((s, r) => s + parseFloat(r.total || 0), 0);
            return rows.map(r => ({
                category: r.category,
                total: parseFloat(r.total || 0),
                pct: grandTotal > 0 ? ((r.total / grandTotal) * 100).toFixed(1) : '0'
            }));
        }, 45, isForce);

        return res.json(data);
    } catch (e) { 
        return res.status(500).json({ message: e.message }); 
    }
};

module.exports = {
    getStats,
    getCategorySales
};
