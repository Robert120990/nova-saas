const {
    mailerService,
    pool,
    dteService,
    pdfService,
    aiService,
    path,
    fs,
    jwt,
    getEffectiveProductId,
    getLubricantCategoryIds,
    isLubricantProduct,
    excelService,
    notificationService,
    dteValidoExistsSql,
    dteLatestColSql,
    reportPdfHelper,
    validateDocumentNumber,
    isValidDocumentNumber,
    dteTypeNames,
    getDteTypeName,
    FALLBACK_ACTIVIDAD,
    resolveActividadOficial
} = require('./salesUtils');


// --- REPORTES DE VENTAS EN PANTALLA Y PDF ---
const getSalesByCategory = async (req, res) => {
    const { start_date, end_date, branch_id, detailed } = req.query;
    const companyId = req.company_id || req.user?.company_id;

    try {
        // 1. Obtener el total general de ventas del período para calcular porcentajes
        let totalSalesSql = `
            SELECT SUM(si.cantidad * si.precio_unitario) as total_periodo
            FROM sales_headers h
            JOIN sales_items si ON h.id = si.sale_id
            WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
            AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = h.id AND status = 'INVALIDADO')
        `;
        const totalParams = [companyId];
        
        if (start_date && end_date) {
            totalSalesSql += ' AND h.fecha_emision BETWEEN ? AND ?';
            totalParams.push(start_date, end_date);
        }
        if (branch_id && branch_id !== 'all') {
            totalSalesSql += ' AND h.branch_id = ?';
            totalParams.push(branch_id);
        }
        
        const [totalResult] = await pool.query(totalSalesSql, totalParams);
        const grandTotalSales = parseFloat(totalResult[0]?.total_periodo || 0);

        // 2. Consulta de categorías
        let sql = `
            SELECT 
                COALESCE(c.id, 0) as category_id,
                COALESCE(c.name, 'Sin Categoría') as categoria,
                SUM(si.cantidad) as total_unidades,
                SUM(si.cantidad * si.precio_unitario) as total_venta,
                SUM(si.cantidad * si.precio_unitario) - SUM(si.cantidad * COALESCE(p.costo, 0)) as rendimiento, -- Usando costo real de la tabla products
                (SUM(si.cantidad * si.precio_unitario) / NULLIF(?, 0)) * 100 as porcentaje_ventas
            FROM sales_headers h
            JOIN sales_items si ON h.id = si.sale_id
            LEFT JOIN products p ON si.product_id = p.id
            LEFT JOIN product_categories c ON p.category_id = c.id
            WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
            AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = h.id AND status = 'INVALIDADO')
        `;
        const params = [grandTotalSales, companyId];

        if (start_date && end_date) {
            sql += ' AND h.fecha_emision BETWEEN ? AND ?';
            params.push(start_date, end_date);
        }
        if (branch_id && branch_id !== 'all') {
            sql += ' AND h.branch_id = ?';
            params.push(branch_id);
        }

        sql += ' GROUP BY COALESCE(c.id, 0), COALESCE(c.name, "Sin Categoría") ORDER BY total_venta DESC';

        const [categories] = await pool.query(sql, params);

        // 3. Si es detallado, obtener items por cada categoría
        if (detailed === 'true') {
            let detailSql = `
                SELECT 
                    COALESCE(c.id, 0) as category_id,
                    p.descripcion as producto,
                    SUM(si.cantidad) as unidades,
                    SUM(si.cantidad * si.precio_unitario) as monto,
                    SUM(si.cantidad * si.precio_unitario) - SUM(si.cantidad * COALESCE(p.costo, 0)) as rendimiento
                FROM sales_headers h
                JOIN sales_items si ON h.id = si.sale_id
                LEFT JOIN products p ON si.product_id = p.id
                LEFT JOIN product_categories c ON p.category_id = c.id
                WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
            `;
            const detailParams = [companyId];
            
            if (start_date && end_date) {
                detailSql += ' AND h.fecha_emision BETWEEN ? AND ?';
                detailParams.push(start_date, end_date);
            }
            if (branch_id && branch_id !== 'all') {
                detailSql += ' AND h.branch_id = ?';
                detailParams.push(branch_id);
            }

            detailSql += ' GROUP BY COALESCE(c.id, 0), p.id, p.descripcion ORDER BY category_id, monto DESC';
            const [products] = await pool.query(detailSql, detailParams);

            // Mapear productos a sus categorías
            const mappedCategories = categories.map(cat => ({
                ...cat,
                productos: products.filter(p => p.category_id === cat.category_id)
            }));
            return res.json(mappedCategories);
        }

        res.json(categories);
    } catch (error) {
        console.error('Error in getSalesByCategory:', error);
        res.status(500).json({ message: 'Error al generar reporte por categoría', error: error.message });
    }
};

/**
 * Exporta el reporte de ventas por categoría a PDF (Resumen o Detallado).
 */
const exportSalesByCategoryPDF = async (req, res) => {
    const { start_date, end_date, branch_id, detailed } = req.query;
    const companyId = req.company_id || req.user?.company_id;

    try {
        if (!companyId) return res.status(401).json({ message: 'No sesion' });

        // Re-utilizamos la lógica de obtención de datos para asegurar consistencia
        // (En una app real, esto podría estar en un service para evitar redundancia)
        
        // 1. Info de Empresa
        const companyInfo = await reportPdfHelper.getCompanyInfo(companyId);

        let branchName = 'Todas las sucursales';
        if (branch_id && branch_id !== 'all') {
            const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (branchRows.length > 0) branchName = branchRows[0].nombre;
        }

        // 2. Obtener datos (Total periodo)
        let totalSalesSql = `SELECT SUM(si.cantidad * si.precio_unitario) as total_periodo FROM sales_headers h JOIN sales_items si ON h.id = si.sale_id WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido' AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = h.id AND status = 'INVALIDADO')`;
        const totalParams = [companyId];
        if (start_date && end_date) { totalSalesSql += ' AND h.fecha_emision BETWEEN ? AND ?'; totalParams.push(start_date, end_date); }
        if (branch_id && branch_id !== 'all') { totalSalesSql += ' AND h.branch_id = ?'; totalParams.push(branch_id); }
        const [totalResult] = await pool.query(totalSalesSql, totalParams);
        const grandTotal = parseFloat(totalResult[0]?.total_periodo || 0);

        // 3. Query Categorías
        let sql = `
            SELECT 
                COALESCE(c.id, 0) as category_id,
                COALESCE(c.name, 'Sin Categoría') as categoria,
                SUM(si.cantidad) as total_unidades,
                SUM(si.cantidad * si.precio_unitario) as total_venta,
                SUM(si.cantidad * si.precio_unitario) - SUM(si.cantidad * COALESCE(p.costo, 0)) as rendimiento,
                (SUM(si.cantidad * si.precio_unitario) / NULLIF(?, 0)) * 100 as porcentaje_ventas
            FROM sales_headers h
            JOIN sales_items si ON h.id = si.sale_id
            LEFT JOIN products p ON si.product_id = p.id
            LEFT JOIN product_categories c ON p.category_id = c.id
            WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
            AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = h.id AND status = 'INVALIDADO')
        `;
        const params = [grandTotal, companyId];
        if (start_date && end_date) { sql += ' AND h.fecha_emision BETWEEN ? AND ?'; params.push(start_date, end_date); }
        if (branch_id && branch_id !== 'all') { sql += ' AND h.branch_id = ?'; params.push(branch_id); }
        sql += ' GROUP BY COALESCE(c.id, 0), COALESCE(c.name, "Sin Categoría") ORDER BY total_venta DESC';

        const [categories] = await pool.query(sql, params);

        let reportData = {
            company_id: companyId,
            company: companyInfo,
            company_name: companyInfo.razon_social,
            company_nit: companyInfo.nit,
            company_nrc: companyInfo.nrc,
            branch: branchName,
            period: `${start_date} al ${end_date}`,
            grand_total: grandTotal,
            isDetailed: detailed === 'true',
            categories: categories
        };

        if (detailed === 'true') {
            let detailSql = `
                SELECT 
                    COALESCE(c.id, 0) as category_id,
                    p.descripcion as producto,
                    SUM(si.cantidad) as unidades,
                    SUM(si.cantidad * si.precio_unitario) as monto,
                    SUM(si.cantidad * si.precio_unitario) - SUM(si.cantidad * COALESCE(p.costo, 0)) as rendimiento
                FROM sales_headers h
                JOIN sales_items si ON h.id = si.sale_id
                LEFT JOIN products p ON si.product_id = p.id
                LEFT JOIN product_categories c ON p.category_id = c.id
                WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
                AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = h.id AND status = 'INVALIDADO')
            `;
            const dParams = [companyId];
            if (start_date && end_date) { detailSql += ' AND h.fecha_emision BETWEEN ? AND ?'; dParams.push(start_date, end_date); }
            if (branch_id && branch_id !== 'all') { detailSql += ' AND h.branch_id = ?'; dParams.push(branch_id); }
            detailSql += ' GROUP BY COALESCE(c.id, 0), p.id, p.descripcion ORDER BY category_id, monto DESC';
            const [products] = await pool.query(detailSql, dParams);
            
            reportData.categories = categories.map(cat => ({
                ...cat,
                productos: products.filter(p => p.category_id === cat.category_id)
            }));
        }

        if (req.query.format === 'excel') {
            const sheetData = [];
            reportData.categories.forEach(cat => {
                if (reportData.isDetailed && cat.productos) {
                    cat.productos.forEach(prod => {
                        sheetData.push({
                            categoria: cat.categoria,
                            producto: prod.producto,
                            unidades: parseFloat(prod.unidades || 0).toFixed(2),
                            monto: parseFloat(prod.monto || 0).toFixed(2),
                            rendimiento: parseFloat(prod.rendimiento || 0).toFixed(2),
                            porcentaje: '',
                        });
                    });
                } else {
                    sheetData.push({
                        categoria: cat.categoria,
                        producto: '',
                        unidades: parseFloat(cat.total_unidades || 0).toFixed(2),
                        monto: parseFloat(cat.total_venta || 0).toFixed(2),
                        rendimiento: parseFloat(cat.rendimiento || 0).toFixed(2),
                        porcentaje: parseFloat(cat.porcentaje_ventas || 0).toFixed(2) + '%',
                    });
                }
            });

            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Categorías',
                    columns: [
                        { header: 'Categoría', key: 'categoria', width: 25 },
                        { header: 'Producto', key: 'producto', width: 30 },
                        { header: 'Unidades', key: 'unidades', width: 14 },
                        { header: 'Monto', key: 'monto', width: 16 },
                        { header: 'Rendimiento', key: 'rendimiento', width: 16 },
                        { header: '% Ventas', key: 'porcentaje', width: 12 },
                    ],
                    data: sheetData
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Ventas_Categoria_${start_date}.xlsx`);
        }

        const pdfBuffer = await pdfService.generateSalesByCategoryPDF(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Ventas_Categoria_${start_date}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error in exportSalesByCategoryPDF:', error);
        res.status(500).json({ message: 'Error al exportar reporte' });
    }
};

/**
 * Obtiene el reporte de ventas diarias detallado.
 */
const getDailySales = async (req, res) => {
    const { start_date, end_date, branch_id } = req.query;
    const companyId = req.company_id || req.user?.company_id;

    try {
        let sql = `
            SELECT 
                h.fecha_emision as fecha,
                CASE h.tipo_documento 
                    WHEN '01' THEN 'Factura'
                    WHEN '03' THEN 'Crédito Fiscal'
                    WHEN '04' THEN 'Nota de Remisión'
                    WHEN '05' THEN 'Nota de Crédito'
                    WHEN '06' THEN 'Nota de Débito'
                    WHEN '11' THEN 'Factura de Exportación'
                    ELSE h.tipo_documento 
                END as tipo,
                COALESCE(d.numero_control, h.numero_control, CONCAT('VTA-', h.id)) as documento,
                CASE h.condicion_operacion 
                    WHEN 1 THEN 'Contado'
                    WHEN 2 THEN 'Crédito'
                    ELSE 'Contado'
                END as condicion,
                COALESCE(c.nombre, h.cliente_nombre, 'Consumidor Final') as cliente,
                h.total_gravado as gravadas,
                h.total_exento as exentas,
                h.total_iva as iva,
                h.fovial,
                h.cotrans,
                h.iva_retenido as retencion,
                h.iva_percibido as percepcion,
                h.total_pagar as total
            FROM sales_headers h
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN dtes d ON h.id = d.venta_id
            WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
            AND (d.status IS NULL OR d.status != 'INVALIDADO')
        `;
        const params = [companyId];

        if (start_date && end_date) {
            sql += ' AND h.fecha_emision BETWEEN ? AND ?';
            params.push(start_date, end_date);
        }

        if (branch_id && branch_id !== 'all') {
            sql += ' AND h.branch_id = ?';
            params.push(branch_id);
        } else if (req.user.branch_id && !branch_id) {
            sql += ' AND h.branch_id = ?';
            params.push(req.user.branch_id);
        }

        sql += ' ORDER BY h.fecha_emision ASC, h.created_at ASC';

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('Error in getDailySales:', error);
        res.status(500).json({ message: 'Error al generar reporte de ventas diarias', error: error.message });
    }
};

/**
 * Exporta el reporte de ventas diarias en formato PDF.
 */
const exportDailySalesPDF = async (req, res) => {
    try {
        const { start_date, end_date, branch_id } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!companyId) {
            return res.status(401).json({ message: 'No se pudo identificar la empresa' });
        }

        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Rango de fechas es requerido' });
        }

        // 1. Info de Empresa y Sucursal
        const company = await reportPdfHelper.getCompanyInfo(companyId);
        const companyName = company.razon_social || company.nombre_comercial || 'Empresa';

        let branchName = 'Todas las sucursales';
        if (branch_id && branch_id !== 'all') {
            const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (branchRows.length > 0) branchName = branchRows[0].nombre;
        }

        // 2. Consulta de Datos
        let sql = `
            SELECT 
                h.fecha_emision as fecha,
                CASE h.tipo_documento 
                    WHEN '01' THEN 'Factura'
                    WHEN '03' THEN 'Crédito Fiscal'
                    WHEN '04' THEN 'Nota de Remisión'
                    WHEN '05' THEN 'Nota de Crédito'
                    WHEN '06' THEN 'Nota de Débito'
                    WHEN '11' THEN 'Factura de Exportación'
                    ELSE h.tipo_documento 
                END as tipo,
                COALESCE(d.numero_control, h.numero_control, CONCAT('VTA-', h.id)) as documento,
                CASE h.condicion_operacion 
                    WHEN 1 THEN 'Contado'
                    WHEN 2 THEN 'Crédito'
                    ELSE 'Contado'
                END as condicion,
                COALESCE(c.nombre, h.cliente_nombre, 'Consumidor Final') as cliente,
                h.total_gravado as gravadas,
                h.total_exento as exentas,
                h.total_iva as iva,
                h.fovial,
                h.cotrans,
                h.iva_retenido as retencion,
                h.iva_percibido as percepcion,
                h.total_pagar as total
            FROM sales_headers h
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN dtes d ON h.id = d.venta_id
            WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
            AND (d.status IS NULL OR d.status != 'INVALIDADO')
        `;
        const params = [companyId];

        // Filtramos por fecha_emision que es la fecha contable
        sql += ' AND h.fecha_emision BETWEEN ? AND ?';
        params.push(start_date, end_date);

        if (branch_id && branch_id !== 'all') {
            sql += ' AND h.branch_id = ?';
            params.push(branch_id);
        }

        sql += ' ORDER BY h.fecha_emision ASC, h.id ASC';

        const [rows] = await pool.query(sql, params);

        // 3. Totales
        const totals = rows.reduce((acc, curr) => {
            acc.gravadas += parseFloat(curr.gravadas || 0);
            acc.exentas += parseFloat(curr.exentas || 0);
            acc.iva += parseFloat(curr.iva || 0);
            acc.fovial += parseFloat(curr.fovial || 0);
            acc.cotrans += parseFloat(curr.cotrans || 0);
            acc.retencion += parseFloat(curr.retencion || 0);
            acc.percepcion += parseFloat(curr.percepcion || 0);
            acc.total += parseFloat(curr.total || 0);
            return acc;
        }, { gravadas: 0, exentas: 0, iva: 0, fovial: 0, cotrans: 0, retencion: 0, percepcion: 0, total: 0 });

        // 4. Generar PDF
        const reportData = {
            company_id: companyId,
            company: company,
            company_name: companyName,
            company_nit: company.nit,
            company_nrc: company.nrc,
            branch_name: branchName,
            startDate: start_date,
            endDate: end_date,
            sales: rows,
            total_gravadas: totals.gravadas,
            total_exentas: totals.exentas,
            total_iva: totals.iva,
            total_fovial: totals.fovial,
            total_cotrans: totals.cotrans,
            total_retencion: totals.retencion,
            total_percepcion: totals.percepcion,
            total_general: totals.total
        };

        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Ventas Diarias',
                    columns: [
                        { header: 'Fecha', key: 'fecha', width: 14 },
                        { header: 'Cliente', key: 'cliente', width: 35 },
                        { header: 'Tipo Doc', key: 'tipo', width: 16 },
                        { header: 'Documento', key: 'documento', width: 34 },
                        { header: 'Condición', key: 'condicion', width: 14 },
                        { header: 'Gravadas', key: 'gravadas', width: 14 },
                        { header: 'Exentas', key: 'exentas', width: 14 },
                        { header: 'IVA', key: 'iva', width: 14 },
                        { header: 'FOVIAL', key: 'fovial', width: 14 },
                        { header: 'COTRANS', key: 'cotrans', width: 14 },
                        { header: 'Retención', key: 'retencion', width: 14 },
                        { header: 'Percepción', key: 'percepcion', width: 14 },
                        { header: 'Total', key: 'total', width: 16 },
                    ],
                    data: rows.map(r => ({
                        fecha: new Date(r.fecha).toLocaleDateString('es-SV'),
                        cliente: r.cliente,
                        tipo: r.tipo,
                        documento: r.documento,
                        condicion: r.condicion,
                        gravadas: parseFloat(r.gravadas || 0).toFixed(2),
                        exentas: parseFloat(r.exentas || 0).toFixed(2),
                        iva: parseFloat(r.iva || 0).toFixed(2),
                        fovial: parseFloat(r.fovial || 0).toFixed(2),
                        cotrans: parseFloat(r.cotrans || 0).toFixed(2),
                        retencion: parseFloat(r.retencion || 0).toFixed(2),
                        percepcion: parseFloat(r.percepcion || 0).toFixed(2),
                        total: parseFloat(r.total || 0).toFixed(2),
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Ventas_Diarias_${start_date}_al_${end_date}.xlsx`);
        }

        const pdfBuffer = await pdfService.generateDailySalesReportPDF(reportData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename=reporte-ventas-diarias.pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[ExportDailySalesPDF] Error:', error);
        res.status(500).json({ message: 'Error al generar PDF de ventas diarias', error: error.message });
    }
};

