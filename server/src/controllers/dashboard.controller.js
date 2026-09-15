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

/**
 * Estadísticas de Dashboard Pista (Gasolinera)
 */
const getPistaStats = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const branchId = req.query?.branch_id || req.user?.branch_id || null;

        // 1. Tanques con lecturas y estado de combustible
        let tanks = [];
        try {
            const [tRows] = await pool.query(`
                SELECT 
                    t.id, 
                    t.codigo, 
                    t.descripcion, 
                    t.capacidad, 
                    t.reserva, 
                    t.tipo_combustible,
                    b.nombre as branch_name,
                    t.branch_id,
                    COALESCE(r.lectura_actual, t.capacidad * 0.65) as galones_actuales,
                    r.created_at as ultima_lectura_fecha
                FROM gas_station_tanks t
                JOIN branches b ON t.branch_id = b.id
                LEFT JOIN (
                    SELECT tr.tank_id, tr.lectura_actual, tr.created_at
                    FROM gas_station_closeout_tank_readings tr
                    WHERE tr.id IN (
                        SELECT MAX(id) FROM gas_station_closeout_tank_readings GROUP BY tank_id
                    )
                ) r ON r.tank_id = t.id
                WHERE t.company_id = ? ${branchId ? 'AND t.branch_id = ?' : ''}
                ORDER BY t.branch_id, t.codigo
            `, branchId ? [companyId, branchId] : [companyId]);

            tanks = (tRows || []).map(t => {
                const cap = parseFloat(t.capacidad || 1);
                const actual = parseFloat(t.galones_actuales || 0);
                const reserva = parseFloat(t.reserva || (cap * 0.15));
                const pct = Math.min(100, Math.max(0, Math.round((actual / cap) * 100)));
                let status = 'normal';
                if (actual <= reserva) status = 'critical';
                else if (actual <= reserva * 1.5) status = 'warning';

                return {
                    id: t.id,
                    codigo: t.codigo,
                    descripcion: t.descripcion,
                    capacidad: cap,
                    reserva: reserva,
                    tipo_combustible: t.tipo_combustible,
                    branch_name: t.branch_name,
                    branch_id: t.branch_id,
                    galones_actuales: actual,
                    porcentaje: pct,
                    status,
                    ultima_lectura_fecha: t.ultima_lectura_fecha
                };
            });
        } catch (e) { console.error('TANKS ERR:', e); }

        // 2. Turnos activos de Pista (SIN mostrar efectivo esperado)
        let activeShifts = [];
        try {
            const [shiftRows] = await pool.query(`
                SELECT 
                    s.id, 
                    s.shift_number,
                    sel.nombre as seller_name, 
                    p.nombre as pos_name, 
                    s.branch_id,
                    b.nombre as branch_name,
                    s.start_time,
                    COALESCE(sales.total_sales, 0) as total_sales,
                    COALESCE(sales.sales_count, 0) as sales_count
                FROM pos_shifts s
                JOIN sellers sel ON s.seller_id = sel.id
                JOIN points_of_sale p ON s.pos_id = p.id
                JOIN branches b ON s.branch_id = b.id
                LEFT JOIN (
                    SELECT 
                        shift_id,
                        SUM(total_pagar) as total_sales,
                        COUNT(id) as sales_count
                    FROM sales_headers
                    WHERE (estado != 'anulado' AND estado != 'ANULADO')
                      AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = sales_headers.id AND status = 'INVALIDADO')
                    GROUP BY shift_id
                ) sales ON sales.shift_id = s.id
                WHERE s.company_id = ? AND s.status = 'open'
                  AND (p.nombre LIKE '%PISTA%' OR p.nombre LIKE '%BOMBA%' OR b.nombre LIKE '%ESTACION%' OR b.nombre LIKE '%GAS%')
                  ${branchId ? 'AND s.branch_id = ?' : ''}
                ORDER BY s.start_time DESC
            `, branchId ? [companyId, branchId] : [companyId]);

            activeShifts = (shiftRows || []).map(s => ({
                id: s.id,
                shift_number: s.shift_number,
                seller_name: s.seller_name,
                pos_name: s.pos_name,
                branch_id: s.branch_id,
                branch_name: s.branch_name,
                start_time: s.start_time,
                total_sales: parseFloat(s.total_sales || 0),
                sales_count: parseInt(s.sales_count || 0)
                // OMITIDO: efectivo esperado por regla de negocio
            }));
        } catch (e) { console.error('PISTA SHIFTS ERR:', e); }

        // 3. DTEs rechazados en el día y turnos activos con causa exacta
        let rejectedDtes = [];
        try {
            const [dRows] = await pool.query(`
                SELECT 
                    d.id as dte_id,
                    d.numero_control,
                    d.codigo_generacion,
                    d.tipo_dte,
                    d.created_at,
                    d.respuesta_hacienda,
                    sh.id as sale_id,
                    sh.total_pagar,
                    COALESCE(c.nombre, sh.cliente_nombre, 'Consumidor Final') as cliente,
                    p.nombre as pos_name,
                    sel.nombre as seller_name,
                    s.shift_number,
                    s.status as shift_status,
                    b.nombre as branch_name,
                    de.codigo_error as de_codigo,
                    de.mensaje_error as de_mensaje
                FROM dtes d
                LEFT JOIN sales_headers sh ON d.venta_id = sh.id
                LEFT JOIN pos_shifts s ON sh.shift_id = s.id
                LEFT JOIN points_of_sale p ON s.pos_id = p.id
                LEFT JOIN sellers sel ON s.seller_id = sel.id
                LEFT JOIN branches b ON d.branch_id = b.id
                LEFT JOIN customers c ON sh.customer_id = c.id
                LEFT JOIN (
                    SELECT dte_id, codigo_error, mensaje_error
                    FROM dte_errors
                    WHERE id IN (SELECT MAX(id) FROM dte_errors GROUP BY dte_id)
                ) de ON de.dte_id = d.id
                WHERE d.company_id = ? 
                  AND (DATE(d.created_at) = CURDATE() OR s.status = 'open')
                  AND (d.status = 'REJECTED' OR d.status LIKE '%RECHAZ%' OR d.status LIKE '%ERROR%')
                  ${branchId ? 'AND d.branch_id = ?' : ''}
                ORDER BY d.created_at DESC
                LIMIT 50
            `, branchId ? [companyId, branchId] : [companyId]);

            rejectedDtes = (dRows || []).map(d => {
                let codigoError = d.de_codigo || 'MH-ERR';
                let mensajeError = d.de_mensaje;

                if (d.respuesta_hacienda) {
                    try {
                        const parsed = typeof d.respuesta_hacienda === 'string'
                            ? JSON.parse(d.respuesta_hacienda)
                            : d.respuesta_hacienda;
                        if (parsed?.codigoMsg) codigoError = parsed.codigoMsg;
                        if (parsed?.descripcionMsg) {
                            mensajeError = parsed.descripcionMsg;
                            if (parsed.observaciones && parsed.observaciones.length > 0) {
                                mensajeError += ` (${Array.isArray(parsed.observaciones) ? parsed.observaciones.join('; ') : parsed.observaciones})`;
                            }
                        } else if (parsed?.observaciones && parsed.observaciones.length > 0) {
                            mensajeError = Array.isArray(parsed.observaciones)
                                ? parsed.observaciones.join('; ')
                                : String(parsed.observaciones);
                        } else if (parsed?.mensaje) {
                            mensajeError = parsed.mensaje;
                        }
                    } catch (e) {
                        if (!mensajeError) mensajeError = typeof d.respuesta_hacienda === 'string' ? d.respuesta_hacienda : 'Error devuelto por Hacienda';
                    }
                }

                if (!mensajeError) {
                    mensajeError = 'Documento tributario rechazado por validación de Hacienda';
                }

                return {
                    id: d.dte_id,
                    numero_control: d.numero_control,
                    codigo_generacion: d.codigo_generacion,
                    tipo_dte: d.tipo_dte,
                    fecha: d.created_at,
                    monto: parseFloat(d.total_pagar || 0),
                    cliente: d.cliente,
                    pos_name: d.pos_name || 'Pista',
                    seller_name: d.seller_name || 'Vendedor',
                    shift_number: d.shift_number || 1,
                    shift_status: d.shift_status || 'closed',
                    branch_name: d.branch_name,
                    codigo_error: codigoError,
                    mensaje_error: mensajeError
                };
            });
        } catch (e) { console.error('REJECTED DTES ERR:', e); }

        // 4. Clientes pendientes de pago / crédito en Pista
        let pendingCredits = [];
        try {
            const [cRows] = await pool.query(`
                SELECT 
                    sh.id, 
                    sh.created_at, 
                    COALESCE(c.nombre, sh.cliente_nombre, 'Cliente Crédito') as cliente,
                    c.telefono,
                    sh.total_pagar as monto,
                    DATEDIFF(CURDATE(), DATE(sh.created_at)) as dias_credito,
                    b.nombre as branch_name
                FROM sales_headers sh
                LEFT JOIN customers c ON sh.customer_id = c.id
                LEFT JOIN branches b ON sh.branch_id = b.id
                WHERE sh.company_id = ? 
                  AND (sh.condicion_operacion = '02' OR sh.condicion_operacion = 2)
                  AND (sh.estado != 'anulado' AND sh.estado != 'ANULADO')
                  ${branchId ? 'AND sh.branch_id = ?' : ''}
                ORDER BY sh.created_at DESC
                LIMIT 15
            `, branchId ? [companyId, branchId] : [companyId]);

            pendingCredits = (cRows || []).map(c => ({
                id: c.id,
                fecha: c.created_at,
                cliente: c.cliente,
                telefono: c.telefono,
                monto: parseFloat(c.monto || 0),
                dias_credito: c.dias_credito || 0,
                branch_name: c.branch_name
            }));
        } catch (e) { console.error('PENDING CREDITS ERR:', e); }

        // 5. Saldos de clientes Trupput
        let trupputBalances = [];
        try {
            const [tRows] = await pool.query(`
                SELECT 
                    t.id, 
                    t.numero, 
                    t.fecha, 
                    COALESCE(c.nombre, t.cliente_nombre) as cliente,
                    t.galones, 
                    t.galones_disponibles, 
                    t.precio, 
                    t.monto,
                    b.nombre as branch_name
                FROM gas_station_trupput t
                LEFT JOIN customers c ON t.cliente_id = c.id
                LEFT JOIN branches b ON t.branch_id = b.id
                WHERE t.company_id = ? AND t.galones_disponibles > 0
                  ${branchId ? 'AND t.branch_id = ?' : ''}
                ORDER BY t.galones_disponibles DESC
                LIMIT 15
            `, branchId ? [companyId, branchId] : [companyId]);

            trupputBalances = (tRows || []).map(t => ({
                id: t.id,
                numero: t.numero,
                fecha: t.fecha,
                cliente: t.cliente,
                galones_totales: parseFloat(t.galones || 0),
                galones_disponibles: parseFloat(t.galones_disponibles || 0),
                precio: parseFloat(t.precio || 0),
                monto: parseFloat(t.monto || 0),
                branch_name: t.branch_name
            }));
        } catch (e) { console.error('TRUPPUT ERR:', e); }

        // 6. Saldos de clientes Anticipados
        let advanceBalances = [];
        try {
            const [aRows] = await pool.query(`
                SELECT 
                    a.id, 
                    a.numero, 
                    a.fecha, 
                    COALESCE(c.nombre, a.cliente_nombre) as cliente,
                    a.monto, 
                    a.monto_disponible,
                    b.nombre as branch_name
                FROM gas_station_advances a
                LEFT JOIN customers c ON a.cliente_id = c.id
                LEFT JOIN branches b ON a.branch_id = b.id
                WHERE a.company_id = ? AND a.monto_disponible > 0
                  ${branchId ? 'AND a.branch_id = ?' : ''}
                ORDER BY a.monto_disponible DESC
                LIMIT 15
            `, branchId ? [companyId, branchId] : [companyId]);

            advanceBalances = (aRows || []).map(a => ({
                id: a.id,
                numero: a.numero,
                fecha: a.fecha,
                cliente: a.cliente,
                monto_inicial: parseFloat(a.monto || 0),
                monto_disponible: parseFloat(a.monto_disponible || 0),
                branch_name: a.branch_name
            }));
        } catch (e) { console.error('ADVANCES ERR:', e); }

        // 7. Próximas Pipas / Pedidos
        let upcomingPipas = [];
        try {
            const { getRrsPool } = require('../config/rrsDb');
            const [settings] = await pool.query(
                `SELECT setting_value FROM gas_station_settings WHERE company_id = ? AND setting_key = 'rrs_id_empresa' LIMIT 1`,
                [companyId]
            );
            const rrsIdEmpresa = settings[0]?.setting_value;
            if (rrsIdEmpresa) {
                const rrsPool = await getRrsPool();
                const [orders] = await rrsPool.query(`
                    SELECT id, numero, fecha, fecha_descarga, p_diesel, p_regular, p_super, p_ion, estado
                    FROM web_pedidos
                    WHERE id_estacion = ? AND estado IN ('PENDIENTE', 'VISTO')
                    ORDER BY fecha DESC, id DESC
                    LIMIT 10
                `, [rrsIdEmpresa]);
                upcomingPipas = (orders || []).map(o => ({
                    id: o.id,
                    numero: o.numero,
                    fecha_pedido: o.fecha,
                    fecha_entrega: o.fecha_descarga || o.fecha,
                    galones_diesel: parseFloat(o.p_diesel || 0),
                    galones_regular: parseFloat(o.p_regular || 0),
                    galones_super: parseFloat(o.p_super || 0),
                    galones_ion: parseFloat(o.p_ion || 0),
                    total_galones: (parseFloat(o.p_diesel || 0) + parseFloat(o.p_regular || 0) + parseFloat(o.p_super || 0) + parseFloat(o.p_ion || 0)),
                    estado: o.estado
                }));
            }
        } catch (e) {
            console.warn('PIPAS QUERY NOTE:', e.message);
        }

        res.json({
            tanks,
            activeShifts,
            rejectedDtes,
            pendingCredits,
            trupputBalances,
            advanceBalances,
            upcomingPipas
        });
    } catch (error) {
        console.error('CRITICAL PISTA DASHBOARD ERROR:', error);
        res.status(500).json({ message: 'Error al obtener estadísticas de pista', error: error.message });
    }
};

