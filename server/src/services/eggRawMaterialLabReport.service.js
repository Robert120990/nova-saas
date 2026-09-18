const pool = require('../config/db');
const PDFDocument = require('pdfkit');

/**
 * Formatea fechas a formato DD/MM/YYYY
 */
function formatDate(d) {
    if (!d) return '';
    if (typeof d === 'string') {
        const parts = d.split('T')[0].split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
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
                p.pais as provider_country
         FROM egg_raw_materials rm
         LEFT JOIN providers p ON rm.provider_id = p.id
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
 * Genera el documento PDF oficial LAB 001 idéntico al formato físico
 */
async function generateRawMaterialLab001Pdf(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'LETTER', // 612 x 792 pt
                margins: { top: 25, bottom: 25, left: 35, right: 35 },
                bufferPages: true,
                autoFirstPage: true
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            const startX = 35;
            const contentWidth = 542;
            const endX = startX + contentWidth;

            // -------------------------------------------------------------
            // 1. ENCABEZADO OFICIAL
            // -------------------------------------------------------------
            // Logo eggcelent estilizado
            const logoX = startX;
            const logoY = 24;

            // Dibujar contenedor circular/oval del huevo eggcelent
            doc.save();
            doc.roundedRect(logoX, logoY, 74, 38, 4)
               .fillColor('#2d3748')
               .fill();
            // Silueta de huevo blanco
            doc.ellipse(logoX + 37, logoY + 16, 12, 14)
               .fillColor('#ffffff')
               .fill();
            // Texto 'eggcelent.'
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#ffffff')
               .text('eggcelent.', logoX, logoY + 27, { width: 74, align: 'center' });
            doc.restore();

            // Centro: Títulos
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
               .text('LABORATORIO DE CONTROL DE CALIDAD', startX + 80, 24, { width: 340, align: 'center' });
            doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#000000')
               .text('REPORTE DE MATERIA PRIMA', startX + 80, 39, { width: 340, align: 'center' });

            // Derecha: Código y Revisión
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#000000')
               .text('LAB 001', endX - 100, 24, { width: 100, align: 'right' });
            doc.fontSize(7.5).font('Helvetica').fillColor('#000000')
               .text('Rev. 7.03.24', endX - 100, 36, { width: 100, align: 'right' });

            // Cuadro de Clasificación
            const classY = 56;
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000')
               .text('CLASIFICACION HUEVO SEGÚN ANALISIS', startX + 90, classY + 3, { width: 260, align: 'right' });

            const boxX = startX + 360;
            const boxW = 182;
            const boxH = 17;
            doc.rect(boxX, classY, boxW, boxH)
               .lineWidth(1)
               .strokeColor('#000000')
               .stroke();
            doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#000000')
               .text(String(data.classification || '').toUpperCase(), boxX, classY + 3, { width: boxW, align: 'center' });

            // -------------------------------------------------------------
            // 2. DATOS GENERALES
            // -------------------------------------------------------------
            let curY = 80;
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000')
               .text('DATOS GENERALES', startX, curY);

            curY += 11;
            const dgTableY = curY;
            const dgRowH = 13.2;
            const labelColW = 170;

            const generalDataRows = [
                {
                    label: 'PROVEEDOR',
                    render: (x, y, w, h) => {
                        const provName = String(data.provider_name || '').toUpperCase();
                        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#000000')
                           .text(provName, x + 6, y + 2.5, { width: w - 165, ellipsis: true });
                        // Checkboxes Local / Extranjero
                        const isLoc = !data.is_foreign;
                        const checkX = x + w - 160;
                        doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000');
                        doc.text('LOCAL', checkX, y + 3);
                        doc.rect(checkX + 34, y + 1.5, 9, 9).lineWidth(0.6).strokeColor('#000000').stroke();
                        if (isLoc) doc.text('X', checkX + 35.5, y + 2.5);

                        doc.text('EXTRANJERO', checkX + 54, y + 3);
                        doc.rect(checkX + 115, y + 1.5, 9, 9).lineWidth(0.6).strokeColor('#000000').stroke();
                        if (!isLoc) doc.text('X', checkX + 116.5, y + 2.5);
                    }
                },
                { label: 'GRANJA', val: data.farm_name },
                { label: 'LOTE', val: data.provider_lot },
                { label: 'FECHA PRODUCCION', val: formatDate(data.production_date) },
                { label: 'FECHA VENCIMIENTO', val: formatDate(data.expiration_date) },
                { label: 'NUMERO DE CAJAS', val: data.total_boxes ? `${data.total_boxes} CAJAS` : '---' },
                { label: 'NOTA DEREMISION', val: data.remission_note },
                { label: 'FECHA INGRESO A PLANTA', val: formatDate(data.plant_entry_date) },
                { label: 'FECHA RECEPCION', val: formatDate(data.reception_date) },
                {
                    label: 'FECHA ANALISIS',
                    render: (x, y, w, h) => {
                        const fDate = formatDate(data.analysis_date);
                        doc.fontSize(7.5).font('Helvetica').fillColor('#000000')
                           .text(fDate, x + 6, y + 2.5, { width: 180 });
                        doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000')
                           .text(`HORA:  ${data.analysis_time || '---'}`, x + 230, y + 2.5);
                    }
                },
                { label: 'COLOR CASCARON', val: data.egg_color },
                { label: 'TAMAÑO DE HUEVO', val: data.egg_size },
                { label: 'PESO EN GRAMOS', val: data.sample_egg_weight_g ? `${data.sample_egg_weight_g} g` : '---' }
            ];

            // Dibujar filas de datos generales
            generalDataRows.forEach((row, i) => {
                const rY = dgTableY + (i * dgRowH);
                // Bordes de fila
                doc.rect(startX, rY, contentWidth, dgRowH).lineWidth(0.6).strokeColor('#000000').stroke();
                // Línea divisoria de etiqueta
                doc.moveTo(startX + labelColW, rY).lineTo(startX + labelColW, rY + dgRowH).stroke();

                // Etiqueta
                doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000')
                   .text(row.label, startX + 5, rY + 2.8, { width: labelColW - 10 });

                // Valor
                if (row.render) {
                    row.render(startX + labelColW, rY, contentWidth - labelColW, dgRowH);
                } else {
                    doc.fontSize(7.5).font('Helvetica').fillColor('#000000')
                       .text(String(row.val || '---').toUpperCase(), startX + labelColW + 6, rY + 2.8, { width: contentWidth - labelColW - 12 });
                }
            });

            curY = dgTableY + (generalDataRows.length * dgRowH) + 8;

            // -------------------------------------------------------------
            // 3. ANALISIS FISICOQUIMICOS
            // -------------------------------------------------------------
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000')
               .text('ANALISIS FISICOQUIMICOS', startX, curY);

            curY += 10;
            const fqTableY = curY;
            const fqRowH = 12.8;
            const fqCol1W = 222;
            const fqCol2W = 160;
            const fqCol3W = 160;

            const phys = data.physicochemical || {};

            const fqParams = [
                { key: 'granja', label: 'GRANJA', def1: data.farm_name || '', def2: '' },
                { key: 'espesor_celda_aire', label: 'ESPESOR CELDA DE AIRE', def1: '', def2: '' },
                { key: 'ph_huevo_fresco', label: 'PH HUEVO FRESCO', def1: '', def2: '' },
                { key: 'solidos_huevo_fresco', label: 'SOLIDOS HUEVO FRESCO', def1: '', def2: '' },
                { key: 'firmeza_albumina', label: 'FIRMEZA DE ALBUMINA', def1: '', def2: '' },
                { key: 'ph_albumina', label: 'PH DE ALBUMINA', def1: '', def2: '' },
                { key: 'solidos_albumina', label: 'SOLIDOS ALBUMINA', def1: '', def2: '' },
                { key: 'firmeza_yema', label: 'FIRMEZA YEMA', def1: '', def2: '' },
                { key: 'forma_yema', label: 'FORMA YEMA', def1: '', def2: '' },
                { key: 'color_yema', label: 'COLOR YEMA', def1: '', def2: '' },
                { key: 'ph_yema', label: 'PH YEMA', def1: '', def2: '' },
                { key: 'solidos_yema', label: 'SOLIDOS DE YEMA', def1: '', def2: '' },
                { key: 'estado_separacion', label: 'ESTADO DE SEPARACION', def1: '', def2: '' }
            ];

            fqParams.forEach((param, i) => {
                const rY = fqTableY + (i * fqRowH);
                // Rectángulo exterior
                doc.rect(startX, rY, contentWidth, fqRowH).lineWidth(0.6).strokeColor('#000000').stroke();
                // Líneas divisorias de columnas
                doc.moveTo(startX + fqCol1W, rY).lineTo(startX + fqCol1W, rY + fqRowH).stroke();
                doc.moveTo(startX + fqCol1W + fqCol2W, rY).lineTo(startX + fqCol1W + fqCol2W, rY + fqRowH).stroke();

                // Parámetro
                doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000')
                   .text(param.label, startX + 5, rY + 2.5, { width: fqCol1W - 10 });

                // Valor 1
                const item = phys[param.key] || {};
                const val1 = item.val1 !== undefined && item.val1 !== null ? String(item.val1) : param.def1;
                const val2 = item.val2 !== undefined && item.val2 !== null ? String(item.val2) : param.def2;

                doc.fontSize(7.5).font('Helvetica').fillColor('#000000')
                   .text(val1, startX + fqCol1W + 6, rY + 2.5, { width: fqCol2W - 12, align: 'center' });

                // Valor 2
                doc.fontSize(7.5).font('Helvetica').fillColor('#000000')
                   .text(val2, startX + fqCol1W + fqCol2W + 6, rY + 2.5, { width: fqCol3W - 12, align: 'center' });
            });

            curY = fqTableY + (fqParams.length * fqRowH) + 8;

            // -------------------------------------------------------------
            // 4. ANALISIS ORGANOLEPTICOS
            // -------------------------------------------------------------
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000')
               .text('ANALISIS ORGANOLEPTICOS', startX, curY);

            curY += 10;
            const orgTableY = curY;
            const orgRowH = 12.2;
            const orgTableW = 320;
            const orgCol1W = 255;
            const orgCol2W = 65;

            const organoleptic = data.organoleptic || {};

            const olorRows = [
                { label: 'OLOR CARACTERISTICO A HUEVO NORMAL', checked: organoleptic.olor_normal ?? true },
                { label: 'OLOR CARACTERISTICO A HUEVO FUERTE', checked: organoleptic.olor_fuerte ?? false },
                { label: 'OLOR A HUEVO EN DESCOMPOSICION PREMATURA', checked: organoleptic.olor_descomposicion_prematura ?? false },
                { label: 'OLOR A HUEVO EN DESCOMPOSICION AVANZADA', checked: organoleptic.olor_descomposicion_avanzada ?? false }
            ];

            olorRows.forEach((row, i) => {
                const rY = orgTableY + (i * orgRowH);
                doc.rect(startX, rY, orgTableW, orgRowH).lineWidth(0.6).strokeColor('#000000').stroke();
                doc.moveTo(startX + orgCol1W, rY).lineTo(startX + orgCol1W, rY + orgRowH).stroke();

                doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000')
                   .text(row.label, startX + 5, rY + 2.5, { width: orgCol1W - 8 });

                if (row.checked) {
                    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#000000')
                       .text('X', startX + orgCol1W, rY + 2, { width: orgCol2W, align: 'center' });
                }
            });

            // Fila de consistencia cascarón
            const constY = orgTableY + (olorRows.length * orgRowH);
            const constH = 14;
            doc.rect(startX, constY, contentWidth, constH).lineWidth(0.6).strokeColor('#000000').stroke();

            const cCons = (organoleptic.consistencia_cascaron || 'resistente').toLowerCase();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000')
               .text('CONSISTENCIA CASCARON:', startX + 5, constY + 3.2);

            // Resistente
            let optX = startX + 150;
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000').text('RESISTENTE', optX, constY + 3.2);
            doc.rect(optX + 70, constY + 2.2, 9, 9).lineWidth(0.6).strokeColor('#000000').stroke();
            if (cCons === 'resistente') doc.text('X', optX + 71.5, constY + 3);

            // Poco Resistente
            optX = startX + 265;
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000').text('POCO RESISTENTE', optX, constY + 3.2);
            doc.rect(optX + 90, constY + 2.2, 9, 9).lineWidth(0.6).strokeColor('#000000').stroke();
            if (cCons === 'poco_resistente' || cCons === 'poco resistente') doc.text('X', optX + 91.5, constY + 3);

            // Frágil
            optX = startX + 410;
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000').text('FRAGIL', optX, constY + 3.2);
            doc.rect(optX + 50, constY + 2.2, 9, 9).lineWidth(0.6).strokeColor('#000000').stroke();
            if (cCons === 'fragil' || cCons === 'frágil') doc.text('X', optX + 51.5, constY + 3);

            curY = constY + constH + 8;

            // -------------------------------------------------------------
            // 5. TRANSPORTE Y ALMACENAJE
            // -------------------------------------------------------------
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000')
               .text('TRANSPORTE Y ALMACENAJE', startX, curY);

            curY += 10;
            const trTableY = curY;
            const trRowH = 13.5;
            const trLabelW = 165;
            const transport = data.transport_storage || {};

            // Fila 1: Limpieza / Orden Camión
            doc.rect(startX, trTableY, contentWidth, trRowH).lineWidth(0.6).strokeColor('#000000').stroke();
            doc.moveTo(startX + trLabelW, trTableY).lineTo(startX + trLabelW, trTableY + trRowH).stroke();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000')
               .text('LIMPIEZA / ORDEN CAMION', startX + 5, trTableY + 3);
            doc.fontSize(7.5).font('Helvetica').fillColor('#000000')
               .text(String(transport.limpieza_camion || 'CONFORME').toUpperCase(), startX + trLabelW + 6, trTableY + 3);

            // Fila 2: Apariencia Cajas + T° Transporte
            const r2Y = trTableY + trRowH;
            doc.rect(startX, r2Y, contentWidth, trRowH).lineWidth(0.6).strokeColor('#000000').stroke();
            doc.moveTo(startX + trLabelW, r2Y).lineTo(startX + trLabelW, r2Y + trRowH).stroke();
            // Columna temp split en 380 pt
            const tempSplitX = startX + 380;
            const tempValX = startX + 465;
            doc.moveTo(tempSplitX, r2Y).lineTo(tempSplitX, r2Y + trRowH).stroke();
            doc.moveTo(tempValX, r2Y).lineTo(tempValX, r2Y + trRowH).stroke();

            doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000')
               .text('APARIENCIA DE CAJAS A SU INGRESO', startX + 5, r2Y + 3);
            doc.fontSize(7.5).font('Helvetica').fillColor('#000000')
               .text(String(transport.apariencia_cajas || 'BUEN ESTADO').toUpperCase(), startX + trLabelW + 6, r2Y + 3, { width: tempSplitX - (startX + trLabelW) - 10 });

            doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000')
               .text('T° TRANSPORTE', tempSplitX + 6, r2Y + 3);
            doc.fontSize(7.5).font('Helvetica').fillColor('#000000')
               .text(String(transport.temperatura_transporte || '---'), tempValX + 6, r2Y + 3, { width: endX - tempValX - 10, align: 'center' });

            curY = r2Y + trRowH + 8;

            // -------------------------------------------------------------
            // 6. OBSERVACIONES
            // -------------------------------------------------------------
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000')
               .text('OBSERVACIONES :', startX, curY);

            curY += 11;
            const obsY = curY;
            const obsH = 40;
            // 3 líneas horizontales simulando el formulario impreso
            doc.strokeColor('#000000').lineWidth(0.6);
            doc.moveTo(startX, obsY + 12).lineTo(endX, obsY + 12).stroke();
            doc.moveTo(startX, obsY + 25).lineTo(endX, obsY + 25).stroke();
            doc.moveTo(startX, obsY + 38).lineTo(endX, obsY + 38).stroke();

            if (data.observations) {
                doc.fontSize(7.5).font('Helvetica').fillColor('#000000')
                   .text(data.observations, startX + 2, obsY + 1, { width: contentWidth - 4, lineGap: 5 });
            }

            curY = obsY + obsH + 18;

            // -------------------------------------------------------------
            // 7. FIRMAS (REALIZADO / REVISADO)
            // -------------------------------------------------------------
            const sigLine1Start = startX + 20;
            const sigLine1End = startX + 220;
            const sigLine2Start = startX + 320;
            const sigLine2End = endX - 20;

            doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
            doc.text('REALIZADO :', sigLine1Start - 20, curY);
            doc.moveTo(sigLine1Start + 45, curY + 6).lineTo(sigLine1End, curY + 6).stroke();

            doc.text('REVISADO :', sigLine2Start - 20, curY);
            doc.moveTo(sigLine2Start + 40, curY + 6).lineTo(sigLine2End, curY + 6).stroke();

            // Nombres debajo de las líneas
            doc.fontSize(7.5).font('Helvetica').fillColor('#334155');
            doc.text(data.inspector_name || 'Inspector de Calidad', sigLine1Start + 35, curY + 9, { width: sigLine1End - sigLine1Start, align: 'center' });
            doc.text(data.reviewed_by || 'Jefe de Control de Calidad', sigLine2Start + 35, curY + 9, { width: sigLine2End - sigLine2Start, align: 'center' });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = {
    getRawMaterialLab001Data,
    generateRawMaterialLab001Pdf
};