/**
 * Exporta el reporte de ventas por cliente en formato PDF/Excel.
 * Formato similar a ventas diarias, filtrado por cliente, detallando
 * los productos de cada venta y mostrando el cliente en el encabezado.
 */
const exportSalesByCustomerPDF = async (req, res) => {
    try {
        const { customer_id, start_date, end_date, branch_id } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!companyId) {
            return res.status(401).json({ message: 'No se pudo identificar la empresa' });
        }

        if (!customer_id) {
            return res.status(400).json({ message: 'El cliente es requerido' });
        }

        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Rango de fechas es requerido' });
        }

        // 1. Datos del cliente (encabezado del reporte)
        const [customerRows] = await pool.query(
            'SELECT * FROM customers WHERE id = ? AND company_id = ?',
            [customer_id, companyId]
        );
        if (customerRows.length === 0) {
            return res.status(404).json({ message: 'Cliente no encontrado' });
        }
        const customer = customerRows[0];

        // 2. Info de Empresa y Sucursal
        const company = await reportPdfHelper.getCompanyInfo(companyId);
        const companyName = company.razon_social || company.nombre_comercial || 'Empresa';

        let branchName = 'Todas las sucursales';
        if (branch_id && branch_id !== 'all') {
            const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (branchRows.length > 0) branchName = branchRows[0].nombre;
        }

        // 3. Consulta de detalle (productos por venta del cliente)
        let sql = `
            SELECT 
                h.fecha_emision as fecha,
                CASE h.tipo_documento 
                    WHEN '01' THEN 'Factura'
                    WHEN '03' THEN 'Crédito Fiscal'
                    WHEN '04' THEN 'Nota de Remisión'
                    WHEN '05' THEN 'Nota de Crédito'
                    WHEN '06' THEN 'Nota de Débito'
                    WHEN '11' THEN 'Factura de Exportación'
                    ELSE h.tipo_documento 
                END as tipo,
                COALESCE(d.numero_control, CONCAT('VTA-', h.id)) as documento,
                COALESCE(p.descripcion, si.descripcion) as producto,
                si.cantidad,
                ROUND(COALESCE(si.venta_gravada, 0) + COALESCE(si.venta_exenta, 0) + ROUND(COALESCE(si.venta_gravada, 0) * 0.13, 2), 2) as total
            FROM sales_headers h
            JOIN sales_items si ON h.id = si.sale_id
            LEFT JOIN products p ON si.product_id = p.id
            LEFT JOIN dtes d ON h.id = d.venta_id
            WHERE h.company_id = ? AND h.customer_id = ? AND LOWER(h.estado) = 'emitido'
            AND (d.status IS NULL OR d.status != 'INVALIDADO')
        `;
        const params = [companyId, customer_id];

        sql += ' AND h.fecha_emision BETWEEN ? AND ?';
        params.push(start_date, end_date);

        if (branch_id && branch_id !== 'all') {
            sql += ' AND h.branch_id = ?';
            params.push(branch_id);
        }

        sql += ' ORDER BY h.fecha_emision ASC, h.id ASC, si.id ASC';

        const [rows] = await pool.query(sql, params);

        // 4. Totales (desde las cabeceras de venta)
        let totalsSql = `
            SELECT 
                SUM(h.total_gravado) as gravadas,
                SUM(h.total_exento) as exentas,
                SUM(h.total_iva) as iva,
                SUM(h.fovial) as fovial,
                SUM(h.cotrans) as cotrans,
                SUM(h.iva_retenido) as retencion,
                SUM(h.iva_percibido) as percepcion,
                SUM(h.total_pagar) as total
            FROM sales_headers h
            LEFT JOIN dtes d ON h.id = d.venta_id
            WHERE h.company_id = ? AND h.customer_id = ? AND LOWER(h.estado) = 'emitido'
            AND (d.status IS NULL OR d.status != 'INVALIDADO')
            AND h.fecha_emision BETWEEN ? AND ?
        `;
        const totalsParams = [companyId, customer_id, start_date, end_date];
        if (branch_id && branch_id !== 'all') {
            totalsSql += ' AND h.branch_id = ?';
            totalsParams.push(branch_id);
        }
        const [totalsRows] = await pool.query(totalsSql, totalsParams);
        const totals = totalsRows[0] || {};

        // 5. Datos para el reporte
        const total_cantidad = rows.reduce((acc, r) => acc + parseFloat(r.cantidad || 0), 0);
        const reportData = {
            company_id: companyId,
            company: company,
            company_name: companyName,
            company_nit: company.nit,
            company_nrc: company.nrc,
            branch_name: branchName,
            startDate: start_date,
            endDate: end_date,
            customer: {
                nombre: customer.nombre,
                nombre_comercial: customer.nombre_comercial || null,
                nit: customer.nit || null,
                nrc: customer.nrc || null,
                telefono: customer.telefono || null,
                correo: customer.correo || null,
                direccion: customer.direccion || null,
                departamento: customer.departamento || null,
                municipio: customer.municipio || null
            },
            sales: rows,
            total_cantidad,
            total_gravadas: parseFloat(totals.gravadas || 0),
            total_exentas: parseFloat(totals.exentas || 0),
            total_iva: parseFloat(totals.iva || 0),
            total_fovial: parseFloat(totals.fovial || 0),
            total_cotrans: parseFloat(totals.cotrans || 0),
            total_retencion: parseFloat(totals.retencion || 0),
            total_percepcion: parseFloat(totals.percepcion || 0),
            total_general: parseFloat(totals.total || 0)
        };

        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Ventas por Cliente',
                    columns: [
                        { header: 'Fecha', key: 'fecha', width: 14 },
                        { header: 'Tipo Doc', key: 'tipo', width: 16 },
                        { header: 'Documento', key: 'documento', width: 20 },
                        { header: 'Producto', key: 'producto', width: 35 },
                        { header: 'Cantidad', key: 'cantidad', width: 12 },
                        { header: 'Total', key: 'total', width: 16 },
                    ],
                    data: rows.map(r => ({
                        fecha: new Date(r.fecha).toLocaleDateString('es-SV'),
                        tipo: r.tipo,
                        documento: r.documento,
                        producto: r.producto,
                        cantidad: parseFloat(r.cantidad || 0).toFixed(2),
                        total: parseFloat(r.total || 0).toFixed(2),
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Ventas_por_Cliente_${start_date}_al_${end_date}.xlsx`);
        }

        const pdfBuffer = await pdfService.generateSalesByCustomerPDF(reportData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename=reporte-ventas-por-cliente.pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[ExportSalesByCustomerPDF] Error:', error);
        res.status(500).json({ message: 'Error al generar PDF de ventas por cliente', error: error.message });
    }
};

/**
 * Generar Reporte de Ventas en PDF (Landscape)
 */
const getSalesReportPDF = async (req, res) => {
    try {
        const { start_date, end_date, branch_id, customer_id } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Rango de fechas requerido' });
        }

        // 1. Obtener datos de la empresa
        const company = await reportPdfHelper.getCompanyInfo(companyId);

        // 2. Construir Query de Ventas
        let sql = `
            SELECT h.*, 
                   COALESCE(c.nombre, h.cliente_nombre, 'Consumidor Final') AS customer_name, 
                   br.nombre AS branch_nombre,
                   CASE h.tipo_documento 
                        WHEN '01' THEN 'Factura'
                        WHEN '03' THEN 'Crédito Fiscal'
                        WHEN '04' THEN 'Nota de Remisión'
                        WHEN '05' THEN 'Nota de Crédito'
                        WHEN '06' THEN 'Nota de Débito'
                        WHEN '11' THEN 'Factura de Exportación'
                        ELSE h.tipo_documento 
                   END AS tipo_doc_nombre,
                   CASE h.condicion_operacion 
                        WHEN 1 THEN 'Contado'
                        WHEN 2 THEN 'Crédito'
                        ELSE 'Contado'
                   END AS condicion_nombre
            FROM sales_headers h
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN branches br ON h.branch_id = br.id
            WHERE h.company_id = ? AND h.fecha_emision BETWEEN ? AND ? AND h.estado != 'ANULADO' AND h.estado != 'anulado'
            AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = h.id AND status = 'INVALIDADO')
        `;
        const params = [companyId, start_date, end_date];

        if (branch_id && branch_id !== 'all') {
            sql += " AND h.branch_id = ?";
            params.push(branch_id);
        }

        if (customer_id && customer_id !== 'all') {
            sql += " AND h.customer_id = ?";
            params.push(customer_id);
        }

        sql += " ORDER BY customer_name ASC, h.fecha_emision ASC, h.id ASC";

        const [rows] = await pool.query(sql, params);

        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Ventas',
                    columns: [
                        { header: 'Cliente', key: 'customer_name', width: 30 },
                        { header: 'Sucursal', key: 'branch_nombre', width: 20 },
                        { header: 'Fecha', key: 'fecha_emision', width: 14 },
                        { header: 'Tipo Doc', key: 'tipo_doc_nombre', width: 16 },
                        { header: 'No. Documento', key: 'numero_control', width: 20 },
                        { header: 'Condición', key: 'condicion_nombre', width: 12 },
                        { header: 'Gravada', key: 'gravada', width: 14 },
                        { header: 'Exenta', key: 'exenta', width: 14 },
                        { header: 'IVA', key: 'iva', width: 14 },
                        { header: 'Retención', key: 'retencion', width: 14 },
                        { header: 'Percepción', key: 'percepcion', width: 14 },
                        { header: 'FOVIAL', key: 'fovial', width: 14 },
                        { header: 'COTRANS', key: 'cotrans', width: 14 },
                        { header: 'Total', key: 'total', width: 16 },
                    ],
                    data: rows.map(r => ({
                        customer_name: r.customer_name,
                        branch_nombre: r.branch_nombre,
                        fecha_emision: new Date(r.fecha_emision).toLocaleDateString('es-SV'),
                        tipo_doc_nombre: r.tipo_doc_nombre,
                        numero_control: r.numero_control,
                        condicion_nombre: r.condicion_nombre,
                        gravada: parseFloat(r.total_gravada || 0).toFixed(2),
                        exenta: parseFloat(r.total_exenta || 0).toFixed(2),
                        iva: parseFloat(r.total_iva || 0).toFixed(2),
                        retencion: parseFloat(r.total_retencion || 0).toFixed(2),
                        percepcion: parseFloat(r.total_percepcion || 0).toFixed(2),
                        fovial: parseFloat(r.total_fovial || 0).toFixed(2),
                        cotrans: parseFloat(r.total_cotrans || 0).toFixed(2),
                        total: parseFloat(r.total_pagar || 0).toFixed(2),
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Reporte_Ventas_${req.query.start_date}_al_${req.query.end_date}.xlsx`);
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

        reportPdfHelper.renderHeader(doc, company, 'Reporte de Ventas (Detallado)', periodText, 'landscape', subtitle);

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
            doc.text('No se encontraron ventas en el período seleccionado.', startX, currentY + 10);
            currentY += 30;
        } else {
            let currentCustomer = null;
            let cTotals = { grav: 0, exe: 0, iva: 0, ret: 0, per: 0, fov: 0, cot: 0, total: 0 };
            let gTotals = { grav: 0, exe: 0, iva: 0, ret: 0, per: 0, fov: 0, cot: 0, total: 0 };

            const printSubtotal = () => {
                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX + colW.fecha + colW.tipoDoc + colW.numero, currentY).lineTo(startX + contentWidth, currentY).stroke();
                currentY += 2;
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text('SUBTOTAL:', startX + colW.fecha + colW.tipoDoc, currentY, { width: colW.numero, align: 'right' });
                let sx = startX + colW.fecha + colW.tipoDoc + colW.numero + colW.condicion;
                doc.text(reportPdfHelper.fmt(cTotals.grav), sx, currentY, { width: colW.gravada, align: 'right' }); sx += colW.gravada;
                doc.text(reportPdfHelper.fmt(cTotals.exe), sx, currentY, { width: colW.exenta, align: 'right' }); sx += colW.exenta;
                doc.text(reportPdfHelper.fmt(cTotals.iva), sx, currentY, { width: colW.iva, align: 'right' }); sx += colW.iva;
                doc.text(reportPdfHelper.fmt(cTotals.ret), sx, currentY, { width: colW.ret, align: 'right' }); sx += colW.ret;
                doc.text(reportPdfHelper.fmt(cTotals.per), sx, currentY, { width: colW.per, align: 'right' }); sx += colW.per;
                doc.text(reportPdfHelper.fmt(cTotals.fov), sx, currentY, { width: colW.fov, align: 'right' }); sx += colW.fov;
                doc.text(reportPdfHelper.fmt(cTotals.cot), sx, currentY, { width: colW.cot, align: 'right' }); sx += colW.cot;
                doc.text(reportPdfHelper.fmt(cTotals.total), sx, currentY, { width: colW.total - 6, align: 'right' });
                currentY += 15;
                cTotals = { grav: 0, exe: 0, iva: 0, ret: 0, per: 0, fov: 0, cot: 0, total: 0 };
            };

            for (const row of rows) {
                if (currentY > 520) {
                    doc.addPage();
                    reportPdfHelper.renderHeader(doc, company, 'Reporte de Ventas (Detallado)', periodText, 'landscape', subtitle);
                    currentY = drawTableHeader(doc.y + 4);
                }

                if (row.customer_name !== currentCustomer) {
                    if (currentCustomer !== null) {
                        printSubtotal();
                    }
                    if (currentY > 520) {
                        doc.addPage();
                        reportPdfHelper.renderHeader(doc, company, 'Reporte de Ventas (Detallado)', periodText, 'landscape', subtitle);
                        currentY = drawTableHeader(doc.y + 4);
                    }
                    doc.rect(startX, currentY, contentWidth, 14).fill('#e2e8f0');
                    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(`CLIENTE: ${row.customer_name}`, startX + 4, currentY + 3);
                    currentY += 16;
                    currentCustomer = row.customer_name;
                }

                doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
                let lx = startX + 4;
                doc.text(reportPdfHelper.formatDate(row.fecha_emision), lx, currentY, { width: colW.fecha }); lx += colW.fecha;
                doc.text((row.tipo_doc_nombre || '---').substring(0, 16), lx, currentY, { width: colW.tipoDoc }); lx += colW.tipoDoc;
                doc.text(String(row.numero_control || `VTA-${row.id}`), lx, currentY, { width: colW.numero }); lx += colW.numero;
                doc.text((row.condicion_nombre || 'CONTADO').substring(0, 10), lx, currentY, { width: colW.condicion }); lx += colW.condicion;

                const grav = parseFloat(row.total_gravado || 0);
                const exe = parseFloat(row.total_exento || 0);
                const iva = parseFloat(row.total_iva || 0);
                const ret = parseFloat(row.iva_retenido || 0);
                const per = parseFloat(row.iva_percibido || 0);
                const fov = parseFloat(row.fovial || 0);
                const cot = parseFloat(row.cotrans || 0);
                const tot = parseFloat(row.total_pagar || 0);

                doc.text(reportPdfHelper.fmt(grav), lx, currentY, { width: colW.gravada, align: 'right' }); lx += colW.gravada;
                doc.text(reportPdfHelper.fmt(exe), lx, currentY, { width: colW.exenta, align: 'right' }); lx += colW.exenta;
                doc.text(reportPdfHelper.fmt(iva), lx, currentY, { width: colW.iva, align: 'right' }); lx += colW.iva;
                doc.text(reportPdfHelper.fmt(ret), lx, currentY, { width: colW.ret, align: 'right' }); lx += colW.ret;
                doc.text(reportPdfHelper.fmt(per), lx, currentY, { width: colW.per, align: 'right' }); lx += colW.per;
                doc.text(reportPdfHelper.fmt(fov), lx, currentY, { width: colW.fov, align: 'right' }); lx += colW.fov;
                doc.text(reportPdfHelper.fmt(cot), lx, currentY, { width: colW.cot, align: 'right' }); lx += colW.cot;
                doc.text(reportPdfHelper.fmt(tot), lx, currentY, { width: colW.total - 6, align: 'right' });

                cTotals.grav += grav;
                cTotals.exe += exe;
                cTotals.iva += iva;
                cTotals.ret += ret;
                cTotals.per += per;
                cTotals.fov += fov;
                cTotals.cot += cot;
                cTotals.total += tot;

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

            if (currentCustomer !== null) {
                printSubtotal();
            }

            if (currentY > 520) {
                doc.addPage();
                reportPdfHelper.renderHeader(doc, company, 'Reporte de Ventas (Detallado)', periodText, 'landscape', subtitle);
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

        reportPdfHelper.renderClosingFooter(doc, startX, currentY, rows.length, 'Ventas');
        reportPdfHelper.renderPageNumbers(doc);
        doc.end();

        const buffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.send(buffer);

    } catch (error) {
        console.error('Error al generar reporte de ventas:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error interno al generar reporte' });
        }
    }
};