/**
 * Estadísticas de Dashboard Tienda (Tienda de conveniencia / Supermarket)
 */
const getTiendaStats = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const branchId = req.query?.branch_id || req.user?.branch_id || null;
        const period = req.query?.period || 'month'; // 'today' | 'week' | 'month'

        let dateCondition = 'AND MONTH(sh.created_at) = MONTH(CURDATE()) AND YEAR(sh.created_at) = YEAR(CURDATE())';
        if (period === 'today') {
            dateCondition = 'AND DATE(sh.created_at) = CURDATE()';
        } else if (period === 'week') {
            dateCondition = 'AND sh.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
        }

        // 1. Turnos activos de Tienda
        let activeShifts = [];
        try {
            const [shiftRows] = await pool.query(`
                SELECT 
                    s.id, 
                    s.shift_number,
                    sel.nombre as seller_name, 
                    p.nombre as pos_name, 
                    s.branch_id,
                    b.nombre as branch_name,
                    s.opening_balance,
                    s.start_time,
                    COALESCE(sales.total_sales, 0) as total_sales,
                    COALESCE(sales.cash_sales, 0) as cash_sales,
                    COALESCE(sales.card_sales, 0) as card_sales,
                    (s.opening_balance + COALESCE(sales.cash_sales, 0)) as cash_in_drawer
                FROM pos_shifts s
                JOIN sellers sel ON s.seller_id = sel.id
                JOIN points_of_sale p ON s.pos_id = p.id
                JOIN branches b ON s.branch_id = b.id
                LEFT JOIN (
                    SELECT 
                        h.shift_id,
                        SUM(h.total_pagar) as total_sales,
                        COALESCE(SUM(CASE WHEN COALESCE(sp.metodo_pago, '01') = '01' THEN COALESCE(sp.monto, h.total_pagar) ELSE 0 END), 0) as cash_sales,
                        COALESCE(SUM(CASE WHEN sp.metodo_pago != '01' THEN sp.monto ELSE 0 END), 0) as card_sales
                    FROM sales_headers h
                    LEFT JOIN sales_payments sp ON sp.sale_id = h.id
                    WHERE (h.estado != 'anulado' AND h.estado != 'ANULADO')
                      AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = h.id AND status = 'INVALIDADO')
                    GROUP BY h.shift_id
                ) sales ON sales.shift_id = s.id
                WHERE s.company_id = ? AND s.status = 'open'
                  AND (p.nombre LIKE '%TIENDA%' OR p.nombre LIKE '%SUPER%' OR p.nombre LIKE '%CONVENIENCIA%' OR p.nombre LIKE '%CAJA%')
                  ${branchId ? 'AND s.branch_id = ?' : ''}
                ORDER BY s.start_time DESC
            `, branchId ? [companyId, branchId] : [companyId]);

            activeShifts = (shiftRows || []).map(s => ({
                id: s.id,
                shift_number: s.shift_number,
                seller_name: s.seller_name,
                pos_name: s.pos_name,
                branch_id: s.branch_id,
                branch_name: s.branch_name,
                start_time: s.start_time,
                opening_balance: parseFloat(s.opening_balance || 0),
                total_sales: parseFloat(s.total_sales || 0),
                cash_sales: parseFloat(s.cash_sales || 0),
                card_sales: parseFloat(s.card_sales || 0),
                cash_in_drawer: parseFloat(s.cash_in_drawer || 0)
            }));
        } catch (e) { console.error('TIENDA SHIFTS ERR:', e); }

        // 2. Productos más vendidos (excluyendo combustibles y lubricantes)
        let topProducts = [];
        try {
            const [pRows] = await pool.query(`
                SELECT 
                    p.id, 
                    p.nombre, 
                    COALESCE(p.codigo, p.codigo_barra, CAST(p.id AS CHAR)) as codigo,
                    COALESCE(pc.name, 'General') as categoria,
                    SUM(si.cantidad) as total_qty,
                    SUM(si.cantidad * si.precio_unitario) as total_amount
                FROM sales_items si
                JOIN sales_headers sh ON si.sale_id = sh.id
                JOIN products p ON si.product_id = p.id
                LEFT JOIN product_categories pc ON p.category_id = pc.id
                WHERE sh.company_id = ? 
                  AND (sh.estado != 'anulado' AND sh.estado != 'ANULADO')
                  AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = sh.id AND status = 'INVALIDADO')
                  AND (p.tipo_combustible IS NULL OR p.tipo_combustible = 0)
                  AND (pc.name IS NULL OR (
                      UPPER(pc.name) NOT LIKE '%COMBUSTIB%' 
                      AND UPPER(pc.name) NOT LIKE '%LUBRICAN%'
                  ))
                  AND UPPER(p.nombre) NOT LIKE '%DIESEL%'
                  AND UPPER(p.nombre) NOT LIKE '%DIÉSEL%'
                  AND UPPER(p.nombre) NOT LIKE '%GASOLINA%'
                  AND UPPER(p.nombre) NOT LIKE '%LUBRICAN%'
                  ${dateCondition}
                  ${branchId ? 'AND sh.branch_id = ?' : ''}
                GROUP BY p.id, p.nombre, p.codigo, p.codigo_barra, pc.name
                ORDER BY total_amount DESC
                LIMIT 10
            `, branchId ? [companyId, branchId] : [companyId]);

            topProducts = (pRows || []).map(p => ({
                id: p.id,
                nombre: p.nombre,
                codigo: p.codigo,
                categoria: p.categoria,
                cantidad: parseFloat(p.total_qty || 0),
                monto: parseFloat(p.total_amount || 0)
            }));
        } catch (e) { console.error('TIENDA TOP PRODUCTS ERR:', e); }

        // 3. Categorías líderes con métricas (excluyendo combustibles y lubricantes)
        let topCategories = [];
        try {
            const [cRows] = await pool.query(`
                SELECT 
                    COALESCE(pc.name, 'Sin Categoría') as name,
                    COUNT(DISTINCT p.id) as products_count,
                    SUM(si.cantidad) as total_qty,
                    SUM(si.cantidad * si.precio_unitario) as total_amount
                FROM sales_items si
                JOIN sales_headers sh ON si.sale_id = sh.id
                JOIN products p ON si.product_id = p.id
                LEFT JOIN product_categories pc ON p.category_id = pc.id
                WHERE sh.company_id = ? 
                  AND (sh.estado != 'anulado' AND sh.estado != 'ANULADO')
                  AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = sh.id AND status = 'INVALIDADO')
                  AND (p.tipo_combustible IS NULL OR p.tipo_combustible = 0)
                  AND (pc.name IS NULL OR (
                      UPPER(pc.name) NOT LIKE '%COMBUSTIB%' 
                      AND UPPER(pc.name) NOT LIKE '%LUBRICAN%'
                  ))
                  AND UPPER(p.nombre) NOT LIKE '%DIESEL%'
                  AND UPPER(p.nombre) NOT LIKE '%DIÉSEL%'
                  AND UPPER(p.nombre) NOT LIKE '%GASOLINA%'
                  AND UPPER(p.nombre) NOT LIKE '%LUBRICAN%'
                  ${dateCondition}
                  ${branchId ? 'AND sh.branch_id = ?' : ''}
                GROUP BY pc.name
                ORDER BY total_amount DESC
                LIMIT 8
            `, branchId ? [companyId, branchId] : [companyId]);

            const grandTotal = cRows.reduce((acc, c) => acc + parseFloat(c.total_amount || 0), 0);
            topCategories = (cRows || []).map(c => ({
                name: c.name,
                products_count: parseInt(c.products_count || 0),
                total_qty: parseFloat(c.total_qty || 0),
                total_amount: parseFloat(c.total_amount || 0),
                percentage: grandTotal > 0 ? ((parseFloat(c.total_amount || 0) / grandTotal) * 100).toFixed(1) : '0'
            }));
        } catch (e) { console.error('TIENDA CATEGORIES ERR:', e); }

        // 4. Cheques pendientes de entrega a proveedores
        let pendingChecks = [];
        try {
            const [chRows] = await pool.query(`
                SELECT 
                    pc.id,
                    pc.fecha,
                    pc.monto,
                    pc.documento,
                    pc.rrs_num_cheque,
                    pc.status,
                    COALESCE(pr.nombre, 'Proveedor') as provider_name,
                    b.nombre as branch_name,
                    DATEDIFF(CURDATE(), DATE(pc.fecha)) as dias_espera
                FROM purchase_checks pc
                LEFT JOIN providers pr ON pc.provider_id = pr.id
                LEFT JOIN branches b ON pc.branch_id = b.id
                WHERE pc.company_id = ? 
                  AND (pc.status = 'pendiente' OR pc.status = 'PENDIENTE' OR pc.status = 'solicitado')
                  ${branchId ? 'AND pc.branch_id = ?' : ''}
                ORDER BY pc.fecha ASC
                LIMIT 15
            `, branchId ? [companyId, branchId] : [companyId]);

            pendingChecks = (chRows || []).map(c => ({
                id: c.id,
                fecha: c.fecha,
                monto: parseFloat(c.monto || 0),
                documento: c.documento,
                rrs_num_cheque: c.rrs_num_cheque,
                status: c.status,
                provider_name: c.provider_name,
                branch_name: c.branch_name,
                dias_espera: c.dias_espera || 0
            }));
        } catch (e) { console.error('PENDING CHECKS ERR:', e); }

        res.json({
            activeShifts,
            topProducts,
            topCategories,
            pendingChecks,
            summary: {
                totalActiveShifts: activeShifts.length,
                totalPendingChecks: pendingChecks.length,
                pendingChecksAmount: pendingChecks.reduce((a, c) => a + c.monto, 0)
            }
        });
    } catch (error) {
        console.error('CRITICAL TIENDA DASHBOARD ERROR:', error);
        res.status(500).json({ message: 'Error al obtener estadísticas de tienda', error: error.message });
    }
};

