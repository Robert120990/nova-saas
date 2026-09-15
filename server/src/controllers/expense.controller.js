const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const excelService = require('../services/excel.service');
const notificationService = require('../services/notification.service');
const reportPdfHelper = require('../utils/reportPdfHelper');

/**
 * Obtener lista de gastos con búsqueda y paginación
 */
const getExpenses = async (req, res) => {
    try {
        const { search, page = 1, limit = 15, branch_id, year, month } = req.query;
        const offset = (page - 1) * limit;
        const companyId = req.company_id || req.user?.company_id;

        let query = `
            SELECT eh.*, 
                   p.nombre AS provider_nombre, 
                   p.nrc AS provider_nrc,
                   p.nit AS provider_nit,
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

        if (year) {
            query += " AND (eh.period_year = ? OR (eh.period_year IS NULL AND YEAR(eh.fecha) = ?))";
            params.push(year, year);
        }

        if (month) {
            query += " AND (eh.period_month = ? OR (eh.period_month IS NULL AND MONTH(eh.fecha) = ?))";
            params.push(month, month);
        }

        const getSearchWords = (term) => {
            const words = term.trim().split(/\s+/).filter(Boolean);
            return [...new Set(words)];
        };

        const searchWords = search ? getSearchWords(search) : [];
        searchWords.forEach(word => {
            query += ` AND (eh.numero_documento LIKE ? OR p.nombre LIKE ? OR p.nombre_comercial LIKE ? OR p.nit LIKE ? OR p.nrc LIKE ? OR eh.observaciones LIKE ? OR eh.num_control LIKE ? OR eh.sello_recepcion LIKE ?) `;
            const searchTerm = `%${word}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        });

        // Count total for pagination
        const countQuery = `SELECT COUNT(*) as total FROM (${query}) as sub`;
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        // KPI summary for the queried period/filters (only active records)
        let summaryQuery = `
            SELECT 
                COALESCE(SUM(eh.monto_total), 0) AS total_monto,
                COALESCE(SUM(eh.total_gravada), 0) AS total_gravada,
                COALESCE(SUM(eh.iva), 0) AS total_iva,
                COALESCE(SUM(eh.retencion), 0) AS total_retencion,
                COALESCE(SUM(eh.percepcion), 0) AS total_percepcion,
                COALESCE(SUM(eh.fovial), 0) AS total_fovial,
                COALESCE(SUM(eh.cotrans), 0) AS total_cotrans,
                COALESCE(SUM(eh.anticipo_cuenta), 0) AS total_anticipo_cuenta,
                COALESCE(SUM(eh.monto_sujeto), 0) AS total_monto_sujeto,
                COALESCE(SUM(eh.total_exenta), 0) AS total_exenta,
                COALESCE(SUM(eh.total_nosujeta), 0) AS total_nosujeta
            FROM expense_headers eh
            LEFT JOIN providers p ON eh.provider_id = p.id
            WHERE eh.company_id = ? AND eh.status = 'ACTIVO'
        `;
        let summaryParams = [companyId];
        if (branch_id) {
            summaryQuery += " AND eh.branch_id = ?";
            summaryParams.push(branch_id);
        }
        if (year) {
            summaryQuery += " AND (eh.period_year = ? OR (eh.period_year IS NULL AND YEAR(eh.fecha) = ?))";
            summaryParams.push(year, year);
        }
        if (month) {
            summaryQuery += " AND (eh.period_month = ? OR (eh.period_month IS NULL AND MONTH(eh.fecha) = ?))";
            summaryParams.push(month, month);
        }
        searchWords.forEach(word => {
            summaryQuery += ` AND (eh.numero_documento LIKE ? OR p.nombre LIKE ? OR p.nombre_comercial LIKE ? OR p.nit LIKE ? OR p.nrc LIKE ? OR eh.observaciones LIKE ? OR eh.num_control LIKE ? OR eh.sello_recepcion LIKE ?) `;
            const searchTerm = `%${word}%`;
            summaryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        });
        const [summaryResult] = await pool.query(summaryQuery, summaryParams);
        const summary = summaryResult[0] || {
            total_monto: 0,
            total_gravada: 0,
            total_iva: 0,
            total_retencion: 0,
            total_percepcion: 0
        };

        // Final query with pagination
        query += ` ORDER BY eh.fecha DESC, eh.id DESC LIMIT ? OFFSET ? `;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);

        res.json({
            data: rows,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit),
            summary
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
            SELECT eh.*, 
                   p.nombre AS provider_nombre, 
                   p.nrc AS provider_nrc,
                   p.nit AS provider_nit,
                   p.es_gran_contribuyente AS provider_es_gran_contribuyente,
                   br.nombre AS branch_nombre,
                   u.nombre AS usuario_nombre,
                   cat.description AS tipo_documento_nombre,
                   cat_cond.description AS condicion_operacion_nombre
            FROM expense_headers eh
            LEFT JOIN providers p ON eh.provider_id = p.id
            LEFT JOIN branches br ON eh.branch_id = br.id
            LEFT JOIN users u ON eh.usuario_id = u.id
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
        documento_afectado, fecha_afectada, num_control, sello_recepcion,
        tipo_operacion, tipo_clasificacion, tipo_sector, tipo_costo,
        gravadas_importaciones, gravadas_internaciones, iva_importaciones,
        items 
    } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const companyId = req.company_id || req.user?.company_id;
        const usuarioId = req.user?.id;

        if (!companyId || !usuarioId) throw new Error('Sesión no válida');

        // Periodo fiscal del gasto
        let docYear = new Date().getFullYear();
        let docMonth = new Date().getMonth() + 1;
        if (fecha) {
            if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fecha)) {
                const parts = fecha.split('T')[0].split('-');
                docYear = parseInt(parts[0], 10);
                docMonth = parseInt(parts[1], 10);
            } else {
                const d = new Date(fecha);
                if (!isNaN(d.getTime())) {
                    docYear = d.getFullYear();
                    docMonth = d.getMonth() + 1;
                }
            }
        }
        let finalPeriodYear = parseInt(period_year, 10) || docYear;
        let finalPeriodMonth = parseInt(period_month, 10) || docMonth;

        // Si no existe un periodo configurado para este usuario, crearlo al guardar el registro
        const [existingPeriod] = await connection.query(
            'SELECT id FROM purchase_user_periods WHERE user_id = ? AND company_id = ?',
            [usuarioId, companyId]
        );
        if (existingPeriod.length === 0) {
            await connection.query(
                'INSERT INTO purchase_user_periods (user_id, company_id, year, month) VALUES (?, ?, ?, ?)',
                [usuarioId, companyId, finalPeriodYear, finalPeriodMonth]
            );
        }

        // 1. Insertar Cabecera
        const anticipoCuenta = parseFloat(req.body.anticipo_cuenta) || 0;
        const montoSujeto = parseFloat(req.body.monto_sujeto) || 0;
        const [headerResult] = await connection.query(`
            INSERT INTO expense_headers 
            (company_id, branch_id, usuario_id, provider_id, fecha, numero_documento, 
             tipo_documento_id, condicion_operacion_id, observaciones,
             total_nosujeta, total_exenta, total_gravada, 
             iva, retencion, percepcion, fovial, cotrans, anticipo_cuenta, monto_sujeto, monto_total,
             period_year, period_month,
             documento_afectado, fecha_afectada, num_control, sello_recepcion,
             tipo_operacion, tipo_clasificacion, tipo_sector, tipo_costo,
             gravadas_importaciones, gravadas_internaciones, iva_importaciones)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            companyId, branch_id, usuarioId, provider_id, fecha || new Date(), numero_documento,
            tipo_documento_id, condicion_operacion_id, observaciones,
            total_nosujeta || 0, total_exenta || 0, total_gravada || 0,
            iva || 0, retencion || 0, percepcion || 0, fovial || 0, cotrans || 0, anticipoCuenta, montoSujeto, monto_total || 0,
            finalPeriodYear, finalPeriodMonth,
            documento_afectado || null, fecha_afectada || null, num_control || null, sello_recepcion || null,
            tipo_operacion || '1', tipo_clasificacion || '2', tipo_sector || '4', tipo_costo || '2',
            gravadas_importaciones || 0, gravadas_internaciones || 0, iva_importaciones || 0
        ]);

        const expenseId = headerResult.insertId;

        // 2. Insertar Items (opcional con fallback si no se especifican conceptos individuales)
        const itemsToInsert = (items && Array.isArray(items) && items.length > 0) ? items : [{
            description: observaciones || 'Gasto registrado',
            expense_type_id: null,
            tax_type: 'gravada',
            total: monto_total || 0
        }];

        for (const item of itemsToInsert) {
            const { description, expense_type_id, tax_type, total } = item;
            await connection.query(`
                INSERT INTO expense_items (expense_id, description, expense_type_id, tax_type, total)
                VALUES (?, ?, ?, ?, ?)
            `, [expenseId, description, expense_type_id || null, tax_type || 'gravada', total || 0]);
        }

        await connection.commit();

        const [provRows] = await pool.query('SELECT nombre FROM providers WHERE id = ? AND company_id = ?', [provider_id, companyId]);
        const providerName = provRows.length > 0 ? provRows[0].nombre : '';

        notificationService.notify('expense_created', req.company_id, req.user.branch_id, {
            gasto_id: expenseId,
            proveedor_nombre: providerName,
            numero_documento: numero_documento || '',
            total: monto_total || 0,
            sucursal: req.branch_name || ''
        }).catch(() => {});

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
        documento_afectado, fecha_afectada, num_control, sello_recepcion,
        tipo_operacion, tipo_clasificacion, tipo_sector, tipo_costo,
        gravadas_importaciones, gravadas_internaciones, iva_importaciones,
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

        const usuarioId = req.user?.id;

        // Periodo fiscal del gasto
        let docYear = new Date().getFullYear();
        let docMonth = new Date().getMonth() + 1;
        if (fecha) {
            if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fecha)) {
                const parts = fecha.split('T')[0].split('-');
                docYear = parseInt(parts[0], 10);
                docMonth = parseInt(parts[1], 10);
            } else {
                const d = new Date(fecha);
                if (!isNaN(d.getTime())) {
                    docYear = d.getFullYear();
                    docMonth = d.getMonth() + 1;
                }
            }
        }
        let finalPeriodYear = parseInt(period_year, 10) || docYear;
        let finalPeriodMonth = parseInt(period_month, 10) || docMonth;

        // Si no existe un periodo configurado para este usuario, crearlo al guardar el registro
        if (usuarioId && companyId) {
            const [existingPeriod] = await connection.query(
                'SELECT id FROM purchase_user_periods WHERE user_id = ? AND company_id = ?',
                [usuarioId, companyId]
            );
            if (existingPeriod.length === 0) {
                await connection.query(
                    'INSERT INTO purchase_user_periods (user_id, company_id, year, month) VALUES (?, ?, ?, ?)',
                    [usuarioId, companyId, finalPeriodYear, finalPeriodMonth]
                );
            }
        }

        // 2. Actualizar Cabecera
        const anticipoCuenta = parseFloat(req.body.anticipo_cuenta) || 0;
        const montoSujeto = parseFloat(req.body.monto_sujeto) || 0;
        await connection.query(`
            UPDATE expense_headers SET 
                branch_id = ?, provider_id = ?, fecha = ?, numero_documento = ?,
                tipo_documento_id = ?, condicion_operacion_id = ?, observaciones = ?,
                total_nosujeta = ?, total_exenta = ?, total_gravada = ?,
                iva = ?, retencion = ?, percepcion = ?, fovial = ?, cotrans = ?, anticipo_cuenta = ?, monto_sujeto = ?, monto_total = ?,
                period_year = ?, period_month = ?,
                documento_afectado = ?, fecha_afectada = ?, num_control = ?, sello_recepcion = ?,
                tipo_operacion = ?, tipo_clasificacion = ?, tipo_sector = ?, tipo_costo = ?,
                gravadas_importaciones = ?, gravadas_internaciones = ?, iva_importaciones = ?
            WHERE id = ? AND company_id = ?
        `, [
            branch_id, provider_id, fecha, numero_documento,
            tipo_documento_id, condicion_operacion_id, observaciones,
            total_nosujeta || 0, total_exenta || 0, total_gravada || 0,
            iva || 0, retencion || 0, percepcion || 0, fovial || 0, cotrans || 0, anticipoCuenta, montoSujeto, monto_total || 0,
            finalPeriodYear, finalPeriodMonth,
            documento_afectado || null, fecha_afectada || null, num_control || null, sello_recepcion || null,
            tipo_operacion || '1', tipo_clasificacion || '2', tipo_sector || '4', tipo_costo || '2',
            gravadas_importaciones || 0, gravadas_internaciones || 0, iva_importaciones || 0,
            id, companyId
        ]);

        // 3. Reemplazar Items (opcional con fallback)
        await connection.query('DELETE FROM expense_items WHERE expense_id = ?', [id]);
        const itemsToUpdate = (items && Array.isArray(items) && items.length > 0) ? items : [{
            description: observaciones || 'Gasto registrado',
            expense_type_id: null,
            tax_type: 'gravada',
            total: monto_total || 0
        }];

        for (const item of itemsToUpdate) {
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

        notificationService.notify('expense_annulled', req.company_id, req.user.branch_id, {
            gasto_id: id,
            empresa_id: companyId,
            sucursal: req.branch_name || ''
        }).catch(() => {});

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
        const { start_date, end_date, branch_id, provider_id, expense_type_id } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Rango de fechas requerido' });
        }

        // 1. Obtener datos de la empresa
        const company = await reportPdfHelper.getCompanyInfo(companyId);

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

        if (expense_type_id && expense_type_id !== 'all') {
            sql += ` AND EXISTS (SELECT 1 FROM expense_items ei WHERE ei.expense_id = eh.id AND ei.expense_type_id = ?)`;
            params.push(expense_type_id);
        }

        sql += " ORDER BY p.nombre ASC, eh.fecha ASC";

        const [rows] = await pool.query(sql, params);

        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Reporte',
                    columns: [
                        { header: 'Proveedor', key: 'proveedor', width: 25 },
                        { header: 'Sucursal', key: 'sucursal', width: 20 },
                        { header: 'Fecha', key: 'fecha', width: 15 },
                        { header: 'Tipo Doc', key: 'tipo_doc', width: 12 },
                        { header: 'Documento', key: 'documento', width: 15 },
                        { header: 'Condición', key: 'condicion', width: 12 },
                        { header: 'Gravada', key: 'gravada', width: 12 },
                        { header: 'Exenta', key: 'exenta', width: 12 },
                        { header: 'IVA', key: 'iva', width: 10 },
                        { header: 'Retención', key: 'retencion', width: 12 },
                        { header: 'Percepción', key: 'percepcion', width: 12 },
                        { header: 'FOVIAL', key: 'fovial', width: 10 },
                        { header: 'COTRANS', key: 'cotrans', width: 10 },
                        { header: 'Anticipo Cta.', key: 'anticipo_cuenta', width: 12 },
                        { header: 'Monto Sujeto', key: 'monto_sujeto', width: 12 },
                        { header: 'Total', key: 'total', width: 12 }
                    ],
                    data: rows.map(r => ({
                        proveedor: r.provider_nombre,
                        sucursal: r.branch_nombre,
                        fecha: new Date(r.fecha).toLocaleDateString('es-SV'),
                        tipo_doc: r.tipo_doc_nombre,
                        documento: r.numero_documento,
                        condicion: r.condicion_nombre,
                        gravada: parseFloat(r.total_gravada || 0).toFixed(2),
                        exenta: parseFloat(r.total_exenta || 0).toFixed(2),
                        iva: parseFloat(r.iva || 0).toFixed(2),
                        retencion: parseFloat(r.retencion || 0).toFixed(2),
                        percepcion: parseFloat(r.percepcion || 0).toFixed(2),
                        fovial: parseFloat(r.fovial || 0).toFixed(2),
                        cotrans: parseFloat(r.cotrans || 0).toFixed(2),
                        anticipo_cuenta: parseFloat(r.anticipo_cuenta || 0).toFixed(2),
                        monto_sujeto: parseFloat(r.monto_sujeto || 0).toFixed(2),
                        total: parseFloat(r.monto_total || 0).toFixed(2)
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, 'reporte-gastos.xlsx');
        }

        let branchName = 'TODAS LAS SUCURSALES';
        if (branch_id && branch_id !== 'all' && rows.length > 0) {
            branchName = (rows[0].branch_nombre || '').toUpperCase();
        } else if (branch_id && branch_id !== 'all') {
            const [bRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (bRows.length > 0) branchName = (bRows[0].nombre || '').toUpperCase();
        }

        const periodText = `DEL ${reportPdfHelper.formatDate(start_date)} AL ${reportPdfHelper.formatDate(end_date)}`;
        const subtitle = `SUCURSAL: ${branchName}`;

        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');
        const startX = 30;
        const contentWidth = 732; // 792 - 60

        reportPdfHelper.renderHeader(doc, company, 'Reporte de Gastos Operativos (Detallado)', periodText, 'landscape', subtitle);

        const colW = {
            fecha: 46,
            tipoDoc: 66,
            numero: 105,
            condicion: 48,
            gravada: 52,
            exenta: 50,
            iva: 45,
            ret: 42,
            per: 42,
            fov: 44,
            cot: 44,
            total: 66
        };

        const drawTableHeader = (yPos) => {
            doc.rect(startX, yPos, contentWidth, 13).fill('#f1f5f9');
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            let x = startX + 4;
            doc.text('FECHA', x, yPos + 3); x += colW.fecha;
            doc.text('TIPO DOC', x, yPos + 3); x += colW.tipoDoc;
            doc.text('NÚMERO', x, yPos + 3); x += colW.numero;
            doc.text('CONDICIÓN', x, yPos + 3); x += colW.condicion;
            doc.text('GRAVADA', x, yPos + 3, { width: colW.gravada, align: 'right' }); x += colW.gravada;
            doc.text('EXENTA', x, yPos + 3, { width: colW.exenta, align: 'right' }); x += colW.exenta;
            doc.text('IVA', x, yPos + 3, { width: colW.iva, align: 'right' }); x += colW.iva;
            doc.text('RET.', x, yPos + 3, { width: colW.ret, align: 'right' }); x += colW.ret;
            doc.text('PER.', x, yPos + 3, { width: colW.per, align: 'right' }); x += colW.per;
            doc.text('FOV.', x, yPos + 3, { width: colW.fov, align: 'right' }); x += colW.fov;
            doc.text('COT.', x, yPos + 3, { width: colW.cot, align: 'right' }); x += colW.cot;
            doc.text('TOTAL', x, yPos + 3, { width: colW.total - 6, align: 'right' });
            return yPos + 16;
        };

        let currentY = drawTableHeader(doc.y + 4);

        if (rows.length === 0) {
            doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
            doc.text('No se encontraron gastos en el período seleccionado.', startX, currentY + 10);
            currentY += 30;
        } else {
            let currentProvider = null;
            let pTotals = { grav: 0, exe: 0, iva: 0, ret: 0, per: 0, fov: 0, cot: 0, total: 0 };
            let gTotals = { grav: 0, exe: 0, iva: 0, ret: 0, per: 0, fov: 0, cot: 0, total: 0 };

            const printSubtotal = () => {
                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX + colW.fecha + colW.tipoDoc + colW.numero, currentY).lineTo(startX + contentWidth, currentY).stroke();
                currentY += 2;
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text('SUBTOTAL:', startX + colW.fecha + colW.tipoDoc, currentY, { width: colW.numero, align: 'right' });
                let sx = startX + colW.fecha + colW.tipoDoc + colW.numero + colW.condicion;
                doc.text(reportPdfHelper.fmt(pTotals.grav), sx, currentY, { width: colW.gravada, align: 'right' }); sx += colW.gravada;
                doc.text(reportPdfHelper.fmt(pTotals.exe), sx, currentY, { width: colW.exenta, align: 'right' }); sx += colW.exenta;
                doc.text(reportPdfHelper.fmt(pTotals.iva), sx, currentY, { width: colW.iva, align: 'right' }); sx += colW.iva;
                doc.text(reportPdfHelper.fmt(pTotals.ret), sx, currentY, { width: colW.ret, align: 'right' }); sx += colW.ret;
                doc.text(reportPdfHelper.fmt(pTotals.per), sx, currentY, { width: colW.per, align: 'right' }); sx += colW.per;
                doc.text(reportPdfHelper.fmt(pTotals.fov), sx, currentY, { width: colW.fov, align: 'right' }); sx += colW.fov;
                doc.text(reportPdfHelper.fmt(pTotals.cot), sx, currentY, { width: colW.cot, align: 'right' }); sx += colW.cot;
                doc.text(reportPdfHelper.fmt(pTotals.total), sx, currentY, { width: colW.total - 6, align: 'right' });
                currentY += 15;
                pTotals = { grav: 0, exe: 0, iva: 0, ret: 0, per: 0, fov: 0, cot: 0, total: 0 };
            };

            for (const row of rows) {
                if (currentY > 520) {
                    doc.addPage();
                    reportPdfHelper.renderHeader(doc, company, 'Reporte de Gastos Operativos (Detallado)', periodText, 'landscape', subtitle);
                    currentY = drawTableHeader(doc.y + 4);
                }

                if (row.provider_nombre !== currentProvider) {
                    if (currentProvider !== null) {
                        printSubtotal();
                    }
                    if (currentY > 520) {
                        doc.addPage();
                        reportPdfHelper.renderHeader(doc, company, 'Reporte de Gastos Operativos (Detallado)', periodText, 'landscape', subtitle);
                        currentY = drawTableHeader(doc.y + 4);
                    }
                    doc.rect(startX, currentY, contentWidth, 14).fill('#e2e8f0');
                    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(`PROVEEDOR: ${row.provider_nombre || 'S/N'}`, startX + 4, currentY + 3);
                    currentY += 16;
                    currentProvider = row.provider_nombre;
                }

                doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
                let lx = startX + 4;
                doc.text(reportPdfHelper.formatDate(row.fecha), lx, currentY, { width: colW.fecha }); lx += colW.fecha;
                doc.text((row.tipo_doc_nombre || '---').substring(0, 16), lx, currentY, { width: colW.tipoDoc }); lx += colW.tipoDoc;
                doc.text(String(row.numero_documento || '---'), lx, currentY, { width: colW.numero }); lx += colW.numero;
                doc.text((row.condicion_nombre || 'CONTADO').substring(0, 10), lx, currentY, { width: colW.condicion }); lx += colW.condicion;

                const grav = parseFloat(row.total_gravada || 0);
                const exe = parseFloat(row.total_exenta || 0);
                const iva = parseFloat(row.iva || 0);
                const ret = parseFloat(row.retencion || 0);
                const per = parseFloat(row.percepcion || 0);
                const fov = parseFloat(row.fovial || 0);
                const cot = parseFloat(row.cotrans || 0);
                const tot = parseFloat(row.monto_total || 0);

                doc.text(reportPdfHelper.fmt(grav), lx, currentY, { width: colW.gravada, align: 'right' }); lx += colW.gravada;
                doc.text(reportPdfHelper.fmt(exe), lx, currentY, { width: colW.exenta, align: 'right' }); lx += colW.exenta;
                doc.text(reportPdfHelper.fmt(iva), lx, currentY, { width: colW.iva, align: 'right' }); lx += colW.iva;
                doc.text(reportPdfHelper.fmt(ret), lx, currentY, { width: colW.ret, align: 'right' }); lx += colW.ret;
                doc.text(reportPdfHelper.fmt(per), lx, currentY, { width: colW.per, align: 'right' }); lx += colW.per;
                doc.text(reportPdfHelper.fmt(fov), lx, currentY, { width: colW.fov, align: 'right' }); lx += colW.fov;
                doc.text(reportPdfHelper.fmt(cot), lx, currentY, { width: colW.cot, align: 'right' }); lx += colW.cot;
                doc.text(reportPdfHelper.fmt(tot), lx, currentY, { width: colW.total - 6, align: 'right' });

                pTotals.grav += grav;
                pTotals.exe += exe;
                pTotals.iva += iva;
                pTotals.ret += ret;
                pTotals.per += per;
                pTotals.fov += fov;
                pTotals.cot += cot;
                pTotals.total += tot;

                gTotals.grav += grav;
                gTotals.exe += exe;
                gTotals.iva += iva;
                gTotals.ret += ret;
                gTotals.per += per;
                gTotals.fov += fov;
                gTotals.cot += cot;
                gTotals.total += tot;

                currentY += 12;
            }

            if (currentProvider !== null) {
                printSubtotal();
            }

            if (currentY > 520) {
                doc.addPage();
                reportPdfHelper.renderHeader(doc, company, 'Reporte de Gastos Operativos (Detallado)', periodText, 'landscape', subtitle);
                currentY = doc.y + 10;
            }

            doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
            currentY += 4;
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('TOTAL GENERAL:', startX + colW.fecha + colW.tipoDoc, currentY, { width: colW.numero, align: 'right' });
            let gx = startX + colW.fecha + colW.tipoDoc + colW.numero + colW.condicion;
            doc.text(reportPdfHelper.fmt(gTotals.grav), gx, currentY, { width: colW.gravada, align: 'right' }); gx += colW.gravada;
            doc.text(reportPdfHelper.fmt(gTotals.exe), gx, currentY, { width: colW.exenta, align: 'right' }); gx += colW.exenta;
            doc.text(reportPdfHelper.fmt(gTotals.iva), gx, currentY, { width: colW.iva, align: 'right' }); gx += colW.iva;
            doc.text(reportPdfHelper.fmt(gTotals.ret), gx, currentY, { width: colW.ret, align: 'right' }); gx += colW.ret;
            doc.text(reportPdfHelper.fmt(gTotals.per), gx, currentY, { width: colW.per, align: 'right' }); gx += colW.per;
            doc.text(reportPdfHelper.fmt(gTotals.fov), gx, currentY, { width: colW.fov, align: 'right' }); gx += colW.fov;
            doc.text(reportPdfHelper.fmt(gTotals.cot), gx, currentY, { width: colW.cot, align: 'right' }); gx += colW.cot;
            doc.text(reportPdfHelper.fmt(gTotals.total), gx, currentY, { width: colW.total - 6, align: 'right' });
            currentY += 18;
        }

        reportPdfHelper.renderClosingFooter(doc, startX, currentY, rows.length, 'Gastos');
        reportPdfHelper.renderPageNumbers(doc);
        doc.end();

        const buffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.send(buffer);

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