/**
 * Obtiene el detalle de ventas por POS (listado detallado).
 */
const getSalesByPOS = async (req, res) => {
    const { start_date, end_date, branch_id, pos_ids } = req.query;
    const companyId = req.company_id || req.user?.company_id;

    try {
        let sql = `
            SELECT 
                h.id,
                h.fecha_emision,
                h.tipo_documento,
                h.condicion_operacion,
                COALESCE(c.nombre, h.cliente_nombre) as cliente_nombre,
                COALESCE(c.nit, '') as cliente_nit,
                COALESCE(c.nrc, '') as cliente_nrc,
                COALESCE(s.nombre, 'Vendedor Genérico') as vendedor_nombre,
                h.total_pagar,
                COALESCE(p.nombre, 'Sin POS') as pos_name,
                d.numero_control,
                d.codigo_generacion
            FROM sales_headers h
            LEFT JOIN points_of_sale p ON h.pos_id = p.id
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN sellers s ON h.seller_id = s.id
            LEFT JOIN dtes d ON h.id = d.venta_id
            WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
            AND (d.status IS NULL OR d.status != 'INVALIDADO')
        `;
        const params = [companyId];

        if (start_date && end_date) {
            sql += ' AND h.fecha_emision BETWEEN ? AND ?';
            params.push(start_date, end_date);
        }
        if (branch_id && branch_id !== 'all') {
            sql += ' AND h.branch_id = ?';
            params.push(branch_id);
        }
        if (pos_ids) {
            const ids = pos_ids.split(',').map(s => parseInt(s, 10)).filter(n => Number.isInteger(n) && n > 0);
            if (ids.length > 0) sql += ` AND h.pos_id IN (${ids.join(',')})`;
        }

        sql += ' ORDER BY p.nombre, h.fecha_emision, h.id';

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('Error in getSalesByPOS:', error);
        res.status(500).json({ message: 'Error al obtener detalle de ventas por POS' });
    }
};

/**
 * Exporta el reporte detallado de ventas por POS a PDF.
 */