/**
 * Estadísticas de Dashboard Andelsa (Planta Industrial / Ovoproductos)
 */
const getAndelsaStats = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;

        // 1. Operación Calendario
        let calendarOperations = [];
        try {
            const [spRows] = await pool.query(`
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
            `, [companyId]);

            calendarOperations = (spRows || []).map(s => ({
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
        } catch (e) { console.error('ANDELSA CALENDAR ERR:', e); }

        // 2. Calendario semanal para equipo de bodega (Próximos 7 días + Stock materia prima)
        let weeklyWarehousePrep = { nextDays: [], rawMaterials: [] };
        try {
            const [nextDaysRows] = await pool.query(`
                SELECT 
                    DATE(production_date) as scheduled_date,
                    SUM(target_quantity_lbs) as total_lbs,
                    COUNT(*) as total_batches
                FROM egg_scheduled_productions
                WHERE company_id = ? 
                  AND production_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
                GROUP BY DATE(production_date)
                ORDER BY scheduled_date ASC
            `, [companyId]);

            const [rawMatRows] = await pool.query(`
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
            `, [companyId]);

            weeklyWarehousePrep = {
                nextDays: (nextDaysRows || []).map(r => ({
                    date: r.scheduled_date,
                    total_lbs: parseFloat(r.total_lbs || 0),
                    total_batches: parseInt(r.total_batches || 0)
                })),
                rawMaterials: (rawMatRows || []).map(r => ({
                    id: r.id,
                    lot_number: r.lot_number,
                    provider_name: r.provider_name,
                    quantity_boxes: parseFloat(r.quantity_boxes || 0),
                    total_weight_lb: parseFloat(r.total_weight_lb || 0),
                    status: r.status,
                    created_at: r.created_at
                }))
            };
        } catch (e) { console.error('ANDELSA WAREHOUSE ERR:', e); }

        // 3. Control de despacho para HOY y MAÑANA
        let dispatchControl = [];
        try {
            const [dRows] = await pool.query(`
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
                  AND DATE(co.required_delivery_date) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 1 DAY)
                ORDER BY co.required_delivery_date ASC, co.id ASC
                LIMIT 20
            `, [companyId]);

            dispatchControl = (dRows || []).map(d => ({
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
        } catch (e) { console.error('ANDELSA DISPATCH ERR:', e); }

        // 4. Costos de producción y costo por libra
        let productionCosts = { avgCostPerLb: 0, totalCost: 0, totalPounds: 0 };
        try {
            const [costRows] = await pool.query(`
                SELECT 
                    SUM(ic.total_cost) as total_cost,
                    SUM(pb.yield_liquid_lbs) as total_yield_lbs
                FROM egg_industrial_costs ic
                JOIN egg_production_batches pb ON ic.batch_id = pb.id
                WHERE ic.company_id = ? 
                  AND MONTH(ic.created_at) = MONTH(CURDATE()) 
                  AND YEAR(ic.created_at) = YEAR(CURDATE())
            `, [companyId]);

            const totalCost = parseFloat(costRows[0]?.total_cost || 0);
            const totalLbs = parseFloat(costRows[0]?.total_yield_lbs || 0);
            const avgCostPerLb = totalLbs > 0 ? (totalCost / totalLbs) : 0;

            productionCosts = {
                avgCostPerLb: parseFloat(avgCostPerLb.toFixed(4)),
                totalCost,
                totalPounds: totalLbs
            };
        } catch (e) { console.error('ANDELSA COSTS ERR:', e); }

        // 5. Estado de producciones (Pipeline de lotes activos)
        let productionPipeline = [];
        try {
            const [pRows] = await pool.query(`
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
            `, [companyId]);

            productionPipeline = (pRows || []).map(p => ({
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
        } catch (e) { console.error('ANDELSA PIPELINE ERR:', e); }

        // 6. Aprobación y liberación de lotes de calidad
        let batchApprovals = [];
        try {
            const [qRows] = await pool.query(`
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
            `, [companyId]);

            batchApprovals = (qRows || []).map(q => ({
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
        } catch (e) { console.error('ANDELSA QUALITY ERR:', e); }

        res.json({
            calendarOperations,
            weeklyWarehousePrep,
            dispatchControl,
            productionCosts,
            productionPipeline,
            batchApprovals
        });
    } catch (error) {
        console.error('CRITICAL ANDELSA DASHBOARD ERROR:', error);
        res.status(500).json({ message: 'Error al obtener estadísticas de Andelsa', error: error.message });
    }
};

/**
 * Estadísticas de Salud y Monitoreo del Servidor
 */
const getServerStats = async (req, res) => {
    try {
        const os = require('os');
        const net = require('net');
        const fs = require('fs');

        // 1. Hardware Metrics
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const ramPct = Math.round((usedMem / totalMem) * 100);

        const cpus = os.cpus();
        const cpuCount = cpus.length;
        const cpuModel = cpus[0]?.model || 'Procesador Host';
        const loadAvg = os.loadavg();

        // Disk space
        let disk = { totalGB: 0, freeGB: 0, usedGB: 0, percentage: 0 };
        try {
            const rootPath = process.platform === 'win32' ? 'C:\\' : '/';
            const stat = await fs.promises.statfs(rootPath);
            const total = (stat.bsize * stat.blocks) / 1e9;
            const free = (stat.bsize * stat.bfree) / 1e9;
            const used = total - free;
            disk = {
                totalGB: parseFloat(total.toFixed(1)),
                freeGB: parseFloat(free.toFixed(1)),
                usedGB: parseFloat(used.toFixed(1)),
                percentage: Math.round((used / total) * 100)
            };
        } catch (e) {
            console.warn('Statfs warning:', e.message);
        }

        // Port probe helper
        const checkPort = (host, port, timeout = 900) => {
            return new Promise((resolve) => {
                const socket = new net.Socket();
                let isResolved = false;
                socket.setTimeout(timeout);
                socket.once('connect', () => {
                    if (!isResolved) { isResolved = true; socket.destroy(); resolve(true); }
                });
                socket.once('timeout', () => {
                    if (!isResolved) { isResolved = true; socket.destroy(); resolve(false); }
                });
                socket.once('error', () => {
                    if (!isResolved) { isResolved = true; socket.destroy(); resolve(false); }
                });
                try { socket.connect(port, host); } catch { resolve(false); }
            });
        };

        // 2. Services probe
        const [dteApiOnline, mhProdOnline, mhTestOnline, webhookOnline] = await Promise.all([
            checkPort('127.0.0.1', 5000),
            checkPort('127.0.0.1', 8113),
            checkPort('127.0.0.1', 8114),
            checkPort('127.0.0.1', 7777)
        ]);

        // 3. MySQL Telemetry
        const startDb = Date.now();
        await pool.query('SELECT 1');
        const dbLatencyMs = Date.now() - startDb;

        let dbThreads = 0;
        let dbSlowQueries = 0;
        let dbUptime = 0;
        try {
            const [statusRows] = await pool.query(`
                SHOW STATUS WHERE Variable_name IN ('Threads_connected', 'Slow_queries', 'Uptime')
            `);
            (statusRows || []).forEach(r => {
                if (r.Variable_name === 'Threads_connected') dbThreads = parseInt(r.Value || 0);
                if (r.Variable_name === 'Slow_queries') dbSlowQueries = parseInt(r.Value || 0);
                if (r.Variable_name === 'Uptime') dbUptime = parseInt(r.Value || 0);
            });
        } catch (e) { console.error('DB STATUS ERR:', e); }

        res.json({
            hardware: {
                cpuCount,
                cpuModel,
                loadAvg: [parseFloat(loadAvg[0].toFixed(2)), parseFloat(loadAvg[1].toFixed(2)), parseFloat(loadAvg[2].toFixed(2))],
                ram: {
                    totalGB: parseFloat((totalMem / 1e9).toFixed(2)),
                    freeGB: parseFloat((freeMem / 1e9).toFixed(2)),
                    usedGB: parseFloat((usedMem / 1e9).toFixed(2)),
                    percentage: ramPct
                },
                disk,
                uptimeSeconds: Math.floor(os.uptime()),
                processUptimeSeconds: Math.floor(process.uptime())
            },
            services: [
                { name: 'API Principal (Nova Server)', port: 4000, status: 'online', type: 'core' },
                { name: 'Servicio DTE (Express / Hacienda)', port: 5000, status: dteApiOnline ? 'online' : 'offline', type: 'dte' },
                { name: 'Firmador MH Producción (Docker)', port: 8113, status: mhProdOnline ? 'online' : 'offline', type: 'mh' },
                { name: 'Firmador MH Pruebas (Docker)', port: 8114, status: mhTestOnline ? 'online' : 'offline', type: 'mh' },
                { name: 'Servicio Webhook Notificaciones', port: 7777, status: webhookOnline ? 'online' : 'offline', type: 'webhook' }
            ],
            database: {
                status: 'online',
                latencyMs: dbLatencyMs,
                connectedThreads: dbThreads,
                slowQueries: dbSlowQueries,
                uptimeSeconds: dbUptime
            }
        });
    } catch (error) {
        console.error('CRITICAL SERVER DASHBOARD ERROR:', error);
        res.status(500).json({ message: 'Error al obtener métricas del servidor', error: error.message });
    }
};

module.exports = {
    getStats,
    getCategorySales,
    getPistaStats,
    getTiendaStats,
    getAndelsaStats,
    getServerStats
};
