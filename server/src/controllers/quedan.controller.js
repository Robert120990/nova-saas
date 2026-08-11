const pool = require('../config/db');
const { getRrsPool } = require('../config/rrsDb');
const PDFDocument = require('pdfkit');
const excelService = require('../services/excel.service');

const getQuedans = async (req, res) => {
    try {
        const { search, page = 1, limit = 15, branch_id } = req.query;
        const offset = (page - 1) * limit;
        const companyId = req.company_id || req.user?.company_id;
        const branchFilter = branch_id || req.user?.branch_id;

        let query = `
            SELECT pq.*,
                   p.nombre AS provider_nombre,
                   p.nrc AS provider_nrc,
                   b.nombre AS branch_nombre
            FROM purchase_quedans pq
            LEFT JOIN providers p ON pq.provider_id = p.id
            LEFT JOIN branches b ON pq.branch_id = b.id
            WHERE pq.company_id = ?
        `;
        let params = [companyId];

        if (branchFilter) {
            query += " AND pq.branch_id = ?";
            params.push(branchFilter);
        }

        const getSearchWords = (term) => {
            const words = term.trim().split(/\s+/).filter(Boolean);
            return [...new Set(words)];
        };

        const searchWords = search ? getSearchWords(search) : [];
        searchWords.forEach(word => {
            query += ` AND (p.nombre LIKE ? OR p.nombre_comercial LIKE ? OR p.nit LIKE ? OR p.nrc LIKE ? OR pq.num_quedan LIKE ?) `;
            const searchTerm = `%${word}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        });

        const countQuery = `SELECT COUNT(*) as total FROM (${query}) as sub`;
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        query += " ORDER BY pq.fecha DESC, pq.id DESC LIMIT ? OFFSET ?";
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);

        res.json({
            data: rows,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error al obtener quedanes:', error);
        res.status(500).json({ message: 'Error al obtener quedanes' });
    }
};

const getQuedanById = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.user?.company_id;

        const [headers] = await pool.query(`
            SELECT pq.*,
                   p.nombre AS provider_nombre,
                   p.nrc AS provider_nrc,
                   b.nombre AS branch_nombre
            FROM purchase_quedans pq
            LEFT JOIN providers p ON pq.provider_id = p.id
            LEFT JOIN branches b ON pq.branch_id = b.id
            WHERE pq.id = ? AND pq.company_id = ?
        `, [id, companyId]);

        if (headers.length === 0) {
            return res.status(404).json({ message: 'Quedan no encontrado' });
        }

        const [items] = await pool.query(
            'SELECT * FROM purchase_quedan_items WHERE quedan_id = ? ORDER BY id',
            [id]
        );

        res.json({ ...headers[0], items });
    } catch (error) {
        console.error('Error al obtener detalle del quedan:', error);
        res.status(500).json({ message: 'Error al obtener detalle del quedan' });
    }
};

const createQuedan = async (req, res) => {
    try {
        const { branch_id, num_quedan, provider_id, dias_credito, fecha, fecha_vencimiento, items } = req.body;
        const companyId = req.company_id || req.user?.company_id;
        const usuarioId = req.user?.id;
        const branchId = branch_id || req.user?.branch_id;

        if (!num_quedan || !provider_id || !fecha) {
            return res.status(400).json({ message: 'N. Quedan, proveedor y fecha son requeridos' });
        }

        const [dup] = await pool.query(
            'SELECT id FROM purchase_quedans WHERE company_id = ? AND branch_id = ? AND provider_id = ? AND num_quedan = ?',
            [companyId, branchId, provider_id, num_quedan]
        );
        if (dup.length > 0) {
            return res.status(400).json({ message: 'Ya existe un quedan con ese número para esta sucursal y proveedor' });
        }

        let totalGravadas = 0, totalIva = 0, totalRetencion = 0, totalPercepcion = 0, totalExentas = 0, total = 0;

        if (items && items.length > 0) {
            for (const item of items) {
                const g = parseFloat(item.gravadas) || 0;
                const i = parseFloat(item.iva) || 0;
                const r = parseFloat(item.retencion) || 0;
                const p = parseFloat(item.percepcion) || 0;
                const e = parseFloat(item.exentas) || 0;
                const sign = item.tipo === 'NCR' ? -1 : 1;
                const t = Math.round(sign * (g + i + e - r + p) * 100) / 100;
                totalGravadas += sign * g;
                totalIva += sign * i;
                totalRetencion += sign * r;
                totalPercepcion += sign * p;
                totalExentas += sign * e;
                total += t;
            }
        }

        const [result] = await pool.query(`
            INSERT INTO purchase_quedans
                (company_id, branch_id, num_quedan, provider_id, dias_credito, fecha, fecha_vencimiento,
                 total_gravadas, total_iva, total_retencion, total_percepcion, total_exentas, total, usuario_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [companyId, branchId, num_quedan, provider_id, dias_credito || 0, fecha, fecha_vencimiento,
            totalGravadas, totalIva, totalRetencion, totalPercepcion, totalExentas, total, usuarioId]);

        const quedanId = result.insertId;

        if (items && items.length > 0) {
            const itemValues = items.map(item => {
                const sign = item.tipo === 'NCR' ? -1 : 1;
                return [
                    quedanId, item.fecha || fecha, item.documento || '',
                    item.tipo || 'CCF',
                    parseFloat(item.gravadas) || 0,
                    parseFloat(item.iva) || 0,
                    parseFloat(item.retencion) || 0,
                    parseFloat(item.percepcion) || 0,
                    parseFloat(item.exentas) || 0,
                    parseFloat(item.total) || Math.round(sign * ((parseFloat(item.gravadas) || 0) + (parseFloat(item.iva) || 0) + (parseFloat(item.exentas) || 0) - (parseFloat(item.retencion) || 0) + (parseFloat(item.percepcion) || 0)) * 100) / 100
                ];
            });

            await pool.query(`
                INSERT INTO purchase_quedan_items
                    (quedan_id, fecha, documento, tipo, gravadas, iva, retencion, percepcion, exentas, total)
                VALUES ?
            `, [itemValues]);
        }

        res.status(201).json({ message: 'Quedan registrado con éxito', id: quedanId });
    } catch (error) {
        console.error('Error al registrar quedan:', error);
        res.status(500).json({ message: 'Error al registrar quedan: ' + error.message });
    }
};

const updateQuedan = async (req, res) => {
    try {
        const { id } = req.params;
        const { branch_id, num_quedan, provider_id, dias_credito, fecha, fecha_vencimiento, items } = req.body;
        const companyId = req.company_id || req.user?.company_id;

        const [existing] = await pool.query(
            'SELECT * FROM purchase_quedans WHERE id = ? AND company_id = ?',
            [id, companyId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: 'Quedan no encontrado' });
        }

        if (existing[0].status !== 'PENDIENTE') {
            return res.status(400).json({ message: 'No se puede editar un quedan que ya fue ' + existing[0].status.toLowerCase() });
        }

        const branchId = branch_id || existing[0].branch_id;
        const quedanNum = num_quedan || existing[0].num_quedan;
        const provId = provider_id || existing[0].provider_id;

        const [dup] = await pool.query(
            'SELECT id FROM purchase_quedans WHERE company_id = ? AND branch_id = ? AND provider_id = ? AND num_quedan = ? AND id != ?',
            [companyId, branchId, provId, quedanNum, id]
        );
        if (dup.length > 0) {
            return res.status(400).json({ message: 'Ya existe un quedan con ese número para esta sucursal y proveedor' });
        }

        let totalGravadas = 0, totalIva = 0, totalRetencion = 0, totalPercepcion = 0, totalExentas = 0, total = 0;

        if (items && items.length > 0) {
            for (const item of items) {
                const g = parseFloat(item.gravadas) || 0;
                const i = parseFloat(item.iva) || 0;
                const r = parseFloat(item.retencion) || 0;
                const p = parseFloat(item.percepcion) || 0;
                const e = parseFloat(item.exentas) || 0;
                const sign = item.tipo === 'NCR' ? -1 : 1;
                const t = Math.round(sign * (g + i + e - r + p) * 100) / 100;
                totalGravadas += sign * g;
                totalIva += sign * i;
                totalRetencion += sign * r;
                totalPercepcion += sign * p;
                totalExentas += sign * e;
                total += t;
            }
        }

        await pool.query(`
            UPDATE purchase_quedans SET
                branch_id = ?, num_quedan = ?, provider_id = ?, dias_credito = ?,
                fecha = ?, fecha_vencimiento = ?,
                total_gravadas = ?, total_iva = ?, total_retencion = ?,
                total_percepcion = ?, total_exentas = ?, total = ?
            WHERE id = ? AND company_id = ?
        `, [
            branch_id || existing[0].branch_id,
            num_quedan || existing[0].num_quedan,
            provider_id || existing[0].provider_id,
            dias_credito ?? existing[0].dias_credito,
            fecha || existing[0].fecha,
            fecha_vencimiento || existing[0].fecha_vencimiento,
            totalGravadas, totalIva, totalRetencion, totalPercepcion, totalExentas, total,
            id, companyId
        ]);

        await pool.query('DELETE FROM purchase_quedan_items WHERE quedan_id = ?', [id]);

        if (items && items.length > 0) {
            const itemValues = items.map(item => {
                const sign = item.tipo === 'NCR' ? -1 : 1;
                return [
                    id, item.fecha || fecha, item.documento || '',
                    item.tipo || 'CCF',
                    parseFloat(item.gravadas) || 0,
                    parseFloat(item.iva) || 0,
                    parseFloat(item.retencion) || 0,
                    parseFloat(item.percepcion) || 0,
                    parseFloat(item.exentas) || 0,
                    parseFloat(item.total) || Math.round(sign * ((parseFloat(item.gravadas) || 0) + (parseFloat(item.iva) || 0) + (parseFloat(item.exentas) || 0) - (parseFloat(item.retencion) || 0) + (parseFloat(item.percepcion) || 0)) * 100) / 100
                ];
            });

            await pool.query(`
                INSERT INTO purchase_quedan_items
                    (quedan_id, fecha, documento, tipo, gravadas, iva, retencion, percepcion, exentas, total)
                VALUES ?
            `, [itemValues]);
        }

        res.json({ message: 'Quedan actualizado con éxito' });
    } catch (error) {
        console.error('Error al actualizar quedan:', error);
        res.status(500).json({ message: 'Error al actualizar quedan: ' + error.message });
    }
};

const deleteQuedan = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.user?.company_id;

        const [existing] = await pool.query(
            'SELECT * FROM purchase_quedans WHERE id = ? AND company_id = ?',
            [id, companyId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: 'Quedan no encontrado' });
        }

        if (existing[0].status !== 'PENDIENTE') {
            return res.status(400).json({ message: 'No se puede eliminar un quedan que ya fue ' + existing[0].status.toLowerCase() });
        }

        await pool.query('DELETE FROM purchase_quedans WHERE id = ? AND company_id = ?', [id, companyId]);

        res.json({ message: 'Quedan eliminado con éxito' });
    } catch (error) {
        console.error('Error al eliminar quedan:', error);
        res.status(500).json({ message: 'Error al eliminar quedan: ' + error.message });
    }
};

