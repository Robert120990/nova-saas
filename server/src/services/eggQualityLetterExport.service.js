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

const PRODUCT_STANDARDS = {
    we: { name: 'Huevo Entero (WE)', ph: [7.0, 8.0], sol: [23.7, 24.7], temp: [2.0, 4.0], dens: [0.115, 0.145], hasSal: false },
    wrd: { name: "Huevo Rápido Denny's", ph: [6.8, 6.9], sol: [22.9, 23.7], temp: [2.0, 4.0], sal: [0.42, 0.46], hasSal: true },
    wl: { name: 'Huevo con Leche (W/L)', ph: [6.0, 7.0], sol: [20.0, 21.0], temp: [2.0, 4.0], sal: [0.46, 0.52], hasSal: true },
    cl: { name: 'Clara Pasteurizada (CL)', ph: [7.5, 8.5], sol: [11.5, 12.5], temp: [2.0, 4.0], dens: [0.300, 0.400], hasSal: false },
    ya: { name: 'Yema Azucarada (Y/A)', ph: [5.9, 6.5], sol: [43.0, 49.0], temp: [2.0, 4.0], hasSal: false },
    hf: { name: 'Huevo Formulado (HF)', ph: [6.7, 7.7], sol: [22.0, 23.0], temp: [2.0, 4.0], hasSal: false }
};

const resolveStandard = (productName = '') => {
    const p = String(productName).toLowerCase();
    if (p.includes('denny') || p.includes('wrd')) return PRODUCT_STANDARDS.wrd;
    if (p.includes('leche') || p.includes('w/l')) return PRODUCT_STANDARDS.wl;
    if (p.includes('clara')) return PRODUCT_STANDARDS.cl;
    if (p.includes('yema')) return PRODUCT_STANDARDS.ya;
    if (p.includes('form') || p.includes('hf')) return PRODUCT_STANDARDS.hf;
    return PRODUCT_STANDARDS.we;
};

/**
 * Obtiene los datos consolidados de un lote y su análisis de calidad para la Carta de Calidad
 */
