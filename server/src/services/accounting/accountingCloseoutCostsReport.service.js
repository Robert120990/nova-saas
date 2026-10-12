const reportPdfHelper = require('../../utils/reportPdfHelper');
const excelService = require('../excel.service');
const { getCloseoutCostsData } = require('./accountingCloseoutCostsData.service');

async function generateCloseoutCostsPdfBuffer(companyId, branchId, date) {
    const [company, data] = await Promise.all([
        reportPdfHelper.getCompanyInfo(companyId),
        getCloseoutCostsData(companyId, branchId, date)
    ]);

    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('portrait');
    const startX = 30;
    const contentWidth = 552;

    const renderPageHeader = () => reportPdfHelper.renderHeader(
        doc,
        company,
        'COMPROBANTE DE COSTOS DE VENTA',
        `FECHA DE OPERACIÓN: ${reportPdfHelper.formatDate(date)}`,
        'portrait',
        `SUCURSAL: ${data.branch_label}`
    );

    let y = renderPageHeader();
    const checkPageBreak = (needed = 35) => {
        if (y + needed > 710) {
            doc.addPage();
            y = renderPageHeader();
        }
    };

    // 1. Fuels Section
    const hasTrupput = !!data.totals.has_trupput;
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('1. COSTO DE VENTA DE COMBUSTIBLES', startX, y);
    y += 12;

    doc.rect(startX, y, contentWidth, 16).fill('#f1f5f9');
    doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(startX, y, contentWidth, 16).stroke();
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
    if (hasTrupput) {
        doc.text('N°', startX, y + 4.5, { width: 25, align: 'center' });
        doc.text('DESCRIPCIÓN DE COMBUSTIBLE', startX + 28, y + 4.5, { width: 155, align: 'left' });
        doc.text('GAL. BOMBA', startX + 185, y + 4.5, { width: 68, align: 'right' });
        doc.text('TRUPPUT (-)', startX + 255, y + 4.5, { width: 68, align: 'right' });
        doc.text('GAL. NETOS', startX + 325, y + 4.5, { width: 68, align: 'right' });
        doc.text('COSTO UNIT.', startX + 395, y + 4.5, { width: 68, align: 'right' });
        doc.text('SUBTOTAL COSTO', startX + 465, y + 4.5, { width: 84, align: 'right' });
    } else {
        doc.text('N°', startX, y + 4.5, { width: 30, align: 'center' });
        doc.text('DESCRIPCIÓN DE COMBUSTIBLE', startX + 35, y + 4.5, { width: 195, align: 'left' });
        doc.text('GALONES VENDIDOS', startX + 235, y + 4.5, { width: 105, align: 'right' });
        doc.text('COSTO UNITARIO', startX + 345, y + 4.5, { width: 100, align: 'right' });
        doc.text('SUBTOTAL COSTO', startX + 450, y + 4.5, { width: 95, align: 'right' });
    }
    y += 16;

    data.fuels.forEach((f, idx) => {
        doc.rect(startX, y, contentWidth, 15).fill(idx % 2 === 1 ? '#f8fafc' : '#ffffff');
        doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(startX, y, contentWidth, 15).stroke();
        doc.fontSize(7).font('Helvetica').fillColor('#334155');
        if (hasTrupput) {
            doc.text(String(f.index), startX, y + 4, { width: 25, align: 'center' });
            doc.font('Helvetica-Bold').text(f.nombre, startX + 28, y + 4, { width: 155, align: 'left' });
            doc.font('Helvetica').text((f.galones_bomba || f.galones).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }), startX + 185, y + 4, { width: 68, align: 'right' });
            if (f.galones_trupput > 0) {
                doc.fillColor('#b45309').text(`- ${f.galones_trupput.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`, startX + 255, y + 4, { width: 68, align: 'right' });
            } else {
                doc.fillColor('#94a3b8').text('-', startX + 255, y + 4, { width: 68, align: 'right' });
            }
            doc.fillColor('#334155').text(f.galones.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }), startX + 325, y + 4, { width: 68, align: 'right' });
            doc.text(`$ ${f.costo_unitario.toFixed(4)}`, startX + 395, y + 4, { width: 68, align: 'right' });
            doc.font('Helvetica-Bold').fillColor('#0f172a').text(reportPdfHelper.fmt(f.subtotal), startX + 465, y + 4, { width: 84, align: 'right' });
        } else {
            doc.text(String(f.index), startX, y + 4, { width: 30, align: 'center' });
            doc.font('Helvetica-Bold').text(f.nombre, startX + 35, y + 4, { width: 195, align: 'left' });
            doc.font('Helvetica').text(f.galones.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }), startX + 235, y + 4, { width: 105, align: 'right' });
            doc.text(`$ ${f.costo_unitario.toFixed(4)}`, startX + 345, y + 4, { width: 100, align: 'right' });
            doc.font('Helvetica-Bold').fillColor('#0f172a').text(reportPdfHelper.fmt(f.subtotal), startX + 450, y + 4, { width: 95, align: 'right' });
        }
        y += 15;
    });

    doc.rect(startX, y, contentWidth, 16).fill('#f1f5f9');
    doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(startX, y, contentWidth, 16).stroke();
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    if (hasTrupput) {
        doc.text('SUBTOTAL COMBUSTIBLES', startX + 28, y + 4.5, { width: 155, align: 'left' });
        doc.text(data.totals.fuel_gallons_bomba.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }), startX + 185, y + 4.5, { width: 68, align: 'right' });
        doc.fillColor('#b45309').text(`- ${data.totals.fuel_gallons_trupput.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`, startX + 255, y + 4.5, { width: 68, align: 'right' });
        doc.fillColor('#0f172a').text(data.totals.fuel_gallons.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }), startX + 325, y + 4.5, { width: 68, align: 'right' });
        doc.text(reportPdfHelper.fmt(data.totals.fuel_cost), startX + 465, y + 4.5, { width: 84, align: 'right' });
    } else {
        doc.text('SUBTOTAL COMBUSTIBLES', startX + 35, y + 4.5, { width: 195, align: 'left' });
        doc.text(data.totals.fuel_gallons.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }), startX + 235, y + 4.5, { width: 105, align: 'right' });
        doc.text(reportPdfHelper.fmt(data.totals.fuel_cost), startX + 450, y + 4.5, { width: 95, align: 'right' });
    }
    y += 20;

    if (hasTrupput) {
        checkPageBreak(28);
        doc.rect(startX, y, contentWidth, 22).fill('#fef3c7');
        doc.strokeColor('#f59e0b').lineWidth(0.5).rect(startX, y, contentWidth, 22).stroke();
        doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#92400e');
        doc.text(
            `* NOTA INFORMATIVA TRUPPUT: Se despacharon ${data.totals.fuel_gallons_trupput.toFixed(3)} galones de Trupput ($${data.totals.total_trupput_monto.toFixed(2)}) descontados de los medidores de bomba ya que no constituyen venta propia ni inventario de la estación. El costo se calculó sobre los galones netos.`,
            startX + 8, y + 4, { width: contentWidth - 16, align: 'justify' }
        );
        y += 26;
    } else {
        y += 2;
    }

    // 2. Lubricants Section
    checkPageBreak(50);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('2. COSTO DE VENTA DE LUBRICANTES Y ADITIVOS', startX, y);
    y += 12;

    if (data.lubricants.length === 0) {
        doc.rect(startX, y, contentWidth, 18).fill('#f8fafc');
        doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(startX, y, contentWidth, 18).stroke();
        doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#64748b').text('No se registraron ventas de lubricantes en este turno / fecha.', startX, y + 5, { width: contentWidth, align: 'center' });
        y += 24;
    } else {
        doc.rect(startX, y, contentWidth, 16).fill('#f1f5f9');
        doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(startX, y, contentWidth, 16).stroke();
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('N°', startX, y + 4.5, { width: 25, align: 'center' });
        doc.text('CÓDIGO', startX + 28, y + 4.5, { width: 55, align: 'left' });
        doc.text('DESCRIPCIÓN DE PRODUCTO', startX + 85, y + 4.5, { width: 220, align: 'left' });
        doc.text('UNIDADES', startX + 310, y + 4.5, { width: 65, align: 'right' });
        doc.text('COSTO UNIT.', startX + 380, y + 4.5, { width: 75, align: 'right' });
        doc.text('SUBTOTAL COSTO', startX + 460, y + 4.5, { width: 85, align: 'right' });
        y += 16;

        data.lubricants.forEach((l, idx) => {
            checkPageBreak(18);
            doc.rect(startX, y, contentWidth, 15).fill(idx % 2 === 1 ? '#f8fafc' : '#ffffff');
            doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(startX, y, contentWidth, 15).stroke();
            doc.fontSize(7).font('Helvetica').fillColor('#334155');
            doc.text(String(l.index), startX, y + 4, { width: 25, align: 'center' });
            doc.text(l.codigo, startX + 28, y + 4, { width: 55, align: 'left' });
            doc.text(reportPdfHelper.fitText(doc, l.descripcion, 215), startX + 85, y + 4, { width: 220, align: 'left' });
            doc.text(String(l.unidades), startX + 310, y + 4, { width: 65, align: 'right' });
            doc.text(`$ ${l.costo_unitario.toFixed(4)}`, startX + 380, y + 4, { width: 75, align: 'right' });
            doc.font('Helvetica-Bold').fillColor('#0f172a').text(reportPdfHelper.fmt(l.subtotal), startX + 460, y + 4, { width: 85, align: 'right' });
            y += 15;
        });

        doc.rect(startX, y, contentWidth, 16).fill('#f1f5f9');
        doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(startX, y, contentWidth, 16).stroke();
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('SUBTOTAL LUBRICANTES', startX + 85, y + 4.5, { width: 220, align: 'left' });
        doc.text(String(data.totals.lub_units), startX + 310, y + 4.5, { width: 65, align: 'right' });
        doc.text(reportPdfHelper.fmt(data.totals.lub_cost), startX + 460, y + 4.5, { width: 85, align: 'right' });
        y += 22;
    }

    // 3. Consolidated Summary
    checkPageBreak(65);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('3. RESUMEN CONSOLIDADO DE COSTO DE MERCADERÍA', startX, y);
    y += 12;

    doc.rect(startX, y, contentWidth, 54).fill('#f8fafc');
    doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(startX, y, contentWidth, 54).stroke();

    let sy = y + 6;
    doc.fontSize(7.5).font('Helvetica').fillColor('#334155');
    doc.text('Costo Total de Combustibles:', startX + 15, sy);
    doc.font('Helvetica-Bold').text(reportPdfHelper.fmt(data.totals.fuel_cost), startX + contentWidth - 130, sy, { width: 115, align: 'right' });
    sy += 13;

    doc.font('Helvetica').text('Costo Total de Lubricantes y Aditivos:', startX + 15, sy);
    doc.font('Helvetica-Bold').text(reportPdfHelper.fmt(data.totals.lub_cost), startX + contentWidth - 130, sy, { width: 115, align: 'right' });
    sy += 13;

    doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(startX + 15, sy).lineTo(startX + contentWidth - 15, sy).stroke();
    sy += 5;

    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('TOTAL COSTO DE MERCADERÍA (COSTO DE VENTA):', startX + 15, sy);
    doc.fillColor('#1d4ed8').text(reportPdfHelper.fmt(data.totals.grand_total_cost), startX + contentWidth - 140, sy, { width: 125, align: 'right' });
    y += 64;

    // 4. Accounting Annex: Inventory and Cost Accounts
    checkPageBreak(90);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('4. ANEXO CONTABLE: CUENTAS DE COSTO E INVENTARIO', startX, y);
    y += 12;

    doc.rect(startX, y, contentWidth, 16).fill('#f1f5f9');
    doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(startX, y, contentWidth, 16).stroke();
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('CÓDIGO', startX + 8, y + 4.5, { width: 65, align: 'left' });
    doc.text('CUENTA CONTABLE', startX + 76, y + 4.5, { width: 185, align: 'left' });
    doc.text('CONCEPTO / MOVIMIENTO', startX + 265, y + 4.5, { width: 145, align: 'left' });
    doc.text('CARGO (DEBE)', startX + 415, y + 4.5, { width: 60, align: 'right' });
    doc.text('ABONO (HABER)', startX + 480, y + 4.5, { width: 65, align: 'right' });
    y += 16;

    if (!data.accounting_lines || data.accounting_lines.length === 0) {
        doc.rect(startX, y, contentWidth, 16).fill('#ffffff');
        doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(startX, y, contentWidth, 16).stroke();
        doc.fontSize(7).font('Helvetica-Oblique').fillColor('#64748b').text('Cuentas contables no configuradas en ajustes de contabilidad.', startX + 8, y + 4.5, { width: contentWidth - 16, align: 'center' });
        y += 16;
    } else {
        data.accounting_lines.forEach((al, idx) => {
            checkPageBreak(18);
            doc.rect(startX, y, contentWidth, 15).fill(idx % 2 === 1 ? '#f8fafc' : '#ffffff');
            doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(startX, y, contentWidth, 15).stroke();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#1e293b');
            doc.text(al.codigo || 'S/C', startX + 8, y + 4, { width: 65, align: 'left' });
            doc.font('Helvetica-Bold').text(reportPdfHelper.fitText(doc, al.cuenta || '', 180), startX + 76, y + 4, { width: 185, align: 'left' });
            doc.font('Helvetica').fillColor('#475569').text(reportPdfHelper.fitText(doc, al.concepto || '', 140), startX + 265, y + 4, { width: 145, align: 'left' });
            doc.font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(al.debe > 0 ? reportPdfHelper.fmt(al.debe) : '$ -', startX + 415, y + 4, { width: 60, align: 'right' });
            doc.text(al.haber > 0 ? reportPdfHelper.fmt(al.haber) : '$ -', startX + 480, y + 4, { width: 65, align: 'right' });
            y += 15;
        });

        doc.rect(startX, y, contentWidth, 16).fill('#f1f5f9');
        doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(startX, y, contentWidth, 16).stroke();
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('TOTALES ASIENTO DE COSTO E INVENTARIO', startX + 76, y + 4.5, { width: 330, align: 'left' });
        doc.text(reportPdfHelper.fmt(data.accounting_totals.total_debe), startX + 415, y + 4.5, { width: 60, align: 'right' });
        doc.text(reportPdfHelper.fmt(data.accounting_totals.total_haber), startX + 480, y + 4.5, { width: 65, align: 'right' });
        y += 20;
    }

    if (data.existing_entry) {
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#059669').text(
            `✓ Partida Contable Registrada: Partida de Diario #${data.existing_entry.number} (Fecha: ${reportPdfHelper.formatDate(data.existing_entry.date)})`,
            startX, y, { width: contentWidth }
        );
        y += 14;
    } else {
        doc.fontSize(7.2).font('Helvetica-Oblique').fillColor('#b45309').text(
            '* Estado Contable: Partida de diario pendiente de asentar en el módulo de Contabilizar Cierres de Turno.',
            startX, y, { width: contentWidth }
        );
        y += 14;
    }

    doc.fontSize(6.8).font('Helvetica-Oblique').fillColor('#64748b');
    doc.text(
        'Nota Contable: Este comprobante respalda la deducción de costos e inventarios de la partida de diario de cierre de turnos de la fecha indicada. El monto total de costo de mercadería corresponde al cargo de la cuenta de Costo de Mercadería y los descargos correspondientes a Inventario de Combustibles e Inventario de Lubricantes.',
        startX, y, { width: contentWidth, align: 'justify' }
    );
    y += 22;

    reportPdfHelper.renderClosingFooter(doc, startX, y, data.fuels.length + data.lubricants.length, 'Conceptos de Costo');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
}

