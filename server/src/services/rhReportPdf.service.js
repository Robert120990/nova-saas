const path = require('path');
const fs = require('fs');
const reportPdfHelper = require('../utils/reportPdfHelper');
const { numberToWords } = require('../utils/numberToWords');

/**
 * Helper to render signature and stamp
 */
function renderSignatureAndStamp(doc, firmaPath, selloPath, responsable, startX, y, width = 240) {
    if (firmaPath) {
        try {
            const fFile = firmaPath.split('/').pop();
            const fAbs = path.join(__dirname, '..', '..', 'uploads', fFile);
            if (fs.existsSync(fAbs)) {
                doc.image(fAbs, startX + (width / 2) - 50, y - 55, { fit: [100, 50], align: 'center', valign: 'center' });
            }
        } catch (_) {}
    }
    if (selloPath) {
        try {
            const sFile = selloPath.split('/').pop();
            const sAbs = path.join(__dirname, '..', '..', 'uploads', sFile);
            if (fs.existsSync(sAbs)) {
                doc.image(sAbs, startX + width - 40, y - 60, { fit: [90, 60], align: 'center', valign: 'center' });
            }
        } catch (_) {}
    }

    doc.strokeColor('#94a3b8').lineWidth(0.8).moveTo(startX, y).lineTo(startX + width, y).stroke();
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text((responsable || 'RECURSOS HUMANOS').toUpperCase(), startX, y + 4, { width, align: 'center' });
    doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text('DEPARTAMENTO DE RECURSOS HUMANOS', startX, y + 16, { width, align: 'center' });
}

/**
 * 1. Planilla de ISSS PDF (Landscape)
 */
async function generatePlanillaIsssPdf(reportData) {
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');
    const { company, items = [], totals = {}, periodText, subtitle } = reportData;
    const title = 'PLANILLA DE COTIZACIONES AL I.S.S.S.';

    const colX = {
        num: 30,
        codigo: 52,
        nombre: 97,
        isss: 292,
        dui: 362,
        dias: 432,
        devengado: 462,
        isssLaboral: 537,
        isssPatronal: 612,
        totalIsss: 687
    };
    const colW = {
        num: 22,
        codigo: 45,
        nombre: 195,
        isss: 70,
        dui: 70,
        dias: 30,
        devengado: 75,
        isssLaboral: 75,
        isssPatronal: 75,
        totalIsss: 75
    };

    const renderTableHeader = (y) => {
        doc.rect(30, y, 732, 14).fill('#f1f5f9');
        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('N°', colX.num, y + 3, { width: colW.num, align: 'center' });
        doc.text('CÓDIGO', colX.codigo, y + 3, { width: colW.codigo });
        doc.text('NOMBRE DEL EMPLEADO', colX.nombre, y + 3, { width: colW.nombre });
        doc.text('NO. ISSS', colX.isss, y + 3, { width: colW.isss, align: 'center' });
        doc.text('NO. DUI', colX.dui, y + 3, { width: colW.dui, align: 'center' });
        doc.text('DÍAS', colX.dias, y + 3, { width: colW.dias, align: 'center' });
        doc.text('SALARIO DEV.', colX.devengado, y + 3, { width: colW.devengado - 3, align: 'right' });
        doc.text('LABORAL (3%)', colX.isssLaboral, y + 3, { width: colW.isssLaboral - 3, align: 'right' });
        doc.text('PATRONAL (7.5%)', colX.isssPatronal, y + 3, { width: colW.isssPatronal - 3, align: 'right' });
        doc.text('TOTAL ISSS', colX.totalIsss, y + 3, { width: colW.totalIsss - 3, align: 'right' });
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, y + 14).lineTo(762, y + 14).stroke();
        return y + 15;
    };

    let currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
    currentY = renderTableHeader(currentY);

    items.forEach((item, index) => {
        if (currentY > 525) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            currentY = renderTableHeader(currentY);
        }

        if (index % 2 === 1) {
            doc.rect(30, currentY - 1, 732, 12).fill('#f8fafc');
        }

        doc.fontSize(6.8).font('Helvetica').fillColor('#1e293b');
        doc.text(String(index + 1), colX.num, currentY, { width: colW.num, align: 'center' });
        doc.text(item.codigo || '', colX.codigo, currentY, { width: colW.codigo });
        doc.text(item.nombre || '', colX.nombre, currentY, { width: colW.nombre, lineBreak: false });
        doc.text(item.num_isss || '---', colX.isss, currentY, { width: colW.isss, align: 'center' });
        doc.text(item.num_dui || '---', colX.dui, currentY, { width: colW.dui, align: 'center' });
        doc.text(String(item.dias_trabajados || 0), colX.dias, currentY, { width: colW.dias, align: 'center' });
        doc.text(reportPdfHelper.fmt(item.salario_devengado), colX.devengado, currentY, { width: colW.devengado - 3, align: 'right' });
        doc.text(reportPdfHelper.fmt(item.isss_laboral), colX.isssLaboral, currentY, { width: colW.isssLaboral - 3, align: 'right' });
        doc.text(reportPdfHelper.fmt(item.isss_patronal), colX.isssPatronal, currentY, { width: colW.isssPatronal - 3, align: 'right' });
        doc.text(reportPdfHelper.fmt(item.total_isss), colX.totalIsss, currentY, { width: colW.totalIsss - 3, align: 'right' });

        currentY += 12;
    });

    if (currentY > 515) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
    }

    // Totals Row
    doc.strokeColor('#cbd5e1').lineWidth(0.8).moveTo(30, currentY).lineTo(762, currentY).stroke();
    currentY += 3;
    doc.rect(30, currentY - 2, 732, 14).fill('#f1f5f9');
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('TOTALES GENERALES:', colX.codigo, currentY + 2, { width: 300 });
    doc.text(reportPdfHelper.fmt(totals.salario_devengado), colX.devengado, currentY + 2, { width: colW.devengado - 3, align: 'right' });
    doc.text(reportPdfHelper.fmt(totals.isss_laboral), colX.isssLaboral, currentY + 2, { width: colW.isssLaboral - 3, align: 'right' });
    doc.text(reportPdfHelper.fmt(totals.isss_patronal), colX.isssPatronal, currentY + 2, { width: colW.isssPatronal - 3, align: 'right' });
    doc.text(reportPdfHelper.fmt(totals.total_isss), colX.totalIsss, currentY + 2, { width: colW.totalIsss - 3, align: 'right' });
    doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(30, currentY + 14).lineTo(762, currentY + 14).stroke();

    currentY += 25;
    reportPdfHelper.renderClosingFooter(doc, 30, currentY, items.length, 'Empleados');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
}

