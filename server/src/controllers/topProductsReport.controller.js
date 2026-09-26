const pool = require('../config/db');
const excelService = require('../services/excel.service');
const reportPdfHelper = require('../utils/reportPdfHelper');

/**
 * Formatea fechas a formato DD/MM/YYYY
 */
const formatDDMMYYYY = (dateStr) => {
    if (!dateStr) return '---';
    const parts = String(dateStr).split('T')[0].split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

/**
 * Procesa y obtiene la información de los top productos por categoría
 */
const fetchTopProductsByCategoryData = async ({
    companyId,
    branchId,
    categoryId,
    categoryIds,
    startDate,
    endDate,
    limit = 10,
    orderBy = 'cantidad'
}) => {
    // 1. Obtener datos de la empresa
    const company = await reportPdfHelper.getCompanyInfo(companyId);

    // 2. Nombre de la sucursal
    let branchName = 'Todas las sucursales';
    if (branchId && branchId !== 'all') {
        const [branches] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branchId]);
        branchName = branches[0]?.nombre || '---';
    }

    // 3. Procesar categorías seleccionadas (soporta ID individual o múltiples IDs)
    let targetCategoryIds = [];
    if (categoryIds) {
        if (Array.isArray(categoryIds)) {
            targetCategoryIds = categoryIds.map(Number).filter(n => !isNaN(n) && n > 0);
        } else if (typeof categoryIds === 'string' && categoryIds !== 'all') {
            targetCategoryIds = categoryIds.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0);
        }
    } else if (categoryId && categoryId !== 'all') {
        const parsed = Number(categoryId);
        if (!isNaN(parsed) && parsed > 0) {
            targetCategoryIds = [parsed];
        }
    }

    let selectedCategoryName = 'Todas las categorías';
    if (targetCategoryIds.length === 1) {
        const [cats] = await pool.query('SELECT name FROM product_categories WHERE id = ?', [targetCategoryIds[0]]);
        selectedCategoryName = cats[0]?.name || '---';
    } else if (targetCategoryIds.length > 1) {
        selectedCategoryName = `${targetCategoryIds.length} categorías seleccionadas`;
    }

    // 4. Determinar ordenamiento para el ranking (ROW_NUMBER)
    let orderExpression = 'cantidad_vendida DESC, venta_neta DESC';
    if (orderBy === 'venta_neta') {
        orderExpression = 'venta_neta DESC, cantidad_vendida DESC';
    } else if (orderBy === 'utilidad') {
        orderExpression = 'utilidad_bruta DESC, venta_neta DESC';
    }

    // 5. Configurar límites
    const parsedLimit = (limit === 'all' || limit === 0 || !limit) ? 0 : parseInt(limit, 10);

    // 6. Construir cláusulas WHERE
    let whereClauses = [
        'sh.company_id = ?',
        "LOWER(sh.estado) = 'emitido'",
        'DATE(sh.fecha_emision) >= ?',
        'DATE(sh.fecha_emision) <= ?',
        'NOT EXISTS (SELECT 1 FROM dtes d WHERE d.venta_id = sh.id AND d.status = \'INVALIDADO\')'
    ];
    let queryParams = [companyId, startDate, endDate];

    if (branchId && branchId !== 'all') {
        whereClauses.push('sh.branch_id = ?');
        queryParams.push(branchId);
    }

    if (targetCategoryIds.length > 0) {
        whereClauses.push('p.category_id IN (?)');
        queryParams.push(targetCategoryIds);
    }

    // Parámetros para el filtro de ranking: (parsedLimit = 0 OR rank_num <= parsedLimit)
    const sqlParams = [...queryParams, parsedLimit, parsedLimit];

    const sqlQuery = `
        WITH ProductSalesAgg AS (
            SELECT 
                COALESCE(p.id, si.product_id, 0) AS product_id,
                COALESCE(p.codigo, si.codigo, '---') AS codigo,
                COALESCE(p.nombre, si.descripcion, 'PRODUCTO S/N') AS descripcion,
                COALESCE(p.costo, 0) AS costo_unitario,
                COALESCE(c.id, 0) AS category_id,
                COALESCE(c.name, 'SIN CATEGORÍA') AS category_name,
                SUM(si.cantidad) AS cantidad_vendida,
                SUM(si.cantidad * si.precio_unitario - COALESCE(si.monto_descuento, 0)) AS venta_neta
            FROM sales_items si
            JOIN sales_headers sh ON si.sale_id = sh.id
            LEFT JOIN products p ON si.product_id = p.id
            LEFT JOIN product_categories c ON p.category_id = c.id
            WHERE ${whereClauses.join(' AND ')}
            GROUP BY 
                COALESCE(p.id, si.product_id, 0),
                COALESCE(p.codigo, si.codigo, '---'),
                COALESCE(p.nombre, si.descripcion, 'PRODUCTO S/N'),
                COALESCE(p.costo, 0),
                COALESCE(c.id, 0),
                COALESCE(c.name, 'SIN CATEGORÍA')
        ),
        CalculatedProducts AS (
            SELECT 
                product_id,
                codigo,
                descripcion,
                costo_unitario,
                category_id,
                category_name,
                cantidad_vendida,
                venta_neta,
                (cantidad_vendida * costo_unitario) AS costo_total,
                (venta_neta - (cantidad_vendida * costo_unitario)) AS utilidad_bruta,
                CASE 
                    WHEN cantidad_vendida > 0 THEN (venta_neta / cantidad_vendida)
                    ELSE 0 
                END AS precio_promedio,
                CASE 
                    WHEN venta_neta > 0 THEN ((venta_neta - (cantidad_vendida * costo_unitario)) / venta_neta) * 100
                    ELSE 0 
                END AS margen_pct,
                ROW_NUMBER() OVER (
                    PARTITION BY category_id 
                    ORDER BY ${orderExpression}
                ) AS rank_num
            FROM ProductSalesAgg
        )
        SELECT *
        FROM CalculatedProducts
        WHERE (? = 0 OR rank_num <= ?)
        ORDER BY category_name ASC, rank_num ASC;
    `;

    const [rawRows] = await pool.query(sqlQuery, sqlParams);

    // 7. Agrupar por categoría y calcular subtotales
    const categoriesMap = new Map();
    let grandTotalCantidad = 0;
    let grandTotalVentaNeta = 0;
    let grandTotalCostoTotal = 0;
    let grandTotalUtilidadBruta = 0;
    let totalProductsCount = 0;

    for (const row of rawRows) {
        const catKey = row.category_id || 0;
        if (!categoriesMap.has(catKey)) {
            categoriesMap.set(catKey, {
                category_id: row.category_id,
                category_name: row.category_name,
                items: [],
                totals: {
                    cantidad: 0,
                    costo_total: 0,
                    venta_neta: 0,
                    utilidad_bruta: 0,
                    margen_pct: 0
                }
            });
        }

        const catGroup = categoriesMap.get(catKey);
        const cant = Number(row.cantidad_vendida) || 0;
        const vNeta = Number(row.venta_neta) || 0;
        const cTotal = Number(row.costo_total) || 0;
        const util = Number(row.utilidad_bruta) || 0;
        const cUnit = Number(row.costo_unitario) || 0;
        const pProm = Number(row.precio_promedio) || 0;
        const mPct = Number(row.margen_pct) || 0;

        const formattedItem = {
            product_id: row.product_id,
            rank_num: row.rank_num,
            codigo: row.codigo,
            descripcion: row.descripcion,
            category_id: row.category_id,
            category_name: row.category_name,
            costo_unitario: cUnit,
            precio_promedio: pProm,
            cantidad_vendida: cant,
            venta_neta: vNeta,
            costo_total: cTotal,
            utilidad_bruta: util,
            margen_pct: mPct,
            has_cost: cUnit > 0
        };

        catGroup.items.push(formattedItem);
        catGroup.totals.cantidad += cant;
        catGroup.totals.venta_neta += vNeta;
        catGroup.totals.costo_total += cTotal;
        catGroup.totals.utilidad_bruta += util;
    }

    const categories = Array.from(categoriesMap.values()).map(cat => {
        cat.totals.margen_pct = cat.totals.venta_neta > 0
            ? (cat.totals.utilidad_bruta / cat.totals.venta_neta) * 100
            : 0;

        grandTotalCantidad += cat.totals.cantidad;
        grandTotalVentaNeta += cat.totals.venta_neta;
        grandTotalCostoTotal += cat.totals.costo_total;
        grandTotalUtilidadBruta += cat.totals.utilidad_bruta;
        totalProductsCount += cat.items.length;

        return cat;
    });

    const grandTotalMargenPct = grandTotalVentaNeta > 0
        ? (grandTotalUtilidadBruta / grandTotalVentaNeta) * 100
        : 0;

    let orderLabel = 'Mayor Volumen Vendido (Unidades)';
    if (orderBy === 'venta_neta') orderLabel = 'Mayor Facturación Neta ($)';
    if (orderBy === 'utilidad') orderLabel = 'Mayor Utilidad Bruta ($)';

    return {
        company,
        company_name: company.razon_social,
        company_nit: company.nit,
        company_nrc: company.nrc,
        branch_name: branchName,
        selectedCategoryName,
        startDateFormatted: formatDDMMYYYY(startDate),
        endDateFormatted: formatDDMMYYYY(endDate),
        startDate,
        endDate,
        limit: parsedLimit === 0 ? 'Todos' : parsedLimit,
        orderBy,
        orderLabel,
        categories,
        totals: {
            categories_count: categories.length,
            products_count: totalProductsCount,
            cantidad: grandTotalCantidad,
            costo_total: grandTotalCostoTotal,
            venta_neta: grandTotalVentaNeta,
            utilidad_bruta: grandTotalUtilidadBruta,
            margen_pct: grandTotalMargenPct
        }
    };
};

