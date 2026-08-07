const pool = require('../config/db');
const notificationService = require('../services/notification.service');
const { getRrsPool } = require('../config/rrsDb');

const parseMonto = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const n = parseFloat(value);
    return isNaN(n) ? null : n;
};

const getSalesSetting = async (companyId, branchId, key) => {
    const [rows] = await pool.query(
        `SELECT setting_value FROM sales_settings
         WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL))
         AND setting_key = ?`,
        [companyId, branchId || null, branchId || null, key]
    );
    return rows[0]?.setting_value || null;
};

const getPuntosVentaTienda = async (companyId, branchId) => {
    const raw = await getSalesSetting(companyId, branchId, 'puntos_venta_tienda');
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(Number).filter(id => !isNaN(id) && id > 0);
    } catch (e) {
        return [];
    }
};

exports.getPendingRemesas = async (req, res) => {
    try {
        const { search, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let where = `WHERE r.entregada = 0 AND s.company_id = ? AND s.status = 'closed'`;
        const params = [req.company_id];

        if (req.user.branch_id) {
            where += ` AND s.branch_id = ?`;
            params.push(req.user.branch_id);
        }

        const posIds = await getPuntosVentaTienda(req.company_id, req.user.branch_id || null);
        if (posIds.length > 0) {
            where += ` AND s.pos_id IN (?)`;
            params.push(posIds);
        }

        if (search) {
            where += ` AND (r.codigo LIKE ? OR r.description LIKE ? OR s.shift_number LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total
             FROM pos_shift_remesas r
             JOIN pos_shifts s ON r.shift_id = s.id
             ${where}`,
            params
        );
        const total = countResult[0].total;

        const [rows] = await pool.query(
            `SELECT r.id, r.codigo, r.numero, r.description, r.amount as monto,
                    r.shift_id,
                    s.shift_number, s.shift_date, s.start_time, s.end_time,
                    p.nombre as pos_name,
                    sel.nombre as seller_name
             FROM pos_shift_remesas r
             JOIN pos_shifts s ON r.shift_id = s.id
             LEFT JOIN points_of_sale p ON s.pos_id = p.id
             LEFT JOIN sellers sel ON s.seller_id = sel.id
             ${where}
             ORDER BY s.start_time DESC, r.id DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (error) {
        console.error('Error getPendingRemesas (sales):', error);
        res.status(500).json({ message: 'Error al obtener remesas pendientes' });
    }
};

const validateRemesas = async (companyId, branchId, remesaIds, excludeDeliveryId = null) => {
    if (!remesaIds || remesaIds.length === 0) return { remesas: [], total: 0 };

    let query = `SELECT r.id, r.amount as monto
                 FROM pos_shift_remesas r
                 JOIN pos_shifts s ON r.shift_id = s.id
                 WHERE r.id IN (?) AND s.company_id = ?
                 AND (r.entregada = 0 OR r.entrega_id = ?)`;
    const params = [remesaIds, companyId, excludeDeliveryId ? parseInt(excludeDeliveryId) : 0];

    if (branchId) {
        query += ` AND s.branch_id = ?`;
        params.push(branchId);
    }

    const [remesas] = await pool.query(query, params);

    if (remesas.length !== remesaIds.length) {
        const foundIds = remesas.map(r => r.id);
        const missing = remesaIds.filter(id => !foundIds.includes(id));
        const [alreadyDelivered] = await pool.query(
            `SELECT r.id FROM pos_shift_remesas r
             JOIN pos_shifts s ON r.shift_id = s.id
             WHERE r.id IN (?) AND r.entregada = 1 AND (r.entrega_id IS NULL OR r.entrega_id <> ?)`,
            [missing, excludeDeliveryId ? parseInt(excludeDeliveryId) : 0]
        );
        if (alreadyDelivered.length > 0) {
            return { error: `Algunas remesas ya están entregadas (IDs: ${alreadyDelivered.map(r => r.id).join(', ')})` };
        }
        return { error: 'Algunas remesas no fueron encontradas o no están disponibles' };
    }

    const total = remesas.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
    return { remesas, total };
};

exports.createDelivery = async (req, res) => {
    try {
        const { fecha, hora, responsable, comentario, referencia, remesa_ids, monto_entregado } = req.body;

        if (!fecha || !hora) {
            return res.status(400).json({ message: 'Fecha y hora son requeridas' });
        }
        if (!referencia || !String(referencia).trim()) {
            return res.status(400).json({ message: 'El número de referencia es requerido' });
        }

        const remesaIds = Array.isArray(remesa_ids) ? remesa_ids : [];
        const montoRaw = parseMonto(monto_entregado);
        if (remesaIds.length === 0 && montoRaw === null) {
            return res.status(400).json({ message: 'Debe seleccionar al menos una remesa o ingresar un monto de entrega' });
        }

        const { remesas, total, error } = await validateRemesas(req.company_id, req.user.branch_id || null, remesaIds);
        if (error) {
            return res.status(400).json({ message: error });
        }

        const montoEntregado = montoRaw !== null ? montoRaw : total;
        const diferencia = montoEntregado - total;

        const branch_id = req.user.branch_id || 0;

        const [result] = await pool.query(
            `INSERT INTO sales_remesa_deliveries (company_id, branch_id, fecha, hora, responsable, comentario, referencia, monto_entregado, diferencia)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.company_id, branch_id, fecha, hora, responsable || '', comentario || '', String(referencia).trim(), montoEntregado, diferencia]
        );

        const deliveryId = result.insertId;

        if (remesaIds.length > 0) {
            await pool.query(
                `UPDATE pos_shift_remesas SET entregada = 1, entrega_id = ? WHERE id IN (?)`,
                [deliveryId, remesaIds]
            );
        }

        const [delivery] = await pool.query(`
            SELECT d.*,
                   COUNT(r.id) as total_remesas,
                   COALESCE(SUM(r.amount), 0) as monto_total
            FROM sales_remesa_deliveries d
            LEFT JOIN pos_shift_remesas r ON d.id = r.entrega_id
            WHERE d.id = ?
            GROUP BY d.id
        `, [deliveryId]);

        res.json(delivery[0]);
    } catch (error) {
        console.error('Error createDelivery (sales):', error);
        res.status(500).json({ message: 'Error al crear entrega' });
    }
};