const exportSalesByPOSPDF = async (req, res) => {
    try {
        const { start_date, end_date, branch_id, pos_ids } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        let branchName = 'Todas las sucursales';
        if (branch_id && branch_id !== 'all') {
            const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (branchRows.length > 0) branchName = branchRows[0].nombre;
        }

        let sql = `
            SELECT 
                h.fecha_emision,
                h.tipo_documento,
                h.condicion_operacion,
                COALESCE(c.nombre, h.cliente_nombre) as cliente_nombre,
                COALESCE(c.nit, '') as cliente_nit,
                COALESCE(c.nrc, '') as cliente_nrc,
                COALESCE(s.nombre, 'Vendedor') as vendedor_nombre,
                h.total_gravado,
                h.total_iva,
                h.total_pagar,
                COALESCE(p.nombre, 'Sin POS') as pos_name,
                d.numero_control,
                d.codigo_generacion
            FROM sales_headers h
            LEFT JOIN points_of_sale p ON h.pos_id = p.id
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN sellers s ON h.seller_id = s.id
            LEFT JOIN dtes d ON h.id = d.venta_id
            WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
            AND (d.status IS NULL OR d.status != 'INVALIDADO')
        `;
        const params = [companyId];
        if (start_date && end_date) { sql += ' AND h.fecha_emision BETWEEN ? AND ?'; params.push(start_date, end_date); }
        if (branch_id && branch_id !== 'all') { sql += ' AND h.branch_id = ?'; params.push(branch_id); }
        if (pos_ids) {
            const ids = pos_ids.split(',').map(s => parseInt(s, 10)).filter(n => Number.isInteger(n) && n > 0);
            if (ids.length > 0) sql += ` AND h.pos_id IN (${ids.join(',')})`;
        }
        sql += ' ORDER BY p.nombre, h.fecha_emision, h.id';

        const [rows] = await pool.query(sql, params);

        const reportData = {
            company_id: companyId,
            company: company,
            company_name: company.razon_social,
            company_nit: company.nit,
            company_nrc: company.nrc,
            branch_name: branchName,
            startDate: start_date,
            endDate: end_date,
            data: rows
        };

        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Ventas por POS',
                    columns: [
                        { header: 'POS', key: 'pos_name', width: 20 },
                        { header: 'Fecha', key: 'fecha_emision', width: 14 },
                        { header: 'Cliente', key: 'cliente_nombre', width: 30 },
                        { header: 'No. Documento', key: 'numero_control', width: 20 },
                        { header: 'Vendedor', key: 'vendedor_nombre', width: 20 },
                        { header: 'Gravado', key: 'total_gravado', width: 14 },
                        { header: 'IVA', key: 'total_iva', width: 14 },
                        { header: 'Total', key: 'total_pagar', width: 16 },
                    ],
                    data: rows.map(r => ({
                        pos_name: r.pos_name,
                        fecha_emision: new Date(r.fecha_emision).toLocaleDateString('es-SV'),
                        cliente_nombre: r.cliente_nombre || 'Consumidor Final',
                        numero_control: r.numero_control || '',
                        vendedor_nombre: r.vendedor_nombre,
                        total_gravado: parseFloat(r.total_gravado || 0).toFixed(2),
                        total_iva: parseFloat(r.total_iva || 0).toFixed(2),
                        total_pagar: parseFloat(r.total_pagar || 0).toFixed(2),
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Ventas_POS_${start_date}.xlsx`);
        }

        const pdfBuffer = await pdfService.generateSalesByPOSPDF(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Detalle_Ventas_POS_${start_date}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error in exportSalesByPOSPDF:', error);
        res.status(500).json({ message: 'Error al generar PDF detallado de ventas por POS' });
    }
};

const IVA_DOC_TYPES = ['01', '03', '05', '06', '08', '09'];

const parseItemTributos = (raw) => {
    let arr = [];
    try {
        arr = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
    } catch (e) {
        arr = [];
    }
    let fovial = 0;
    let cotrans = 0;
    (arr || []).forEach(t => {
        if (!t || typeof t !== 'object') return;
        if (t.codigo === 'D1') fovial += parseFloat(t.valor) || 0;
        if (t.codigo === 'C8') cotrans += parseFloat(t.valor) || 0;
    });
    return { fovial, cotrans };
};

const fmtDate = (d) => {
    if (!d) return '---';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '---';
    return date.toLocaleDateString('es-SV');
};

const fmtMoney = (v) => {
    const n = parseFloat(v) || 0;
    return `$${n.toFixed(2)}`;
};

/**
 * Reporte "Detalle de Facturación" - líneas de detalle por documento DTE.
 * Params: start_date, end_date, branch_id, pos_ids, format=excel
 */
const exportSalesDetailPDF = async (req, res) => {
    try {
        const { start_date, end_date, branch_id, pos_ids } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });
        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Rango de fechas es requerido' });
        }

        const [companyRows] = await pool.query('SELECT razon_social, nit FROM companies WHERE id = ?', [companyId]);
        const company = companyRows[0] || { razon_social: 'EMPRESA', nit: '' };

        let branchName = 'Todas las sucursales';
        if (branch_id && branch_id !== 'all') {
            const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (branchRows.length > 0) branchName = branchRows[0].nombre;
        }

        let posFilter = '';
        let posIds = [];
        if (pos_ids) {
            posIds = pos_ids.split(',').map(s => parseInt(s, 10)).filter(n => Number.isInteger(n) && n > 0);
            if (posIds.length > 0) posFilter = ` AND h.pos_id IN (${posIds.join(',')})`;
        }

        let posLabel = 'Todos los puntos de venta';
        if (posIds.length > 0) {
            const [posRows] = await pool.query(
                `SELECT nombre FROM points_of_sale WHERE id IN (${posIds.join(',')})`
            );
            posLabel = posRows.map(p => p.nombre).join(', ');
        }

        // Detalle por línea
        let sql = `
            SELECT
                h.fecha_emision,
                h.tipo_documento,
                cat.description AS tipo_dte,
                COALESCE(${dteLatestColSql('h', 'numero_control')}, CONCAT('VTA-', h.id)) AS numero_control,
                COALESCE(c.nombre, h.cliente_nombre, 'CONSUMIDOR FINAL') AS cliente,
                COALESCE(si.codigo, p.codigo, '') AS codigo_producto,
                COALESCE(si.descripcion, p.descripcion, '') AS descripcion,
                si.cantidad,
                si.precio_unitario,
                si.venta_gravada,
                si.venta_exenta,
                si.tributos
            FROM sales_headers h
            JOIN sales_items si ON h.id = si.sale_id
            LEFT JOIN products p ON si.product_id = p.id
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento = cat.code
            WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
            AND ${dteValidoExistsSql('h')}
            AND h.fecha_emision BETWEEN ? AND ?
        `;
        const params = [companyId, start_date, end_date];

        if (branch_id && branch_id !== 'all') {
            sql += ' AND h.branch_id = ?';
            params.push(branch_id);
        }
        sql += posFilter;
        sql += ' ORDER BY h.fecha_emision ASC, h.id ASC, si.id ASC';

        const [rows] = await pool.query(sql, params);

        // Totales autoritativos desde las cabeceras
        let totalsSql = `
            SELECT
                COUNT(DISTINCT h.id) AS num_documentos,
                SUM(h.total_iva) AS iva,
                SUM(h.fovial) AS fovial,
                SUM(h.cotrans) AS cotrans,
                SUM(h.total_pagar) AS total
            FROM sales_headers h
            WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
            AND ${dteValidoExistsSql('h')}
            AND h.fecha_emision BETWEEN ? AND ?
        `;
        const totalsParams = [companyId, start_date, end_date];
        if (branch_id && branch_id !== 'all') {
            totalsSql += ' AND h.branch_id = ?';
            totalsParams.push(branch_id);
        }
        totalsSql += posFilter;
        const [totalsRows] = await pool.query(totalsSql, totalsParams);
        const totals = totalsRows[0] || {};

        const details = rows.map((r) => {
            const { fovial, cotrans } = parseItemTributos(r.tributos);
            const gravada = parseFloat(r.venta_gravada) || 0;
            const exenta = parseFloat(r.venta_exenta) || 0;
            const cantidad = parseFloat(r.cantidad) || 0;
            const precio = parseFloat(r.precio_unitario) || 0;
            const tipoDoc = String(r.tipo_documento || '');
            const iva = IVA_DOC_TYPES.includes(tipoDoc) ? Math.round(gravada * (13 / 113) * 100) / 100 : 0;
            return {
                fecha: fmtDate(r.fecha_emision),
                tipo_dte: String(r.tipo_dte || getDteTypeName(tipoDoc) || '---'),
                numero_control: String(r.numero_control || '---'),
                cliente: String(r.cliente || 'CONSUMIDOR FINAL').toUpperCase(),
                codigo_producto: String(r.codigo_producto || ''),
                descripcion: String(r.descripcion || ''),
                cantidad,
                precio,
                iva,
                fovial,
                cotrans,
                total: gravada + exenta + fovial + cotrans
            };
        });

        let lineTotals = { cantidad: 0, iva: 0, fovial: 0, cotrans: 0, total: 0 };
        details.forEach(d => {
            lineTotals.cantidad += d.cantidad;
            lineTotals.iva += d.iva;
            lineTotals.fovial += d.fovial;
            lineTotals.cotrans += d.cotrans;
            lineTotals.total += d.total;
        });

        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Detalle Facturación',
                    columns: [
                        { header: 'Fecha', key: 'fecha', width: 14 },
                        { header: 'Tipo DTE', key: 'tipo_dte', width: 18 },
                        { header: 'N° Control', key: 'numero_control', width: 22 },
                        { header: 'Cliente', key: 'cliente', width: 30 },
                        { header: 'Código Producto', key: 'codigo_producto', width: 16 },
                        { header: 'Descripción', key: 'descripcion', width: 35 },
                        { header: 'Cantidad', key: 'cantidad', width: 10 },
                        { header: 'Precio', key: 'precio', width: 12 },
                        { header: 'IVA', key: 'iva', width: 12 },
                        { header: 'FOVIAL', key: 'fovial', width: 12 },
                        { header: 'COTRANS', key: 'cotrans', width: 12 },
                        { header: 'Total', key: 'total', width: 14 }
                    ],
                    data: details.map(d => ({
                        fecha: d.fecha,
                        tipo_dte: d.tipo_dte,
                        numero_control: d.numero_control,
                        cliente: d.cliente,
                        codigo_producto: d.codigo_producto,
                        descripcion: d.descripcion,
                        cantidad: d.cantidad.toFixed(5),
                        precio: d.precio.toFixed(2),
                        iva: d.iva.toFixed(2),
                        fovial: d.fovial.toFixed(2),
                        cotrans: d.cotrans.toFixed(2),
                        total: d.total.toFixed(2)
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Detalle_Facturacion_${start_date}_al_${end_date}.xlsx`);
        }

        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');
        const startX = 30;
        const contentWidth = 732;

        const periodText = `DEL ${reportPdfHelper.formatDate(start_date)} AL ${reportPdfHelper.formatDate(end_date)}`;
        const subtitle = `SUCURSAL: ${branchName}   |   PUNTOS DE VENTA: ${posLabel}`;

        reportPdfHelper.renderHeader(doc, company, 'Detalle de Facturación', periodText, 'landscape', subtitle);

        const colW = {
            fecha: 46,
            tipoDte: 62,
            control: 110,
            cliente: 115,
            codigo: 55,
            desc: 110,
            cant: 44,
            precio: 46,
            iva: 44,
            fov: 38,
            cot: 38,
            tot: 54
        };

        const drawTableHeader = (yPos) => {
            doc.rect(startX, yPos, contentWidth, 13).fill('#f1f5f9');
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            let x = startX + 4;
            doc.text('FECHA', x, yPos + 3); x += colW.fecha;
            doc.text('TIPO DTE', x, yPos + 3); x += colW.tipoDte;
            doc.text('N° CONTROL', x, yPos + 3); x += colW.control;
            doc.text('CLIENTE', x, yPos + 3); x += colW.cliente;
            doc.text('CÓDIGO', x, yPos + 3); x += colW.codigo;
            doc.text('DESCRIPCIÓN', x, yPos + 3); x += colW.desc;
            doc.text('CANT.', x, yPos + 3, { width: colW.cant, align: 'right' }); x += colW.cant;
            doc.text('PRECIO', x, yPos + 3, { width: colW.precio, align: 'right' }); x += colW.precio;
            doc.text('IVA', x, yPos + 3, { width: colW.iva, align: 'right' }); x += colW.iva;
            doc.text('FOV.', x, yPos + 3, { width: colW.fov, align: 'right' }); x += colW.fov;
            doc.text('COT.', x, yPos + 3, { width: colW.cot, align: 'right' }); x += colW.cot;
            doc.text('TOTAL', x, yPos + 3, { width: colW.tot - 6, align: 'right' });
            return yPos + 16;
        };

        let currentY = drawTableHeader(doc.y + 4);

        if (details.length === 0) {
            doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
            doc.text('No se encontraron registros de facturación en el período seleccionado.', startX, currentY + 10);
            currentY += 30;
        } else {
            details.forEach((r) => {
                if (currentY > 520) {
                    doc.addPage();
                    reportPdfHelper.renderHeader(doc, company, 'Detalle de Facturación', periodText, 'landscape', subtitle);
                    currentY = drawTableHeader(doc.y + 4);
                }

                doc.fontSize(7).font('Helvetica').fillColor('#1e293b');
                let lx = startX + 4;
                doc.text(r.fecha, lx, currentY, { width: colW.fecha, truncate: true }); lx += colW.fecha;
                doc.text(r.tipo_dte, lx, currentY, { width: colW.tipoDte, truncate: true }); lx += colW.tipoDte;
                doc.text(r.numero_control, lx, currentY, { width: colW.control, truncate: true }); lx += colW.control;
                doc.text(r.cliente, lx, currentY, { width: colW.cliente, truncate: true }); lx += colW.cliente;
                doc.text(r.codigo_producto, lx, currentY, { width: colW.codigo, truncate: true }); lx += colW.codigo;
                doc.text(r.descripcion, lx, currentY, { width: colW.desc, truncate: true }); lx += colW.desc;
                doc.text(r.cantidad.toFixed(2), lx, currentY, { width: colW.cant, align: 'right' }); lx += colW.cant;
                doc.text(reportPdfHelper.fmt(r.precio), lx, currentY, { width: colW.precio, align: 'right' }); lx += colW.precio;
                doc.text(reportPdfHelper.fmt(r.iva), lx, currentY, { width: colW.iva, align: 'right' }); lx += colW.iva;
                doc.text(reportPdfHelper.fmt(r.fovial), lx, currentY, { width: colW.fov, align: 'right' }); lx += colW.fov;
                doc.text(reportPdfHelper.fmt(r.cotrans), lx, currentY, { width: colW.cot, align: 'right' }); lx += colW.cot;
                doc.text(reportPdfHelper.fmt(r.total), lx, currentY, { width: colW.tot - 6, align: 'right' });
                currentY += 11;
            });

            // Fila de totales por línea
            if (currentY > 510) {
                doc.addPage();
                reportPdfHelper.renderHeader(doc, company, 'Detalle de Facturación', periodText, 'landscape', subtitle);
                currentY = drawTableHeader(doc.y + 4);
            }

            doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY + 1).lineTo(startX + contentWidth, currentY + 1).stroke();
            currentY += 4;
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(`TOTALES (${details.length} LÍNEAS):`, startX + 4, currentY, { width: colW.fecha + colW.tipoDte + colW.control + colW.cliente + colW.codigo + colW.desc, align: 'right' });
            let tx = startX + colW.fecha + colW.tipoDte + colW.control + colW.cliente + colW.codigo + colW.desc + 4;
            doc.text(lineTotals.cantidad.toFixed(2), tx, currentY, { width: colW.cant, align: 'right' }); tx += colW.cant;
            tx += colW.precio; // Salta precio unitario
            doc.text(reportPdfHelper.fmt(lineTotals.iva), tx, currentY, { width: colW.iva, align: 'right' }); tx += colW.iva;
            doc.text(reportPdfHelper.fmt(lineTotals.fovial), tx, currentY, { width: colW.fov, align: 'right' }); tx += colW.fov;
            doc.text(reportPdfHelper.fmt(lineTotals.cotrans), tx, currentY, { width: colW.cot, align: 'right' }); tx += colW.cot;
            doc.text(reportPdfHelper.fmt(lineTotals.total), tx, currentY, { width: colW.tot - 6, align: 'right' });
            currentY += 16;

            // Totales de cabeceras (autoritativos)
            doc.rect(startX, currentY, contentWidth, 16).fill('#f1f5f9');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(
                `RESUMEN DE CABECERAS: ${parseInt(totals.num_documentos || 0, 10)} DOCUMENTOS | IVA: ${reportPdfHelper.fmt(totals.iva)} | FOVIAL: ${reportPdfHelper.fmt(totals.fovial)} | COTRANS: ${reportPdfHelper.fmt(totals.cotrans)} | TOTAL: ${reportPdfHelper.fmt(totals.total)}`,
                startX + 6, currentY + 4, { width: contentWidth - 12 }
            );
            currentY += 22;
        }

        reportPdfHelper.renderClosingFooter(doc, startX, currentY, details.length, 'Líneas');
        reportPdfHelper.renderPageNumbers(doc);
        doc.end();

        const buffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Detalle_Facturacion_${start_date}_al_${end_date}.pdf`);
        res.send(buffer);
    } catch (error) {
        console.error('Error in exportSalesDetailPDF:', error);
        res.status(500).json({ message: 'Error al generar el detalle de facturación', error: error.message });
    }
};

/**
 * Consulta autoritativa para el Reporte de Descuentos en Ventas (KPIs, resumen y líneas).
 */
async function fetchSalesDiscountsPayload(companyId, query) {
    const { start_date, end_date, branch_id, pos_id, seller_id, customer_id, mode = 'summary' } = query;

    const company = await reportPdfHelper.getCompanyInfo(companyId);

    let branchName = 'Todas las sucursales';
    if (branch_id && branch_id !== 'all') {
        const [bRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
        if (bRows.length > 0) branchName = bRows[0].nombre;
    }

    let posLabel = 'Todos los puntos de venta';
    if (pos_id && pos_id !== 'all') {
        const [pRows] = await pool.query('SELECT nombre FROM points_of_sale WHERE id = ?', [pos_id]);
        if (pRows.length > 0) posLabel = pRows[0].nombre;
    }

    let sellerLabel = 'Todos los vendedores';
    if (seller_id && seller_id !== 'all') {
        const [sRows] = await pool.query('SELECT nombre FROM sellers WHERE id = ?', [seller_id]);
        if (sRows.length > 0) sellerLabel = sRows[0].nombre;
    }

    let customerLabel = 'Todos los clientes';
    if (customer_id && customer_id !== 'all') {
        const [cRows] = await pool.query('SELECT nombre FROM customers WHERE id = ?', [customer_id]);
        if (cRows.length > 0) customerLabel = cRows[0].nombre;
    }

    let extraFilters = '';
    const filterParams = [];

    if (branch_id && branch_id !== 'all') {
        extraFilters += ' AND h.branch_id = ?';
        filterParams.push(branch_id);
    }
    if (pos_id && pos_id !== 'all') {
        extraFilters += ' AND h.pos_id = ?';
        filterParams.push(pos_id);
    }
    if (seller_id && seller_id !== 'all') {
        extraFilters += ' AND h.seller_id = ?';
        filterParams.push(seller_id);
    }
    if (customer_id && customer_id !== 'all') {
        extraFilters += ' AND h.customer_id = ?';
        filterParams.push(customer_id);
    }

    // 1. Resumen por Documento
    const docsSql = `
        SELECT
            h.id AS sale_id,
            h.fecha_emision,
            h.hora_emision,
            h.tipo_documento,
            cat.description AS tipo_dte,
            COALESCE(${dteLatestColSql('h', 'numero_control')}, CONCAT('VTA-', h.id)) AS numero_control,
            COALESCE(b.nombre, 'Sin Sucursal') AS sucursal,
            COALESCE(pos.nombre, 'Sin POS') AS pos,
            COALESCE(s.nombre, 'Sin Asignar') AS vendedor,
            COALESCE(c.nombre, h.cliente_nombre, 'CONSUMIDOR FINAL') AS cliente,
            h.descuento_general,
            h.total_pagar,
            h.total_gravado,
            h.total_exento,
            h.total_nosujetas,
            h.total_iva,
            h.fovial,
            h.cotrans,
            COALESCE(item_agg.total_item_discount, 0) AS descuento_items,
            COALESCE(item_agg.total_gross_items, 0) AS subtotal_bruto_items,
            COALESCE(item_agg.items_count, 0) AS items_count
        FROM sales_headers h
        JOIN (
            SELECT 
                sale_id,
                SUM(monto_descuento) AS total_item_discount,
                SUM(cantidad * precio_unitario) AS total_gross_items,
                COUNT(*) AS items_count
            FROM sales_items
            GROUP BY sale_id
        ) item_agg ON h.id = item_agg.sale_id
        LEFT JOIN branches b ON h.branch_id = b.id
        LEFT JOIN points_of_sale pos ON h.pos_id = pos.id
        LEFT JOIN sellers s ON h.seller_id = s.id
        LEFT JOIN customers c ON h.customer_id = c.id
        LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento = cat.code
        WHERE h.company_id = ?
          AND LOWER(h.estado) = 'emitido'
          AND ${dteValidoExistsSql('h')}
          AND h.fecha_emision BETWEEN ? AND ?
          AND (h.descuento_general > 0 OR item_agg.total_item_discount > 0)
          ${extraFilters}
        ORDER BY h.fecha_emision ASC, h.id ASC
    `;

    const [docRows] = await pool.query(docsSql, [companyId, start_date, end_date, ...filterParams]);

    const shortDteNames = {
        '01': 'Factura',
        '03': 'Crédito Fiscal',
        '04': 'Nota Remisión',
        '05': 'Nota Crédito',
        '06': 'Nota Débito',
        '07': 'Comp. Retención',
        '08': 'Comp. Liquidación',
        '11': 'Fact. Exportación',
        '14': 'Fact. Suj. Excl.'
    };

    const documents = docRows.map(r => {
        const descGen = parseFloat(r.descuento_general) || 0;
        const descItems = parseFloat(r.descuento_items) || 0;
        const descTotal = descGen + descItems;
        const totalPagar = parseFloat(r.total_pagar) || 0;
        const subtotalBruto = totalPagar + descTotal;
        const pctDesc = subtotalBruto > 0 ? (descTotal / subtotalBruto) * 100 : 0;
        const tipoDteName = shortDteNames[r.tipo_documento] || r.tipo_dte || getDteTypeName(r.tipo_documento) || 'Documento';
        return {
            sale_id: r.sale_id,
            fecha: reportPdfHelper.formatDate(r.fecha_emision),
            hora: r.hora_emision ? String(r.hora_emision).substring(0, 5) : '',
            tipo_documento: r.tipo_documento,
            tipo_dte: tipoDteName,
            numero_control: String(r.numero_control || '---'),
            sucursal: String(r.sucursal || '---'),
            pos: String(r.pos || '---'),
            vendedor: String(r.vendedor || '---'),
            cliente: String(r.cliente || 'CONSUMIDOR FINAL').toUpperCase(),
            subtotal_bruto: subtotalBruto,
            descuento_items: descItems,
            descuento_general: descGen,
            descuento_total: descTotal,
            total_pagar: totalPagar,
            porcentaje_descuento: pctDesc,
            items_count: r.items_count
        };
    });

    // 2. Detalle por Ítem
    const itemsSql = `
        SELECT
            h.id AS sale_id,
            h.fecha_emision,
            h.tipo_documento,
            cat.description AS tipo_dte,
            COALESCE(${dteLatestColSql('h', 'numero_control')}, CONCAT('VTA-', h.id)) AS numero_control,
            COALESCE(b.nombre, 'Sin Sucursal') AS sucursal,
            COALESCE(pos.nombre, 'Sin POS') AS pos,
            COALESCE(s.nombre, 'Sin Asignar') AS vendedor,
            COALESCE(c.nombre, h.cliente_nombre, 'CONSUMIDOR FINAL') AS cliente,
            si.id AS item_id,
            COALESCE(si.codigo, p.codigo, '---') AS codigo_producto,
            COALESCE(si.descripcion, p.descripcion, 'Producto') AS descripcion,
            si.cantidad,
            si.precio_unitario,
            si.monto_descuento,
            si.venta_gravada,
            si.venta_exenta,
            h.descuento_general
        FROM sales_headers h
        JOIN sales_items si ON h.id = si.sale_id
        LEFT JOIN products p ON si.product_id = p.id
        LEFT JOIN branches b ON h.branch_id = b.id
        LEFT JOIN points_of_sale pos ON h.pos_id = pos.id
        LEFT JOIN sellers s ON h.seller_id = s.id
        LEFT JOIN customers c ON h.customer_id = c.id
        LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento = cat.code
        WHERE h.company_id = ?
          AND LOWER(h.estado) = 'emitido'
          AND ${dteValidoExistsSql('h')}
          AND h.fecha_emision BETWEEN ? AND ?
          AND (si.monto_descuento > 0 OR h.descuento_general > 0)
          ${extraFilters}
        ORDER BY h.fecha_emision ASC, h.id ASC, si.id ASC
    `;

    const [itemRows] = await pool.query(itemsSql, [companyId, start_date, end_date, ...filterParams]);

    const items = itemRows.map(r => {
        const qty = parseFloat(r.cantidad) || 0;
        const price = parseFloat(r.precio_unitario) || 0;
        const gross = qty * price;
        const descItem = parseFloat(r.monto_descuento) || 0;
        const pctItem = gross > 0 ? (descItem / gross) * 100 : 0;
        const net = (parseFloat(r.venta_gravada) || 0) + (parseFloat(r.venta_exenta) || 0);
        const tipoDteName = shortDteNames[r.tipo_documento] || r.tipo_dte || getDteTypeName(r.tipo_documento) || 'Documento';
        return {
            sale_id: r.sale_id,
            fecha: reportPdfHelper.formatDate(r.fecha_emision),
            tipo_documento: r.tipo_documento,
            tipo_dte: tipoDteName,
            numero_control: String(r.numero_control || '---'),
            sucursal: String(r.sucursal || '---'),
            pos: String(r.pos || '---'),
            vendedor: String(r.vendedor || '---'),
            cliente: String(r.cliente || 'CONSUMIDOR FINAL').toUpperCase(),
            codigo_producto: String(r.codigo_producto || '---'),
            descripcion: String(r.descripcion || 'Producto'),
            cantidad: qty,
            precio_unitario: price,
            subtotal_bruto: gross,
            descuento_item: descItem,
            porcentaje_descuento: pctItem,
            subtotal_neto: net
        };
    });

    let totalSubtotalBruto = 0;
    let totalDescItems = 0;
    let totalDescGen = 0;
    let totalDescGlobal = 0;
    let totalNetoFacturado = 0;

    documents.forEach(d => {
        totalSubtotalBruto += d.subtotal_bruto;
        totalDescItems += d.descuento_items;
        totalDescGen += d.descuento_general;
        totalDescGlobal += d.descuento_total;
        totalNetoFacturado += d.total_pagar;
    });

    const kpis = {
        total_documentos: documents.length,
        total_lineas: items.length,
        total_subtotal_bruto: totalSubtotalBruto,
        total_descuento_items: totalDescItems,
        total_descuento_general: totalDescGen,
        gran_total_descuento: totalDescGlobal,
        total_facturado_neto: totalNetoFacturado,
        porcentaje_promedio: totalSubtotalBruto > 0 ? (totalDescGlobal / totalSubtotalBruto) * 100 : 0
    };

    return {
        company,
        meta: {
            start_date,
            end_date,
            branchName,
            posLabel,
            sellerLabel,
            customerLabel,
            mode
        },
        kpis,
        documents,
        items
    };
}

/**
 * Endpoint JSON para métricas y preview de descuentos.
 */
const getSalesDiscountsData = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) return res.status(401).json({ message: 'No autorizado' });

        const { start_date, end_date } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Rango de fechas es requerido' });
        }

        const payload = await fetchSalesDiscountsPayload(companyId, req.query);
        return res.json({ success: true, ...payload });
    } catch (error) {
        console.error('Error in getSalesDiscountsData:', error);
        res.status(500).json({ message: 'Error al consultar datos de descuentos', error: error.message });
    }
};

/**
 * Reporte "Descuentos en Ventas" (PDF y Excel).
 * Params: start_date, end_date, branch_id, pos_id, seller_id, customer_id, mode (summary|detailed), format=excel
 */
const exportSalesDiscountsReport = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) return res.status(401).json({ message: 'No autorizado' });

        const { start_date, end_date, mode = 'summary', format } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Rango de fechas es requerido' });
        }

        const payload = await fetchSalesDiscountsPayload(companyId, req.query);
        const { company, meta, kpis, documents, items } = payload;

        // 1. Exportación a Excel si format === 'excel'
        if (format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [
                    {
                        name: 'Resumen por Documento',
                        columns: [
                            { header: 'Fecha', key: 'fecha', width: 14 },
                            { header: 'Tipo DTE', key: 'tipo_dte', width: 18 },
                            { header: 'N° Control', key: 'numero_control', width: 22 },
                            { header: 'Sucursal', key: 'sucursal', width: 20 },
                            { header: 'Punto de Venta', key: 'pos', width: 18 },
                            { header: 'Vendedor', key: 'vendedor', width: 22 },
                            { header: 'Cliente', key: 'cliente', width: 32 },
                            { header: 'Subtotal Bruto ($)', key: 'subtotal_bruto', width: 16 },
                            { header: 'Descuento Ítems ($)', key: 'descuento_items', width: 18 },
                            { header: 'Descuento General ($)', key: 'descuento_general', width: 18 },
                            { header: 'Descuento Total ($)', key: 'descuento_total', width: 18 },
                            { header: 'Total Facturado ($)', key: 'total_pagar', width: 18 },
                            { header: '% Descuento Efectivo', key: 'porcentaje_descuento', width: 18 }
                        ],
                        data: documents.map(d => ({
                            fecha: d.fecha,
                            tipo_dte: d.tipo_dte,
                            numero_control: d.numero_control,
                            sucursal: d.sucursal,
                            pos: d.pos,
                            vendedor: d.vendedor,
                            cliente: d.cliente,
                            subtotal_bruto: d.subtotal_bruto.toFixed(2),
                            descuento_items: d.descuento_items.toFixed(2),
                            descuento_general: d.descuento_general.toFixed(2),
                            descuento_total: d.descuento_total.toFixed(2),
                            total_pagar: d.total_pagar.toFixed(2),
                            porcentaje_descuento: `${d.porcentaje_descuento.toFixed(2)}%`
                        }))
                    },
                    {
                        name: 'Detalle por Ítem',
                        columns: [
                            { header: 'Fecha', key: 'fecha', width: 14 },
                            { header: 'Tipo DTE', key: 'tipo_dte', width: 18 },
                            { header: 'N° Control', key: 'numero_control', width: 22 },
                            { header: 'Sucursal', key: 'sucursal', width: 20 },
                            { header: 'Vendedor', key: 'vendedor', width: 22 },
                            { header: 'Cliente', key: 'cliente', width: 30 },
                            { header: 'Código', key: 'codigo_producto', width: 16 },
                            { header: 'Descripción', key: 'descripcion', width: 35 },
                            { header: 'Cantidad', key: 'cantidad', width: 12 },
                            { header: 'Precio Lista ($)', key: 'precio_unitario', width: 16 },
                            { header: 'Subtotal Bruto ($)', key: 'subtotal_bruto', width: 16 },
                            { header: 'Descuento Ítem ($)', key: 'descuento_item', width: 18 },
                            { header: '% Descuento', key: 'porcentaje_descuento', width: 14 },
                            { header: 'Subtotal Neto ($)', key: 'subtotal_neto', width: 16 }
                        ],
                        data: items.map(it => ({
                            fecha: it.fecha,
                            tipo_dte: it.tipo_dte,
                            numero_control: it.numero_control,
                            sucursal: it.sucursal,
                            vendedor: it.vendedor,
                            cliente: it.cliente,
                            codigo_producto: it.codigo_producto,
                            descripcion: it.descripcion,
                            cantidad: it.cantidad.toFixed(4),
                            precio_unitario: it.precio_unitario.toFixed(2),
                            subtotal_bruto: it.subtotal_bruto.toFixed(2),
                            descuento_item: it.descuento_item.toFixed(2),
                            porcentaje_descuento: `${it.porcentaje_descuento.toFixed(2)}%`,
                            subtotal_neto: it.subtotal_neto.toFixed(2)
                        }))
                    }
                ]
            });
            return excelService.sendExcelResponse(res, buffer, `Reporte_Descuentos_${start_date}_al_${end_date}.xlsx`);
        }

        // 2. Exportación a PDF (Estándar contable unificado en orientación horizontal)
        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');
        const startX = 30;
        const contentWidth = 732;

        const periodText = `DEL ${reportPdfHelper.formatDate(start_date)} AL ${reportPdfHelper.formatDate(end_date)}`;
        
        const subParts = [];
        if (meta.branchName && !meta.branchName.toLowerCase().includes('todas')) {
            subParts.push(`SUCURSAL: ${meta.branchName}`);
        }
        if (req.query.pos_id && req.query.pos_id !== 'all' && meta.posLabel && !meta.posLabel.toLowerCase().includes('todos')) {
            subParts.push(`POS: ${meta.posLabel}`);
        }
        if (req.query.seller_id && req.query.seller_id !== 'all' && meta.sellerLabel && !meta.sellerLabel.toLowerCase().includes('todos')) {
            subParts.push(`VENDEDOR: ${meta.sellerLabel}`);
        }
        if (req.query.customer_id && req.query.customer_id !== 'all' && meta.customerLabel && !meta.customerLabel.toLowerCase().includes('todos')) {
            subParts.push(`CLIENTE: ${meta.customerLabel}`);
        }
        subParts.push(mode === 'detailed' ? 'MODO: DETALLADO POR ÍTEM' : 'MODO: RESUMEN POR DOCUMENTO');
        const subtitle = subParts.join('   |   ');

        reportPdfHelper.renderHeader(doc, company, 'Reporte de Descuentos en Ventas', periodText, 'landscape', subtitle);

        // ========================================================
        // CUADRO RESUMEN AL FINAL DEL REPORTE
        // ========================================================
        const renderDiscountsSummaryBox = (curY) => {
            const summaryBoxH = 86;
            if (curY + summaryBoxH > 505) {
                doc.addPage();
                reportPdfHelper.renderHeader(doc, company, 'Reporte de Descuentos en Ventas', periodText, 'landscape', subtitle);
                curY = doc.y + 6;
            }

            const boxX = startX;
            const boxW = contentWidth;

            // Fondo y borde del cuadro resumen
            doc.rect(boxX, curY, boxW, summaryBoxH).fillAndStroke('#f8fafc', '#cbd5e1');

            // Barra de título del cuadro resumen
            doc.rect(boxX, curY, boxW, 16).fill('#1e293b');
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#ffffff');
            doc.text('CUADRO RESUMEN DE DESCUENTOS DEL PERÍODO', boxX + 12, curY + 4, { lineBreak: false });

            const cardY = curY + 22;
            const col1X = boxX + 16;
            const col1W = 335;
            const col2X = boxX + 380;
            const col2W = 335;

            // Columna 1: Desglose Monetario
            doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#475569');
            doc.text('DESGLOSE MONETARIO DE DESCUENTOS', col1X, cardY, { lineBreak: false });
            doc.moveTo(col1X, cardY + 9).lineTo(col1X + col1W, cardY + 9).lineWidth(0.5).strokeColor('#e2e8f0').stroke();

            let lY = cardY + 12;
            const printLine = (label, amount, isBold = false, color = '#0f172a') => {
                doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.5).fillColor(color);
                doc.text(label, col1X, lY, { width: 220, lineBreak: false });
                doc.text(reportPdfHelper.fmt(amount), col1X + 220, lY, { width: 115, align: 'right', lineBreak: false });
                lY += 10.5;
            };

            printLine('Subtotal Bruto Original (Venta Sin Descuento):', kpis.total_subtotal_bruto);
            printLine('(-) Descuentos Otorgados en Ítems / Productos:', kpis.total_descuento_items);
            printLine('(-) Descuentos Generales (Pie de Documento):', kpis.total_descuento_general);

            doc.moveTo(col1X, lY).lineTo(col1X + col1W, lY).lineWidth(0.75).strokeColor('#0f172a').stroke();
            lY += 2;
            printLine('(=) TOTAL AHORRO / DESCUENTO CONCEDIDO:', kpis.gran_total_descuento, true, '#b91c1c');

            // Columna 2: Liquidación y Efectividad
            doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#475569');
            doc.text('RESUMEN DE FACTURACIÓN Y EFECTIVIDAD', col2X, cardY, { lineBreak: false });
            doc.moveTo(col2X, cardY + 9).lineTo(col2X + col2W, cardY + 9).lineWidth(0.5).strokeColor('#e2e8f0').stroke();

            let rY = cardY + 12;
            const printStat = (label, valStr, isBold = false, color = '#0f172a') => {
                doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.5).fillColor(color);
                doc.text(label, col2X, rY, { width: 210, lineBreak: false });
                doc.text(valStr, col2X + 210, rY, { width: 125, align: 'right', lineBreak: false });
                rY += 10.5;
            };

            printStat('Total Facturado Neto (Cobrado):', reportPdfHelper.fmt(kpis.total_facturado_neto), true, '#047857');
            printStat('Documentos Emitidos con Descuento:', `${kpis.total_documentos} documentos`);
            printStat('Líneas / Ítems con Descuento:', `${kpis.total_lineas} líneas`);

            doc.moveTo(col2X, rY).lineTo(col2X + col2W, rY).lineWidth(0.75).strokeColor('#0f172a').stroke();
            rY += 2;
            printStat('Porcentaje de Descuento Efectivo:', `${kpis.porcentaje_promedio.toFixed(2)}%`, true, '#0f172a');

            doc.font('Helvetica-Oblique').fontSize(5.5).fillColor('#64748b');
            doc.text('* Representa el ahorro total concedido a clientes respecto a los precios de venta brutos.', col2X, rY + 1, { width: col2W, lineBreak: false });

            return curY + summaryBoxH + 14;
        };

        if (mode === 'detailed') {
            // MODO DETALLADO POR ÍTEM (Ancho total: 732pt)
            const colW = {
                fecha: 42,
                tipoDte: 54,
                control: 118,
                cliente: 92,
                vendedor: 58,
                codigo: 46,
                desc: 110,
                cant: 30,
                precio: 40,
                bruto: 46,
                descuento: 56,
                pct: 40
            };

            const drawTableHeader = (yPos) => {
                doc.rect(startX, yPos, contentWidth, 14).fill('#f1f5f9');
                doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
                let x = startX + 4;
                doc.text('FECHA', x, yPos + 3.5, { width: colW.fecha - 4, lineBreak: false }); x += colW.fecha;
                doc.text('TIPO DTE', x, yPos + 3.5, { width: colW.tipoDte - 4, lineBreak: false }); x += colW.tipoDte;
                doc.text('N° CONTROL', x, yPos + 3.5, { width: colW.control - 4, lineBreak: false }); x += colW.control;
                doc.text('CLIENTE', x, yPos + 3.5, { width: colW.cliente - 4, lineBreak: false }); x += colW.cliente;
                doc.text('VENDEDOR', x, yPos + 3.5, { width: colW.vendedor - 4, lineBreak: false }); x += colW.vendedor;
                doc.text('CÓDIGO', x, yPos + 3.5, { width: colW.codigo - 4, lineBreak: false }); x += colW.codigo;
                doc.text('DESCRIPCIÓN', x, yPos + 3.5, { width: colW.desc - 4, lineBreak: false }); x += colW.desc;
                doc.text('CANT.', x, yPos + 3.5, { width: colW.cant - 4, align: 'right', lineBreak: false }); x += colW.cant;
                doc.text('PRECIO', x, yPos + 3.5, { width: colW.precio - 4, align: 'right', lineBreak: false }); x += colW.precio;
                doc.text('BRUTO', x, yPos + 3.5, { width: colW.bruto - 4, align: 'right', lineBreak: false }); x += colW.bruto;
                doc.text('DESCUENTO', x, yPos + 3.5, { width: colW.descuento - 2, align: 'right', lineBreak: false }); x += colW.descuento;
                doc.text('% DESC', x, yPos + 3.5, { width: colW.pct - 4, align: 'right', lineBreak: false });
                return yPos + 17;
            };

            let currentY = drawTableHeader(doc.y + 4);

            if (items.length === 0) {
                doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
                doc.text('No se encontraron líneas con descuentos en el período y filtros seleccionados.', startX, currentY + 10);
                currentY += 30;
            } else {
                items.forEach((r, idx) => {
                    if (currentY > 515) {
                        doc.addPage();
                        reportPdfHelper.renderHeader(doc, company, 'Reporte de Descuentos en Ventas', periodText, 'landscape', subtitle);
                        currentY = drawTableHeader(doc.y + 4);
                    }

                    if (idx % 2 === 1) {
                        doc.rect(startX, currentY - 2, contentWidth, 12).fill('#f8fafc');
                    }

                    doc.fontSize(6.5).font('Helvetica').fillColor('#1e293b');
                    let lx = startX + 4;
                    doc.text(r.fecha, lx, currentY, { width: colW.fecha - 4, height: 9.5, ellipsis: true, lineBreak: false }); lx += colW.fecha;
                    doc.text(r.tipo_dte, lx, currentY, { width: colW.tipoDte - 4, height: 9.5, ellipsis: true, lineBreak: false }); lx += colW.tipoDte;
                    doc.fontSize(6).text(r.numero_control, lx, currentY + 0.3, { width: colW.control + 2, lineBreak: false }); doc.fontSize(6.5); lx += colW.control;
                    doc.text(r.cliente, lx, currentY, { width: colW.cliente - 4, height: 9.5, ellipsis: true, lineBreak: false }); lx += colW.cliente;
                    doc.text(r.vendedor, lx, currentY, { width: colW.vendedor - 4, height: 9.5, ellipsis: true, lineBreak: false }); lx += colW.vendedor;
                    doc.text(r.codigo_producto, lx, currentY, { width: colW.codigo - 4, height: 9.5, ellipsis: true, lineBreak: false }); lx += colW.codigo;
                    doc.text(r.descripcion, lx, currentY, { width: colW.desc - 4, height: 9.5, ellipsis: true, lineBreak: false }); lx += colW.desc;
                    doc.text(r.cantidad.toFixed(2), lx, currentY, { width: colW.cant - 4, align: 'right', lineBreak: false }); lx += colW.cant;
                    doc.text(reportPdfHelper.fmt(r.precio_unitario), lx, currentY, { width: colW.precio - 4, align: 'right', lineBreak: false }); lx += colW.precio;
                    doc.text(reportPdfHelper.fmt(r.subtotal_bruto), lx, currentY, { width: colW.bruto - 4, align: 'right', lineBreak: false }); lx += colW.bruto;
                    doc.text(reportPdfHelper.fmt(r.descuento_item), lx, currentY, { width: colW.descuento - 2, align: 'right', lineBreak: false }); lx += colW.descuento;
                    doc.text(`${r.porcentaje_descuento.toFixed(1)}%`, lx, currentY, { width: colW.pct - 4, align: 'right', lineBreak: false });
                    currentY += 12;
                });

                // Fila de totales por líneas
                if (currentY > 500) {
                    doc.addPage();
                    reportPdfHelper.renderHeader(doc, company, 'Reporte de Descuentos en Ventas', periodText, 'landscape', subtitle);
                    currentY = drawTableHeader(doc.y + 4);
                }

                doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY + 1).lineTo(startX + contentWidth, currentY + 1).stroke();
                currentY += 4;
                doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
                const labelWidth = colW.fecha + colW.tipoDte + colW.control + colW.cliente + colW.vendedor + colW.codigo + colW.desc + colW.cant + colW.precio;
                doc.text(`TOTALES (${items.length} LÍNEAS):`, startX + 4, currentY, { width: labelWidth - 8, align: 'right', lineBreak: false });
                let tx = startX + 4 + labelWidth;
                doc.text(reportPdfHelper.fmt(kpis.total_subtotal_bruto), tx, currentY, { width: colW.bruto - 4, align: 'right', lineBreak: false }); tx += colW.bruto;
                doc.text(reportPdfHelper.fmt(kpis.total_descuento_items), tx, currentY, { width: colW.descuento - 2, align: 'right', lineBreak: false }); tx += colW.descuento;
                doc.text(`${kpis.porcentaje_promedio.toFixed(1)}%`, tx, currentY, { width: colW.pct - 4, align: 'right', lineBreak: false });
                currentY += 16;

                // Cuadro Resumen al final del reporte
                currentY = renderDiscountsSummaryBox(currentY);
            }

            reportPdfHelper.renderClosingFooter(doc, startX, currentY, items.length, 'Líneas');
        } else {
            // MODO RESUMEN POR DOCUMENTO (Ancho total: 732pt)
            const colW = {
                fecha: 44,
                tipoDte: 58,
                control: 120,
                sucursal: 70,
                vendedor: 68,
                cliente: 116,
                bruto: 50,
                descItem: 50,
                descGen: 50,
                descTot: 50,
                neto: 56
            };

            const drawTableHeader = (yPos) => {
                doc.rect(startX, yPos, contentWidth, 14).fill('#f1f5f9');
                doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
                let x = startX + 4;
                doc.text('FECHA', x, yPos + 3.5, { width: colW.fecha - 4, lineBreak: false }); x += colW.fecha;
                doc.text('TIPO DTE', x, yPos + 3.5, { width: colW.tipoDte - 4, lineBreak: false }); x += colW.tipoDte;
                doc.text('N° CONTROL', x, yPos + 3.5, { width: colW.control - 4, lineBreak: false }); x += colW.control;
                doc.text('SUCURSAL', x, yPos + 3.5, { width: colW.sucursal - 4, lineBreak: false }); x += colW.sucursal;
                doc.text('VENDEDOR', x, yPos + 3.5, { width: colW.vendedor - 4, lineBreak: false }); x += colW.vendedor;
                doc.text('CLIENTE', x, yPos + 3.5, { width: colW.cliente - 4, lineBreak: false }); x += colW.cliente;
                doc.text('BRUTO', x, yPos + 3.5, { width: colW.bruto - 4, align: 'right', lineBreak: false }); x += colW.bruto;
                doc.text('DESC. ÍTEM', x, yPos + 3.5, { width: colW.descItem - 4, align: 'right', lineBreak: false }); x += colW.descItem;
                doc.text('DESC. GEN.', x, yPos + 3.5, { width: colW.descGen - 4, align: 'right', lineBreak: false }); x += colW.descGen;
                doc.text('TOT. DESC.', x, yPos + 3.5, { width: colW.descTot - 4, align: 'right', lineBreak: false }); x += colW.descTot;
                doc.text('FACTURADO', x, yPos + 3.5, { width: colW.neto - 6, align: 'right', lineBreak: false });
                return yPos + 17;
            };

            let currentY = drawTableHeader(doc.y + 4);

            if (documents.length === 0) {
                doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
                doc.text('No se encontraron ventas con descuentos en el período y filtros seleccionados.', startX, currentY + 10);
                currentY += 30;
            } else {
                documents.forEach((r, idx) => {
                    if (currentY > 515) {
                        doc.addPage();
                        reportPdfHelper.renderHeader(doc, company, 'Reporte de Descuentos en Ventas', periodText, 'landscape', subtitle);
                        currentY = drawTableHeader(doc.y + 4);
                    }

                    if (idx % 2 === 1) {
                        doc.rect(startX, currentY - 2, contentWidth, 12).fill('#f8fafc');
                    }

                    doc.fontSize(6.5).font('Helvetica').fillColor('#1e293b');
                    let lx = startX + 4;
                    doc.text(r.fecha, lx, currentY, { width: colW.fecha - 4, height: 9.5, ellipsis: true, lineBreak: false }); lx += colW.fecha;
                    doc.text(r.tipo_dte, lx, currentY, { width: colW.tipoDte - 4, height: 9.5, ellipsis: true, lineBreak: false }); lx += colW.tipoDte;
                    doc.fontSize(6).text(r.numero_control, lx, currentY + 0.3, { width: colW.control + 2, lineBreak: false }); doc.fontSize(6.5); lx += colW.control;
                    doc.text(r.sucursal, lx, currentY, { width: colW.sucursal - 4, height: 9.5, ellipsis: true, lineBreak: false }); lx += colW.sucursal;
                    doc.text(r.vendedor, lx, currentY, { width: colW.vendedor - 4, height: 9.5, ellipsis: true, lineBreak: false }); lx += colW.vendedor;
                    doc.text(r.cliente, lx, currentY, { width: colW.cliente - 4, height: 9.5, ellipsis: true, lineBreak: false }); lx += colW.cliente;
                    doc.text(reportPdfHelper.fmt(r.subtotal_bruto), lx, currentY, { width: colW.bruto - 4, align: 'right', lineBreak: false }); lx += colW.bruto;
                    doc.text(reportPdfHelper.fmt(r.descuento_items), lx, currentY, { width: colW.descItem - 4, align: 'right', lineBreak: false }); lx += colW.descItem;
                    doc.text(reportPdfHelper.fmt(r.descuento_general), lx, currentY, { width: colW.descGen - 4, align: 'right', lineBreak: false }); lx += colW.descGen;
                    doc.text(reportPdfHelper.fmt(r.descuento_total), lx, currentY, { width: colW.descTot - 4, align: 'right', lineBreak: false }); lx += colW.descTot;
                    doc.text(reportPdfHelper.fmt(r.total_pagar), lx, currentY, { width: colW.neto - 6, align: 'right', lineBreak: false });
                    currentY += 12;
                });

                // Fila de totales por documentos
                if (currentY > 500) {
                    doc.addPage();
                    reportPdfHelper.renderHeader(doc, company, 'Reporte de Descuentos en Ventas', periodText, 'landscape', subtitle);
                    currentY = drawTableHeader(doc.y + 4);
                }

                doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY + 1).lineTo(startX + contentWidth, currentY + 1).stroke();
                currentY += 4;
                doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
                const labelWidth = colW.fecha + colW.tipoDte + colW.control + colW.sucursal + colW.vendedor + colW.cliente;
                doc.text(`TOTALES (${documents.length} DOCUMENTOS):`, startX + 4, currentY, { width: labelWidth - 8, align: 'right', lineBreak: false });
                let tx = startX + 4 + labelWidth;
                doc.text(reportPdfHelper.fmt(kpis.total_subtotal_bruto), tx, currentY, { width: colW.bruto - 4, align: 'right', lineBreak: false }); tx += colW.bruto;
                doc.text(reportPdfHelper.fmt(kpis.total_descuento_items), tx, currentY, { width: colW.descItem - 4, align: 'right', lineBreak: false }); tx += colW.descItem;
                doc.text(reportPdfHelper.fmt(kpis.total_descuento_general), tx, currentY, { width: colW.descGen - 4, align: 'right', lineBreak: false }); tx += colW.descGen;
                doc.text(reportPdfHelper.fmt(kpis.gran_total_descuento), tx, currentY, { width: colW.descTot - 4, align: 'right', lineBreak: false }); tx += colW.descTot;
                doc.text(reportPdfHelper.fmt(kpis.total_facturado_neto), tx, currentY, { width: colW.neto - 6, align: 'right', lineBreak: false });
                currentY += 16;

                // Cuadro Resumen al final del reporte
                currentY = renderDiscountsSummaryBox(currentY);
            }

            reportPdfHelper.renderClosingFooter(doc, startX, currentY, documents.length, 'Documentos');
        }

        reportPdfHelper.renderPageNumbers(doc);
        doc.end();

        const buffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Reporte_Descuentos_${start_date}_al_${end_date}.pdf`);
        res.send(buffer);
    } catch (error) {
        console.error('Error in exportSalesDiscountsReport:', error);
        res.status(500).json({ message: 'Error al generar reporte de descuentos', error: error.message });
    }
};