/**
 * Renderiza el reporte en PDF siguiendo estrictamente REPORT_DESIGN_RULES.md
 */
const renderTopProductsPDF = (doc, reportData) => {
    const pageWidth = 792;
    const pageHeight = 612;
    const startX = 30;
    const contentWidth = pageWidth - 60; // 732 pt

    // Definición de columnas exactamente alineadas (total = 732 pt)
    const cols = {
        rank: { x: 30, width: 25, align: 'center', label: '#' },
        codigo: { x: 55, width: 75, align: 'left', label: 'CÓDIGO' },
        descripcion: { x: 130, width: 190, align: 'left', label: 'DESCRIPCIÓN DEL PRODUCTO' },
        cantidad: { x: 320, width: 55, align: 'right', label: 'CANT.' },
        precio: { x: 375, width: 57, align: 'right', label: 'P. PROM.' },
        costoUnit: { x: 432, width: 55, align: 'right', label: 'COSTO U.' },
        ventaNeta: { x: 487, width: 65, align: 'right', label: 'VENTA NETA' },
        costoTotal: { x: 552, width: 65, align: 'right', label: 'COSTO TOT.' },
        utilidad: { x: 617, width: 65, align: 'right', label: 'UTILIDAD' },
        margen: { x: 682, width: 50, align: 'right', label: 'MARGEN' }
    };

    const periodText = `DEL ${reportData.startDateFormatted} AL ${reportData.endDateFormatted}`;
    const catSubtitle = (reportData.selectedCategoryName && reportData.selectedCategoryName !== 'Todas las categorías')
        ? `  |  CATEGORÍAS: ${reportData.selectedCategoryName.toUpperCase()}`
        : '';
    const subtitle = `SUCURSAL: ${reportData.branch_name}${catSubtitle}  |  RANKING: TOP ${reportData.limit} POR ${reportData.orderLabel.toUpperCase()}`;

    // 1. Encabezado principal
    reportPdfHelper.renderHeader(doc, reportData.company, 'TOP PRODUCTOS MÁS VENDIDOS POR CATEGORÍA', periodText, 'landscape', subtitle);

    const renderTableHeader = (currentY) => {
        doc.rect(startX, currentY, contentWidth, 14).fill('#f1f5f9');
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, currentY + 14).lineTo(startX + contentWidth, currentY + 14).stroke();

        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');
        Object.values(cols).forEach(col => {
            doc.text(col.label, col.x, currentY + 3.5, {
                width: col.width,
                align: col.align,
                lineBreak: false
            });
        });

        return currentY + 16;
    };

    let y = doc.y + 4;
    y = renderTableHeader(y);

    if (reportData.categories.length === 0) {
        doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#64748b');
        doc.text('No se encontraron ventas para los filtros seleccionados en el período.', startX, y + 15, {
            align: 'center',
            width: contentWidth
        });
        return;
    }

    reportData.categories.forEach(cat => {
        // Salto de página preventivo antes de banda de categoría
        if (y > 510) {
            doc.addPage();
            reportPdfHelper.renderHeader(doc, reportData.company, 'TOP PRODUCTOS MÁS VENDIDOS POR CATEGORÍA', periodText, 'landscape', subtitle);
            y = renderTableHeader(doc.y + 4);
        }

        // Banda de Cabecera de Categoría
        doc.rect(startX, y, contentWidth, 13).fill('#e2e8f0');
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b');
        doc.text(`CATEGORÍA: ${cat.category_name.toUpperCase()}  (${cat.items.length} productos listados)`, startX + 6, y + 3, {
            lineBreak: false
        });
        y += 15;

        // Filas de productos
        cat.items.forEach((item, index) => {
            if (y > 520) {
                doc.addPage();
                reportPdfHelper.renderHeader(doc, reportData.company, 'TOP PRODUCTOS MÁS VENDIDOS POR CATEGORÍA', periodText, 'landscape', subtitle);
                y = renderTableHeader(doc.y + 4);
                // Reimprimir pequeña banda de categoría si continúa
                doc.rect(startX, y, contentWidth, 12).fill('#f1f5f9');
                doc.fontSize(7).font('Helvetica-Bold').fillColor('#475569');
                doc.text(`... CATEGORÍA: ${cat.category_name.toUpperCase()} (CONTINUACIÓN)`, startX + 6, y + 2.5, { lineBreak: false });
                y += 14;
            }

            // Fondo alterno
            if (index % 2 === 1) {
                doc.rect(startX, y - 1, contentWidth, 12).fill('#f8fafc');
            }

            doc.fontSize(6.5).font('Helvetica').fillColor('#334155');

            // Posición #
            doc.font('Helvetica-Bold').fillColor('#0f172a').text(String(item.rank_num), cols.rank.x, y + 1.5, {
                width: cols.rank.width,
                align: cols.rank.align,
                lineBreak: false
            });

            // Código
            doc.font('Helvetica').fillColor('#475569').text(item.codigo, cols.codigo.x, y + 1.5, {
                width: cols.codigo.width,
                align: cols.codigo.align,
                lineBreak: false
            });

            // Descripción
            doc.fillColor('#0f172a').text(item.descripcion, cols.descripcion.x, y + 1.5, {
                width: cols.descripcion.width,
                align: cols.descripcion.align,
                lineBreak: false
            });

            // Cantidad
            doc.text(Number(item.cantidad_vendida).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }), cols.cantidad.x, y + 1.5, {
                width: cols.cantidad.width,
                align: cols.cantidad.align,
                lineBreak: false
            });

            // Precio promedio
            doc.text(reportPdfHelper.fmt(item.precio_promedio), cols.precio.x, y + 1.5, {
                width: cols.precio.width,
                align: cols.precio.align,
                lineBreak: false
            });

            // Costo unitario
            doc.text(item.has_cost ? reportPdfHelper.fmt(item.costo_unitario) : '$ -', cols.costoUnit.x, y + 1.5, {
                width: cols.costoUnit.width,
                align: cols.costoUnit.align,
                lineBreak: false
            });

            // Venta neta
            doc.font('Helvetica-Bold').fillColor('#0f172a').text(reportPdfHelper.fmt(item.venta_neta), cols.ventaNeta.x, y + 1.5, {
                width: cols.ventaNeta.width,
                align: cols.ventaNeta.align,
                lineBreak: false
            });

            // Costo total
            doc.font('Helvetica').fillColor('#475569').text(item.has_cost ? reportPdfHelper.fmt(item.costo_total) : '$ -', cols.costoTotal.x, y + 1.5, {
                width: cols.costoTotal.width,
                align: cols.costoTotal.align,
                lineBreak: false
            });

            // Utilidad bruta
            const utilColor = item.utilidad_bruta < 0 ? '#b91c1c' : '#047857';
            doc.font('Helvetica-Bold').fillColor(utilColor).text(reportPdfHelper.fmt(item.utilidad_bruta), cols.utilidad.x, y + 1.5, {
                width: cols.utilidad.width,
                align: cols.utilidad.align,
                lineBreak: false
            });

            // Margen %
            doc.fillColor(utilColor).text(`${item.margen_pct.toFixed(2)}%`, cols.margen.x, y + 1.5, {
                width: cols.margen.width,
                align: cols.margen.align,
                lineBreak: false
            });

            y += 12;
        });

        // Fila de Subtotal por Categoría
        if (y > 520) {
            doc.addPage();
            reportPdfHelper.renderHeader(doc, reportData.company, 'TOP PRODUCTOS MÁS VENDIDOS POR CATEGORÍA', periodText, 'landscape', subtitle);
            y = renderTableHeader(doc.y + 4);
        }

        doc.rect(startX, y, contentWidth, 13).fill('#f1f5f9');
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, y + 13).lineTo(startX + contentWidth, y + 13).stroke();

        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#1e293b');
        doc.text(`SUBTOTAL ${cat.category_name.toUpperCase()}:`, cols.codigo.x, y + 3, {
            width: 260,
            align: 'left',
            lineBreak: false
        });

        // Cantidad subtotal
        doc.text(Number(cat.totals.cantidad).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }), cols.cantidad.x, y + 3, {
            width: cols.cantidad.width,
            align: cols.cantidad.align,
            lineBreak: false
        });

        // Venta neta subtotal
        doc.text(reportPdfHelper.fmt(cat.totals.venta_neta), cols.ventaNeta.x, y + 3, {
            width: cols.ventaNeta.width,
            align: cols.ventaNeta.align,
            lineBreak: false
        });

        // Costo total subtotal
        doc.text(reportPdfHelper.fmt(cat.totals.costo_total), cols.costoTotal.x, y + 3, {
            width: cols.costoTotal.width,
            align: cols.costoTotal.align,
            lineBreak: false
        });

        // Utilidad bruta subtotal
        const catUtilColor = cat.totals.utilidad_bruta < 0 ? '#b91c1c' : '#047857';
        doc.fillColor(catUtilColor).text(reportPdfHelper.fmt(cat.totals.utilidad_bruta), cols.utilidad.x, y + 3, {
            width: cols.utilidad.width,
            align: cols.utilidad.align,
            lineBreak: false
        });

        // Margen ponderado subtotal
        doc.fillColor(catUtilColor).text(`${cat.totals.margen_pct.toFixed(2)}%`, cols.margen.x, y + 3, {
            width: cols.margen.width,
            align: cols.margen.align,
            lineBreak: false
        });

        y += 17;
    });

    // 8. CUADRO RESUMEN DE RENTABILIDAD DEL PERÍODO (Tarjeta Final)
    if (y > 430) {
        doc.addPage();
        reportPdfHelper.renderHeader(doc, reportData.company, 'TOP PRODUCTOS MÁS VENDIDOS POR CATEGORÍA', periodText, 'landscape', subtitle);
        y = doc.y + 10;
    } else {
        y += 8;
    }

    const boxWidth = contentWidth;
    const headerHeight = 16;
    const bodyHeight = 50;

    // Encabezado del cuadro resumen
    doc.rect(startX, y, boxWidth, headerHeight).fill('#1e293b');
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff').text(
        'CUADRO RESUMEN DE RENTABILIDAD DEL PERÍODO (TOP PRODUCTOS CLASIFICADOS)',
        startX,
        y + 4.5,
        { align: 'center', width: boxWidth, lineBreak: false }
    );

    // Cuerpo del cuadro resumen
    doc.rect(startX, y + headerHeight, boxWidth, bodyHeight).fill('#f8fafc');
    doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(startX, y + headerHeight, boxWidth, bodyHeight).stroke();

    const colW = boxWidth / 6;
    const rowY1 = y + headerHeight + 8;
    const rowY2 = y + headerHeight + 22;

    const summaryCards = [
        { label: 'CATEGORÍAS', val: String(reportData.totals.categories_count) },
        { label: 'PROD. RANKING', val: String(reportData.totals.products_count) },
        { label: 'UNIDADES VENDIDAS', val: Number(reportData.totals.cantidad).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) },
        { label: 'VENTA NETA TOTAL', val: reportPdfHelper.fmt(reportData.totals.venta_neta) },
        { label: 'COSTO TOTAL (COGS)', val: reportPdfHelper.fmt(reportData.totals.costo_total) },
        { label: 'UTILIDAD BRUTA', val: reportPdfHelper.fmt(reportData.totals.utilidad_bruta), color: reportData.totals.utilidad_bruta < 0 ? '#b91c1c' : '#047857' }
    ];

    summaryCards.forEach((c, i) => {
        const cx = startX + (i * colW);
        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#64748b').text(c.label, cx, rowY1, {
            width: colW,
            align: 'center',
            lineBreak: false
        });
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor(c.color || '#0f172a').text(c.val, cx, rowY2, {
            width: colW,
            align: 'center',
            lineBreak: false
        });
    });

    // Línea de margen efectivo general en la parte inferior de la tarjeta
    const rowY3 = y + headerHeight + 36;
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(startX + 20, rowY3).lineTo(startX + boxWidth - 20, rowY3).stroke();
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#475569');
    doc.text(
        `MARGEN COMERCIAL PONDERADO GLOBAL SOBRE VENTAS: ${reportData.totals.margen_pct.toFixed(2)}%`,
        startX,
        rowY3 + 3,
        { align: 'center', width: boxWidth, lineBreak: false }
    );

    y += headerHeight + bodyHeight + 12;

    // Cierre operacional (Sin firmas)
    reportPdfHelper.renderClosingFooter(doc, startX, y, reportData.totals.products_count, 'Productos en Ranking');

    // Paginación dinámica centrada
    reportPdfHelper.renderPageNumbers(doc);
};