exports.updateDelivery = async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha, hora, responsable, comentario, referencia, remesa_ids, monto_entregado } = req.body;

        const [deliveries] = await pool.query(
            `SELECT id, entregado FROM sales_remesa_deliveries WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (deliveries.length === 0) {
            return res.status(404).json({ message: 'Entrega no encontrada' });
        }
        if (deliveries[0].entregado) {
            return res.status(400).json({ message: 'No se puede editar una entrega ya marcada como entregada' });
        }

        if (!fecha || !hora) {
            return res.status(400).json({ message: 'Fecha y hora son requeridas' });
        }
        if (!referencia || !String(referencia).trim()) {
            return res.status(400).json({ message: 'El número de referencia es requerido' });
        }

        const remesaIds = Array.isArray(remesa_ids) ? remesa_ids : [];
        const montoRaw = parseMonto(monto_entregado);
        if (remesaIds.length === 0 && montoRaw === null) {
            return res.status(400).json({ message: 'Debe seleccionar al menos una remesa o ingresar un monto de entrega' });
        }

        const { total, error } = await validateRemesas(req.company_id, req.user.branch_id || null, remesaIds, id);
        if (error) {
            return res.status(400).json({ message: error });
        }

        const montoEntregado = montoRaw !== null ? montoRaw : total;
        const diferencia = montoEntregado - total;

        await pool.query(
            `UPDATE sales_remesa_deliveries SET fecha = ?, hora = ?, responsable = ?, comentario = ?, referencia = ?, monto_entregado = ?, diferencia = ? WHERE id = ?`,
            [fecha, hora, responsable || '', comentario || '', String(referencia).trim(), montoEntregado, diferencia, id]
        );

        await pool.query(
            `UPDATE pos_shift_remesas SET entregada = 0, entrega_id = NULL WHERE entrega_id = ?`,
            [id]
        );

        if (remesaIds.length > 0) {
            await pool.query(
                `UPDATE pos_shift_remesas SET entregada = 1, entrega_id = ? WHERE id IN (?)`,
                [id, remesaIds]
            );
        }

        const [delivery] = await pool.query(`
            SELECT d.*,
                   COUNT(r.id) as total_remesas,
                   COALESCE(SUM(r.amount), 0) as monto_total
            FROM sales_remesa_deliveries d
            LEFT JOIN pos_shift_remesas r ON d.id = r.entrega_id
            WHERE d.id = ?
            GROUP BY d.id
        `, [id]);

        res.json(delivery[0]);
    } catch (error) {
        console.error('Error updateDelivery (sales):', error);
        res.status(500).json({ message: 'Error al actualizar entrega' });
    }
};

exports.getDeliveries = async (req, res) => {
    try {
        const { page = 1, limit = 20, search } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let where = `WHERE d.company_id = ?`;
        const params = [req.company_id];

        if (req.user.branch_id) {
            where += ` AND d.branch_id = ?`;
            params.push(req.user.branch_id);
        }

        if (search) {
            where += ` AND d.responsable LIKE ?`;
            params.push(`%${search}%`);
        }

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM sales_remesa_deliveries d ${where}`,
            params
        );
        const total = countResult[0].total;

        const [rows] = await pool.query(
            `SELECT d.*,
                    COUNT(r.id) as total_remesas,
                    COALESCE(SUM(r.amount), 0) as monto_total
             FROM sales_remesa_deliveries d
             LEFT JOIN pos_shift_remesas r ON d.id = r.entrega_id
             ${where}
             GROUP BY d.id
             ORDER BY d.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (error) {
        console.error('Error getDeliveries (sales):', error);
        res.status(500).json({ message: 'Error al obtener entregas' });
    }
};

exports.getDelivery = async (req, res) => {
    try {
        const { id } = req.params;

        const [deliveries] = await pool.query(
            `SELECT * FROM sales_remesa_deliveries WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );

        if (deliveries.length === 0) {
            return res.status(404).json({ message: 'Entrega no encontrada' });
        }

        const [remesas] = await pool.query(
            `SELECT r.id, r.codigo, r.numero, r.description, r.amount as monto,
                    s.shift_number, s.shift_date, s.start_time,
                    p.nombre as pos_name,
                    sel.nombre as seller_name
             FROM pos_shift_remesas r
             JOIN pos_shifts s ON r.shift_id = s.id
             LEFT JOIN points_of_sale p ON s.pos_id = p.id
             LEFT JOIN sellers sel ON s.seller_id = sel.id
             WHERE r.entrega_id = ?
             ORDER BY r.id ASC`,
            [id]
        );

        res.json({ ...deliveries[0], remesas });
    } catch (error) {
        console.error('Error getDelivery (sales):', error);
        res.status(500).json({ message: 'Error al obtener entrega' });
    }
};

