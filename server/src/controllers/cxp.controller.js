const pool = require('../config/db');
const mailer = require('../services/mailer.service');
const { generateProviderStatementPDF, generateProviderAgingPDF, generateProviderBalancesPDF } = require('../services/pdf.service');


/**
 * Obtiene el estado de cuenta de un proveedor para una sucursal específica.
 */
const getProviderStatement = async (req, res) => {
    const { provider_id, branch_id, search, page = 1, limit = 10 } = req.query;
    const company_id = req.company_id;

    if (!provider_id || !branch_id) {
        return res.status(400).json({ message: 'Proveedor y Sucursal son obligatorios' });
    }

    const offset = (page - 1) * limit;
    const searchTerm = search ? `%${search}%` : null;

    try {
        const [totalRows] = await pool.query(`
            SELECT COUNT(*) as total FROM (
                SELECT h.id FROM purchase_headers h
                WHERE h.company_id = ? AND h.branch_id = ? AND h.provider_id = ? 
                AND h.condicion_operacion_id = '2'
                AND h.status != 'ANULADO'
                ${searchTerm ? 'AND (h.numero_documento LIKE ? OR h.id LIKE ?)' : ''}
                UNION ALL
                SELECT e.id FROM expense_headers e
                WHERE e.company_id = ? AND e.branch_id = ? AND e.provider_id = ? 
                AND e.condicion_operacion_id = '2'
                AND e.status != 'ANULADO'
                ${searchTerm ? 'AND (e.numero_documento LIKE ? OR e.id LIKE ?)' : ''}
                UNION ALL
                SELECT p.id FROM provider_payments p
                WHERE p.company_id = ? AND p.branch_id = ? AND p.provider_id = ?
                ${searchTerm ? 'AND (p.referencia LIKE ? OR p.notas LIKE ?)' : ''}
            ) as combined
        `, [
            company_id, branch_id, provider_id,
            ...(searchTerm ? [searchTerm, searchTerm] : []),
            company_id, branch_id, provider_id,
            ...(searchTerm ? [searchTerm, searchTerm] : []),
            company_id, branch_id, provider_id,
            ...(searchTerm ? [searchTerm, searchTerm] : [])
        ]);

        const totalItems = totalRows[0].total;

        const [purchases] = await pool.query(`
            SELECT 
                h.id as doc_id,
                h.fecha as fecha,
                cat.description as tipo,
                h.numero_documento as numero,
                h.monto_total as cargo,
                0 as abono,
                'COMPRA' as concepto,
                COALESCE(prov.nombre, CONCAT('PROVEEDOR #', prov.id)) as proveedor_nombre
            FROM purchase_headers h
            JOIN providers prov ON h.provider_id = prov.id
            LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code COLLATE utf8mb4_unicode_ci
            WHERE h.company_id = ? AND h.branch_id = ? AND h.provider_id = ? 
            AND h.condicion_operacion_id = '2'
            AND h.status != 'ANULADO'
            ${searchTerm ? 'AND (h.numero_documento LIKE ? OR h.id LIKE ?)' : ''}
        `, [company_id, branch_id, provider_id, ...(searchTerm ? [searchTerm, searchTerm] : [])]);

        const [expenses] = await pool.query(`
            SELECT 
                e.id as doc_id,
                e.fecha as fecha,
                cat.description as tipo,
                e.numero_documento as numero,
                e.monto_total as cargo,
                0 as abono,
                'GASTO' as concepto,
                COALESCE(prov.nombre, CONCAT('PROVEEDOR #', prov.id)) as proveedor_nombre
            FROM expense_headers e
            JOIN providers prov ON e.provider_id = prov.id
            LEFT JOIN cat_002_tipo_dte cat ON e.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code COLLATE utf8mb4_unicode_ci
            WHERE e.company_id = ? AND e.branch_id = ? AND e.provider_id = ? 
            AND e.condicion_operacion_id = '2'
            AND e.status != 'ANULADO'
            ${searchTerm ? 'AND (e.numero_documento LIKE ? OR e.id LIKE ?)' : ''}
        `, [company_id, branch_id, provider_id, ...(searchTerm ? [searchTerm, searchTerm] : [])]);

        const [payments] = await pool.query(`
            SELECT 
                p.id as doc_id,
                p.fecha_pago as fecha,
                'COMPROBANTE' as tipo,
                p.referencia as numero,
                0 as cargo,
                p.monto as abono,
                'PAGO' as concepto,
                COALESCE(prov.nombre, CONCAT('PROVEEDOR #', prov.id)) as proveedor_nombre
            FROM provider_payments p
            JOIN providers prov ON p.provider_id = prov.id
            WHERE p.company_id = ? AND p.branch_id = ? AND p.provider_id = ?
            ${searchTerm ? 'AND (p.referencia LIKE ? OR p.notas LIKE ?)' : ''}
        `, [company_id, branch_id, provider_id, ...(searchTerm ? [searchTerm, searchTerm] : [])]);

        const movementsAll = [...purchases, ...expenses, ...payments].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

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
        console.error('Error in getProviderStatement:', error);
        res.status(500).json({ message: 'Error al obtener estado de cuenta del proveedor' });
    }
};