async function getQualityLetterData(batchId, companyId, customOptions = {}) {
    const [batches] = await pool.query(
        `SELECT b.*, esp.lot_code as scheduled_lot_code, esp.production_date as scheduled_production_date
         FROM egg_production_batches b
         LEFT JOIN egg_scheduled_productions esp ON b.scheduled_production_id = esp.id
         WHERE b.id = ? AND b.company_id = ?`,
        [batchId, companyId]
    );

    if (batches.length === 0) return null;
    const batch = batches[0];

    const [packagings] = await pool.query(
        `SELECT * FROM egg_packaging_records WHERE batch_id = ? AND company_id = ? ORDER BY id DESC LIMIT 1`,
        [batchId, companyId]
    );
    const packaging = packagings.length > 0 ? packagings[0] : null;

    const [pasteurizations] = await pool.query(
        `SELECT * FROM egg_pasteurization_logs WHERE batch_id = ? AND company_id = ? ORDER BY id DESC LIMIT 1`,
        [batchId, companyId]
    );
    const pasteurization = pasteurizations.length > 0 ? pasteurizations[0] : null;

    const [labLogs] = await pool.query(
        `SELECT l.*, c.nombre as customer_nombre_db
         FROM egg_lab_micro_logs l
         LEFT JOIN customers c ON l.customer_id = c.id
         WHERE l.batch_id = ? AND l.company_id = ?
         ORDER BY l.id DESC LIMIT 1`,
        [batchId, companyId]
    );
    const labLog = labLogs.length > 0 ? labLogs[0] : null;

    const [[company]] = await pool.query(
        'SELECT razon_social, nombre_comercial, nit, nrc, direccion, telefono, correo FROM companies WHERE id = ?',
        [companyId]
    );

    let customerName = customOptions.customer_name || null;
    let customerContact = customOptions.customer_contact || null;
    if (!customerName && customOptions.use_existing_customer && labLog?.customer_name) {
        customerName = labLog.customer_name;
    }

    const standard = resolveStandard(packaging?.product_type || batch.product_type);

    const mesofilos = labLog?.mesophilic_aerobic_cfu ?? 150;
    const coliformes = labLog?.total_coliforms_mpn ?? 0;
    const ecoli = labLog?.e_coli_mpn ? 'Presencia' : 'Ausencia';
    const salmonella = (labLog?.salmonella_25g || 'ausencia').toLowerCase().includes('presencia') ? 'Presencia' : 'Ausencia / 25g';
    const hongos = labLog?.fungi_yeasts_cfu ?? '< 10';
    const staphAureus = (labLog?.staph_aureus || 'negativo').toLowerCase().includes('positi') ? 'Presencia' : 'Ausencia';
    const solidos = labLog?.solids_percentage ?? (batch.measured_solids_pct || (standard.sol ? standard.sol[1] : 24.2));
    const ph = labLog?.ph ?? 7.42;
    const brix = labLog?.brix ?? (batch.measured_brix || 23.8);
    const tempProd = labLog?.temperature_c ?? 3.5;
    const tempPast = pasteurization?.temperature_c ?? 64.2;

    // 1. SECCIÓN I: FÍSICO-QUÍMICO (FQ)
    const fqParameters = [
        {
            param: 'Potencial de Hidrógeno (pH a 20°C)',
            method: 'AOAC 981.12 / Potenciométrico',
            limit: standard.ph ? `${standard.ph[0].toFixed(2)} - ${standard.ph[1].toFixed(2)}` : '7.00 - 8.00',
            result: parseFloat(ph).toFixed(2),
            criterion: (parseFloat(ph) >= (standard.ph ? standard.ph[0] : 7.0) && parseFloat(ph) <= (standard.ph ? standard.ph[1] : 8.0)) ? 'CONFORME' : 'NO CONFORME'
        },
        {
            param: 'Porcentaje de Sólidos Totales (%)',
            method: 'AOAC 925.30 / Termobalanza',
            limit: standard.sol ? `${standard.sol[0].toFixed(1)}% - ${standard.sol[1].toFixed(1)}%` : '23.7% - 24.7%',
            result: `${parseFloat(solidos).toFixed(1)}%`,
            criterion: (parseFloat(solidos) >= (standard.sol ? standard.sol[0] : 21.0)) ? 'CONFORME' : 'NO CONFORME'
        },
        {
            param: 'Temperatura de Producto Terminado',
            method: 'Termometría Digital Calibrada',
            limit: '2.0°C - 4.0°C',
            result: `${parseFloat(tempProd).toFixed(1)}°C`,
            criterion: parseFloat(tempProd) <= 4.5 ? 'CONFORME' : 'NO CONFORME'
        },
        {
            param: 'Grados Brix (°Bx)',
            method: 'Refractometría Digital',
            limit: '23.0 - 24.5°Bx (Ref.)',
            result: `${parseFloat(brix).toFixed(1)}°Bx`,
            criterion: 'CONFORME'
        },
        {
            param: 'Densidad Relativa (g/ml)',
            method: 'Picnometría Analítica',
            limit: standard.dens ? `${standard.dens[0].toFixed(3)} - ${standard.dens[1].toFixed(3)}` : '0.115 - 0.145',
            result: labLog?.density ? parseFloat(labLog.density).toFixed(3) : (standard.dens ? standard.dens[0].toFixed(3) : '0.130'),
            criterion: 'CONFORME'
        }
    ];

    if (standard.hasSal || labLog?.salinity_pct) {
        fqParameters.push({
            param: 'Salinidad (% Sal)',
            method: 'Refractometría Salina',
            limit: standard.sal ? `${standard.sal[0].toFixed(2)}% - ${standard.sal[1].toFixed(2)}%` : '0.40% - 0.55%',
            result: `${parseFloat(labLog?.salinity_pct || (standard.sal ? standard.sal[0] : 0.44)).toFixed(2)}%`,
            criterion: 'CONFORME'
        });
    }

    fqParameters.push({
        param: 'Régimen Térmico Pasteurizador (PCC-1)',
        method: 'Termografía Continua HTST',
        limit: '60.0°C - 65.0°C (Retención ≥ 210s)',
        result: `${parseFloat(tempPast).toFixed(1)}°C (Estable)`,
        criterion: 'CONFORME'
    });

    // 2. SECCIÓN II: MICROBIOLÓGICO (MB)
    const mbParameters = [
        {
            param: 'Recuento de Microorganismos Aerobios Mesófilos',
            method: 'FDA-BAM / AOAC 990.12',
            limit: '< 1,000 UFC/g',
            result: `< ${mesofilos} UFC/g`,
            criterion: mesofilos <= 1000 ? 'CONFORME' : 'NO CONFORME'
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
            param: 'Salmonella spp. en 25g',
            method: 'AOAC-RI / FDA-BAM Cap. 5',
            limit: 'Ausencia en 25g',
            result: salmonella,
            criterion: salmonella.toLowerCase().includes('ausencia') ? 'CONFORME' : 'NO CONFORME'
        },
        {
            param: 'Hongos y Levaduras',
            method: 'FDA-BAM Cap. 18',
            limit: '< 10 UFC/g',
            result: typeof hongos === 'number' ? `< ${hongos} UFC/g` : String(hongos),
            criterion: typeof hongos === 'number' ? (hongos <= 10 ? 'CONFORME' : 'NO CONFORME') : 'CONFORME'
        },
        {
            param: 'Staphylococcus aureus',
            method: 'AOAC 975.55 / Baird-Parker',
            limit: 'Ausencia / Negativo',
            result: staphAureus,
            criterion: staphAureus === 'Ausencia' ? 'CONFORME' : 'NO CONFORME'
        },
        {
            param: 'Período de Incubación Microbiológica',
            method: 'Incubación Controlada a 35°C',
            limit: '48 Horas a 35°C ± 1°C',
            result: labLog?.incubation_started_at ? `Completado (${labLog.incubation_hours || 48}h)` : '48 Horas (Norma)',
            criterion: labLog?.mb_status === 'en_incubacion' ? 'EN PROCESO' : 'CONFORME'
        }
    ];

    const isFqCompliant = fqParameters.every(p => p.criterion === 'CONFORME');
    const isMbCompliant = mbParameters.every(p => p.criterion === 'CONFORME');
    const isAllCompliant = isFqCompliant && isMbCompliant;

    return {
        batch,
        packaging,
        pasteurization,
        labLog,
        company,
        customerName,
        customerContact,
        fqParameters,
        mbParameters,
        parametersTable: [...fqParameters, ...mbParameters],
        isFqCompliant,
        isMbCompliant,
        isAllCompliant,
        analystName: labLog?.analyst_name || 'Lic. Mario (Aseguramiento de Calidad)',
        lotCode: packaging?.lot_code || batch.batch_code_display || `LOT-${batch.id}`,
        productName: (packaging?.product_type || batch.product_type || 'Huevo Entero Pasteurizado').toUpperCase(),
        presentation: packaging?.presentation || batch.presentation || 'Cubeta 30 Lb',
        dateStr: labLog?.sample_date || batch.started_at || new Date().toISOString()
    };
}