exports.deleteDelivery = async (req, res) => {
    try {
        const { id } = req.params;

        const [deliveries] = await pool.query(
            `SELECT id, entregado FROM sales_remesa_deliveries WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );

        if (deliveries.length === 0) {
            return res.status(404).json({ message: 'Entrega no encontrada' });
        }
        if (deliveries[0].entregado) {
            return res.status(400).json({ message: 'No se puede eliminar una entrega ya marcada como entregada' });
        }

        await pool.query(
            `UPDATE pos_shift_remesas SET entregada = 0, entrega_id = NULL WHERE entrega_id = ?`,
            [id]
        );

        await pool.query(`DELETE FROM sales_remesa_deliveries WHERE id = ?`, [id]);

        res.json({ message: 'Entrega eliminada' });
    } catch (error) {
        console.error('Error deleteDelivery (sales):', error);
        res.status(500).json({ message: 'Error al eliminar entrega' });
    }
};

exports.entregarDelivery = async (req, res) => {
    try {
        const { id } = req.params;

        const [deliveries] = await pool.query(
            `SELECT d.*, b.nombre as branch_name
             FROM sales_remesa_deliveries d
             LEFT JOIN branches b ON d.branch_id = b.id
             WHERE d.id = ? AND d.company_id = ?`,
            [id, req.company_id]
        );

        if (deliveries.length === 0) {
            return res.status(404).json({ message: 'Entrega no encontrada' });
        }
        if (deliveries[0].entregado) {
            return res.status(400).json({ message: 'La entrega ya está marcada como entregada' });
        }

        const delivery = deliveries[0];

        await pool.query(
            `UPDATE sales_remesa_deliveries SET entregado = 1 WHERE id = ?`,
            [id]
        );

        const [remesas] = await pool.query(
            `SELECT r.* FROM pos_shift_remesas r
             JOIN pos_shifts s ON r.shift_id = s.id
             WHERE r.entrega_id = ?`,
            [id]
        );

        const remesasTotal = remesas.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
        const montoEntregado = delivery.monto_entregado !== null && delivery.monto_entregado !== undefined
            ? parseFloat(delivery.monto_entregado)
            : remesasTotal;

        try {
            const cuentaBancaria = await getSalesSetting(req.company_id, delivery.branch_id || null, 'cuenta_bancaria_tienda');
            const rrsIdEmpresa = (await getSalesSetting(req.company_id, delivery.branch_id || null, 'empresa_rrs')) || '015';

            if (cuentaBancaria) {
                const rawAccount = String(cuentaBancaria);
                const cleanAccount = rawAccount.replace(/\s/g, '');
                const last4 = cleanAccount.slice(-4);

                if (last4.length === 4) {
                    const rrsPool = getRrsPool();

                    const [cuentas] = await rrsPool.query(
                        `SELECT id_empresa, numero FROM cuentas_bancarias WHERE numero LIKE ?`,
                        [`%${last4}`]
                    );

                    if (cuentas.length > 0) {
                        const cuenta = cuentas[0];
                        const llave = `${rrsIdEmpresa}-${delivery.id}`;
                        const documento = (delivery.referencia || '').trim() || String(delivery.id).padStart(7, '0');
                        const d = new Date(delivery.fecha);
                        const fechaStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                        const now = new Date();
                        const concepto = `${delivery.branch_name || 'Sucursal'} - ${fechaStr} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                        await rrsPool.query(
                            `INSERT INTO movimientos_bancarios 
                             (id_empresa, llave, cod_remesa, documento, numero_cuenta, concepto, cargo, abono, fecha_aplicado, fecha, monto, tipo_destino) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                cuenta.id_empresa,
                                llave,
                                '01',
                                documento,
                                cuenta.numero,
                                concepto,
                                montoEntregado.toFixed(2),
                                '0.0',
                                '',
                                fechaStr,
                                montoEntregado.toFixed(2),
                                'P'
                            ]
                        );
                    }
                }
            }
        } catch (rrsError) {
            console.error('Error al registrar movimiento bancario en RRS (sales):', rrsError);
        }

        const [result] = await pool.query(`
            SELECT d.*,
                   COUNT(r.id) as total_remesas,
                   COALESCE(SUM(r.amount), 0) as monto_total
            FROM sales_remesa_deliveries d
            LEFT JOIN pos_shift_remesas r ON d.id = r.entrega_id
            WHERE d.id = ?
            GROUP BY d.id
        `, [id]);

        notificationService.notify('sales_remesa_delivered', req.company_id, req.user.branch_id, {
            responsable: delivery.responsable || '',
            monto_entregado: montoEntregado || 0,
            turno: remesas.length > 0 ? `#${remesas[0].shift_number || ''}` : '',
            fecha: delivery.fecha || '',
            sucursal: req.branch_name || ''
        }).catch(() => {});

        res.json(result[0]);
    } catch (error) {
        console.error('Error entregarDelivery (sales):', error);
        res.status(500).json({ message: 'Error al marcar entrega como entregada' });
    }
};

