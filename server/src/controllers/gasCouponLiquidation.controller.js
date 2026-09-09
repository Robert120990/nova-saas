const pool = require('../config/db');
const reportPdfHelper = require('../utils/reportPdfHelper');
const excelService = require('../services/excel.service');

/**
 * Controller for Gas Station Coupon Liquidation (Sistema vs Físicos)
 */

const formatDbDate = (val) => {
    if (!val) return null;
    if (val instanceof Date) return val.toISOString().split('T')[0];
    if (typeof val === 'string') return val.split('T')[0];
    return null;
};

// 1. Obtener listado de liquidaciones
exports.getLiquidaciones = async (req, res) => {
    try {
        const companyId = req.company_id;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 15));
        const offset = (page - 1) * limit;

        const { search, branch_id, startDate, endDate, distribuidora_id, estado } = req.query;

        const where = ['l.company_id = ?'];
        const params = [companyId];

        if (req.user?.branch_id) {
            where.push('l.branch_id = ?');
            params.push(req.user.branch_id);
        } else if (branch_id) {
            where.push('l.branch_id = ?');
            params.push(branch_id);
        }

        if (startDate) {
            where.push('l.fecha >= ?');
            params.push(startDate);
        }
        if (endDate) {
            where.push('l.fecha <= ?');
            params.push(endDate);
        }
        if (distribuidora_id) {
            where.push('l.distribuidora_id = ?');
            params.push(distribuidora_id);
        }
        if (estado) {
            where.push('l.estado = ?');
            params.push(estado);
        }
        if (search) {
            where.push('(l.correlativo LIKE ? OR l.responsable LIKE ? OR l.comentario LIKE ? OR l.distribuidora_nombre LIKE ?)');
            const term = `%${search}%`;
            params.push(term, term, term, term);
        }

        const whereClause = where.join(' AND ');

        // Totales y resumen
        const [totalRows] = await pool.query(
            `SELECT COUNT(*) as total,
                    COALESCE(SUM(l.total_monto_sistema), 0) as sum_sistema,
                    COALESCE(SUM(l.total_monto_fisico), 0) as sum_fisico,
                    COALESCE(SUM(l.diferencia_monto), 0) as sum_diferencia,
                    COALESCE(SUM(l.total_cupones_sistema), 0) as sum_cant_sistema,
                    COALESCE(SUM(l.total_cupones_fisicos), 0) as sum_cant_fisico
             FROM gas_station_coupon_liquidations l
             WHERE ${whereClause}`,
            params
        );

        const total = totalRows[0]?.total || 0;
        const totalPages = Math.ceil(total / limit);

        // Filas paginadas
        const [rows] = await pool.query(
            `SELECT l.*, b.nombre as branch_name, COALESCE(u.nombre, u.username) as user_name
             FROM gas_station_coupon_liquidations l
             LEFT JOIN branches b ON l.branch_id = b.id
             LEFT JOIN users u ON l.created_by = u.id
             WHERE ${whereClause}
             ORDER BY l.id DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        res.json({
            data: rows,
            total,
            page,
            totalPages,
            summary: {
                total_sistema: parseFloat(totalRows[0]?.sum_sistema || 0),
                total_fisico: parseFloat(totalRows[0]?.sum_fisico || 0),
                total_diferencia: parseFloat(totalRows[0]?.sum_diferencia || 0),
                total_cupones_sistema: parseInt(totalRows[0]?.sum_cant_sistema || 0),
                total_cupones_fisicos: parseInt(totalRows[0]?.sum_cant_fisico || 0)
            }
        });
    } catch (error) {
        console.error('Error in getLiquidaciones:', error);
        res.status(500).json({ message: 'Error al obtener liquidaciones de cupones' });
    }
};

// 2. Obtener cupones de turnos pendientes de liquidar
exports.getPendingCupones = async (req, res) => {
    try {
        const companyId = req.company_id;
        const { branch_id, startDate, endDate, distribuidora_id, search } = req.query;

        const where = [
            'cl.company_id = ?',
            "(c.estado_liquidacion = 'pendiente' OR c.estado_liquidacion IS NULL OR c.liquidation_id IS NULL)"
        ];
        const params = [companyId];

        if (req.user?.branch_id) {
            where.push('cl.branch_id = ?');
            params.push(req.user.branch_id);
        } else if (branch_id) {
            where.push('cl.branch_id = ?');
            params.push(branch_id);
        }

        if (startDate) {
            where.push('cl.fecha_turno >= ?');
            params.push(startDate);
        }
        if (endDate) {
            where.push('cl.fecha_turno <= ?');
            params.push(endDate);
        }
        if (distribuidora_id) {
            where.push('c.distribuidora_id = ?');
            params.push(distribuidora_id);
        }
        if (search) {
            where.push('(c.cupon LIKE ? OR c.distribuidora_nombre LIKE ? OR d.descripcion LIKE ?)');
            const term = `%${search}%`;
            params.push(term, term, term);
        }

        const whereClause = where.join(' AND ');

        const [rows] = await pool.query(
            `SELECT c.id, c.closeout_id, c.cupon, c.distribuidora_id,
                    COALESCE(c.distribuidora_nombre, dist.descripcion, '') as distribuidora_nombre,
                    c.producto_codigo, c.producto_descripcion,
                    c.despachador_id,
                    d.codigo as despachador_codigo,
                    d.descripcion as despachador_nombre,
                    c.monto,
                    cl.fecha_turno, cl.numero_turno, cl.branch_id,
                    b.nombre as branch_name
             FROM gas_station_closeout_cupones c
             JOIN gas_station_closeouts cl ON c.closeout_id = cl.id
             LEFT JOIN branches b ON cl.branch_id = b.id
             LEFT JOIN gas_station_despachadores d ON c.despachador_id = d.id
             LEFT JOIN gas_station_distributors dist ON c.distribuidora_id = dist.id
             WHERE ${whereClause}
             ORDER BY cl.fecha_turno ASC, cl.numero_turno ASC, c.cupon ASC`,
            params
        );

        res.json(rows.map(r => ({
            ...r,
            monto: parseFloat(r.monto) || 0
        })));
    } catch (error) {
        console.error('Error in getPendingCupones:', error);
        res.status(500).json({ message: 'Error al obtener cupones pendientes de liquidación' });
    }
};

// 3. Obtener liquidación por ID con sus items
exports.getLiquidacionById = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id;

        const [liquidations] = await pool.query(
            `SELECT l.*, b.nombre as branch_name, COALESCE(u.nombre, u.username) as user_name
             FROM gas_station_coupon_liquidations l
             LEFT JOIN branches b ON l.branch_id = b.id
             LEFT JOIN users u ON l.created_by = u.id
             WHERE l.id = ? AND l.company_id = ?`,
            [id, companyId]
        );

        if (liquidations.length === 0) {
            return res.status(404).json({ message: 'Liquidación no encontrada' });
        }

        const liquidation = liquidations[0];

        const [items] = await pool.query(
            `SELECT * FROM gas_station_coupon_liquidation_items
             WHERE liquidation_id = ?
             ORDER BY 
               CASE estado_conciliacion
                 WHEN 'conciliado' THEN 1
                 WHEN 'faltante' THEN 2
                 WHEN 'sobrante' THEN 3
                 ELSE 4
               END ASC,
               cupon ASC`,
            [id]
        );

        res.json({
            ...liquidation,
            items: items.map(it => ({
                ...it,
                monto_sistema: parseFloat(it.monto_sistema) || 0,
                monto_fisico: parseFloat(it.monto_fisico) || 0,
                diferencia: parseFloat(it.diferencia) || 0
            }))
        });
    } catch (error) {
        console.error('Error in getLiquidacionById:', error);
        res.status(500).json({ message: 'Error al obtener detalle de la liquidación' });
    }
};

// 4. Crear nueva liquidación de cupones
exports.createLiquidacion = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const companyId = req.company_id;
        const userId = req.user?.id || null;
        const {
            branch_id,
            fecha,
            distribuidora_id,
            distribuidora_nombre,
            responsable,
            comentario,
            estado = 'liquidado',
            items = []
        } = req.body;

        if (!branch_id) {
            await conn.rollback();
            return res.status(400).json({ message: 'Debe especificar la sucursal' });
        }

        if (!items || items.length === 0) {
            await conn.rollback();
            return res.status(400).json({ message: 'Debe incluir al menos un cupón en la liquidación' });
        }

        // Generar correlativo único por empresa y año
        const year = new Date(fecha || Date.now()).getFullYear();
        const [[{ count }]] = await conn.query(
            `SELECT COUNT(*) as count FROM gas_station_coupon_liquidations 
             WHERE company_id = ? AND YEAR(fecha) = ?`,
            [companyId, year]
        );
        const correlativo = `LIQ-CUP-${year}-${String(count + 1).padStart(4, '0')}`;

        // Calcular totales de conciliación
        let totalCuponesSistema = 0;
        let totalMontoSistema = 0;
        let totalCuponesFisicos = 0;
        let totalMontoFisico = 0;

        for (const it of items) {
            const mSistema = parseFloat(it.monto_sistema) || 0;
            const mFisico = parseFloat(it.monto_fisico) || 0;

            if (it.estado_conciliacion === 'conciliado' || it.estado_conciliacion === 'faltante') {
                totalCuponesSistema++;
                totalMontoSistema += mSistema;
            }
            if (it.estado_conciliacion === 'conciliado' || it.estado_conciliacion === 'sobrante') {
                totalCuponesFisicos++;
                totalMontoFisico += mFisico;
            }
        }

        const diferenciaMonto = totalMontoFisico - totalMontoSistema;

        // Insertar encabezado de liquidación
        const [liqResult] = await conn.query(
            `INSERT INTO gas_station_coupon_liquidations (
                company_id, branch_id, correlativo, fecha, distribuidora_id,
                distribuidora_nombre, responsable, comentario,
                total_cupones_sistema, total_monto_sistema,
                total_cupones_fisicos, total_monto_fisico,
                diferencia_monto, estado, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                companyId,
                branch_id,
                correlativo,
                formatDbDate(fecha) || new Date().toISOString().split('T')[0],
                distribuidora_id || null,
                distribuidora_nombre || null,
                responsable || null,
                comentario || null,
                totalCuponesSistema,
                totalMontoSistema,
                totalCuponesFisicos,
                totalMontoFisico,
                diferenciaMonto,
                estado,
                userId
            ]
        );

        const liquidationId = liqResult.insertId;

        // Insertar items de liquidación
        for (const it of items) {
            const mSistema = parseFloat(it.monto_sistema) || 0;
            const mFisico = parseFloat(it.monto_fisico) || 0;
            const diff = mFisico - mSistema;

            await conn.query(
                `INSERT INTO gas_station_coupon_liquidation_items (
                    liquidation_id, closeout_cupon_id, cupon, distribuidora_id,
                    distribuidora_nombre, producto_codigo, producto_descripcion,
                    despachador_id, despachador_nombre, closeout_id,
                    fecha_turno, numero_turno, monto_sistema, monto_fisico,
                    diferencia, estado_conciliacion, notas
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    liquidationId,
                    it.closeout_cupon_id || null,
                    String(it.cupon || '').trim(),
                    it.distribuidora_id || null,
                    it.distribuidora_nombre || '',
                    it.producto_codigo || '',
                    it.producto_descripcion || '',
                    it.despachador_id || null,
                    it.despachador_nombre || '',
                    it.closeout_id || null,
                    formatDbDate(it.fecha_turno),
                    it.numero_turno || null,
                    mSistema,
                    mFisico,
                    diff,
                    it.estado_conciliacion || 'conciliado',
                    it.notas || null
                ]
            );

            // Si es un cupón del sistema y el estado no es borrador, actualizar el cupón en los cierres de turno
            if (it.closeout_cupon_id && estado === 'liquidado') {
                const targetEstado = it.estado_conciliacion === 'faltante' ? 'faltante' : 'liquidado';
                await conn.query(
                    `UPDATE gas_station_closeout_cupones 
                     SET liquidation_id = ?, estado_liquidacion = ?
                     WHERE id = ?`,
                    [liquidationId, targetEstado, it.closeout_cupon_id]
                );
            }
        }

        await conn.commit();
        res.status(201).json({
            id: liquidationId,
            correlativo,
            message: 'Liquidación de cupones registrada exitosamente'
        });
    } catch (error) {
        await conn.rollback();
        console.error('Error in createLiquidacion:', error);
        res.status(500).json({ message: 'Error al procesar liquidación de cupones: ' + error.message });
    } finally {
        conn.release();
    }
};

// 5. Actualizar liquidación (observaciones o anulación)
exports.updateLiquidacion = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;
        const companyId = req.company_id;
        const { responsable, comentario, estado } = req.body;

        const [existing] = await conn.query(
            `SELECT * FROM gas_station_coupon_liquidations WHERE id = ? AND company_id = ?`,
            [id, companyId]
        );

        if (existing.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Liquidación no encontrada' });
        }

        const current = existing[0];

        // Si se anula la liquidación, liberar los cupones en los cierres de turno
        if (estado === 'anulado' && current.estado !== 'anulado') {
            await conn.query(
                `UPDATE gas_station_closeout_cupones 
                 SET liquidation_id = NULL, estado_liquidacion = 'pendiente' 
                 WHERE liquidation_id = ?`,
                [id]
            );
        }

        await conn.query(
            `UPDATE gas_station_coupon_liquidations
             SET responsable = COALESCE(?, responsable),
                 comentario = COALESCE(?, comentario),
                 estado = COALESCE(?, estado)
             WHERE id = ?`,
            [responsable, comentario, estado, id]
        );

        await conn.commit();
        res.json({ message: 'Liquidación actualizada correctamente' });
    } catch (error) {
        await conn.rollback();
        console.error('Error in updateLiquidacion:', error);
        res.status(500).json({ message: 'Error al actualizar liquidación' });
    } finally {
        conn.release();
    }
};

// 6. Eliminar liquidación (revertir y borrar)
exports.deleteLiquidacion = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;
        const companyId = req.company_id;

        const [existing] = await conn.query(
            `SELECT id, estado FROM gas_station_coupon_liquidations WHERE id = ? AND company_id = ?`,
            [id, companyId]
        );

        if (existing.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Liquidación no encontrada' });
        }

        // Liberar los cupones vinculados para que vuelvan a estar pendientes
        await conn.query(
            `UPDATE gas_station_closeout_cupones 
             SET liquidation_id = NULL, estado_liquidacion = 'pendiente' 
             WHERE liquidation_id = ?`,
            [id]
        );

        // Eliminar liquidación (items se eliminan en cascada por FK)
        await conn.query(`DELETE FROM gas_station_coupon_liquidations WHERE id = ?`, [id]);

        await conn.commit();
        res.json({ message: 'Liquidación eliminada y cupones liberados correctamente' });
    } catch (error) {
        await conn.rollback();
        console.error('Error in deleteLiquidacion:', error);
        res.status(500).json({ message: 'Error al eliminar liquidación' });
    } finally {
        conn.release();
    }
};

// 7. Generar reporte PDF formal
exports.exportPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id;

        const [liquidations] = await pool.query(
            `SELECT l.*, b.nombre as branch_name, COALESCE(u.nombre, u.username) as user_name
             FROM gas_station_coupon_liquidations l
             LEFT JOIN branches b ON l.branch_id = b.id
             LEFT JOIN users u ON l.created_by = u.id
             WHERE l.id = ? AND l.company_id = ?`,
            [id, companyId]
        );

        if (liquidations.length === 0) {
            return res.status(404).json({ message: 'Liquidación no encontrada' });
        }

        const liq = liquidations[0];
        const [items] = await pool.query(
            `SELECT * FROM gas_station_coupon_liquidation_items 
             WHERE liquidation_id = ? 
             ORDER BY 
               CASE estado_conciliacion
                 WHEN 'conciliado' THEN 1
                 WHEN 'faltante' THEN 2
                 WHEN 'sobrante' THEN 3
                 ELSE 4
               END ASC,
               cupon ASC`,
            [id]
        );

        const company = await reportPdfHelper.getCompanyInfo(companyId);
        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

        const fechaFmt = liq.fecha ? new Date(liq.fecha).toLocaleDateString('es-SV', { timeZone: 'UTC' }) : '';
        const subtitle = `SUCURSAL: ${(liq.branch_name || 'GENERAL').toUpperCase()} | DISTRIBUIDORA: ${(liq.distribuidora_nombre || 'TODAS').toUpperCase()} | ESTADO: ${liq.estado.toUpperCase()}`;

        reportPdfHelper.renderHeader(
            doc,
            company,
            `LIQUIDACIÓN DE CUPONES: ${liq.correlativo}`,
            `FECHA DE EMISIÓN: ${fechaFmt}`,
            'landscape',
            subtitle
        );

        // Tarjetas de Resumen Financiero
        const startY = doc.y + 4;
        const colW = 125;
        const cardH = 34;

        const metrics = [
            { label: 'CUPONES SISTEMA', val: `${liq.total_cupones_sistema} uds. (${reportPdfHelper.fmt(liq.total_monto_sistema)})`, color: '#475569' },
            { label: 'CUPONES FÍSICOS', val: `${liq.total_cupones_fisicos} uds. (${reportPdfHelper.fmt(liq.total_monto_fisico)})`, color: '#0284c7' },
            { label: 'DIFERENCIA NETA', val: reportPdfHelper.fmt(liq.diferencia_monto), color: liq.diferencia_monto < 0 ? '#b91c1c' : (liq.diferencia_monto > 0 ? '#15803d' : '#334155') },
            { label: 'RESPONSABLE', val: liq.responsable || 'NO DEFINIDO', color: '#334155' },
            { label: 'REGISTRADO POR', val: liq.user_name || 'SISTEMA', color: '#64748b' }
        ];

        metrics.forEach((m, idx) => {
            const x = 30 + (idx * (colW + 12));
            doc.rect(x, startY, colW, cardH).fillAndStroke('#f8fafc', '#e2e8f0');
            doc.fillColor('#64748b').fontSize(6.5).font('Helvetica-Bold').text(m.label, x + 6, startY + 5, { width: colW - 12 });
            doc.fillColor(m.color).fontSize(8.5).font('Helvetica-Bold').text(m.val, x + 6, startY + 16, { width: colW - 12, ellipsis: true });
        });

        doc.y = startY + cardH + 12;

        // Comentario si existe
        if (liq.comentario) {
            doc.rect(30, doc.y, 732, 16).fillAndStroke('#fffbeb', '#fde68a');
            doc.fillColor('#92400e').fontSize(7).font('Helvetica-Bold').text(`OBSERVACIONES: ${liq.comentario}`, 36, doc.y + 4, { width: 720 });
            doc.y += 20;
        }

        // Definición de columnas para la tabla de items
        const cols = [
            { label: 'ESTADO', key: 'estado_conciliacion', width: 75, align: 'left' },
            { label: 'N° CUPÓN', key: 'cupon', width: 70, align: 'left' },
            { label: 'DISTRIBUIDORA', key: 'distribuidora_nombre', width: 110, align: 'left' },
            { label: 'FECHA TURNO', key: 'fecha_turno', width: 65, align: 'center' },
            { label: 'TURNO', key: 'numero_turno', width: 45, align: 'center' },
            { label: 'DESPACHADOR', key: 'despachador_nombre', width: 120, align: 'left' },
            { label: 'PRODUCTO', key: 'producto_descripcion', width: 95, align: 'left' },
            { label: 'MONTO SISTEMA', key: 'monto_sistema', width: 75, align: 'right' },
            { label: 'MONTO FÍSICO', key: 'monto_fisico', width: 75, align: 'right' }
        ];

        // Función para renderizar cabecera de tabla
        const renderTableHead = () => {
            const hY = doc.y;
            doc.rect(30, hY, 732, 14).fill('#f1f5f9');
            let curX = 35;
            cols.forEach(c => {
                doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5).text(c.label, curX, hY + 3.5, { width: c.width, align: c.align });
                curX += c.width;
            });
            doc.y = hY + 14;
            doc.moveTo(30, doc.y).lineTo(762, doc.y).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
        };

        renderTableHead();

        // Renderizar items
        items.forEach((item) => {
            if (doc.y > 520) {
                doc.addPage({ size: 'LETTER', layout: 'landscape', margin: 30 });
                reportPdfHelper.renderHeader(doc, company, `LIQUIDACIÓN DE CUPONES: ${liq.correlativo}`, `FECHA: ${fechaFmt}`, 'landscape', subtitle);
                renderTableHead();
            }

            const rowY = doc.y;
            let curX = 35;

            // Badge color según estado
            let estadoColor = '#15803d'; // conciliado (verde)
            let estadoLabel = 'CONCILIADO';
            if (item.estado_conciliacion === 'faltante') {
                estadoColor = '#b91c1c';
                estadoLabel = 'FALTANTE';
            } else if (item.estado_conciliacion === 'sobrante') {
                estadoColor = '#b45309';
                estadoLabel = 'SOBRANTE';
            }

            const itemFecha = item.fecha_turno ? new Date(item.fecha_turno).toLocaleDateString('es-SV', { timeZone: 'UTC' }) : '-';

            cols.forEach(c => {
                doc.font('Helvetica').fontSize(6.5);
                if (c.key === 'estado_conciliacion') {
                    doc.font('Helvetica-Bold').fillColor(estadoColor).text(estadoLabel, curX, rowY + 3, { width: c.width, align: c.align });
                } else if (c.key === 'fecha_turno') {
                    doc.fillColor('#334155').text(itemFecha, curX, rowY + 3, { width: c.width, align: c.align });
                } else if (c.key === 'monto_sistema') {
                    doc.fillColor('#334155').text(reportPdfHelper.fmt(item.monto_sistema), curX, rowY + 3, { width: c.width, align: c.align });
                } else if (c.key === 'monto_fisico') {
                    doc.font('Helvetica-Bold').fillColor(item.monto_fisico > 0 ? '#0f172a' : '#94a3b8').text(reportPdfHelper.fmt(item.monto_fisico), curX, rowY + 3, { width: c.width, align: c.align });
                } else {
                    doc.fillColor('#334155').text(String(item[c.key] || '-'), curX, rowY + 3, { width: c.width, align: c.align, ellipsis: true });
                }
                curX += c.width;
            });

            doc.y = rowY + 12;
            doc.moveTo(30, doc.y).lineTo(762, doc.y).strokeColor('#f1f5f9').lineWidth(0.5).stroke();
        });

        // Totales al pie de la tabla
        if (doc.y > 510) {
            doc.addPage({ size: 'LETTER', layout: 'landscape', margin: 30 });
            reportPdfHelper.renderHeader(doc, company, `LIQUIDACIÓN DE CUPONES: ${liq.correlativo}`, `FECHA: ${fechaFmt}`, 'landscape', subtitle);
        }

        const footY = doc.y + 2;
        doc.rect(30, footY, 732, 16).fill('#f8fafc');
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a').text('TOTALES LIQUIDADOS:', 35, footY + 4, { width: 550, align: 'right' });
        doc.fillColor('#0f172a').text(reportPdfHelper.fmt(liq.total_monto_sistema), 585, footY + 4, { width: 85, align: 'right' });
        doc.fillColor('#0f172a').text(reportPdfHelper.fmt(liq.total_monto_fisico), 675, footY + 4, { width: 80, align: 'right' });

        doc.y = footY + 24;

        // Cierre y paginación
        reportPdfHelper.renderClosingFooter(doc, 30, doc.y, items.length, 'Cupones Liquidados');
        reportPdfHelper.renderPageNumbers(doc);

        doc.end();
        const pdfBuffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Liquidacion_${liq.correlativo}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error in exportPDF liquidacion:', error);
        res.status(500).json({ message: 'Error al generar PDF de liquidación' });
    }
};

// 8. Exportar a Excel
exports.exportExcel = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id;

        const [liquidations] = await pool.query(
            `SELECT l.*, b.nombre as branch_name, COALESCE(u.nombre, u.username) as user_name
             FROM gas_station_coupon_liquidations l
             LEFT JOIN branches b ON l.branch_id = b.id
             LEFT JOIN users u ON l.created_by = u.id
             WHERE l.id = ? AND l.company_id = ?`,
            [id, companyId]
        );

        if (liquidations.length === 0) {
            return res.status(404).json({ message: 'Liquidación no encontrada' });
        }

        const liq = liquidations[0];
        const [items] = await pool.query(
            `SELECT * FROM gas_station_coupon_liquidation_items 
             WHERE liquidation_id = ? 
             ORDER BY estado_conciliacion ASC, cupon ASC`,
            [id]
        );

        const columns = [
            { header: 'Estado Conciliación', key: 'estado_conciliacion', width: 18 },
            { header: 'N° Cupón', key: 'cupon', width: 15 },
            { header: 'Distribuidora', key: 'distribuidora_nombre', width: 24 },
            { header: 'Fecha Turno', key: 'fecha_turno', width: 14 },
            { header: 'N° Turno', key: 'numero_turno', width: 10 },
            { header: 'Despachador', key: 'despachador_nombre', width: 26 },
            { header: 'Producto', key: 'producto_descripcion', width: 22 },
            { header: 'Monto Sistema ($)', key: 'monto_sistema', width: 16 },
            { header: 'Monto Físico ($)', key: 'monto_fisico', width: 16 },
            { header: 'Diferencia ($)', key: 'diferencia', width: 14 },
            { header: 'Notas / Observación', key: 'notas', width: 30 }
        ];

        const data = items.map(it => ({
            estado_conciliacion: it.estado_conciliacion.toUpperCase(),
            cupon: it.cupon,
            distribuidora_nombre: it.distribuidora_nombre,
            fecha_turno: it.fecha_turno ? new Date(it.fecha_turno).toLocaleDateString('es-SV', { timeZone: 'UTC' }) : '',
            numero_turno: it.numero_turno || '',
            despachador_nombre: it.despachador_nombre || '',
            producto_descripcion: it.producto_descripcion || '',
            monto_sistema: parseFloat(it.monto_sistema) || 0,
            monto_fisico: parseFloat(it.monto_fisico) || 0,
            diferencia: parseFloat(it.diferencia) || 0,
            notas: it.notas || ''
        }));

        const buffer = await excelService.createExcelBuffer({
            title: `LIQUIDACIÓN DE CUPONES ${liq.correlativo} - SUCURSAL: ${liq.branch_name || ''} - FECHA: ${liq.fecha ? new Date(liq.fecha).toLocaleDateString('es-SV', { timeZone: 'UTC' }) : ''}`,
            sheets: [{ name: 'Detalle de Cupones', columns, data }]
        });

        excelService.sendExcelResponse(res, buffer, `Liquidacion_Cupones_${liq.correlativo}.xlsx`);
    } catch (error) {
        console.error('Error in exportExcel liquidacion:', error);
        res.status(500).json({ message: 'Error al exportar liquidación a Excel' });
    }
};
