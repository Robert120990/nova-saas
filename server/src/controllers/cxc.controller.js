const pool = require('../config/db');
const mailer = require('../services/mailer.service');
const { 
    generateStatementPDF, 
    generateCustomerBalancesPDF,
    generatePaymentReceiptPDF
} = require('../services/pdf.service');


/**
 * Obtiene el estado de cuenta de un cliente para una sucursal específica.
 */
const getCustomerStatement = async (req, res) => {
    const { customer_id, branch_id, search, page = 1, limit = 10 } = req.query;
    const company_id = req.company_id;

    if (!customer_id || !branch_id) {
        return res.status(400).json({ message: 'Cliente y Sucursal son obligatorios' });
    }

    const offset = (page - 1) * limit;
    const searchTerm = search ? `%${search}%` : null;

    try {
        const [totalRows] = await pool.query(`
            SELECT COUNT(*) as total FROM (
                SELECT h.id FROM sales_headers h
                LEFT JOIN dtes d ON h.id = d.venta_id
                WHERE h.company_id = ? AND h.branch_id = ? AND h.customer_id = ? 
                AND (h.payment_condition = 2 OR h.condicion_operacion = 2)
                AND h.estado != 'ANULADO'
                ${searchTerm ? 'AND (d.codigo_generacion LIKE ? OR h.id LIKE ?)' : ''}
                UNION ALL
                SELECT p.id FROM customer_payments p
                WHERE p.company_id = ? AND p.branch_id = ? AND p.customer_id = ?
                ${searchTerm ? 'AND (p.referencia LIKE ? OR p.notas LIKE ?)' : ''}
            ) as combined
        `, [
            company_id, branch_id, customer_id,
            ...(searchTerm ? [searchTerm, searchTerm] : []),
            company_id, branch_id, customer_id,
            ...(searchTerm ? [searchTerm, searchTerm] : [])
        ]);

        const totalItems = totalRows[0].total;

        const [sales] = await pool.query(`
            SELECT 
                h.id as doc_id,
                h.fecha_emision as fecha,
                h.tipo_documento as tipo,
                COALESCE(d.numero_control, h.id) as numero,
                h.total_pagar as cargo,
                0 as abono,
                'VENTA' as concepto,
                COALESCE(c.nombre, h.cliente_nombre, CONCAT('CLIENTE #', c.id)) as cliente_nombre
            FROM sales_headers h
            JOIN customers c ON h.customer_id = c.id
            LEFT JOIN dtes d ON h.id = d.venta_id
            WHERE h.company_id = ? AND h.branch_id = ? AND h.customer_id = ? 
            AND (h.payment_condition = 2 OR h.condicion_operacion = 2)
            AND h.estado != 'ANULADO'
            ${searchTerm ? 'AND (d.numero_control LIKE ? OR h.id LIKE ?)' : ''}
        `, [company_id, branch_id, customer_id, ...(searchTerm ? [searchTerm, searchTerm] : [])]);

        const [payments] = await pool.query(`
            SELECT 
                p.id as doc_id,
                p.fecha_pago as fecha,
                'RECIBO' as tipo,
                p.referencia as numero,
                0 as cargo,
                p.monto as abono,
                'ABONO' as concepto,
                COALESCE(c.nombre, CONCAT('CLIENTE #', c.id)) as cliente_nombre
            FROM customer_payments p
            JOIN customers c ON p.customer_id = c.id
            WHERE p.company_id = ? AND p.branch_id = ? AND p.customer_id = ?
            ${searchTerm ? 'AND (p.referencia LIKE ? OR p.notas LIKE ?)' : ''}
        `, [company_id, branch_id, customer_id, ...(searchTerm ? [searchTerm, searchTerm] : [])]);

        const movementsAll = [...sales, ...payments].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        let currentBalance = 0;
        const historyAll = movementsAll.map(m => {
            currentBalance += (parseFloat(m.cargo) - parseFloat(m.abono));
            return { ...m, balance: currentBalance };
        });

        const historyPaginated = historyAll.slice(offset, offset + parseInt(limit));

        res.json({
            movements: historyPaginated,
            total_balance: currentBalance,
            pagination: {
                total: totalItems,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalItems / limit)
            }
        });
    } catch (error) {
        console.error('Error in getCustomerStatement:', error);
        res.status(500).json({ message: 'Error al obtener estado de cuenta' });
    }
};

/**
 * Obtiene documentos pendientes (ventas a crédito con saldo > 0) ordenados del más antiguo al más reciente.
 */
