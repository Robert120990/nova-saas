const pool = require('../config/db');
const notificationService = require('../services/notification.service');
const reportPdfHelper = require('../utils/reportPdfHelper');
const excelService = require('../services/excel.service');
const pdfService = require('../services/pdf.service');
const mailer = require('../services/mailer.service');

function generateNumero(day, month, correlative) {
    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    const ccc = String(correlative).padStart(3, '0');
    return dd + mm + ccc;
}

exports.getAdvances = async (req, res) => {
    try {
        const { search, page = 1, limit = 15 } = req.query;
        const offset = (page - 1) * limit;
        const branchId = req.user?.branch_id || null;

        let where = 'WHERE a.company_id = ?';
        const params = [req.company_id];

        if (branchId) {
            where += ' AND a.branch_id = ?';
            params.push(branchId);
        }

        if (search) {
            where += ' AND (a.numero LIKE ? OR a.cliente_nombre LIKE ? OR c.nombre LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s);
        }

        const countQuery = `
            SELECT COUNT(*) as total 
            FROM gas_station_advances a 
            LEFT JOIN customers c ON a.cliente_id = c.id
            ${where}
        `;
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        const query = `
            SELECT a.*, c.nrc, c.nit, c.nombre AS customer_nombre, b.nombre AS branch_name
            FROM gas_station_advances a
            LEFT JOIN customers c ON a.cliente_id = c.id
            LEFT JOIN branches b ON a.branch_id = b.id
            ${where}
            ORDER BY a.fecha DESC, a.id DESC
            LIMIT ? OFFSET ?
        `;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        console.error('Error getAdvances:', error);
        res.status(500).json({ message: 'Error al obtener anticipos' });
    }
};

exports.getAvailableAdvancesByClient = async (req, res) => {
    try {
        const { cliente_id } = req.params;
        const [rows] = await pool.query(`
            SELECT COALESCE(SUM(monto_disponible), 0) as total_disponible FROM gas_station_advances
            WHERE company_id = ? AND cliente_id = ? AND monto_disponible > 0
        `, [req.company_id, cliente_id]);
        res.json({ total_disponible: parseFloat(rows[0].total_disponible) });
    } catch (error) {
        console.error('Error getAvailableAdvancesByClient:', error);
        res.status(500).json({ message: 'Error al obtener disponible' });
    }
};