const deliverQuedan = async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha_entrega } = req.body;
        const companyId = req.company_id || req.user?.company_id;

        if (!fecha_entrega) {
            return res.status(400).json({ message: 'Fecha de entrega es requerida' });
        }

        const [existing] = await pool.query(
            'SELECT * FROM purchase_quedans WHERE id = ? AND company_id = ?',
            [id, companyId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: 'Quedan no encontrado' });
        }

        if (existing[0].status !== 'SOLICITADO') {
            return res.status(400).json({ message: 'Solo se pueden entregar quedanes en estado SOLICITADO' });
        }

        await pool.query(`
            UPDATE purchase_quedans SET status = 'ENTREGADO', fecha_entrega = ?
            WHERE id = ? AND company_id = ?
        `, [fecha_entrega, id, companyId]);

        res.json({ message: 'Quedan marcado como entregado con éxito' });
    } catch (error) {
        console.error('Error al entregar quedan:', error);
        res.status(500).json({ message: 'Error al entregar quedan: ' + error.message });
    }
};

const requestQuedan = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.user?.company_id;

        const [existing] = await pool.query(`
            SELECT pq.*, p.nrc AS provider_nrc, p.nombre AS provider_nombre
            FROM purchase_quedans pq
            LEFT JOIN providers p ON pq.provider_id = p.id
            WHERE pq.id = ? AND pq.company_id = ?
        `, [id, companyId]);

        if (existing.length === 0) {
            return res.status(404).json({ message: 'Quedan no encontrado' });
        }

        const quedan = existing[0];

        if (quedan.status !== 'PENDIENTE') {
            return res.status(400).json({ message: 'Solo se pueden solicitar quedanes en estado PENDIENTE' });
        }

        const [configs] = await pool.query(
            'SELECT * FROM branch_chq_config WHERE company_id = ? AND branch_id = ?',
            [companyId, quedan.branch_id]
        );

        if (configs.length === 0) {
            return res.status(400).json({
                message: 'Configuración de Chq Contado no encontrada para esta sucursal. Primero configure el código de destino en Ajustes.'
            });
        }

        const config = configs[0];

        const [empresaRows] = await pool.query(
            'SELECT setting_value FROM sales_settings WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL)) AND setting_key = ?',
            [companyId, quedan.branch_id || null, quedan.branch_id || null, 'empresa_rrs']
        );
        const rrsEmpresa = empresaRows[0]?.setting_value || '015';

        const nrc = (quedan.provider_nrc || '').replace(/\s/g, '');
        const codProveedor = `${rrsEmpresa}${quedan.provider_id}${nrc}`;
        const llave = `${config.rrs_id_empresa}-${quedan.id}`;
        const tipoDestino = 'PISTA';
        const fechaDate = quedan.fecha instanceof Date
            ? quedan.fecha.toISOString().split('T')[0]
            : String(quedan.fecha).substring(0, 10);

        const [items] = await pool.query(
            'SELECT * FROM purchase_quedan_items WHERE quedan_id = ?',
            [id]
        );

        const rrs = getRrsPool();
        const conn = await rrs.getConnection();
        try {
            await conn.execute(`
                INSERT INTO emision_quedan
                    (id_empresa, llave, fecha, quedan, validez, cod_proveedor, comentario,
                     es_gasto, comprobante_retencion, saldo, total, cheque, abono,
                     cod_destino, tipo_destino, id_rubro, fecha_entrega, llave_cheque)
                VALUES (?, ?, ?, ?, ?, ?, '', 0, '', ?, ?, '', 0, ?, ?, '', '', '')
            `, [
                config.rrs_id_empresa,
                llave,
                fechaDate,
                quedan.num_quedan || '',
                quedan.dias_credito || 0,
                codProveedor,
                parseFloat(quedan.total) || 0,
                parseFloat(quedan.total) || 0,
                config.cod_destino,
                tipoDestino
            ]);

            if (items.length > 0) {
                const itemValues = items.map(item => {
                    const itemFecha = item.fecha instanceof Date
                        ? item.fecha.toISOString().split('T')[0]
                        : String(item.fecha).substring(0, 10);
                    return [
                        config.rrs_id_empresa,
                        llave,
                        itemFecha,
                        item.documento || '',
                        item.tipo || 'CCF',
                        parseFloat(item.gravadas) || 0,
                        parseFloat(item.iva) || 0,
                        parseFloat(item.exentas) || 0,
                        parseFloat(item.retencion) || 0,
                        parseFloat(item.total) || 0,
                        parseFloat(item.total) || 0,
                        '', 0, 0, 0, 0
                    ];
                });

                await conn.query(`
                    INSERT INTO detalle_emision_quedan
                        (id_empresa, llave, fecha, documento, cod_tipo_documento,
                         gravadas, iva, exentas, retencion, total, saldo,
                         llave_compra, fovial, cotrans, percepcion, renta)
                    VALUES ?
                `, [itemValues]);
            }

            await pool.query(
                "UPDATE purchase_quedans SET status = 'SOLICITADO' WHERE id = ? AND company_id = ?",
                [id, companyId]
            );

            res.json({ message: 'Quedan enviado a RRS con éxito', llave });
        } catch (error) {
            throw error;
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error al solicitar quedan:', error);
        res.status(500).json({ message: 'Error al solicitar quedan a RRS: ' + error.message });
    }
};

