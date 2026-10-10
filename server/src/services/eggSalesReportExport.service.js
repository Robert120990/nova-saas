const excelService = require('./excel.service');
const reportPdfHelper = require('../utils/reportPdfHelper');

/**
 * Genera el archivo Excel no bloqueante con pestañas de Producto, Cliente y Detalle.
 */
async function generateEggSalesExcel(companyId, filters = {}, dataParam = null) {
    let data = dataParam;
    if (!data) {
        const { getEggSalesReportData } = require('./eggSalesReport.service');
        data = await getEggSalesReportData(companyId, filters);
    }

    const prodCols = [
        { header: 'Producto', key: 'producto', width: 26 },
        { header: 'Volumen / Libras', key: 'libras', width: 24 },
        { header: 'Monto Total ($)', key: 'monto', width: 18 },
        { header: 'Precio Promedio', key: 'precio_prom', width: 22 },
        { header: '% del Total Libras', key: 'pct_lbs', width: 18 },
        { header: '% del Total Monto', key: 'pct_monto', width: 18 },
        { header: 'N° Clientes', key: 'num_clientes', width: 14 },
        { header: 'N° Transacciones', key: 'num_trans', width: 16 }
    ];

    const prodRows = data.byProduct.map(p => ({
        producto: p.product_name,
        libras: p.is_shell ? p.display_quantity : p.total_lbs,
        monto: p.total_amount,
        precio_prom: p.is_shell ? p.avg_price_display : p.avg_price,
        pct_lbs: p.is_shell ? '—' : `${p.pct_of_total_lbs}%`,
        pct_monto: `${p.pct_of_total_amount}%`,
        num_clientes: p.customers?.length || 0,
        num_trans: p.transactions_count
    }));

    const custCols = [
        { header: 'Cliente', key: 'cliente', width: 35 },
        { header: 'NIT / NRC', key: 'nit', width: 18 },
        { header: 'Volumen / Libras', key: 'libras', width: 24 },
        { header: 'Monto Total ($)', key: 'monto', width: 18 },
        { header: 'Precio Promedio', key: 'precio_prom', width: 22 },
        { header: '% del Total Monto', key: 'pct_monto', width: 18 },
        { header: 'Líneas Facturadas', key: 'num_facturas', width: 16 },
        { header: 'Productos Distintos', key: 'productos', width: 30 }
    ];

    const custRows = data.byCustomer.map(c => ({
        cliente: c.customer_name,
        nit: c.customer_nit !== 'N/A' ? c.customer_nit : (c.customer_nrc || '-'),
        libras: c.is_only_shell ? c.display_quantity : c.total_lbs,
        monto: c.total_amount,
        precio_prom: c.is_only_shell ? c.avg_price_display : c.avg_price,
        pct_monto: `${c.pct_of_total_amount}%`,
        num_facturas: c.sales_count,
        productos: (c.products || []).map(p => p.product_name).join(', ')
    }));

    const detailCols = [
        { header: 'Fecha', key: 'fecha', width: 14 },
        { header: 'Tipo Doc', key: 'tipo_doc', width: 12 },
        { header: 'N° Control', key: 'control', width: 25 },
        { header: 'Cliente', key: 'cliente', width: 32 },
        { header: 'Producto', key: 'producto', width: 22 },
        { header: 'Descripción Línea', key: 'desc', width: 38 },
        { header: 'Cantidad', key: 'cant', width: 12 },
        { header: 'Precio Unitario ($)', key: 'pu', width: 16 },
        { header: 'Libras (Lb)', key: 'lbs', width: 14 },
        { header: 'Total ($)', key: 'total', width: 16 },
        { header: 'Precio / Lb ($)', key: 'precio_lb', width: 16 }
    ];

    const detailRows = [];
    data.byCustomer.forEach(c => {
        (c.invoices || []).forEach(inv => {
            detailRows.push({
                fecha: inv.fecha_emision ? new Date(inv.fecha_emision).toLocaleDateString() : 'N/A',
                tipo_doc: inv.tipo_documento === '05' ? 'NC' : (inv.tipo_documento === '03' ? 'CCF' : (inv.tipo_documento === '11' ? 'FEX' : (inv.tipo_documento === '04' ? 'REM' : (inv.tipo_documento === '01' ? 'FAC' : (inv.tipo_documento || 'DTE'))))),
                control: (inv.numero_control || inv.codigo_generacion || `Venta #${inv.sale_id}`) + (inv.linked_remisiones ? ` (Ref: ${inv.linked_remisiones})` : '') + (inv.tipo_documento === '04' ? ' [Pendiente]' : '') + (inv.tipo_documento === '05' ? ' [Nota de Crédito]' : ''),
                cliente: c.customer_name,
                producto: inv.product_name,
                desc: inv.descripcion,
                cant: inv.cantidad,
                pu: inv.precio_unitario,
                lbs: inv.lbs,
                total: inv.amount,
                precio_lb: inv.avg_price
            });
        });
    });

    return await excelService.createExcelBuffer({
        title: 'REPORTE DE VENTAS DE OVOPRODUCTOS Y HUEVO EN CÁSCARA - LIBRAS Y PRECIO PROMEDIO',
        sheets: [
            { name: 'Por Producto', columns: prodCols, data: prodRows },
            { name: 'Por Cliente', columns: custCols, data: custRows },
            { name: 'Detalle de Facturación', columns: detailCols, data: detailRows }
        ]
    });
}

