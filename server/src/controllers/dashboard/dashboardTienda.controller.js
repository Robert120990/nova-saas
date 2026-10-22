const pool = require('../../config/db');
const { getOrSetDashboard } = require('../../services/dashboardCache.service');

/**
 * Tienda (Supermarket / Convenience Store) Dashboard Statistics
 */
const getTiendaStats = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) {
            return res.json({
                activeShifts: [],
                topProducts: [],
                topCategories: [],
                pendingChecks: [],
                summary: { totalActiveShifts: 0, totalPendingChecks: 0, pendingChecksAmount: 0 }
            });
        }

        const branchId = req.query?.branch_id || req.user?.branch_id || null;
        const period = req.query?.period || 'month'; // 'today' | 'week' | 'month'
        const force = req.query?.force === 'true';
        const cacheKey = `dashboard:tienda:${companyId}:${branchId || 'all'}:${period}`;

        // Sargable range scans instead of MONTH() / DATE() functions
        let dateCondition = `AND sh.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01 00:00:00') 
                             AND sh.created_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01 00:00:00'), INTERVAL 1 MONTH)`;
        if (period === 'today') {
            dateCondition = `AND sh.created_at >= CURDATE() AND sh.created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)`;
        } else if (period === 'week') {
            dateCondition = `AND sh.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
        }

        const data = await getOrSetDashboard(cacheKey, async () => {
            const [
                shiftRowsRes,
                pRowsRes,
                cRowsRes,
                chRowsRes
            ] = await Promise.all([
                // 1. Active Store Shifts
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
                `, branchId ? [companyId, branchId] : [companyId]).catch(e => { console.error('TIENDA SHIFTS ERR:', e); return [[]]; }),

                // 2. Top Selling Products (excluding fuels & lubricants)
                pool.query(`
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
                `, branchId ? [companyId, branchId] : [companyId]).catch(e => { console.error('TIENDA TOP PRODUCTS ERR:', e); return [[]]; }),

                // 3. Top Categories (excluding fuels & lubricants)
                pool.query(`
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
                `, branchId ? [companyId, branchId] : [companyId]).catch(e => { console.error('TIENDA CATEGORIES ERR:', e); return [[]]; }),

                // 4. Pending Checks
                pool.query(`
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
                `, branchId ? [companyId, branchId] : [companyId]).catch(e => { console.error('PENDING CHECKS ERR:', e); return [[]]; })
            ]);

            const activeShifts = (shiftRowsRes[0] || []).map(s => ({
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

            const topProducts = (pRowsRes[0] || []).map(p => ({
                id: p.id,
                nombre: p.nombre,
                codigo: p.codigo,
                categoria: p.categoria,
                cantidad: parseFloat(p.total_qty || 0),
                monto: parseFloat(p.total_amount || 0)
            }));

            const cRows = cRowsRes[0] || [];
            const grandTotal = cRows.reduce((acc, c) => acc + parseFloat(c.total_amount || 0), 0);
            const topCategories = cRows.map(c => ({
                name: c.name,
                products_count: parseInt(c.products_count || 0),
                total_qty: parseFloat(c.total_qty || 0),
                total_amount: parseFloat(c.total_amount || 0),
                percentage: grandTotal > 0 ? ((parseFloat(c.total_amount || 0) / grandTotal) * 100).toFixed(1) : '0'
            }));

            const pendingChecks = (chRowsRes[0] || []).map(c => ({
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

            return {
                activeShifts,
                topProducts,
                topCategories,
                pendingChecks,
                summary: {
                    totalActiveShifts: activeShifts.length,
                    totalPendingChecks: pendingChecks.length,
                    pendingChecksAmount: pendingChecks.reduce((a, c) => a + c.monto, 0)
                }
            };
        }, 45, force);

        return res.json(data);
    } catch (error) {
        console.error('CRITICAL TIENDA DASHBOARD ERROR:', error);
        return res.status(500).json({ message: 'Error al obtener estadísticas de tienda', error: error.message });
    }
};

module.exports = {
    getTiendaStats
};
