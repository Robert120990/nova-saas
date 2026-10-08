const fs = require('fs');
const path = require('path');
const reportPdfHelper = require('../server/src/utils/reportPdfHelper');
const pool = require('../server/src/config/db');

async function generateObservationsPdf() {
    console.log('Iniciando generación de PDF de observaciones...');
    
    // Obtener información de ANDELSA (company_id: 9)
    const company = await reportPdfHelper.getCompanyInfo(9);
    company.razon_social = company.razon_social || 'ALIMENTOS NUTRICIONALES DE EL SALVADOR, S.A. DE C.V.';
    company.nombre_comercial = company.nombre_comercial || 'ANDELSA';

    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('portrait');
    const contentWidth = doc.page.width - 60; // 552 pt

    // Helper para verificar salto de página
    function checkPageBreak(requiredSpace = 40) {
        if (doc.y + requiredSpace > 710) {
            doc.addPage();
            reportPdfHelper.renderHeader(
                doc,
                company,
                'INFORME DE COMPATIBILIDAD Y OBSERVACIONES DE PARTIDAS',
                'PERIODO: JULIO 2026',
                'portrait',
                'VALIDACION CONTABLE SIPEWEB'
            );
            return true;
        }
        return false;
    }

    // PÁGINA 1
    reportPdfHelper.renderHeader(
        doc,
        company,
        'INFORME DE COMPATIBILIDAD Y OBSERVACIONES DE PARTIDAS',
        'PERIODO: JULIO 2026',
        'portrait',
        'VALIDACION CONTABLE SIPEWEB'
    );

    // 1. Resumen Ejecutivo
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a').text('1. RESUMEN EJECUTIVO Y DIAGNÓSTICO', 30, doc.y);
    doc.y += 3;
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, doc.y).lineTo(doc.page.width - 30, doc.y).stroke();
    doc.y += 6;

    doc.fontSize(8).font('Helvetica').fillColor('#334155').text(
        'El presente informe documenta el análisis técnico-contable de compatibilidad realizado sobre el archivo "Listado de Partidas" al 31 de Julio de 2026 remitido para ALIMENTOS NUTRICIONALES DE EL SALVADOR, S.A. DE C.V. (ANDELSA), con el propósito de determinar la viabilidad de su importación directa al módulo de Contabilidad de SIPEWEB.',
        30, doc.y, { width: contentWidth, align: 'justify' }
    );
    doc.y += 6;

    // Caja de Diagnóstico Global
    const boxY = doc.y;
    doc.roundedRect(30, boxY, contentWidth, 54, 6).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#b45309').text('DIAGNÓSTICO GLOBAL: REQUIERE AJUSTES PREVIOS A LA CARGA', 40, boxY + 8);
    doc.fontSize(7.5).font('Helvetica').fillColor('#475569').text(
        '• Partidas 1 y 2 (Ventas CF y Facturas): 100% COMPATIBLES en sus cuentas auxiliares de detalle y cuadran al centavo exacto.\n' +
        '• Partidas 3 y 4 (Materia Prima y Movimientos): NO COMPATIBLES DIRECTAMENTE. Presentan discrepancias de códigos de cuenta heredadas del sistema anterior que imputarían costos y pasivos a cuentas incorrectas o inexistentes.',
        40, boxY + 22, { width: contentWidth - 20 }
    );
    doc.y = boxY + 62;

    // Principio de Imputación Contable en SIPEWEB
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e293b').text('Regla Fundamental de Carga en SIPEWEB (Estructura de Cuentas):', 30, doc.y);
    doc.y += 3;
    doc.fontSize(7.5).font('Helvetica').fillColor('#475569').text(
        'El reporte PDF original totaliza débitos y créditos en cuentas de Mayor (nivel sintético con columna "Parciales"). En la arquitectura contable de SIPEWEB, las cuentas de Mayor no admiten transacciones directas (allows_entries = 0). Las partidas se registran obligatoriamente a nivel de cuentas afectables de detalle (allows_entries = 1), lo cual garantiza auxiliares analíticos limpios y exactos.',
        30, doc.y, { width: contentWidth, align: 'justify' }
    );
    doc.y += 10;

    // Resumen de Partidas en Tabla
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a').text('2. ESTADO GENERAL POR PARTIDA', 30, doc.y);
    doc.y += 3;
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, doc.y).lineTo(doc.page.width - 30, doc.y).stroke();
    doc.y += 6;

    // Cabecera tabla resumen
    const tHeaderY = doc.y;
    doc.rect(30, tHeaderY, contentWidth, 14).fill('#f1f5f9');
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, tHeaderY + 14).lineTo(doc.page.width - 30, tHeaderY + 14).stroke();
    
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('PARTIDA', 35, tHeaderY + 3, { width: 70 });
    doc.text('FECHA', 105, tHeaderY + 3, { width: 55 });
    doc.text('CONCEPTO', 160, tHeaderY + 3, { width: 140 });
    doc.text('DEBE ($)', 305, tHeaderY + 3, { width: 65, align: 'right' });
    doc.text('HABER ($)', 375, tHeaderY + 3, { width: 65, align: 'right' });
    doc.text('ESTADO / COMPATIBILIDAD', 445, tHeaderY + 3, { width: 130, align: 'center' });

    let currentY = tHeaderY + 15;
    const summaryData = [
        { num: 'CON-070001', date: '31/07/2026', desc: 'CF JULIO 2026 ANDELSA', debe: 134642.02, haber: 134642.02, status: 'COMPATIBLE', statusColor: '#15803d' },
        { num: 'CON-070002', date: '31/07/2026', desc: 'FACTURAS JULIO 2026', debe: 3495.30, haber: 3495.30, status: 'COMPATIBLE', statusColor: '#15803d' },
        { num: 'CON-070005', date: '31/07/2026', desc: 'MATERIA PRIMA ANDELSA', debe: 108152.17, haber: 108152.17, status: 'REQUIERE AJUSTES', statusColor: '#b45309' },
        { num: 'CON-070009', date: '31/07/2026', desc: 'REGISTRO MOVIMIENTOS ANDELSA', debe: 60663.06, haber: 60663.06, status: 'REQUIERE AJUSTES', statusColor: '#b45309' }
    ];

    summaryData.forEach((row, idx) => {
        const bg = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
        doc.rect(30, currentY, contentWidth, 14).fill(bg);
        doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(30, currentY + 14).lineTo(doc.page.width - 30, currentY + 14).stroke();

        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a').text(row.num, 35, currentY + 3);
        doc.font('Helvetica').fillColor('#334155').text(row.date, 105, currentY + 3);
        doc.text(row.desc, 160, currentY + 3, { width: 140, truncate: true });
        doc.font('Helvetica-Bold').fillColor('#0f172a').text(reportPdfHelper.fmt(row.debe), 305, currentY + 3, { width: 65, align: 'right' });
        doc.text(reportPdfHelper.fmt(row.haber), 375, currentY + 3, { width: 65, align: 'right' });
        
        doc.font('Helvetica-Bold').fillColor(row.statusColor).text(row.status, 445, currentY + 3, { width: 130, align: 'center' });
        currentY += 14;
    });

    // Total general resumen
    doc.rect(30, currentY, contentWidth, 14).fill('#f1f5f9');
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, currentY + 14).lineTo(doc.page.width - 30, currentY + 14).stroke();
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('TOTALES CONSOLIDADOS', 35, currentY + 3, { width: 260 });
    doc.text(reportPdfHelper.fmt(306952.55), 305, currentY + 3, { width: 65, align: 'right' });
    doc.text(reportPdfHelper.fmt(306952.55), 375, currentY + 3, { width: 65, align: 'right' });
    doc.fillColor('#15803d').text('BALANCE CUADRADO', 445, currentY + 3, { width: 130, align: 'center' });
    doc.y = currentY + 22;

    // 3. ANÁLISIS DETALLADO PARTIDA 1 Y 2
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a').text('3. DETALLE DE PARTIDAS 1 Y 2 (VENTAS Y FACTURACIÓN)', 30, doc.y);
    doc.y += 3;
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, doc.y).lineTo(doc.page.width - 30, doc.y).stroke();
    doc.y += 6;

    doc.fontSize(7.5).font('Helvetica').fillColor('#334155').text(
        '• Partida CON-070001 (Ventas Crédito Fiscal):\n' +
        '  - Se verificaron las 20 cuentas auxiliares de clientes (1103010101 a 11030240). Todas existen en ANDELSA y permiten movimientos.\n' +
        '  - La suma analítica de las facturas por cliente totaliza exactamente $133,826.61 al centavo.\n' +
        '  - Retención 1% (11070104): $815.32 | Ajuste contable (520102): $0.09 | Total Debe: $134,642.02.\n' +
        '  - IVA Débito (21060601): $15,489.79 | Ventas Huevo Entero (51010103): $119,152.23 | Total Haber: $134,642.02.\n' +
        '  - Estado: LISTA PARA IMPORTACIÓN.\n\n' +
        '• Partida CON-070002 (Ventas Consumidor Final):\n' +
        '  - Cocina de Vuelos (1103010102): $3,174.40 | Clientes Varios (11030222): $320.90 | Total Debe: $3,495.30.\n' +
        '  - IVA Débito (21060601): $36.92 | Ventas Huevo Entero (51010103): $3,458.38 | Total Haber: $3,495.30.\n' +
        '  - Estado: LISTA PARA IMPORTACIÓN.',
        30, doc.y, { width: contentWidth }
    );
    doc.y += 14;

    // SALTO DE PÁGINA PARA PARTIDAS 3 Y 4
    checkPageBreak(300);

    // 4. ANÁLISIS DETALLADO PARTIDAS 3 Y 4 (ALERTAS CRÍTICAS)
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#b45309').text('4. OBSERVACIONES CRÍTICAS: PARTIDAS 3 Y 4', 30, doc.y);
    doc.y += 3;
    doc.strokeColor('#f59e0b').lineWidth(0.8).moveTo(30, doc.y).lineTo(doc.page.width - 30, doc.y).stroke();
    doc.y += 8;

    // Alerta Partida 3
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('A. Partida CON-070005: Materia Prima ANDELSA ($108,152.17)', 30, doc.y);
    doc.y += 4;
    doc.fontSize(7.5).font('Helvetica').fillColor('#334155').text(
        '1. Inexistencia de cuenta 410102: En el PDF figura 410102 MATERIA PRIMA. En el catálogo de ANDELSA, el código 4101 es "Rebajas y Devoluciones sobre Ventas" (Mayor). La cuenta real afectable donde ANDELSA registra la materia prima es 41040101 - MATERIA PRIMA ANDELSA.\n' +
        '2. ALERTA DE HOMONIMIA / ASIGNACIÓN ERRÓNEA EN CUENTA 21010204: En el PDF se indica la cuenta 21010204 a nombre de RAUL RAFAEL SOSA CASTELLANOS. Sin embargo, en el catálogo oficial de ANDELSA, la cuenta 21010204 pertenece a JORGE SANTIVÁÑEZ HUETE. La cuenta real asignada a Don Raúl Rafael Sosa Castellanos es 21010215. Si se cargara el código del PDF, el saldo a favor de $108,152.17 se acreditaría erróneamente a Jorge Santiváñez.',
        35, doc.y, { width: contentWidth - 10, align: 'justify' }
    );
    doc.y += 10;

    // Alerta Partida 4
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('B. Partida CON-070009: Registro Movimientos ANDELSA ($60,663.06)', 30, doc.y);
    doc.y += 4;
    doc.fontSize(7.5).font('Helvetica').fillColor('#334155').text(
        'El sistema contable emisor utilizó una estructura donde los gastos operativos fueron codificados bajo el prefijo 4104. En el catálogo de cuentas oficial de ANDELSA en SIPEWEB:\n' +
        '• 4104 corresponde a COSTO DE PRODUCCION (fabricación de ovoproductos).\n' +
        '• 4105 corresponde a GASTOS DE ADMINISTRACION.\n' +
        '• 4106 corresponde a GASTOS DE VENTA.\n' +
        '• 4107 corresponde a GASTOS FINANCIEROS.\n' +
        'Las cuentas del PDF (410402, 410410, 410411, 41041404, 410415, 410429, 410431, 410435, 410441, 410503) no existen o están en ubicaciones diferentes dentro del catálogo de ANDELSA.',
        35, doc.y, { width: contentWidth - 10, align: 'justify' }
    );
    doc.y += 12;

    // SALTO DE PÁGINA PARA TABLA DE HOMOLOGACIÓN
    checkPageBreak(250);

    // 5. TABLA DE HOMOLOGACIÓN Y EQUIVALENCIAS
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a').text('5. TABLA DE HOMOLOGACIÓN REQUERIDA (PDF vs SIPEWEB)', 30, doc.y);
    doc.y += 3;
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, doc.y).lineTo(doc.page.width - 30, doc.y).stroke();
    doc.y += 6;

    // Cabecera tabla de homologación
    const thY = doc.y;
    doc.rect(30, thY, contentWidth, 14).fill('#f1f5f9');
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, thY + 14).lineTo(doc.page.width - 30, thY + 14).stroke();

    doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('CÓD. PDF', 35, thY + 3, { width: 50 });
    doc.text('DESCRIPCIÓN EN PDF', 88, thY + 3, { width: 145 });
    doc.text('CÓD. REAL', 235, thY + 3, { width: 55 });
    doc.text('CUENTA OFICIAL EN SIPEWEB', 293, thY + 3, { width: 165 });
    doc.text('MONTO ($)', 460, thY + 3, { width: 55, align: 'right' });
    doc.text('TIPO', 520, thY + 3, { width: 30, align: 'center' });

    let rowY = thY + 14;
    const mappingRows = [
        // Partida 3
        { pdfCode: '410102', pdfName: 'MATERIA PRIMA ANDELSA', realCode: '41040101', realName: 'MATERIA PRIMA ANDELSA', amount: 108152.17, side: 'Debe', part: 'CON-070005' },
        { pdfCode: '21010204', pdfName: 'RAUL RAFAEL SOSA CASTELLANOS', realCode: '21010215', realName: 'RAUL RAFAEL SOSA CASTELLANOS', amount: 108152.17, side: 'Haber', part: 'CON-070005' },
        // Partida 4
        { pdfCode: '410201', pdfName: 'Combustible y lubricantes', realCode: '410621', realName: 'COMBUSTIBLE Y LUBRICANTES (Venta)', amount: 76.72, side: 'Debe', part: 'CON-070009' },
        { pdfCode: '410402', pdfName: 'SUELDOS EMPLEADOS', realCode: '410501', realName: 'SUELDOS Y SALARIOS (Admin)', amount: 13456.89, side: 'Debe', part: 'CON-070009' },
        { pdfCode: '410410', pdfName: 'ENERGIA ELECTRICA', realCode: '410529', realName: 'SERV. ENERGIA ELECTRICA (DELSUR)', amount: 15469.54, side: 'Debe', part: 'CON-070009' },
        { pdfCode: '410411', pdfName: 'AGUA - ANDA', realCode: '410528', realName: 'SERVICIO DE AGUA', amount: 2548.63, side: 'Debe', part: 'CON-070009' },
        { pdfCode: '41041404', pdfName: 'GASTOS IMPORTACION HUEVOS', realCode: '410663', realName: 'CIEX IMPORTACIONES (*o crear)', amount: 7786.16, side: 'Debe', part: 'CON-070009' },
        { pdfCode: '410415', pdfName: 'SEGUROS DE VEHICULOS', realCode: '410536', realName: 'SEGUROS (Admin)', amount: 548.96, side: 'Debe', part: 'CON-070009' },
        { pdfCode: '410429', pdfName: 'SERVICIO DE SEGURIDAD Y GPS', realCode: '410530', realName: 'SERVICIO DE SEGURIDAD Y GPS', amount: 1322.41, side: 'Debe', part: 'CON-070009' },
        { pdfCode: '410431', pdfName: 'MATERIAL INSUMOS LABORATORIO', realCode: '41040362', realName: 'MATERIALES E INSUMOS LAB.', amount: 4569.78, side: 'Debe', part: 'CON-070009' },
        { pdfCode: '410435', pdfName: 'MANTENIMIENTO MAQUINARIA', realCode: '410558', realName: 'MANTENIMIENTO MAQUINARIA Y EQ.', amount: 3967.98, side: 'Debe', part: 'CON-070009' },
        { pdfCode: '410441', pdfName: 'HORAS EXTRAS', realCode: '410502', realName: 'HORAS EXTRAS (Admin)', amount: 6987.45, side: 'Debe', part: 'CON-070009' },
        { pdfCode: '410503', pdfName: 'INTERESES PRESTAMOS BANCARIOS', realCode: '410701', realName: 'INTERESES (Gastos Financieros)', amount: 3928.54, side: 'Debe', part: 'CON-070009' },
        { pdfCode: '21010204', pdfName: 'RAUL RAFAEL SOSA CASTELLANOS', realCode: '21010215', realName: 'RAUL RAFAEL SOSA CASTELLANOS', amount: 60663.06, side: 'Haber', part: 'CON-070009' }
    ];

    mappingRows.forEach((r, i) => {
        const bg = i % 2 === 1 ? '#f8fafc' : '#ffffff';
        doc.rect(30, rowY, contentWidth, 13).fill(bg);
        doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(30, rowY + 13).lineTo(doc.page.width - 30, rowY + 13).stroke();

        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#b45309').text(r.pdfCode, 35, rowY + 3);
        doc.font('Helvetica').fillColor('#334155').text(r.pdfName, 88, rowY + 3, { width: 145, truncate: true });
        doc.font('Helvetica-Bold').fillColor('#15803d').text(r.realCode, 235, rowY + 3);
        doc.font('Helvetica').fillColor('#0f172a').text(r.realName, 293, rowY + 3, { width: 165, truncate: true });
        doc.font('Helvetica-Bold').fillColor('#0f172a').text(reportPdfHelper.fmt(r.amount), 460, rowY + 3, { width: 55, align: 'right' });
        doc.font('Helvetica').fillColor(r.side === 'Debe' ? '#0284c7' : '#9333ea').text(r.side, 520, rowY + 3, { width: 30, align: 'center' });

        rowY += 13;
    });

    doc.y = rowY + 12;

    // 6. PLAN DE ACCIÓN Y RECOMENDACIONES
    checkPageBreak(120);
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a').text('6. PLAN DE ACCIÓN Y RECOMENDACIONES TÉCNICAS', 30, doc.y);
    doc.y += 3;
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, doc.y).lineTo(doc.page.width - 30, doc.y).stroke();
    doc.y += 6;

    doc.fontSize(7.5).font('Helvetica').fillColor('#334155').text(
        '1. Aprobación Contable: Solicitar visto bueno a Contabilidad sobre la tabla de homologación presentada.\n' +
        '2. Carga Automatizada mediante Script: Dado que la Partida 1 cuenta con más de 120 comprobantes y 20 auxiliares de clientes, se recomienda ejecutar un script de importación directa que cree las partidas con correlativos oficiales de Julio 2026 en estado "posted" (registradas), garantizando cuadratura al 100% y detalle histórico por cliente.\n' +
        '3. Cuenta de Importación: En caso de requerir una cuenta nominal idéntica para "Gastos de Importación de Huevos", se puede crear previamente en el catálogo de ANDELSA bajo el código 4105... antes de la ejecución.',
        30, doc.y, { width: contentWidth, align: 'justify' }
    );
    doc.y += 18;

    // Cierre
    reportPdfHelper.renderClosingFooter(doc, 30, doc.y, 4, 'Partidas Analizadas');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    const buffer = await getBuffer();
    
    const outputPath = path.resolve(__dirname, '../Informe_Observaciones_Partidas_ANDELSA_Julio_2026.pdf');
    fs.writeFileSync(outputPath, buffer);
    console.log(`PDF generado exitosamente en: ${outputPath}`);
    console.log(`Tamaño del archivo: ${(buffer.length / 1024).toFixed(2)} KB`);
    return outputPath;
}

generateObservationsPdf().then(() => process.exit(0)).catch(err => {
    console.error('Error generando PDF:', err);
    process.exit(1);
});
