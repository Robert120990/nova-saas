const pool = require('../config/db');

/**
 * Obtener estadísticas globales para el dashboard
 */
const getStats = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) {
            console.log('DASHBOARD ERROR: company_id is missing');
            return res.json({ summary: {}, recentActivity: [], branches: [] });
        }

        let summary = {
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
        let recentActivity = [];
        let branches = [];

        // 1. Compras
        try {
            const [pStats] = await pool.query(`
                SELECT COALESCE(SUM(monto_total), 0) as total
                FROM purchase_headers
                WHERE company_id = ? AND status != 'ANULADO'
            `, [companyId]);
            summary.totalPurchases = parseFloat(pStats[0]?.total || 0);
        } catch (e) { console.error('PSTATS ERR', e); }

        // 2. Ventas
        try {
            const [sStats] = await pool.query(`
                SELECT 
                    COALESCE(SUM(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN total_pagar ELSE 0 END), 0) as monthly,
                    COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN total_pagar ELSE 0 END), 0) as today
                FROM sales_headers
                WHERE company_id = ? AND (estado != 'anulado' AND estado != 'ANULADO')
                AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = sales_headers.id AND status = 'INVALIDADO')
            `, [companyId]);
            summary.monthlySales = parseFloat(sStats[0]?.monthly || 0);
            summary.todaySales = parseFloat(sStats[0]?.today || 0);

            const [bStats] = await pool.query(`
                SELECT sh.branch_id, b.nombre as branch_name,
                    COALESCE(SUM(CASE WHEN MONTH(sh.created_at) = MONTH(CURDATE()) AND YEAR(sh.created_at) = YEAR(CURDATE()) THEN sh.total_pagar ELSE 0 END), 0) as monthly,
                    COALESCE(SUM(CASE WHEN DATE(sh.created_at) = CURDATE() THEN sh.total_pagar ELSE 0 END), 0) as today
                FROM sales_headers sh
                JOIN branches b ON sh.branch_id = b.id
                WHERE sh.company_id = ? AND (sh.estado != 'anulado' AND sh.estado != 'ANULADO')
                AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = sh.id AND status = 'INVALIDADO')
                GROUP BY sh.branch_id, b.nombre
            `, [companyId]);

            summary.todaySalesByBranch = (bStats || []).map(r => ({
                branch_id: r.branch_id,
                branch_name: r.branch_name,
                total: parseFloat(r.today || 0)
            }));
            summary.monthlySalesByBranch = (bStats || []).map(r => ({
                branch_id: r.branch_id,
                branch_name: r.branch_name,
                total: parseFloat(r.monthly || 0)
            }));
        } catch (e) { console.error('SSTATS ERR', e); }

        // 3. Conteos
        try {
            const [prod] = await pool.query('SELECT COUNT(*) as c FROM products WHERE company_id = ?', [companyId]);
            summary.products = prod[0]?.c || 0;
            const [prov] = await pool.query('SELECT COUNT(*) as c FROM providers WHERE company_id = ?', [companyId]);
            summary.providers = prov[0]?.c || 0;
            const [cust] = await pool.query('SELECT COUNT(*) as c FROM customers WHERE company_id = ?', [companyId]);
            summary.customers = cust[0]?.c || 0;
        } catch (e) { console.error('COUNT ERR', e); }

        // 4. Actividad
        try {
            const [rPurchases] = await pool.query(`
                SELECT ph.id, COALESCE(ph.numero_documento, CAST(ph.id AS CHAR)) as numero_documento, 
                       ph.fecha as date, ph.monto_total as amount, ph.status,
                       COALESCE(p.nombre, 'Proveedor') as entity, 'PURCHASE' as type
                FROM purchase_headers ph
                LEFT JOIN providers p ON ph.provider_id = p.id
                WHERE ph.company_id = ?
                ORDER BY ph.fecha DESC, ph.id DESC LIMIT 5
            `, [companyId]);

            const [rSales] = await pool.query(`
                SELECT sh.id, CAST(sh.id AS CHAR) as numero_documento, 
                       sh.created_at as date, sh.total_pagar as amount, sh.estado as status,
                       COALESCE(c.nombre, sh.cliente_nombre, 'Consumidor Final') as entity, 'SALE' as type
                FROM sales_headers sh
                LEFT JOIN customers c ON sh.customer_id = c.id
                WHERE sh.company_id = ?
                AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = sh.id AND status = 'INVALIDADO')
                ORDER BY sh.created_at DESC, sh.id DESC LIMIT 5
            `, [companyId]);

            const [rExpenses] = await pool.query(`
                SELECT eh.id, COALESCE(eh.numero_documento, CAST(eh.id AS CHAR)) as numero_documento, 
                       eh.fecha as date, eh.monto_total as amount, eh.status,
                       COALESCE(p.nombre, 'Proveedor') as entity, 'EXPENSE' as type
                FROM expense_headers eh
                LEFT JOIN providers p ON eh.provider_id = p.id
                WHERE eh.company_id = ?
                ORDER BY eh.fecha DESC, eh.id DESC LIMIT 5
            `, [companyId]);

            recentActivity = [...(rPurchases || []), ...(rSales || []), ...(rExpenses || [])]
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 10);
        } catch (e) { console.error('ACTIVITY ERR', e); }

        // 5. Sucursales mas ventas y top productos
        try {
            const [mSales] = await pool.query(`
                SELECT b.id as branch_id, b.nombre as branch_name, b.ambiente, COALESCE(SUM(sh.total_pagar), 0) as total
                FROM branches b
                LEFT JOIN sales_headers sh ON b.id = sh.branch_id 
                  AND sh.estado != 'anulado' 
                  AND sh.estado != 'ANULADO'
                  AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = sh.id AND status = 'INVALIDADO')
                  AND MONTH(sh.created_at) = MONTH(CURRENT_DATE())
                  AND YEAR(sh.created_at) = YEAR(CURRENT_DATE())
                WHERE b.company_id = ?
                GROUP BY b.id, b.nombre
            `, [companyId]);

            const [tProducts] = await pool.query(`
                SELECT sh.branch_id, p.nombre as product_name, SUM(si.cantidad) as total_qty
                FROM sales_items si
                JOIN sales_headers sh ON si.sale_id = sh.id
                JOIN products p ON si.product_id = p.id
                WHERE sh.company_id = ? AND sh.estado != 'anulado' AND sh.estado != 'ANULADO'
                  AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = sh.id AND status = 'INVALIDADO')
                  AND sh.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                GROUP BY sh.branch_id, p.id, p.nombre
                ORDER BY sh.branch_id, total_qty DESC
            `, [companyId]);

            const topByBranch = {};
            (tProducts || []).forEach(tp => {
                if (!topByBranch[tp.branch_id]) topByBranch[tp.branch_id] = [];
                if (topByBranch[tp.branch_id].length < 3) {
                    topByBranch[tp.branch_id].push(tp);
                }
            });

            branches = (mSales || []).map(ms => ({
                id: ms.branch_id,
                name: ms.branch_name,
                ambiente: ms.ambiente,
                monthlyTotal: parseFloat(ms.total || 0),
                topProducts: topByBranch[ms.branch_id] || [],
                status: 'Online'
            }));
        } catch (e) { console.error('BRANCHES ERR', e); }

        // 6. Monitor de Turnos
        try {
            const [activeShiftsRaw] = await pool.query(`
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
            `, [companyId]);

            const activeShifts = (activeShiftsRaw || []).map(s => ({
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

            let salesByCategory = [];
            try {
                const [catRows] = await pool.query(`
                    SELECT COALESCE(pc.name, 'Sin Categoría') as category,
                           SUM(si.cantidad * si.precio_unitario) as total
                    FROM sales_items si
                    JOIN sales_headers sh ON si.sale_id = sh.id
                    LEFT JOIN products p ON si.product_id = p.id
                    LEFT JOIN product_categories pc ON p.category_id = pc.id
                    WHERE sh.company_id = ? AND MONTH(sh.created_at) = MONTH(CURDATE()) AND YEAR(sh.created_at) = YEAR(CURDATE())
                      AND sh.estado != 'anulado' AND sh.estado != 'ANULADO'
                      AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = sh.id AND status = 'INVALIDADO')
                    GROUP BY pc.name
                    ORDER BY total DESC LIMIT 10
                `, [companyId]);
                const grandTotal = catRows.reduce((s, r) => s + parseFloat(r.total), 0);
                salesByCategory = catRows.map(r => ({
                    category: r.category,
                    total: parseFloat(r.total),
                    pct: grandTotal > 0 ? ((r.total / grandTotal) * 100).toFixed(1) : '0'
                }));
            } catch (e) { console.error('CAT SALES ERR', e); }

            return res.json({
                summary,
                recentActivity,
                branches,
                activeShifts,
                salesByCategory
            });
        } catch (e) { 
            console.error('SHIFTS ERR', e);
            return res.json({ summary, recentActivity, branches, activeShifts: [] });
        }
    } catch (error) {
        console.error('CRITICAL DASHBOARD ERROR:', error);
        res.status(500).json({ 
            message: 'Error al obtener estadísticas del dashboard',
            error: error.message 
        });
    }
};

const getCategorySales = async (req, res) => {
    try {
        const { start_date, end_date, branch_id } = req.query;
        const companyId = req.company_id;

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
        const grandTotal = rows.reduce((s, r) => s + parseFloat(r.total), 0);
        const result = rows.map(r => ({
            category: r.category,
            total: parseFloat(r.total),
            pct: grandTotal > 0 ? ((r.total / grandTotal) * 100).toFixed(1) : '0'
        }));

        res.json(result);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

module.exports = {
    getStats,
    getCategorySales
};