/**
 * Genera el PDF estándar con reportPdfHelper.
 */
async function generateEggSalesPdf(companyId, filters = {}, dataParam = null) {
    let data = dataParam;
    if (!data) {
        const { getEggSalesReportData } = require('./eggSalesReport.service');
        data = await getEggSalesReportData(companyId, filters);
    }
    const company = await reportPdfHelper.getCompanyInfo(companyId);

    const isCustomerView = filters.viewType === 'customer';
    const title = isCustomerView
        ? 'REPORTE DE VENTAS POR CLIENTE (OVOPRODUCTOS Y HUEVO EN CÁSCARA)'
        : 'REPORTE DE VENTAS POR PRODUCTO (OVOPRODUCTOS Y HUEVO EN CÁSCARA)';

    const criterionLabel = filters.remissionMode === 'solo_fiscal'
        ? 'Criterio: Facturación Fiscal Estricta (01, 03, 11)'
        : (filters.remissionMode === 'despachos_fisicos'
            ? 'Criterio: Despachos Físicos (Remisiones 04 Salidas)'
            : 'Criterio: Facturación + Remisiones Pendientes (Sin duplicidad)');

    const hasNC = filters.includeCreditNotes === true || filters.includeCreditNotes === 'true' || filters.includeCreditNotes === '1' || filters.includeCreditNotes === 1;
    const ncLabel = hasNC ? ' • Deducción Notas de Crédito (DTE 05)' : '';

    const periodText = (filters.startDate && filters.endDate
        ? `Período: ${filters.startDate} al ${filters.endDate}`
        : 'Historial General de Ventas') + ` • ${criterionLabel}${ncLabel}`;

    const subtitle = 'Consolidado de Libras Vendidas, Monto Total y Precio Promedio Ponderado ($/Lb)';

    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    let currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);

    if (isCustomerView) {
        // TABLA POR CLIENTE
        const colX = { num: 30, cliente: 50, nit: 240, lbs: 350, monto: 450, prom: 550, pct: 640, facs: 710 };
        const colW = { num: 18, cliente: 185, nit: 105, lbs: 95, monto: 95, prom: 85, pct: 65, facs: 50 };

        const renderTableHead = (y) => {
            doc.rect(30, y, 732, 14).fill('#f1f5f9');
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5);
            doc.text('#', colX.num, y + 3.5, { width: colW.num });
            doc.text('CLIENTE', colX.cliente, y + 3.5, { width: colW.cliente });
            doc.text('NIT / NRC', colX.nit, y + 3.5, { width: colW.nit });
            doc.text('LIBRAS (LB)', colX.lbs, y + 3.5, { width: colW.lbs, align: 'right' });
            doc.text('TOTAL VENDIDO ($)', colX.monto, y + 3.5, { width: colW.monto, align: 'right' });
            doc.text('PRECIO PROM ($/LB)', colX.prom, y + 3.5, { width: colW.prom, align: 'right' });
            doc.text('% MONTO', colX.pct, y + 3.5, { width: colW.pct, align: 'right' });
            doc.text('FACTS.', colX.facs, y + 3.5, { width: colW.facs, align: 'right' });
            return y + 16;
        };

        currentY = renderTableHead(currentY);
        doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');

        let idx = 1;
        for (const c of data.byCustomer) {
            if (currentY > 520) {
                doc.addPage();
                currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
                currentY = renderTableHead(currentY);
                doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');
            }

            doc.text(String(idx++), colX.num, currentY, { width: colW.num });
            doc.text(c.customer_name, colX.cliente, currentY, { width: colW.cliente });
            doc.text(c.customer_nit !== 'N/A' ? c.customer_nit : (c.customer_nrc || '-'), colX.nit, currentY, { width: colW.nit });
            doc.text(c.is_only_shell ? c.display_quantity : `${c.total_lbs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lb`, colX.lbs, currentY, { width: colW.lbs, align: 'right' });
            doc.text(reportPdfHelper.fmt(c.total_amount), colX.monto, currentY, { width: colW.monto, align: 'right' });
            doc.text(c.avg_price_display || `$ ${c.avg_price.toFixed(2)}`, colX.prom, currentY, { width: colW.prom, align: 'right' });
            doc.text(`${c.pct_of_total_amount.toFixed(1)}%`, colX.pct, currentY, { width: colW.pct, align: 'right' });
            doc.text(String(c.sales_count), colX.facs, currentY, { width: colW.facs, align: 'right' });

            currentY += 12;
        }

        // Totales consolidados
        doc.rect(30, currentY, 732, 1).fill('#cbd5e1');
        currentY += 4;
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
        doc.text('TOTALES CONSOLIDADOS:', colX.nit, currentY, { width: colW.nit, align: 'right' });
        doc.text(`${data.summary.totalLbs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lb`, colX.lbs, currentY, { width: colW.lbs, align: 'right' });
        doc.text(reportPdfHelper.fmt(data.summary.totalAmount), colX.monto, currentY, { width: colW.monto, align: 'right' });
        doc.text(`$ ${data.summary.avgPricePerLb.toFixed(2)} /Lb`, colX.prom, currentY, { width: colW.prom, align: 'right' });
        doc.text('100.0%', colX.pct, currentY, { width: colW.pct, align: 'right' });
        doc.text(String(data.summary.totalTransactions), colX.facs, currentY, { width: colW.facs, align: 'right' });
        if (data.summary.shellEggs?.totalAmount > 0) {
            currentY += 12;
            doc.font('Helvetica-Oblique').fontSize(6.5).fillColor('#475569');
            doc.text(`* Total Huevo en Cáscara (no suma a libras): ${data.summary.shellEggs.displayQuantity}  |  Total Facturado: ${reportPdfHelper.fmt(data.summary.shellEggs.totalAmount)}`, 30, currentY, { width: 732 });
        }
        currentY += 18;

        reportPdfHelper.renderClosingFooter(doc, 30, currentY, data.byCustomer.length, 'Clientes Registrados');
    } else {
        // TABLA POR PRODUCTO
        const colX = { prod: 30, lbs: 235, monto: 340, prom: 445, pctLbs: 540, pctMonto: 615, custs: 685 };
        const colW = { prod: 200, lbs: 100, monto: 100, prom: 90, pctLbs: 70, pctMonto: 65, custs: 75 };

        const renderTableHead = (y) => {
            doc.rect(30, y, 732, 14).fill('#f1f5f9');
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5);
            doc.text('PRODUCTO / OVOPRODUCTO', colX.prod, y + 3.5, { width: colW.prod });
            doc.text('VOLUMEN / LIBRAS', colX.lbs, y + 3.5, { width: colW.lbs, align: 'right' });
            doc.text('TOTAL FACTURADO ($)', colX.monto, y + 3.5, { width: colW.monto, align: 'right' });
            doc.text('PRECIO PROM.', colX.prom, y + 3.5, { width: colW.prom, align: 'right' });
            doc.text('% LIBRAS', colX.pctLbs, y + 3.5, { width: colW.pctLbs, align: 'right' });
            doc.text('% FACTURADO', colX.pctMonto, y + 3.5, { width: colW.pctMonto, align: 'right' });
            doc.text('N° CLIENTES', colX.custs, y + 3.5, { width: colW.custs, align: 'right' });
            return y + 16;
        };

        currentY = renderTableHead(currentY);
        doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');

        for (const p of data.byProduct) {
            if (currentY > 520) {
                doc.addPage();
                currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
                currentY = renderTableHead(currentY);
                doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');
            }

            doc.text(p.product_name, colX.prod, currentY, { width: colW.prod });
            doc.text(p.is_shell ? p.display_quantity : `${p.total_lbs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lb`, colX.lbs, currentY, { width: colW.lbs, align: 'right' });
            doc.text(reportPdfHelper.fmt(p.total_amount), colX.monto, currentY, { width: colW.monto, align: 'right' });
            doc.text(p.is_shell ? p.avg_price_display : `$ ${p.avg_price.toFixed(2)} /Lb`, colX.prom, currentY, { width: colW.prom, align: 'right' });
            doc.text(p.is_shell ? '—' : `${p.pct_of_total_lbs.toFixed(1)}%`, colX.pctLbs, currentY, { width: colW.pctLbs, align: 'right' });
            doc.text(`${p.pct_of_total_amount.toFixed(1)}%`, colX.pctMonto, currentY, { width: colW.pctMonto, align: 'right' });
            doc.text(String(p.customers?.length || 0), colX.custs, currentY, { width: colW.custs, align: 'right' });

            currentY += 13;
        }

        // Totales consolidados
        doc.rect(30, currentY, 732, 1).fill('#cbd5e1');
        currentY += 4;
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
        doc.text('TOTALES CONSOLIDADOS:', colX.prod, currentY, { width: colW.prod });
        doc.text(`${data.summary.totalLbs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lb`, colX.lbs, currentY, { width: colW.lbs, align: 'right' });
        doc.text(reportPdfHelper.fmt(data.summary.totalAmount), colX.monto, currentY, { width: colW.monto, align: 'right' });
        doc.text(`$ ${data.summary.avgPricePerLb.toFixed(2)} /Lb`, colX.prom, currentY, { width: colW.prom, align: 'right' });
        doc.text('100.0%', colX.pctLbs, currentY, { width: colW.pctLbs, align: 'right' });
        doc.text('100.0%', colX.pctMonto, currentY, { width: colW.pctMonto, align: 'right' });
        doc.text(String(data.summary.totalCustomers), colX.custs, currentY, { width: colW.custs, align: 'right' });
        if (data.summary.shellEggs?.totalAmount > 0) {
            currentY += 12;
            doc.font('Helvetica-Oblique').fontSize(6.5).fillColor('#475569');
            doc.text(`* Total Huevo en Cáscara (no suma a libras): ${data.summary.shellEggs.displayQuantity}  |  Total Facturado: ${reportPdfHelper.fmt(data.summary.shellEggs.totalAmount)}`, 30, currentY, { width: 732 });
        }
        currentY += 18;

        reportPdfHelper.renderClosingFooter(doc, 30, currentY, data.byProduct.length, 'Categorías de Ovoproductos');
    }

    reportPdfHelper.renderPageNumbers(doc);
    doc.end();

    return await getBuffer();
}

module.exports = {
    generateEggSalesExcel,
    generateEggSalesPdf
};