const getPendingDocuments = async (req, res) => {
    const { customer_id, branch_id } = req.query;
    const company_id = req.company_id;

    if (!customer_id || !branch_id) {
        return res.status(400).json({ message: 'Cliente y Sucursal son obligatorios' });
    }

    try {
        const [rows] = await pool.query(`
            SELECT 
                h.id as sale_id,
                h.fecha_emision as fecha,
                COALESCE(cat.description, h.tipo_documento) as tipo,
                COALESCE(d.numero_control, CONCAT('VTA-', h.id)) as documento,
                h.total_pagar as total_original,
                COALESCE(SUM(p.monto), 0) as total_abonado,
                (h.total_pagar - COALESCE(SUM(p.monto), 0)) as saldo_pendiente
            FROM sales_headers h
            LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento = cat.code
            LEFT JOIN dtes d ON h.id = d.venta_id
            LEFT JOIN customer_payments p ON p.sale_id = h.id
            WHERE h.company_id = ? AND h.branch_id = ? AND h.customer_id = ?
            AND (h.payment_condition = 2 OR h.condicion_operacion = 2)
            AND h.estado != 'ANULADO'
            GROUP BY h.id, h.fecha_emision, h.tipo_documento, cat.description, d.numero_control, h.total_pagar
            HAVING saldo_pendiente > 0.001
            ORDER BY h.fecha_emision ASC, h.id ASC
        `, [company_id, branch_id, customer_id]);

        res.json(rows);
    } catch (error) {
        console.error('Error in getPendingDocuments:', error);
        res.status(500).json({ message: 'Error al obtener documentos pendientes' });
    }
};

/**
 * Registra uno o varios abonos para un cliente (uno por documento).
 */