/**
 * 2. Planilla de AFP PDF (Landscape)
 */
async function generatePlanillaAfpPdf(reportData) {
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');
    const { company, groups = [], totals = {}, periodText, subtitle } = reportData;
    const title = 'PLANILLA DE COTIZACIONES PREVISIONALES (A.F.P.)';

    const colX = {
        num: 30,
        codigo: 52,
        nombre: 97,
        nup: 292,
        dui: 362,
        dias: 432,
        cotizable: 462,
        afpLaboral: 537,
        afpPatronal: 612,
        totalAfp: 687
    };
    const colW = {
        num: 22,
        codigo: 45,
        nombre: 195,
        nup: 70,
        dui: 70,
        dias: 30,
        cotizable: 75,
        afpLaboral: 75,
        afpPatronal: 75,
        totalAfp: 75
    };

    const renderTableHeader = (y) => {
        doc.rect(30, y, 732, 14).fill('#f1f5f9');
        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('N°', colX.num, y + 3, { width: colW.num, align: 'center' });
        doc.text('CÓDIGO', colX.codigo, y + 3, { width: colW.codigo });
        doc.text('NOMBRE DEL EMPLEADO', colX.nombre, y + 3, { width: colW.nombre });
        doc.text('NO. NUP', colX.nup, y + 3, { width: colW.nup, align: 'center' });
        doc.text('NO. DUI', colX.dui, y + 3, { width: colW.dui, align: 'center' });
        doc.text('DÍAS', colX.dias, y + 3, { width: colW.dias, align: 'center' });
        doc.text('SAL. COTIZABLE', colX.cotizable, y + 3, { width: colW.cotizable - 3, align: 'right' });
        doc.text('COTIZ. (7.25%)', colX.afpLaboral, y + 3, { width: colW.afpLaboral - 3, align: 'right' });
        doc.text('APORTE (8.75%)', colX.afpPatronal, y + 3, { width: colW.afpPatronal - 3, align: 'right' });
        doc.text('TOTAL (16.00%)', colX.totalAfp, y + 3, { width: colW.totalAfp - 3, align: 'right' });
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, y + 14).lineTo(762, y + 14).stroke();
        return y + 15;
    };

    let currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
    currentY = renderTableHeader(currentY);

    let globalCount = 0;

    groups.forEach((group) => {
        if (currentY > 500) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            currentY = renderTableHeader(currentY);
        }

        // AFP Section Banner
        doc.rect(30, currentY, 732, 13).fill('#e0e7ff');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#3730a3');
        doc.text(`INSTITUCIÓN PREVISIONAL: ${group.afp_nombre.toUpperCase()} (${group.items.length} COTIZANTES)`, 35, currentY + 2.5);
        currentY += 14;

        group.items.forEach((item, index) => {
            globalCount++;
            if (currentY > 525) {
                doc.addPage();
                currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
                currentY = renderTableHeader(currentY);
            }

            if (index % 2 === 1) {
                doc.rect(30, currentY - 1, 732, 12).fill('#f8fafc');
            }

            doc.fontSize(6.8).font('Helvetica').fillColor('#1e293b');
            doc.text(String(index + 1), colX.num, currentY, { width: colW.num, align: 'center' });
            doc.text(item.codigo || '', colX.codigo, currentY, { width: colW.codigo });
            doc.text(item.nombre || '', colX.nombre, currentY, { width: colW.nombre, lineBreak: false });
            doc.text(item.num_nup || '---', colX.nup, currentY, { width: colW.nup, align: 'center' });
            doc.text(item.num_dui || '---', colX.dui, currentY, { width: colW.dui, align: 'center' });
            doc.text(String(item.dias_trabajados || 0), colX.dias, currentY, { width: colW.dias, align: 'center' });
            doc.text(reportPdfHelper.fmt(item.salario_cotizable), colX.cotizable, currentY, { width: colW.cotizable - 3, align: 'right' });
            doc.text(reportPdfHelper.fmt(item.afp_laboral), colX.afpLaboral, currentY, { width: colW.afpLaboral - 3, align: 'right' });
            doc.text(reportPdfHelper.fmt(item.afp_patronal), colX.afpPatronal, currentY, { width: colW.afpPatronal - 3, align: 'right' });
            doc.text(reportPdfHelper.fmt(item.total_afp), colX.totalAfp, currentY, { width: colW.totalAfp - 3, align: 'right' });

            currentY += 12;
        });

        // AFP Subtotal row
        doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(30, currentY).lineTo(762, currentY).stroke();
        currentY += 2;
        doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#4338ca');
        doc.text(`SUBTOTAL ${group.afp_nombre.toUpperCase()}:`, colX.nombre, currentY, { width: colW.nombre });
        doc.text(reportPdfHelper.fmt(group.subtotal_cotizable), colX.cotizable, currentY, { width: colW.cotizable - 3, align: 'right' });
        doc.text(reportPdfHelper.fmt(group.subtotal_afp_laboral), colX.afpLaboral, currentY, { width: colW.afpLaboral - 3, align: 'right' });
        doc.text(reportPdfHelper.fmt(group.subtotal_afp_patronal), colX.afpPatronal, currentY, { width: colW.afpPatronal - 3, align: 'right' });
        doc.text(reportPdfHelper.fmt(group.subtotal_total_afp), colX.totalAfp, currentY, { width: colW.totalAfp - 3, align: 'right' });
        currentY += 14;
    });

    if (currentY > 515) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
    }

    // Grand Totals Row
    doc.strokeColor('#cbd5e1').lineWidth(0.8).moveTo(30, currentY).lineTo(762, currentY).stroke();
    currentY += 3;
    doc.rect(30, currentY - 2, 732, 14).fill('#f1f5f9');
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('TOTALES GENERALES:', colX.codigo, currentY + 2, { width: 300 });
    doc.text(reportPdfHelper.fmt(totals.salario_cotizable), colX.cotizable, currentY + 2, { width: colW.cotizable - 3, align: 'right' });
    doc.text(reportPdfHelper.fmt(totals.afp_laboral), colX.afpLaboral, currentY + 2, { width: colW.afpLaboral - 3, align: 'right' });
    doc.text(reportPdfHelper.fmt(totals.afp_patronal), colX.afpPatronal, currentY + 2, { width: colW.afpPatronal - 3, align: 'right' });
    doc.text(reportPdfHelper.fmt(totals.total_afp), colX.totalAfp, currentY + 2, { width: colW.totalAfp - 3, align: 'right' });
    doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(30, currentY + 14).lineTo(762, currentY + 14).stroke();

    currentY += 25;
    reportPdfHelper.renderClosingFooter(doc, 30, currentY, globalCount, 'Empleados Cotizantes');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
}

