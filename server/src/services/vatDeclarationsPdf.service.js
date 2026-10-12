const reportPdfHelper = require('../utils/reportPdfHelper');

const fmt = (val) => reportPdfHelper.fmt(val);
const formatDate = (date) => reportPdfHelper.formatDate(date);

const drawTableHeader = (doc, y, columns) => {
    doc.save();
    doc.rect(30, y, 732, 14).fill('#f1f5f9');
    doc.rect(30, y + 14, 732, 0.5).fill('#cbd5e1');
    doc.fillColor('#0f172a').fontSize(6.5).font('Helvetica-Bold');
    columns.forEach(col => {
        doc.text(col.title, col.x, y + 3.5, { width: col.width, align: col.align || 'left' });
    });
    doc.restore();
};

/**
 * Genera el documento PDF oficial para cualquiera de los 4 anexos
 */
async function generateDeclarationsPdf(type, items, summary, meta) {
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    let reportTitle = 'ANEXO DE DECLARACIÓN DE IVA';
    let entityName = 'Registros';
    let columns = [];

    const isAllBranches = !meta.branchId || meta.branchId === 'all';
    const subtitle = isAllBranches
        ? 'ÁMBITO: DECLARACIÓN POR CONTRIBUYENTE (CONSOLIDADO)'
        : `ÁMBITO: SUCURSAL ${String(meta.branchName || '').toUpperCase()}`;

    if (type === 'anticipo') {
        reportTitle = 'ANEXO DE ANTICIPO A CUENTA 2% DE IVA (TARJETAS)';
        entityName = 'Comprobantes de Liquidación';
        columns = [
            { title: '#', x: 30, width: 24, align: 'center' },
            { title: 'FECHA', x: 54, width: 50, align: 'center' },
            { title: 'AGENTE / PROVEEDOR (ADQUIRENTE)', x: 104, width: 190, align: 'left' },
            { title: 'NIT / NRC', x: 294, width: 90, align: 'left' },
            { title: 'NO. DOC', x: 384, width: 70, align: 'left' },
            { title: 'CÓDIGO GENERACIÓN', x: 454, width: 80, align: 'left' },
            { title: 'SUCURSAL', x: 534, width: 80, align: 'left' },
            { title: 'MONTO SUJETO', x: 614, width: 74, align: 'right' },
            { title: 'ANTICIPO 2%', x: 688, width: 74, align: 'right' }
        ];
    } else if (type === 'retenciones_emitidas') {
        reportTitle = 'ANEXO DE RETENCIONES DE IVA 1% EMITIDAS';
        entityName = 'Comprobantes de Retención';
        columns = [
            { title: '#', x: 30, width: 22, align: 'center' },
            { title: 'ORIGEN', x: 52, width: 42, align: 'center' },
            { title: 'FECHA', x: 94, width: 48, align: 'center' },
            { title: 'SUJETO RETENIDO (PROVEEDOR)', x: 142, width: 180, align: 'left' },
            { title: 'NIT', x: 322, width: 75, align: 'left' },
            { title: 'DOC. RETENCIÓN / DTE', x: 397, width: 95, align: 'left' },
            { title: 'DOC. ORIGEN', x: 492, width: 60, align: 'left' },
            { title: 'SUCURSAL', x: 552, width: 70, align: 'left' },
            { title: 'MONTO SUJETO', x: 622, width: 70, align: 'right' },
            { title: 'RETENCIÓN 1%', x: 692, width: 70, align: 'right' }
        ];
    } else if (type === 'retenciones_recibidas') {
        reportTitle = 'ANEXO DE RETENCIONES DE IVA 1% RECIBIDAS (VENTAS)';
        entityName = 'Comprobantes Sufridos';
        columns = [
            { title: '#', x: 30, width: 22, align: 'center' },
            { title: 'FECHA', x: 52, width: 48, align: 'center' },
            { title: 'AGENTE DE RETENCIÓN (CLIENTE)', x: 100, width: 180, align: 'left' },
            { title: 'NIT / NRC', x: 280, width: 80, align: 'left' },
            { title: 'TIPO', x: 360, width: 42, align: 'center' },
            { title: 'NO. CONTROL DTE', x: 402, width: 100, align: 'left' },
            { title: 'CÓDIGO GENERACIÓN', x: 502, width: 90, align: 'left' },
            { title: 'SUCURSAL', x: 592, width: 70, align: 'left' },
            { title: 'VENTA GRAVADA', x: 662, width: 50, align: 'right' },
            { title: 'RETENCIÓN 1%', x: 712, width: 50, align: 'right' }
        ];
    } else if (type === 'percepciones') {
        reportTitle = 'ANEXO DE PERCEPCIONES DE IVA 1% SOPORTADAS (COMPRAS Y GASTOS)';
        entityName = 'Comprobantes Soportados';
        columns = [
            { title: '#', x: 30, width: 22, align: 'center' },
            { title: 'ORIGEN', x: 52, width: 42, align: 'center' },
            { title: 'FECHA', x: 94, width: 48, align: 'center' },
            { title: 'AGENTE DE PERCEPCIÓN (PROVEEDOR)', x: 142, width: 170, align: 'left' },
            { title: 'NIT / NRC', x: 312, width: 75, align: 'left' },
            { title: 'NO. DOC', x: 387, width: 60, align: 'left' },
            { title: 'CÓDIGO GENERACIÓN', x: 447, width: 75, align: 'left' },
            { title: 'SUCURSAL', x: 522, width: 60, align: 'left' },
            { title: 'COMPRA GRAVADA', x: 582, width: 55, align: 'right' },
            { title: 'CRÉDITO IVA', x: 637, width: 55, align: 'right' },
            { title: 'PERCEPCIÓN 1%', x: 692, width: 70, align: 'right' }
        ];
    } else if (type === 'compras') {
        reportTitle = 'ANEXO DE DECLARACIÓN DE IVA - LIBRO DE COMPRAS';
        entityName = 'Comprobantes de Compra';
        columns = [
            { title: '#', x: 30, width: 20, align: 'center' },
            { title: 'FECHA', x: 50, width: 44, align: 'center' },
            { title: 'TIPO', x: 94, width: 46, align: 'center' },
            { title: 'NO. DOC / CÓD. GEN.', x: 140, width: 98, align: 'left' },
            { title: 'PROVEEDOR', x: 238, width: 122, align: 'left' },
            { title: 'NIT', x: 360, width: 55, align: 'left' },
            { title: 'NRC', x: 415, width: 35, align: 'left' },
            { title: 'GRAVADA', x: 450, width: 50, align: 'right' },
            { title: 'EXENTA', x: 500, width: 42, align: 'right' },
            { title: 'CRÉDITO IVA', x: 542, width: 48, align: 'right' },
            { title: 'NO SUJETA', x: 590, width: 44, align: 'right' },
            { title: 'RET/PER', x: 634, width: 38, align: 'right' },
            { title: 'ANT. CTA', x: 672, width: 38, align: 'right' },
            { title: 'TOTAL', x: 710, width: 52, align: 'right' }
        ];
    }

    // Encabezado institucional unificado
    reportPdfHelper.renderHeader(doc, meta.company, reportTitle, meta.periodText, 'landscape', subtitle);

    let curY = doc.y + 6;
    drawTableHeader(doc, curY, columns);
    curY += 15;

    items.forEach((r, idx) => {
        if (curY > 510) {
            doc.addPage();
            reportPdfHelper.renderHeader(doc, meta.company, reportTitle, meta.periodText, 'landscape', subtitle);
            curY = doc.y + 6;
            drawTableHeader(doc, curY, columns);
            curY += 15;
        }

        const isAlt = idx % 2 === 1;
        if (isAlt) {
            doc.rect(30, curY - 1, 732, 11).fill('#f8fafc');
        }

        doc.fillColor('#1e293b').fontSize(6).font('Helvetica');

        if (type === 'anticipo') {
            doc.text(String(r.corr), 30, curY, { width: 24, align: 'center' });
            doc.text(formatDate(r.fecha), 54, curY, { width: 50, align: 'center' });
            doc.text(r.proveedor_nombre, 104, curY, { width: 190, ellipsis: true });
            doc.text(`${r.proveedor_nit || ''} ${r.proveedor_nrc ? `(${r.proveedor_nrc})` : ''}`, 294, curY, { width: 90, ellipsis: true });
            doc.text(r.numero_documento, 384, curY, { width: 70, ellipsis: true });
            doc.text(r.codigo_generacion || '---', 454, curY, { width: 80, ellipsis: true });
            doc.text(r.branch_name, 534, curY, { width: 80, ellipsis: true });
            doc.text(fmt(r.monto_sujeto), 614, curY, { width: 74, align: 'right' });
            doc.text(fmt(r.anticipo_cuenta), 688, curY, { width: 74, align: 'right' });
        } else if (type === 'retenciones_emitidas') {
            doc.text(String(r.corr), 30, curY, { width: 22, align: 'center' });
            doc.text(String(r.origen || '').toUpperCase(), 52, curY, { width: 42, align: 'center' });
            doc.text(formatDate(r.fecha), 94, curY, { width: 48, align: 'center' });
            doc.text(r.proveedor_nombre, 142, curY, { width: 180, ellipsis: true });
            doc.text(r.proveedor_nit || '---', 322, curY, { width: 75, ellipsis: true });
            doc.text(r.doc_retencion || '---', 397, curY, { width: 95, ellipsis: true });
            doc.text(r.doc_origen || '---', 492, curY, { width: 60, ellipsis: true });
            doc.text(r.branch_name, 552, curY, { width: 70, ellipsis: true });
            doc.text(fmt(r.monto_sujeto), 622, curY, { width: 70, align: 'right' });
            doc.text(fmt(r.monto_retencion), 692, curY, { width: 70, align: 'right' });
        } else if (type === 'retenciones_recibidas') {
            doc.text(String(r.corr), 30, curY, { width: 22, align: 'center' });
            doc.text(formatDate(r.fecha), 52, curY, { width: 48, align: 'center' });
            doc.text(r.cliente_nombre, 100, curY, { width: 180, ellipsis: true });
            doc.text(r.cliente_nit || r.cliente_nrc || '---', 280, curY, { width: 80, ellipsis: true });
            doc.text(r.tipo_documento || '03', 360, curY, { width: 42, align: 'center' });
            doc.text(r.numero_control || '---', 402, curY, { width: 100, ellipsis: true });
            doc.text(r.codigo_generacion || '---', 502, curY, { width: 90, ellipsis: true });
            doc.text(r.branch_name, 592, curY, { width: 70, ellipsis: true });
            doc.text(fmt(r.monto_sujeto), 662, curY, { width: 50, align: 'right' });
            doc.text(fmt(r.monto_retencion), 712, curY, { width: 50, align: 'right' });
        } else if (type === 'percepciones') {
            doc.text(String(r.corr), 30, curY, { width: 22, align: 'center' });
            doc.text(String(r.origen || '').toUpperCase(), 52, curY, { width: 42, align: 'center' });
            doc.text(formatDate(r.fecha), 94, curY, { width: 48, align: 'center' });
            doc.text(r.proveedor_nombre, 142, curY, { width: 170, ellipsis: true });
            doc.text(r.proveedor_nit || r.proveedor_nrc || '---', 312, curY, { width: 75, ellipsis: true });
            doc.text(r.numero_documento || '---', 387, curY, { width: 60, ellipsis: true });
            doc.text(r.codigo_generacion || r.numero_control || '---', 447, curY, { width: 75, ellipsis: true });
            doc.text(r.branch_name, 522, curY, { width: 60, ellipsis: true });
            doc.text(fmt(r.monto_sujeto), 582, curY, { width: 55, align: 'right' });
            doc.text(fmt(r.iva), 637, curY, { width: 55, align: 'right' });
            doc.text(fmt(r.monto_percepcion), 692, curY, { width: 70, align: 'right' });
        } else if (type === 'compras') {
            doc.text(String(r.corr), 30, curY, { width: 20, align: 'center' });
            doc.text(formatDate(r.fecha), 50, curY, { width: 44, align: 'center' });
            doc.text(r.tipo_doc_nombre || 'Créd. Fiscal', 94, curY, { width: 46, align: 'center' });
            const docIdStr = r.codigo_generacion ? `${r.numero_documento} (${r.codigo_generacion.slice(0, 8)}...)` : r.numero_documento;
            doc.text(docIdStr, 140, curY, { width: 98, ellipsis: true });
            doc.text(r.proveedor_nombre, 238, curY, { width: 122, ellipsis: true });
            doc.text(r.proveedor_nit || '---', 360, curY, { width: 55, ellipsis: true });
            doc.text(r.proveedor_nrc || '---', 415, curY, { width: 35, ellipsis: true });
            doc.text(fmt(r.total_gravada), 450, curY, { width: 50, align: 'right' });
            doc.text(fmt(r.total_exenta), 500, curY, { width: 42, align: 'right' });
            doc.text(fmt(r.iva), 542, curY, { width: 48, align: 'right' });
            doc.text(fmt(r.total_nosujeta), 590, curY, { width: 44, align: 'right' });
            const retPer = (r.retencion || 0) + (r.percepcion || 0);
            doc.text(fmt(retPer), 634, curY, { width: 38, align: 'right' });
            doc.text(fmt(r.anticipo_cuenta), 672, curY, { width: 38, align: 'right' });
            doc.text(fmt(r.monto_total), 710, curY, { width: 52, align: 'right' });
        }

        curY += 11;
    });

    // Fila de totales
    if (curY + 18 > 510) {
        doc.addPage();
        curY = 40;
    }

    doc.rect(30, curY, 732, 14).fill('#e2e8f0');
    doc.fillColor('#0f172a').fontSize(6.5).font('Helvetica-Bold');
    doc.text('TOTALES GENERALES:', 50, curY + 3.5);

    if (type === 'anticipo') {
        doc.text(fmt(summary.total_monto_sujeto), 614, curY + 3.5, { width: 74, align: 'right' });
        doc.text(fmt(summary.total_anticipo), 688, curY + 3.5, { width: 74, align: 'right' });
    } else if (type === 'retenciones_emitidas') {
        doc.text(fmt(summary.total_monto_sujeto), 622, curY + 3.5, { width: 70, align: 'right' });
        doc.text(fmt(summary.total_retencion), 692, curY + 3.5, { width: 70, align: 'right' });
    } else if (type === 'retenciones_recibidas') {
        doc.text(fmt(summary.total_monto_sujeto), 662, curY + 3.5, { width: 50, align: 'right' });
        doc.text(fmt(summary.total_retencion), 712, curY + 3.5, { width: 50, align: 'right' });
    } else if (type === 'percepciones') {
        doc.text(fmt(summary.total_monto_sujeto), 572, curY + 3.5, { width: 60, align: 'right' });
        doc.text(fmt(summary.total_iva), 632, curY + 3.5, { width: 60, align: 'right' });
        doc.text(fmt(summary.total_percepcion), 692, curY + 3.5, { width: 70, align: 'right' });
    } else if (type === 'compras') {
        doc.text(fmt(summary.total_gravada), 450, curY + 3.5, { width: 50, align: 'right' });
        doc.text(fmt(summary.total_exenta), 500, curY + 3.5, { width: 42, align: 'right' });
        doc.text(fmt(summary.total_iva), 542, curY + 3.5, { width: 48, align: 'right' });
        doc.text(fmt(summary.total_nosujeta), 590, curY + 3.5, { width: 44, align: 'right' });
        const totRetPer = (summary.total_retencion || 0) + (summary.total_percepcion || 0);
        doc.text(fmt(totRetPer), 634, curY + 3.5, { width: 38, align: 'right' });
        doc.text(fmt(summary.total_anticipo), 672, curY + 3.5, { width: 38, align: 'right' });
        doc.text(fmt(summary.total_compras), 710, curY + 3.5, { width: 52, align: 'right' });
    }

    curY += 22;

    // Cierre estándar sin firmas
    curY = reportPdfHelper.renderClosingFooter(doc, 30, curY, summary.total_records, entityName);
    reportPdfHelper.renderPageNumbers(doc);
    doc.end();

    return getBuffer();
}

module.exports = {
    generateDeclarationsPdf
};