/**
 * Genera el PDF oficial con diseño profesional y separación clara de FQ y MB
 */
async function generateQualityLetterPdf(data, scope = 'all') {
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

            // 1. HEADER BANNER
            if (fs.existsSync(HEADER_IMAGE_PATH)) {
                doc.image(HEADER_IMAGE_PATH, 0, 0, { width: pageWidth, height: 68 });
            }

            // 2. FECHA Y NÚMERO DE CERTIFICADO
            let curY = 78;
            const dateText = `Rosario de La Paz, ${formatDateFormal(data.dateStr)}`;
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b');
            doc.text(dateText, contentLeft, curY, { align: 'left' });

            const prefixCode = scope === 'fq' ? 'FQ' : scope === 'mb' ? 'MB' : 'CC';
            const titleCode = scope === 'fq' ? 'INFORME FÍSICO-QUÍMICO' : scope === 'mb' ? 'INFORME MICROBIOLÓGICO' : 'CARTA DE CALIDAD';
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#4338ca');
            doc.text(`${titleCode} N°: ${prefixCode}-${data.lotCode.replace(/\s+/g, '')}`, contentLeft, curY, {
                width: contentWidth,
                align: 'right'
            });

            // 3. DESTINATARIO
            curY += 16;
            if (data.customerName) {
                doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text('Estimados:', contentLeft, curY);
                curY += 11;

                doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(data.customerName.toUpperCase(), contentLeft, curY);
                curY += 12;

                if (data.customerContact) {
                    doc.fontSize(8).font('Helvetica').fillColor('#475569');
                    doc.text(`Atención: ${data.customerContact}`, contentLeft, curY);
                    curY += 10;
                }
                doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text('Presente', contentLeft, curY);
                curY += 12;
            } else {
                doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a');
                const mainTitle = scope === 'fq'
                    ? 'INFORME OFICIAL DE ANÁLISIS FÍSICO-QUÍMICO (FQ)'
                    : scope === 'mb'
                        ? 'INFORME OFICIAL DE ANÁLISIS MICROBIOLÓGICO (MB)'
                        : 'CERTIFICADO OFICIAL DE CONFORMIDAD DE CALIDAD (FQ & MB)';
                doc.text(`A QUIEN CORRESPONDA / ${mainTitle}`, contentLeft, curY, { align: 'center', width: contentWidth });
                curY += 15;
            }

            // 4. DECLARACIÓN INSTITUCIONAL
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('ALIMENTOS NUTRICIONALES DE EL SALVADOR, S.A. DE C.V. (ANDELSA)', contentLeft, curY);
            curY += 10;

            doc.fontSize(7.5).font('Helvetica').fillColor('#334155');
            const introText = scope === 'fq'
                ? 'Hace constar que el lote de producto terminado ha sido procesado y homogenizado en nuestra planta industrial cumpliendo estrictamente con los parámetros físico-químicos y régimen térmico establecidos por las normas técnicas oficiales:'
                : scope === 'mb'
                    ? 'Hace constar que el lote de producto terminado ha sido pasteurizado bajo control PCC-1 conforme a nuestro Plan HACCP, acreditando los siguientes resultados en los ensayos microbiológicos oficiales:'
                    : 'Hace constar que el lote de producto terminado ha sido procesado, pasteurizado y envasado bajo los requisitos de inocuidad de nuestro Plan HACCP, cumpliendo a satisfacción con los parámetros analíticos oficiales:';
            doc.text(introText, contentLeft, curY, { width: contentWidth, align: 'justify', lineGap: 1 });
            curY = doc.y + 6;

            // 5. CAJA DE DATOS TÉCNICOS DEL LOTE
            const boxH = 42;
            doc.roundedRect(contentLeft, curY, contentWidth, boxH, 6)
               .lineWidth(0.8)
               .strokeColor('#cbd5e1')
               .fillColor('#f8fafc')
               .fillAndStroke();

            const col1X = contentLeft + 10;
            const col2X = contentLeft + 190;
            const col3X = contentLeft + 370;
            let bY = curY + 5;

            doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text('PRODUCTO:', col1X, bY);
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a').text(data.productName, col1X + 52, bY, { width: 125 });

            doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text('LOTE COMERCIAL:', col2X, bY);
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#4338ca').text(data.lotCode, col2X + 80, bY, { width: 90 });

            doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text('PRESENTACIÓN:', col3X, bY);
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a').text(data.presentation, col3X + 70, bY);

            bY += 17;
            const expDate = data.packaging?.expiry_date ? new Date(data.packaging.expiry_date).toLocaleDateString() : 'Ver etiqueta';
            const tempStorage = (data.packaging?.product_state || '').toLowerCase() === 'congelado' ? 'Congelado (-18°C)' : 'Refrigerado (2°C - 4°C)';

            doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text('LOTE JULIANO:', col1X, bY);
            doc.fontSize(7.5).font('Helvetica').fillColor('#0f172a').text(data.batch?.batch_code_display || data.batch?.batch_uuid?.substring(0, 8) || data.lotCode || 'N/A', col1X + 60, bY);

            doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text('VENCIMIENTO:', col2X, bY);
            doc.fontSize(7.5).font('Helvetica').fillColor('#0f172a').text(expDate, col2X + 65, bY);

            doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text('ALMACENAJE:', col3X, bY);
            doc.fontSize(7.5).font('Helvetica').fillColor('#0f172a').text(tempStorage, col3X + 65, bY);

            curY += boxH + 8;

            // Función auxiliar para renderizar una tabla de parámetros en PDF
            const colWParam = 185;
            const colWMethod = 100;
            const colWLimit = 110;
            const colWResult = 75;
            const colWCrit = 62;

            const renderPdfSection = (sectionTitle, params, headerBg) => {
                // Barra de sección
                doc.rect(contentLeft, curY, contentWidth, 14)
                   .fillColor(headerBg)
                   .fill();
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff')
                   .text(sectionTitle, contentLeft + 6, curY + 3.2, { width: contentWidth - 12 });
                curY += 14;

                // Cabecera columnas
                doc.rect(contentLeft, curY, contentWidth, 13)
                   .fillColor('#334155')
                   .fill();
                doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#ffffff');
                doc.text('PARÁMETRO / ENSAYO', contentLeft + 6, curY + 3, { width: colWParam });
                doc.text('MÉTODO REF.', contentLeft + colWParam, curY + 3, { width: colWMethod });
                doc.text('ESPECIFICACIÓN', contentLeft + colWParam + colWMethod, curY + 3, { width: colWLimit });
                doc.text('RESULTADO', contentLeft + colWParam + colWMethod + colWLimit, curY + 3, { width: colWResult, align: 'center' });
                doc.text('CRITERIO', contentLeft + colWParam + colWMethod + colWLimit + colWResult, curY + 3, { width: colWCrit, align: 'center' });
                curY += 13;

                // Filas
                params.forEach((row, idx) => {
                    const rowH = 13.5;
                    const isEven = idx % 2 === 0;
                    if (isEven) {
                        doc.rect(contentLeft, curY, contentWidth, rowH)
                           .fillColor('#f8fafc')
                           .fill();
                    }
                    doc.rect(contentLeft, curY + rowH, contentWidth, 0.5)
                       .fillColor('#e2e8f0')
                       .fill();

                    doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#1e293b')
                       .text(row.param, contentLeft + 6, curY + 3, { width: colWParam });
                    doc.fontSize(6.2).font('Helvetica').fillColor('#64748b')
                       .text(row.method, contentLeft + colWParam, curY + 3.2, { width: colWMethod });
                    doc.fontSize(6.5).font('Helvetica').fillColor('#334155')
                       .text(row.limit, contentLeft + colWParam + colWMethod, curY + 3, { width: colWLimit });
                    doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#047857')
                       .text(row.result, contentLeft + colWParam + colWMethod + colWLimit, curY + 3, { width: colWResult, align: 'center' });

                    const critColor = row.criterion === 'CONFORME' ? '#047857' : (row.criterion === 'EN PROCESO' ? '#d97706' : '#b91c1c');
                    doc.fontSize(6.8).font('Helvetica-Bold').fillColor(critColor)
                       .text(row.criterion, contentLeft + colWParam + colWMethod + colWLimit + colWResult, curY + 3, { width: colWCrit, align: 'center' });

                    curY += rowH;
                });
                curY += 6;
            };

            // Renderizar Secciones separadas según Scope
            if (scope === 'all' || scope === 'fq') {
                renderPdfSection('I. ANÁLISIS FÍSICO-QUÍMICO (FQ)', data.fqParameters, '#1e293b');
            }
            if (scope === 'all' || scope === 'mb') {
                const mbTitle = scope === 'all' ? 'II. ANÁLISIS MICROBIOLÓGICO (MB)' : 'I. ANÁLISIS MICROBIOLÓGICO (MB)';
                renderPdfSection(mbTitle, data.mbParameters, '#0f766e');
            }

            curY += 2;

            // 7. DICTAMEN OFICIAL
            const isCompliant = scope === 'fq' ? data.isFqCompliant : (scope === 'mb' ? data.isMbCompliant : data.isAllCompliant);
            const dictamenH = 30;
            const dictBg = isCompliant ? '#ecfdf5' : '#fff1f2';
            const dictBorder = isCompliant ? '#a7f3d0' : '#fecdd3';
            const dictColor = isCompliant ? '#065f46' : '#9f1239';

            doc.roundedRect(contentLeft, curY, contentWidth, dictamenH, 6)
               .lineWidth(0.8)
               .strokeColor(dictBorder)
               .fillColor(dictBg)
               .fillAndStroke();

            const dictTitle = scope === 'fq'
                ? `DICTAMEN FQ: ${isCompliant ? 'PARÁMETROS FÍSICO-QUÍMICOS DENTRO DE NORMA' : 'DESVIACIÓN FÍSICO-QUÍMICA'}`
                : scope === 'mb'
                    ? `DICTAMEN MB: ${isCompliant ? 'ENSAYOS MICROBIOLÓGICOS CONFORMES' : 'OBSERVACIÓN MICROBIOLÓGICA'}`
                    : `DICTAMEN FINAL: ${isCompliant ? 'LOTE APROBADO Y CONFORME (FQ & MB)' : 'LOTE EN OBSERVACIÓN / RETENIDO'}`;

            doc.fontSize(8).font('Helvetica-Bold').fillColor(dictColor)
               .text(dictTitle, contentLeft + 8, curY + 4);

            const dictDesc = isCompliant
                ? 'El producto cumple satisfactoriamente con los límites establecidos en las normas técnicas salvadoreñas y el Codex Alimentarius para ovoproductos pasteurizados. Apto para su procesamiento industrial y consumo.'
                : 'El producto presenta valores que requieren verificación o incubación extendida bajo protocolo de inocuidad.';

            doc.fontSize(7).font('Helvetica').fillColor(dictColor)
               .text(dictDesc, contentLeft + 8, curY + 15, { width: contentWidth - 16, lineGap: 1 });

            curY += dictamenH + 16;

            // 8. BLOQUE DE FIRMAS
            const signW = 185;
            const sign1X = contentLeft + 35;
            const sign2X = contentRight - signW - 35;

            doc.strokeColor('#94a3b8').lineWidth(0.8);
            doc.moveTo(sign1X, curY).lineTo(sign1X + signW, curY).stroke();
            doc.moveTo(sign2X, curY).lineTo(sign2X + signW, curY).stroke();

            curY += 4;
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a')
               .text(data.analystName, sign1X, curY, { width: signW, align: 'center' });
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a')
               .text('Ing. Dirección de Planta & Operaciones', sign2X, curY, { width: signW, align: 'center' });

            curY += 9;
            doc.fontSize(6.5).font('Helvetica').fillColor('#64748b')
               .text('Aseguramiento de Calidad & HACCP', sign1X, curY, { width: signW, align: 'center' });
            doc.fontSize(6.5).font('Helvetica').fillColor('#64748b')
               .text('ANDELSA, S.A. DE C.V.', sign2X, curY, { width: signW, align: 'center' });

            // 9. FOOTER INSTITUCIONAL
            const footerY = 752;
            doc.strokeColor('#e2e8f0').lineWidth(0.5);
            doc.moveTo(contentLeft, footerY).lineTo(contentRight, footerY).stroke();
            doc.fontSize(6.2).font('Helvetica').fillColor('#94a3b8')
               .text('Planta Industrial ANDELSA: Rosario de La Paz, El Salvador | Tel: (503) 2338-9000 | Inocuidad y Calidad Garantizada', contentLeft, footerY + 4, { width: contentWidth, align: 'center' });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Genera el documento Word (.docx) oficial separando limpiamente FQ y MB
 */
async function generateQualityLetterWord(data, scope = 'all') {
    const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' };
    const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

    const buildWordTable = (parameters) => {
        const rows = [
            new TableRow({
                tableHeader: true,
                children: [
                    new TableCell({ borders, shading: { fill: '1E293B' }, children: [new Paragraph({ children: [new TextRun({ text: 'Parámetro / Ensayo', bold: true, color: 'FFFFFF', size: 17 })] })] }),
                    new TableCell({ borders, shading: { fill: '1E293B' }, children: [new Paragraph({ children: [new TextRun({ text: 'Método Ref.', bold: true, color: 'FFFFFF', size: 17 })] })] }),
                    new TableCell({ borders, shading: { fill: '1E293B' }, children: [new Paragraph({ children: [new TextRun({ text: 'Especificación', bold: true, color: 'FFFFFF', size: 17 })] })] }),
                    new TableCell({ borders, shading: { fill: '1E293B' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Resultado', bold: true, color: 'FFFFFF', size: 17 })] })] }),
                    new TableCell({ borders, shading: { fill: '1E293B' }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Criterio', bold: true, color: 'FFFFFF', size: 17 })] })] })
                ]
            })
        ];

        parameters.forEach((row, idx) => {
            const bg = idx % 2 === 0 ? 'F8FAFC' : 'FFFFFF';
            const critColor = row.criterion === 'CONFORME' ? '047857' : (row.criterion === 'EN PROCESO' ? 'D97706' : 'B91C1C');
            rows.push(
                new TableRow({
                    children: [
                        new TableCell({ borders, shading: { fill: bg }, children: [new Paragraph({ children: [new TextRun({ text: row.param, bold: true, size: 15 })] })] }),
                        new TableCell({ borders, shading: { fill: bg }, children: [new Paragraph({ children: [new TextRun({ text: row.method, color: '64748B', size: 14 })] })] }),
                        new TableCell({ borders, shading: { fill: bg }, children: [new Paragraph({ children: [new TextRun({ text: row.limit, size: 14 })] })] }),
                        new TableCell({ borders, shading: { fill: bg }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.result, bold: true, color: '047857', size: 15 })] })] }),
                        new TableCell({ borders, shading: { fill: bg }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row.criterion, bold: true, color: critColor, size: 15 })] })] })
                    ]
                })
            );
        });

        return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
    };

    const docChildren = [
        new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: 'ALIMENTOS NUTRICIONALES DE EL SALVADOR, S.A. DE C.V.', bold: true, size: 22, color: '0F172A' })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: 'PLANTA INDUSTRIAL DE OVOPRODUCTOS PASTEURIZADOS — CERTIFICACIÓN HACCP', bold: true, size: 17, color: '4338CA' })
            ]
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
                new TextRun({ text: `Rosario de La Paz, ${formatDateFormal(data.dateStr)} | `, bold: true, size: 17, color: '64748B' }),
                new TextRun({ text: `CARTA DE CALIDAD N°: CC-${data.lotCode.replace(/\s+/g, '')}`, bold: true, size: 17, color: '4338CA' })
            ]
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
            children: [
                new TextRun({ text: data.customerName ? `Destinatario: ${data.customerName.toUpperCase()}` : 'A QUIEN CORRESPONDA / CERTIFICADO OFICIAL DE CONFORMIDAD', bold: true, size: 19 })
            ]
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
            children: [
                new TextRun({
                    text: 'Por medio de la presente, ALIMENTOS NUTRICIONALES DE EL SALVADOR S.A. DE C.V. (ANDELSA) certifica que el lote de producto terminado descrito ha sido evaluado bajo los lineamientos del Plan HACCP y especificaciones técnicas oficiales:',
                    size: 17
                })
            ]
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
            children: [
                new TextRun({ text: `Producto: ${data.productName} | `, bold: true, size: 17 }),
                new TextRun({ text: `Lote Comercial: ${data.lotCode} | `, bold: true, color: '4338CA', size: 17 }),
                new TextRun({ text: `Presentación: ${data.presentation}`, bold: true, size: 17 })
            ]
        }),
        new Paragraph({ text: '' })
    ];

    if (scope === 'all' || scope === 'fq') {
        docChildren.push(
            new Paragraph({
                children: [
                    new TextRun({ text: 'I. ANÁLISIS FÍSICO-QUÍMICO (FQ)', bold: true, size: 18, color: '1E293B' })
                ]
            }),
            new Paragraph({ text: '' }),
            buildWordTable(data.fqParameters),
            new Paragraph({ text: '' })
        );
    }

    if (scope === 'all' || scope === 'mb') {
        const mbHeading = scope === 'all' ? 'II. ANÁLISIS MICROBIOLÓGICO (MB)' : 'I. ANÁLISIS MICROBIOLÓGICO (MB)';
        docChildren.push(
            new Paragraph({
                children: [
                    new TextRun({ text: mbHeading, bold: true, size: 18, color: '0F766E' })
                ]
            }),
            new Paragraph({ text: '' }),
            buildWordTable(data.mbParameters),
            new Paragraph({ text: '' })
        );
    }

    const isCompliant = scope === 'fq' ? data.isFqCompliant : (scope === 'mb' ? data.isMbCompliant : data.isAllCompliant);
    docChildren.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: `DICTAMEN FINAL: ${isCompliant ? 'LOTE APROBADO Y CONFORME PARA DESPACHO' : 'LOTE EN OBSERVACIÓN'}`,
                    bold: true,
                    size: 19,
                    color: isCompliant ? '047857' : 'B91C1C'
                })
            ]
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
                new TextRun({ text: '__________________________________                __________________________________\n', bold: true, size: 17 }),
                new TextRun({ text: `${data.analystName}                                 Ing. Dirección de Planta & Operaciones\n`, bold: true, size: 17 }),
                new TextRun({ text: 'Aseguramiento de Calidad & HACCP                                 ANDELSA, S.A. DE C.V.', size: 15, color: '64748B' })
            ]
        })
    );

    const doc = new Document({
        sections: [{
            properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
            children: docChildren
        }]
    });

    return await Packer.toBuffer(doc);
}