async function resolveRTEELogo(companyId, branchId, branchLogo, compLogo) {
    const checkFile = (rawUrl) => {
        if (!rawUrl) return null;
        const cleanPath = rawUrl.startsWith('/') ? rawUrl.substring(1) : rawUrl;
        const abs1 = path.join(__dirname, '..', '..', cleanPath);
        if (fs.existsSync(abs1)) return abs1;
        const fileName = path.basename(cleanPath);
        const abs2 = path.join(__dirname, '..', '..', 'uploads', fileName);
        if (fs.existsSync(abs2)) return abs2;
        return null;
    };

    // 1. Priorizar estrictamente el logo configurado para la sucursal emisora
    if (branchLogo) {
        const found = checkFile(branchLogo);
        if (found) return found;
    }

    if (branchId) {
        try {
            const [b] = await pool.query('SELECT logo_url FROM branches WHERE id = ?', [branchId]);
            if (b.length && b[0].logo_url) {
                const found = checkFile(b[0].logo_url);
                if (found) return found;
            }
        } catch (_) {}
    }

    // 2. Si la sucursal no tiene logo propio, recurrir al logo corporativo de la empresa
    if (compLogo) {
        const found = checkFile(compLogo);
        if (found) return found;
    }

    if (companyId) {
        try {
            const [c] = await pool.query('SELECT logo_url FROM companies WHERE id = ?', [companyId]);
            if (c.length && c[0].logo_url) {
                const found = checkFile(c[0].logo_url);
                if (found) return found;
            }
        } catch (_) {}
    }

    // NUNCA tomar el logo de otra sucursal hermana porque pueden ser franquicias distintas (ej: Shell vs Puma)
    return null;
}

