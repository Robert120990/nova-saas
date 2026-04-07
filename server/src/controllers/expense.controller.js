const pool = require('../config/db');
const PDFDocument = require('pdfkit');

/**
 * Obtener lista de gastos con búsqueda y paginación
 */
const getExpenses = async (req, res) => {
    try {
        const { search, page = 1, limit = 10, branch_id } = req.query;
        const offset = (page - 1) * limit;
        const companyId = req.company_id || req.user?.company_id;

        let query = `
            SELECT eh.*, 
                   p.nombre AS provider_nombre, 
                   br.nombre AS branch_nombre,
                   u.nombre AS usuario_nombre,
                   cat_dte.description AS tipo_documento_nombre,
                   cat_cond.description AS condicion_operacion_nombre
            FROM expense_headers eh
            LEFT JOIN providers p ON eh.provider_id = p.id
            LEFT JOIN branches br ON eh.branch_id = br.id
            LEFT JOIN users u ON eh.usuario_id = u.id
            LEFT JOIN cat_002_tipo_dte cat_dte ON eh.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat_dte.code
            LEFT JOIN cat_016_condicion_operacion cat_cond ON eh.condicion_operacion_id COLLATE utf8mb4_unicode_ci = cat_cond.code
            WHERE eh.company_id = ?
        `;
        let params = [companyId];

        if (branch_id) {
            query += " AND eh.branch_id = ?";
            params.push(branch_id);
        }

        if (search) {
            query += ` AND (eh.numero_documento LIKE ? OR p.nombre LIKE ? OR eh.observaciones LIKE ?) `;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        // Count total for pagination
        const countQuery = `SELECT COUNT(*) as total FROM (${query}) as sub`;
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        // Final query with pagination
        query += ` ORDER BY eh.fecha DESC, eh.id DESC LIMIT ? OFFSET ? `;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);

        res.json({
            data: rows,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error al obtener gastos:', error);
        res.status(500).json({ message: 'Error al obtener gastos' });
    }
};

/**
 * Obtener detalle de un gasto por ID
 */
const getExpenseById = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.user?.company_id;

        const [header] = await pool.query(`
            SELECT eh.*, p.nombre AS provider_nombre, br.nombre AS branch_nombre,
                   cat.description AS tipo_documento_nombre,
                   cat_cond.description AS condicion_operacion_nombre
            FROM expense_headers eh
            LEFT JOIN providers p ON eh.provider_id = p.id
            LEFT JOIN branches br ON eh.branch_id = br.id
            LEFT JOIN cat_002_tipo_dte cat ON eh.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code COLLATE utf8mb4_unicode_ci
            LEFT JOIN cat_016_condicion_operacion cat_cond ON eh.condicion_operacion_id COLLATE utf8mb4_unicode_ci = cat_cond.code COLLATE utf8mb4_unicode_ci
            WHERE eh.id = ? AND eh.company_id = ?
        `, [id, companyId]);

        if (header.length === 0) {
            return res.status(404).json({ message: 'Gasto no encontrado' });
        }

        const [items] = await pool.query(`
            SELECT ei.*, cet.name as expense_type_name
            FROM expense_items ei
            LEFT JOIN cat_expense_types cet ON ei.expense_type_id = cet.id
            WHERE ei.expense_id = ?
        `, [id]);

        res.json({ ...header[0], items });
    } catch (error) {
        console.error('Error al obtener detalle de gasto:', error);
        res.status(500).json({ message: 'Error al obtener detalle de gasto' });
    }
};

/**
 * Crear un nuevo gasto
 */
