const pool = require('../config/db');
const notificationService = require('../services/notification.service');
const { getRrsPool } = require('../services/gasCloseoutRrs.service');

exports.getPendingRemesas = async (req, res) => {
    try {
        const { search, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let where = `WHERE r.entregada = 0 AND c.company_id = ?`;
        const params = [req.company_id];

        if (req.user.branch_id) {
            where += ` AND c.branch_id = ?`;
            params.push(req.user.branch_id);
        }

        if (search) {
            where += ` AND (r.codigo LIKE ? OR r.documento LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total
             FROM gas_station_closeout_remesas r
             JOIN gas_station_closeouts c ON r.closeout_id = c.id
             ${where}`,
            params
        );
        const total = countResult[0].total;

        const [rows] = await pool.query(
            `SELECT r.id, r.codigo, r.documento, r.descripcion, r.tipo_operacion, r.monto,
                    r.despachador_id, r.closeout_id, r.entregada,
                    c.numero_turno, c.fecha_turno,
                    d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
             FROM gas_station_closeout_remesas r
             JOIN gas_station_closeouts c ON r.closeout_id = c.id
             LEFT JOIN gas_station_despachadores d ON r.despachador_id = d.id
             ${where}
             ORDER BY c.fecha_turno DESC, r.id DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (error) {
        console.error('Error getPendingRemesas:', error);
        res.status(500).json({ message: 'Error al obtener remesas pendientes' });
    }
};

exports.createDelivery = async (req, res) => {
    try {
        const { fecha, hora, responsable, comentario, remesa_ids } = req.body;

        if (!fecha || !hora) {
            return res.status(400).json({ message: 'Fecha y hora son requeridas' });
        }
        if (!remesa_ids || !Array.isArray(remesa_ids) || remesa_ids.length === 0) {
            return res.status(400).json({ message: 'Debe seleccionar al menos una remesa' });
        }

        let remesaQuery = `SELECT r.id FROM gas_station_closeout_remesas r
             JOIN gas_station_closeouts c ON r.closeout_id = c.id
             WHERE r.id IN (?) AND c.company_id = ? AND r.entregada = 0`;
        const remesaParams = [remesa_ids, req.company_id];

        if (req.user.branch_id) {
            remesaQuery += ` AND c.branch_id = ?`;
            remesaParams.push(req.user.branch_id);
        }

        const [remesas] = await pool.query(remesaQuery, remesaParams);

        if (remesas.length !== remesa_ids.length) {
            const foundIds = remesas.map(r => r.id);
            const missing = remesa_ids.filter(id => !foundIds.includes(id));
            const [alreadyDelivered] = await pool.query(
                `SELECT id FROM gas_station_closeout_remesas WHERE id IN (?) AND entregada = 1`,
                [missing]
            );
            if (alreadyDelivered.length > 0) {
                return res.status(400).json({
                    message: `Algunas remesas ya están entregadas (IDs: ${alreadyDelivered.map(r => r.id).join(', ')})`
                });
            }
            return res.status(400).json({
                message: 'Algunas remesas no fueron encontradas o no están disponibles'
            });
        }

        const branch_id = req.user.branch_id || 0;

        const [result] = await pool.query(
            `INSERT INTO gas_station_remesa_deliveries (company_id, branch_id, fecha, hora, responsable, comentario) VALUES (?, ?, ?, ?, ?, ?)`,
            [req.company_id, branch_id, fecha, hora, responsable || '', comentario || '']
        );

        const deliveryId = result.insertId;

        await pool.query(
            `UPDATE gas_station_closeout_remesas SET entregada = 1, entrega_id = ? WHERE id IN (?)`,
            [deliveryId, remesa_ids]
        );

        const [delivery] = await pool.query(`
            SELECT d.*,
                   COUNT(r.id) as total_remesas,
                   COALESCE(SUM(r.monto), 0) as monto_total
            FROM gas_station_remesa_deliveries d
            LEFT JOIN gas_station_closeout_remesas r ON d.id = r.entrega_id
            WHERE d.id = ?
            GROUP BY d.id
        `, [deliveryId]);

        notificationService.notify('gas_remesa_delivered', req.company_id, req.user.branch_id, {
            despachador_nombre: '',
            monto_entregado: delivery[0].monto_total || 0,
            turno: '',
            fecha: delivery[0].fecha || '',
            sucursal: req.branch_name || ''
        }).catch(() => {});

        res.json(delivery[0]);
    } catch (error) {
        console.error('Error createDelivery:', error);
        res.status(500).json({ message: 'Error al crear entrega' });
    }
};

exports.updateDelivery = async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha, hora, responsable, comentario, remesa_ids } = req.body;

        const [deliveries] = await pool.query(
            `SELECT id, entregado FROM gas_station_remesa_deliveries WHERE id = ? AND company_id = ?`,
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
        if (!remesa_ids || !Array.isArray(remesa_ids) || remesa_ids.length === 0) {
            return res.status(400).json({ message: 'Debe seleccionar al menos una remesa' });
        }

        let remesaQuery = `SELECT r.id FROM gas_station_closeout_remesas r
             JOIN gas_station_closeouts c ON r.closeout_id = c.id
             WHERE r.id IN (?) AND c.company_id = ? AND (r.entregada = 0 OR r.entrega_id = ?)`;
        const remesaParams = [remesa_ids, req.company_id, parseInt(id)];

        if (req.user.branch_id) {
            remesaQuery += ` AND c.branch_id = ?`;
            remesaParams.push(req.user.branch_id);
        }

        const [remesas] = await pool.query(remesaQuery, remesaParams);

        if (remesas.length !== remesa_ids.length) {
            return res.status(400).json({
                message: 'Algunas remesas no están disponibles (ya entregadas en otra entrega o no encontradas)'
            });
        }

        await pool.query(
            `UPDATE gas_station_remesa_deliveries SET fecha = ?, hora = ?, responsable = ?, comentario = ? WHERE id = ?`,
            [fecha, hora, responsable || '', comentario || '', id]
        );

        await pool.query(
            `UPDATE gas_station_closeout_remesas SET entregada = 0, entrega_id = NULL WHERE entrega_id = ? AND id NOT IN (?)`,
            [id, remesa_ids]
        );

        await pool.query(
            `UPDATE gas_station_closeout_remesas SET entregada = 1, entrega_id = ? WHERE id IN (?) AND entregada = 0`,
            [id, remesa_ids]
        );

        const [delivery] = await pool.query(`
            SELECT d.*,
                   COUNT(r.id) as total_remesas,
                   COALESCE(SUM(r.monto), 0) as monto_total
            FROM gas_station_remesa_deliveries d
            LEFT JOIN gas_station_closeout_remesas r ON d.id = r.entrega_id
            WHERE d.id = ?
            GROUP BY d.id
        `, [id]);

        res.json(delivery[0]);
    } catch (error) {
        console.error('Error updateDelivery:', error);
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
            `SELECT COUNT(*) as total FROM gas_station_remesa_deliveries d ${where}`,
            params
        );
        const total = countResult[0].total;

        const [rows] = await pool.query(
            `SELECT d.*,
                    COUNT(r.id) as total_remesas,
                    COALESCE(SUM(r.monto), 0) as monto_total
             FROM gas_station_remesa_deliveries d
             LEFT JOIN gas_station_closeout_remesas r ON d.id = r.entrega_id
             ${where}
             GROUP BY d.id
             ORDER BY d.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (error) {
        console.error('Error getDeliveries:', error);
        res.status(500).json({ message: 'Error al obtener entregas' });
    }
};

exports.getDelivery = async (req, res) => {
    try {
        const { id } = req.params;

        const [deliveries] = await pool.query(
            `SELECT * FROM gas_station_remesa_deliveries WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );

        if (deliveries.length === 0) {
            return res.status(404).json({ message: 'Entrega no encontrada' });
        }

        const [remesas] = await pool.query(
            `SELECT r.*, c.numero_turno, c.fecha_turno,
                    d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
             FROM gas_station_closeout_remesas r
             JOIN gas_station_closeouts c ON r.closeout_id = c.id
             LEFT JOIN gas_station_despachadores d ON r.despachador_id = d.id
             WHERE r.entrega_id = ?
             ORDER BY r.id ASC`,
            [id]
        );

        res.json({ ...deliveries[0], remesas });
    } catch (error) {
        console.error('Error getDelivery:', error);
        res.status(500).json({ message: 'Error al obtener entrega' });
    }
};

exports.deleteDelivery = async (req, res) => {
    try {
        const { id } = req.params;

        const [deliveries] = await pool.query(
            `SELECT id, entregado FROM gas_station_remesa_deliveries WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );

        if (deliveries.length === 0) {
            return res.status(404).json({ message: 'Entrega no encontrada' });
        }
        if (deliveries[0].entregado) {
            return res.status(400).json({ message: 'No se puede eliminar una entrega ya marcada como entregada' });
        }

        await pool.query(
            `UPDATE gas_station_closeout_remesas SET entregada = 0, entrega_id = NULL WHERE entrega_id = ?`,
            [id]
        );

        await pool.query(`DELETE FROM gas_station_remesa_deliveries WHERE id = ?`, [id]);

        res.json({ message: 'Entrega eliminada' });
    } catch (error) {
        console.error('Error deleteDelivery:', error);
        res.status(500).json({ message: 'Error al eliminar entrega' });
    }
};

exports.entregarDelivery = async (req, res) => {
    try {
        const { id } = req.params;

        const [deliveries] = await pool.query(
            `SELECT d.*, b.nombre as branch_name
             FROM gas_station_remesa_deliveries d
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
            `UPDATE gas_station_remesa_deliveries SET entregado = 1 WHERE id = ?`,
            [id]
        );

        const [remesas] = await pool.query(
            `SELECT r.* FROM gas_station_closeout_remesas r
             JOIN gas_station_closeouts c ON r.closeout_id = c.id
             WHERE r.entrega_id = ?`,
            [id]
        );

        const montoTotal = remesas.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);

        try {
            const [settingsRows] = await pool.query(
                `SELECT setting_value FROM gas_station_settings 
                 WHERE company_id = ? AND branch_id ${delivery.branch_id ? '= ?' : 'IS NULL'} 
                 AND setting_key = 'cuenta_bancaria_pista'`,
                delivery.branch_id ? [req.company_id, delivery.branch_id] : [req.company_id]
            );

            if (settingsRows.length > 0) {
                const rawAccount = settingsRows[0].setting_value || '';
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
                        const llave = `015-${delivery.id}`;
                        const documento = String(delivery.id).padStart(7, '0');
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
                                montoTotal.toFixed(2),
                                '0.0',
                                '',
                                fechaStr,
                                montoTotal.toFixed(2),
                                'P'
                            ]
                        );
                    }
                }
            }
        } catch (rrsError) {
            console.error('Error al registrar movimiento bancario en RRS:', rrsError);
        }

        const [result] = await pool.query(`
            SELECT d.*,
                   COUNT(r.id) as total_remesas,
                   COALESCE(SUM(r.monto), 0) as monto_total
            FROM gas_station_remesa_deliveries d
            LEFT JOIN gas_station_closeout_remesas r ON d.id = r.entrega_id
            WHERE d.id = ?
            GROUP BY d.id
        `, [id]);

        res.json(result[0]);
    } catch (error) {
        console.error('Error entregarDelivery:', error);
        res.status(500).json({ message: 'Error al marcar entrega como entregada' });
    }
};

exports.getDeliveryPdf = async (req, res) => {
    try {
        const { id } = req.params;

        const [deliveries] = await pool.query(
            `SELECT * FROM gas_station_remesa_deliveries WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );

        if (deliveries.length === 0) {
            return res.status(404).json({ message: 'Entrega no encontrada' });
        }

        const delivery = deliveries[0];

        const [remesas] = await pool.query(
            `SELECT r.*, c.numero_turno, c.fecha_turno,
                    d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
             FROM gas_station_closeout_remesas r
             JOIN gas_station_closeouts c ON r.closeout_id = c.id
             LEFT JOIN gas_station_despachadores d ON r.despachador_id = d.id
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
        const [settingsRows] = await pool.query(
            `SELECT setting_value FROM gas_station_settings WHERE company_id = ? AND branch_id ${delivery.branch_id ? '= ?' : 'IS NULL'} AND setting_key = 'cuenta_bancaria_pista'`,
            delivery.branch_id ? [req.company_id, delivery.branch_id] : [req.company_id]
        );
        if (settingsRows.length > 0) {
            cuentaBancaria = settingsRows[0].setting_value || '';
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
        doc.fontSize(10).font('Helvetica-Bold').text('ENTREGA DE REMESAS', { align: 'center' });
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

        y += 8;

        doc.lineWidth(0.5).strokeColor('#e2e8f0').moveTo(leftMargin, y).lineTo(rightMargin, y).stroke();
        y += 10;

        doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b');
        const colX = {
            codigo: leftMargin,
            documento: leftMargin + 90,
            turno: leftMargin + 195,
            fechaTurno: leftMargin + 260,
            despachador: leftMargin + 340,
            monto: rightMargin - 70,
        };
        doc.text('CODIGO', colX.codigo, y);
        doc.text('DOCUMENTO', colX.documento, y);
        doc.text('TURNO', colX.turno, y);
        doc.text('FECHA TURNO', colX.fechaTurno, y);
        doc.text('DESPACHADOR', colX.despachador, y);
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

            doc.text(r.codigo || `#${r.id}`, colX.codigo, y, { width: 85 });
            doc.text(r.documento || '—', colX.documento, y, { width: 100 });
            doc.text(`#${r.numero_turno || ''}`, colX.turno, y, { width: 60 });
            doc.text(r.fecha_turno ? fmtDate(r.fecha_turno) : '—', colX.fechaTurno, y, { width: 75 });
            doc.text(r.despachador_descripcion || '—', colX.despachador, y, { width: 130 });
            doc.text(fmtMoney(monto), colX.monto, y, { align: 'right', width: 70 });
            y = doc.y + 4;
        }

        y += 4;
        doc.lineWidth(0.5).strokeColor('#e2e8f0').moveTo(leftMargin, y).lineTo(rightMargin, y).stroke();
        y += 8;

        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
        doc.text(`Total Remesas: ${remesas.length}`, leftMargin, y);
        doc.text(`Total: ${fmtMoney(total)}`, rightMargin - 150, y, { align: 'right', width: 150 });

        y = doc.y + 14;

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
        console.error('Error getDeliveryPdf:', error);
        res.status(500).json({ message: 'Error al generar PDF de entrega' });
    }
};