async function generateCloseoutCostsExcelBuffer(companyId, branchId, date) {
    const data = await getCloseoutCostsData(companyId, branchId, date);
    const hasTrupput = !!data.totals.has_trupput;

    const fuelCols = hasTrupput ? [
        { header: 'N°', key: 'index', width: 8 }, { header: 'Combustible', key: 'nombre', width: 22 },
        { header: 'Galones Bomba', key: 'galones_bomba', width: 16 }, { header: 'Trupput (-)', key: 'galones_trupput', width: 16 },
        { header: 'Galones Netos', key: 'galones', width: 16 }, { header: 'Costo Unitario ($)', key: 'costo_unitario', width: 18 },
        { header: 'Subtotal Costo ($)', key: 'subtotal', width: 18 }
    ] : [
        { header: 'N°', key: 'index', width: 8 }, { header: 'Combustible', key: 'nombre', width: 22 },
        { header: 'Galones Vendidos', key: 'galones', width: 18 }, { header: 'Costo Unitario ($)', key: 'costo_unitario', width: 18 },
        { header: 'Subtotal Costo ($)', key: 'subtotal', width: 18 }
    ];

    const summaryRows = [
        { concepto: 'COSTO TOTAL COMBUSTIBLES', total: data.totals.fuel_cost },
        { concepto: 'COSTO TOTAL LUBRICANTES', total: data.totals.lub_cost },
        { concepto: 'TOTAL COSTO DE MERCADERÍA', total: data.totals.grand_total_cost },
        { concepto: 'TOTAL CARGO / DEBE (CUENTAS COSTO)', total: data.accounting_totals.total_debe },
        { concepto: 'TOTAL ABONO / HABER (CUENTAS INVENTARIO)', total: data.accounting_totals.total_haber },
        { concepto: 'ESTADO CONTABLE', total: data.existing_entry ? `Partida #${data.existing_entry.number}` : 'Pendiente de Asentar' }
    ];
    if (hasTrupput) {
        summaryRows.push(
            { concepto: 'GALONES BOMBA (MEDIDORES)', total: data.totals.fuel_gallons_bomba },
            { concepto: 'GALONES TRUPPUT DESCONTADOS', total: data.totals.fuel_gallons_trupput },
            { concepto: 'MONTO TRUPPUT DESCONTADO ($)', total: data.totals.total_trupput_monto },
            { concepto: 'GALONES NETOS COSTEADOS', total: data.totals.fuel_gallons }
        );
    }

    const sheets = [
        { name: 'Combustibles', columns: fuelCols, rows: data.fuels },
        {
            name: 'Lubricantes',
            columns: [
                { header: 'N°', key: 'index', width: 8 }, { header: 'Código', key: 'codigo', width: 14 },
                { header: 'Descripción', key: 'descripcion', width: 35 }, { header: 'Unidades', key: 'unidades', width: 12 },
                { header: 'Costo Unitario ($)', key: 'costo_unitario', width: 18 }, { header: 'Subtotal Costo ($)', key: 'subtotal', width: 18 }
            ],
            rows: data.lubricants
        },
        {
            name: 'Cuentas Contables',
            columns: [
                { header: 'N°', key: 'index', width: 8 }, { header: 'Código', key: 'codigo', width: 16 },
                { header: 'Cuenta Contable', key: 'cuenta', width: 38 }, { header: 'Concepto / Movimiento', key: 'concepto', width: 32 },
                { header: 'Cargo / Debe ($)', key: 'debe', width: 18 }, { header: 'Abono / Haber ($)', key: 'haber', width: 18 }
            ],
            rows: data.accounting_lines
        },
        { name: 'Resumen', columns: [{ header: 'Concepto', key: 'concepto', width: 44 }, { header: 'Total ($)', key: 'total', width: 22 }], rows: summaryRows }
    ];

    if (data.totals.trupput_despachos?.length > 0) {
        sheets.push({
            name: 'Despachos Trupput',
            columns: [
                { header: 'ID', key: 'id', width: 8 }, { header: 'Cliente', key: 'cliente_nombre', width: 30 },
                { header: 'Documento', key: 'documento', width: 18 }, { header: 'Combustible', key: 'combustible', width: 20 },
                { header: 'Galones', key: 'galones', width: 14 }, { header: 'Precio ($)', key: 'precio', width: 14 },
                { header: 'Monto ($)', key: 'monto', width: 16 }
            ],
            rows: data.totals.trupput_despachos
        });
    }

    return await excelService.createExcelBuffer({
        title: `Comprobante de Costos - ${data.branch_label} - ${date}`,
        sheets
    });
}

module.exports = {
    getCloseoutCostsData,
    generateCloseoutCostsPdfBuffer,
    generateCloseoutCostsExcelBuffer
};
