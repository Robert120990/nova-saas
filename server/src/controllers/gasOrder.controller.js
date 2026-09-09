const pool = require('../config/db');
const { getRrsPool } = require('../config/rrsDb');

/**
 * Helper to fetch rrs_id_empresa configured for branch or company
 */
const getStationConfig = async (companyId, branchId) => {
    let rrsIdEmpresa = null;
    let branchName = null;

    if (branchId) {
        const [branchRows] = await pool.query(
            `SELECT nombre FROM branches WHERE id = ? AND company_id = ?`,
            [branchId, companyId]
        );
        branchName = branchRows[0]?.nombre || null;

        const [settings] = await pool.query(
            `SELECT setting_value FROM gas_station_settings
             WHERE company_id = ? AND branch_id = ? AND setting_key = 'rrs_id_empresa'`,
            [companyId, branchId]
        );
        rrsIdEmpresa = settings[0]?.setting_value || null;
    }

    // Fallback to company-level setting if branch setting was not found
    if (!rrsIdEmpresa) {
        const [companySettings] = await pool.query(
            `SELECT setting_value FROM gas_station_settings
             WHERE company_id = ? AND setting_key = 'rrs_id_empresa' LIMIT 1`,
            [companyId]
        );
        rrsIdEmpresa = companySettings[0]?.setting_value || null;
    }

    return { rrsIdEmpresa, branchName };
};

/**
 * Controller to query fuel orders from RRS (web_pedidos table)
 * for the gas station configured in gas_station_settings (rrs_id_empresa).
 */