const revertQuedan = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.user?.company_id;

        const [existing] = await pool.query(
            'SELECT * FROM purchase_quedans WHERE id = ? AND company_id = ?',
            [id, companyId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: 'Quedan no encontrado' });
        }

        const quedan = existing[0];

        if (quedan.status !== 'SOLICITADO') {
            return res.status(400).json({ message: 'Solo se pueden revertir quedanes en estado SOLICITADO' });
        }

        const [configs] = await pool.query(
            'SELECT * FROM branch_chq_config WHERE company_id = ? AND branch_id = ?',
            [companyId, quedan.branch_id]
        );

        const rrsIdEmpresa = configs.length > 0 ? configs[0].rrs_id_empresa : '';
        const llave = `${rrsIdEmpresa}-${quedan.id}`;

        const rrs = getRrsPool();
        await rrs.query('DELETE FROM detalle_emision_quedan WHERE llave = ?', [llave]);
        const [deleted] = await rrs.query('DELETE FROM emision_quedan WHERE llave = ?', [llave]);

        await pool.query(
            "UPDATE purchase_quedans SET status = 'PENDIENTE' WHERE id = ? AND company_id = ?",
            [id, companyId]
        );

        res.json({
            message: `Solicitud revertida con éxito. ${deleted.affectedRows > 0 ? 'Registro eliminado de RRS.' : 'No se encontró registro en RRS.'}`
        });
    } catch (error) {
        console.error('Error al revertir quedan:', error);
        res.status(500).json({ message: 'Error al revertir quedan: ' + error.message });
    }
};