async function resolveUbicacionCompleta(depCode, munCode, distCode, direccionComp) {
    let depNombre = '';
    let munNombre = '';
    let distNombre = '';

    try {
        if (depCode) {
            const [dep] = await pool.query('SELECT description FROM cat_012_departamento WHERE code = ? LIMIT 1', [depCode]);
            if (dep.length) depNombre = dep[0].description;
        }
        if (depCode && munCode) {
            const [mun] = await pool.query('SELECT description FROM cat_013_municipio WHERE dep_code = ? AND code = ? LIMIT 1', [depCode, munCode]);
            if (mun.length) munNombre = mun[0].description;
        }
        if (depCode && munCode && distCode) {
            const [dist] = await pool.query('SELECT description FROM cat_008_distrito WHERE dep_code = ? AND muni_code = ? AND code = ? LIMIT 1', [depCode, munCode, distCode]);
            if (dist.length) distNombre = dist[0].description;
        }
    } catch (_) {}

    const toTitleCase = (str) => {
        if (!str) return '';
        return str.toLowerCase().replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
    };

    const parts = [];
    if (direccionComp) parts.push(direccionComp.trim().replace(/,\s*$/, ''));
    if (distNombre) parts.push(toTitleCase(distNombre));
    else if (munNombre) parts.push(toTitleCase(munNombre));
    if (depNombre) parts.push(toTitleCase(depNombre));

    const fullText = parts.reduce((acc, part) => {
        if (!part) return acc;
        if (!acc) return part;
        if (acc.toLowerCase().includes(part.toLowerCase())) return acc;
        return `${acc}, ${part}`;
    }, '');

    return {
        textoCompleto: fullText,
        departamento_nombre: toTitleCase(depNombre) || 'San Salvador',
        municipio_nombre: toTitleCase(distNombre || munNombre) || 'San Salvador'
    };
}