/**
 * Obtiene documentos pendientes (compras a crédito con saldo > 0) ordenados del más antiguo al más reciente.
 */
const getPendingDocuments = async (req, res) => {
    const { provider_id, branch_id } = req.query;
    const company_id = req.company_id;

    if (!provider_id || !branch_id) {
        return res.status(400).json({ message: 'Proveedor y Sucursal son obligatorios' });
    }

    try {
        const [rows] = await pool.query(`
            SELECT 
                h.id as purchase_id,
                NULL as expense_id,
                h.fecha as fecha,
                cat.description as tipo,
                h.numero_documento as documento,
                h.monto_total as total_original,
                COALESCE((SELECT SUM(monto) FROM provider_payments WHERE purchase_id = h.id), 0) as total_abonado,
                (h.monto_total - COALESCE((SELECT SUM(monto) FROM provider_payments WHERE purchase_id = h.id), 0)) as saldo_pendiente
            FROM purchase_headers h
            LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code COLLATE utf8mb4_unicode_ci
            WHERE h.company_id = ? AND h.branch_id = ? AND h.provider_id = ?
            AND h.condicion_operacion_id = '2'
            AND h.status != 'ANULADO'
            HAVING saldo_pendiente > 0.001

            UNION ALL

            SELECT 
                NULL as purchase_id,
                e.id as expense_id,
                e.fecha as fecha,
                cat.description as tipo,
                e.numero_documento as documento,
                e.monto_total as total_original,
                COALESCE((SELECT SUM(monto) FROM provider_payments WHERE expense_id = e.id), 0) as total_abonado,
                (e.monto_total - COALESCE((SELECT SUM(monto) FROM provider_payments WHERE expense_id = e.id), 0)) as saldo_pendiente
            FROM expense_headers e
            LEFT JOIN cat_002_tipo_dte cat ON e.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code COLLATE utf8mb4_unicode_ci
            WHERE e.company_id = ? AND e.branch_id = ? AND e.provider_id = ?
            AND e.condicion_operacion_id = '2'
            AND e.status != 'ANULADO'
            HAVING saldo_pendiente > 0.001
            
            ORDER BY fecha ASC
        `, [company_id, branch_id, provider_id, company_id, branch_id, provider_id]);

        res.json(rows);
    } catch (error) {
        console.error('Error in getPendingDocuments:', error);
        res.status(500).json({ message: 'Error al obtener documentos pendientes de pago' });
    }
};

/**
 * Registra uno o varios pagos para un proveedor (uno por documento).
 */