const getQuedanReportPDF = async (req, res) => {
    try {
        const { start_date, end_date, branch_id } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Rango de fechas requerido' });
        }

        // Company info
        const [company] = await pool.query(
            'SELECT razon_social, nit FROM companies WHERE id = ?', [companyId]
        );
        const comp = company[0] || { razon_social: 'EMPRESA', nit: '---' };

        // Query quedans
        let sql = `
            SELECT pq.*,
                   p.nombre AS provider_nombre,
                   p.nrc AS provider_nrc,
                   b.nombre AS branch_nombre
            FROM purchase_quedans pq
            LEFT JOIN providers p ON pq.provider_id = p.id
            LEFT JOIN branches b ON pq.branch_id = b.id
            WHERE pq.company_id = ? AND pq.fecha BETWEEN ? AND ?
        `;
        const params = [companyId, start_date, end_date];

        if (branch_id && branch_id !== 'all') {
            sql += ' AND pq.branch_id = ?';
            params.push(branch_id);
        }

        sql += ' ORDER BY pq.fecha ASC, pq.num_quedan ASC';

        const [rows] = await pool.query(sql, params);

        // Excel export
        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Quedanes',
                    columns: [
                        { header: 'N. Quedan', key: 'num_quedan', width: 15 },
                        { header: 'Fecha', key: 'fecha', width: 15 },
                        { header: 'Vencimiento', key: 'vencimiento', width: 15 },
                        { header: 'Proveedor', key: 'proveedor', width: 30 },
                        { header: 'Sucursal', key: 'sucursal', width: 20 },
                        { header: 'Días Crédito', key: 'dias_credito', width: 12 },
                        { header: 'Total', key: 'total', width: 15 },
                        { header: 'Estado', key: 'estado', width: 15 }
                    ],
                    data: rows.map(r => ({
                        num_quedan: r.num_quedan || '---',
                        fecha: new Date(r.fecha).toLocaleDateString('es-SV'),
                        vencimiento: r.fecha_vencimiento ? new Date(r.fecha_vencimiento).toLocaleDateString('es-SV') : '---',
                        proveedor: r.provider_nombre || '---',
                        sucursal: r.branch_nombre || '---',
                        dias_credito: r.dias_credito || 0,
                        total: `$${parseFloat(r.total || 0).toFixed(2)}`,
                        estado: r.status || '---'
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Reporte_Quedanes_${start_date}_al_${end_date}.xlsx`);
        }

        // Generate PDF
        const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            const result = Buffer.concat(chunks);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="Reporte_Quedanes_${start_date}_al_${end_date}.pdf"`);
            res.send(result);
        });

        // Header
        doc.fontSize(16).font('Helvetica-Bold').text(comp.razon_social?.toUpperCase() || 'EMPRESA', { align: 'center' });
        doc.fontSize(9).font('Helvetica').text(`NIT: ${comp.nit || '---'}`, { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(13).font('Helvetica-Bold').text('REPORTE DE QUEDANES EMITIDOS', { align: 'center' });
        doc.fontSize(9).font('Helvetica').text(`Periodo: ${start_date} al ${end_date}`, { align: 'center' });

        let branchName = 'Todas las sucursales';
        if (branch_id && branch_id !== 'all' && rows.length > 0) {
            branchName = rows[0].branch_nombre;
        }
        doc.text(`Sucursal: ${branchName}`, { align: 'center' });
        doc.moveDown(1.5);

        // Table
        const startX = 40;
        const tableWidth = 520;
        let currentY = doc.y;

        const drawTableHeader = (y) => {
            doc.fontSize(7).font('Helvetica-Bold');
            const colX = {
                num: startX,
                fecha: startX + 55,
                venc: startX + 103,
                dias: startX + 151,
                proveedor: startX + 181,
                total: startX + 365,
                estado: startX + 455
            };
            doc.text('N. QUEDAN', colX.num, y);
            doc.text('FECHA', colX.fecha, y);
            doc.text('VENCE', colX.venc, y);
            doc.text('DÍAS', colX.dias, y);
            doc.text('PROVEEDOR', colX.proveedor, y);
            doc.text('TOTAL', colX.total, y, { width: 80, align: 'right' });
            doc.text('ESTADO', colX.estado, y);
            doc.moveTo(startX, y + 10).lineTo(startX + tableWidth, y + 10).stroke();
            return y + 15;
        };

        currentY = drawTableHeader(currentY);

        let grandTotal = 0;
        let rowCount = 0;

        rows.forEach(row => {
            if (currentY > 700) {
                doc.addPage();
                currentY = drawTableHeader(40);
            }

            doc.fontSize(7).font('Helvetica');
            const colX = {
                num: startX,
                fecha: startX + 55,
                venc: startX + 103,
                dias: startX + 151,
                proveedor: startX + 181,
                total: startX + 365,
                estado: startX + 455
            };

            doc.text(row.num_quedan || '---', colX.num, currentY, { width: 50 });
            doc.text(row.fecha ? new Date(row.fecha).toLocaleDateString('es-SV') : '---', colX.fecha, currentY, { width: 46 });
            doc.text(row.fecha_vencimiento ? new Date(row.fecha_vencimiento).toLocaleDateString('es-SV') : '---', colX.venc, currentY, { width: 46 });
            const dias = parseInt(row.dias_credito) || 0;
            doc.text(dias > 0 ? String(dias) : '—', colX.dias, currentY, { width: 28, align: 'center' });
            doc.text(row.provider_nombre?.toUpperCase() || '---', colX.proveedor, currentY, { width: 180, truncate: true });
            doc.text(`$${parseFloat(row.total || 0).toFixed(2)}`, colX.total, currentY, { width: 80, align: 'right' });

            // Estado badge
            const statusColors = {
                'PENDIENTE': '#f59e0b',
                'SOLICITADO': '#3b82f6',
                'ENTREGADO': '#22c55e'
            };
            doc.font('Helvetica-Bold').fillColor(statusColors[row.status] || '#6b7280');
            doc.text(row.status || '---', colX.estado, currentY);
            doc.fillColor('black');
            doc.font('Helvetica');

            grandTotal += parseFloat(row.total || 0);
            rowCount++;
            currentY += 14;
        });

        // Total row
        doc.moveTo(startX, currentY).lineTo(startX + tableWidth, currentY).stroke();
        currentY += 10;
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('TOTAL GENERAL:', startX + 320, currentY, { width: 50, align: 'right' });
        doc.text(`$${grandTotal.toFixed(2)}`, startX + 400, currentY, { width: 110, align: 'right' });
        currentY += 15;
        doc.fontSize(7).font('Helvetica').fillColor('#6b7280');
        doc.text(`Total de quedanes: ${rowCount}`, startX, currentY);
        doc.fillColor('black');

        doc.end();

    } catch (error) {
        console.error('Error al generar reporte de quedanes:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error al generar reporte de quedanes: ' + error.message });
        }
    }
};

module.exports = {
    getQuedans,
    getQuedanById,
    createQuedan,
    updateQuedan,
    deleteQuedan,
    deliverQuedan,
    requestQuedan,
    revertQuedan,
    getQuedanReportPDF
};