// --- RTEE Y PORTAL PÚBLICO DE CONSULTA DTE ---
const getSaleRTEEPdfBuffer = async (id, companyId) => {
    // 1. Obtener datos detallados de la venta y DTE
    const [header] = await pool.query(
        `SELECT h.*, h.estado as sale_estado,
        s.nombre as seller_name, p.nombre as pos_name, c.nombre as customer_name, c.correo as customer_email,
        c.nrc as customer_nrc,
        COALESCE(d_c.status, d_v.status) as dte_status, COALESCE(d_c.numero_control, d_v.numero_control) as dte_control, COALESCE(d_c.respuesta_hacienda, d_v.respuesta_hacienda) as respuesta_hacienda, COALESCE(d_c.respuesta_hacienda, d_v.respuesta_hacienda) as dte_error,
        COALESCE(d_c.json_original, d_v.json_original) as json_original, COALESCE(d_c.sello_recepcion, d_v.sello_recepcion) as sello_recepcion, COALESCE(d_c.fh_procesamiento, d_v.fh_procesamiento) as fh_procesamiento
        FROM sales_headers h
        LEFT JOIN customers c ON h.customer_id = c.id
        LEFT JOIN sellers s ON h.seller_id = s.id
        LEFT JOIN points_of_sale p ON h.pos_id = p.id
        LEFT JOIN dtes d_c ON d_c.codigo_generacion = h.codigo_generacion AND d_c.company_id = h.company_id
        LEFT JOIN dtes d_v ON (h.codigo_generacion IS NULL OR h.codigo_generacion = '') AND d_v.venta_id = h.id AND d_v.company_id = h.company_id
        WHERE h.id = ? AND h.company_id = ? LIMIT 1`, [id, companyId]);

    if (header.length === 0) {
        throw new Error('Venta no encontrada');
    }

    const venta = header[0];
    
    // Procesar JSON si viene como string
    let dteJson = venta.json_original;
    if (typeof dteJson === 'string') {
        try { dteJson = JSON.parse(dteJson); } catch (e) {
            throw new Error('Error al procesar el JSON del DTE');
        }
    }

    if (!dteJson) {
        throw new Error('Esta venta no tiene un DTE asociado para generar la RTEE');
    }

    // 2. Obtener datos del emisor (Empresa y Sucursal)
    const [company] = await pool.query('SELECT * FROM companies WHERE id = ?', [companyId]);
    const [branch] = await pool.query('SELECT * FROM branches WHERE id = ?', [venta.branch_id]);

    const branchRow = branch[0] || {};
    const companyRow = company[0] || {};

    // --- Lógica de Logo Robusta sin préstamos entre sucursales ---
    const logoPath = await resolveRTEELogo(companyId, venta.branch_id, branchRow.logo_url, companyRow.logo_url);

    // Resolver ubicación detallada de la sucursal (dirección, distrito, municipio, departamento)
    const depCode = branchRow.departamento || dteJson.emisor?.direccion?.departamento || companyRow.departamento;
    const munCode = branchRow.municipio || dteJson.emisor?.direccion?.municipio || companyRow.municipio;
    const distCode = branchRow.distrito || dteJson.emisor?.direccion?.distrito;
    const dirComplemento = branchRow.direccion || dteJson.emisor?.direccion?.complemento || dteJson.emisor?.direccion || '';

    const [emisorDescActividad, receptorDescActividad, ubicacionInfo] = await Promise.all([
        resolveActividadOficial(dteJson.emisor?.codActividad, dteJson.emisor?.descActividad),
        resolveActividadOficial(dteJson.receptor?.codActividad, dteJson.receptor?.descActividad),
        resolveUbicacionCompleta(depCode, munCode, distCode, dirComplemento)
    ]);

    const reportData = {
        emisor: {
            nombre: companyRow.razon_social || companyRow.nombre || dteJson.emisor?.nombre,
            razon_social: companyRow.razon_social || companyRow.nombre || dteJson.emisor?.nombre,
            nombre_comercial: companyRow.nombre_comercial || dteJson.emisor?.nombreComercial,
            sucursal_nombre: branchRow.nombre || dteJson.emisor?.nombreComercial || null,
            cod_establecimiento: branchRow.codigo_mh || dteJson.emisor?.codEstable || dteJson.emisor?.codEstableMH || null,
            cod_punto_venta: dteJson.emisor?.codPuntoVenta || dteJson.emisor?.codPuntoVentaMH || venta.pos_name || null,
            tipo_establecimiento: branchRow.tipo_establecimiento || dteJson.emisor?.tipoEstablecimiento || null,
            es_casa_matriz: branchRow.es_casa_matriz ?? 0,
            nit: companyRow.nit || dteJson.emisor?.nit,
            nrc: companyRow.nrc || dteJson.emisor?.nrc,
            descActividad: emisorDescActividad,
            direccion: branchRow.direccion || dteJson.emisor?.direccion,
            direccion_completa: ubicacionInfo.textoCompleto,
            telefono: branchRow.telefono || branchRow.phone || dteJson.emisor?.telefono || companyRow.telefono || null,
            correo: branchRow.correo || branchRow.email || dteJson.emisor?.correo || companyRow.correo || null,
            sucursal_telefono: branchRow.telefono || branchRow.phone || null,
            sucursal_correo: branchRow.correo || branchRow.email || null,
            departamento_nombre: ubicacionInfo.departamento_nombre,
            municipio_nombre: ubicacionInfo.municipio_nombre,
            logoPath: logoPath
        },
        receptor: {
            nombre: dteJson.receptor?.nombre,
            nit: dteJson.receptor?.nit,
            nrc: dteJson.receptor?.nrc || venta.customer_nrc || null,
            numDocumento: dteJson.receptor?.numDocumento,
            direccion: dteJson.receptor?.direccion,
            codActividad: dteJson.receptor?.codActividad || null,
            descActividad: receptorDescActividad,
            codPais: dteJson.receptor?.codPais || null,
            nombrePais: dteJson.receptor?.nombrePais || null,
        },
        dte: {
            tipoDte: dteJson.identificacion?.tipoDte,
            tipoDteNombre: getDteTypeName(dteJson.identificacion?.tipoDte),
            codigoGeneracion: dteJson.identificacion?.codigoGeneracion,
            numeroControl: dteJson.identificacion?.numeroControl,
            selloRecepcion: venta.sello_recepcion,
            ambiente: dteJson.identificacion?.ambiente,
            tipoModelo: dteJson.identificacion?.tipoModelo,
            tipoOperacion: dteJson.identificacion?.tipoOperacion
        },
        venta: {
            fecha_emision: dteJson.identificacion?.fecEmi,
            hora_emision: dteJson.identificacion?.horEmi,
            condicion_operacion: dteJson.resumen?.condicionOperacion || 1,
            subtotal_ventas: dteJson.resumen?.subTotalVentas || dteJson.resumen?.totalGravada || 0,
            total_gravado: dteJson.resumen?.totalGravada || dteJson.resumen?.totalSujetoRetencion || 0,
            total_exento: dteJson.resumen?.totalExenta || 0,
            total_nosujetas: dteJson.resumen?.totalNoSuj || 0,
            total_iva: dteJson.resumen?.totalIva || dteJson.resumen?.totalIvaRetenido || dteJson.resumen?.totalIVAretenido || (dteJson.resumen?.tributos ? dteJson.resumen?.tributos.find(t => t.codigo === '20')?.valor : 0) || 0,
            total_descuento: dteJson.resumen?.totalDescu ?? dteJson.resumen?.descuGravada ?? venta.descuento_general ?? 0,
            descuento_general: dteJson.resumen?.descuGravada ?? venta.descuento_general ?? 0,
            porcentaje_descuento: dteJson.resumen?.porcentajeDescuento ?? 0,
            subtotal: dteJson.resumen?.subTotal ?? 0,
            total_pagar: dteJson.resumen?.totalPagar || dteJson.resumen?.totalIvaRetenido || dteJson.resumen?.totalIVAretenido || parseFloat(venta.total_pagar) || 0,
            total_letras: dteJson.resumen?.totalLetras || dteJson.resumen?.totalIVAretenidoLetras || '',
            fovial: parseFloat(venta.fovial) || 0,
            cotrans: parseFloat(venta.cotrans) || 0,
            tributos: dteJson.resumen?.tributos || [],
            totalSujetoRetencion: dteJson.resumen?.totalSujetoRetencion || 0,
            totalIVAretenido: dteJson.resumen?.totalIvaRetenido || dteJson.resumen?.totalIVAretenido || 0,
            totalIvaRetenido: dteJson.resumen?.totalIvaRetenido || dteJson.resumen?.totalIVAretenido || 0,
            total_retencion: dteJson.resumen?.ivaRete || dteJson.resumen?.totalIvaRetenido || 0,
            total_percepcion: dteJson.resumen?.ivaPerci || 0,
        },
        items: (dteJson.cuerpoDocumento || []).map(item => ({
            cantidad: item.cantidad || 1,
            descripcion: item.descripcion || '',
            precioUnitario: item.precioUni || item.montoSujetoGrav || 0,
            montoDescuento: item.montoDescu || 0,
            totalItem: item.ventaGravada || item.montoSujetoGrav || 0,
            montoSujetoGrav: item.montoSujetoGrav || item.ventaGravada || 0,
            uniMedida: item.uniMedida || 59,
            tipoDte: item.tipoDte || null,
            tipoGeneracion: item.tipoGeneracion || null,
            numDocumento: item.numeroDocumento || item.numDocumento || null,
            numeroDocumento: item.numeroDocumento || item.numDocumento || null,
            fechaEmision: item.fechaEmision || item.emissionDate || item.fecEmi || null,
            ivaRetenido: item.ivaRetenido || 0,
            codigoRetencionMH: item.codigoRetencionMH || null,
            tributos: item.tributos || null,
        }))
    };

    reportData.isVoided = ['anulado', 'invalidado'].includes((venta.estado || '').toLowerCase()) ||
                          ['anulado', 'invalidado'].includes((venta.sale_estado || '').toLowerCase()) ||
                          venta.dte_status === 'INVALIDADO';

    return await pdfService.generateRTEE(reportData);
};

const exportRTEE = async (req, res) => {
    const { id } = req.params;

    try {
        const pdfBuffer = await getSaleRTEEPdfBuffer(id, req.company_id);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=RTEE-${id}.pdf`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[ExportRTEE] Error:', error);
        res.status(500).json({ message: 'Error al generar Representación Gráfica (RTEE)', error: error.message });
    }
};

const getPublicRTEE = async (req, res) => {
    const { codigo } = req.params;

    try {
        // 1. Obtener datos detallados de la venta y DTE por codigo_generacion
        const [header] = await pool.query(
            `SELECT h.*,             s.nombre as seller_name, p.nombre as pos_name, c.nombre as customer_name, c.correo as customer_email,
            c.nrc as customer_nrc,
            d.status as dte_status, d.numero_control as dte_control, d.respuesta_hacienda, d.respuesta_hacienda as dte_error,
            d.json_original, d.sello_recepcion, d.fh_procesamiento
            FROM sales_headers h
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN sellers s ON h.seller_id = s.id
            LEFT JOIN points_of_sale p ON h.pos_id = p.id
            LEFT JOIN dtes d ON h.codigo_generacion = d.codigo_generacion
            WHERE h.codigo_generacion = ?`, [codigo]);

        if (header.length === 0) {
            return res.status(404).json({ message: 'Documento no encontrado' });
        }

        const venta = header[0];
        
        let dteJson = venta.json_original;
        if (typeof dteJson === 'string') {
            try { dteJson = JSON.parse(dteJson); } catch (e) {
                return res.status(500).json({ message: 'Error al procesar el JSON del DTE' });
            }
        }

        if (!dteJson) {
            return res.status(400).json({ message: 'Este documento no tiene un DTE asociado' });
        }

        // 2. Obtener datos del emisor usando el company_id de la venta
        const [company] = await pool.query('SELECT * FROM companies WHERE id = ?', [venta.company_id]);
        const [branch] = await pool.query('SELECT * FROM branches WHERE id = ?', [venta.branch_id]);

        const branchRow = branch[0] || {};
        const companyRow = company[0] || {};

        // --- Lógica de Logo Robusta sin préstamos entre sucursales ---
        const logoPath = await resolveRTEELogo(venta.company_id, venta.branch_id, branchRow.logo_url, companyRow.logo_url);

        // Resolver ubicación detallada de la sucursal (dirección, distrito, municipio, departamento)
        const depCode = branchRow.departamento || dteJson.emisor?.direccion?.departamento || companyRow.departamento;
        const munCode = branchRow.municipio || dteJson.emisor?.direccion?.municipio || companyRow.municipio;
        const distCode = branchRow.distrito || dteJson.emisor?.direccion?.distrito;
        const dirComplemento = branchRow.direccion || dteJson.emisor?.direccion?.complemento || dteJson.emisor?.direccion || '';

        const [emisorDescActividad, receptorDescActividad, ubicacionInfo] = await Promise.all([
            resolveActividadOficial(dteJson.emisor?.codActividad, dteJson.emisor?.descActividad),
            resolveActividadOficial(dteJson.receptor?.codActividad, dteJson.receptor?.descActividad),
            resolveUbicacionCompleta(depCode, munCode, distCode, dirComplemento)
        ]);

        const reportData = {
            emisor: {
                nombre: companyRow.razon_social || companyRow.nombre || dteJson.emisor?.nombre,
                razon_social: companyRow.razon_social || companyRow.nombre || dteJson.emisor?.nombre,
                nombre_comercial: companyRow.nombre_comercial || dteJson.emisor?.nombreComercial || null,
                sucursal_nombre: branchRow.nombre || dteJson.emisor?.nombreComercial || null,
                cod_establecimiento: branchRow.codigo_mh || dteJson.emisor?.codEstable || dteJson.emisor?.codEstableMH || null,
                cod_punto_venta: dteJson.emisor?.codPuntoVenta || dteJson.emisor?.codPuntoVentaMH || venta.pos_name || null,
                tipo_establecimiento: branchRow.tipo_establecimiento || dteJson.emisor?.tipoEstablecimiento || null,
                es_casa_matriz: branchRow.es_casa_matriz ?? 0,
                nit: companyRow.nit || dteJson.emisor?.nit,
                nrc: companyRow.nrc || dteJson.emisor?.nrc,
                descActividad: emisorDescActividad,
                direccion: branchRow.direccion || dteJson.emisor?.direccion,
                direccion_completa: ubicacionInfo.textoCompleto,
                telefono: branchRow.telefono || branchRow.phone || dteJson.emisor?.telefono || companyRow.telefono || null,
                correo: branchRow.correo || branchRow.email || dteJson.emisor?.correo || companyRow.correo || null,
                sucursal_telefono: branchRow.telefono || branchRow.phone || null,
                sucursal_correo: branchRow.correo || branchRow.email || null,
                departamento_nombre: ubicacionInfo.departamento_nombre,
                municipio_nombre: ubicacionInfo.municipio_nombre,
                logoPath: logoPath
            },
            receptor: {
                nombre: dteJson.receptor.nombre,
                nit: dteJson.receptor.nit,
                nrc: dteJson.receptor.nrc || venta.customer_nrc || null,
                numDocumento: dteJson.receptor.numDocumento,
                direccion: dteJson.receptor.direccion,
                codActividad: dteJson.receptor.codActividad || null,
                descActividad: receptorDescActividad,
                codPais: dteJson.receptor.codPais || null,
                nombrePais: dteJson.receptor.nombrePais || null,
            },
            dte: {
                tipoDte: dteJson.identificacion.tipoDte,
                tipoDteNombre: getDteTypeName(dteJson.identificacion.tipoDte),
                codigoGeneracion: dteJson.identificacion.codigoGeneracion,
                numeroControl: dteJson.identificacion.numeroControl,
                selloRecepcion: venta.sello_recepcion,
                ambiente: dteJson.identificacion.ambiente,
                tipoModelo: dteJson.identificacion.tipoModelo,
                tipoOperacion: dteJson.identificacion.tipoOperacion
            },
            venta: {
                fecha_emision: dteJson.identificacion.fecEmi,
                hora_emision: dteJson.identificacion.horEmi,
                condicion_operacion: dteJson.resumen.condicionOperacion || 1,
                subtotal_ventas: dteJson.resumen.subTotalVentas || dteJson.resumen.totalGravada || 0,
                total_gravado: dteJson.resumen.totalGravada || dteJson.resumen.totalSujetoRetencion || 0,
                total_exento: dteJson.resumen.totalExenta || 0,
                total_nosujetas: dteJson.resumen.totalNoSuj || 0,
                total_iva: dteJson.resumen.totalIva || dteJson.resumen.totalIvaRetenido || dteJson.resumen.totalIVAretenido || (dteJson.resumen.tributos ? dteJson.resumen.tributos.find(t => t.codigo === '20')?.valor : 0) || 0,
                total_descuento: dteJson.resumen.totalDescu ?? dteJson.resumen.descuGravada ?? venta.descuento_general ?? 0,
                descuento_general: dteJson.resumen.descuGravada ?? venta.descuento_general ?? 0,
                porcentaje_descuento: dteJson.resumen.porcentajeDescuento ?? 0,
                subtotal: dteJson.resumen.subTotal ?? 0,
                total_pagar: dteJson.resumen.totalPagar || dteJson.resumen.totalIvaRetenido || dteJson.resumen.totalIVAretenido || parseFloat(venta.total_pagar) || 0,
                total_letras: dteJson.resumen.totalLetras || dteJson.resumen.totalIVAretenidoLetras || '',
                fovial: parseFloat(venta.fovial) || 0,
                cotrans: parseFloat(venta.cotrans) || 0,
                tributos: dteJson.resumen.tributos || [],
                totalSujetoRetencion: dteJson.resumen.totalSujetoRetencion || 0,
                totalIVAretenido: dteJson.resumen.totalIvaRetenido || dteJson.resumen.totalIVAretenido || 0,
                totalIvaRetenido: dteJson.resumen.totalIvaRetenido || dteJson.resumen.totalIVAretenido || 0,
                total_retencion: dteJson.resumen.ivaRete || dteJson.resumen.totalIvaRetenido || 0,
                total_percepcion: dteJson.resumen.ivaPerci || 0,
            },
            items: (dteJson.cuerpoDocumento || []).map(item => ({
                cantidad: item.cantidad || 1,
                descripcion: item.descripcion || '',
                precioUnitario: item.precioUni || item.montoSujetoGrav || 0,
                montoDescuento: item.montoDescu || 0,
                totalItem: item.ventaGravada || item.montoSujetoGrav || 0,
                montoSujetoGrav: item.montoSujetoGrav || item.ventaGravada || 0,
                uniMedida: item.uniMedida || 59,
                tipoDte: item.tipoDte || null,
                tipoGeneracion: item.tipoGeneracion || null,
                numDocumento: item.numeroDocumento || item.numDocumento || null,
                numeroDocumento: item.numeroDocumento || item.numDocumento || null,
                fechaEmision: item.fechaEmision || item.emissionDate || item.fecEmi || null,
                ivaRetenido: item.ivaRetenido || 0,
                codigoRetencionMH: item.codigoRetencionMH || null,
                tributos: item.tributos || null,
            }))
        };

        reportData.isVoided = ['anulado', 'invalidado'].includes((venta.estado || '').toLowerCase()) ||
                              venta.dte_status === 'INVALIDADO';

        const pdfBuffer = await pdfService.generateRTEE(reportData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=DTE-${codigo}.pdf`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[GetPublicRTEE] Error:', error);
        res.status(500).json({ message: 'Error al generar Representación Gráfica (RTEE)', error: error.message });
    }
};