/**
 * 3. Informe Mensual de Retención de Renta (ISR) PDF (Landscape)
 */
async function generateInformeRentaPdf(reportData) {
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');
    const { company, items = [], totals = {}, periodText, subtitle } = reportData;
    const title = 'INFORME MENSUAL DE RETENCIÓN DE IMPUESTO SOBRE LA RENTA (ISR)';

    const colX = {
        num: 30,
        codigo: 52,
        nombre: 97,
        dui: 277,
        nit: 342,
        devengado: 417,
        isss: 482,
        afp: 537,
        gravable: 592,
        renta: 652,
        liquido: 707
    };
    const colW = {
        num: 22,
        codigo: 45,
        nombre: 180,
        dui: 65,
        nit: 75,
        devengado: 65,
        isss: 55,
        afp: 55,
        gravable: 60,
        renta: 55,
        liquido: 55
    };

    const renderTableHeader = (y) => {
        doc.rect(30, y, 732, 14).fill('#f1f5f9');
        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('N°', colX.num, y + 3, { width: colW.num, align: 'center' });
        doc.text('CÓDIGO', colX.codigo, y + 3, { width: colW.codigo });
        doc.text('NOMBRE DEL EMPLEADO', colX.nombre, y + 3, { width: colW.nombre });
        doc.text('NO. DUI', colX.dui, y + 3, { width: colW.dui, align: 'center' });
        doc.text('NO. NIT', colX.nit, y + 3, { width: colW.nit, align: 'center' });
        doc.text('DEVENGADO', colX.devengado, y + 3, { width: colW.devengado - 3, align: 'right' });
        doc.text('ISSS', colX.isss, y + 3, { width: colW.isss - 3, align: 'right' });
        doc.text('AFP', colX.afp, y + 3, { width: colW.afp - 3, align: 'right' });
        doc.text('GRAVABLE', colX.gravable, y + 3, { width: colW.gravable - 3, align: 'right' });
        doc.text('ISR RETENIDO', colX.renta, y + 3, { width: colW.renta - 3, align: 'right' });
        doc.text('LÍQUIDO', colX.liquido, y + 3, { width: colW.liquido - 3, align: 'right' });
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, y + 14).lineTo(762, y + 14).stroke();
        return y + 15;
    };

    let currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
    currentY = renderTableHeader(currentY);

    items.forEach((item, index) => {
        if (currentY > 525) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            currentY = renderTableHeader(currentY);
        }

        if (index % 2 === 1) {
            doc.rect(30, currentY - 1, 732, 12).fill('#f8fafc');
        }

        doc.fontSize(6.8).font('Helvetica').fillColor('#1e293b');
        doc.text(String(index + 1), colX.num, currentY, { width: colW.num, align: 'center' });
        doc.text(item.codigo || '', colX.codigo, currentY, { width: colW.codigo });
        doc.text(item.nombre || '', colX.nombre, currentY, { width: colW.nombre, lineBreak: false });
        doc.text(item.num_dui || '---', colX.dui, currentY, { width: colW.dui, align: 'center' });
        doc.text(item.num_nit || '---', colX.nit, currentY, { width: colW.nit, align: 'center' });
        doc.text(reportPdfHelper.fmt(item.total_percepciones), colX.devengado, currentY, { width: colW.devengado - 3, align: 'right' });
        doc.text(reportPdfHelper.fmt(item.descuento_isss), colX.isss, currentY, { width: colW.isss - 3, align: 'right' });
        doc.text(reportPdfHelper.fmt(item.descuento_afp), colX.afp, currentY, { width: colW.afp - 3, align: 'right' });
        doc.text(reportPdfHelper.fmt(item.renta_gravable), colX.gravable, currentY, { width: colW.gravable - 3, align: 'right' });
        doc.text(reportPdfHelper.fmt(item.descuento_renta), colX.renta, currentY, { width: colW.renta - 3, align: 'right' });
        doc.text(reportPdfHelper.fmt(item.monto_recibir), colX.liquido, currentY, { width: colW.liquido - 3, align: 'right' });

        currentY += 12;
    });

    if (currentY > 515) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
    }

    // Totals Row
    doc.strokeColor('#cbd5e1').lineWidth(0.8).moveTo(30, currentY).lineTo(762, currentY).stroke();
    currentY += 3;
    doc.rect(30, currentY - 2, 732, 14).fill('#f1f5f9');
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('TOTALES GENERALES:', colX.codigo, currentY + 2, { width: 200 });
    doc.text(reportPdfHelper.fmt(totals.total_percepciones), colX.devengado, currentY + 2, { width: colW.devengado - 3, align: 'right' });
    doc.text(reportPdfHelper.fmt(totals.descuento_isss), colX.isss, currentY + 2, { width: colW.isss - 3, align: 'right' });
    doc.text(reportPdfHelper.fmt(totals.descuento_afp), colX.afp, currentY + 2, { width: colW.afp - 3, align: 'right' });
    doc.text(reportPdfHelper.fmt(totals.renta_gravable), colX.gravable, currentY + 2, { width: colW.gravable - 3, align: 'right' });
    doc.text(reportPdfHelper.fmt(totals.descuento_renta), colX.renta, currentY + 2, { width: colW.renta - 3, align: 'right' });
    doc.text(reportPdfHelper.fmt(totals.monto_recibir), colX.liquido, currentY + 2, { width: colW.liquido - 3, align: 'right' });
    doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(30, currentY + 14).lineTo(762, currentY + 14).stroke();

    currentY += 25;
    reportPdfHelper.renderClosingFooter(doc, 30, currentY, items.length, 'Empleados');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
}

