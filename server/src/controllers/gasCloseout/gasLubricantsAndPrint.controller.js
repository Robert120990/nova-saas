const {
    pool,
    sendCloseoutToRrs,
    dteService,
    notificationService,
    dteValidoExistsSql,
    applyCloseoutLubricantsInventory,
    revertCloseoutLubricantsInventory,
    CLOSEOUT_SECTIONS,
    SECTION_BUSINESS_FIELDS,
    NUMERIC_FIELDS,
    formatItemLabel,
    getNaturalKey,
    enrichSectionRows,
    getSectionRows,
    fieldChanges,
    buildSectionDiff,
    summarizeDiff,
    logCloseoutChange,
    logSectionChange,
    toDateStr,
    recalcularTanquesPosteriores,
    recalcularLubricantesPosteriores,
    logDeleteRow
} = require('./gasCloseoutUtils');


// --- LECTURAS Y CONTROL DE LUBRICANTES ---
exports.getLubricantReadings = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT * FROM gas_station_closeout_lubricant_readings WHERE closeout_id = ? ORDER BY id ASC`,
            [id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error getLubricantReadings:', error);
        res.status(500).json({ message: 'Error al obtener lecturas de lubricantes' });
    }
};

exports.saveLubricantReadings = async (req, res) => {
    try {
        const { id } = req.params;
        const { readings } = req.body;

        const [closeouts] = await pool.query(
            `SELECT id, estado, branch_id, fecha_turno, numero_turno FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'lubricantes');

        await pool.query(`DELETE FROM gas_station_closeout_lubricant_readings WHERE closeout_id = ?`, [id]);

        if (readings && readings.length > 0) {
            const values = readings.map(r => [
                parseInt(id),
                r.producto_id || null,
                r.producto_codigo || '',
                r.producto_descripcion || '',
                parseFloat(r.lectura_inicial) || 0,
                parseFloat(r.recarga) || 0,
                parseFloat(r.lectura_final) || 0,
                parseFloat(r.ventas) || 0,
                parseFloat(r.precio) || 0,
                parseFloat(r.total) || 0
            ]);
            await pool.query(
                `INSERT INTO gas_station_closeout_lubricant_readings 
                 (closeout_id, producto_id, producto_codigo, producto_descripcion, lectura_inicial, recarga, lectura_final, ventas, precio, total) VALUES ?`,
                [values]
            );
        }

        const [remaining] = await pool.query(
            `SELECT * FROM gas_station_closeout_lubricant_readings WHERE closeout_id = ? ORDER BY id ASC`,
            [id]
        );

        if (isReabierto) {
            await logSectionChange(req, id, 'lubricantes', beforeRows, readings);
        }

        await recalcularLubricantesPosteriores(req, closeouts[0], readings || []);

        res.json(remaining);
    } catch (error) {
        console.error('Error saveLubricantReadings:', error);
        res.status(500).json({ message: 'Error al guardar lecturas de lubricantes' });
    }
};