const registerPayment = async (req, res) => {
    const { customer_id, branch_id, fecha_pago, metodo_pago, referencia, notas, documentos } = req.body;
    const company_id = req.company_id;

    if (!customer_id || !branch_id || !metodo_pago || !documentos || !Array.isArray(documentos)) {
        return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    const validDocs = documentos.filter(d => parseFloat(d.monto) > 0);
    if (validDocs.length === 0) {
        return res.status(400).json({ message: 'Debe haber al menos un documento con monto de abono mayor a cero' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const insertedIds = [];
        for (const doc of validDocs) {
            const [result] = await conn.query(`
                INSERT INTO customer_payments 
                (company_id, branch_id, customer_id, sale_id, monto, fecha_pago, metodo_pago, referencia, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                company_id, branch_id, customer_id,
                doc.sale_id || null,
                parseFloat(doc.monto),
                fecha_pago,
                metodo_pago,
                referencia || null,
                notas || null
            ]);
            insertedIds.push(result.insertId);
        }

        await conn.commit();

        for (const id of insertedIds) {
            mailer.sendPaymentReceiptEmail(id).catch(err => {
                console.error(`[CXC Controller] Error sending payment email for ${id} on registration:`, err);
            });
        }

        res.status(201).json({
            ids: insertedIds,
            message: `${insertedIds.length} abono(s) registrado(s) exitosamente`
        });
    } catch (error) {
        await conn.rollback();
        console.error('Error in registerPayment:', error);
        res.status(500).json({ message: 'Error al registrar los abonos' });
    } finally {
        conn.release();
    }
};

/**
 * Obtiene el historial de abonos de un cliente/sucursal (paginado).
 */
const getPaymentHistory = async (req, res) => {
    const { customer_id, branch_id, page = 1, limit = 10, search = '' } = req.query;
    const company_id = req.company_id;

    const offset = (page - 1) * limit;
    let whereClauses = ['p.company_id = ?'];
    let queryParams = [company_id];

    if (customer_id && customer_id !== 'undefined' && customer_id !== '') {
        whereClauses.push('p.customer_id = ?');
        queryParams.push(customer_id);
    }
    if (branch_id && branch_id !== 'undefined' && branch_id !== '') {
        whereClauses.push('p.branch_id = ?');
        queryParams.push(branch_id);
    }
    if (search) {
        whereClauses.push('(p.referencia LIKE ? OR (SELECT MAX(d2.numero_control) FROM dtes d2 WHERE d2.venta_id = h.id) LIKE ? OR c.nombre LIKE ? OR CONCAT("VTA-", h.id) LIKE ?)');
        const s = `%${search}%`;
        queryParams.push(s, s, s, s);
    }

    const whereStr = whereClauses.join(' AND ');

    try {
        const [[{ total }]] = await pool.query(`
            SELECT COUNT(*) as total 
            FROM customer_payments p
            LEFT JOIN customers c ON p.customer_id = c.id
            LEFT JOIN sales_headers h ON p.sale_id = h.id
            WHERE ${whereStr}
        `, queryParams);

        const [rows] = await pool.query(`
            SELECT 
                p.id,
                p.fecha_pago,
                p.monto,
                p.metodo_pago,
                p.referencia,
                p.notas,
                p.sale_id,
                p.created_at,
                c.nombre as cliente_nombre,
                b.nombre as sucursal_nombre,
                COALESCE(
                    (SELECT MAX(d2.numero_control) FROM dtes d2 WHERE d2.venta_id = h.id),
                    CONCAT('VTA-', h.id)
                ) as documento_aplicado,
                h.fecha_emision as fecha_documento,
                h.tipo_documento,
                h.total_pagar as total_documento
            FROM customer_payments p
            LEFT JOIN customers c ON p.customer_id = c.id
            LEFT JOIN branches b ON p.branch_id = b.id
            LEFT JOIN sales_headers h ON p.sale_id = h.id
            LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento = cat.code
            WHERE ${whereStr}
            ORDER BY p.fecha_pago DESC, p.id DESC
            LIMIT ? OFFSET ?
        `, [...queryParams, parseInt(limit), offset]);

        res.json({
            payments: rows,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error in getPaymentHistory:', error);
        res.status(500).json({ message: 'Error al obtener historial de abonos' });
    }
};

/**
 * Obtiene el detalle de un abono específico.
 */
const getPaymentById = async (req, res) => {
    const { id } = req.params;
    const company_id = req.company_id;

    try {
        const [rows] = await pool.query(`
            SELECT 
                p.*,
                c.nombre as cliente_nombre,
                c.correo as cliente_correo,
                b.nombre as sucursal_nombre,
                COALESCE(cat.description, h.tipo_documento) as documento_tipo,
                COALESCE(d.numero_control, CONCAT('VTA-', h.id)) as documento_aplicado,
                h.fecha_emision as fecha_documento,
                h.tipo_documento,
                h.total_pagar as total_documento
            FROM customer_payments p
            JOIN customers c ON p.customer_id = c.id
            JOIN branches b ON p.branch_id = b.id
            LEFT JOIN sales_headers h ON p.sale_id = h.id
            LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento = cat.code
            LEFT JOIN dtes d ON h.id = d.venta_id
            WHERE p.id = ? AND p.company_id = ?
        `, [id, company_id]);

        if (rows.length === 0) return res.status(404).json({ message: 'Abono no encontrado' });
        res.json(rows[0]);
    } catch (error) {
        console.error('Error in getPaymentById:', error);
        res.status(500).json({ message: 'Error al obtener el abono' });
    }
};

/**
 * Actualiza un abono existente.
 */
const updatePayment = async (req, res) => {
    const { id } = req.params;
    const { monto, fecha_pago, metodo_pago, referencia, notas } = req.body;
    const company_id = req.company_id;

    if (!monto || !fecha_pago || !metodo_pago) {
        return res.status(400).json({ message: 'Monto, fecha y método de pago son obligatorios' });
    }

    try {
        const [existing] = await pool.query(
            'SELECT id FROM customer_payments WHERE id = ? AND company_id = ?',
            [id, company_id]
        );
        if (existing.length === 0) return res.status(404).json({ message: 'Abono no encontrado' });

        await pool.query(`
            UPDATE customer_payments 
            SET monto = ?, fecha_pago = ?, metodo_pago = ?, referencia = ?, notas = ?
            WHERE id = ? AND company_id = ?
        `, [parseFloat(monto), fecha_pago, metodo_pago, referencia || null, notas || null, id, company_id]);

        res.json({ message: 'Abono actualizado correctamente' });
    } catch (error) {
        console.error('Error in updatePayment:', error);
        res.status(500).json({ message: 'Error al actualizar el abono' });
    }
};

/**
 * Elimina un abono.
 */
const deletePayment = async (req, res) => {
    const { id } = req.params;
    const company_id = req.company_id;

    try {
        const [existing] = await pool.query(
            'SELECT id FROM customer_payments WHERE id = ? AND company_id = ?',
            [id, company_id]
        );
        if (existing.length === 0) return res.status(404).json({ message: 'Abono no encontrado' });

        await pool.query('DELETE FROM customer_payments WHERE id = ? AND company_id = ?', [id, company_id]);

        res.json({ message: 'Abono eliminado correctamente' });
    } catch (error) {
        console.error('Error in deletePayment:', error);
        res.status(500).json({ message: 'Error al eliminar el abono' });
    }
};

/**
 * Envía el comprobante de abono por correo (Reenvío manual).
 */
const sendReceiptEmail = async (req, res) => {
    const { id } = req.params;
    try {
        await mailer.sendPaymentReceiptEmail(id);
        res.json({ message: 'Copia enviada al cliente' });
    } catch (error) {
        console.error('[CXC Controller] Error re-sending receipt email:', error);
        res.status(500).json({ message: error.message || 'Error enviando correo' });
    }
};

/**
 * Genera y descarga el recibo de abono en PDF.
 */
const exportPaymentPDF = async (req, res) => {
    const { id } = req.params;
    const company_id = req.company_id;

    try {
        const [targetPaymentRows] = await pool.query('SELECT * FROM customer_payments WHERE id = ? AND company_id = ?', [id, company_id]);
        if (targetPaymentRows.length === 0) return res.status(404).json({ message: 'Abono no encontrado' });
        const p = targetPaymentRows[0];

        const [paymentRows] = await pool.query(`
            SELECT p.*, 
                   c.nombre AS customer_name,
                   b.nombre AS branch_name, b.logo_url AS branch_logo_url,
                   comp.razon_social AS company_name, comp.logo_url AS company_logo_url, comp.nit AS company_nit,
                   COALESCE(cat.description, h.tipo_documento) as documento_tipo,
                   COALESCE(d.numero_control, CONCAT('VTA-', h.id)) as documento_aplicado,
                   h.fecha_emision as documento_fecha,
                   h.total_pagar as documento_total
            FROM customer_payments p
            JOIN customers c ON p.customer_id = c.id
            JOIN branches b ON p.branch_id = b.id
            JOIN companies comp ON b.company_id = comp.id
            LEFT JOIN sales_headers h ON p.sale_id = h.id
            LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento = cat.code
            LEFT JOIN dtes d ON h.id = d.venta_id
            WHERE p.customer_id = ? AND p.branch_id = ? AND p.fecha_pago = ? 
            AND p.metodo_pago = ? AND (p.referencia = ? OR (p.referencia IS NULL AND ? IS NULL))
            AND ABS(TIMESTAMPDIFF(SECOND, p.created_at, ?)) < 10
            AND p.company_id = ?
        `, [p.customer_id, p.branch_id, p.fecha_pago, p.metodo_pago, p.referencia, p.referencia, p.created_at, company_id]);

        const first = paymentRows[0];
        const receiptData = {
            id: first.id, // We use the first ID as reference
            company_name: first.company_name,
            company_nit: first.company_nit,
            branch_name: first.branch_name,
            company_logo_url: first.company_logo_url,
            branch_logo_url: first.branch_logo_url,
            customer_name: first.customer_name,
            monto: paymentRows.reduce((sum, row) => sum + parseFloat(row.monto), 0),
            fecha_pago: first.fecha_pago,
            metodo_pago: first.metodo_pago,
            referencia: first.referencia,
            notas: first.notas,
            documentos: paymentRows.map(row => ({
                tipo: row.documento_tipo,
                numero: row.documento_aplicado,
                fecha: row.documento_fecha,
                total: row.documento_total,
                abono: row.monto
            }))
        };

        const pdfBuffer = await generatePaymentReceiptPDF(receiptData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Recibo_Abono_${id}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[CXC Controller] Error generating payment PDF:', error);
        res.status(500).json({ message: 'Error al generar PDF' });
    }
};

/**
 * Envía el estado de cuenta por correo electrónico.
 */
const sendStatementEmail = async (req, res) => {
    const { customer_id, branch_id } = req.body;
    const company_id = req.company_id;

    if (!customer_id || !branch_id) {
        return res.status(400).json({ message: 'Cliente y Sucursal son obligatorios' });
    }

    try {
        await mailer.sendCustomerStatementEmail(customer_id, branch_id, company_id);
        res.json({ message: 'Estado de cuenta enviado exitosamente' });
    } catch (error) {
        console.error('Error in sendStatementEmail:', error);
        res.status(500).json({ message: error.message || 'Error al enviar el correo' });
    }
};

/**
 * Genera y descarga el PDF del estado de cuenta.
 */
const exportStatementPDF = async (req, res) => {
    const { customer_id, branch_id } = req.query;
    const company_id = req.company_id;

    if (!customer_id || !branch_id) {
        return res.status(400).json({ message: 'Cliente y Sucursal son obligatorios' });
    }

    try {
        const [companyRows] = await pool.query('SELECT razon_social as nombre FROM companies WHERE id = ?', [company_id]);
        const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
        const [customerRows] = await pool.query('SELECT nombre, correo FROM customers WHERE id = ?', [customer_id]);

        if (!customerRows.length) return res.status(404).json({ message: 'Cliente no encontrado' });

        const [sales] = await pool.query(`
            SELECT h.fecha_emision as fecha, h.tipo_documento as tipo, COALESCE(d.numero_control, h.id) as numero,
                   h.total_pagar as cargo, 0 as abono, 'VENTA' as concepto
            FROM sales_headers h
            LEFT JOIN dtes d ON h.id = d.venta_id
            WHERE h.company_id = ? AND h.branch_id = ? AND h.customer_id = ? 
            AND (h.payment_condition = 2 OR h.condicion_operacion = 2) AND h.estado != 'ANULADO'
        `, [company_id, branch_id, customer_id]);

        const [payments] = await pool.query(`
            SELECT p.fecha_pago as fecha, 'RECIBO' as tipo, p.referencia as numero,
                   0 as cargo, p.monto as abono, 'ABONO' as concepto
            FROM customer_payments p
            WHERE p.company_id = ? AND p.branch_id = ? AND p.customer_id = ?
        `, [company_id, branch_id, customer_id]);

        const movementsAll = [...sales, ...payments].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        let currentBalance = 0;
        const history = movementsAll.map(m => {
            currentBalance += (parseFloat(m.cargo) - parseFloat(m.abono));
            return { ...m, balance: currentBalance };
        });

        const pdfData = {
            company_name: companyRows[0].nombre,
            branch_name: branchRows[0].nombre,
            customer_name: customerRows[0].nombre,
            customer_email: customerRows[0].correo,
            total_balance: currentBalance,
            movements: history
        };

        const pdfBuffer = await generateStatementPDF(pdfData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Estado_Cuenta_${customerRows[0].nombre.replace(/ /g, '_')}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error in exportStatementPDF:', error);
        res.status(500).json({ message: 'Error al generar PDF' });
    }
};

/**
 * Obtiene el reporte de antigüedad de saldos.
 */
const getAgingReport = async (req, res) => {
    const { customer_id, branch_id } = req.query;
    const company_id = req.company_id;

    if (!customer_id || !branch_id) {
        return res.status(400).json({ message: 'Cliente y Sucursal son obligatorios' });
    }

    try {
        const [rows] = await pool.query(`
            SELECT 
                h.id as sale_id,
                h.fecha_emision as fecha,
                COALESCE(cat.description, h.tipo_documento) as tipo,
                COALESCE(d.numero_control, CONCAT('VTA-', h.id)) as documento,
                h.total_pagar as total_original,
                COALESCE(SUM(p.monto), 0) as total_abonado,
                (h.total_pagar - COALESCE(SUM(p.monto), 0)) as saldo_pendiente,
                DATEDIFF(NOW(), h.fecha_emision) as dias_antiguedad
            FROM sales_headers h
            LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento = cat.code
            LEFT JOIN dtes d ON h.id = d.venta_id
            LEFT JOIN customer_payments p ON p.sale_id = h.id
            WHERE h.company_id = ? AND h.branch_id = ? AND h.customer_id = ?
            AND (h.payment_condition = 2 OR h.condicion_operacion = 2)
            AND h.estado != 'ANULADO'
            GROUP BY h.id, h.fecha_emision, h.tipo_documento, cat.description, d.numero_control, h.total_pagar
            HAVING saldo_pendiente > 0.001
            ORDER BY h.fecha_emision ASC
        `, [company_id, branch_id, customer_id]);

        const totals = {
            t0_30: 0, t31_60: 0, t61_90: 0, t91_180: 0, t181_365: 0, t365_plus: 0
        };

        const documents = rows.map(r => {
            const days = r.dias_antiguedad;
            const saldo = parseFloat(r.saldo_pendiente);
            const docBuckets = { d0_30: 0, d31_60: 0, d61_90: 0, d91_180: 0, d181_365: 0, d365_plus: 0 };

            if (days <= 30) { docBuckets.d0_30 = saldo; totals.t0_30 += saldo; }
            else if (days <= 60) { docBuckets.d31_60 = saldo; totals.t31_60 += saldo; }
            else if (days <= 90) { docBuckets.d61_90 = saldo; totals.t61_90 += saldo; }
            else if (days <= 180) { docBuckets.d91_180 = saldo; totals.t91_180 += saldo; }
            else if (days <= 365) { docBuckets.d181_365 = saldo; totals.t181_365 += saldo; }
            else { docBuckets.d365_plus = saldo; totals.t365_plus += saldo; }

            return { ...r, ...docBuckets };
        });

        const total_balance = Object.values(totals).reduce((a, b) => a + b, 0);

        res.json({ documents, totals, total_balance });
    } catch (error) {
        console.error('Error in getAgingReport:', error);
        res.status(500).json({ message: 'Error al obtener reporte de antigüedad' });
    }
};

/**
 * Exporta el reporte de antigüedad a PDF.
 */
const exportAgingPDF = async (req, res) => {
    const { customer_id, branch_id } = req.query;
    const company_id = req.company_id;

    try {
        const [companyRows] = await pool.query('SELECT nombre FROM companies WHERE id = ?', [company_id]);
        const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
        const [customerRows] = await pool.query('SELECT nombre, correo FROM customers WHERE id = ?', [customer_id]);

        const [rows] = await pool.query(`
            SELECT 
                h.id as sale_id, h.fecha_emision as fecha,
                COALESCE(cat.description, h.tipo_documento) as tipo,
                COALESCE(d.numero_control, CONCAT('VTA-', h.id)) as documento,
                (h.total_pagar - COALESCE((SELECT SUM(monto) FROM customer_payments WHERE sale_id = h.id), 0)) as saldo_pendiente,
                DATEDIFF(NOW(), h.fecha_emision) as dias_antiguedad
            FROM sales_headers h
            LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento = cat.code
            LEFT JOIN dtes d ON h.id = d.venta_id
            WHERE h.company_id = ? AND h.branch_id = ? AND h.customer_id = ?
            AND (h.payment_condition = 2 OR h.condicion_operacion = 2) AND h.estado != 'ANULADO'
            HAVING saldo_pendiente > 0.001 ORDER BY h.fecha_emision ASC
        `, [company_id, branch_id, customer_id]);

        const totals = { t0_30: 0, t31_60: 0, t61_90: 0, t91_180: 0, t181_365: 0, t365_plus: 0 };
        const documents = rows.map(r => {
            const days = r.dias_antiguedad;
            const saldo = parseFloat(r.saldo_pendiente);
            const b = { d0_30: 0, d31_60: 0, d61_90: 0, d91_180: 0, d181_365: 0, d365_plus: 0 };
            if (days <= 30) { b.d0_30 = saldo; totals.t0_30 += saldo; }
            else if (days <= 60) { b.d31_60 = saldo; totals.t31_60 += saldo; }
            else if (days <= 90) { b.d61_90 = saldo; totals.t61_90 += saldo; }
            else if (days <= 180) { b.d91_180 = saldo; totals.t91_180 += saldo; }
            else if (days <= 365) { b.d181_365 = saldo; totals.t181_365 += saldo; }
            else { b.d365_plus = saldo; totals.t365_plus += saldo; }
            return { ...r, ...b };
        });

        const pdfData = {
            company_name: companyRows[0].nombre,
            branch_name: branchRows[0].nombre,
            customer_name: customerRows[0].nombre,
            customer_email: customerRows[0].correo,
            documents,
            totals,
            total_balance: Object.values(totals).reduce((a, b) => a + b, 0)
        };

        const { generateAgingPDF } = require('../services/pdf.service');
        const pdfBuffer = await generateAgingPDF(pdfData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Antiguedad_Saldos_${customerRows[0].nombre.replace(/ /g, '_')}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error in exportAgingPDF:', error);
        res.status(500).json({ message: 'Error al generar PDF' });
    }
};

/**
 * Envía el reporte de antigüedad por correo electrónico.
 */
const sendAgingEmail = async (req, res) => {
    const { customer_id, branch_id } = req.body;
    const company_id = req.company_id;

    try {
        const [companyRows] = await pool.query('SELECT nombre FROM companies WHERE id = ?', [company_id]);
        const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
        const [customerRows] = await pool.query('SELECT nombre, correo FROM customers WHERE id = ?', [customer_id]);

        if (!customerRows[0].correo) {
            return res.status(400).json({ message: 'El cliente no tiene un correo electrónico registrado' });
        }

        const [rows] = await pool.query(`
            SELECT 
                h.id as sale_id, h.fecha_emision as fecha,
                COALESCE(cat.description, h.tipo_documento) as tipo,
                COALESCE(d.numero_control, CONCAT('VTA-', h.id)) as documento,
                (h.total_pagar - COALESCE((SELECT SUM(monto) FROM customer_payments WHERE sale_id = h.id), 0)) as saldo_pendiente,
                DATEDIFF(NOW(), h.fecha_emision) as dias_antiguedad
            FROM sales_headers h
            LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento = cat.code
            LEFT JOIN dtes d ON h.id = d.venta_id
            WHERE h.company_id = ? AND h.branch_id = ? AND h.customer_id = ?
            AND (h.payment_condition = 2 OR h.condicion_operacion = 2) AND h.estado != 'ANULADO'
            HAVING saldo_pendiente > 0.001 ORDER BY h.fecha_emision ASC
        `, [company_id, branch_id, customer_id]);

        const totals = { t0_30: 0, t31_60: 0, t61_90: 0, t91_180: 0, t181_365: 0, t365_plus: 0 };
        const documents = rows.map(r => {
            const days = r.dias_antiguedad;
            const saldo = parseFloat(r.saldo_pendiente);
            const b = { d0_30: 0, d31_60: 0, d61_90: 0, d91_180: 0, d181_365: 0, d365_plus: 0 };
            if (days <= 30) { b.d0_30 = saldo; totals.t0_30 += saldo; }
            else if (days <= 60) { b.d31_60 = saldo; totals.t31_60 += saldo; }
            else if (days <= 90) { b.d61_90 = saldo; totals.t61_90 += saldo; }
            else if (days <= 180) { b.d91_180 = saldo; totals.t91_180 += saldo; }
            else if (days <= 365) { b.d181_365 = saldo; totals.t181_365 += saldo; }
            else { b.d365_plus = saldo; totals.t365_plus += saldo; }
            return { ...r, ...b };
        });

        const { generateAgingPDF } = require('../services/pdf.service');
        const pdfBuffer = await generateAgingPDF({
            company_name: companyRows[0].nombre,
            branch_name: branchRows[0].nombre,
            customer_name: customerRows[0].nombre,
            customer_email: customerRows[0].correo,
            documents,
            totals,
            total_balance: Object.values(totals).reduce((a, b) => a + b, 0)
        });

        await mailer.sendMail({
            branchId: branch_id,
            to: customerRows[0].correo,
            subject: `Antigüedad de Saldos - ${companyRows[0].nombre}`,
            text: `Estimado(a) ${customerRows[0].nombre},\n\nAdjuntamos su reporte de antigüedad de saldos detallando sus compromisos pendientes.\n\nAtentamente,\n${companyRows[0].nombre}`,
            attachments: [{ filename: 'Antiguedad_Saldos.pdf', content: pdfBuffer }]
        });

        res.json({ message: 'Correo enviado exitosamente' });
    } catch (error) {
        console.error('Error in sendAgingEmail:', error);
        res.status(500).json({ message: 'Error al enviar el correo' });
    }
};

/**
 * Obtiene el reporte de saldos de todos los clientes a una fecha de corte específica.
 */
const getCustomerBalancesReport = async (req, res) => {
    const { branch_id, endDate } = req.query;
    const company_id = req.company_id;

    if (!branch_id || !endDate) {
        return res.status(400).json({ message: 'Sucursal y fecha de corte son obligatorios' });
    }

    try {
        const [companyRows] = await pool.query('SELECT razon_social as nombre FROM companies WHERE id = ?', [company_id]);
        const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);

        if (!companyRows.length || !branchRows.length) {
            return res.status(404).json({ message: 'Empresa o Sucursal no encontrada' });
        }

        const [rows] = await pool.query(`
            SELECT 
                c.id,
                c.nombre,
                COALESCE(c.nit, c.numero_documento, '-') as dui_nit,
                COALESCE(c.nrc, '-') as nrc,
                (
                    COALESCE((
                        SELECT SUM(h.total_pagar)
                        FROM sales_headers h
                        WHERE h.customer_id = c.id 
                        AND h.branch_id = ? 
                        AND (h.payment_condition = 2 OR h.condicion_operacion = 2)
                        AND h.estado != 'ANULADO'
                        AND h.fecha_emision <= ?
                    ), 0) - 
                    COALESCE((
                        SELECT SUM(p.monto)
                        FROM customer_payments p
                        WHERE p.customer_id = c.id 
                        AND p.branch_id = ?
                        AND p.fecha_pago <= ?
                    ), 0)
                ) as saldo
            FROM customers c
            WHERE c.company_id = ?
            HAVING saldo > 0.001 OR saldo < -0.001
            ORDER BY c.nombre ASC
        `, [branch_id, endDate, branch_id, endDate, company_id]);


        const pdfData = {
            company_name: companyRows[0].nombre,
            branch_name: branchRows[0].nombre,
            endDate,
            items: rows,
            total_general: rows.reduce((acc, r) => acc + parseFloat(r.saldo), 0)
        };

        const pdfBuffer = await generateCustomerBalancesPDF(pdfData);


        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Saldos_Clientes_${endDate}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error in getCustomerBalancesReport:', error);
        res.status(500).json({ message: 'Error al generar reporte de saldos de clientes' });
    }
};

/**
 * Exporta el reporte detallado de documentos pendientes a PDF.
 */
const exportPendingDocumentsDetailedPDF = async (req, res) => {
    const { branch_id, cutoffDate, customer_id } = req.query;
    const company_id = req.company_id;

    if (!branch_id || !cutoffDate) {
        return res.status(400).json({ message: 'Sucursal y fecha de corte son obligatorios' });
    }

    try {
        const [companyRows] = await pool.query('SELECT razon_social, nit FROM companies WHERE id = ?', [company_id]);
        const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);

        if (!companyRows.length || !branchRows.length) {
            return res.status(404).json({ message: 'Empresa o Sucursal no encontrada' });
        }

        let sql = `
            SELECT 
                h.fecha_emision as fecha,
                DATEDIFF(?, h.fecha_emision) as dias,
                CAST(CASE h.tipo_documento 
                    WHEN '01' THEN 'Factura'
                    WHEN '03' THEN 'Crédito Fiscal'
                    WHEN '04' THEN 'Nota de Remisión'
                    WHEN '05' THEN 'Nota de Crédito'
                    WHEN '11' THEN 'Factura de Exportación'
                    ELSE h.tipo_documento 
                END AS CHAR) COLLATE utf8mb4_unicode_ci as tipo,
                CAST(COALESCE(d.numero_control, CONCAT('VTA-', h.id)) AS CHAR) COLLATE utf8mb4_unicode_ci as documento,
                h.total_pagar as monto,
                (h.total_pagar - COALESCE((
                    SELECT SUM(monto) FROM customer_payments 
                    WHERE sale_id = h.id AND fecha_pago <= ?
                ), 0)) as saldo,
                c.id as customer_id,
                CAST(c.nombre AS CHAR) COLLATE utf8mb4_unicode_ci as customer_name
            FROM sales_headers h
            JOIN customers c ON h.customer_id = c.id
            LEFT JOIN dtes d ON h.id = d.venta_id
            WHERE h.company_id = ? AND h.branch_id = ?
            AND (h.payment_condition = 2 OR h.condicion_operacion = 2)
            AND h.estado != 'ANULADO'
            AND h.fecha_emision <= ?
        `;
        const params = [cutoffDate, cutoffDate, company_id, branch_id, cutoffDate];

        if (customer_id && customer_id !== 'all' && customer_id !== 'undefined') {
            sql += ' AND h.customer_id = ?';
            params.push(customer_id);
        }

        sql += ' HAVING saldo > 0.001 ORDER BY c.nombre, h.fecha_emision';

        const [rows] = await pool.query(sql, params);

        // Group by customer
        const grouped = [];
        let grandTotal = 0;

        rows.forEach(row => {
            let customer = grouped.find(c => c.customer_id === row.customer_id);
            if (!customer) {
                customer = {
                    customer_id: row.customer_id,
                    customer_name: row.customer_name,
                    documents: [],
                    subtotal: 0
                };
                grouped.push(customer);
            }
            customer.documents.push(row);
            customer.subtotal += parseFloat(row.saldo);
            grandTotal += parseFloat(row.saldo);
        });

        const pdfData = {
            company_name: companyRows[0].razon_social,
            company_nit: companyRows[0].nit,
            branch_name: branchRows[0].nombre,
            cutoffDate,
            customers: grouped,
            grandTotal
        };

        const { generatePendingDocumentsDetailedPDF } = require('../services/pdf.service');
        const pdfBuffer = await generatePendingDocumentsDetailedPDF(pdfData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Documentos_Pendientes_${cutoffDate}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error in exportPendingDocumentsDetailedPDF:', error);
        res.status(500).json({ message: 'Error al generar reporte de documentos pendientes' });
    }
};

module.exports = {
    getCustomerStatement,
    getPendingDocuments,
    registerPayment,
    getPaymentHistory,
    getPaymentById,
    updatePayment,
    deletePayment,
    sendReceiptEmail,
    exportPaymentPDF,
    sendStatementEmail,
    exportStatementPDF,
    getAgingReport,
    exportAgingPDF,
    sendAgingEmail,
    getCustomerBalancesReport,
    exportPendingDocumentsDetailedPDF
};