/**
 * 4. Constancia de Sueldo PDF (Portrait Letter)
 */
async function generateConstanciaSueldoPdf({ employee, company, rhConfig, options = {} }) {
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('portrait');
    const contentW = 532; // 612 - 80 (margin 40)
    const startX = 40;

    const companyName = (company?.razon_social || company?.nombre_comercial || 'EMPRESA REGISTRADA').toUpperCase();
    const nit = company?.nit || 'N/A';
    const nrc = company?.nrc || 'N/A';
    const address = company?.direccion || 'El Salvador';

    // Header
    let y = 40;
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#0f172a').text(companyName, startX, y, { align: 'center', width: contentW });
    y += 18;
    doc.fontSize(8).font('Helvetica').fillColor('#475569').text(`NIT: ${nit}    |    NRC: ${nrc}`, startX, y, { align: 'center', width: contentW });
    y += 12;
    doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text(address, startX, y, { align: 'center', width: contentW });
    y += 14;
    doc.strokeColor('#cbd5e1').lineWidth(0.8).moveTo(startX, y).lineTo(startX + contentW, y).stroke();
    y += 28;

    // Document Title
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e293b').text('CONSTANCIA DE TRABAJO Y SUELDO', startX, y, { align: 'center', width: contentW });
    y += 35;

    // Addressee
    const destinatario = (options.dirigida_a || 'A QUIEN INTERESE').toUpperCase();
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text(`${destinatario}:`, startX, y);
    y += 24;

    // Dates and Salary formatted
    const nombreCompleto = `${employee.nombres || ''} ${employee.apellidos || ''}`.trim().toUpperCase();
    const dui = employee.num_dui || 'N/A';
    const numNit = employee.num_nit || 'N/A';
    const cargo = (employee.cargo_nombre || employee.ocupacion || 'EMPLEADO').toUpperCase();
    const departamento = (employee.departamento_nombre || 'GENERAL').toUpperCase();
    const fechaIngreso = reportPdfHelper.formatDate(employee.fecha_ingreso);

    const sueldoBase = parseFloat(employee.sueldo_base || 0);
    const bonif = parseFloat(employee.bonificacion_fija || 0);
    const sueldoBruto = sueldoBase + bonif;

    const sueldoLetras = numberToWords(sueldoBruto).toUpperCase();
    const sueldoNum = reportPdfHelper.fmt(sueldoBruto);

    // Paragraph 1: Employment declaration
    doc.fontSize(9.5).font('Helvetica').fillColor('#1e293b').lineGap(4);
    const parrafo1 = `Por medio de la presente, el Departamento de Recursos Humanos de ${companyName} HACE CONSTAR que el(la) señor(a) ${nombreCompleto}, quien se identifica con Documento Único de Identidad (DUI) número ${dui} y Número de Identificación Tributaria (NIT) número ${numNit}, labora para esta institución desde el día ${fechaIngreso}, desempeñando a la fecha el cargo de ${cargo} en el área de ${departamento}.`;
    doc.text(parrafo1, startX, y, { width: contentW, align: 'justify' });
    y = doc.y + 14;

    // Paragraph 2: Salary declaration
    const parrafo2 = `Asimismo, se certifica que devenga un salario mensual de ${sueldoLetras} (${sueldoNum}).`;
    doc.text(parrafo2, startX, y, { width: contentW, align: 'justify' });
    y = doc.y + 16;

    // Breakdown box (if enabled)
    if (options.incluir_deducciones !== false) {
        const isss = Math.min(sueldoBruto * 0.03, 30.00);
        const afp = sueldoBruto * 0.0725;
        const rentaEstimada = parseFloat(employee.renta_estimada || 0);
        const liquidoEstimado = sueldoBruto - isss - afp - rentaEstimada;

        doc.rect(startX + 30, y, contentW - 60, 85).fillAndStroke('#f8fafc', '#e2e8f0');
        let boxY = y + 8;
        const colValX = startX + contentW - 130;

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#334155').text('DESGLOSE ESTIMADO DE SALARIO Y DEDUCCIONES DE LEY:', startX + 45, boxY);
        boxY += 14;

        doc.fontSize(7.5).font('Helvetica').fillColor('#475569');
        doc.text('Salario Nominal Bruto:', startX + 45, boxY);
        doc.font('Helvetica-Bold').fillColor('#0f172a').text(reportPdfHelper.fmt(sueldoBruto), colValX, boxY, { width: 90, align: 'right' });
        boxY += 12;

        doc.font('Helvetica').fillColor('#475569');
        doc.text('(-) Cotización I.S.S.S. (3%):', startX + 45, boxY);
        doc.text(reportPdfHelper.fmt(isss), colValX, boxY, { width: 90, align: 'right' });
        boxY += 12;

        doc.text('(-) Cotización Previsional A.F.P. (7.25%):', startX + 45, boxY);
        doc.text(reportPdfHelper.fmt(afp), colValX, boxY, { width: 90, align: 'right' });
        boxY += 12;

        doc.text('(-) Retención Impuesto sobre la Renta:', startX + 45, boxY);
        doc.text(reportPdfHelper.fmt(rentaEstimada), colValX, boxY, { width: 90, align: 'right' });
        boxY += 12;

        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX + 45, boxY).lineTo(startX + contentW - 40, boxY).stroke();
        boxY += 3;

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text('(=) Salario Líquido Aproximado:', startX + 45, boxY);
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1d4ed8').text(reportPdfHelper.fmt(liquidoEstimado), colValX, boxY, { width: 90, align: 'right' });

        y += 105;
    }

    // Closing Paragraph
    const today = new Date();
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const diaLetras = today.getDate();
    const mesLetras = meses[today.getMonth()];
    const anioLetras = today.getFullYear();
    const ciudad = company?.municipio || company?.departamento || 'San Salvador';

    const parrafo3 = `Y para los usos legales que el(la) interesado(a) estime convenientes, se extiende la presente constancia en la ciudad de ${ciudad}, a los ${diaLetras} días del mes de ${mesLetras} del año ${anioLetras}.`;
    doc.fontSize(9.5).font('Helvetica').fillColor('#1e293b').text(parrafo3, startX, y, { width: contentW, align: 'justify' });
    y = doc.y + 70;

    // Signature and Stamp Block
    renderSignatureAndStamp(
        doc,
        rhConfig?.firma_url,
        rhConfig?.sello_url,
        rhConfig?.responsable_nombre || 'JEFE DE RECURSOS HUMANOS',
        startX + (contentW / 2) - 120,
        y,
        240
    );

    reportPdfHelper.renderPageNumbers(doc);
    doc.end();
    return await getBuffer();
}

