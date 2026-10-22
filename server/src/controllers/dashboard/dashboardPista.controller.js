const pool = require('../../config/db');
const { getOrSetDashboard } = require('../../services/dashboardCache.service');

/**
 * Gas Station (Pista) Dashboard Statistics
 */
const getPistaStats = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) {
            return res.json({
                tanks: [],
                activeShifts: [],
                rejectedDtes: [],
                pendingCredits: [],
                trupputBalances: [],
                advanceBalances: [],
                upcomingPipas: []
            });
        }

        const branchId = req.query?.branch_id || req.user?.branch_id || null;
        const force = req.query?.force === 'true';
        const cacheKey = `dashboard:pista:${companyId}:${branchId || 'all'}`;

        const data = await getOrSetDashboard(cacheKey, async () => {
            const [
                tRowsRes,
                shiftRowsRes,
                dRowsRes,
                cRowsRes,
                trupputRowsRes,
                advanceRowsRes,
                pipasRes
            ] = await Promise.all([
                // 1. Tanks with readings
                pool.query(`
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
                `, branchId ? [companyId, branchId] : [companyId]).catch(e => { console.error('TANKS ERR:', e); return [[]]; }),

                // 2. Active Pista Shifts
                pool.query(`
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
                `, branchId ? [companyId, branchId] : [companyId]).catch(e => { console.error('PISTA SHIFTS ERR:', e); return [[]]; }),

                // 3. Rejected DTEs today / active shifts (range condition instead of DATE())
                pool.query(`
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
                        s.shift_status,
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
                      AND (
                          (d.created_at >= CURDATE() AND d.created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY))
                          OR s.status = 'open'
                      )
                      AND (d.status = 'REJECTED' OR d.status LIKE '%RECHAZ%' OR d.status LIKE '%ERROR%')
                      ${branchId ? 'AND d.branch_id = ?' : ''}
                    ORDER BY d.created_at DESC
                    LIMIT 50
                `, branchId ? [companyId, branchId] : [companyId]).catch(e => { console.error('REJECTED DTES ERR:', e); return [[]]; }),

                // 4. Pending Credits in Pista
                pool.query(`
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
                `, branchId ? [companyId, branchId] : [companyId]).catch(e => { console.error('PENDING CREDITS ERR:', e); return [[]]; }),

                // 5. Trupput Customer Balances
                pool.query(`
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
                `, branchId ? [companyId, branchId] : [companyId]).catch(e => { console.error('TRUPPUT ERR:', e); return [[]]; }),

                // 6. Advance Customer Balances
                pool.query(`
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
                `, branchId ? [companyId, branchId] : [companyId]).catch(e => { console.error('ADVANCES ERR:', e); return [[]]; }),

                // 7. Upcoming Pipas
                (async () => {
                    try {
                        const { getRrsPool } = require('../../config/rrsDb');
                        const [settings] = await pool.query(
                            `SELECT setting_value FROM gas_station_settings WHERE company_id = ? AND setting_key = 'rrs_id_empresa' LIMIT 1`,
                            [companyId]
                        );
                        const rrsIdEmpresa = settings[0]?.setting_value;
                        if (!rrsIdEmpresa) return [];

                        const rrsPool = await getRrsPool();
                        const [orders] = await rrsPool.query(`
                            SELECT id, numero, fecha, fecha_descarga, p_diesel, p_regular, p_super, p_ion, estado
                            FROM web_pedidos
                            WHERE id_estacion = ? AND estado IN ('PENDIENTE', 'VISTO')
                            ORDER BY fecha DESC, id DESC
                            LIMIT 10
                        `, [rrsIdEmpresa]);

                        return (orders || []).map(o => ({
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
                    } catch (e) {
                        console.warn('PIPAS QUERY NOTE:', e.message);
                        return [];
                    }
                })()
            ]);

            const tanks = (tRowsRes[0] || []).map(t => {
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

            const activeShifts = (shiftRowsRes[0] || []).map(s => ({
                id: s.id,
                shift_number: s.shift_number,
                seller_name: s.seller_name,
                pos_name: s.pos_name,
                branch_id: s.branch_id,
                branch_name: s.branch_name,
                start_time: s.start_time,
                total_sales: parseFloat(s.total_sales || 0),
                sales_count: parseInt(s.sales_count || 0)
            }));

            const rejectedDtes = (dRowsRes[0] || []).map(d => {
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

            const pendingCredits = (cRowsRes[0] || []).map(c => ({
                id: c.id,
                fecha: c.created_at,
                cliente: c.cliente,
                telefono: c.telefono,
                monto: parseFloat(c.monto || 0),
                dias_credito: c.dias_credito || 0,
                branch_name: c.branch_name
            }));

            const trupputBalances = (trupputRowsRes[0] || []).map(t => ({
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

            const advanceBalances = (advanceRowsRes[0] || []).map(a => ({
                id: a.id,
                numero: a.numero,
                fecha: a.fecha,
                cliente: a.cliente,
                monto_inicial: parseFloat(a.monto || 0),
                monto_disponible: parseFloat(a.monto_disponible || 0),
                branch_name: a.branch_name
            }));

            return {
                tanks,
                activeShifts,
                rejectedDtes,
                pendingCredits,
                trupputBalances,
                advanceBalances,
                upcomingPipas: pipasRes || []
            };
        }, 45, force);

        return res.json(data);
    } catch (error) {
        console.error('CRITICAL PISTA DASHBOARD ERROR:', error);
        return res.status(500).json({ message: 'Error al obtener estadísticas de pista', error: error.message });
    }
};

module.exports = {
    getPistaStats
};