const getPublicDTEInfo = async (req, res) => {
    const { codigo } = req.params;
    try {
        const [dte] = await pool.query(
            `SELECT d.tipo_dte, d.numero_control, d.status, d.ambiente, d.sello_recepcion, d.fh_procesamiento,
                    h.fecha_emision, h.total_pagar,
                    comp.razon_social as company_name,
                    b.nombre as branch_name,
                    COALESCE(c.nombre, h.cliente_nombre, 'Consumidor Final') as receptor_nombre,
                    c.nit as receptor_nit, c.nrc as receptor_nrc,
                    COALESCE(NULLIF(TRIM(cb.direccion), ''), c.direccion) as receptor_direccion
             FROM dtes d
             LEFT JOIN sales_headers h ON d.codigo_generacion = h.codigo_generacion
             LEFT JOIN companies comp ON h.company_id = comp.id
             LEFT JOIN branches b ON h.branch_id = b.id
             LEFT JOIN customers c ON h.customer_id = c.id
             LEFT JOIN customer_branches cb ON h.customer_branch_id = cb.id
             WHERE d.codigo_generacion = ?`,
            [codigo]
        );
        if (dte.length === 0) {
            return res.status(404).json({ encontrado: false, message: 'DTE no encontrado' });
        }
        res.json({ encontrado: true, ...dte[0] });
    } catch (error) {
        console.error('[GetPublicDTEInfo] Error:', error);
        res.status(500).json({ message: 'Error al obtener información del DTE' });
    }
};

const getPublicDTEJson = async (req, res) => {
    const { codigo } = req.params;
    try {
        const [dte] = await pool.query(
            'SELECT json_original, numero_control FROM dtes WHERE codigo_generacion = ?',
            [codigo]
        );
        if (dte.length === 0) {
            return res.status(404).json({ message: 'DTE no encontrado' });
        }
        const json = typeof dte[0].json_original === 'string' ? JSON.parse(dte[0].json_original) : dte[0].json_original;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=DTE-${dte[0].numero_control}.json`);
        res.json(json);
    } catch (error) {
        console.error('[GetPublicDTEJson] Error:', error);
        res.status(500).json({ message: 'Error al obtener JSON del DTE' });
    }
};

const sendPublicDTEEmail = async (req, res) => {
    const { codigo } = req.params;
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'El correo electrónico es requerido' });
    }

    try {
        const [rows] = await pool.query(
            `SELECT h.*, d.status as dte_status, d.json_original, d.sello_recepcion, d.numero_control,
                    c.razon_social as company_name, c.nit as company_nit, c.nrc as company_nrc, c.logo_url as company_logo_url,
                    c.departamento as company_dep, c.municipio as company_mun,
                    cu.nrc as customer_nrc,
                    b.nombre as branch_name, b.codigo_mh as branch_codigo_mh, b.es_casa_matriz, b.tipo_establecimiento as branch_tipo_est,
                    b.telefono as branch_telefono, b.correo as branch_correo, b.logo_url as branch_logo_url,
                    b.direccion as branch_dir, b.departamento as branch_dep, b.municipio as branch_mun, b.distrito as branch_dist,
                    cat.description as tipo_documento_name
             FROM dtes d
             JOIN sales_headers h ON d.codigo_generacion = h.codigo_generacion
             JOIN companies c ON h.company_id = c.id
             JOIN branches b ON h.branch_id = b.id
             LEFT JOIN customers cu ON h.customer_id = cu.id
             LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento = cat.code
             WHERE d.codigo_generacion = ?`,
            [codigo]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'DTE no encontrado' });
        }

        const venta = rows[0];
        const dteJson = typeof venta.json_original === 'string' ? JSON.parse(venta.json_original) : venta.json_original;

        if (!dteJson) {
            return res.status(400).json({ message: 'El DTE no tiene JSON original' });
        }

        const logoPath = await resolveRTEELogo(venta.company_id, venta.branch_id, venta.branch_logo_url, venta.company_logo_url);

        const depCode = venta.branch_dep || dteJson.emisor?.direccion?.departamento || venta.company_dep;
        const munCode = venta.branch_mun || dteJson.emisor?.direccion?.municipio || venta.company_mun;
        const distCode = venta.branch_dist || dteJson.emisor?.direccion?.distrito;
        const dirComplemento = venta.branch_dir || dteJson.emisor?.direccion?.complemento || dteJson.emisor?.direccion || '';

        const ubicacionInfo = await resolveUbicacionCompleta(depCode, munCode, distCode, dirComplemento);

        const dteNames = {
            '01': 'Factura', '03': 'Crédito Fiscal', '04': 'Nota de Remisión',
            '05': 'Nota de Crédito', '06': 'Nota de Débito', '07': 'Comprobante de Retención',
            '08': 'Comprobante de Liquidación', '09': 'Documento Contable de Liquidación',
            '11': 'Factura de Exportación', '14': 'Factura de Sujeto Excluido', '15': 'Comprobante de Donación'
        };
        const tipoNombre = dteNames[venta.tipo_documento] || 'Documento Tributario';

        const reportData = {
            emisor: {
                nombre: venta.company_name,
                razon_social: venta.company_name,
                nombre_comercial: dteJson.emisor?.nombreComercial || null,
                sucursal_nombre: venta.branch_name || dteJson.emisor?.nombreComercial || null,
                cod_establecimiento: venta.branch_codigo_mh || dteJson.emisor?.codEstable || dteJson.emisor?.codEstableMH || null,
                cod_punto_venta: dteJson.emisor?.codPuntoVenta || dteJson.emisor?.codPuntoVentaMH || null,
                tipo_establecimiento: venta.branch_tipo_est || dteJson.emisor?.tipoEstablecimiento || null,
                es_casa_matriz: venta.es_casa_matriz ?? 0,
                nit: venta.company_nit,
                nrc: venta.company_nrc,
                descActividad: dteJson.emisor?.descActividad,
                direccion: venta.branch_dir || dteJson.emisor?.direccion,
                direccion_completa: ubicacionInfo.textoCompleto,
                telefono: venta.branch_telefono || dteJson.emisor?.telefono || venta.company_telefono,
                correo: venta.branch_correo || dteJson.emisor?.correo || venta.company_correo,
                sucursal_telefono: venta.branch_telefono || null,
                sucursal_correo: venta.branch_correo || null,
                departamento_nombre: ubicacionInfo.departamento_nombre,
                municipio_nombre: ubicacionInfo.municipio_nombre,
                logoPath: logoPath
            },
            receptor: {
                nombre: dteJson.receptor?.nombre,
                nit: dteJson.receptor?.nit,
                nrc: dteJson.receptor?.nrc || venta.customer_nrc || null,
                numDocumento: dteJson.receptor?.numDocumento,
                direccion: dteJson.receptor?.direccion
            },
            dte: {
                tipoDte: dteJson.identificacion?.tipoDte,
                tipoDteNombre: tipoNombre,
                codigoGeneracion: dteJson.identificacion?.codigoGeneracion,
                numeroControl: venta.numero_control,
                selloRecepcion: venta.sello_recepcion,
                ambiente: dteJson.identificacion?.ambiente
            },
            venta: {
                fecha_emision: dteJson.identificacion?.fecEmi,
                hora_emision: dteJson.identificacion?.horEmi,
                condicion_operacion: dteJson.resumen?.condicionOperacion || 1,
                subtotal_ventas: dteJson.resumen?.subTotalVentas || dteJson.resumen?.totalGravada || 0,
                total_gravado: dteJson.resumen?.totalGravada || dteJson.resumen?.totalSujetoRetencion || 0,
                total_exento: dteJson.resumen?.totalExenta || 0,
                total_nosujetas: dteJson.resumen?.totalNoSuj || 0,
                total_iva: dteJson.resumen?.totalIva || dteJson.resumen?.totalIvaRetenido || dteJson.resumen?.totalIVAretenido || (dteJson.resumen?.tributos?.find(t => t.codigo === '20')?.valor || 0),
                total_descuento: dteJson.resumen?.totalDescu ?? dteJson.resumen?.descuGravada ?? venta.descuento_general ?? 0,
                descuento_general: dteJson.resumen?.descuGravada ?? venta.descuento_general ?? 0,
                porcentaje_descuento: dteJson.resumen?.porcentajeDescuento ?? 0,
                subtotal: dteJson.resumen?.subTotal ?? 0,
                total_pagar: dteJson.resumen?.totalPagar || dteJson.resumen?.totalIvaRetenido || dteJson.resumen?.totalIVAretenido || parseFloat(venta.total_pagar) || 0,
                total_letras: dteJson.resumen?.totalLetras || dteJson.resumen?.totalIVAretenidoLetras || '',
                fovial: parseFloat(venta.fovial) || 0,
                cotrans: parseFloat(venta.cotrans) || 0,
                tributos: dteJson.resumen?.tributos || [],
                totalSujetoRetencion: dteJson.resumen?.totalSujetoRetencion || 0,
                totalIVAretenido: dteJson.resumen?.totalIvaRetenido || dteJson.resumen?.totalIVAretenido || 0,
                totalIvaRetenido: dteJson.resumen?.totalIvaRetenido || dteJson.resumen?.totalIVAretenido || 0,
                total_retencion: dteJson.resumen?.ivaRete || dteJson.resumen?.totalIvaRetenido || 0,
                total_percepcion: dteJson.resumen?.ivaPerci || 0
            },
            items: (dteJson.cuerpoDocumento || []).map(item => ({
                cantidad: item.cantidad || 1,
                descripcion: item.descripcion || '',
                precioUnitario: item.precioUni || item.montoSujetoGrav || 0,
                montoDescuento: item.montoDescu || 0,
                totalItem: item.ventaGravada || item.montoSujetoGrav || 0,
                montoSujetoGrav: item.montoSujetoGrav || item.ventaGravada || 0,
                uniMedida: item.uniMedida || 59,
                tipoDte: item.tipoDte || null,
                tipoGeneracion: item.tipoGeneracion || null,
                numDocumento: item.numeroDocumento || item.numDocumento || null,
                numeroDocumento: item.numeroDocumento || item.numDocumento || null,
                fechaEmision: item.fechaEmision || item.emissionDate || item.fecEmi || null,
                ivaRetenido: item.ivaRetenido || 0,
                codigoRetencionMH: item.codigoRetencionMH || null,
                tributos: item.tributos || null,
            })),
            isVoided: (venta.estado || '').toLowerCase() === 'anulado' || venta.dte_status === 'INVALIDADO'
        };

        const pdfBuffer = await pdfService.generateRTEE(reportData);

        const smtp = await mailerService.getSMTPSettings(venta.branch_id, venta.company_id);
        const transporter = mailerService.createTransporter(smtp);

        await transporter.sendMail({
            from: `"${smtp.from_name}" <${smtp.from_email}>`,
            to: email,
            subject: `${tipoNombre} Electrónica - ${venta.company_name}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 12px; max-width: 600px; margin: auto;">
                    <h2 style="color: #4f46e5; text-align: center;">Su documento electrónico está listo</h2>
                    <p>Estimado(a) <b>${dteJson.receptor?.nombre || 'cliente'}</b>,</p>
                    <p>Adjunto encontrará su <b>${tipoNombre}</b> electrónica con número de control <b>${venta.numero_control}</b>.</p>
                    <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0; text-align: center;">
                        <span style="font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase;">Total a Pagar</span>
                        <div style="font-size: 24px; font-weight: 800; color: #1e293b;">$${parseFloat(venta.total_pagar).toFixed(2)}</div>
                    </div>
                    <p style="font-size: 13px; color: #666;">Se incluyen dos archivos: la representación gráfica (PDF) y el archivo de datos (JSON) para su registro legal.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 11px; color: #94a3b8; text-align: center;">Este es un mensaje automático de ${venta.company_name}.</p>
                </div>
            `,
            attachments: [
                { filename: `DTE-${venta.numero_control}.pdf`, content: pdfBuffer },
                { filename: `DTE-${venta.numero_control}.json`, content: JSON.stringify(dteJson, null, 2) }
            ]
        });

        res.json({ success: true, message: 'Correo enviado correctamente' });
    } catch (error) {
        console.error('[SendPublicDTEEmail] Error:', error);
        res.status(500).json({ message: 'Error al enviar correo', error: error.message });
    }
};

/**
 * Cambia el turno (pos_shift) de una o varias ventas con DTE emitido.
 */

module.exports = {
    getSalesByCategory,
    exportSalesByCategoryPDF,
    getDailySales,
    exportDailySalesPDF,
    exportSalesByCustomerPDF,
    getSalesReportPDF,
    getSalesByPOS,
    exportSalesByPOSPDF,
    exportSalesDetailPDF,
    getSalesDiscountsData,
    exportSalesDiscountsReport,
    exportRTEE,
    getSaleRTEEPdfBuffer,
    getPublicRTEE,
    getPublicDTEInfo,
    getPublicDTEJson,
    sendPublicDTEEmail
};