/**
 * 5. Carta de Renta PDF (Constancia Anual de Retención de ISR - Portrait Letter)
 */
async function generateCartaRentaPdf({ employee, company, rhConfig, totals = {}, anio }) {
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('portrait');
    const contentW = 532;
    const startX = 40;

    const companyName = (company?.razon_social || company?.nombre_comercial || 'EMPRESA REGISTRADA').toUpperCase();
    const nit = company?.nit || 'N/A';
    const nrc = company?.nrc || 'N/A';
    const address = company?.direccion || 'El Salvador';

    // Header
    let y = 40;
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#0f172a').text(companyName, startX, y, { align: 'center', width: contentW });
    y += 18;
    doc.fontSize(8).font('Helvetica').fillColor('#475569').text(`NIT: ${nit}    |    NRC: ${nrc}`, startX, y, { align: 'center', width: contentW });
    y += 12;
    doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text(address, startX, y, { align: 'center', width: contentW });
    y += 14;
    doc.strokeColor('#cbd5e1').lineWidth(0.8).moveTo(startX, y).lineTo(startX + contentW, y).stroke();
    y += 24;

    // Document Title
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b').text('CONSTANCIA DE RETENCIÓN DE IMPUESTO SOBRE LA RENTA', startX, y, { align: 'center', width: contentW });
    y += 15;
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#475569').text(`EJERCICIO FISCAL ${anio}`, startX, y, { align: 'center', width: contentW });
    y += 28;

    const nombreCompleto = `${employee.nombres || ''} ${employee.apellidos || ''}`.trim().toUpperCase();
    const dui = employee.num_dui || 'N/A';
    const numNit = employee.num_nit || 'N/A';
    const representante = (rhConfig?.responsable_nombre || 'EL REPRESENTANTE AUTORIZADO').toUpperCase();

    // Legal Body
    doc.fontSize(9.5).font('Helvetica').fillColor('#1e293b').lineGap(4);
    const parrafo1 = `El infrascrito ${representante}, en calidad de Representante de ${companyName}, con Número de Identificación Tributaria (NIT) ${nit} y Número de Registro de Contribuyente (NRC) ${nrc}, en cumplimiento con lo establecido en la Ley de Impuesto Sobre la Renta y su Reglamento,`;
    doc.text(parrafo1, startX, y, { width: contentW, align: 'justify' });
    y = doc.y + 14;

    doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text('HACE CONSTAR QUE:', startX, y, { width: contentW, align: 'center' });
    y += 20;

    const parrafo2 = `Al señor(a) ${nombreCompleto}, identificado(a) con Documento Único de Identidad (DUI) número ${dui} y Número de Identificación Tributaria (NIT) número ${numNit}, durante el ejercicio fiscal comprendido del 01 de enero al 31 de diciembre del año ${anio}, se le devengaron y retuvieron los valores que se detallan a continuación:`;
    doc.fontSize(9.5).font('Helvetica').fillColor('#1e293b').text(parrafo2, startX, y, { width: contentW, align: 'justify' });
    y = doc.y + 16;

    // Values Table
    const totalDevengado = parseFloat(totals.total_devengado || 0);
    const totalIsss = parseFloat(totals.total_isss || 0);
    const totalAfp = parseFloat(totals.total_afp || 0);
    const rentaGravada = Math.max(0, totalDevengado - totalIsss - totalAfp);
    const rentaRetenida = parseFloat(totals.total_renta || 0);
    const liquido = parseFloat(totals.total_liquido || (totalDevengado - totalIsss - totalAfp - rentaRetenida));

    const boxW = contentW;
    doc.rect(startX, y, boxW, 140).fillAndStroke('#f8fafc', '#cbd5e1');
    let tableY = y + 8;
    const colDescX = startX + 15;
    const colValNumX = startX + boxW - 130;

    const rows = [
        { label: '1. TOTAL REMUNERACIONES DEVENGADAS / PERCIBIDAS:', val: totalDevengado, bold: true },
        { label: '2. MENOS: Cotizaciones al Seguro Social (I.S.S.S.):', val: totalIsss, bold: false },
        { label: '3. MENOS: Cotizaciones Fondo de Pensiones (A.F.P.):', val: totalAfp, bold: false },
        { label: '4. RENTA NETA GRAVADA DEL EJERCICIO FISCAL:', val: rentaGravada, bold: true },
        { label: '5. IMPUESTO SOBRE LA RENTA RETENIDO (F-910):', val: rentaRetenida, bold: true, highlight: true },
        { label: '6. MONTO NETO LÍQUIDO PERCIBIDO:', val: liquido, bold: false }
    ];

    rows.forEach((r, idx) => {
        if (r.highlight) {
            doc.rect(startX + 1, tableY - 2, boxW - 2, 18).fill('#eff6ff');
        }
        doc.fontSize(8.5).font(r.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(r.highlight ? '#1e40af' : '#1e293b');
        doc.text(r.label, colDescX, tableY + 2, { width: colValNumX - colDescX - 10 });
        doc.text(reportPdfHelper.fmt(r.val), colValNumX, tableY + 2, { width: 115, align: 'right' });
        tableY += 21;
        if (idx < rows.length - 1) {
            doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(colDescX, tableY - 3).lineTo(startX + boxW - 15, tableY - 3).stroke();
        }
    });

    y += 155;

    // Written amounts summary
    const rentaLetras = numberToWords(rentaRetenida).toUpperCase();
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#334155');
    doc.text(`MONTO DE RENTA RETENIDA EN LETRAS:`, startX, y);
    doc.font('Helvetica').fillColor('#0f172a').text(rentaLetras, startX, y + 12, { width: contentW, align: 'justify' });
    y += 35;

    // Closing Paragraph
    const today = new Date();
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const diaLetras = today.getDate();
    const mesLetras = meses[today.getMonth()];
    const anioLetras = today.getFullYear();
    const ciudad = company?.municipio || company?.departamento || 'San Salvador';

    const parrafo3 = `Y para ser presentada ante la Dirección General de Impuestos Internos (DGII) del Ministerio de Hacienda o a quien corresponda, se expide y firma la presente constancia en ${ciudad}, el día ${diaLetras} de ${mesLetras} del año ${anioLetras}.`;
    doc.fontSize(9.5).font('Helvetica').fillColor('#1e293b').text(parrafo3, startX, y, { width: contentW, align: 'justify' });
    y = doc.y + 55;

    // Signature and Stamp Block
    renderSignatureAndStamp(
        doc,
        rhConfig?.firma_url,
        rhConfig?.sello_url,
        rhConfig?.responsable_nombre || 'JEFE DE RECURSOS HUMANOS',
        startX + (contentW / 2) - 120,
        y,
        240
    );

    reportPdfHelper.renderPageNumbers(doc);
    doc.end();
    return await getBuffer();
}

/**
 * 6. Listado de Empleados PDF (Landscape)
 */
async function generateListadoEmpleadosPdf(reportData) {
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');
    const { company, items = [], totals = {}, periodText, subtitle } = reportData;
    const title = 'CATÁLOGO GENERAL DE EMPLEADOS';

    const colX = {
        num: 30,
        codigo: 52,
        nombre: 92,
        cargo: 252,
        departamento: 352,
        fechaIngreso: 447,
        dui: 502,
        nit: 562,
        sueldoBase: 632,
        estado: 697
    };
    const colW = {
        num: 22,
        codigo: 40,
        nombre: 160,
        cargo: 100,
        departamento: 95,
        fechaIngreso: 55,
        dui: 60,
        nit: 70,
        sueldoBase: 65,
        estado: 65
    };

    const renderTableHeader = (y) => {
        doc.rect(30, y, 732, 14).fill('#f1f5f9');
        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('N°', colX.num, y + 3, { width: colW.num, align: 'center' });
        doc.text('CÓDIGO', colX.codigo, y + 3, { width: colW.codigo });
        doc.text('NOMBRE COMPLETO', colX.nombre, y + 3, { width: colW.nombre });
        doc.text('CARGO / PUESTO', colX.cargo, y + 3, { width: colW.cargo });
        doc.text('DEPARTAMENTO', colX.departamento, y + 3, { width: colW.departamento });
        doc.text('F. INGRESO', colX.fechaIngreso, y + 3, { width: colW.fechaIngreso, align: 'center' });
        doc.text('DUI', colX.dui, y + 3, { width: colW.dui, align: 'center' });
        doc.text('NIT', colX.nit, y + 3, { width: colW.nit, align: 'center' });
        doc.text('SUELDO BASE', colX.sueldoBase, y + 3, { width: colW.sueldoBase - 3, align: 'right' });
        doc.text('ESTADO', colX.estado, y + 3, { width: colW.estado, align: 'center' });
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, y + 14).lineTo(762, y + 14).stroke();
        return y + 15;
    };

    let currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
    currentY = renderTableHeader(currentY);

    items.forEach((item, index) => {
        if (currentY > 525) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            currentY = renderTableHeader(currentY);
        }

        if (index % 2 === 1) {
            doc.rect(30, currentY - 1, 732, 12).fill('#f8fafc');
        }

        doc.fontSize(6.8).font('Helvetica').fillColor('#1e293b');
        doc.text(String(index + 1), colX.num, currentY, { width: colW.num, align: 'center' });
        doc.text(item.codigo || '', colX.codigo, currentY, { width: colW.codigo });
        doc.text(item.nombre || '', colX.nombre, currentY, { width: colW.nombre, lineBreak: false });
        doc.text(item.cargo || '---', colX.cargo, currentY, { width: colW.cargo, lineBreak: false });
        doc.text(item.departamento || '---', colX.departamento, currentY, { width: colW.departamento, lineBreak: false });
        doc.text(reportPdfHelper.formatDate(item.fecha_ingreso), colX.fechaIngreso, currentY, { width: colW.fechaIngreso, align: 'center' });
        doc.text(item.num_dui || '---', colX.dui, currentY, { width: colW.dui, align: 'center' });
        doc.text(item.num_nit || '---', colX.nit, currentY, { width: colW.nit, align: 'center' });
        doc.text(reportPdfHelper.fmt(item.sueldo_base), colX.sueldoBase, currentY, { width: colW.sueldoBase - 3, align: 'right' });

        const isActivo = item.es_activo === 1 || item.es_activo === true || item.es_activo === '1';
        doc.font('Helvetica-Bold').fillColor(isActivo ? '#166534' : '#991b1b');
        doc.text(isActivo ? 'ACTIVO' : 'INACTIVO', colX.estado, currentY, { width: colW.estado, align: 'center' });

        currentY += 12;
    });

    if (currentY > 515) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
    }

    // Totals Row
    doc.strokeColor('#cbd5e1').lineWidth(0.8).moveTo(30, currentY).lineTo(762, currentY).stroke();
    currentY += 3;
    doc.rect(30, currentY - 2, 732, 14).fill('#f1f5f9');
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text(`TOTAL EMPLEADOS: ${totals.total_empleados || items.length} (ACTIVOS: ${totals.total_activos || 0}, INACTIVOS: ${totals.total_inactivos || 0})`, colX.codigo, currentY + 2, { width: 450 });
    doc.text(reportPdfHelper.fmt(totals.total_sueldos), colX.sueldoBase, currentY + 2, { width: colW.sueldoBase - 3, align: 'right' });
    doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(30, currentY + 14).lineTo(762, currentY + 14).stroke();

    currentY += 25;
    reportPdfHelper.renderClosingFooter(doc, 30, currentY, items.length, 'Empleados');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
}

module.exports = {
    generatePlanillaIsssPdf,
    generatePlanillaAfpPdf,
    generateInformeRentaPdf,
    generateConstanciaSueldoPdf,
    generateCartaRentaPdf,
    generateListadoEmpleadosPdf
};