/**
 * GET /api/sales/reports/top-products-by-category
 * Retorna datos JSON estructurados para vista previa en pantalla
 */
exports.getTopProductsByCategoryData = async (req, res) => {
    try {
        const { start_date, end_date, branch_id, category_id, category_ids, limit, order_by } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });
        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Debe especificar start_date y end_date' });
        }

        const data = await fetchTopProductsByCategoryData({
            companyId,
            branchId: branch_id || 'all',
            categoryId: category_id || 'all',
            categoryIds: category_ids || null,
            startDate: start_date,
            endDate: end_date,
            limit: limit || 10,
            orderBy: order_by || 'cantidad'
        });

        res.json(data);
    } catch (error) {
        console.error('Error in getTopProductsByCategoryData:', error);
        res.status(500).json({ message: 'Error al obtener datos de top productos', error: error.message });
    }
};

/**
 * GET /api/sales/reports/top-products-by-category/pdf
 * Exporta el reporte en PDF o Excel (?format=excel)
 */
exports.exportTopProductsByCategory = async (req, res) => {
    try {
        const { start_date, end_date, branch_id, category_id, category_ids, limit, order_by, format } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });
        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Debe especificar start_date y end_date' });
        }

        const reportData = await fetchTopProductsByCategoryData({
            companyId,
            branchId: branch_id || 'all',
            categoryId: category_id || 'all',
            categoryIds: category_ids || null,
            startDate: start_date,
            endDate: end_date,
            limit: limit || 10,
            orderBy: order_by || 'cantidad'
        });

        // 1. Exportación Excel
        if (format === 'excel') {
            const excelRows = [];

            reportData.categories.forEach(cat => {
                cat.items.forEach(item => {
                    excelRows.push({
                        CATEGORIA: cat.category_name,
                        RANKING: item.rank_num,
                        CODIGO: item.codigo,
                        DESCRIPCION: item.descripcion,
                        CANTIDAD: Number(item.cantidad_vendida.toFixed(2)),
                        PRECIO_PROM: Number(item.precio_promedio.toFixed(2)),
                        COSTO_UNIT: item.has_cost ? Number(item.costo_unitario.toFixed(4)) : 0,
                        VENTA_NETA: Number(item.venta_neta.toFixed(2)),
                        COSTO_TOTAL: Number(item.costo_total.toFixed(2)),
                        UTILIDAD_BRUTA: Number(item.utilidad_bruta.toFixed(2)),
                        MARGEN_PCT: `${item.margen_pct.toFixed(2)}%`
                    });
                });

                // Fila de subtotal por categoría
                excelRows.push({
                    CATEGORIA: `SUBTOTAL ${cat.category_name}`,
                    RANKING: '',
                    CODIGO: '',
                    DESCRIPCION: `${cat.items.length} PRODUCTOS`,
                    CANTIDAD: Number(cat.totals.cantidad.toFixed(2)),
                    PRECIO_PROM: '',
                    COSTO_UNIT: '',
                    VENTA_NETA: Number(cat.totals.venta_neta.toFixed(2)),
                    COSTO_TOTAL: Number(cat.totals.costo_total.toFixed(2)),
                    UTILIDAD_BRUTA: Number(cat.totals.utilidad_bruta.toFixed(2)),
                    MARGEN_PCT: `${cat.totals.margen_pct.toFixed(2)}%`
                });
            });

            // Fila de Totales Generales
            excelRows.push({
                CATEGORIA: 'TOTALES GENERALES',
                RANKING: '',
                CODIGO: '',
                DESCRIPCION: `${reportData.totals.products_count} PRODUCTOS TOTALES`,
                CANTIDAD: Number(reportData.totals.cantidad.toFixed(2)),
                PRECIO_PROM: '',
                COSTO_UNIT: '',
                VENTA_NETA: Number(reportData.totals.venta_neta.toFixed(2)),
                COSTO_TOTAL: Number(reportData.totals.costo_total.toFixed(2)),
                UTILIDAD_BRUTA: Number(reportData.totals.utilidad_bruta.toFixed(2)),
                MARGEN_PCT: `${reportData.totals.margen_pct.toFixed(2)}%`
            });

            const buffer = await excelService.createExcelBuffer({
                title: `TOP PRODUCTOS POR CATEGORIA (${reportData.startDateFormatted} AL ${reportData.endDateFormatted})`,
                sheets: [{
                    name: 'Top Productos',
                    columns: [
                        { header: 'CATEGORÍA', key: 'CATEGORIA', width: 26 },
                        { header: 'RANK', key: 'RANKING', width: 8 },
                        { header: 'CÓDIGO', key: 'CODIGO', width: 16 },
                        { header: 'DESCRIPCIÓN', key: 'DESCRIPCION', width: 36 },
                        { header: 'CANT. VENDIDA', key: 'CANTIDAD', width: 14 },
                        { header: 'PRECIO PROM ($)', key: 'PRECIO_PROM', width: 15 },
                        { header: 'COSTO UNIT ($)', key: 'COSTO_UNIT', width: 15 },
                        { header: 'VENTA NETA ($)', key: 'VENTA_NETA', width: 15 },
                        { header: 'COSTO TOTAL ($)', key: 'COSTO_TOTAL', width: 15 },
                        { header: 'UTILIDAD BRUTA ($)', key: 'UTILIDAD_BRUTA', width: 16 },
                        { header: 'MARGEN (%)', key: 'MARGEN_PCT', width: 13 }
                    ],
                    data: excelRows
                }]
            });

            return excelService.sendExcelResponse(res, buffer, `Top_Productos_Categoria_${start_date}_al_${end_date}.xlsx`);
        }

        // 2. Exportación PDF
        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

        renderTopProductsPDF(doc, reportData);
        doc.end();

        const pdfBuffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Top_Productos_Categoria_${start_date}_al_${end_date}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error in exportTopProductsByCategory:', error);
        res.status(500).json({ message: 'Error al exportar reporte de top productos', error: error.message });
    }
};