// --- DATOS DE IMPRESIÓN Y RESUMEN DE TURNO ---
exports.getCloseoutPrintData = async (req, res) => {
    try {
        const { id } = req.params;

        const [closeouts] = await pool.query(`
            SELECT co.*, c.razon_social as company_name, c.nit as company_nit,
                   c.nombre_comercial as company_commercial_name,
                   b.nombre as branch_name, b.direccion as branch_address,
                   b.telefono as branch_phone
            FROM gas_station_closeouts co
            JOIN companies c ON c.id = co.company_id
            JOIN branches b ON b.id = co.branch_id
            WHERE co.id = ? AND co.company_id = ?
        `, [id, req.company_id]);

        if (closeouts.length === 0) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const [readings] = await pool.query(
            `SELECT r.*, p.tipo_combustible
             FROM gas_station_closeout_readings r
             JOIN products p ON r.product_id = p.id
             WHERE r.closeout_id = ? ORDER BY r.codigo_pistola ASC`, [id]
        );

        let tankReadings = [];
        try {
            [tankReadings] = await pool.query(`
                SELECT tr.*, t.capacidad, t.tipo_combustible
                FROM gas_station_closeout_tank_readings tr
                JOIN gas_station_tanks t ON tr.tank_id = t.id
                WHERE tr.closeout_id = ?
                ORDER BY tr.codigo_tanque ASC
            `, [id]);
        } catch (e) { /* table may not exist */ }

        const [despachadores] = await pool.query(
            `SELECT cd.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
             FROM gas_station_closeout_despachadores cd
             JOIN gas_station_despachadores d ON d.id = cd.despachador_id
             WHERE cd.closeout_id = ?`, [id]
        );

        const [gastos] = await pool.query(
            `SELECT e.*, p.nombre as proveedor_nombre FROM gas_station_closeout_expenses e
             LEFT JOIN providers p ON e.provider_id = p.id
             WHERE e.closeout_id = ? ORDER BY e.id ASC`, [id]
        );

        const [remesas] = await pool.query(
            `SELECT * FROM gas_station_closeout_remesas WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [cupones] = await pool.query(
            `SELECT * FROM gas_station_closeout_cupones WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [descuentos] = await pool.query(
            `SELECT * FROM gas_station_closeout_descuentos WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [adelantos] = await pool.query(
            `SELECT * FROM gas_station_closeout_adelantos WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [lubricantes] = await pool.query(
            `SELECT * FROM gas_station_closeout_lubricant_readings WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [tarjetas] = await pool.query(
            `SELECT * FROM gas_station_closeout_tarjetas WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [creditos] = await pool.query(
            `SELECT * FROM gas_station_closeout_creditos WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [vales] = await pool.query(
            `SELECT * FROM gas_station_closeout_vales WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [anticiposDesp] = await pool.query(
            `SELECT ad.*,
                    COALESCE(ga.total_disponible, 0) AS saldo_disponible
             FROM gas_station_closeout_anticipos_despachados ad
             LEFT JOIN (
                 SELECT cliente_id, COALESCE(SUM(monto_disponible), 0) AS total_disponible
                 FROM gas_station_advances
                 WHERE company_id = ? AND monto_disponible > 0
                 GROUP BY cliente_id
             ) ga ON ga.cliente_id = ad.cliente_id
             WHERE ad.closeout_id = ?
             ORDER BY ad.id ASC`, [req.company_id, id]
        );

        const [trupputDesp] = await pool.query(
            `SELECT td.*,
                    COALESCE(gt.total_galones, 0) AS galones_disponibles
             FROM gas_station_closeout_trupput_despachos td
             LEFT JOIN (
                 SELECT cliente_id, COALESCE(SUM(galones_disponibles), 0) AS total_galones
                 FROM gas_station_trupput
                 WHERE company_id = ? AND galones_disponibles > 0
                 GROUP BY cliente_id
             ) gt ON gt.cliente_id = td.cliente_id
             WHERE td.closeout_id = ?
             ORDER BY td.id ASC`, [req.company_id, id]
        );

        const [nozzleAssignments] = await pool.query(
            `SELECT * FROM gas_station_closeout_despachador_nozzles WHERE closeout_id = ?`, [id]
        );

        res.json({
            closeout: closeouts[0],
            readings,
            tankReadings,
            despachadores,
            despachadorNozzleAssignments: nozzleAssignments,
            gastos: gastos.map(e => ({ ...e, proveedor: e.proveedor_nombre || e.proveedor })),
            remesas,
            cupones,
            descuentos,
            adelantos,
            lubricantes,
            tarjetas,
            creditos,
            vales,
            anticiposDesp,
            trupputDesp
        });
    } catch (error) {
        console.error('Error getCloseoutPrintData:', error);
        res.status(500).json({ message: 'Error al obtener datos de impresión' });
    }
};


// --- INTEGRACIÓN RRS ---
exports.sendToRrs = async (req, res) => {
    try {
        const { id } = req.params;

        const [closeouts] = await pool.query(
            `SELECT * FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }
        if (closeouts[0].estado !== 'cerrado') {
            return res.status(400).json({ message: 'El cierre debe estar cerrado para enviarlo a RRS' });
        }

        await sendCloseoutToRrs(id, req.company_id);

        await pool.query(
            `UPDATE gas_station_closeouts SET rrs_enviado_at = NOW() WHERE id = ?`,
            [id]
        );

        res.json({ message: 'Cierre enviado a RRS exitosamente' });
    } catch (error) {
        console.error('Error sendToRrs:', error);
        res.status(500).json({ message: error.message || 'Error al enviar cierre a RRS' });
    }
};


// --- COMPARACIÓN DE VENTAS Y FACTURAS COMPLEMENTARIAS ---
exports.getVentasComparacion = async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.company_id;

        const [closeouts] = await pool.query(
            `SELECT c.fecha_turno, c.numero_turno, c.branch_id
             FROM gas_station_closeouts c WHERE c.id = ? AND c.company_id = ?`,
            [id, company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });

        const { fecha_turno, numero_turno, branch_id } = closeouts[0];

        const turnoNum = parseInt(numero_turno, 10) || 0;

        const shiftId = parseInt(req.query.shift_id, 10);
        if (!shiftId) return res.status(400).json({ message: 'Debe seleccionar un turno para consultar las ventas' });

        const [posShift] = await pool.query(
            `SELECT id FROM pos_shifts
             WHERE id = ? AND company_id = ? AND branch_id = ?
             LIMIT 1`,
            [shiftId, company_id, branch_id]
        );
        if (posShift.length === 0) {
            return res.status(400).json({ message: 'El turno seleccionado no existe o no pertenece a la sucursal del cierre' });
        }

        const [rows] = await pool.query(`
            SELECT 
                p.codigo AS codigo_producto,
                p.nombre AS descripcion_producto,
                COALESCE(l.precio, v.precio, 0) AS precio,
                COALESCE(l.lectura_galones, 0) AS lectura_galones,
                COALESCE(l.lectura_monto, 0) AS lectura_monto,
                COALESCE(v.venta_galones, 0) AS venta_galones,
                COALESCE(v.venta_monto, 0) AS venta_monto,
                COALESCE(l.lectura_galones, 0) - COALESCE(v.venta_galones, 0) AS diferencia_galones,
                (COALESCE(l.lectura_galones, 0) - COALESCE(v.venta_galones, 0)) * COALESCE(l.precio, v.precio, 0) AS diferencia_monto
            FROM products p
            LEFT JOIN (
                SELECT 
                    r.product_id,
                    AVG(r.precio) AS precio,
                    SUM(COALESCE(r.lectura_actual, 0) - COALESCE(r.lectura_anterior, 0) - COALESCE(r.calibracion, 0)) AS lectura_galones,
                    ROUND(SUM((COALESCE(r.lectura_actual, 0) - COALESCE(r.lectura_anterior, 0) - COALESCE(r.calibracion, 0)) * r.precio), 2) AS lectura_monto
                FROM gas_station_closeout_readings r
                JOIN gas_station_closeouts c ON r.closeout_id = c.id
                WHERE c.company_id = ? AND c.fecha_turno = ? AND c.branch_id = ?
                  AND (? = 0 OR c.numero_turno = ?)
                GROUP BY r.product_id
            ) l ON p.id = l.product_id
            LEFT JOIN (
                SELECT 
                    si.product_id,
                    AVG(si.precio_unitario) AS precio,
                    SUM(si.cantidad) AS venta_galones,
                    ROUND(SUM(si.cantidad * si.precio_unitario), 2) AS venta_monto
                FROM sales_items si
                JOIN sales_headers sh ON si.sale_id = sh.id
                WHERE sh.company_id = ? AND DATE(sh.created_at) = ? AND sh.branch_id = ?
                  AND sh.estado != 'anulado'
                  AND ${dteValidoExistsSql('sh')}
                  AND sh.shift_id = ?
                GROUP BY si.product_id
            ) v ON p.id = v.product_id
            WHERE p.company_id = ? AND p.tipo_combustible > 0 AND p.status = 'activo'
            ORDER BY p.codigo
        `, [
            company_id, fecha_turno, branch_id, turnoNum, turnoNum,
            company_id, fecha_turno, branch_id, shiftId,
            company_id
        ]);

        const totales = {
            lectura_galones: 0, lectura_monto: 0,
            venta_galones: 0, venta_monto: 0,
            diferencia_galones: 0, diferencia_monto: 0,
        };

        for (const row of rows) {
            totales.lectura_galones += parseFloat(row.lectura_galones) || 0;
            totales.lectura_monto += parseFloat(row.lectura_monto) || 0;
            totales.venta_galones += parseFloat(row.venta_galones) || 0;
            totales.venta_monto += parseFloat(row.venta_monto) || 0;
            totales.diferencia_galones += parseFloat(row.diferencia_galones) || 0;
            totales.diferencia_monto += parseFloat(row.diferencia_monto) || 0;
        }

        res.json({ data: rows, totales, fecha: fecha_turno, turno: numero_turno, shiftMatch: true, matchedShiftId: shiftId, branch_id });
    } catch (error) {
        console.error('Error getVentasComparacion:', error);
        res.status(500).json({ message: 'Error al obtener comparacion de ventas' });
    }
};

exports.generarComplementaria = async (req, res) => {
    const { id } = req.params;
    const company_id = req.company_id;

    try {
        const [closeouts] = await pool.query(
            `SELECT c.fecha_turno, c.numero_turno, c.branch_id
             FROM gas_station_closeouts c WHERE c.id = ? AND c.company_id = ?`,
            [id, company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });

        const { fecha_turno, numero_turno, branch_id } = closeouts[0];
        const turnoNum = parseInt(numero_turno, 10) || 0;

        const { shift_id } = req.body || {};

        if (!shift_id) {
            return res.status(400).json({ message: 'Debe seleccionar el turno destino para generar la complementaria' });
        }

        const [posShiftRows] = await pool.query(
            `SELECT id, seller_id, pos_id, branch_id, status FROM pos_shifts
             WHERE id = ? AND company_id = ?`,
            [Number(shift_id), company_id]
        );
        if (posShiftRows.length === 0) {
            return res.status(400).json({ message: 'El turno destino no existe o no pertenece a esta empresa' });
        }
        if (Number(posShiftRows[0].branch_id) !== Number(branch_id)) {
            return res.status(400).json({ message: 'El turno destino no pertenece a la sucursal del cierre' });
        }
        const posShift = posShiftRows;

        let codPuntoVentaMH = null;
        if (posShift[0].pos_id) {
            const [pos] = await pool.query('SELECT codigo FROM points_of_sale WHERE id = ?', [posShift[0].pos_id]);
            if (pos.length > 0) codPuntoVentaMH = pos[0].codigo;
        }

        const [rows] = await pool.query(`
            SELECT 
                p.id AS product_id,
                p.codigo AS codigo_producto,
                p.nombre AS descripcion_producto,
                COALESCE(l.precio, v.precio, 0) AS precio,
                COALESCE(l.lectura_galones, 0) - COALESCE(v.venta_galones, 0) AS diferencia_galones,
                (COALESCE(l.lectura_galones, 0) - COALESCE(v.venta_galones, 0)) * COALESCE(l.precio, v.precio, 0) AS diferencia_monto
            FROM products p
            LEFT JOIN (
                SELECT r.product_id, AVG(r.precio) AS precio,
                    SUM(COALESCE(r.lectura_actual, 0) - COALESCE(r.lectura_anterior, 0) - COALESCE(r.calibracion, 0)) AS lectura_galones,
                    ROUND(SUM((COALESCE(r.lectura_actual, 0) - COALESCE(r.lectura_anterior, 0) - COALESCE(r.calibracion, 0)) * r.precio), 2) AS lectura_monto
                FROM gas_station_closeout_readings r
                JOIN gas_station_closeouts c ON r.closeout_id = c.id
                WHERE c.company_id = ? AND c.fecha_turno = ? AND c.branch_id = ? AND (? = 0 OR c.numero_turno = ?)
                GROUP BY r.product_id
            ) l ON p.id = l.product_id
            LEFT JOIN (
                SELECT si.product_id, AVG(si.precio_unitario) AS precio,
                    SUM(si.cantidad) AS venta_galones,
                    ROUND(SUM(si.cantidad * si.precio_unitario), 2) AS venta_monto
                FROM sales_items si
                JOIN sales_headers sh ON si.sale_id = sh.id
                WHERE sh.company_id = ? AND DATE(sh.created_at) = ? AND sh.branch_id = ?
                  AND sh.estado != 'anulado'
                  AND ${dteValidoExistsSql('sh')}
                  AND sh.shift_id = ?
                GROUP BY si.product_id
            ) v ON p.id = v.product_id
            WHERE p.company_id = ? AND p.tipo_combustible > 0 AND p.status = 'activo'
            HAVING diferencia_galones > 0
            ORDER BY p.codigo
        `, [
            company_id, fecha_turno, branch_id, turnoNum, turnoNum,
            company_id, fecha_turno, branch_id, posShift[0].id,
            company_id
        ]);

        if (rows.length === 0) {
            return res.status(400).json({ message: 'No hay diferencias positivas para generar complementaria' });
        }

        const [companyRows] = await pool.query(
            `SELECT c.id, c.razon_social, c.nit, c.dte_active, c.ambiente,
                    cat.description AS actividad_economica,
                    c.departamento, c.municipio, c.direccion, c.telefono, c.correo
             FROM companies c
             LEFT JOIN cat_019_actividad_economica cat ON c.codigo_actividad = cat.code
             WHERE c.id = ?`,
            [company_id]
        );
        if (companyRows.length === 0) return res.status(404).json({ message: 'Empresa no encontrada' });
        const company = companyRows[0];

        const [taxCfg] = await pool.query(
            'SELECT fovial_rate, cotrans_rate FROM tax_configurations WHERE company_id = ?',
            [company_id]
        );
        const tasaFovial = taxCfg.length > 0 ? parseFloat(taxCfg[0].fovial_rate) : 0.20;
        const tasaCotran = taxCfg.length > 0 ? parseFloat(taxCfg[0].cotrans_rate) : 0.10;

        const resultados = [];

        for (const r of rows) {
            const cantidad = parseFloat((parseFloat(r.diferencia_galones) || 0).toFixed(5));
            const precio = parseFloat(r.precio) || 0;
            const montoBruto = cantidad * precio;
            if (montoBruto <= 0) continue;

            const fovial = Math.round(cantidad * tasaFovial * 100) / 100;
            const cotrans = Math.round(cantidad * tasaCotran * 100) / 100;
            const ventaGravada = Math.round((montoBruto - fovial - cotrans) * 100) / 100;
            const ivaComplementaria = Math.round((ventaGravada * 13) / 113 * 100) / 100;
            const gravadoNeto = Math.round((ventaGravada - ivaComplementaria) * 100) / 100;
            const montoTotal = Math.round((ventaGravada + fovial + cotrans) * 100) / 100;

            const obsComplementaria = `Complementaria turno ${fecha_turno} #${turnoNum} - ${r.descripcion_producto}`;

            // Guardia de idempotencia: si ya existe una complementaria ACEPTADA para este cierre/turno/producto, no duplicar
            const [existingDte] = await pool.query(`
                SELECT sh.id, sh.codigo_generacion, sh.numero_control
                FROM sales_headers sh
                JOIN dtes d ON (d.venta_id = sh.id OR (sh.codigo_generacion IS NOT NULL AND d.codigo_generacion = sh.codigo_generacion))
                WHERE sh.company_id = ?
                  AND sh.branch_id = ?
                  AND sh.observaciones = ?
                  AND d.status = 'ACCEPTED'
                LIMIT 1
            `, [company_id, branch_id, obsComplementaria]);

            if (existingDte.length > 0) {
                resultados.push({
                    producto: r.descripcion_producto,
                    success: true,
                    already_emitted: true,
                    codigo_generacion: existingDte[0].codigo_generacion,
                    numero_control: existingDte[0].numero_control,
                    total: montoTotal,
                    sale_id: existingDte[0].id
                });
                continue;
            }

            const item = {
                product_id: r.product_id,
                codigo: r.codigo_producto,
                descripcion: r.descripcion_producto,
                cantidad,
                precio_unitario: precio,
                monto_descuento: 0,
                ventaNoSujeta: 0,
                ventaExenta: 0,
                ventaGravada,
                tributos: [
                    { codigo: 'D1', descripcion: 'FOVIAL', valor: fovial },
                    { codigo: 'C8', descripcion: 'COTRANS', valor: cotrans },
                    "20"
                ],
                noGravado: 0,
                ivaItem: 0,
                tipoItem: 1
            };

            const payload = {
                header: {
                    dte_type: '01',
                    customer_id: null,
                    cliente_nombre: 'CONSUMIDOR FINAL',
                    customer_name: 'CONSUMIDOR FINAL',
                    customer_nit: null,
                    customer_nrc: '',
                    customer_dui: '',
                    customer_direccion: company.direccion,
                    customer_telefono: company.telefono,
                    customer_correo: company.correo,
                    branch_id,
                    user_id: req.user?.id,
                    payment_type: 'CONT',
                    fovial,
                    cotrans,
                    taxes: [],
                    total_gravado: gravadoNeto,
                    total_iva: ivaComplementaria,
                    total_pagar: montoTotal,
                    shift_id: posShift[0].id,
                    seller_id: posShift[0].seller_id || null,
                },
                items: [item],
                payments: [{ codigo: '01', monto: montoTotal, referencia: null, plazo: null, periodo: null }],
                linkedDocuments: [],
                emisor_adicional: {
                    descActividad: company.actividad_economica || '',
                    codPuntoVentaMH: codPuntoVentaMH
                }
            };

            const [saleResult] = await pool.query('INSERT INTO sales_headers SET ?', [{
                company_id,
                branch_id,
                customer_id: null,
                seller_id: payload.header.seller_id,
                shift_id: posShift[0].id,
                pos_id: posShift[0].pos_id,
                dte_type: '01',
                tipo_documento: '01',
                condicion_operacion: 1,
                fecha_emision: new Date(),
                hora_emision: new Date().toTimeString().split(' ')[0],
                estado: 'borrador',
                total_gravado: gravadoNeto,
                total_exento: 0,
                total_nosujetas: 0,
                fovial,
                cotrans,
                total_iva: ivaComplementaria,
                descuento_general: 0,
                iva_percibido: 0,
                iva_retenido: 0,
                total_pagar: montoTotal,
                payment_condition: 1,
                cliente_nombre: 'CONSUMIDOR FINAL',
                observaciones: obsComplementaria,
                created_at: new Date()
            }]);
            const saleId = saleResult.insertId;

            await pool.query('INSERT INTO sales_items SET ?', [{
                sale_id: saleId,
                product_id: item.product_id,
                codigo: item.codigo,
                descripcion: item.descripcion,
                cantidad: item.cantidad,
                precio_unitario: item.precio_unitario,
                monto_descuento: 0,
                venta_gravada: ventaGravada,
                venta_exenta: 0,
                tributos: JSON.stringify(item.tributos || [])
            }]);

            await pool.query('INSERT INTO sales_payments SET ?', [{
                sale_id: saleId,
                metodo_pago: '01',
                monto: montoTotal,
                referencia: ''
            }]);

            try {
                const dteResult = await dteService.emitDTE(company, payload, saleId);

                if (dteResult.success) {
                    await pool.query(
                        `UPDATE sales_headers SET
                         estado = 'emitido', numero_control = ?, codigo_generacion = ?, sello_recepcion = ?, fh_procesamiento = ?
                         WHERE id = ?`,
                        [dteResult.data.numero_control, dteResult.data.codigo_generacion,
                         dteResult.data.sello_recepcion, dteResult.data.fh_procesamiento, saleId]
                    );
                    resultados.push({
                        producto: r.descripcion_producto,
                        success: true,
                        codigo_generacion: dteResult.data.codigo_generacion,
                        numero_control: dteResult.data.numero_control,
                        total: montoTotal,
                        sale_id: saleId
                    });
                } else if (dteResult.codigo_generacion) {
                    await pool.query(
                        `UPDATE sales_headers SET estado = 'emitido', codigo_generacion = ?, numero_control = ? WHERE id = ?`,
                        [dteResult.codigo_generacion, dteResult.numero_control || null, saleId]
                    );
                    resultados.push({
                        producto: r.descripcion_producto,
                        success: false,
                        partial: true,
                        codigo_generacion: dteResult.codigo_generacion,
                        sale_id: saleId,
                        error: dteResult.error
                    });
                } else {
                    // Limpieza automática si la emisión falló por completo: no dejar venta huérfana en estado pendiente
                    await pool.query('DELETE FROM sales_payments WHERE sale_id = ?', [saleId]);
                    await pool.query('DELETE FROM sales_items WHERE sale_id = ?', [saleId]);
                    await pool.query('DELETE FROM sales_headers WHERE id = ?', [saleId]);

                    resultados.push({
                        producto: r.descripcion_producto,
                        success: false,
                        sale_id: null,
                        error: dteResult.error || 'Error al emitir DTE'
                    });
                }
            } catch (err) {
                // Limpieza automática ante excepción no controlada
                try {
                    await pool.query('DELETE FROM sales_payments WHERE sale_id = ?', [saleId]);
                    await pool.query('DELETE FROM sales_items WHERE sale_id = ?', [saleId]);
                    await pool.query('DELETE FROM sales_headers WHERE id = ?', [saleId]);
                } catch (cleanupErr) {
                    console.error('Error limpiando venta borrador tras excepción:', cleanupErr);
                }

                resultados.push({
                    producto: r.descripcion_producto,
                    success: false,
                    sale_id: null,
                    error: err.message
                });
            }
        }

        const exitosos = resultados.filter(r => r.success).length;
        const fallidos = resultados.filter(r => !r.success).length;

        if (resultados.length === 0) {
            return res.status(400).json({ message: 'No se generó ninguna complementaria' });
        }

        res.json({
            message: `Complementarias generadas: ${exitosos} exitosas, ${fallidos} fallidas`,
            resultados,
            total_exitosos: exitosos,
            total_fallidos: fallidos
        });
    } catch (error) {
        console.error('Error generarComplementaria:', error);
        res.status(500).json({ message: error.message || 'Error al generar complementaria' });
    }
};

// === Accumulated Daily Closeout Print Data ===


// --- DATOS DE IMPRESIÓN ACUMULADA DEL DÍA ---
exports.getAccumulatedDayPrintData = async (req, res) => {
    try {
        const { fecha, branch_id } = req.query;

        if (!fecha || !branch_id) {
            return res.status(400).json({ message: 'fecha y branch_id son requeridos' });
        }

        const [closeouts] = await pool.query(`
            SELECT co.*, c.razon_social as company_name, c.nit as company_nit,
                   c.nombre_comercial as company_commercial_name,
                   b.nombre as branch_name, b.direccion as branch_address,
                   b.telefono as branch_phone
            FROM gas_station_closeouts co
            JOIN companies c ON c.id = co.company_id
            JOIN branches b ON b.id = co.branch_id
            WHERE co.fecha_turno = ? AND co.branch_id = ? AND co.company_id = ?
            ORDER BY co.numero_turno ASC
        `, [fecha, branch_id, req.company_id]);

        if (closeouts.length === 0) {
            return res.status(404).json({ message: 'No hay cierres para esta fecha y sucursal' });
        }

        const base = closeouts[0];
        const closeoutIds = closeouts.map(c => c.id);

        // Build synthetic accumulated closeout
        const accumulated = {
            ...base,
            id: null,
            numero_turno: 'ACUMULADO',
            total_venta: 0,
            total_venta_efectivo: 0,
            total_venta_tarjeta: 0,
            total_venta_credito: 0,
            total_venta_vale: 0,
            total_venta_anticipos: 0,
            total_venta_diesel: 0,
            total_venta_regular: 0,
            total_venta_premium: 0,
            total_efectivo: 0,
            total_ajuste_pos: 0,
            diferencia: 0,
            created_at: null,
            updated_at: null
        };

        for (const c of closeouts) {
            accumulated.total_venta += Number(c.total_venta || 0);
            accumulated.total_venta_efectivo += Number(c.total_venta_efectivo || 0);
            accumulated.total_venta_tarjeta += Number(c.total_venta_tarjeta || 0);
            accumulated.total_venta_credito += Number(c.total_venta_credito || 0);
            accumulated.total_venta_vale += Number(c.total_venta_vale || 0);
            accumulated.total_venta_anticipos += Number(c.total_venta_anticipos || 0);
            accumulated.total_venta_diesel += Number(c.total_venta_diesel || 0);
            accumulated.total_venta_regular += Number(c.total_venta_regular || 0);
            accumulated.total_venta_premium += Number(c.total_venta_premium || 0);
            accumulated.total_efectivo += Number(c.total_efectivo || 0);
            accumulated.total_ajuste_pos += Number(c.total_ajuste_pos || 0);
            accumulated.diferencia += Number(c.diferencia || 0);
        }

        // Aggregate readings across all closeouts
        const placeholders = closeoutIds.map(() => '?').join(',');
        const [allReadings] = await pool.query(`
            SELECT * FROM gas_station_closeout_readings
            WHERE closeout_id IN (${placeholders})
            ORDER BY codigo_pistola ASC, closeout_id ASC
        `, closeoutIds);

        const aggrReadings = {};
        for (const r of allReadings) {
            const key = r.nozzle_id;
            if (aggrReadings[key]) {
                aggrReadings[key].lectura_actual = Number(r.lectura_actual || 0);
                aggrReadings[key].calibracion += Number(r.calibracion || 0);
                aggrReadings[key].total_galones += Number(r.total_galones || 0);
                aggrReadings[key].total_venta += Number(r.total_venta || 0);
                aggrReadings[key].total_venta_efectivo += Number(r.total_venta_efectivo || 0);
                aggrReadings[key].total_venta_tarjeta += Number(r.total_venta_tarjeta || 0);
                aggrReadings[key].total_venta_credito += Number(r.total_venta_credito || 0);
                aggrReadings[key].total_venta_vale += Number(r.total_venta_vale || 0);
                aggrReadings[key].total_venta_anticipos += Number(r.total_venta_anticipos || 0);
            } else {
                aggrReadings[key] = {
                    ...r,
                    lectura_anterior: Number(r.lectura_anterior || 0),
                    lectura_actual: Number(r.lectura_actual || 0),
                    calibracion: Number(r.calibracion || 0),
                    total_galones: Number(r.total_galones || 0),
                    total_venta: Number(r.total_venta || 0),
                    total_venta_efectivo: Number(r.total_venta_efectivo || 0),
                    total_venta_tarjeta: Number(r.total_venta_tarjeta || 0),
                    total_venta_credito: Number(r.total_venta_credito || 0),
                    total_venta_vale: Number(r.total_venta_vale || 0),
                    total_venta_anticipos: Number(r.total_venta_anticipos || 0)
                };
            }
        }
        const readings = Object.values(aggrReadings);

        // Tank readings - get last for each tank
        let tankReadings = [];
        try {
            const [allTankReadings] = await pool.query(`
                SELECT tr.*, t.capacidad
                FROM gas_station_closeout_tank_readings tr
                JOIN gas_station_tanks t ON tr.tank_id = t.id
                WHERE tr.closeout_id IN (${placeholders})
                ORDER BY tr.codigo_tanque ASC, tr.closeout_id ASC
            `, closeoutIds);

            const aggrTank = {};
            for (const tr of allTankReadings) {
                if (aggrTank[tr.tank_id]) {
                    aggrTank[tr.tank_id].lectura_actual = tr.lectura_actual;
                    aggrTank[tr.tank_id].recarga = (parseFloat(aggrTank[tr.tank_id].recarga) || 0) + (parseFloat(tr.recarga) || 0);
                } else {
                    aggrTank[tr.tank_id] = {
                        ...tr,
                        lectura_anterior: tr.lectura_anterior,
                        lectura_actual: tr.lectura_actual,
                        recarga: tr.recarga
                    };
                }
            }
            tankReadings = Object.values(aggrTank);
        } catch (e) { /* table may not exist */ }

        // Despachadores - aggregate
        const [allDespachadores] = await pool.query(`
            SELECT cd.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
            FROM gas_station_closeout_despachadores cd
            JOIN gas_station_despachadores d ON d.id = cd.despachador_id
            WHERE cd.closeout_id IN (${placeholders})
        `, closeoutIds);

        const aggrDesp = {};
        for (const d of allDespachadores) {
            const key = d.despachador_id;
            if (aggrDesp[key]) {
                aggrDesp[key].total_venta += Number(d.total_venta || 0);
                aggrDesp[key].total_no_percibido += Number(d.total_no_percibido || 0);
                aggrDesp[key].total_entregado += Number(d.total_entregado || 0);
            } else {
                aggrDesp[key] = { ...d };
            }
        }
        const despachadores = Object.values(aggrDesp);

        const aggregateRows = async (table) => {
            const [rows] = await pool.query(
                `SELECT * FROM ${table} WHERE closeout_id IN (${placeholders}) ORDER BY id ASC`,
                closeoutIds
            );
            return rows;
        };

        const gastos = await aggregateRows('gas_station_closeout_expenses');
        const remesas = await aggregateRows('gas_station_closeout_remesas');
        const cupones = await aggregateRows('gas_station_closeout_cupones');
        const descuentos = await aggregateRows('gas_station_closeout_descuentos');
        const adelantos = await aggregateRows('gas_station_closeout_adelantos');
        const lubricantes = await aggregateRows('gas_station_closeout_lubricant_readings');
        const tarjetas = await aggregateRows('gas_station_closeout_tarjetas');
        const creditos = await aggregateRows('gas_station_closeout_creditos');
        const vales = await aggregateRows('gas_station_closeout_vales');
        let anticiposDesp = [];
        try {
            [anticiposDesp] = await pool.query(
                `SELECT * FROM gas_station_closeout_anticipos_despachados WHERE closeout_id IN (${placeholders}) ORDER BY id ASC`,
                closeoutIds
            );
        } catch (e) { /* table may not exist */ }

        let trupputDesp = [];
        try {
            [trupputDesp] = await pool.query(
                `SELECT * FROM gas_station_closeout_trupput_despachos WHERE closeout_id IN (${placeholders}) ORDER BY id ASC`,
                closeoutIds
            );
        } catch (e) { /* table may not exist */ }

        let nozzleAssignments = [];
        try {
            [nozzleAssignments] = await pool.query(
                `SELECT * FROM gas_station_closeout_despachador_nozzles WHERE closeout_id IN (${placeholders})`,
                closeoutIds
            );
        } catch (e) { /* table may not exist */ }

        res.json({
            closeout: accumulated,
            readings,
            tankReadings,
            despachadores,
            despachadorNozzleAssignments: nozzleAssignments,
            gastos: gastos.map(e => ({ ...e, proveedor: e.proveedor_nombre || e.proveedor })),
            remesas,
            cupones,
            descuentos,
            adelantos,
            lubricantes,
            tarjetas,
            creditos,
            vales,
            anticiposDesp,
            trupputDesp
        });
    } catch (error) {
        console.error('Error getAccumulatedDayPrintData:', error);
        res.status(500).json({ message: 'Error al obtener datos de cierre acumulado' });
    }
};