const createExpense = async (req, res) => {
    const { 
        branch_id, provider_id, fecha, numero_documento, 
        tipo_documento_id, condicion_operacion_id, observaciones,
        total_nosujeta, total_exenta, total_gravada, 
        iva, retencion, percepcion, fovial, cotrans, monto_total,
        period_year, period_month,
        items 
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Debe incluir al menos un item de gasto' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const companyId = req.company_id || req.user?.company_id;
        const usuarioId = req.user?.id;

        if (!companyId || !usuarioId) throw new Error('Sesión no válida');

        // 1. Insertar Cabecera
        const [headerResult] = await connection.query(`
            INSERT INTO expense_headers 
            (company_id, branch_id, usuario_id, provider_id, fecha, numero_documento, 
             tipo_documento_id, condicion_operacion_id, observaciones,
             total_nosujeta, total_exenta, total_gravada, 
             iva, retencion, percepcion, fovial, cotrans, monto_total,
             period_year, period_month)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            companyId, branch_id, usuarioId, provider_id, fecha || new Date(), numero_documento,
            tipo_documento_id, condicion_operacion_id, observaciones,
            total_nosujeta || 0, total_exenta || 0, total_gravada || 0,
            iva || 0, retencion || 0, percepcion || 0, fovial || 0, cotrans || 0, monto_total || 0,
            period_year, period_month
        ]);

        const expenseId = headerResult.insertId;

        // 2. Insertar Items
        for (const item of items) {
            const { description, expense_type_id, tax_type, total } = item;
            await connection.query(`
                INSERT INTO expense_items (expense_id, description, expense_type_id, tax_type, total)
                VALUES (?, ?, ?, ?, ?)
            `, [expenseId, description, expense_type_id || null, tax_type || 'gravada', total || 0]);
        }

        await connection.commit();
        res.status(201).json({ message: 'Gasto registrado con éxito', id: expenseId });
    } catch (error) {
        await connection.rollback();
        console.error('Error al registrar gasto:', error);
        res.status(500).json({ message: 'Error al registrar gasto: ' + error.message });
    } finally {
        connection.release();
    }
};

/**
 * Actualizar un gasto existente
 */
const updateExpense = async (req, res) => {
    const { id } = req.params;
    const { 
        branch_id, provider_id, fecha, numero_documento, 
        tipo_documento_id, condicion_operacion_id, observaciones,
        total_nosujeta, total_exenta, total_gravada, 
        iva, retencion, percepcion, fovial, cotrans, monto_total,
        period_year, period_month,
        items 
    } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const companyId = req.company_id || req.user?.company_id;

        // 1. Verificar existencia
        const [oldExpense] = await connection.query(
            'SELECT * FROM expense_headers WHERE id = ? AND company_id = ?',
            [id, companyId]
        );
        if (oldExpense.length === 0) throw new Error('Gasto no encontrado');

        // 2. Actualizar Cabecera
        await connection.query(`
            UPDATE expense_headers SET 
                branch_id = ?, provider_id = ?, fecha = ?, numero_documento = ?,
                tipo_documento_id = ?, condicion_operacion_id = ?, observaciones = ?,
                total_nosujeta = ?, total_exenta = ?, total_gravada = ?,
                iva = ?, retencion = ?, percepcion = ?, fovial = ?, cotrans = ?, monto_total = ?,
                period_year = ?, period_month = ?
            WHERE id = ? AND company_id = ?
        `, [
            branch_id, provider_id, fecha, numero_documento,
            tipo_documento_id, condicion_operacion_id, observaciones,
            total_nosujeta || 0, total_exenta || 0, total_gravada || 0,
            iva || 0, retencion || 0, percepcion || 0, fovial || 0, cotrans || 0, monto_total || 0,
            period_year, period_month,
            id, companyId
        ]);

        // 3. Reemplazar Items
        await connection.query('DELETE FROM expense_items WHERE expense_id = ?', [id]);
        for (const item of items) {
            const { description, expense_type_id, tax_type, total } = item;
            await connection.query(`
                INSERT INTO expense_items (expense_id, description, expense_type_id, tax_type, total)
                VALUES (?, ?, ?, ?, ?)
            `, [id, description, expense_type_id || null, tax_type || 'gravada', total || 0]);
        }

        await connection.commit();
        res.json({ message: 'Gasto actualizado con éxito' });
    } catch (error) {
        await connection.rollback();
        console.error('Error al actualizar gasto:', error);
        res.status(500).json({ message: 'Error al actualizar gasto: ' + error.message });
    } finally {
        connection.release();
    }
};

/**
 * Anular un gasto
 */
const voidExpense = async (req, res) => {
    const { id } = req.params;
    const companyId = req.company_id || req.user?.company_id;

    try {
        const [result] = await pool.query(
            'UPDATE expense_headers SET status = "ANULADO" WHERE id = ? AND company_id = ?',
            [id, companyId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Gasto no encontrado' });
        }

        res.json({ message: 'Gasto anulado correctamente' });
    } catch (error) {
        console.error('Error al anular gasto:', error);
        res.status(500).json({ message: 'Error al anular gasto' });
    }
};

/**
 * Obtener catálogo de tipos de gasto
 */
const getExpenseTypes = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const [rows] = await pool.query(
            'SELECT * FROM cat_expense_types WHERE company_id = ? ORDER BY name ASC',
            [companyId]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener tipos de gasto:', error);
        res.status(500).json({ message: 'Error al obtener tipos de gasto' });
    }
};

/**
 * Generar Reporte de Gastos en PDF
 */
const getExpenseReportPDF = async (req, res) => {
    try {
        const { start_date, end_date, branch_id, provider_id } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Rango de fechas requerido' });
        }

        // 1. Obtener datos de la empresa
        const [company] = await pool.query('SELECT razon_social, nit FROM companies WHERE id = ?', [companyId]);
        const comp = company[0] || { razon_social: 'EMPRESA', nit: '---' };

        // 2. Construir Query de Gastos
        let sql = `
            SELECT eh.*, 
                   p.nombre AS provider_nombre, 
                   br.nombre AS branch_nombre,
                   cat_dte.description AS tipo_doc_nombre,
                   cat_cond.description AS condicion_nombre
            FROM expense_headers eh
            LEFT JOIN providers p ON eh.provider_id = p.id
            LEFT JOIN branches br ON eh.branch_id = br.id
            LEFT JOIN cat_002_tipo_dte cat_dte ON eh.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat_dte.code
            LEFT JOIN cat_016_condicion_operacion cat_cond ON eh.condicion_operacion_id COLLATE utf8mb4_unicode_ci = cat_cond.code
            WHERE eh.company_id = ? AND eh.fecha BETWEEN ? AND ? AND eh.status != 'ANULADO'
        `;
        const params = [companyId, start_date, end_date];

        if (branch_id && branch_id !== 'all') {
            sql += " AND eh.branch_id = ?";
            params.push(branch_id);
        }

        if (provider_id && provider_id !== 'all') {
            sql += " AND eh.provider_id = ?";
            params.push(provider_id);
        }

        sql += " ORDER BY p.nombre ASC, eh.fecha ASC";

        const [rows] = await pool.query(sql, params);

        // 3. Generar PDF (LANDSCAPE)
        const doc = new PDFDocument({ margin: 30, size: 'LETTER', layout: 'landscape' });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            const result = Buffer.concat(chunks);
            res.setHeader('Content-Type', 'application/pdf');
            res.send(result);
        });

        // Header
        doc.fontSize(16).font('Helvetica-Bold').text(comp.razon_social.toUpperCase(), { align: 'center' });
        doc.fontSize(10).font('Helvetica').text(`NIT: ${comp.nit}`, { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).font('Helvetica-Bold').text('REPORTE DE GASTOS OPERATIVOS (DETALLADO)', { align: 'center' });
        doc.fontSize(9).font('Helvetica').text(`Periodo: ${start_date} al ${end_date}`, { align: 'center' });
        
        let branchName = 'Todas las sucursales';
        if (branch_id !== 'all' && rows.length > 0) branchName = rows[0].branch_nombre;
        doc.text(`Sucursal: ${branchName}`, { align: 'center' });
        doc.moveDown(1.5);

        // Table logic
        const startX = 30;
        let currentY = doc.y;

        const drawTableHeader = (y) => {
            doc.fontSize(7).font('Helvetica-Bold');
            doc.text('FECHA', startX, y);
            doc.text('TIPO DOC', startX + 45, y);
            doc.text('NÚMERO', startX + 150, y);
            doc.text('CONDICIÓN', startX + 220, y);
            doc.text('GRAVADA', startX + 275, y, { width: 55, align: 'right' });
            doc.text('EXENTA', startX + 335, y, { width: 55, align: 'right' });
            doc.text('IVA', startX + 395, y, { width: 45, align: 'right' });
            doc.text('RET.', startX + 445, y, { width: 40, align: 'right' });
            doc.text('PER.', startX + 490, y, { width: 40, align: 'right' });
            doc.text('FOV.', startX + 535, y, { width: 45, align: 'right' });
            doc.text('COT.', startX + 585, y, { width: 45, align: 'right' });
            doc.text('TOTAL', startX + 635, y, { width: 70, align: 'right' });
            doc.moveTo(startX, y + 10).lineTo(740, y + 10).stroke();
            return y + 15;
        };

        currentY = drawTableHeader(currentY);

        let currentProvider = null;
        let pTotals = { grav: 0, exe: 0, iva: 0, ret: 0, per: 0, fov: 0, cot: 0, total: 0 };
        let gTotals = { grav: 0, exe: 0, iva: 0, ret: 0, per: 0, fov: 0, cot: 0, total: 0 };

        rows.forEach((row, index) => {
            // Check for page break
            if (currentY > 550) {
                doc.addPage();
                currentY = drawTableHeader(30);
            }

            // Grouping Header
            if (row.provider_nombre !== currentProvider) {
                if (currentProvider !== null) {
                    // Print subtotal
                    doc.fontSize(7).font('Helvetica-Bold');
                    doc.text('SUBTOTAL:', startX + 220, currentY, { width: 50, align: 'right' });
                    doc.text(`$${pTotals.grav.toFixed(2)}`, startX + 275, currentY, { width: 55, align: 'right' });
                    doc.text(`$${pTotals.exe.toFixed(2)}`, startX + 335, currentY, { width: 55, align: 'right' });
                    doc.text(`$${pTotals.iva.toFixed(2)}`, startX + 395, currentY, { width: 45, align: 'right' });
                    doc.text(`$${pTotals.ret.toFixed(2)}`, startX + 445, currentY, { width: 40, align: 'right' });
                    doc.text(`$${pTotals.per.toFixed(2)}`, startX + 490, currentY, { width: 40, align: 'right' });
                    doc.text(`$${pTotals.fov.toFixed(2)}`, startX + 535, currentY, { width: 45, align: 'right' });
                    doc.text(`$${pTotals.cot.toFixed(2)}`, startX + 585, currentY, { width: 45, align: 'right' });
                    doc.text(`$${pTotals.total.toFixed(2)}`, startX + 635, currentY, { width: 70, align: 'right' });
                    currentY += 15;
                    pTotals = { grav: 0, exe: 0, iva: 0, ret: 0, per: 0, fov: 0, cot: 0, total: 0 };
                }
                
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#4f46e5');
                doc.text(`PROVEEDOR: ${row.provider_nombre || 'S/N'}`, startX, currentY);
                doc.fillColor('black');
                currentY += 12;
                currentProvider = row.provider_nombre;
            }

            // Row Data
            doc.fontSize(7).font('Helvetica');
            const fechaVal = new Date(row.fecha).toLocaleDateString();
            doc.text(fechaVal, startX, currentY);
            doc.text(row.tipo_doc_nombre || '---', startX + 45, currentY, { width: 100, truncate: true });
            doc.text(row.numero_documento || '---', startX + 150, currentY, { width: 65 });
            doc.text(row.condicion_nombre || 'CONTADO', startX + 220, currentY, { width: 50 });
            doc.text(`$${parseFloat(row.total_gravada || 0).toFixed(2)}`, startX + 275, currentY, { width: 55, align: 'right' });
            doc.text(`$${parseFloat(row.total_exenta || 0).toFixed(2)}`, startX + 335, currentY, { width: 55, align: 'right' });
            doc.text(`$${parseFloat(row.iva || 0).toFixed(2)}`, startX + 395, currentY, { width: 45, align: 'right' });
            doc.text(`$${parseFloat(row.retencion || 0).toFixed(2)}`, startX + 445, currentY, { width: 40, align: 'right' });
            doc.text(`$${parseFloat(row.percepcion || 0).toFixed(2)}`, startX + 490, currentY, { width: 40, align: 'right' });
            doc.text(`$${parseFloat(row.fovial || 0).toFixed(2)}`, startX + 535, currentY, { width: 45, align: 'right' });
            doc.text(`$${parseFloat(row.cotrans || 0).toFixed(2)}`, startX + 585, currentY, { width: 45, align: 'right' });
            doc.text(`$${parseFloat(row.monto_total || 0).toFixed(2)}`, startX + 635, currentY, { width: 70, align: 'right' });

            // Sum pTotals
            pTotals.grav += parseFloat(row.total_gravada || 0);
            pTotals.exe += parseFloat(row.total_exenta || 0);
            pTotals.iva += parseFloat(row.iva || 0);
            pTotals.ret += parseFloat(row.retencion || 0);
            pTotals.per += parseFloat(row.percepcion || 0);
            pTotals.fov += parseFloat(row.fovial || 0);
            pTotals.cot += parseFloat(row.cotrans || 0);
            pTotals.total += parseFloat(row.monto_total || 0);

            // Sum gTotals
            gTotals.grav += parseFloat(row.total_gravada || 0);
            gTotals.exe += parseFloat(row.total_exenta || 0);
            gTotals.iva += parseFloat(row.iva || 0);
            gTotals.ret += parseFloat(row.retencion || 0);
            gTotals.per += parseFloat(row.percepcion || 0);
            gTotals.fov += parseFloat(row.fovial || 0);
            gTotals.cot += parseFloat(row.cotrans || 0);
            gTotals.total += parseFloat(row.monto_total || 0);

            currentY += 12;

            // Last subtotal
            if (index === rows.length - 1) {
                doc.fontSize(7).font('Helvetica-Bold');
                doc.text('SUBTOTAL:', startX + 220, currentY, { width: 50, align: 'right' });
                doc.text(`$${pTotals.grav.toFixed(2)}`, startX + 275, currentY, { width: 55, align: 'right' });
                doc.text(`$${pTotals.exe.toFixed(2)}`, startX + 335, currentY, { width: 55, align: 'right' });
                doc.text(`$${pTotals.iva.toFixed(2)}`, startX + 395, currentY, { width: 45, align: 'right' });
                doc.text(`$${pTotals.ret.toFixed(2)}`, startX + 445, currentY, { width: 40, align: 'right' });
                doc.text(`$${pTotals.per.toFixed(2)}`, startX + 490, currentY, { width: 40, align: 'right' });
                doc.text(`$${pTotals.fov.toFixed(2)}`, startX + 535, currentY, { width: 45, align: 'right' });
                doc.text(`$${pTotals.cot.toFixed(2)}`, startX + 585, currentY, { width: 45, align: 'right' });
                doc.text(`$${pTotals.total.toFixed(2)}`, startX + 635, currentY, { width: 70, align: 'right' });
                currentY += 20;
            }
        });

        // Grand Total Section
        doc.moveTo(startX, currentY).lineTo(740, currentY).stroke();
        currentY += 10;
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('TOTAL GENERAL:', startX + 115, currentY, { width: 155, align: 'right' });
        doc.text(`$${gTotals.grav.toFixed(2)}`, startX + 275, currentY, { width: 55, align: 'right' });
        doc.text(`$${gTotals.exe.toFixed(2)}`, startX + 335, currentY, { width: 55, align: 'right' });
        doc.text(`$${gTotals.iva.toFixed(2)}`, startX + 395, currentY, { width: 45, align: 'right' });
        doc.text(`$${gTotals.ret.toFixed(2)}`, startX + 445, currentY, { width: 40, align: 'right' });
        doc.text(`$${gTotals.per.toFixed(2)}`, startX + 490, currentY, { width: 40, align: 'right' });
        doc.text(`$${gTotals.fov.toFixed(2)}`, startX + 535, currentY, { width: 45, align: 'right' });
        doc.text(`$${gTotals.cot.toFixed(2)}`, startX + 585, currentY, { width: 45, align: 'right' });
        doc.text(`$${gTotals.total.toFixed(2)}`, startX + 635, currentY, { width: 70, align: 'right' });

        doc.end();

    } catch (error) {
        console.error('Error al generar reporte de gastos:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error interno al generar reporte' });
        }
    }
};

module.exports = {
    getExpenses,
    getExpenseById,
    createExpense,
    updateExpense,
    voidExpense,
    getExpenseTypes,
    getExpenseReportPDF
};