const registerPayment = async (req, res) => {
    const { provider_id, branch_id, fecha_pago, metodo_pago, referencia, notas, documentos } = req.body;
    const company_id = req.company_id;

    if (!provider_id || !branch_id || !metodo_pago || !documentos || !Array.isArray(documentos)) {
        return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    const validDocs = documentos.filter(d => parseFloat(d.monto) > 0);
    if (validDocs.length === 0) {
        return res.status(400).json({ message: 'Debe haber al menos un documento con monto de pago mayor a cero' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const insertedIds = [];
        for (const doc of validDocs) {
            const [result] = await conn.query(`
                INSERT INTO provider_payments 
                (company_id, branch_id, provider_id, purchase_id, expense_id, monto, fecha_pago, metodo_pago, referencia, notas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                company_id, branch_id, provider_id,
                doc.purchase_id || null,
                doc.expense_id || null,
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
            mailer.sendProviderPaymentReceiptEmail(id).catch(err => {
                console.error(`[CXP Controller] Error sending payment email for ${id} on registration:`, err);
            });
        }

        res.status(201).json({
            ids: insertedIds,
            message: `${insertedIds.length} pago(s) registrado(s) exitosamente`
        });
    } catch (error) {
        await conn.rollback();
        console.error('Error in registerPayment:', error);
        res.status(500).json({ message: 'Error al registrar los pagos' });
    } finally {
        conn.release();
    }
};

/**
 * Obtiene el historial de pagos a un proveedor (paginado).
 */
const getPaymentHistory = async (req, res) => {
    const { provider_id, branch_id, page = 1, limit = 10, search = '' } = req.query;
    const company_id = req.company_id;

    const offset = (page - 1) * limit;
    let whereClauses = ['p.company_id = ?'];
    let queryParams = [company_id];

    if (provider_id && provider_id !== 'undefined' && provider_id !== '') {
        whereClauses.push('p.provider_id = ?');
        queryParams.push(provider_id);
    }
    if (branch_id && branch_id !== 'undefined' && branch_id !== '') {
        whereClauses.push('p.branch_id = ?');
        queryParams.push(branch_id);
    }
    if (search) {
        whereClauses.push('(p.referencia LIKE ? OR h.numero_documento LIKE ? OR pr.nombre LIKE ?)');
        const s = `%${search}%`;
        queryParams.push(s, s, s);
    }

    const whereStr = whereClauses.join(' AND ');

    try {
        const [[{ total }]] = await pool.query(`
            SELECT COUNT(*) as total 
            FROM provider_payments p
            LEFT JOIN providers pr ON p.provider_id = pr.id
            LEFT JOIN purchase_headers h ON p.purchase_id = h.id
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
                p.purchase_id,
                p.created_at,
                pr.nombre as proveedor_nombre,
                b.nombre as sucursal_nombre,
                h.tipo_documento as documento_tipo,
                h.numero_documento as documento_aplicado,
                h.fecha_emision as fecha_documento,
                h.total_pagar as total_documento
            FROM provider_payments p
            LEFT JOIN providers pr ON p.provider_id = pr.id
            LEFT JOIN branches b ON p.branch_id = b.id
            LEFT JOIN purchase_headers h ON p.purchase_id = h.id
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
        res.status(500).json({ message: 'Error al obtener historial de pagos' });
    }
};

/**
 * Obtiene el detalle de un pago específico.
 */
const getPaymentById = async (req, res) => {
    const { id } = req.params;
    const company_id = req.company_id;

    try {
        const [rows] = await pool.query(`
            SELECT 
                p.*,
                prov.nombre as proveedor_nombre,
                prov.correo as proveedor_correo,
                b.nombre as sucursal_nombre,
                COALESCE(cat_p.description, cat_e.description) as documento_tipo,
                COALESCE(h.numero_documento, e.numero_documento) as documento_aplicado,
                COALESCE(h.fecha, e.fecha) as fecha_documento,
                COALESCE(h.monto_total, e.monto_total) as total_documento
            FROM provider_payments p
            JOIN providers prov ON p.provider_id = prov.id
            JOIN branches b ON p.branch_id = b.id
            LEFT JOIN purchase_headers h ON p.purchase_id = h.id
            LEFT JOIN expense_headers e ON p.expense_id = e.id
            LEFT JOIN cat_002_tipo_dte cat_p ON h.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat_p.code COLLATE utf8mb4_unicode_ci
            LEFT JOIN cat_002_tipo_dte cat_e ON e.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat_e.code COLLATE utf8mb4_unicode_ci
            WHERE p.id = ? AND p.company_id = ?
        `, [id, company_id]);

        if (rows.length === 0) return res.status(404).json({ message: 'Pago no encontrado' });
        res.json(rows[0]);
    } catch (error) {
        console.error('Error in getPaymentById:', error);
        res.status(500).json({ message: 'Error al obtener el pago' });
    }
};

/**
 * Actualiza un pago existente.
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
            'SELECT id FROM provider_payments WHERE id = ? AND company_id = ?',
            [id, company_id]
        );
        if (existing.length === 0) return res.status(404).json({ message: 'Pago no encontrado' });

        await pool.query(`
            UPDATE provider_payments 
            SET monto = ?, fecha_pago = ?, metodo_pago = ?, referencia = ?, notas = ?
            WHERE id = ? AND company_id = ?
        `, [parseFloat(monto), fecha_pago, metodo_pago, referencia || null, notas || null, id, company_id]);

        res.json({ message: 'Pago actualizado correctamente' });
    } catch (error) {
        console.error('Error in updatePayment:', error);
        res.status(500).json({ message: 'Error al actualizar el pago' });
    }
};

/**
 * Elimina un pago.
 */
const deletePayment = async (req, res) => {
    const { id } = req.params;
    const company_id = req.company_id;

    try {
        const [existing] = await pool.query(
            'SELECT id FROM provider_payments WHERE id = ? AND company_id = ?',
            [id, company_id]
        );
        if (existing.length === 0) return res.status(404).json({ message: 'Pago no encontrado' });

        await pool.query('DELETE FROM provider_payments WHERE id = ? AND company_id = ?', [id, company_id]);

        res.json({ message: 'Pago eliminado correctamente' });
    } catch (error) {
        console.error('Error in deletePayment:', error);
        res.status(500).json({ message: 'Error al eliminar el pago' });
    }
};

/**
 * Envía el estado de cuenta del proveedor por correo electrónico.
 */
const sendProviderStatementEmail = async (req, res) => {
    const { provider_id, branch_id } = req.body;
    const company_id = req.company_id;

    if (!provider_id || !branch_id) {
        return res.status(400).json({ message: 'Proveedor y Sucursal son obligatorios' });
    }

    try {
        await mailer.sendProviderStatementEmail(provider_id, branch_id, company_id);
        res.json({ message: 'Estado de cuenta enviado exitosamente al proveedor' });
    } catch (error) {
        console.error('Error in sendProviderStatementEmail:', error);
        res.status(500).json({ message: error.message || 'Error al enviar el correo' });
    }
};

/**
 * Genera y descarga el PDF del estado de cuenta del proveedor.
 */
const exportProviderStatementPDF = async (req, res) => {
    const { provider_id, branch_id } = req.query;
    const company_id = req.company_id;

    if (!provider_id || !branch_id) {
        return res.status(400).json({ message: 'Proveedor y Sucursal son obligatorios' });
    }

    try {
        const [companyRows] = await pool.query('SELECT razon_social FROM companies WHERE id = ?', [company_id]);
        const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
        const [providerRows] = await pool.query('SELECT nombre, correo FROM providers WHERE id = ?', [provider_id]);

        if (!providerRows.length) return res.status(404).json({ message: 'Proveedor no encontrado' });

        const [purchases] = await pool.query(`
            SELECT h.fecha as fecha, cat.description as tipo, h.numero_documento as numero,
                   h.monto_total as cargo, 0 as abono, 'COMPRA' as concepto
            FROM purchase_headers h
            LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code COLLATE utf8mb4_unicode_ci
            WHERE h.company_id = ? AND h.branch_id = ? AND h.provider_id = ? 
            AND h.condicion_operacion_id = '2' AND h.status != 'ANULADO'
        `, [company_id, branch_id, provider_id]);

        const [expenses] = await pool.query(`
            SELECT h.fecha as fecha, cat.description as tipo, h.numero_documento as numero,
                   h.monto_total as cargo, 0 as abono, 'GASTO' as concepto
            FROM expense_headers h
            LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code COLLATE utf8mb4_unicode_ci
            WHERE h.company_id = ? AND h.branch_id = ? AND h.provider_id = ? 
            AND h.condicion_operacion_id = '2' AND h.status != 'ANULADO'
        `, [company_id, branch_id, provider_id]);

        const [payments] = await pool.query(`
            SELECT p.fecha_pago as fecha, 'COMPROBANTE' as tipo, p.referencia as numero,
                   0 as cargo, p.monto as abono, 'PAGO' as concepto
            FROM provider_payments p
            WHERE p.company_id = ? AND p.branch_id = ? AND p.provider_id = ?
        `, [company_id, branch_id, provider_id]);

        const movementsAll = [...purchases, ...expenses, ...payments].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        let currentBalance = 0;
        const history = movementsAll.map(m => {
            currentBalance += (parseFloat(m.cargo) - parseFloat(m.abono));
            return { ...m, balance: currentBalance };
        });

        const pdfData = {
            company_name: companyRows[0].razon_social,
            branch_name: branchRows[0].nombre,
            provider_name: providerRows[0].nombre,
            provider_email: providerRows[0].correo,
            total_balance: currentBalance,
            movements: history
        };

        const pdfBuffer = await generateProviderStatementPDF(pdfData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Estado_Cuenta_Prov_${providerRows[0].nombre.replace(/ /g, '_')}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error in exportProviderStatementPDF:', error);
        res.status(500).json({ message: 'Error al generar PDF' });
    }
};

/**
 * Obtiene el reporte de antigüedad de saldos para proveedores.
 */
const getProviderAgingReport = async (req, res) => {
    const { provider_id, branch_id } = req.query;
    const company_id = req.company_id;

    if (!provider_id || !branch_id) {
        return res.status(400).json({ message: 'Proveedor y Sucursal son obligatorios' });
    }

    try {
        const [rows] = await pool.query(`
            SELECT 
                h.id as purchase_id,
                NULL as expense_id,
                h.fecha as fecha,
                cat.description as tipo,
                h.numero_documento as documento,
                h.monto_total as total_original,
                COALESCE((SELECT SUM(monto) FROM provider_payments WHERE purchase_id = h.id), 0) as total_abonado,
                (h.monto_total - COALESCE((SELECT SUM(monto) FROM provider_payments WHERE purchase_id = h.id), 0)) as saldo_pendiente,
                DATEDIFF(NOW(), h.fecha) as dias_antiguedad
            FROM purchase_headers h
            LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code COLLATE utf8mb4_unicode_ci
            WHERE h.company_id = ? AND h.branch_id = ? AND h.provider_id = ?
            AND h.condicion_operacion_id = '2'
            AND h.status != 'ANULADO'
            HAVING saldo_pendiente > 0.001

            UNION ALL

            SELECT 
                NULL as purchase_id,
                e.id as expense_id,
                e.fecha as fecha,
                cat.description as tipo,
                e.numero_documento as documento,
                e.monto_total as total_original,
                COALESCE((SELECT SUM(monto) FROM provider_payments WHERE expense_id = e.id), 0) as total_abonado,
                (e.monto_total - COALESCE((SELECT SUM(monto) FROM provider_payments WHERE expense_id = e.id), 0)) as saldo_pendiente,
                DATEDIFF(NOW(), e.fecha) as dias_antiguedad
            FROM expense_headers e
            LEFT JOIN cat_002_tipo_dte cat ON e.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code COLLATE utf8mb4_unicode_ci
            WHERE e.company_id = ? AND e.branch_id = ? AND e.provider_id = ?
            AND e.condicion_operacion_id = '2'
            AND e.status != 'ANULADO'
            HAVING saldo_pendiente > 0.001

            ORDER BY fecha ASC
        `, [company_id, branch_id, provider_id, company_id, branch_id, provider_id]);

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
        console.error('Error in getProviderAgingReport:', error);
        res.status(500).json({ message: 'Error al obtener reporte de antigüedad del proveedor' });
    }
};

/**
 * Exporta el reporte de antigüedad a PDF para proveedores.
 */
const exportProviderAgingPDF = async (req, res) => {
    const { provider_id, branch_id } = req.query;
    const company_id = req.company_id;

    try {
        const [companyRows] = await pool.query('SELECT razon_social as nombre FROM companies WHERE id = ?', [company_id]);
        const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
        const [providerRows] = await pool.query('SELECT nombre, correo FROM providers WHERE id = ?', [provider_id]);

        const [rows] = await pool.query(`
            SELECT 
                h.id as purchase_id, NULL as expense_id, h.fecha as fecha,
                cat.description as tipo,
                h.numero_documento as documento,
                (h.monto_total - COALESCE((SELECT SUM(monto) FROM provider_payments WHERE purchase_id = h.id), 0)) as saldo_pendiente,
                DATEDIFF(NOW(), h.fecha) as dias_antiguedad
            FROM purchase_headers h
            LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code COLLATE utf8mb4_unicode_ci
            WHERE h.company_id = ? AND h.branch_id = ? AND h.provider_id = ?
            AND h.condicion_operacion_id = '2' AND h.status != 'ANULADO'
            HAVING saldo_pendiente > 0.001 

            UNION ALL

            SELECT 
                NULL as purchase_id, e.id as expense_id, e.fecha as fecha,
                cat.description as tipo,
                e.numero_documento as documento,
                (e.monto_total - COALESCE((SELECT SUM(monto) FROM provider_payments WHERE expense_id = e.id), 0)) as saldo_pendiente,
                DATEDIFF(NOW(), e.fecha) as dias_antiguedad
            FROM expense_headers e
            LEFT JOIN cat_002_tipo_dte cat ON e.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code COLLATE utf8mb4_unicode_ci
            WHERE e.company_id = ? AND e.branch_id = ? AND e.provider_id = ?
            AND e.condicion_operacion_id = '2' AND e.status != 'ANULADO'
            HAVING saldo_pendiente > 0.001
            
            ORDER BY fecha ASC
        `, [company_id, branch_id, provider_id, company_id, branch_id, provider_id]);

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
            provider_name: providerRows[0].nombre,
            provider_email: providerRows[0].correo,
            documents,
            totals,
            total_balance: Object.values(totals).reduce((a, b) => a + b, 0)
        };

        const pdfBuffer = await generateProviderAgingPDF(pdfData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Antiguedad_Prov_${providerRows[0].nombre.replace(/ /g, '_')}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error in exportProviderAgingPDF:', error);
        res.status(500).json({ message: 'Error al generar PDF de antigüedad' });
    }
};

/**
 * Envía el comprobante de pago al proveedor por correo.
 */
const sendReceiptEmail = async (req, res) => {
    const { id } = req.params;
    try {
        await mailer.sendProviderPaymentReceiptEmail(id);
        res.json({ message: 'Copia enviada al proveedor' });
    } catch (error) {
        console.error('[CXP Controller] Error re-sending receipt email:', error);
        res.status(500).json({ message: error.message || 'Error enviando correo' });
    }
};

/**
 * Envía el reporte de antigüedad del proveedor por correo electrónico.
 */
const sendProviderAgingEmail = async (req, res) => {
    const { provider_id, branch_id } = req.body;
    const company_id = req.company_id;

    try {
        const [companyRows] = await pool.query('SELECT razon_social as nombre FROM companies WHERE id = ?', [company_id]);
        const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
        const [providerRows] = await pool.query('SELECT nombre, correo FROM providers WHERE id = ?', [provider_id]);

        if (!providerRows[0].correo) {
            return res.status(400).json({ message: 'El proveedor no tiene un correo electrónico registrado' });
        }

        const [rows] = await pool.query(`
            SELECT 
                h.id as purchase_id, NULL as expense_id, h.fecha as fecha,
                cat.description as tipo,
                h.numero_documento as documento,
                (h.monto_total - COALESCE((SELECT SUM(monto) FROM provider_payments WHERE purchase_id = h.id), 0)) as saldo_pendiente,
                DATEDIFF(NOW(), h.fecha) as dias_antiguedad
            FROM purchase_headers h
            LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code COLLATE utf8mb4_unicode_ci
            WHERE h.company_id = ? AND h.branch_id = ? AND h.provider_id = ?
            AND h.condicion_operacion_id = '2' AND h.status != 'ANULADO'
            HAVING saldo_pendiente > 0.001 

            UNION ALL

            SELECT 
                NULL as purchase_id, e.id as expense_id, e.fecha as fecha,
                cat.description as tipo,
                e.numero_documento as documento,
                (e.monto_total - COALESCE((SELECT SUM(monto) FROM provider_payments WHERE expense_id = e.id), 0)) as saldo_pendiente,
                DATEDIFF(NOW(), e.fecha) as dias_antiguedad
            FROM expense_headers e
            LEFT JOIN cat_002_tipo_dte cat ON e.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code COLLATE utf8mb4_unicode_ci
            WHERE e.company_id = ? AND e.branch_id = ? AND e.provider_id = ?
            AND e.condicion_operacion_id = '2' AND e.status != 'ANULADO'
            HAVING saldo_pendiente > 0.001
            
            ORDER BY fecha ASC
        `, [company_id, branch_id, provider_id, company_id, branch_id, provider_id]);

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

        const pdfBuffer = await generateProviderAgingPDF({
            company_name: companyRows[0].nombre,
            branch_name: branchRows[0].nombre,
            provider_name: providerRows[0].nombre,
            provider_email: providerRows[0].correo,
            documents,
            totals,
            total_balance: Object.values(totals).reduce((a, b) => a + b, 0)
        });

        await mailer.sendMail({
            branchId: branch_id,
            to: providerRows[0].correo,
            subject: `CXP - Antigüedad de Saldos - ${companyRows[0].nombre}`,
            text: `Estimado(a) Proveedor ${providerRows[0].nombre},\n\nAdjuntamos su reporte de antigüedad de saldos detallando nuestros compromisos pendientes hacia ustedes.\n\nAtentamente,\n${companyRows[0].nombre}`,
            attachments: [{ filename: 'Antiguedad_Prov.pdf', content: pdfBuffer }]
        });

        res.json({ message: 'Correo enviado al proveedor exitosamente' });
    } catch (error) {
        console.error('Error in sendProviderAgingEmail:', error);
        res.status(500).json({ message: 'Error al enviar el correo al proveedor' });
    }
};

/**
 * Obtiene el reporte de saldos de todos los proveedores a una fecha de corte específica.
 */
/**
 * Genera y descarga el comprobante de pago al proveedor en PDF.
 */
const exportPaymentPDF = async (req, res) => {
    const { id } = req.params;
    const company_id = req.company_id;

    try {
        const [targetPaymentRows] = await pool.query('SELECT * FROM provider_payments WHERE id = ? AND company_id = ?', [id, company_id]);
        if (targetPaymentRows.length === 0) return res.status(404).json({ message: 'Pago no encontrado' });
        const p = targetPaymentRows[0];

        const [paymentRows] = await pool.query(`
            SELECT p.*, 
                   prov.nombre AS customer_name,
                   b.nombre AS branch_name, b.logo_url AS branch_logo_url,
                   comp.razon_social AS company_name, comp.logo_url AS company_logo_url, comp.nit AS company_nit,
                   COALESCE(cat_p.description, cat_e.description) as documento_tipo,
                   COALESCE(h.numero_documento, e.numero_documento) as documento_aplicado,
                   COALESCE(h.fecha, e.fecha) as documento_fecha,
                   COALESCE(h.monto_total, e.monto_total) as documento_total
            FROM provider_payments p
            JOIN providers prov ON p.provider_id = prov.id
            JOIN branches b ON p.branch_id = b.id
            JOIN companies comp ON b.company_id = comp.id
            LEFT JOIN purchase_headers h ON p.purchase_id = h.id
            LEFT JOIN expense_headers e ON p.expense_id = e.id
            LEFT JOIN cat_002_tipo_dte cat_p ON h.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat_p.code COLLATE utf8mb4_unicode_ci
            LEFT JOIN cat_002_tipo_dte cat_e ON e.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat_e.code COLLATE utf8mb4_unicode_ci
            WHERE p.provider_id = ? AND p.branch_id = ? AND p.fecha_pago = ? 
            AND p.metodo_pago = ? AND (p.referencia = ? OR (p.referencia IS NULL AND ? IS NULL))
            AND ABS(TIMESTAMPDIFF(SECOND, p.created_at, ?)) < 10
            AND p.company_id = ?
        `, [p.provider_id, p.branch_id, p.fecha_pago, p.metodo_pago, p.referencia, p.referencia, p.created_at, company_id]);

        const first = paymentRows[0];
        const receiptData = {
            id: first.id,
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

        const { generatePaymentReceiptPDF } = require('../services/pdf.service');
        const pdfBuffer = await generatePaymentReceiptPDF(receiptData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Comprobante_Pago_${id}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[CXP Controller] Error generating payment PDF:', error);
        res.status(500).json({ message: 'Error al generar PDF' });
    }
};

const getProviderBalancesReport = async (req, res) => {
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
                p.id,
                p.nombre,
                COALESCE(p.nit, p.numero_documento, '-') as dui_nit,
                COALESCE(p.nrc, '-') as nrc,
                (
                    (
                        COALESCE((
                            SELECT SUM(h.monto_total)
                            FROM purchase_headers h
                            WHERE h.provider_id = p.id 
                            AND h.branch_id = ? 
                            AND h.condicion_operacion_id = '2'
                            AND h.status != 'ANULADO'
                            AND h.fecha <= ?
                        ), 0) +
                        COALESCE((
                            SELECT SUM(e.monto_total)
                            FROM expense_headers e
                            WHERE e.provider_id = p.id 
                            AND e.branch_id = ? 
                            AND e.condicion_operacion_id = '2'
                            AND e.status != 'ANULADO'
                            AND e.fecha <= ?
                        ), 0)
                    ) - 
                    COALESCE((
                        SELECT SUM(pay.monto)
                        FROM provider_payments pay
                        WHERE pay.provider_id = p.id 
                        AND pay.branch_id = ?
                        AND pay.fecha_pago <= ?
                    ), 0)
                ) as saldo
            FROM providers p
            WHERE p.company_id = ?
            HAVING saldo > 0.001 OR saldo < -0.001
            ORDER BY p.nombre ASC
        `, [branch_id, endDate, branch_id, endDate, branch_id, endDate, company_id]);

        const pdfData = {
            company_name: companyRows[0].nombre,
            branch_name: branchRows[0].nombre,
            endDate,
            items: rows,
            total_general: rows.reduce((acc, r) => acc + parseFloat(r.saldo), 0)
        };

        const pdfBuffer = await generateProviderBalancesPDF(pdfData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Saldos_Proveedores_${endDate}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error in getProviderBalancesReport:', error);
        res.status(500).json({ message: 'Error al generar reporte de saldos de proveedores' });
    }
};

/**
 * Exporta el reporte detallado de documentos pendientes a PDF (CXP).
 */
const exportProviderPendingDocumentsDetailedPDF = async (req, res) => {
    const { branch_id, cutoffDate, provider_id } = req.query;
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
            SELECT * FROM (
                SELECT 
                    'COMPRA' as origen,
                    h.fecha as fecha,
                    DATEDIFF(?, h.fecha) as dias,
                    CAST(COALESCE(cat.description, h.tipo_documento_id) AS CHAR) COLLATE utf8mb4_unicode_ci as tipo,
                    CAST(h.numero_documento AS CHAR) COLLATE utf8mb4_unicode_ci as documento,
                    h.monto_total as monto,
                    (h.monto_total - COALESCE((
                        SELECT SUM(monto) FROM provider_payments 
                        WHERE purchase_id = h.id AND fecha_pago <= ?
                    ), 0)) as saldo,
                    p.id as provider_id,
                    CAST(p.nombre AS CHAR) COLLATE utf8mb4_unicode_ci as provider_name
                FROM purchase_headers h
                JOIN providers p ON h.provider_id = p.id
                LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code COLLATE utf8mb4_unicode_ci
                WHERE h.company_id = ? AND h.branch_id = ? AND h.condicion_operacion_id = '2' AND h.status != 'ANULADO' AND h.fecha <= ?

                UNION ALL

                SELECT 
                    'GASTO' as origen,
                    e.fecha as fecha,
                    DATEDIFF(?, e.fecha) as dias,
                    CAST(COALESCE(cat.description, e.tipo_documento_id) AS CHAR) COLLATE utf8mb4_unicode_ci as tipo,
                    CAST(e.numero_documento AS CHAR) COLLATE utf8mb4_unicode_ci as documento,
                    e.monto_total as monto,
                    (e.monto_total - COALESCE((
                        SELECT SUM(monto) FROM provider_payments 
                        WHERE expense_id = e.id AND fecha_pago <= ?
                    ), 0)) as saldo,
                    p.id as provider_id,
                    CAST(p.nombre AS CHAR) COLLATE utf8mb4_unicode_ci as provider_name
                FROM expense_headers e
                JOIN providers p ON e.provider_id = p.id
                LEFT JOIN cat_002_tipo_dte cat ON e.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code COLLATE utf8mb4_unicode_ci
                WHERE e.company_id = ? AND e.branch_id = ? AND e.condicion_operacion_id = '2' AND e.status != 'ANULADO' AND e.fecha <= ?
            ) as combined
            WHERE 1=1
        `;
        const params = [
            cutoffDate, cutoffDate, company_id, branch_id, cutoffDate,
            cutoffDate, cutoffDate, company_id, branch_id, cutoffDate
        ];

        if (provider_id && provider_id !== 'all' && provider_id !== 'undefined') {
            sql += ' AND provider_id = ?';
            params.push(provider_id);
        }

        sql += ' HAVING saldo > 0.001 ORDER BY provider_name, fecha';

        const [rows] = await pool.query(sql, params);

        // Group by provider
        const grouped = [];
        let grandTotal = 0;

        rows.forEach(row => {
            let provider = grouped.find(p => p.provider_id === row.provider_id);
            if (!provider) {
                provider = {
                    provider_id: row.provider_id,
                    provider_name: row.provider_name,
                    documents: [],
                    subtotal: 0
                };
                grouped.push(provider);
            }
            provider.documents.push(row);
            provider.subtotal += parseFloat(row.saldo);
            grandTotal += parseFloat(row.saldo);
        });

        const pdfData = {
            company_name: companyRows[0].razon_social,
            company_nit: companyRows[0].nit,
            branch_name: branchRows[0].nombre,
            cutoffDate,
            providers: grouped,
            grandTotal
        };

        const { generateProviderPendingDocumentsDetailedPDF } = require('../services/pdf.service');
        const pdfBuffer = await generateProviderPendingDocumentsDetailedPDF(pdfData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Documentos_Pendientes_Pagar_${cutoffDate}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error in exportProviderPendingDocumentsDetailedPDF:', error);
        res.status(500).json({ message: 'Error al generar reporte de documentos pendientes' });
    }
};

module.exports = {
    getProviderStatement,
    getPendingDocuments,
    registerPayment,
    getPaymentHistory,
    getPaymentById,
    updatePayment,
    deletePayment,
    sendReceiptEmail,
    sendProviderStatementEmail,
    exportProviderStatementPDF,
    getProviderAgingReport,
    exportProviderAgingPDF,
    sendProviderAgingEmail,
    getProviderBalancesReport,
    exportPaymentPDF,
    exportProviderPendingDocumentsDetailedPDF
};
