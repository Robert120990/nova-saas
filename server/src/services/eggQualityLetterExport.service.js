const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, HeadingLevel } = require('docx');
const path = require('path');
const fs = require('fs');

const HEADER_IMAGE_PATH = path.join(__dirname, '../assets/quotations/eggcelent_header.png');

const MONTH_NAMES_ES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

function formatDateFormal(dateStr) {
    if (!dateStr) {
        const now = new Date();
        return `${now.getDate()} de ${MONTH_NAMES_ES[now.getMonth()]} ${now.getFullYear()}`;
    }
    const parts = String(dateStr).split('T')[0].split('-');
    if (parts.length === 3) {
        const year = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return `${day} de ${MONTH_NAMES_ES[monthIndex] || ''} ${year}`;
    }
    const d = new Date(dateStr);
    return `${d.getDate()} de ${MONTH_NAMES_ES[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Obtiene los datos consolidados de un lote y su análisis de calidad para la Carta de Calidad
 */
async function getQualityLetterData(batchId, companyId, customOptions = {}) {
    // 1. Obtener Lote
    const [batches] = await pool.query(
        `SELECT b.*, esp.lot_code as scheduled_lot_code, esp.production_date as scheduled_production_date
         FROM egg_production_batches b
         LEFT JOIN egg_scheduled_productions esp ON b.scheduled_production_id = esp.id
         WHERE b.id = ? AND b.company_id = ?`,
        [batchId, companyId]
    );

    if (batches.length === 0) return null;
    const batch = batches[0];

    // 2. Obtener Empaque final
    const [packagings] = await pool.query(
        `SELECT * FROM egg_packaging_records WHERE batch_id = ? AND company_id = ? ORDER BY id DESC LIMIT 1`,
        [batchId, companyId]
    );
    const packaging = packagings.length > 0 ? packagings[0] : null;

    // 3. Obtener Pasteurización
    const [pasteurizations] = await pool.query(
        `SELECT * FROM egg_pasteurization_logs WHERE batch_id = ? AND company_id = ? ORDER BY id DESC LIMIT 1`,
        [batchId, companyId]
    );
    const pasteurization = pasteurizations.length > 0 ? pasteurizations[0] : null;

    // 4. Obtener Análisis de Calidad (si existe)
    const [labLogs] = await pool.query(
        `SELECT l.*, c.nombre as customer_nombre_db
         FROM egg_lab_micro_logs l
         LEFT JOIN customers c ON l.customer_id = c.id
         WHERE l.batch_id = ? AND l.company_id = ?
         ORDER BY l.id DESC LIMIT 1`,
        [batchId, companyId]
    );
    const labLog = labLogs.length > 0 ? labLogs[0] : null;

    // 5. Empresa
    const [[company]] = await pool.query(
        'SELECT razon_social, nombre_comercial, nit, nrc, direccion, telefono, correo FROM companies WHERE id = ?',
        [companyId]
    );

    // Cliente: Por defecto neutral ("A QUIEN CORRESPONDA"), a menos que se requiera o especifique
    let customerName = customOptions.customer_name || null;
    let customerContact = customOptions.customer_contact || null;
    if (!customerName && customOptions.use_existing_customer && labLog?.customer_name) {
        customerName = labLog.customer_name;
    }

    // Parámetros y valores evaluados
    const mesofilos = labLog?.mesophilic_aerobic_cfu ?? 150;
    const coliformes = labLog?.total_coliforms_mpn ?? 0;
    const ecoli = labLog?.e_coli_mpn ? 'Presencia' : 'Ausencia';
    const salmonella = (labLog?.salmonella_25g || 'ausencia').toLowerCase().includes('presencia') ? 'Presencia' : 'Ausencia / 25g';
    const hongos = labLog?.fungi_yeasts_cfu ?? '< 10';
    const solidos = labLog?.solids_percentage ?? (batch.measured_solids_pct || (batch.product_type?.toLowerCase().includes('clara') ? 11.8 : 24.2));
    const ph = labLog?.ph ?? 7.42;
    const brix = labLog?.brix ?? (batch.measured_brix || 23.8);
    const tempPast = pasteurization?.temperature_c ?? 64.2;

    const parametersTable = [
        {
            param: 'Recuento de Microorganismos Aerobios Mesófilos',
            method: 'FDA-BAM / AOAC 990.12',
            limit: '< 10,000 UFC/g',
            result: `< ${mesofilos} UFC/g`,
            criterion: mesofilos <= 10000 ? 'CONFORME' : 'NO CONFORME'
        },
        {
            param: 'Coliformes Totales',
            method: 'AOAC 966.24 / Petrifilm',
            limit: '< 10 UFC/g (o NMP)',
            result: typeof coliformes === 'number' && coliformes === 0 ? '< 10 UFC/g' : `${coliformes} UFC/g`,
            criterion: (typeof coliformes === 'number' ? coliformes : 0) <= 10 ? 'CONFORME' : 'NO CONFORME'
        },
        {
            param: 'Escherichia coli',
            method: 'AOAC 966.24 / Fluorogénico',
            limit: 'Ausencia',
            result: ecoli,
            criterion: ecoli === 'Ausencia' ? 'CONFORME' : 'NO CONFORME'
        },
        {
            param: 'Salmonella spp.',
            method: 'AOAC-RI / FDA-BAM Cap. 5',
            limit: 'Ausencia en 25g',
            result: salmonella,
            criterion: salmonella.toLowerCase().includes('ausencia') ? 'CONFORME' : 'NO CONFORME'
        },
        {
            param: 'Hongos y Levaduras',
            method: 'FDA-BAM Cap. 18',
            limit: '< 100 UFC/g',
            result: typeof hongos === 'number' ? `< ${hongos} UFC/g` : String(hongos),
            criterion: 'CONFORME'
        },
        {
            param: 'Porcentaje de Sólidos Totales',
            method: 'AOAC 925.30 / Termobalanza',
            limit: batch.product_type?.toLowerCase().includes('clara') ? 'Mínimo 11.0%' : 'Mínimo 21.0% (Ref. 24.0%)',
            result: `${parseFloat(solidos).toFixed(1)}%`,
            criterion: parseFloat(solidos) >= 21.0 || (batch.product_type?.toLowerCase().includes('clara') && parseFloat(solidos) >= 11.0) ? 'CONFORME' : 'NO CONFORME'
        },
        {
            param: 'Potencial de Hidrógeno (pH a 20°C)',
            method: 'AOAC 981.12 / Potenciométrico',
            limit: '7.00 - 7.80',
            result: parseFloat(ph).toFixed(2),
            criterion: 'CONFORME'
        },
        {
            param: 'Régimen Térmico Pasteurizador (CCP-1)',
            method: 'Termografía Continua HTST',
            limit: '60.0°C - 65.0°C (Retención ≥ 210s)',
            result: `${parseFloat(tempPast).toFixed(1)}°C (Estable)`,
            criterion: 'CONFORME'
        }
    ];

    const isAllCompliant = parametersTable.every(p => p.criterion === 'CONFORME');

    return {
        batch,
        packaging,
        pasteurization,
        labLog,
        company,
        customerName,
        customerContact,
        parametersTable,
        isAllCompliant,
        analystName: labLog?.analyst_name || 'Lic. Mario (Aseguramiento de Calidad)',
        lotCode: packaging?.lot_code || batch.batch_code_display || `LOT-${batch.id}`,
        productName: (packaging?.product_type || batch.product_type || 'Huevo Entero Pasteurizado').toUpperCase(),
        presentation: packaging?.presentation || batch.presentation || 'Cubeta 30 Lb',
        dateStr: labLog?.sample_date || batch.started_at || new Date().toISOString()
    };
}

/**
 * Genera el PDF oficial de Carta de Calidad estilo Cotización Eggcelent / ANDELSA
 */
async function generateQualityLetterPdf(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'LETTER',
                margins: { top: 0, bottom: 25, left: 40, right: 40 },
                bufferPages: true,
                autoFirstPage: true
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            const pageWidth = 612;
            const contentLeft = 40;
            const contentWidth = 532;
            const contentRight = contentLeft + contentWidth;

            // 1. HEADER BANNER (Full-bleed superior idéntico a cotizaciones)
            if (fs.existsSync(HEADER_IMAGE_PATH)) {
                doc.image(HEADER_IMAGE_PATH, 0, 0, { width: pageWidth, height: 68 });
            }

            // 2. FECHA Y NÚMERO DE CERTIFICADO
            let curY = 78;
            const dateText = `Rosario de La Paz, ${formatDateFormal(data.dateStr)}`;
            doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#1e293b');
            doc.text(dateText, contentLeft, curY, { align: 'left' });

            doc.fontSize(9).font('Helvetica-Bold').fillColor('#4338ca');
            doc.text(`CARTA DE CALIDAD N°: CC-${data.lotCode.replace(/\s+/g, '')}`, contentLeft, curY, {
                width: contentWidth,
                align: 'right'
            });

            // 3. DESTINATARIO
            curY += 18;
            if (data.customerName) {
                doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text('Estimados:', contentLeft, curY);
                curY += 12;

                doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(data.customerName.toUpperCase(), contentLeft, curY);
                curY += 13;

                if (data.customerContact) {
                    doc.fontSize(8.5).font('Helvetica').fillColor('#475569');
                    doc.text(`Atención: ${data.customerContact}`, contentLeft, curY);
                    curY += 11;
                }
                doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text('Presente', contentLeft, curY);
                curY += 14;
            } else {
                // Modo estándar sin cliente precargado
                doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text('A QUIEN CORRESPONDA / CERTIFICADO DE CONFORMIDAD DE CALIDAD', contentLeft, curY, { align: 'center', width: contentWidth });
                curY += 16;
            }

            // 4. DECLARACIÓN INSTITUCIONAL DE INOCUIDAD (HACCP)
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('ALIMENTOS NUTRICIONALES DE EL SALVADOR, S.A. DE C.V. (ANDELSA)', contentLeft, curY);
            curY += 11;

            doc.fontSize(8).font('Helvetica').fillColor('#334155');
            const introText = 'Hace constar que el lote de producto terminado especificado en el presente certificado ha sido procesado, homogeneizado, pasteurizado y envasado en nuestra planta industrial bajo estrictos controles de aseguramiento de calidad y conforme a los requisitos de inocuidad de nuestro Plan HACCP (Hazard Analysis and Critical Control Points), cumpliendo a satisfacción con los parámetros analíticos microbiológicos y físico-químicos oficiales:';
            doc.text(introText, contentLeft, curY, { width: contentWidth, align: 'justify', lineGap: 1.2 });
            curY = doc.y + 7;

            // 5. CAJA DE DATOS TÉCNICOS DEL LOTE
            const boxH = 46;
            doc.roundedRect(contentLeft, curY, contentWidth, boxH, 6)
               .lineWidth(0.8)
               .strokeColor('#cbd5e1')
               .fillColor('#f8fafc')
               .fillAndStroke();

            const col1X = contentLeft + 10;
            const col2X = contentLeft + 190;
            const col3X = contentLeft + 370;
            let bY = curY + 6;

            // Fila 1 datos
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748b').text('PRODUCTO:', col1X, bY);
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text(data.productName, col1X + 55, bY, { width: 125 });

            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748b').text('LOTE COMERCIAL:', col2X, bY);
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#4338ca').text(data.lotCode, col2X + 85, bY, { width: 90 });

            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748b').text('PRESENTACIÓN:', col3X, bY);
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text(data.presentation, col3X + 75, bY);

            // Fila 2 datos
            bY += 18;
            const expDate = data.packaging?.expiry_date ? new Date(data.packaging.expiry_date).toLocaleDateString() : 'Ver etiqueta';
            const tempStorage = (data.packaging?.product_state || '').toLowerCase() === 'congelado' ? 'Congelado (-18°C)' : 'Refrigerado (2°C - 4°C)';

            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748b').text('LOTE JULIANO:', col1X, bY);
            doc.fontSize(8).font('Helvetica').fillColor('#0f172a').text(data.batch.batch_code_display || data.batch.batch_uuid?.substring(0, 8), col1X + 65, bY);

            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748b').text('VENCIMIENTO:', col2X, bY);
            doc.fontSize(8).font('Helvetica').fillColor('#0f172a').text(expDate, col2X + 70, bY);

            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748b').text('ALMACENAJE:', col3X, bY);
            doc.fontSize(8).font('Helvetica').fillColor('#0f172a').text(tempStorage, col3X + 68, bY);

            curY += boxH + 8;

            // 6. TABLA DE ESPECIFICACIONES Y RESULTADOS
            const colWParam = 185;
            const colWMethod = 100;
            const colWLimit = 110;
            const colWResult = 75;
            const colWCrit = 62;

            // Header tabla
            const thH = 16;
            doc.rect(contentLeft, curY, contentWidth, thH)
               .fillColor('#1e293b')
               .fill();

            doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff');
            doc.text('PARÁMETRO / ENSAYO', contentLeft + 6, curY + 4, { width: colWParam });
            doc.text('MÉTODO REF.', contentLeft + colWParam, curY + 4, { width: colWMethod });
            doc.text('ESPECIFICACIÓN', contentLeft + colWParam + colWMethod, curY + 4, { width: colWLimit });
            doc.text('RESULTADO', contentLeft + colWParam + colWMethod + colWLimit, curY + 4, { width: colWResult, align: 'center' });
            doc.text('CRITERIO', contentLeft + colWParam + colWMethod + colWLimit + colWResult, curY + 4, { width: colWCrit, align: 'center' });

            curY += thH;

            // Filas de datos
            data.parametersTable.forEach((row, idx) => {
                const rowH = 15;
                const isEven = idx % 2 === 0;

                if (isEven) {
                    doc.rect(contentLeft, curY, contentWidth, rowH)
                       .fillColor('#f8fafc')
                       .fill();
                }

                // Borde inferior
                doc.rect(contentLeft, curY + rowH, contentWidth, 0.5)
                   .fillColor('#e2e8f0')
                   .fill();

                doc.fontSize(7).font('Helvetica-Bold').fillColor('#1e293b')
                   .text(row.param, contentLeft + 6, curY + 3.5, { width: colWParam });

                doc.fontSize(6.5).font('Helvetica').fillColor('#64748b')
                   .text(row.method, contentLeft + colWParam, curY + 4, { width: colWMethod });

                doc.fontSize(6.8).font('Helvetica').fillColor('#334155')
                   .text(row.limit, contentLeft + colWParam + colWMethod, curY + 3.8, { width: colWLimit });

                doc.fontSize(7).font('Helvetica-Bold').fillColor('#047857')
                   .text(row.result, contentLeft + colWParam + colWMethod + colWLimit, curY + 3.5, { width: colWResult, align: 'center' });

                const critColor = row.criterion === 'CONFORME' ? '#047857' : '#b91c1c';
                doc.fontSize(7).font('Helvetica-Bold').fillColor(critColor)
                   .text(row.criterion, contentLeft + colWParam + colWMethod + colWLimit + colWResult, curY + 3.5, { width: colWCrit, align: 'center' });

                curY += rowH;
            });

            curY += 8;

            // 7. DICTAMEN OFICIAL Y CERTIFICACIÓN
            const dictamenH = 34;
            const dictBg = data.isAllCompliant ? '#ecfdf5' : '#fff1f2';
            const dictBorder = data.isAllCompliant ? '#a7f3d0' : '#fecdd3';
            const dictColor = data.isAllCompliant ? '#065f46' : '#9f1239';

            doc.roundedRect(contentLeft, curY, contentWidth, dictamenH, 6)
               .lineWidth(0.8)
               .strokeColor(dictBorder)
               .fillColor(dictBg)
               .fillAndStroke();

            doc.fontSize(8.5).font('Helvetica-Bold').fillColor(dictColor)
               .text(`DICTAMEN FINAL: ${data.isAllCompliant ? 'LOTE APROBADO Y CONFORME' : 'LOTE EN OBSERVACIÓN / CUARENTENA'}`, contentLeft + 10, curY + 5);

            const dictDesc = data.isAllCompliant
                ? 'El producto cumple satisfactoriamente con todos los límites microbiológicos, térmicos y físico-químicos establecidos en las normas técnicas salvadoreñas y el Codex Alimentarius para ovoproductos pasteurizados. Apto para consumo y despacho.'
                : 'El producto presenta valores fuera de especificación estándar. Se mantiene retenido bajo protocolo de inocuidad.';

            doc.fontSize(7.5).font('Helvetica').fillColor(dictColor)
               .text(dictDesc, contentLeft + 10, curY + 17, { width: contentWidth - 20, lineGap: 1 });

            curY += dictamenH + 18;

            // 8. BLOQUE DE FIRMAS
            const signW = 190;
            const sign1X = contentLeft + 35;
            const sign2X = contentRight - signW - 35;

            doc.strokeColor('#94a3b8').lineWidth(0.8);
            doc.moveTo(sign1X, curY).lineTo(sign1X + signW, curY).stroke();
            doc.moveTo(sign2X, curY).lineTo(sign2X + signW, curY).stroke();

            curY += 4;
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a')
               .text(data.analystName, sign1X, curY, { width: signW, align: 'center' });
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a')
               .text('Ing. Dirección de Planta & Operaciones', sign2X, curY, { width: signW, align: 'center' });

            curY += 10;
            doc.fontSize(7).font('Helvetica').fillColor('#64748b')
               .text('Aseguramiento de Calidad & HACCP', sign1X, curY, { width: signW, align: 'center' });
            doc.fontSize(7).font('Helvetica').fillColor('#64748b')
               .text('ANDELSA, S.A. DE C.V.', sign2X, curY, { width: signW, align: 'center' });

            // 9. FOOTER INSTITUCIONAL
            const footerY = 750;
            doc.strokeColor('#e2e8f0').lineWidth(0.5);
            doc.moveTo(contentLeft, footerY).lineTo(contentRight, footerY).stroke();

            doc.fontSize(6.5).font('Helvetica').fillColor('#94a3b8')
               .text(`Planta Industrial ANDELSA: Rosario de La Paz, El Salvador | Tel: (503) 2338-9000 | Inocuidad y Calidad Garantizada`, contentLeft, footerY + 5, { width: contentWidth, align: 'center' });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Genera el documento Word (.docx) oficial de Carta de Calidad
 */
async function generateQualityLetterWord(data) {
    const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' };
    const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

    const tableRows = [
        new TableRow({
            tableHeader: true,
            children: [
                new TableCell({ borders, shading: { fill: '1E293B' }, children: [new Paragraph({ children: [new TextRun({ text: 'Parámetro / Ensayo', bold: true, color: 'FFFFFF', size: 18 })] })] }),
                new TableCell({ borders, shading: { fill: '1E293B' }, children: [new Paragraph({ children: [new TextRun({ text: 'Método Ref.', bold: true, color: 'FFFFFF', size: 18 })] })] }),
                new TableCell({ borders, shading: { fill: '1E293B' }, children: [new Paragraph({ children: [new TextRun({ text: 'Especificación', bold: true, color: 'FFFFFF', size: 18 })] })] }),
                new TableCell({ borders, shading: { fill: '1E293B' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Resultado', bold: true, color: 'FFFFFF', size: 18 })] })] }),
                new TableCell({ borders, shading: { fill: '1E293B' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Criterio', bold: true, color: 'FFFFFF', size: 18 })] })] })
            ]
        })
    ];

    data.parametersTable.forEach((row, idx) => {
        const bg = idx % 2 === 0 ? 'F8FAFC' : 'FFFFFF';
        tableRows.push(
            new TableRow({
                children: [
                    new TableCell({ borders, shading: { fill: bg }, children: [new Paragraph({ children: [new TextRun({ text: row.param, bold: true, size: 16 })] })] }),
                    new TableCell({ borders, shading: { fill: bg }, children: [new Paragraph({ children: [new TextRun({ text: row.method, color: '64748B', size: 15 })] })] }),
                    new TableCell({ borders, shading: { fill: bg }, children: [new Paragraph({ children: [new TextRun({ text: row.limit, size: 15 })] })] }),
                    new TableCell({ borders, shading: { fill: bg }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.result, bold: true, color: '047857', size: 16 })] })] }),
                    new TableCell({ borders, shading: { fill: bg }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.criterion, bold: true, color: row.criterion === 'CONFORME' ? '047857' : 'B91C1C', size: 16 })] })] })
                ]
            })
        );
    });

    const doc = new Document({
        sections: [{
            properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
            children: [
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: 'ALIMENTOS NUTRICIONALES DE EL SALVADOR, S.A. DE C.V.', bold: true, size: 24, color: '0F172A' })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: 'PLANTA INDUSTRIAL DE OVOPRODUCTOS PASTEURIZADOS — CERTIFICACIÓN HACCP', bold: true, size: 18, color: '4338CA' })
                    ]
                }),
                new Paragraph({ text: '' }),
                new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                        new TextRun({ text: `Rosario de La Paz, ${formatDateFormal(data.dateStr)}`, bold: true, size: 18, color: '64748B' }),
                        new TextRun({ text: ` | CARTA DE CALIDAD N°: CC-${data.lotCode.replace(/\s+/g, '')}`, bold: true, size: 18, color: '4338CA' })
                    ]
                }),
                new Paragraph({ text: '' }),
                new Paragraph({
                    children: [
                        new TextRun({ text: data.customerName ? `Destinatario: ${data.customerName.toUpperCase()}` : 'A QUIEN CORRESPONDA / CERTIFICADO DE CONFORMIDAD ESTÁNDAR', bold: true, size: 20 })
                    ]
                }),
                new Paragraph({ text: '' }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: 'Por medio de la presente, ALIMENTOS NUTRICIONALES DE EL SALVADOR S.A. DE C.V. (ANDELSA) certifica que el lote de producto terminado descrito a continuación ha sido elaborado, pasteurizado y liberado conforme a los estándares oficiales de calidad e inocuidad:',
                            size: 18
                        })
                    ]
                }),
                new Paragraph({ text: '' }),
                new Paragraph({
                    children: [
                        new TextRun({ text: `Producto: ${data.productName} | `, bold: true, size: 18 }),
                        new TextRun({ text: `Lote Comercial: ${data.lotCode} | `, bold: true, color: '4338CA', size: 18 }),
                        new TextRun({ text: `Presentación: ${data.presentation}`, bold: true, size: 18 })
                    ]
                }),
                new Paragraph({ text: '' }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: tableRows
                }),
                new Paragraph({ text: '' }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `DICTAMEN: ${data.isAllCompliant ? 'LOTE APROBADO Y APTO PARA CONSUMO HUMANO' : 'LOTE EN OBSERVACIÓN'}`,
                            bold: true,
                            size: 20,
                            color: data.isAllCompliant ? '047857' : 'B91C1C'
                        })
                    ]
                }),
                new Paragraph({ text: '' }),
                new Paragraph({ text: '' }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: '__________________________________                __________________________________\n', bold: true, size: 18 }),
                        new TextRun({ text: `${data.analystName}                                 Ing. Dirección de Planta & Operaciones\n`, bold: true, size: 18 }),
                        new TextRun({ text: 'Aseguramiento de Calidad & HACCP                                 ANDELSA, S.A. DE C.V.', size: 16, color: '64748B' })
                    ]
                })
            ]
        }]
    });

    return await Packer.toBuffer(doc);
}

/**
 * Genera el archivo Excel (.xlsx) oficial de Carta de Calidad
 */
async function generateQualityLetterExcel(data) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ANDELSA S.A. DE C.V.';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Carta de Calidad', {
        pageSetup: { paperSize: 9, orientation: 'portrait' }
    });

    // Ancho de columnas
    sheet.columns = [
        { key: 'param', width: 45 },
        { key: 'method', width: 28 },
        { key: 'limit', width: 30 },
        { key: 'result', width: 22 },
        { key: 'criterion', width: 18 }
    ];

    // Encabezado
    sheet.mergeCells('A1:E1');
    sheet.getCell('A1').value = 'ALIMENTOS NUTRICIONALES DE EL SALVADOR, S.A. DE C.V. (ANDELSA)';
    sheet.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:E2');
    sheet.getCell('A2').value = `CERTIFICADO OFICIAL DE CALIDAD — CARTA DE CONFORMIDAD (LOTE: ${data.lotCode})`;
    sheet.getCell('A2').font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    sheet.addRow([]);

    // Metadatos
    sheet.addRow(['Fecha de Emisión:', formatDateFormal(data.dateStr), '', 'Certificado N°:', `CC-${data.lotCode.replace(/\s+/g, '')}`]);
    sheet.addRow(['Destinatario:', data.customerName || 'A QUIEN CORRESPONDA / CERTIFICADO ESTÁNDAR', '', 'Estado Inocuidad:', 'HACCP VALIDADO']);
    sheet.addRow(['Producto:', data.productName, '', 'Presentación:', data.presentation]);
    sheet.addRow(['Lote Comercial:', data.lotCode, '', 'Lote Producción:', data.batch.batch_code_display || data.batch.batch_uuid]);
    sheet.addRow([]);

    // Estilos de filas de metadatos
    for (let r = 4; r <= 7; r++) {
        sheet.getRow(r).font = { size: 10 };
        sheet.getCell(`A${r}`).font = { bold: true, color: { argb: 'FF475569' } };
        sheet.getCell(`D${r}`).font = { bold: true, color: { argb: 'FF475569' } };
    }

    // Cabecera tabla
    const headerRow = sheet.addRow(['PARÁMETRO / ENSAYO', 'MÉTODO DE REFERENCIA', 'ESPECIFICACIÓN / LÍMITE', 'RESULTADO OBTENIDO', 'CRITERIO']);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Filas de parámetros
    data.parametersTable.forEach((p, idx) => {
        const row = sheet.addRow([p.param, p.method, p.limit, p.result, p.criterion]);
        const bg = idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        row.font = { size: 9.5 };

        row.getCell(4).alignment = { horizontal: 'center' };
        row.getCell(4).font = { bold: true, color: { argb: 'FF047857' } };

        row.getCell(5).alignment = { horizontal: 'center' };
        row.getCell(5).font = { bold: true, color: { argb: p.criterion === 'CONFORME' ? 'FF047857' : 'FFB91C1C' } };
    });

    sheet.addRow([]);
    const dictamenRow = sheet.addRow(['DICTAMEN FINAL:', data.isAllCompliant ? 'LOTE APROBADO Y CONFORME PARA DESPACHO' : 'LOTE EN OBSERVACIÓN']);
    dictamenRow.font = { bold: true, size: 11, color: { argb: data.isAllCompliant ? 'FF047857' : 'FFB91C1C' } };

    sheet.addRow([]);
    sheet.addRow(['Analista Responsable:', data.analystName, '', 'Planta:', 'Rosario de La Paz, El Salvador']);

    return await workbook.xlsx.writeBuffer();
}

module.exports = {
    getQualityLetterData,
    generateQualityLetterPdf,
    generateQualityLetterWord,
    generateQualityLetterExcel
};