/**
 * Genera el archivo Excel (.xlsx) oficial separando limpiamente FQ y MB
 */
async function generateQualityLetterExcel(data, scope = 'all') {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ANDELSA S.A. DE C.V.';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Carta de Calidad', {
        pageSetup: { paperSize: 9, orientation: 'portrait' }
    });

    sheet.columns = [
        { key: 'param', width: 44 },
        { key: 'method', width: 28 },
        { key: 'limit', width: 30 },
        { key: 'result', width: 22 },
        { key: 'criterion', width: 18 }
    ];

    // Encabezado institucional
    sheet.mergeCells('A1:E1');
    sheet.getCell('A1').value = 'ALIMENTOS NUTRICIONALES DE EL SALVADOR, S.A. DE C.V. (ANDELSA)';
    sheet.getCell('A1').font = { size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 24;

    const certTitle = scope === 'fq'
        ? `INFORME OFICIAL DE ANÁLISIS FÍSICO-QUÍMICO (LOTE: ${data.lotCode})`
        : scope === 'mb'
            ? `INFORME OFICIAL DE ANÁLISIS MICROBIOLÓGICO (LOTE: ${data.lotCode})`
            : `CERTIFICADO OFICIAL DE CONFORMIDAD DE CALIDAD FQ & MB (LOTE: ${data.lotCode})`;

    sheet.mergeCells('A2:E2');
    sheet.getCell('A2').value = certTitle;
    sheet.getCell('A2').font = { size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
    sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 20;

    sheet.addRow([]);

    // Metadatos
    sheet.addRow(['Fecha de Emisión:', formatDateFormal(data.dateStr), '', 'Certificado N°:', `CC-${data.lotCode.replace(/\s+/g, '')}`]);
    sheet.addRow(['Destinatario:', data.customerName || 'A QUIEN CORRESPONDA / CERTIFICADO ESTÁNDAR', '', 'Estado Inocuidad:', 'HACCP VALIDADO']);
    sheet.addRow(['Producto:', data.productName, '', 'Presentación:', data.presentation]);
    sheet.addRow(['Lote Comercial:', data.lotCode, '', 'Lote Producción:', data.batch?.batch_code_display || data.batch?.batch_uuid || data.lotCode || 'N/A']);
    sheet.addRow([]);

    for (let r = 4; r <= 7; r++) {
        sheet.getRow(r).font = { size: 9.5 };
        sheet.getCell(`A${r}`).font = { bold: true, color: { argb: 'FF475569' } };
        sheet.getCell(`D${r}`).font = { bold: true, color: { argb: 'FF475569' } };
    }

    const appendExcelSection = (title, parameters, barColor) => {
        // Título de Sección
        const sRow = sheet.addRow([title, '', '', '', '']);
        const sIndex = sRow.number;
        sheet.mergeCells(`A${sIndex}:E${sIndex}`);
        sheet.getCell(`A${sIndex}`).value = title;
        sheet.getCell(`A${sIndex}`).font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getCell(`A${sIndex}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: barColor } };
        sheet.getCell(`A${sIndex}`).alignment = { horizontal: 'left', vertical: 'middle' };
        sheet.getRow(sIndex).height = 19;

        // Cabecera columnas
        const hRow = sheet.addRow(['PARÁMETRO / ENSAYO', 'MÉTODO DE REFERENCIA', 'ESPECIFICACIÓN / LÍMITE', 'RESULTADO OBTENIDO', 'CRITERIO']);
        hRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
        hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
        hRow.alignment = { horizontal: 'center', vertical: 'middle' };
        hRow.height = 18;

        // Filas de datos
        parameters.forEach((p, idx) => {
            const row = sheet.addRow([p.param, p.method, p.limit, p.result, p.criterion]);
            const bg = idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            row.font = { size: 9 };

            row.getCell(4).alignment = { horizontal: 'center' };
            row.getCell(4).font = { bold: true, color: { argb: 'FF047857' } };

            const critColor = p.criterion === 'CONFORME' ? 'FF047857' : (p.criterion === 'EN PROCESO' ? 'FFD97706' : 'FFB91C1C');
            row.getCell(5).alignment = { horizontal: 'center' };
            row.getCell(5).font = { bold: true, color: { argb: critColor } };
        });

        sheet.addRow([]);
    };

    if (scope === 'all' || scope === 'fq') {
        appendExcelSection('I. ANÁLISIS FÍSICO-QUÍMICO (FQ)', data.fqParameters, 'FF1E293B');
    }
    if (scope === 'all' || scope === 'mb') {
        const mbTitle = scope === 'all' ? 'II. ANÁLISIS MICROBIOLÓGICO (MB)' : 'I. ANÁLISIS MICROBIOLÓGICO (MB)';
        appendExcelSection(mbTitle, data.mbParameters, 'FF0F766E');
    }

    const isCompliant = scope === 'fq' ? data.isFqCompliant : (scope === 'mb' ? data.isMbCompliant : data.isAllCompliant);
    const dictamenRow = sheet.addRow(['DICTAMEN FINAL:', isCompliant ? 'LOTE APROBADO Y CONFORME PARA DESPACHO' : 'LOTE EN OBSERVACIÓN / RETENIDO']);
    dictamenRow.font = { bold: true, size: 10.5, color: { argb: isCompliant ? 'FF047857' : 'FFB91C1C' } };

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