exports.getGasOrders = async (req, res) => {
    try {
        const branchId = req.query?.branch_id || req.user?.branch_id || null;
        const companyId = req.company_id;

        // 1. Get the configured rrs_id_empresa from gas_station_settings
        const { rrsIdEmpresa, branchName } = await getStationConfig(companyId, branchId);

        if (!rrsIdEmpresa) {
            return res.json({
                unconfigured: true,
                message: 'No se ha configurado la estación de RRS (rrs_id_empresa) para esta sucursal.',
                data: [],
                total: 0,
                summary: {
                    totalOrders: 0,
                    totalDiesel: 0,
                    totalRegular: 0,
                    totalSuper: 0,
                    totalIon: 0,
                    totalGallons: 0,
                }
            });
        }

        // 2. Connect to RRS database
        const rrs = getRrsPool();

        // 3. Build query for web_pedidos (Excluding transportista and pipa per instructions)
        const status = (req.query.status || 'PENDIENTE').trim().toUpperCase();
        const search = (req.query.search || '').trim();
        const startDate = req.query.start_date || null;
        const endDate = req.query.end_date || null;

        let query = `
            SELECT
                id,
                fecha,
                numero,
                id_estacion,
                forma_pago,
                p_diesel,
                p_regular,
                p_super,
                p_ion,
                r_diesel,
                r_regular,
                r_super,
                r_ion,
                documento,
                observacion,
                estado,
                cupones,
                pago,
                fecha_descarga,
                costo_d,
                costo_s,
                costo_r,
                costo_i,
                flete,
                ncr_numero,
                ncr_monto
            FROM web_pedidos
            WHERE id_estacion = ?
        `;
        const params = [rrsIdEmpresa];

        if (status === 'PENDIENTE' || status === 'PENDIENTES') {
            query += ` AND estado IN ('PENDIENTE', 'VISTO')`;
        } else if (status === 'SOLO_PENDIENTE') {
            query += ` AND estado = 'PENDIENTE'`;
        } else if (status && status !== 'TODOS') {
            query += ` AND estado = ?`;
            params.push(status);
        }

        if (startDate) {
            query += ` AND fecha >= ?`;
            params.push(startDate);
        }

        if (endDate) {
            query += ` AND fecha <= ?`;
            params.push(endDate);
        }

        if (search) {
            query += ` AND (numero LIKE ? OR forma_pago LIKE ? OR documento LIKE ? OR observacion LIKE ? OR ncr_numero LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY fecha DESC, id DESC`;

        const [rows] = await rrs.query(query, params);

        // 4. Calculate KPI summary
        let totalDiesel = 0;
        let totalRegular = 0;
        let totalSuper = 0;
        let totalIon = 0;

        const formattedRows = rows.map(r => {
            const pDiesel = parseFloat(r.p_diesel) || 0;
            const pRegular = parseFloat(r.p_regular) || 0;
            const pSuper = parseFloat(r.p_super) || 0;
            const pIon = parseFloat(r.p_ion) || 0;
            const totalGln = pDiesel + pRegular + pSuper + pIon;

            totalDiesel += pDiesel;
            totalRegular += pRegular;
            totalSuper += pSuper;
            totalIon += pIon;

            return {
                ...r,
                total_galones: totalGln,
            };
        });

        const totalGallons = totalDiesel + totalRegular + totalSuper + totalIon;

        res.json({
            unconfigured: false,
            stationId: rrsIdEmpresa,
            branchName,
            data: formattedRows,
            total: formattedRows.length,
            summary: {
                totalOrders: formattedRows.length,
                totalDiesel,
                totalRegular,
                totalSuper,
                totalIon,
                totalGallons,
            }
        });
    } catch (error) {
        console.error('Error in getGasOrders:', error);
        res.status(500).json({ error: 'Error al consultar pedidos en RRS: ' + (error.message || 'Error desconocido') });
    }
};

/**
 * Controller to mark an order as 'VISTO' in RRS web_pedidos.
 */
exports.markOrderAsSeen = async (req, res) => {
    try {
        const { id } = req.params;
        const branchId = req.query?.branch_id || req.user?.branch_id || null;
        const companyId = req.company_id;

        const { rrsIdEmpresa } = await getStationConfig(companyId, branchId);
        if (!rrsIdEmpresa) {
            return res.status(400).json({ error: 'No se ha configurado la estación de RRS para esta sucursal.' });
        }

        const rrs = getRrsPool();

        // Check that order exists and belongs to this station
        const [orders] = await rrs.query(
            `SELECT id, numero, estado FROM web_pedidos WHERE id = ? AND id_estacion = ?`,
            [id, rrsIdEmpresa]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado o no pertenece a la estación configurada.' });
        }

        const order = orders[0];
        if (order.estado === 'RECIBIDO') {
            return res.status(400).json({ error: 'El pedido ya fue recibido y no puede cambiarse a visto.' });
        }

        await rrs.query(
            `UPDATE web_pedidos SET estado = 'VISTO' WHERE id = ? AND id_estacion = ?`,
            [id, rrsIdEmpresa]
        );

        res.json({
            success: true,
            message: `Pedido #${order.numero || id} marcado como visto exitosamente.`
        });
    } catch (error) {
        console.error('Error in markOrderAsSeen:', error);
        res.status(500).json({ error: 'Error al marcar pedido como visto: ' + (error.message || 'Error desconocido') });
    }
};

/**
 * Controller to get banks list from RRS.
 */
exports.getBanks = async (req, res) => {
    try {
        const rrs = getRrsPool();
        const [rows] = await rrs.query(
            `SELECT id, MIN(REPLACE(descripcion, 'A - ', '')) AS descripcion
             FROM bancos
             GROUP BY id
             ORDER BY descripcion`
        );
        res.json({ data: rows });
    } catch (error) {
        console.error('Error in getBanks:', error);
        res.status(500).json({ error: 'Error al consultar bancos: ' + (error.message || 'Error desconocido') });
    }
};

/**
 * Controller to get active bank accounts from RRS.
 * Supports filtering by bankId or returns all active accounts with concatenated bank name.
 */
exports.getBankAccounts = async (req, res) => {
    try {
        const rrs = getRrsPool();
        const bankId = req.query?.bank_id || null;

        let query = `
            SELECT a.numero, a.id_empresa, a.cod_banco, a.nombre,
                   CONCAT(COALESCE(b.descripcion, ''), ' - ', a.numero, ' - ', a.nombre) AS descri,
                   CONCAT('(', a.numero, ') ', a.nombre) AS display_name
            FROM cuentas_bancarias a
            LEFT JOIN bancos b ON a.cod_banco = b.id AND a.id_empresa = b.id_empresa
            WHERE a.activa = 'S'
        `;
        const params = [];

        if (bankId) {
            query += ` AND a.cod_banco = ?`;
            params.push(bankId);
        }

        query += ` ORDER BY a.orden, a.nombre`;

        const [rows] = await rrs.query(query, params);
        res.json({ data: rows });
    } catch (error) {
        console.error('Error in getBankAccounts:', error);
        res.status(500).json({ error: 'Error al consultar cuentas bancarias: ' + (error.message || 'Error desconocido') });
    }
};

/**
 * Controller to validate if a cheque exists in vouchers for a given account.
 */
exports.validateVoucher = async (req, res) => {
    try {
        const rrs = getRrsPool();
        const account = (req.query.account || '').trim();
        const cheque = (req.query.cheque || '').trim();

        if (!account || !cheque) {
            return res.status(400).json({ error: 'Cuenta y número de cheque son requeridos.' });
        }

        const [rows] = await rrs.query(
            `SELECT numero_cuenta, cheque, valor, concepto, es_reservado, id_origen
             FROM vouchers
             WHERE numero_cuenta = ? AND cheque = ?`,
            [account, cheque]
        );

        if (rows.length === 0) {
            return res.json({ exists: false, message: 'Cheque no encontrado.' });
        }

        res.json({ exists: true, voucher: rows[0] });
    } catch (error) {
        console.error('Error in validateVoucher:', error);
        res.status(500).json({ error: 'Error al validar cheque: ' + (error.message || 'Error desconocido') });
    }
};

/**
 * Controller to get vouchers currently assigned to an order.
 */
exports.getOrderVouchers = async (req, res) => {
    try {
        const { id } = req.params;
        const rrs = getRrsPool();

        const [rows] = await rrs.query(
            `SELECT v.numero_cuenta, v.concepto, v.cheque, v.valor, v.llave, v.id_empresa, c.nombre AS nombre_cuenta
             FROM vouchers v
             LEFT JOIN cuentas_bancarias c ON c.numero = v.numero_cuenta
             WHERE v.id_origen = ?`,
            [id]
        );

        res.json({ data: rows });
    } catch (error) {
        console.error('Error in getOrderVouchers:', error);
        res.status(500).json({ error: 'Error al consultar vouchers del pedido: ' + (error.message || 'Error desconocido') });
    }
};

/**
 * Controller to get transfer movement currently assigned to an order.
 */
exports.getOrderTransfer = async (req, res) => {
    try {
        const { id } = req.params;
        const rrs = getRrsPool();

        const [rows] = await rrs.query(
            `SELECT m.*, CONCAT(COALESCE(b.descripcion, ''), ' - ', c.numero, ' - ', c.nombre) AS descri_cuenta
             FROM movimientos_bancarios m
             LEFT JOIN cuentas_bancarias c ON c.numero = m.numero_cuenta
             LEFT JOIN bancos b ON b.id = c.cod_banco AND b.id_empresa = c.id_empresa
             WHERE m.centro_costo = ?
             LIMIT 1`,
            [id]
        );

        res.json({ data: rows[0] || null });
    } catch (error) {
        console.error('Error in getOrderTransfer:', error);
        res.status(500).json({ error: 'Error al consultar transferencia del pedido: ' + (error.message || 'Error desconocido') });
    }
};

/**
 * Controller to receive an order in RRS web_pedidos.
 * Supports both:
 * - metodo_pago === 'CHEQUE' (frm_descarga_pedido: vouchers, cupones, cheques)
 * - metodo_pago === 'TRANSFERENCIA' (frm_descarga_pedido2: movimientos_bancarios, referencia)
 * Updates combustibles_costos with costo = costo_producto + flete in both modes.
 */
exports.receiveOrder = async (req, res) => {
    let conn = null;
    try {
        const { id } = req.params;
        const branchId = req.query?.branch_id || req.user?.branch_id || null;
        const companyId = req.company_id;

        const { rrsIdEmpresa } = await getStationConfig(companyId, branchId);
        if (!rrsIdEmpresa) {
            return res.status(400).json({ error: 'No se ha configurado la estación de RRS para esta sucursal.' });
        }

        const metodoPago = (req.body.metodo_pago || 'CHEQUE').trim().toUpperCase();

        const {
            fecha_descarga,
            documento,
            observacion,
            ncr_numero,
            ncr_monto,
            cupones,
            r_diesel,
            r_regular,
            r_super,
            r_ion,
            cheques = [],
            // Transfer-specific fields
            numero_cuenta,
            referencia,
            monto,
            fecha_pago,
            concepto
        } = req.body;

        if (!documento || !documento.trim()) {
            return res.status(400).json({ error: 'El número de documento es obligatorio.' });
        }

        if (!fecha_descarga || !fecha_descarga.trim()) {
            return res.status(400).json({ error: 'La fecha de descarga es obligatoria.' });
        }

        // Format fecha_descarga to DD/MM/YYYY if provided as YYYY-MM-DD
        let formattedFechaDescarga = fecha_descarga.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(formattedFechaDescarga)) {
            const [y, m, d] = formattedFechaDescarga.split('-');
            formattedFechaDescarga = `${d}/${m}/${y}`;
        }

        const rrs = getRrsPool();
        conn = await rrs.getConnection();
        await conn.beginTransaction();

        // 1. Check order
        const [orders] = await conn.query(
            `SELECT id, numero, estado, fecha, id_estacion, forma_pago, p_diesel, p_regular, p_super, p_ion, costo_d, costo_s, costo_r, costo_i, flete
             FROM web_pedidos WHERE id = ? AND id_estacion = ?`,
            [id, rrsIdEmpresa]
        );

        if (orders.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Pedido no encontrado o no pertenece a la estación configurada.' });
        }

        const order = orders[0];

        if (order.estado !== 'VISTO') {
            await conn.rollback();
            return res.status(400).json({
                error: 'Solo se puede recibir el pedido si su estado es VISTO. Debe marcarlo como visto antes de recibirlo.'
            });
        }

        const rDiesel = r_diesel !== undefined && r_diesel !== '' ? parseFloat(r_diesel) || 0 : (parseFloat(order.p_diesel) || 0);
        const rRegular = r_regular !== undefined && r_regular !== '' ? parseFloat(r_regular) || 0 : (parseFloat(order.p_regular) || 0);
        const rSuper = r_super !== undefined && r_super !== '' ? parseFloat(r_super) || 0 : (parseFloat(order.p_super) || 0);
        const rIon = r_ion !== undefined && r_ion !== '' ? parseFloat(r_ion) || 0 : (parseFloat(order.p_ion) || 0);

        // Captured fuel unit costs and freight (defaults to existing order values if not provided)
        const costoD = req.body.costo_d !== undefined && req.body.costo_d !== '' ? parseFloat(req.body.costo_d) || 0 : (parseFloat(order.costo_d) || 0);
        const costoR = req.body.costo_r !== undefined && req.body.costo_r !== '' ? parseFloat(req.body.costo_r) || 0 : (parseFloat(order.costo_r) || 0);
        const costoS = req.body.costo_s !== undefined && req.body.costo_s !== '' ? parseFloat(req.body.costo_s) || 0 : (parseFloat(order.costo_s) || 0);
        const costoI = req.body.costo_i !== undefined && req.body.costo_i !== '' ? parseFloat(req.body.costo_i) || 0 : (parseFloat(order.costo_i) || 0);
        const flete = req.body.flete !== undefined && req.body.flete !== '' ? parseFloat(req.body.flete) || 0 : (parseFloat(order.flete) || 0);

        // Validation: at least one fuel product must have received gallons
        if (rDiesel <= 0 && rRegular <= 0 && rSuper <= 0 && rIon <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Debe registrar la descarga de galones de al menos un producto.' });
        }

        // Validation: any received fuel product must have a cost greater than zero
        if (rDiesel > 0 && costoD <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Debe ingresar el costo por galón para Diésel.' });
        }
        if (rRegular > 0 && costoR <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Debe ingresar el costo por galón para Regular.' });
        }
        if (rSuper > 0 && costoS <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Debe ingresar el costo por galón para Súper.' });
        }
        if (rIon > 0 && costoI <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Debe ingresar el costo por galón para Ion Diésel.' });
        }

        const ncrNumero = (ncr_numero || '').trim();
        const ncrMonto = parseFloat(ncr_monto) || 0;
        const obs = (observacion || '').trim();
        const doc = documento.trim();

        let cPago = "";
        let pagoTotal = 0;
        let cuponesMonto = 0;
        let finalObs = obs;

        if (metodoPago === 'TRANSFERENCIA') {
            // === LÓGICA DE TRANSFERENCIA BANCARIA (frm_descarga_pedido2.vb) ===
            const numCta = (numero_cuenta || '').trim();
            const refDoc = (referencia || '').trim().slice(0, 10);
            const montoTransfer = parseFloat(monto) || 0;

            if (!numCta) {
                await conn.rollback();
                return res.status(400).json({ error: 'Falta Cuenta Bancaria.' });
            }
            if (!refDoc) {
                await conn.rollback();
                return res.status(400).json({ error: 'Falta Num. Referencia de la transferencia.' });
            }
            if (montoTransfer <= 0) {
                await conn.rollback();
                return res.status(400).json({ error: 'Monto Incorrecto.' });
            }

            // Validar que la transferencia no esté repetida en movimientos_bancarios
            const [dup] = await conn.query(
                `SELECT COUNT(*) AS total FROM movimientos_bancarios WHERE numero_cuenta = ? AND documento = ? AND centro_costo != ?`,
                [numCta, refDoc, id]
            );
            if (dup[0]?.total > 0) {
                await conn.rollback();
                return res.status(400).json({ error: 'Transferencia Repetida. Ya existe un movimiento bancario con esa cuenta y referencia.' });
            }

            // Obtener id_empresa de la cuenta bancaria
            const [ctaRows] = await conn.query(
                `SELECT id_empresa FROM cuentas_bancarias WHERE numero = ? LIMIT 1`,
                [numCta]
            );
            const cIdEmpresa = ctaRows[0]?.id_empresa || 'E-1';

            // Generar llave correlativa atómica para movimientos_bancarios (MVB...)
            const [corrRows] = await conn.query(
                `SELECT COALESCE(MAX(CAST(SUBSTRING(llave, 4) AS UNSIGNED)), 0) + 1 AS next_corr
                 FROM movimientos_bancarios WHERE llave LIKE 'MVB%' FOR UPDATE`
            );
            const nextCorr = corrRows[0]?.next_corr || 1;
            const cLlave = 'MVB' + String(nextCorr).padStart(17, '0');

            // Formatear fecha de pago bancario a DD/MM/YYYY
            let formattedFechaPago = (fecha_pago || fecha_descarga || '').trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(formattedFechaPago)) {
                const [y, m, d] = formattedFechaPago.split('-');
                formattedFechaPago = `${d}/${m}/${y}`;
            }

            const cConcepto = (concepto || '').trim() || `PAGO DE PIPA CCF# ${doc}`;

            // Eliminar movimiento bancario anterior de este pedido si existía
            await conn.query(`DELETE FROM movimientos_bancarios WHERE centro_costo = ?`, [id]);

            // Insertar en movimientos_bancarios
            await conn.query(
                `INSERT INTO movimientos_bancarios (
                    id_empresa, llave, cod_remesa, documento, numero_cuenta, concepto,
                    cargo, abono, fecha_aplicado, fecha, monto, es_contabilizado,
                    cod_destino, tipo_destino, id_rubro, num_partida, centro_costo
                 ) VALUES (
                    ?, ?, '02', ?, ?, ?,
                    0.0, ?, ?, ?, ?, 'N',
                    '', '', '', '', ?
                 )`,
                [
                    cIdEmpresa,
                    cLlave,
                    refDoc,
                    numCta,
                    cConcepto,
                    montoTransfer,
                    formattedFechaPago,
                    formattedFechaPago,
                    montoTransfer,
                    id
                ]
            );

            // Liberar cheques de vouchers que hayan estado asignados previamente a este pedido
            await conn.query(
                `UPDATE vouchers SET
                    es_reservado = 1,
                    concepto = '***** CHEQUE NO EMITIDO *****',
                    valor = 0.0,
                    fecha = ''
                 WHERE id_origen = ?`,
                [id]
            );

            // Construir observación automática si no fue personalizada
            const ctaLast4 = numCta.length >= 4 ? numCta.slice(-4) : numCta;
            const montoFmt = montoTransfer.toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const autoObs = `${(order.forma_pago || '').trim()}**TRANSF. #${ctaLast4} - $${montoFmt}**`;
            finalObs = obs || autoObs;
            cPago = finalObs;
            pagoTotal = montoTransfer;
            cuponesMonto = 0;
        } else {
            // === LÓGICA DE CHEQUES Y CUPONES (frm_descarga_pedido.vb) ===
            cuponesMonto = parseFloat(cupones) || 0;
            const originalFormaPago = (order.forma_pago || '').trim();
            if (originalFormaPago === "CREDITO") {
                cPago = cheques.length > 0 ? "(CRD) PAGO: " : originalFormaPago;
            } else {
                cPago = originalFormaPago;
            }

            // Liberar vouchers anteriores del pedido
            await conn.query(
                `UPDATE vouchers SET
                    es_reservado = 1,
                    concepto = '***** CHEQUE NO EMITIDO *****',
                    valor = 0.0,
                    fecha = ''
                 WHERE id_origen = ?`,
                [id]
            );

            // Eliminar movimientos_bancarios si antes se había recibido por transferencia
            await conn.query(`DELETE FROM movimientos_bancarios WHERE centro_costo = ?`, [id]);

            let totalCheques = 0;
            for (const chq of cheques) {
                const numCta = (chq.numero_cuenta || '').trim();
                const numCheque = String(chq.cheque || '').trim();
                const valor = parseFloat(chq.valor) || 0;
                const cConcepto = (chq.concepto || '').trim() || `PAGO DE PIPA CCF# ${doc}`;

                if (!numCta || !numCheque || valor <= 0) continue;

                totalCheques += valor;

                await conn.query(
                    `UPDATE vouchers SET
                        es_reservado = 0,
                        concepto = ?,
                        valor = ?,
                        fecha = ?,
                        id_origen = ?
                     WHERE numero_cuenta = ? AND cheque = ?`,
                    [cConcepto, valor, formattedFechaDescarga, id, numCta, numCheque]
                );

                const ctaLast4 = numCta.length >= 4 ? numCta.slice(-4) : numCta;
                const valorFmt = valor.toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                cPago += `#${ctaLast4}CH#${numCheque}(${valorFmt})-`;
            }

            pagoTotal = totalCheques + cuponesMonto + ncrMonto;
            finalObs = obs;
        }

        // 3. Actualizar web_pedidos con descarga, costos capturados y flete
        await conn.query(
            `UPDATE web_pedidos SET
                documento = ?,
                observacion = ?,
                r_diesel = ?,
                r_regular = ?,
                r_super = ?,
                r_ion = ?,
                costo_d = ?,
                costo_r = ?,
                costo_s = ?,
                costo_i = ?,
                flete = ?,
                estado = 'RECIBIDO',
                fecha_descarga = ?,
                forma_pago = ?,
                cupones = ?,
                pago = ?,
                ncr_numero = ?,
                ncr_monto = ?
             WHERE id = ? AND id_estacion = ?`,
            [
                doc,
                finalObs,
                rDiesel,
                rRegular,
                rSuper,
                rIon,
                costoD,
                costoR,
                costoS,
                costoI,
                flete,
                formattedFechaDescarga,
                cPago,
                cuponesMonto,
                pagoTotal,
                ncrNumero,
                ncrMonto,
                id,
                rrsIdEmpresa
            ]
        );

        // 4. Actualizar combustibles_costos (costo = costo_producto + flete)
        await conn.query(`DELETE FROM combustibles_costos WHERE id_origen = ?`, [id]);

        let orderDate = '';
        if (order.fecha) {
            try {
                orderDate = new Date(order.fecha).toISOString().slice(0, 10);
            } catch (e) {
                orderDate = new Date().toISOString().slice(0, 10);
            }
        } else {
            orderDate = new Date().toISOString().slice(0, 10);
        }

        if (parseFloat(order.p_diesel) > 0 && costoD > 0) {
            const costo = costoD + flete;
            await conn.query(
                `INSERT INTO combustibles_costos (id_empresa, cod_producto, costo, fecha, pedido, id_origen)
                 VALUES (?, 'DIESEL', ?, ?, ?, ?)`,
                [order.id_estacion, costo, orderDate, order.numero, id]
            );
        }
        if (parseFloat(order.p_regular) > 0 && costoR > 0) {
            const costo = costoR + flete;
            await conn.query(
                `INSERT INTO combustibles_costos (id_empresa, cod_producto, costo, fecha, pedido, id_origen)
                 VALUES (?, 'REGULAR', ?, ?, ?, ?)`,
                [order.id_estacion, costo, orderDate, order.numero, id]
            );
        }
        if (parseFloat(order.p_super) > 0 && costoS > 0) {
            const costo = costoS + flete;
            await conn.query(
                `INSERT INTO combustibles_costos (id_empresa, cod_producto, costo, fecha, pedido, id_origen)
                 VALUES (?, 'SUPER', ?, ?, ?, ?)`,
                [order.id_estacion, costo, orderDate, order.numero, id]
            );
        }
        if (parseFloat(order.p_ion) > 0 && costoI > 0) {
            const costo = costoI + flete;
            await conn.query(
                `INSERT INTO combustibles_costos (id_empresa, cod_producto, costo, fecha, pedido, id_origen)
                 VALUES (?, 'IONDIESEL', ?, ?, ?, ?)`,
                [order.id_estacion, costo, orderDate, order.numero, id]
            );
        }

        await conn.commit();

        res.json({
            success: true,
            message: `Pedido #${order.numero || id} recibido exitosamente mediante ${metodoPago === 'TRANSFERENCIA' ? 'Transferencia Bancaria' : 'Cheque'}.`,
            data: {
                id,
                estado: 'RECIBIDO',
                metodo_pago: metodoPago,
                fecha_descarga: formattedFechaDescarga,
                documento: doc,
                observacion: finalObs,
                ncr_numero: ncrNumero,
                ncr_monto: ncrMonto,
                cupones: cuponesMonto,
                pago: pagoTotal,
                forma_pago: cPago,
                r_diesel: rDiesel,
                r_regular: rRegular,
                r_super: rSuper,
                r_ion: rIon,
                costo_d: costoD,
                costo_r: costoR,
                costo_s: costoS,
                costo_i: costoI,
                flete: flete
            }
        });
    } catch (error) {
        if (conn) {
            try { await conn.rollback(); } catch (e) { /* ignore */ }
        }
        console.error('Error in receiveOrder:', error);
        res.status(500).json({ error: 'Error al recibir el pedido: ' + (error.message || 'Error desconocido') });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};