exports.getDeliveryPdf = async (req, res) => {
    try {
        const { id } = req.params;

        const [deliveries] = await pool.query(
            `SELECT * FROM sales_remesa_deliveries WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );

        if (deliveries.length === 0) {
            return res.status(404).json({ message: 'Entrega no encontrada' });
        }

        const delivery = deliveries[0];

        const [remesas] = await pool.query(
            `SELECT r.id, r.codigo, r.numero, r.description, r.amount as monto,
                    s.shift_number, s.shift_date, s.start_time,
                    p.nombre as pos_name,
                    sel.nombre as seller_name
             FROM pos_shift_remesas r
             JOIN pos_shifts s ON r.shift_id = s.id
             LEFT JOIN points_of_sale p ON s.pos_id = p.id
             LEFT JOIN sellers sel ON s.seller_id = sel.id
             WHERE r.entrega_id = ?
             ORDER BY r.id ASC`,
            [id]
        );

        const [companyRows] = await pool.query(
            `SELECT razon_social, nit, nrc, direccion FROM companies WHERE id = ?`,
            [req.company_id]
        );
        const company = companyRows[0] || {};

        let branchName = '';
        if (delivery.branch_id) {
            const [branchRows] = await pool.query(
                `SELECT nombre FROM branches WHERE id = ?`,
                [delivery.branch_id]
            );
            branchName = branchRows[0]?.nombre || '';
        }

        let cuentaBancaria = '';
        const settingValue = await getSalesSetting(req.company_id, delivery.branch_id || null, 'cuenta_bancaria_tienda');
        if (settingValue) {
            cuentaBancaria = settingValue;
        }

        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 40, size: 'LETTER' });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(chunks);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename=entrega_${id}.pdf`);
            res.send(pdfBuffer);
        });

        const pageWidth = doc.page.width - 80;
        const leftMargin = 40;
        const rightMargin = leftMargin + pageWidth;

        const fmtDate = (d) => {
            if (!d) return '';
            const dt = new Date(d);
            return dt.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };

        const fmtMoney = (n) => `$${(parseFloat(n) || 0).toFixed(2)}`;

        let y = 40;

        doc.fontSize(14).font('Helvetica-Bold').text(company.razon_social || '', leftMargin, y, { align: 'center' });
        y = doc.y + 4;
        if (company.nit) {
            doc.fontSize(8).font('Helvetica').text(`NIT: ${company.nit}`, { align: 'center' });
            y = doc.y + 2;
        }
        if (company.direccion) {
            doc.fontSize(8).font('Helvetica').text(company.direccion, { align: 'center' });
            y = doc.y + 2;
        }
        doc.fontSize(10).font('Helvetica-Bold').text('ENTREGA DE REMESAS - VENTAS', { align: 'center' });
        y = doc.y + 12;

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b');
        doc.text('FECHA:', leftMargin, y, { continued: true });
        doc.font('Helvetica').fillColor('#000000').text(` ${fmtDate(delivery.fecha)}`, { continued: true });
        doc.font('Helvetica-Bold').fillColor('#64748b').text('    HORA:', { continued: true });
        doc.font('Helvetica').fillColor('#000000').text(` ${delivery.hora || ''}`);
        y = doc.y + 2;

        doc.font('Helvetica-Bold').fillColor('#64748b');
        doc.text('RESPONSABLE:', leftMargin, y, { continued: true });
        doc.font('Helvetica').fillColor('#000000').text(` ${delivery.responsable || '—'}`);
        y = doc.y + 2;

        if (delivery.comentario) {
            doc.font('Helvetica-Bold').fillColor('#64748b');
            doc.text('COMENTARIO:', leftMargin, y, { continued: true });
            doc.font('Helvetica').fillColor('#000000').text(` ${delivery.comentario}`);
            y = doc.y + 2;
        }

        if (branchName) {
            doc.font('Helvetica-Bold').fillColor('#64748b');
            doc.text('SUCURSAL:', leftMargin, y, { continued: true });
            doc.font('Helvetica').fillColor('#000000').text(` ${branchName}`);
            y = doc.y + 2;
        }

        if (delivery.referencia) {
            doc.font('Helvetica-Bold').fillColor('#64748b');
            doc.text('REFERENCIA:', leftMargin, y, { continued: true });
            doc.font('Helvetica').fillColor('#000000').text(` ${delivery.referencia}`);
            y = doc.y + 2;
        }

        y += 8;

        doc.lineWidth(0.5).strokeColor('#e2e8f0').moveTo(leftMargin, y).lineTo(rightMargin, y).stroke();
        y += 10;

        doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b');
        const colX = {
            codigo: leftMargin,
            descripcion: leftMargin + 80,
            turno: leftMargin + 185,
            fechaTurno: leftMargin + 245,
            pos: leftMargin + 320,
            vendedor: leftMargin + 400,
            monto: rightMargin - 70,
        };
        doc.text('CODIGO', colX.codigo, y);
        doc.text('DESCRIPCION', colX.descripcion, y);
        doc.text('TURNO', colX.turno, y);
        doc.text('FECHA TURNO', colX.fechaTurno, y);
        doc.text('POS', colX.pos, y);
        doc.text('VENDEDOR', colX.vendedor, y);
        doc.text('MONTO', colX.monto, y, { align: 'right' });
        y = doc.y + 8;

        doc.lineWidth(0.5).strokeColor('#e2e8f0').moveTo(leftMargin, y).lineTo(rightMargin, y).stroke();
        y += 6;

        doc.fontSize(8).font('Helvetica').fillColor('#000000');
        let total = 0;

        for (const r of remesas) {
            if (y > 700) {
                doc.addPage();
                y = 40;
            }

            const monto = parseFloat(r.monto || 0);
            total += monto;

            doc.text(r.codigo || `#${r.id}`, colX.codigo, y, { width: 75 });
            doc.text(r.description || '—', colX.descripcion, y, { width: 100 });
            doc.text(`#${r.shift_number || ''}`, colX.turno, y, { width: 55 });
            doc.text(r.shift_date ? fmtDate(r.shift_date) : '—', colX.fechaTurno, y, { width: 70 });
            doc.text(r.pos_name || '—', colX.pos, y, { width: 75 });
            doc.text(r.seller_name || '—', colX.vendedor, y, { width: 110 });
            doc.text(fmtMoney(monto), colX.monto, y, { align: 'right', width: 70 });
            y = doc.y + 4;
        }

        if (remesas.length === 0) {
            doc.text('Sin remesas asociadas (entrega manual).', leftMargin, y, { width: 300 });
            y = doc.y + 4;
        }

        y += 4;
        doc.lineWidth(0.5).strokeColor('#e2e8f0').moveTo(leftMargin, y).lineTo(rightMargin, y).stroke();
        y += 8;

        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
        doc.text(`Total Remesas: ${remesas.length}`, leftMargin, y);
        doc.text(`Total: ${fmtMoney(total)}`, rightMargin - 150, y, { align: 'right', width: 150 });

        y = doc.y + 6;

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
        doc.text(`Monto Entregado: ${fmtMoney(delivery.monto_entregado)}`, leftMargin, y);
        const diferencia = parseFloat(delivery.diferencia || 0);
        doc.font('Helvetica').fillColor(diferencia >= 0 ? '#059669' : '#dc2626');
        doc.text(`Diferencia: ${fmtMoney(diferencia)}`, rightMargin - 150, y, { align: 'right', width: 150 });

        y = doc.y + 12;

        if (cuentaBancaria) {
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b');
            doc.text('CUENTA BANCARIA:', leftMargin, y, { continued: true });
            doc.font('Helvetica').fillColor('#000000').text(` ${cuentaBancaria}`);
            y = doc.y + 8;
        }

        y = doc.page.height - 50;
        doc.fontSize(7).font('Helvetica').fillColor('#94a3b8');
        doc.text(`Generado: ${new Date().toLocaleString('es-SV')}`, leftMargin, y, { align: 'center' });

        doc.end();
    } catch (error) {
        console.error('Error getDeliveryPdf (sales):', error);
        res.status(500).json({ message: 'Error al generar PDF de entrega' });
    }
};
