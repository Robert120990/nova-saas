const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    AlignmentType,
    WidthType,
    BorderStyle,
    HeadingLevel,
    ShadingType
} = require('docx');

/**
 * Formatea fechas a formato DD/MM/YYYY
 */
function formatDate(d) {
    if (!d) return '---';
    if (typeof d === 'string') {
        const parts = d.split('T')[0].split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '---';
    const day = String(dt.getUTCDate()).padStart(2, '0');
    const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const year = dt.getUTCFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Obtiene los datos consolidados de la recepción para el reporte LAB 001
 */
async function getRawMaterialLab001Data(rawMaterialId, companyId) {
    const [rows] = await pool.query(
        `SELECT rm.*, 
                p.nombre as provider_name, 
                p.nombre_comercial as provider_commercial_name,
                p.pais as provider_country,
                c.nombre as company_name,
                c.nit as company_nit,
                c.nrc as company_nrc
         FROM egg_raw_materials rm
         LEFT JOIN providers p ON rm.provider_id = p.id
         LEFT JOIN companies c ON rm.company_id = c.id
         WHERE rm.id = ? AND rm.company_id = ?`,
        [rawMaterialId, companyId]
    );

    if (rows.length === 0) return null;
    const rm = rows[0];

    let labJson = {};
    if (rm.quality_lab_report_json) {
        try {
            labJson = typeof rm.quality_lab_report_json === 'string'
                ? JSON.parse(rm.quality_lab_report_json)
                : rm.quality_lab_report_json;
        } catch (e) {
            labJson = {};
        }
    }

    const isForeign = labJson.provider_type
        ? labJson.provider_type.toUpperCase() === 'EXTRANJERO'
        : (rm.provider_country && !['EL SALVADOR', 'SV', 'SALVADOR'].includes(rm.provider_country.toUpperCase()));

    return {
        id: rm.id,
        company_name: rm.company_name || 'ALIMENTOS NUTRICIONALES DE EL SALVADOR, S.A. DE C.V.',
        company_nit: rm.company_nit || '',
        company_nrc: rm.company_nrc || '',
        classification: rm.egg_classification || labJson.egg_classification || 'GRADO A',
        provider_name: rm.provider_commercial_name || rm.provider_name || 'PROVEEDOR REGISTRADO',
        is_foreign: isForeign,
        farm_name: rm.farm_name || labJson.farm_name || '---',
        provider_lot: rm.provider_lot || `LOTE-${rm.id}`,
        production_date: rm.production_date || labJson.production_date || '',
        expiration_date: rm.expiration_date || labJson.expiration_date || '',
        total_boxes: rm.total_boxes || 0,
        remission_note: rm.remission_note || labJson.remission_note || '---',
        plant_entry_date: labJson.plant_entry_date || rm.fecha || rm.created_at,
        reception_date: labJson.reception_date || rm.fecha || rm.created_at,
        analysis_date: labJson.analysis_date || rm.quality_date || rm.created_at,
        analysis_time: labJson.analysis_time || (rm.quality_date ? new Date(rm.quality_date).toTimeString().substring(0, 5) : '---'),
        egg_color: (rm.egg_color || 'BLANCO').toUpperCase(),
        egg_size: (rm.egg_size || 'L').toUpperCase(),
        sample_egg_weight_g: rm.sample_egg_weight_g || labJson.sample_egg_weight_g || (rm.weight_lbs && rm.total_boxes ? Math.round((rm.weight_lbs * 453.592) / (rm.total_boxes * 360) * 10) / 10 : '---'),
        physicochemical: labJson.physicochemical || {},
        organoleptic: labJson.organoleptic || {},
        transport_storage: labJson.transport_storage || {
            limpieza_camion: 'CONFORME / LIMPIO',
            apariencia_cajas: 'BUEN ESTADO / LIMPIAS',
            temperatura_transporte: rm.truck_temperature_c ? `${rm.truck_temperature_c} °C` : (rm.temperature_c ? `${rm.temperature_c} °C` : '---')
        },
        observations: rm.quality_notes || labJson.observations || '',
        inspector_name: rm.quality_inspector_name || labJson.inspector_name || rm.operator_name || 'Inspector de Calidad',
        reviewed_by: rm.quality_reviewed_by || labJson.reviewed_by || 'Jefe de Control de Calidad'
    };
}

/**
 * Genera el documento PDF oficial LAB 001 con diseño moderno, ejecutivo y legible
 */
async function generateRawMaterialLab001Pdf(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'LETTER', // 612 x 792 pt
                margins: { top: 22, bottom: 22, left: 32, right: 32 },
                bufferPages: true,
                autoFirstPage: true
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            const startX = 32;
            const contentWidth = 548;
            const endX = startX + contentWidth;

            // -------------------------------------------------------------
            // 1. ENCABEZADO MODERNO CON ACCENTO CROMÁTICO
            // -------------------------------------------------------------
            // Franja decorativa superior en ámbar (#d97706) y slate (#0f172a)
            doc.rect(startX, 18, contentWidth, 3.5).fillColor('#d97706').fill();

            const headerY = 25;

            // Logo estilizado eggcelent
            const logoW = 72;
            const logoH = 34;
            doc.save();
            doc.roundedRect(startX, headerY, logoW, logoH, 4)
               .fillColor('#0f172a')
               .fill();
            doc.ellipse(startX + 36, headerY + 14, 11, 13)
               .fillColor('#ffffff')
               .fill();
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff')
               .text('eggcelent.', startX, headerY + 23, { width: logoW, align: 'center' });
            doc.restore();

            // Títulos Centrales
            const centerLeft = startX + logoW + 12;
            const centerWidth = contentWidth - logoW - 120;
            doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a')
               .text('LABORATORIO DE CONTROL DE CALIDAD & INOCUIDAD', centerLeft, headerY + 1, { width: centerWidth, align: 'center' });
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#475569')
               .text('DICTAMEN TÉCNICO DE CONTROL DE MATERIA PRIMA (HUEVO EN CÁSCARA)', centerLeft, headerY + 14, { width: centerWidth, align: 'center' });
            doc.fontSize(7).font('Helvetica').fillColor('#64748b')
               .text(data.company_name || 'ALIMENTOS NUTRICIONALES DE EL SALVADOR, S.A. DE C.V.', centerLeft, headerY + 25, { width: centerWidth, align: 'center' });

            // Badge oficial LAB 001 a la derecha
            const badgeW = 95;
            const badgeH = 32;
            const badgeX = endX - badgeW;
            doc.save();
            doc.roundedRect(badgeX, headerY, badgeW, badgeH, 4)
               .fillColor('#f8fafc')
               .fill()
               .strokeColor('#cbd5e1')
               .lineWidth(0.8)
               .stroke();
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a')
               .text('LAB 001', badgeX, headerY + 5, { width: badgeW, align: 'center' });
            doc.fontSize(7).font('Helvetica').fillColor('#475569')
               .text('Rev. 7.03.24', badgeX, headerY + 18, { width: badgeW, align: 'center' });
            doc.restore();

            // -------------------------------------------------------------
            // TARJETA DE CLASIFICACIÓN DEL HUEVO DESTACADA
            // -------------------------------------------------------------
            const classY = headerY + 38;
            const classH = 22;

            const classification = String(data.classification || 'Grado A').toUpperCase();
            let classBg = '#ecfdf5';
            let classBorder = '#059669';
            let classText = '#065f46';

            if (classification.includes('GRADO B') || classification.includes('INDUSTRIAL')) {
                classBg = '#fffbeb';
                classBorder = '#d97706';
                classText = '#92400e';
            } else if (classification.includes('NO CONFORME') || classification.includes('RECHAZADO')) {
                classBg = '#fef2f2';
                classBorder = '#dc2626';
                classText = '#991b1b';
            }

            doc.save();
            doc.roundedRect(startX, classY, contentWidth, classH, 4)
               .fillColor(classBg)
               .fill()
               .strokeColor(classBorder)
               .lineWidth(1)
               .stroke();

            doc.fontSize(8).font('Helvetica-Bold').fillColor(classText)
               .text('CLASIFICACIÓN OFICIAL DEL HUEVO SEGÚN ANÁLISIS DE LABORATORIO:', startX + 12, classY + 6.5);
            doc.fontSize(9.5).font('Helvetica-Bold').fillColor(classText)
               .text(classification, startX, classY + 5.5, { width: contentWidth - 14, align: 'right' });
            doc.restore();

            // -------------------------------------------------------------
            // 2. SECCIÓN: DATOS GENERALES Y TRAZABILIDAD (GRID 2 COLUMNAS)
            // -------------------------------------------------------------
            let curY = classY + classH + 8;

            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a')
               .text('1. DATOS GENERALES & TRAZABILIDAD DE ORIGEN', startX, curY);

            curY += 10;
            const dgY = curY;
            const dgRowH = 12.8;
            const colHalfW = contentWidth / 2;
            const labelW = 100;

            const leftRows = [
                {
                    label: 'PROVEEDOR',
                    render: (x, y, w) => {
                        const provName = String(data.provider_name || '').toUpperCase();
                        const isLoc = !data.is_foreign;
                        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a')
                           .text(provName, x, y + 2.5, { width: w - 55, ellipsis: true });
                        // Badge de origen
                        const originBg = isLoc ? '#dcfce7' : '#e0e7ff';
                        const originTextColor = isLoc ? '#15803d' : '#3730a3';
                        const badgeTxt = isLoc ? 'LOCAL' : 'EXTRANJERO';
                        doc.save();
                        doc.roundedRect(x + w - 52, y + 1.5, 50, 9, 2)
                           .fillColor(originBg).fill();
                        doc.fontSize(6).font('Helvetica-Bold').fillColor(originTextColor)
                           .text(badgeTxt, x + w - 52, y + 2.8, { width: 50, align: 'center' });
                        doc.restore();
                    }
                },
                { label: 'GRANJA DE ORIGEN', val: String(data.farm_name || '---').toUpperCase() },
                { label: 'LOTE PROVEEDOR', val: String(data.provider_lot || '---').toUpperCase() },
                { label: 'FECHA PRODUCCIÓN', val: formatDate(data.production_date) },
                { label: 'FECHA VENCIMIENTO', val: formatDate(data.expiration_date) },
                { label: 'CANTIDAD RECIBIDA', val: data.total_boxes ? `${data.total_boxes} CAJAS (~${(data.total_boxes * 360).toLocaleString()} huevos)` : '---' }
            ];

            const rightRows = [
                { label: 'NOTA DE REMISIÓN', val: String(data.remission_note || '---').toUpperCase() },
                { label: 'INGRESO A PLANTA', val: formatDate(data.plant_entry_date) },
                { label: 'FECHA RECEPCIÓN', val: formatDate(data.reception_date) },
                {
                    label: 'FECHA ANÁLISIS',
                    val: `${formatDate(data.analysis_date)}  •  HORA: ${data.analysis_time || '---'}`
                },
                { label: 'COLOR CASCARÓN', val: String(data.egg_color || 'BLANCO').toUpperCase() },
                { label: 'TAMAÑO & PESO PROMEDIO', val: `${String(data.egg_size || 'L').toUpperCase()}  •  ${data.sample_egg_weight_g ? `${data.sample_egg_weight_g} g / huevo` : '---'}` }
            ];

            const maxDgRows = Math.max(leftRows.length, rightRows.length);
            const totalDgH = maxDgRows * dgRowH;

            // Fondo contenedor general
            doc.save();
            doc.roundedRect(startX, dgY, contentWidth, totalDgH, 3)
               .fillColor('#f8fafc').fill()
               .strokeColor('#cbd5e1').lineWidth(0.6).stroke();
            // Línea central vertical
            doc.moveTo(startX + colHalfW, dgY).lineTo(startX + colHalfW, dgY + totalDgH).strokeColor('#cbd5e1').lineWidth(0.6).stroke();
            doc.restore();

            // Dibujar fila izquierda
            leftRows.forEach((r, i) => {
                const rY = dgY + (i * dgRowH);
                if (i > 0) {
                    doc.moveTo(startX, rY).lineTo(startX + colHalfW, rY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
                }
                doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#475569')
                   .text(r.label, startX + 6, rY + 3, { width: labelW - 10 });
                if (r.render) {
                    r.render(startX + labelW, rY, colHalfW - labelW - 6);
                } else {
                    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a')
                       .text(r.val, startX + labelW, rY + 2.5, { width: colHalfW - labelW - 6, ellipsis: true });
                }
            });

            // Dibujar fila derecha
            rightRows.forEach((r, i) => {
                const rY = dgY + (i * dgRowH);
                const rStartX = startX + colHalfW;
                if (i > 0) {
                    doc.moveTo(rStartX, rY).lineTo(endX, rY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
                }
                doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#475569')
                   .text(r.label, rStartX + 6, rY + 3, { width: labelW - 10 });
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a')
                   .text(r.val, rStartX + labelW, rY + 2.5, { width: colHalfW - labelW - 6, ellipsis: true });
            });

            curY = dgY + totalDgH + 7;

            // -------------------------------------------------------------
            // 3. SECCIÓN: ANÁLISIS FISICOQUÍMICOS (13 PARÁMETROS)
            // -------------------------------------------------------------
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a')
               .text('2. ANÁLISIS FISICOQUÍMICOS DE LABORATORIO', startX, curY);

            curY += 9;
            const fqTableY = curY;
            const fqHeaderH = 13.5;
            const fqRowH = 11.8;
            const fqCol1W = 248;
            const fqCol2W = 150;
            const fqCol3W = 150;

            // Cabecera tabla fisicoquímica
            doc.save();
            doc.roundedRect(startX, fqTableY, contentWidth, fqHeaderH, 2)
               .fillColor('#1e293b').fill();
            doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#ffffff')
               .text('PARÁMETRO / ENSAYO ANALÍTICO', startX + 8, fqTableY + 3.5)
               .text('ENSAYO 1 / LECTURA', startX + fqCol1W, fqTableY + 3.5, { width: fqCol2W, align: 'center' })
               .text('ENSAYO 2 / ESPECIFICACIÓN', startX + fqCol1W + fqCol2W, fqTableY + 3.5, { width: fqCol3W, align: 'center' });
            doc.restore();

            const phys = data.physicochemical || {};

            const fqParams = [
                { key: 'granja', label: 'GRANJA / PROCEDENCIA', def1: data.farm_name || 'CONFORME', def2: 'REGISTRADA' },
                { key: 'espesor_celda_aire', label: 'ESPESOR CELDA DE AIRE (mm)', def1: '', def2: '< 4.0 mm' },
                { key: 'ph_huevo_fresco', label: 'pH HUEVO FRESCO ENTERO', def1: '', def2: '7.4 - 7.9' },
                { key: 'solidos_huevo_fresco', label: 'SÓLIDOS TOTALES HUEVO ENTERO (%)', def1: '', def2: '≥ 23.5 %' },
                { key: 'firmeza_albumina', label: 'FIRMEZA DE ALBÚMINA (UNIDADES HAUGH)', def1: '', def2: '≥ 70 UH' },
                { key: 'ph_albumina', label: 'pH DE ALBÚMINA (CLARA)', def1: '', def2: '8.5 - 9.3' },
                { key: 'solidos_albumina', label: 'SÓLIDOS DE ALBÚMINA (%)', def1: '', def2: '≥ 11.5 %' },
                { key: 'firmeza_yema', label: 'FIRMEZA / ÍNDICE DE YEMA', def1: '', def2: '0.40 - 0.44' },
                { key: 'forma_yema', label: 'FORMA DE LA YEMA (SEMIESFÉRICA)', def1: '', def2: 'CONFORME' },
                { key: 'color_yema', label: 'COLOR DE YEMA (ABANICO ROCHE)', def1: '', def2: 'ESCALA 10 - 13' },
                { key: 'ph_yema', label: 'pH DE YEMA', def1: '', def2: '6.0 - 6.4' },
                { key: 'solidos_yema', label: 'SÓLIDOS DE YEMA (%)', def1: '', def2: '≥ 43.0 %' },
                { key: 'estado_separacion', label: 'ESTADO DE SEPARACIÓN (YEMA / CLARA)', def1: '', def2: 'ÓPTIMO / LIMPIO' }
            ];

            fqParams.forEach((param, i) => {
                const rY = fqTableY + fqHeaderH + (i * fqRowH);
                const isEven = i % 2 === 0;

                doc.save();
                doc.rect(startX, rY, contentWidth, fqRowH)
                   .fillColor(isEven ? '#ffffff' : '#f8fafc').fill()
                   .strokeColor('#e2e8f0').lineWidth(0.5).stroke();

                doc.moveTo(startX + fqCol1W, rY).lineTo(startX + fqCol1W, rY + fqRowH).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
                doc.moveTo(startX + fqCol1W + fqCol2W, rY).lineTo(startX + fqCol1W + fqCol2W, rY + fqRowH).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#1e293b')
                   .text(param.label, startX + 8, rY + 2.5, { width: fqCol1W - 14 });

                const item = phys[param.key] || {};
                const val1 = (item.val1 !== undefined && item.val1 !== null && String(item.val1).trim() !== '') ? String(item.val1) : (param.def1 || '---');
                const val2 = (item.val2 !== undefined && item.val2 !== null && String(item.val2).trim() !== '') ? String(item.val2) : (param.def2 || '---');

                doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a')
                   .text(val1, startX + fqCol1W, rY + 2.5, { width: fqCol2W, align: 'center' });
                doc.fontSize(6.8).font('Helvetica').fillColor('#64748b')
                   .text(val2, startX + fqCol1W + fqCol2W, rY + 2.5, { width: fqCol3W, align: 'center' });
                doc.restore();
            });

            curY = fqTableY + fqHeaderH + (fqParams.length * fqRowH) + 6;

            // -------------------------------------------------------------
            // 4. SECCIÓN: EVALUACIÓN ORGANOLÉPTICA & TRANSPORTE (DOS PANELES)
            // -------------------------------------------------------------
            const organoleptic = data.organoleptic || {};
            const transport = data.transport_storage || {};
            const cCons = (organoleptic.consistencia_cascaron || 'resistente').toLowerCase();

            const sec3PanelW = 320;
            const sec4PanelW = contentWidth - sec3PanelW - 8;
            const panelsH = 60;

            // Panel Izquierdo: Organoléptico
            doc.save();
            doc.roundedRect(startX, curY, sec3PanelW, panelsH, 3)
               .fillColor('#ffffff').fill()
               .strokeColor('#cbd5e1').lineWidth(0.6).stroke();

            doc.rect(startX, curY, sec3PanelW, 13)
               .fillColor('#f1f5f9').fill();
            doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#0f172a')
               .text('3. EVALUACIÓN ORGANOLÉPTICA Y CASCARÓN', startX + 6, curY + 3);

            // Condición de Olor
            let olorLabel = 'Olor característico a huevo normal';
            let olorBadgeColor = '#059669';
            let olorBg = '#ecfdf5';
            if (organoleptic.olor_fuerte) {
                olorLabel = 'Olor característico a huevo fuerte';
                olorBadgeColor = '#d97706';
                olorBg = '#fffbeb';
            } else if (organoleptic.olor_descomposicion_prematura || organoleptic.olor_descomposicion_avanzada) {
                olorLabel = 'Olor en descomposición (No Conforme)';
                olorBadgeColor = '#dc2626';
                olorBg = '#fef2f2';
            }

            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#475569')
               .text('EVALUACIÓN DE OLOR:', startX + 6, curY + 18);
            doc.roundedRect(startX + 105, curY + 16, 205, 11, 2)
               .fillColor(olorBg).fill()
               .strokeColor(olorBadgeColor).lineWidth(0.5).stroke();
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor(olorBadgeColor)
               .text(olorLabel, startX + 105, curY + 18, { width: 205, align: 'center' });

            // Consistencia Cascarón
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#475569')
               .text('CONSISTENCIA CASCARÓN:', startX + 6, curY + 36);

            const pills = [
                { label: 'RESISTENTE', key: 'resistente' },
                { label: 'POCO RESISTENTE', key: 'poco_resistente' },
                { label: 'FRÁGIL', key: 'fragil' }
            ];

            pills.forEach((pill, pIdx) => {
                const isSelected = cCons.includes(pill.key) || (pill.key === 'fragil' && cCons.includes('frágil'));
                const pX = startX + 105 + (pIdx * 69);
                doc.roundedRect(pX, curY + 33, 65, 12, 2)
                   .fillColor(isSelected ? '#0f172a' : '#f8fafc').fill()
                   .strokeColor(isSelected ? '#0f172a' : '#cbd5e1').lineWidth(0.6).stroke();
                doc.fontSize(6).font('Helvetica-Bold').fillColor(isSelected ? '#ffffff' : '#64748b')
                   .text(pill.label, pX, curY + 36, { width: 65, align: 'center' });
            });
            doc.restore();

            // Panel Derecho: Transporte & Almacenaje
            const rPanelX = startX + sec3PanelW + 8;
            doc.save();
            doc.roundedRect(rPanelX, curY, sec4PanelW, panelsH, 3)
               .fillColor('#ffffff').fill()
               .strokeColor('#cbd5e1').lineWidth(0.6).stroke();

            doc.rect(rPanelX, curY, sec4PanelW, 13)
               .fillColor('#f1f5f9').fill();
            doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#0f172a')
               .text('4. TRANSPORTE Y ALMACENAJE', rPanelX + 6, curY + 3);

            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#475569')
               .text('LIMPIEZA CAMIÓN:', rPanelX + 6, curY + 18);
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a')
               .text(String(transport.limpieza_camion || 'CONFORME').toUpperCase(), rPanelX + 85, curY + 18, { width: sec4PanelW - 90, ellipsis: true });

            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#475569')
               .text('ESTADO DE CAJAS:', rPanelX + 6, curY + 30);
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a')
               .text(String(transport.apariencia_cajas || 'BUEN ESTADO').toUpperCase(), rPanelX + 85, curY + 30, { width: sec4PanelW - 90, ellipsis: true });

            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#475569')
               .text('T° TRANSPORTE:', rPanelX + 6, curY + 43);
            doc.roundedRect(rPanelX + 85, curY + 41, 65, 12, 2)
               .fillColor('#eff6ff').fill()
               .strokeColor('#3b82f6').lineWidth(0.5).stroke();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#1d4ed8')
               .text(String(transport.temperatura_transporte || '---'), rPanelX + 85, curY + 43.5, { width: 65, align: 'center' });
            doc.restore();

            curY += panelsH + 7;

            // -------------------------------------------------------------
            // 5. SECCIÓN: DICTAMEN TÉCNICO Y OBSERVACIONES
            // -------------------------------------------------------------
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a')
               .text('5. DICTAMEN TÉCNICO & OBSERVACIONES DE RECEPCIÓN', startX, curY);

            curY += 9;
            const obsH = 34;
            doc.save();
            doc.roundedRect(startX, curY, contentWidth, obsH, 3)
               .fillColor('#f8fafc').fill()
               .strokeColor('#cbd5e1').lineWidth(0.6).stroke();

            const obsText = data.observations
                ? String(data.observations).trim()
                : 'Materia prima recibida y evaluada conforme a los parámetros de calidad e inocuidad establecidos por la planta. Lote apto para su almacenamiento en cámara fría.';

            doc.fontSize(7.2).font('Helvetica').fillColor('#1e293b')
               .text(obsText, startX + 8, curY + 6, { width: contentWidth - 16, lineGap: 2.5 });
            doc.restore();

            curY += obsH + 16;

            // -------------------------------------------------------------
            // 6. SECCIÓN: FIRMAS DE RESPONSABILIDAD TÉCNICA
            // -------------------------------------------------------------
            const sigBoxW = (contentWidth - 40) / 2;

            // Firma 1: Inspector
            const sig1X = startX + 10;
            doc.moveTo(sig1X, curY).lineTo(sig1X + sigBoxW, curY).strokeColor('#475569').lineWidth(0.8).stroke();
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a')
               .text(data.inspector_name || 'Inspector de Calidad', sig1X, curY + 4, { width: sigBoxW, align: 'center' });
            doc.fontSize(6.8).font('Helvetica').fillColor('#64748b')
               .text('REALIZADO • INSPECTOR DE CONTROL DE CALIDAD', sig1X, curY + 14, { width: sigBoxW, align: 'center' });

            // Firma 2: Revisado / Jefe
            const sig2X = endX - sigBoxW - 10;
            doc.moveTo(sig2X, curY).lineTo(sig2X + sigBoxW, curY).strokeColor('#475569').lineWidth(0.8).stroke();
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a')
               .text(data.reviewed_by || 'Jefe de Aseguramiento de Calidad', sig2X, curY + 4, { width: sigBoxW, align: 'center' });
            doc.fontSize(6.8).font('Helvetica').fillColor('#64748b')
               .text('REVISADO • JEFE DE ASEGURAMIENTO DE CALIDAD & INOCUIDAD', sig2X, curY + 14, { width: sigBoxW, align: 'center' });

            // Pie de página oficial
            doc.fontSize(6.5).font('Helvetica').fillColor('#94a3b8')
               .text('FORMATO OFICIAL AUDITABLE LAB-001 • CONTROL DE MATERIA PRIMA • SISTEMA INTEGRAL DE GESTIÓN DE CALIDAD', startX, 765, { width: contentWidth, align: 'center' });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Genera el documento Word (.docx) oficial de Dictamen de Calidad LAB 001
 */
async function generateRawMaterialLab001Docx(data) {
    const borders = {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' }
    };

    const headerCell = (text, widthPct = 33) => new TableCell({
        shading: { fill: '1E293B', type: ShadingType.CLEAR },
        borders,
        children: [
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 15 })]
            })
        ]
    });

    const bodyCell = (text, isBold = false, isEven = false, align = AlignmentType.LEFT) => new TableCell({
        shading: { fill: isEven ? 'F8FAFC' : 'FFFFFF', type: ShadingType.CLEAR },
        borders,
        children: [
            new Paragraph({
                alignment: align,
                children: [new TextRun({ text: String(text || '---'), bold: isBold, color: '0F172A', size: 15 })]
            })
        ]
    });

    // 1. Tabla de Datos Generales
    const generalRows = [
        new TableRow({
            children: [
                bodyCell('Proveedor:', true, true),
                bodyCell(`${data.provider_name} (${data.is_foreign ? 'EXTRANJERO' : 'LOCAL'})`, false, true),
                bodyCell('Nota de Remisión:', true, true),
                bodyCell(data.remission_note, false, true)
            ]
        }),
        new TableRow({
            children: [
                bodyCell('Granja de Origen:', true, false),
                bodyCell(data.farm_name, false, false),
                bodyCell('Ingreso a Planta:', true, false),
                bodyCell(formatDate(data.plant_entry_date), false, false)
            ]
        }),
        new TableRow({
            children: [
                bodyCell('Lote Proveedor:', true, true),
                bodyCell(data.provider_lot, false, true),
                bodyCell('Fecha Recepción:', true, true),
                bodyCell(formatDate(data.reception_date), false, true)
            ]
        }),
        new TableRow({
            children: [
                bodyCell('Fecha Producción:', true, false),
                bodyCell(formatDate(data.production_date), false, false),
                bodyCell('Fecha / Hora Análisis:', true, false),
                bodyCell(`${formatDate(data.analysis_date)} - ${data.analysis_time || '---'}`, false, false)
            ]
        }),
        new TableRow({
            children: [
                bodyCell('Fecha Vencimiento:', true, true),
                bodyCell(formatDate(data.expiration_date), false, true),
                bodyCell('Color del Cascarón:', true, true),
                bodyCell(data.egg_color, false, true)
            ]
        }),
        new TableRow({
            children: [
                bodyCell('Cantidad Recibida:', true, false),
                bodyCell(`${data.total_boxes} Cajas`, false, false),
                bodyCell('Tamaño / Peso Promedio:', true, false),
                bodyCell(`${data.egg_size} • ${data.sample_egg_weight_g} g/huevo`, false, false)
            ]
        })
    ];

    const generalTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: generalRows
    });

    // 2. Tabla de Análisis Fisicoquímicos
    const phys = data.physicochemical || {};
    const fqParams = [
        { key: 'granja', label: 'Granja / Procedencia', def1: data.farm_name || 'Conforme', def2: 'Registrada' },
        { key: 'espesor_celda_aire', label: 'Espesor Celda de Aire (mm)', def1: '', def2: '< 4.0 mm' },
        { key: 'ph_huevo_fresco', label: 'pH Huevo Fresco Entero', def1: '', def2: '7.4 - 7.9' },
        { key: 'solidos_huevo_fresco', label: 'Sólidos Totales Huevo Entero (%)', def1: '', def2: '≥ 23.5 %' },
        { key: 'firmeza_albumina', label: 'Firmeza de Albúmina (Unidades Haugh)', def1: '', def2: '≥ 70 UH' },
        { key: 'ph_albumina', label: 'pH de Albúmina (Clara)', def1: '', def2: '8.5 - 9.3' },
        { key: 'solidos_albumina', label: 'Sólidos de Albúmina (%)', def1: '', def2: '≥ 11.5 %' },
        { key: 'firmeza_yema', label: 'Firmeza / Índice de Yema', def1: '', def2: '0.40 - 0.44' },
        { key: 'forma_yema', label: 'Forma de la Yema (Semiesférica)', def1: '', def2: 'Conforme' },
        { key: 'color_yema', label: 'Color de Yema (Abanico Roche)', def1: '', def2: 'Escala 10 - 13' },
        { key: 'ph_yema', label: 'pH de Yema', def1: '', def2: '6.0 - 6.4' },
        { key: 'solidos_yema', label: 'Sólidos de Yema (%)', def1: '', def2: '≥ 43.0 %' },
        { key: 'estado_separacion', label: 'Estado de Separación (Yema / Clara)', def1: '', def2: 'Óptimo / Limpio' }
    ];

    const fqRows = [
        new TableRow({
            children: [
                headerCell('PARÁMETRO / ENSAYO ANALÍTICO', 50),
                headerCell('ENSAYO 1 / LECTURA', 25),
                headerCell('ENSAYO 2 / ESPECIFICACIÓN', 25)
            ]
        })
    ];

    fqParams.forEach((param, idx) => {
        const item = phys[param.key] || {};
        const val1 = (item.val1 !== undefined && item.val1 !== null && String(item.val1).trim() !== '') ? String(item.val1) : (param.def1 || '---');
        const val2 = (item.val2 !== undefined && item.val2 !== null && String(item.val2).trim() !== '') ? String(item.val2) : (param.def2 || '---');

        fqRows.push(
            new TableRow({
                children: [
                    bodyCell(param.label, true, idx % 2 === 0),
                    bodyCell(val1, false, idx % 2 === 0, AlignmentType.CENTER),
                    bodyCell(val2, false, idx % 2 === 0, AlignmentType.CENTER)
                ]
            })
        );
    });

    const fqTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: fqRows
    });

    // 3. Documento Word Estructurado
    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: { top: 720, bottom: 720, left: 720, right: 720 }
                }
            },
            children: [
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: 'LABORATORIO DE CONTROL DE CALIDAD & INOCUIDAD', bold: true, size: 24, color: '0F172A' })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: 'DICTAMEN TÉCNICO DE CONTROL DE MATERIA PRIMA (HUEVO EN CÁSCARA) • FORMATO LAB 001', bold: true, size: 18, color: '4338CA' })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: data.company_name, size: 15, color: '64748B' })
                    ]
                }),
                new Paragraph({ text: '' }),

                // Clasificación Destacada
                new Paragraph({
                    children: [
                        new TextRun({ text: 'CLASIFICACIÓN OFICIAL SEGÚN ANÁLISIS: ', bold: true, size: 18, color: '0F172A' }),
                        new TextRun({ text: String(data.classification || 'Grado A').toUpperCase(), bold: true, size: 20, color: '047857' })
                    ]
                }),
                new Paragraph({ text: '' }),

                // Título Sección 1
                new Paragraph({
                    children: [
                        new TextRun({ text: '1. DATOS GENERALES & TRAZABILIDAD DE ORIGEN', bold: true, size: 16, color: '0F172A' })
                    ]
                }),
                generalTable,
                new Paragraph({ text: '' }),

                // Título Sección 2
                new Paragraph({
                    children: [
                        new TextRun({ text: '2. ANÁLISIS FISICOQUÍMICOS (13 PARÁMETROS DE LABORATORIO)', bold: true, size: 16, color: '0F172A' })
                    ]
                }),
                fqTable,
                new Paragraph({ text: '' }),

                // Sección 3: Organoléptico & Transporte
                new Paragraph({
                    children: [
                        new TextRun({ text: '3. EVALUACIÓN ORGANOLÉPTICA Y CONDICIONES DE TRANSPORTE', bold: true, size: 16, color: '0F172A' })
                    ]
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: `• Consistencia Cascarón: `, bold: true, size: 15 }),
                        new TextRun({ text: String(data.organoleptic?.consistencia_cascaron || 'Resistente').toUpperCase(), size: 15 }),
                        new TextRun({ text: `  |  • Limpieza Camión: `, bold: true, size: 15 }),
                        new TextRun({ text: String(data.transport_storage?.limpieza_camion || 'Conforme').toUpperCase(), size: 15 }),
                        new TextRun({ text: `  |  • T° Transporte: `, bold: true, size: 15 }),
                        new TextRun({ text: String(data.transport_storage?.temperatura_transporte || '---'), bold: true, size: 15, color: '1D4ED8' })
                    ]
                }),
                new Paragraph({ text: '' }),

                // Sección 4: Observaciones
                new Paragraph({
                    children: [
                        new TextRun({ text: '4. DICTAMEN TÉCNICO Y OBSERVACIONES', bold: true, size: 16, color: '0F172A' })
                    ]
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: data.observations || 'Materia prima recibida y evaluada conforme a los parámetros oficiales de calidad e inocuidad. Apta para su procesamiento.',
                            size: 15,
                            italics: true
                        })
                    ]
                }),
                new Paragraph({ text: '' }),
                new Paragraph({ text: '' }),

                // Sección 5: Firmas
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: '__________________________________                __________________________________\n', bold: true, size: 16 }),
                        new TextRun({ text: `${data.inspector_name || 'Inspector de Calidad'}                                 ${data.reviewed_by || 'Jefe de Control de Calidad'}\n`, bold: true, size: 16 }),
                        new TextRun({ text: 'Inspector de Control de Calidad                                 Jefe de Aseguramiento de Calidad', size: 14, color: '64748B' })
                    ]
                })
            ]
        }]
    });

    return await Packer.toBuffer(doc);
}

module.exports = {
    getRawMaterialLab001Data,
    generateRawMaterialLab001Pdf,
    generateRawMaterialLab001Docx
};