exports.createAdvance = async (req, res) => {
    try {
        const {
            cliente_id,
            cliente_nombre,
            notas,
            fecha,
            efectivo,
            tarjeta,
            tarjeta_referencia,
            cheque,
            cheque_referencia,
            transferencia,
            transferencia_referencia
        } = req.body;

        const numEfectivo = Math.round((parseFloat(efectivo) || 0) * 100) / 100;
        const numTarjeta = Math.round((parseFloat(tarjeta) || 0) * 100) / 100;
        const numCheque = Math.round((parseFloat(cheque) || 0) * 100) / 100;
        const numTransferencia = Math.round((parseFloat(transferencia) || 0) * 100) / 100;

        const totalMonto = Math.round((numEfectivo + numTarjeta + numCheque + numTransferencia) * 100) / 100;

        if (!cliente_id || totalMonto <= 0) {
            return res.status(400).json({ message: 'Debe seleccionar un cliente y al menos un método de pago con monto mayor a cero' });
        }

        // Validación de referencias para métodos que no sean efectivo
        if (numTarjeta > 0 && !tarjeta_referencia?.trim()) {
            return res.status(400).json({ message: 'El número de referencia de la tarjeta es obligatorio cuando el monto es mayor a cero' });
        }
        if (numCheque > 0 && !cheque_referencia?.trim()) {
            return res.status(400).json({ message: 'El número de cheque es obligatorio cuando el monto es mayor a cero' });
        }
        if (numTransferencia > 0 && !transferencia_referencia?.trim()) {
            return res.status(400).json({ message: 'El número de comprobante o referencia de transferencia es obligatorio cuando el monto es mayor a cero' });
        }

        const advanceDate = fecha || new Date().toISOString().slice(0, 10);
        const d = new Date(advanceDate);
        const day = d.getDate();
        const month = d.getMonth() + 1;

        const [lastAdvance] = await pool.query(
            `SELECT numero FROM gas_station_advances WHERE company_id = ? AND fecha = ? ORDER BY id DESC LIMIT 1`,
            [req.company_id, advanceDate]
        );

        let correlative = 1;
        if (lastAdvance.length > 0) {
            const lastNum = parseInt(lastAdvance[0].numero.slice(-3), 10);
            correlative = lastNum + 1;
        }

        const numero = generateNumero(day, month, correlative);
        const branchId = req.user?.branch_id || null;

        const [result] = await pool.query(
            `INSERT INTO gas_station_advances (
                company_id, branch_id, numero, fecha, cliente_id, cliente_nombre,
                monto, monto_disponible, notas,
                efectivo, tarjeta, tarjeta_referencia, cheque, cheque_referencia, transferencia, transferencia_referencia
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.company_id,
                branchId,
                numero,
                advanceDate,
                cliente_id,
                cliente_nombre || '',
                totalMonto,
                totalMonto,
                notas || '',
                numEfectivo,
                numTarjeta,
                tarjeta_referencia?.trim() || null,
                numCheque,
                cheque_referencia?.trim() || null,
                numTransferencia,
                transferencia_referencia?.trim() || null
            ]
        );

        const [created] = await pool.query(
            `SELECT a.*, c.nrc, c.nit, c.nombre AS customer_nombre, b.nombre AS branch_name 
             FROM gas_station_advances a 
             LEFT JOIN customers c ON a.cliente_id = c.id 
             LEFT JOIN branches b ON a.branch_id = b.id
             WHERE a.id = ?`,
            [result.insertId]
        );

        const adv = created[0];
        notificationService.notify('gas_advance_given', req.company_id, req.user.branch_id, {
            despachador_nombre: adv.cliente_nombre || adv.customer_nombre || '',
            monto: adv.monto || 0,
            fecha: adv.fecha || '',
            sucursal: req.branch_name || ''
        }).catch(() => {});

        res.status(201).json(adv);
    } catch (error) {
        console.error('Error createAdvance:', error);
        res.status(500).json({ message: 'Error al crear anticipo' });
    }
};

exports.updateAdvance = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            cliente_id,
            cliente_nombre,
            notas,
            fecha,
            efectivo,
            tarjeta,
            tarjeta_referencia,
            cheque,
            cheque_referencia,
            transferencia,
            transferencia_referencia
        } = req.body;

        const numEfectivo = Math.round((parseFloat(efectivo) || 0) * 100) / 100;
        const numTarjeta = Math.round((parseFloat(tarjeta) || 0) * 100) / 100;
        const numCheque = Math.round((parseFloat(cheque) || 0) * 100) / 100;
        const numTransferencia = Math.round((parseFloat(transferencia) || 0) * 100) / 100;

        const totalMonto = Math.round((numEfectivo + numTarjeta + numCheque + numTransferencia) * 100) / 100;

        if (!cliente_id || totalMonto <= 0) {
            return res.status(400).json({ message: 'Debe seleccionar un cliente y al menos un método de pago con monto mayor a cero' });
        }

        // Validación de referencias
        if (numTarjeta > 0 && !tarjeta_referencia?.trim()) {
            return res.status(400).json({ message: 'El número de referencia de la tarjeta es obligatorio cuando el monto es mayor a cero' });
        }
        if (numCheque > 0 && !cheque_referencia?.trim()) {
            return res.status(400).json({ message: 'El número de cheque es obligatorio cuando el monto es mayor a cero' });
        }
        if (numTransferencia > 0 && !transferencia_referencia?.trim()) {
            return res.status(400).json({ message: 'El número de comprobante o referencia de transferencia es obligatorio cuando el monto es mayor a cero' });
        }

        const [existing] = await pool.query(
            `SELECT * FROM gas_station_advances WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (existing.length === 0) return res.status(404).json({ message: 'Anticipo no encontrado' });

        const advance = existing[0];
        const usedAmount = Math.round((parseFloat(advance.monto) - parseFloat(advance.monto_disponible)) * 100) / 100;
        if (totalMonto < usedAmount) {
            return res.status(400).json({ message: `El nuevo monto total ($${totalMonto.toFixed(2)}) no puede ser menor a los $${usedAmount.toFixed(2)} ya utilizados en cierres de gasolinera` });
        }
        const newDisponible = Math.round((totalMonto - usedAmount) * 100) / 100;

        const advanceDate = fecha || advance.fecha;
        const d = new Date(advanceDate);
        const day = d.getDate();
        const month = d.getMonth() + 1;

        const [lastAdvance] = await pool.query(
            `SELECT numero FROM gas_station_advances WHERE company_id = ? AND fecha = ? AND id != ? ORDER BY id DESC LIMIT 1`,
            [req.company_id, advanceDate, id]
        );

        let correlative = 1;
        if (lastAdvance.length > 0) {
            const lastNum = parseInt(lastAdvance[0].numero.slice(-3), 10);
            correlative = lastNum + 1;
        }
        const numero = generateNumero(day, month, correlative);

        await pool.query(
            `UPDATE gas_station_advances SET 
                numero = ?, fecha = ?, cliente_id = ?, cliente_nombre = ?,
                monto = ?, monto_disponible = ?, notas = ?,
                efectivo = ?, tarjeta = ?, tarjeta_referencia = ?, cheque = ?, cheque_referencia = ?, transferencia = ?, transferencia_referencia = ?
             WHERE id = ?`,
            [
                numero,
                advanceDate,
                cliente_id,
                cliente_nombre || '',
                totalMonto,
                newDisponible,
                notas || '',
                numEfectivo,
                numTarjeta,
                tarjeta_referencia?.trim() || null,
                numCheque,
                cheque_referencia?.trim() || null,
                numTransferencia,
                transferencia_referencia?.trim() || null,
                id
            ]
        );

        const [updated] = await pool.query(
            `SELECT a.*, c.nrc, c.nit, c.nombre AS customer_nombre, b.nombre AS branch_name 
             FROM gas_station_advances a 
             LEFT JOIN customers c ON a.cliente_id = c.id 
             LEFT JOIN branches b ON a.branch_id = b.id
             WHERE a.id = ?`,
            [id]
        );

        res.json(updated[0]);
    } catch (error) {
        console.error('Error updateAdvance:', error);
        res.status(500).json({ message: 'Error al actualizar anticipo' });
    }
};

exports.deleteAdvance = async (req, res) => {
    try {
        const { id } = req.params;
        const [existing] = await pool.query(
            `SELECT * FROM gas_station_advances WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (existing.length === 0) return res.status(404).json({ message: 'Anticipo no encontrado' });

        const usedAmount = parseFloat(existing[0].monto) - parseFloat(existing[0].monto_disponible);
        if (usedAmount > 0) {
            return res.status(400).json({ message: `No se puede eliminar porque ya se han utilizado $${usedAmount.toFixed(2)} de este anticipo en cierres` });
        }

        await pool.query(`DELETE FROM gas_station_advances WHERE id = ?`, [id]);
        res.json({ message: 'Anticipo eliminado' });
    } catch (error) {
        console.error('Error deleteAdvance:', error);
        res.status(500).json({ message: 'Error al eliminar anticipo' });
    }
};

/**
 * Reporte de Pagos Anticipados (PDF y Excel)
 * Aplica el estándar contable unificado con reportPdfHelper.
 */
exports.getAdvancesReportPDF = async (req, res) => {
    try {
        const { start_date, end_date, branch_id, cliente_id, format } = req.query;
        const companyId = req.company_id;

        if (!companyId) {
            return res.status(400).json({ message: 'Contexto de empresa no encontrado' });
        }

        let where = 'WHERE a.company_id = ?';
        const params = [companyId];

        if (branch_id && branch_id !== 'all') {
            where += ' AND a.branch_id = ?';
            params.push(branch_id);
        }

        if (cliente_id && cliente_id !== 'all') {
            where += ' AND a.cliente_id = ?';
            params.push(cliente_id);
        }

        if (start_date && end_date) {
            where += ' AND a.fecha BETWEEN ? AND ?';
            params.push(start_date, end_date);
        } else if (start_date) {
            where += ' AND a.fecha >= ?';
            params.push(start_date);
        } else if (end_date) {
            where += ' AND a.fecha <= ?';
            params.push(end_date);
        }

        const query = `
            SELECT a.*, c.nrc, c.nit, c.nombre AS customer_nombre, b.nombre AS branch_name
            FROM gas_station_advances a
            LEFT JOIN customers c ON a.cliente_id = c.id
            LEFT JOIN branches b ON a.branch_id = b.id
            ${where}
            ORDER BY a.fecha ASC, a.id ASC
        `;

        const [rows] = await pool.query(query, params);

        // Totales calculados
        const totals = rows.reduce((acc, r) => {
            const ef = parseFloat(r.efectivo) || 0;
            const tj = parseFloat(r.tarjeta) || 0;
            const ch = parseFloat(r.cheque) || 0;
            const tr = parseFloat(r.transferencia) || 0;
            const mo = parseFloat(r.monto) || 0;
            const di = parseFloat(r.monto_disponible) || 0;
            const ut = mo - di;

            acc.efectivo += ef;
            acc.tarjeta += tj;
            acc.cheque += ch;
            acc.transferencia += tr;
            acc.monto += mo;
            acc.disponible += di;
            acc.utilizado += ut;

            if (ef > 0) acc.countEfectivo++;
            if (tj > 0) acc.countTarjeta++;
            if (ch > 0) acc.countCheque++;
            if (tr > 0) acc.countTransferencia++;

            return acc;
        }, {
            efectivo: 0,
            tarjeta: 0,
            cheque: 0,
            transferencia: 0,
            monto: 0,
            disponible: 0,
            utilizado: 0,
            countEfectivo: 0,
            countTarjeta: 0,
            countCheque: 0,
            countTransferencia: 0
        });

        // 1. Exportación a Excel si format === 'excel'
        if (format === 'excel') {
            const excelRows = rows.map(r => {
                const mo = parseFloat(r.monto) || 0;
                const di = parseFloat(r.monto_disponible) || 0;
                const ut = mo - di;
                return {
                    fecha: reportPdfHelper.formatDate(r.fecha),
                    numero: r.numero,
                    sucursal: r.branch_name || 'N/A',
                    cliente: r.cliente_nombre || r.customer_nombre || 'N/A',
                    nrc: r.nrc || '---',
                    efectivo: parseFloat(r.efectivo) || 0,
                    tarjeta: parseFloat(r.tarjeta) || 0,
                    tarjeta_ref: r.tarjeta_referencia || '',
                    cheque: parseFloat(r.cheque) || 0,
                    cheque_ref: r.cheque_referencia || '',
                    transferencia: parseFloat(r.transferencia) || 0,
                    transferencia_ref: r.transferencia_referencia || '',
                    total_monto: mo,
                    disponible: di,
                    utilizado: ut,
                    notas: r.notas || ''
                };
            });

            // Fila de totales principales
            excelRows.push({
                fecha: '',
                numero: '',
                sucursal: '',
                cliente: 'TOTALES GENERALES',
                nrc: '',
                efectivo: totals.efectivo,
                tarjeta: totals.tarjeta,
                tarjeta_ref: '',
                cheque: totals.cheque,
                cheque_ref: '',
                transferencia: totals.transferencia,
                transferencia_ref: '',
                total_monto: totals.monto,
                disponible: totals.disponible,
                utilizado: totals.utilizado,
                notas: ''
            });

            // Cuadro Resumen al final en Excel
            excelRows.push({ fecha: '', numero: '', sucursal: '', cliente: '', nrc: '', efectivo: '', tarjeta: '', tarjeta_ref: '', cheque: '', cheque_ref: '', transferencia: '', transferencia_ref: '', total_monto: '', disponible: '', utilizado: '', notas: '' });
            excelRows.push({ fecha: 'CUADRO RESUMEN', numero: 'MÉTODO / CONCEPTO', sucursal: 'TOTAL MONTO ($)', cliente: '', nrc: '', efectivo: '', tarjeta: '', tarjeta_ref: '', cheque: '', cheque_ref: '', transferencia: '', transferencia_ref: '', total_monto: '', disponible: '', utilizado: '', notas: '' });
            excelRows.push({ fecha: 'RESUMEN', numero: 'Total Efectivo', sucursal: totals.efectivo, cliente: '', nrc: '', efectivo: '', tarjeta: '', tarjeta_ref: '', cheque: '', cheque_ref: '', transferencia: '', transferencia_ref: '', total_monto: '', disponible: '', utilizado: '', notas: '' });
            excelRows.push({ fecha: 'RESUMEN', numero: 'Total Tarjetas', sucursal: totals.tarjeta, cliente: '', nrc: '', efectivo: '', tarjeta: '', tarjeta_ref: '', cheque: '', cheque_ref: '', transferencia: '', transferencia_ref: '', total_monto: '', disponible: '', utilizado: '', notas: '' });
            excelRows.push({ fecha: 'RESUMEN', numero: 'Total Cheques', sucursal: totals.cheque, cliente: '', nrc: '', efectivo: '', tarjeta: '', tarjeta_ref: '', cheque: '', cheque_ref: '', transferencia: '', transferencia_ref: '', total_monto: '', disponible: '', utilizado: '', notas: '' });
            excelRows.push({ fecha: 'RESUMEN', numero: 'Total Transferencias', sucursal: totals.transferencia, cliente: '', nrc: '', efectivo: '', tarjeta: '', tarjeta_ref: '', cheque: '', cheque_ref: '', transferencia: '', transferencia_ref: '', total_monto: '', disponible: '', utilizado: '', notas: '' });
            excelRows.push({ fecha: 'RESUMEN', numero: 'TOTAL RECAUDADO EN ANTICIPOS', sucursal: totals.monto, cliente: '', nrc: '', efectivo: '', tarjeta: '', tarjeta_ref: '', cheque: '', cheque_ref: '', transferencia: '', transferencia_ref: '', total_monto: '', disponible: '', utilizado: '', notas: '' });
            excelRows.push({ fecha: 'RESUMEN', numero: 'Saldo Disponible Total', sucursal: totals.disponible, cliente: '', nrc: '', efectivo: '', tarjeta: '', tarjeta_ref: '', cheque: '', cheque_ref: '', transferencia: '', transferencia_ref: '', total_monto: '', disponible: '', utilizado: '', notas: '' });
            excelRows.push({ fecha: 'RESUMEN', numero: 'Total Monto Consumido en Cierres', sucursal: totals.utilizado, cliente: '', nrc: '', efectivo: '', tarjeta: '', tarjeta_ref: '', cheque: '', cheque_ref: '', transferencia: '', transferencia_ref: '', total_monto: '', disponible: '', utilizado: '', notas: '' });

            const buffer = await excelService.createExcelBuffer({
                title: 'REPORTE DE PAGOS ANTICIPADOS - GASOLINERA',
                sheets: [{
                    name: 'Anticipos',
                    columns: [
                        { header: 'Fecha', key: 'fecha', width: 13 },
                        { header: 'No. Anticipo', key: 'numero', width: 14 },
                        { header: 'Sucursal', key: 'sucursal', width: 20 },
                        { header: 'Cliente', key: 'cliente', width: 30 },
                        { header: 'NRC', key: 'nrc', width: 12 },
                        { header: 'Efectivo ($)', key: 'efectivo', width: 15 },
                        { header: 'Tarjeta ($)', key: 'tarjeta', width: 15 },
                        { header: 'Ref. Tarjeta', key: 'tarjeta_ref', width: 18 },
                        { header: 'Cheque ($)', key: 'cheque', width: 15 },
                        { header: 'No. Cheque', key: 'cheque_ref', width: 18 },
                        { header: 'Transf. ($)', key: 'transferencia', width: 15 },
                        { header: 'Ref. Transf.', key: 'transferencia_ref', width: 18 },
                        { header: 'Total ($)', key: 'total_monto', width: 16 },
                        { header: 'Disponible ($)', key: 'disponible', width: 16 },
                        { header: 'Utilizado ($)', key: 'utilizado', width: 16 },
                        { header: 'Notas', key: 'notas', width: 25 }
                    ],
                    data: excelRows
                }]
            });

            return excelService.sendExcelResponse(res, buffer, `Reporte_Pagos_Anticipados_${start_date || 'inicio'}_${end_date || 'fin'}.xlsx`);
        }

        // 2. Generación en PDF (Estándar contable unificado)
        const company = await reportPdfHelper.getCompanyInfo(companyId);
        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

        const periodText = (start_date && end_date)
            ? `DEL ${reportPdfHelper.formatDate(start_date)} AL ${reportPdfHelper.formatDate(end_date)}`
            : (start_date ? `DESDE ${reportPdfHelper.formatDate(start_date)}` : (end_date ? `HASTA ${reportPdfHelper.formatDate(end_date)}` : 'HISTORIAL COMPLETO'));

        let branchSubtitle = 'TODAS LAS SUCURSALES';
        if (branch_id && branch_id !== 'all' && rows.length > 0) {
            branchSubtitle = `SUCURSAL: ${rows[0].branch_name || branch_id}`;
        }
        if (cliente_id && cliente_id !== 'all' && rows.length > 0) {
            branchSubtitle += `  |  CLIENTE: ${rows[0].cliente_nombre || rows[0].customer_nombre || cliente_id}`;
        }

        const startX = 30;
        const totalW = 732;

        // Distribución de columnas (total 732pt):
        const colW = {
            fecha: 48,
            numero: 44,
            sucursal: 68,
            cliente: 110,
            efectivo: 56,
            tarjeta: 68,
            cheque: 68,
            transf: 68,
            total: 66,
            disponible: 68,
            utilizado: 68
        };

        const colX = {
            fecha: startX,
            numero: startX + colW.fecha,
            sucursal: startX + colW.fecha + colW.numero,
            cliente: startX + colW.fecha + colW.numero + colW.sucursal,
            efectivo: startX + colW.fecha + colW.numero + colW.sucursal + colW.cliente,
            tarjeta: startX + colW.fecha + colW.numero + colW.sucursal + colW.cliente + colW.efectivo,
            cheque: startX + colW.fecha + colW.numero + colW.sucursal + colW.cliente + colW.efectivo + colW.tarjeta,
            transf: startX + colW.fecha + colW.numero + colW.sucursal + colW.cliente + colW.efectivo + colW.tarjeta + colW.cheque,
            total: startX + colW.fecha + colW.numero + colW.sucursal + colW.cliente + colW.efectivo + colW.tarjeta + colW.cheque + colW.transf,
            disponible: startX + colW.fecha + colW.numero + colW.sucursal + colW.cliente + colW.efectivo + colW.tarjeta + colW.cheque + colW.transf + colW.total,
            utilizado: startX + colW.fecha + colW.numero + colW.sucursal + colW.cliente + colW.efectivo + colW.tarjeta + colW.cheque + colW.transf + colW.total + colW.disponible
        };

        const drawTableHeader = (y) => {
            doc.rect(startX, y, totalW, 15).fill('#f1f5f9');
            doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#0f172a');

            doc.text('FECHA', colX.fecha, y + 4, { width: colW.fecha, align: 'center' });
            doc.text('NO. ANT.', colX.numero, y + 4, { width: colW.numero, align: 'center' });
            doc.text('SUCURSAL', colX.sucursal, y + 4, { width: colW.sucursal, align: 'left' });
            doc.text('CLIENTE', colX.cliente, y + 4, { width: colW.cliente, align: 'left' });
            doc.text('EFECTIVO', colX.efectivo, y + 4, { width: colW.efectivo - 2, align: 'right' });
            doc.text('TARJETA (REF)', colX.tarjeta, y + 4, { width: colW.tarjeta - 2, align: 'right' });
            doc.text('CHEQUE (NO.)', colX.cheque, y + 4, { width: colW.cheque - 2, align: 'right' });
            doc.text('TRANSF. (REF)', colX.transf, y + 4, { width: colW.transf - 2, align: 'right' });
            doc.text('TOTAL ANT.', colX.total, y + 4, { width: colW.total - 2, align: 'right' });
            doc.text('DISPONIBLE', colX.disponible, y + 4, { width: colW.disponible - 2, align: 'right' });
            doc.text('UTILIZADO', colX.utilizado, y + 4, { width: colW.utilizado - 2, align: 'right' });

            doc.moveTo(startX, y + 15).lineTo(startX + totalW, y + 15).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
            return y + 17;
        };

        let currentY = reportPdfHelper.renderHeader(doc, company, 'REPORTE DE PAGOS ANTICIPADOS', periodText, 'landscape', branchSubtitle);
        currentY = drawTableHeader(currentY);

        for (const item of rows) {
            // Salto de página defensivo
            if (currentY > 490) {
                doc.addPage();
                currentY = reportPdfHelper.renderHeader(doc, company, 'REPORTE DE PAGOS ANTICIPADOS', periodText, 'landscape', branchSubtitle);
                currentY = drawTableHeader(currentY);
            }

            const hasRef = Boolean(item.tarjeta_referencia || item.cheque_referencia || item.transferencia_referencia);
            const rowH = hasRef ? 19 : 13;

            doc.font('Helvetica').fontSize(6.5).fillColor('#0f172a');

            // Fecha y No.
            doc.text(reportPdfHelper.formatDate(item.fecha), colX.fecha, currentY + 2, { width: colW.fecha, align: 'center' });
            doc.font('Helvetica-Bold').text(item.numero || '---', colX.numero, currentY + 2, { width: colW.numero, align: 'center' });
            doc.font('Helvetica');

            // Sucursal y Cliente
            doc.text(reportPdfHelper.fitText(doc, item.branch_name || 'N/A', colW.sucursal - 3), colX.sucursal, currentY + 2, { lineBreak: false });
            doc.text(reportPdfHelper.fitText(doc, item.cliente_nombre || item.customer_nombre || 'N/A', colW.cliente - 3), colX.cliente, currentY + 2, { lineBreak: false });

            // Efectivo
            doc.text(reportPdfHelper.fmt(item.efectivo), colX.efectivo, currentY + 2, { width: colW.efectivo - 2, align: 'right' });

            // Tarjeta + Ref
            doc.text(reportPdfHelper.fmt(item.tarjeta), colX.tarjeta, currentY + 2, { width: colW.tarjeta - 2, align: 'right' });
            if (item.tarjeta_referencia) {
                doc.fontSize(5.5).fillColor('#64748b').text(`Ref: ${item.tarjeta_referencia}`, colX.tarjeta, currentY + 10, { width: colW.tarjeta - 2, align: 'right', lineBreak: false });
                doc.fontSize(6.5).fillColor('#0f172a');
            }

            // Cheque + Ref
            doc.text(reportPdfHelper.fmt(item.cheque), colX.cheque, currentY + 2, { width: colW.cheque - 2, align: 'right' });
            if (item.cheque_referencia) {
                doc.fontSize(5.5).fillColor('#64748b').text(`No: ${item.cheque_referencia}`, colX.cheque, currentY + 10, { width: colW.cheque - 2, align: 'right', lineBreak: false });
                doc.fontSize(6.5).fillColor('#0f172a');
            }

            // Transferencia + Ref
            doc.text(reportPdfHelper.fmt(item.transferencia), colX.transf, currentY + 2, { width: colW.transf - 2, align: 'right' });
            if (item.transferencia_referencia) {
                doc.fontSize(5.5).fillColor('#64748b').text(`Ref: ${item.transferencia_referencia}`, colX.transf, currentY + 10, { width: colW.transf - 2, align: 'right', lineBreak: false });
                doc.fontSize(6.5).fillColor('#0f172a');
            }

            // Totales de la fila
            const itemMonto = parseFloat(item.monto) || 0;
            const itemDisp = parseFloat(item.monto_disponible) || 0;
            const itemUtil = itemMonto - itemDisp;

            doc.font('Helvetica-Bold').text(reportPdfHelper.fmt(itemMonto), colX.total, currentY + 2, { width: colW.total - 2, align: 'right' });
            doc.font('Helvetica').text(reportPdfHelper.fmt(itemDisp), colX.disponible, currentY + 2, { width: colW.disponible - 2, align: 'right' });
            doc.text(reportPdfHelper.fmt(itemUtil), colX.utilizado, currentY + 2, { width: colW.utilizado - 2, align: 'right' });

            // Línea separadora sutil
            currentY += rowH;
            doc.moveTo(startX, currentY).lineTo(startX + totalW, currentY).lineWidth(0.25).strokeColor('#f1f5f9').stroke();
            currentY += 1;
        }

        // Fila de Totales de la Tabla
        if (currentY > 490) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, 'REPORTE DE PAGOS ANTICIPADOS', periodText, 'landscape', branchSubtitle);
            currentY = drawTableHeader(currentY);
        }

        doc.moveTo(startX, currentY).lineTo(startX + totalW, currentY).lineWidth(1).strokeColor('#0f172a').stroke();
        currentY += 3;

        doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#0f172a');
        doc.text('TOTALES GENERALES', colX.cliente, currentY, { width: colW.cliente, align: 'left' });
        doc.text(reportPdfHelper.fmt(totals.efectivo), colX.efectivo, currentY, { width: colW.efectivo - 2, align: 'right' });
        doc.text(reportPdfHelper.fmt(totals.tarjeta), colX.tarjeta, currentY, { width: colW.tarjeta - 2, align: 'right' });
        doc.text(reportPdfHelper.fmt(totals.cheque), colX.cheque, currentY, { width: colW.cheque - 2, align: 'right' });
        doc.text(reportPdfHelper.fmt(totals.transferencia), colX.transf, currentY, { width: colW.transf - 2, align: 'right' });
        doc.text(reportPdfHelper.fmt(totals.monto), colX.total, currentY, { width: colW.total - 2, align: 'right' });
        doc.text(reportPdfHelper.fmt(totals.disponible), colX.disponible, currentY, { width: colW.disponible - 2, align: 'right' });
        doc.text(reportPdfHelper.fmt(totals.utilizado), colX.utilizado, currentY, { width: colW.utilizado - 2, align: 'right' });

        currentY += 11;
        doc.moveTo(startX, currentY).lineTo(startX + totalW, currentY).lineWidth(1).strokeColor('#0f172a').stroke();
        currentY += 16;

        // ========================================================
        // CUADRO RESUMEN AL FINAL (REQUISITO EXPRESO DEL USUARIO)
        // ========================================================
        const summaryBoxH = 82;
        if (currentY + summaryBoxH > 500) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, 'REPORTE DE PAGOS ANTICIPADOS', periodText, 'landscape', branchSubtitle);
        }

        const boxW = totalW;
        const boxX = startX;

        // Fondo y borde del cuadro resumen
        doc.rect(boxX, currentY, boxW, summaryBoxH).fillAndStroke('#f8fafc', '#cbd5e1');

        // Barra de título del cuadro resumen
        doc.rect(boxX, currentY, boxW, 16).fill('#1e293b');
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#ffffff');
        doc.text('CUADRO RESUMEN CONSOLIDADO DE PAGOS ANTICIPADOS', boxX + 12, currentY + 4);

        const cardY = currentY + 22;
        const col1W = 340;
        const col2X = boxX + 370;
        const col2W = 340;

        // Columna 1: Desglose por Método de Pago
        doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#475569');
        doc.text('DESGLOSE POR FORMA DE PAGO', boxX + 15, cardY);
        doc.moveTo(boxX + 15, cardY + 9).lineTo(boxX + 340, cardY + 9).lineWidth(0.5).strokeColor('#e2e8f0').stroke();

        let lY = cardY + 12;
        const printSummaryLine = (label, count, amount, bold = false) => {
            doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.5).fillColor('#0f172a');
            doc.text(label, boxX + 15, lY, { width: 140 });
            doc.text(`(${count} movs.)`, boxX + 160, lY, { width: 60, align: 'center' });
            doc.text(reportPdfHelper.fmt(amount), boxX + 225, lY, { width: 100, align: 'right' });
            lY += 10;
        };

        printSummaryLine('Efectivo Recibido:', totals.countEfectivo, totals.efectivo);
        printSummaryLine('Tarjetas de Crédito / Débito:', totals.countTarjeta, totals.tarjeta);
        printSummaryLine('Cheques:', totals.countCheque, totals.cheque);
        printSummaryLine('Transferencias Bancarias:', totals.countTransferencia, totals.transferencia);

        doc.moveTo(boxX + 15, lY).lineTo(boxX + 340, lY).lineWidth(0.75).strokeColor('#0f172a').stroke();
        lY += 2;
        printSummaryLine('TOTAL RECAUDADO EN ANTICIPOS:', rows.length, totals.monto, true);

        // Columna 2: Estado y Aplicación de los Anticipos
        doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#475569');
        doc.text('ESTADO Y APLICACIÓN EN CIERRES', col2X, cardY);
        doc.moveTo(col2X, cardY + 9).lineTo(col2X + 340, cardY + 9).lineWidth(0.5).strokeColor('#e2e8f0').stroke();

        let rY = cardY + 12;
        const printStatusLine = (label, amount, color = '#0f172a', bold = false) => {
            doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.5).fillColor(color);
            doc.text(label, col2X, rY, { width: 210 });
            doc.text(reportPdfHelper.fmt(amount), col2X + 220, rY, { width: 110, align: 'right' });
            rY += 11;
        };

        printStatusLine('Total Anticipos Registrados:', totals.monto, '#0f172a', true);
        printStatusLine('(-) Monto Utilizado / Consumido en Cierres:', totals.utilizado, '#e11d48');
        doc.moveTo(col2X, rY).lineTo(col2X + 340, rY).lineWidth(0.75).strokeColor('#0f172a').stroke();
        rY += 3;
        printStatusLine('(=) SALDO TOTAL DISPONIBLE EN ANTICIPOS:', totals.disponible, '#059669', true);

        const pctUtil = totals.monto > 0 ? ((totals.utilizado / totals.monto) * 100).toFixed(1) : '0.0';
        doc.font('Helvetica').fontSize(6).fillColor('#64748b');
        doc.text(`* Nivel de consumo: ${pctUtil}% del saldo global aplicado en turnos de pista.`, col2X, rY + 1, { width: 330 });

        currentY += summaryBoxH + 15;

        // Cierre y paginación
        reportPdfHelper.renderClosingFooter(doc, startX, currentY, rows.length, 'Anticipos');
        reportPdfHelper.renderPageNumbers(doc);

        doc.end();
        const pdfBuffer = await getBuffer();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Reporte_Pagos_Anticipados.pdf`);
        return res.send(pdfBuffer);
    } catch (error) {
        console.error('Error getAdvancesReportPDF:', error);
        res.status(500).json({ message: 'Error al generar el reporte de anticipos: ' + error.message });
    }
};

/**
 * Genera el recibo de pago de anticipo en PDF
 */
exports.getAdvanceReceiptPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id;

        if (!companyId) {
            return res.status(400).json({ message: 'Contexto de empresa no encontrado' });
        }

        const [rows] = await pool.query(`
            SELECT a.*, 
                   c.nombre AS customer_nombre, c.nrc, c.nit, c.direccion AS customer_direccion, 
                   c.telefono AS customer_telefono, c.correo AS customer_email,
                   b.nombre AS branch_name, b.direccion AS branch_direccion, b.telefono AS branch_telefono, b.logo_url AS branch_logo_url,
                   comp.razon_social AS company_name, comp.nombre_comercial AS company_nombre_comercial, comp.nit AS company_nit, 
                   comp.nrc AS company_nrc, comp.actividad_economica AS company_giro,
                   comp.direccion AS company_direccion, comp.telefono AS company_telefono, comp.logo_url AS company_logo_url
            FROM gas_station_advances a
            LEFT JOIN customers c ON a.cliente_id = c.id
            LEFT JOIN branches b ON a.branch_id = b.id
            LEFT JOIN companies comp ON a.company_id = comp.id
            WHERE a.id = ? AND a.company_id = ?
        `, [id, companyId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Anticipo no encontrado' });
        }

        const advance = rows[0];
        const pdfBuffer = await pdfService.generateAdvanceReceiptPDF(advance);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Recibo_Anticipo_${advance.numero || id}.pdf`);
        return res.send(pdfBuffer);
    } catch (error) {
        console.error('Error getAdvanceReceiptPDF:', error);
        res.status(500).json({ message: 'Error al generar recibo de anticipo: ' + error.message });
    }
};

/**
 * Envía el recibo de anticipo por correo electrónico al cliente
 */
exports.sendAdvanceReceiptEmail = async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.body || {};
        await mailer.sendAdvanceReceiptEmail(id, email);
        res.json({ message: 'Recibo enviado por correo exitosamente' });
    } catch (error) {
        console.error('Error sendAdvanceReceiptEmail:', error);
        res.status(500).json({ message: error.message || 'Error al enviar el recibo por correo' });
    }
};
