const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const docx = require('docx');
const reportPdfHelper = require('../utils/reportPdfHelper');

/**
 * Obtiene todos los datos consolidados de un lote de producción para su exportación.
 */
async function getBatchExportData(batchId, companyId) {
    const [batches] = await pool.query(
        `SELECT b.*, esp.lot_code as scheduled_lot_code, esp.production_date as scheduled_production_date
         FROM egg_production_batches b
         LEFT JOIN egg_scheduled_productions esp ON b.scheduled_production_id = esp.id
         WHERE b.id = ? AND b.company_id = ?`,
        [batchId, companyId]
    );
    if (batches.length === 0) return null;
    const batch = batches[0];

    // 1. Materias primas utilizadas
    const [rawMaterials] = await pool.query(
        `SELECT brm.*, rm.egg_type, rm.provider_lot, rm.egg_color, rm.egg_size, rm.provider_id, 
                COALESCE(p.nombre, p.nombre_comercial, 'Proveedor General') as provider_name
         FROM batch_raw_materials brm
         JOIN egg_raw_materials rm ON brm.raw_material_id = rm.id
         LEFT JOIN providers p ON rm.provider_id = p.id
         WHERE brm.batch_id = ?`,
        [batchId]
    );
    for (const rm of rawMaterials) {
        if (rm.tarimas_json && typeof rm.tarimas_json === 'string') {
            try { rm.tarimas = JSON.parse(rm.tarimas_json); } catch (e) { rm.tarimas = []; }
        } else {
            rm.tarimas = rm.tarimas_json || [];
        }
    }

    const tarimasUsed = [];
    for (const rm of rawMaterials) {
        if (Array.isArray(rm.tarimas) && rm.tarimas.length > 0) {
            for (const t of rm.tarimas) {
                tarimasUsed.push({
                    tarima_number: t.tarima_number || t.tarima_no || '1',
                    barcode: t.barcode || 'N/A',
                    provider_lot: rm.provider_lot || 'N/A',
                    provider_name: rm.provider_name || 'Proveedor General',
                    egg_type: rm.egg_type || 'Cáscara',
                    boxes_count: parseInt(t.boxes_count || 0, 10),
                    quantity_lbs: parseFloat(t.quantity_lbs || t.weight_lbs || 0),
                    storage_location: t.storage_location || 'Cámara Fría',
                    is_partial: Boolean(t.is_partial)
                });
            }
        }
    }

    // 2. Registros de pasteurización
    const [pasteurizationLogs] = await pool.query(
        `SELECT * FROM egg_pasteurization_logs 
         WHERE batch_id = ? AND company_id = ?
         ORDER BY created_at ASC`,
        [batchId, companyId]
    );

    // 3. Remanentes generados en este lote
    let remanentes = [];
    try {
        const [remRows] = await pool.query(
            `SELECT * FROM egg_batch_remanentes
             WHERE batch_id = ? AND company_id = ?
             ORDER BY created_at ASC`,
            [batchId, companyId]
        );
        remanentes = remRows;
    } catch (e) {
        remanentes = [];
    }

    // 3.1 Remanentes de OTRAS producciones utilizados en este lote
    let remanentesUsed = [];
    try {
        const [usedRemRows] = await pool.query(
            `SELECT r.*, 
                    b.batch_code_display as source_batch_code, 
                    b.batch_uuid as source_batch_uuid, 
                    b.started_at as source_batch_date
             FROM egg_batch_remanentes r
             LEFT JOIN egg_production_batches b ON r.batch_id = b.id
             WHERE r.target_batch_id = ? AND r.company_id = ?
             ORDER BY r.created_at ASC`,
            [batchId, companyId]
        );
        remanentesUsed = usedRemRows;
    } catch (e) {
        remanentesUsed = [];
    }
    const remanenteUsedWeight = remanentesUsed.reduce((sum, r) => sum + parseFloat(r.quantity_lbs || 0), 0);

    // 4. Registros de envasado
    const [packagingRecords] = await pool.query(
        `SELECT * FROM egg_packaging_records
         WHERE batch_id = ? AND company_id = ?
         ORDER BY created_at ASC`,
        [batchId, companyId]
    );

    // 5. Mermas de producción
    let wasteLogs = [];
    try {
        const [wRows] = await pool.query(
            `SELECT * FROM egg_batch_waste_logs
             WHERE batch_id = ? AND company_id = ?
             ORDER BY created_at ASC`,
            [batchId, companyId]
        );
        wasteLogs = wRows;
    } catch (e) {
        wasteLogs = [];
    }

    // Totales calculados
    const totalInputWeight = parseFloat(batch.input_weight_lbs || 0);
    const liquidYield = parseFloat(batch.yield_liquid_lbs || 0);
    const shellWaste = parseFloat(batch.waste_shell_lbs || 0);
    const processLoss = parseFloat(batch.waste_loss_lbs || 0);
    const packagedWeight = packagingRecords.reduce((sum, p) => sum + parseFloat(p.total_batch_weight_lbs || 0), 0);
    const wasteLogsWeight = wasteLogs.reduce((sum, w) => sum + parseFloat(w.quantity_lbs || 0), 0);
    const remanenteWeight = remanentes.reduce((sum, r) => sum + parseFloat(r.quantity_lbs || 0), 0);

    // Calcular cajas de huevo procesadas
    let totalBoxes = 0;
    for (const rm of rawMaterials) {
        let bxs = parseInt(rm.boxes_count || 0, 10);
        if (!bxs && rm.tarimas) {
            bxs = (rm.tarimas || []).reduce((s, t) => s + (parseInt(t.boxes_count || 0, 10)), 0);
        }
        totalBoxes += bxs;
    }
    if (totalBoxes === 0 && batch.ingredients_json) {
        try {
            const ing = typeof batch.ingredients_json === 'string' ? JSON.parse(batch.ingredients_json) : batch.ingredients_json;
            totalBoxes = parseInt(ing.boxes_count || ing.raw_egg_boxes || 0, 10);
        } catch (e) { }
    }
    if (totalBoxes === 0 && totalInputWeight > 0) {
        totalBoxes = Math.round(totalInputWeight / 30);
    }

    const yieldPerBoxLbs = totalBoxes > 0 ? Math.round((liquidYield / totalBoxes) * 100) / 100 : 0;
    const liquidPlusPackagedLbs = Math.round((liquidYield + packagedWeight) * 100) / 100;
    const liquidPlusPackagedYieldPct = totalInputWeight > 0 ? ((liquidPlusPackagedLbs / totalInputWeight) * 100).toFixed(2) : '0.00';

    const yieldPct = totalInputWeight > 0 ? ((liquidYield / totalInputWeight) * 100).toFixed(2) : '0.00';
    const packagingEfficiencyPct = liquidYield > 0 ? ((packagedWeight / liquidYield) * 100).toFixed(2) : '0.00';

    const company = await reportPdfHelper.getCompanyInfo(companyId);

    // 6. Sanitizaciones CIP (vinculadas al lote o realizadas en la fecha de producción)
    let cipLogs = [];
    try {
        const batchDate = batch.started_at ? new Date(batch.started_at).toISOString().split('T')[0] : null;
        const [cipRows] = await pool.query(
            `SELECT c.*, b.batch_code_display as batch_code, b.batch_uuid
             FROM egg_cip_logs c
             LEFT JOIN egg_production_batches b ON c.batch_id = b.id
             WHERE c.company_id = ? 
               AND (c.batch_id = ? OR (c.batch_id IS NULL AND DATE(c.created_at) = ?))
             ORDER BY c.created_at ASC`,
            [companyId, batchId, batchDate]
        );
        cipLogs = cipRows;
    } catch (e) {
        cipLogs = [];
    }

    return {
        batch,
        rawMaterials,
        tarimasUsed,
        pasteurizationLogs,
        remanentes,
        remanentesUsed,
        packagingRecords,
        wasteLogs,
        cipLogs,
        totals: {
            totalInputWeight,
            totalBoxes,
            yieldPerBoxLbs,
            liquidYield,
            shellWaste,
            processLoss,
            packagedWeight,
            liquidPlusPackagedLbs,
            liquidPlusPackagedYieldPct,
            wasteLogsWeight,
            remanenteWeight,
            remanenteUsedWeight,
            yieldPct,
            packagingEfficiencyPct
        },
        company
    };
}

/**
 * Genera el documento PDF del Resumen de Producción.
 */
async function generateBatchSummaryPdf(batchId, companyId) {
    const data = await getBatchExportData(batchId, companyId);
    if (!data) throw new Error('Lote de producción no encontrado');

    const { 
        batch, 
        rawMaterials, 
        tarimasUsed, 
        pasteurizationLogs, 
        remanentes, 
        remanentesUsed, 
        packagingRecords, 
        wasteLogs, 
        cipLogs, 
        totals, 
        company 
    } = data;

    const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'portrait',
        margin: 36,
        bufferPages: true
    });

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));

    const lotLabel = (batch.batch_code_display || batch.batch_uuid || '');
    const title = `RESUMEN DE PRODUCCIÓN Y BALANCE DE MASAS - ${lotLabel.toUpperCase().startsWith('LOTE') ? lotLabel : `LOTE ${lotLabel}`}`;
    const subtitle = `PLANTA INDUSTRIAL DE PROCESAMIENTO Y PASTEURIZACIÓN DE OVOPRODUCTOS`;
    const periodText = `Fecha de Procesamiento: ${new Date(batch.started_at).toLocaleDateString()} | Estado: ${(batch.status || '').toUpperCase()}`;

    let currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);

    // 1. FICHA TÉCNICA DEL LOTE
    doc.rect(36, currentY, 540, 16).fill('#1e293b');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5).text('1. INFORMACIÓN GENERAL Y PARÁMETROS DEL LOTE', 42, currentY + 4);
    currentY += 22;

    doc.rect(36, currentY, 540, 62).fill('#f8fafc').stroke('#e2e8f0');
    doc.fillColor('#334155').font('Helvetica-Bold').fontSize(7.5);

    doc.text('Lote Oficial:', 42, currentY + 6);
    doc.font('Helvetica').text(batch.batch_code_display || batch.batch_uuid, 100, currentY + 6);

    doc.font('Helvetica-Bold').text('Producto:', 240, currentY + 6);
    doc.font('Helvetica').text((batch.product_type || '').toUpperCase(), 290, currentY + 6);

    doc.font('Helvetica-Bold').text('Presentación:', 410, currentY + 6);
    doc.font('Helvetica').text(batch.presentation || 'N/A', 470, currentY + 6);

    doc.font('Helvetica-Bold').text('Operador Líder:', 42, currentY + 20);
    doc.font('Helvetica').text(batch.operator_name || 'No especificado', 105, currentY + 20);

    doc.font('Helvetica-Bold').text('Inicio:', 240, currentY + 20);
    doc.font('Helvetica').text(new Date(batch.started_at).toLocaleString(), 270, currentY + 20);

    doc.font('Helvetica-Bold').text('Fin:', 410, currentY + 20);
    doc.font('Helvetica').text(batch.completed_at ? new Date(batch.completed_at).toLocaleString() : 'En proceso', 430, currentY + 20);

    doc.font('Helvetica-Bold').text('Lote Pasteurización:', 42, currentY + 34);
    doc.font('Helvetica').text(batch.pasteurization_lot || 'N/A', 135, currentY + 34);

    doc.font('Helvetica-Bold').text('Estado Past.:', 240, currentY + 34);
    doc.font('Helvetica').text((batch.pasteurization_status || 'pendiente').toUpperCase(), 305, currentY + 34);

    doc.font('Helvetica-Bold').text('Estado Lote:', 410, currentY + 34);
    doc.font('Helvetica').text((batch.status || '').toUpperCase(), 465, currentY + 34);

    doc.font('Helvetica-Bold').text('Brix Esperado:', 42, currentY + 48);
    doc.font('Helvetica').text(batch.target_brix ? `${batch.target_brix}°Bx` : 'N/A', 105, currentY + 48);

    doc.font('Helvetica-Bold').text('Sólidos Totales:', 240, currentY + 48);
    doc.font('Helvetica').text(batch.target_solids_pct ? `${batch.target_solids_pct}%` : 'N/A', 305, currentY + 48);

    currentY += 70;

    // 1.1 SANITIZACIÓN PRE-OPERACIONAL CIP (AUTORIZACIÓN HIGIÉNICA)
    if (currentY > 640) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
    }
    doc.rect(36, currentY, 540, 15).fill('#f1f5f9');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5).text('1.1 CONTROL HIGIÉNICO Y SANITIZACIÓN PRE-OPERACIONAL (CIP)', 42, currentY + 4);
    currentY += 18;

    if (cipLogs && cipLogs.length > 0) {
        doc.rect(36, currentY, 540, 14).fill('#e2e8f0');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5);
        doc.text('EQUIPO SANITIZADO', 40, currentY + 3.5, { width: 105 });
        doc.text('AGENTE QUÍMICO', 150, currentY + 3.5, { width: 135 });
        doc.text('TEMP °C', 290, currentY + 3.5, { width: 45, align: 'right' });
        doc.text('TIEMPO', 340, currentY + 3.5, { width: 40, align: 'right' });
        doc.text('ESTADO', 385, currentY + 3.5, { width: 55, align: 'center' });
        doc.text('FECHA/HORA', 445, currentY + 3.5, { width: 75 });
        doc.text('OPERADOR', 525, currentY + 3.5, { width: 50, align: 'right' });
        currentY += 15;

        doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');
        for (const cl of cipLogs) {
            if (currentY > 700) {
                doc.addPage();
                currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
            }
            doc.text((cl.equipment_name || 'Pasteurizador').toUpperCase(), 40, currentY, { width: 105, ellipsis: true });
            doc.text(cl.chemical_used || 'Sanitizante', 150, currentY, { width: 135, ellipsis: true });
            doc.text(`${parseFloat(cl.temperature_c || 0).toFixed(1)} °C`, 290, currentY, { width: 45, align: 'right' });
            doc.text(`${cl.duration_minutes || 0}m`, 340, currentY, { width: 40, align: 'right' });
            doc.text((cl.validation_status || 'OK').toUpperCase(), 385, currentY, { width: 55, align: 'center' });
            doc.text(new Date(cl.created_at).toLocaleString(), 445, currentY, { width: 75 });
            doc.text(cl.operator_name || 'Operador', 525, currentY, { width: 50, align: 'right', ellipsis: true });
            currentY += 12;
        }
        doc.rect(36, currentY, 540, 1).fill('#cbd5e1');
        currentY += 6;
    } else {
        doc.font('Helvetica-Oblique').fontSize(7).fillColor('#64748b').text('Sin registros de sanitización CIP vinculados a este lote o fecha.', 42, currentY);
        currentY += 14;
    }

    // 2. MATERIAS PRIMAS Y QUEBRAJE
    doc.rect(36, currentY, 540, 15).fill('#f1f5f9');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5).text('2. MATERIA PRIMA INGRESADA AL QUEBRAJE', 42, currentY + 4);
    currentY += 18;

    // Header tabla MP
    doc.rect(36, currentY, 540, 14).fill('#e2e8f0');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5);
    doc.text('LOTE PROVEEDOR', 40, currentY + 3.5, { width: 100 });
    doc.text('PROVEEDOR', 145, currentY + 3.5, { width: 130 });
    doc.text('TIPO HUEVO', 280, currentY + 3.5, { width: 80 });
    doc.text('CAJAS', 365, currentY + 3.5, { width: 40, align: 'right' });
    doc.text('TARIMAS', 410, currentY + 3.5, { width: 45, align: 'center' });
    doc.text('PESO LBS', 460, currentY + 3.5, { width: 110, align: 'right' });
    currentY += 15;

    doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');
    for (const rm of rawMaterials) {
        doc.text(rm.provider_lot || 'N/A', 40, currentY, { width: 100 });
        doc.text(rm.provider_name || 'Proveedor General', 145, currentY, { width: 130 });
        doc.text(rm.egg_type || 'Cáscara', 280, currentY, { width: 80 });
        doc.text(String(rm.boxes_count || 0), 365, currentY, { width: 40, align: 'right' });
        doc.text(String(rm.tarimas?.length || 1), 410, currentY, { width: 45, align: 'center' });
        doc.text(`${parseFloat(rm.quantity_lbs || 0).toLocaleString()} Lbs`, 460, currentY, { width: 110, align: 'right' });
        currentY += 12;
    }
    doc.rect(36, currentY, 540, 1).fill('#cbd5e1');
    currentY += 3;

    // Total Quebraje
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
    doc.text('TOTAL ENTRADA QUEBRAJE:', 280, currentY, { width: 170, align: 'right' });
    doc.text(`${totals.totalInputWeight.toLocaleString()} Lbs`, 460, currentY, { width: 110, align: 'right' });
    currentY += 16;

    // 2.1 DETALLE DE TARIMAS UTILIZADAS EN ESTA PRODUCCIÓN
    if (tarimasUsed && tarimasUsed.length > 0) {
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#1e293b').text('2.1 DETALLE DE TARIMAS UTILIZADAS EN ESTA PRODUCCIÓN', 42, currentY);
        currentY += 12;

        doc.rect(36, currentY, 540, 13).fill('#e2e8f0');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5);
        doc.text('TARIMA #', 40, currentY + 3, { width: 55 });
        doc.text('LOTE PROV.', 100, currentY + 3, { width: 85 });
        doc.text('PROVEEDOR', 190, currentY + 3, { width: 110 });
        doc.text('TIPO HUEVO', 305, currentY + 3, { width: 75 });
        doc.text('CAJAS', 385, currentY + 3, { width: 45, align: 'right' });
        doc.text('PESO LBS', 435, currentY + 3, { width: 55, align: 'right' });
        doc.text('UBICACIÓN', 495, currentY + 3, { width: 75 });
        currentY += 14;

        doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');
        for (const t of tarimasUsed) {
            if (currentY > 700) {
                doc.addPage();
                currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
            }
            doc.text(`#${t.tarima_number}`, 40, currentY, { width: 55 });
            doc.text(t.provider_lot || 'N/A', 100, currentY, { width: 85 });
            doc.text(t.provider_name || 'General', 190, currentY, { width: 110, ellipsis: true });
            doc.text(t.egg_type || 'Cáscara', 305, currentY, { width: 75 });
            doc.text(String(t.boxes_count || 0), 385, currentY, { width: 45, align: 'right' });
            doc.text(`${parseFloat(t.quantity_lbs || 0).toLocaleString()} Lbs`, 435, currentY, { width: 55, align: 'right' });
            doc.text(t.storage_location || 'Cámara', 495, currentY, { width: 75 });
            currentY += 11;
        }
        doc.rect(36, currentY, 540, 1).fill('#cbd5e1');
        currentY += 6;
    }

    // 3. PASTEURIZACIÓN
    if (currentY > 640) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
    }
    doc.rect(36, currentY, 540, 15).fill('#f1f5f9');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5).text('3. PARÁMETROS CRÍTICOS DE CONTROL HACCP (PASTEURIZACIÓN)', 42, currentY + 4);
    currentY += 18;

    if (pasteurizationLogs.length > 0) {
        doc.rect(36, currentY, 540, 14).fill('#e2e8f0');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5);
        doc.text('FECHA/HORA', 40, currentY + 3.5, { width: 100 });
        doc.text('TEMP °C (CRÍTICO)', 145, currentY + 3.5, { width: 85, align: 'right' });
        doc.text('RETENCIÓN (SEG)', 235, currentY + 3.5, { width: 85, align: 'right' });
        doc.text('PRESIÓN PSI', 325, currentY + 3.5, { width: 75, align: 'right' });
        doc.text('CAUDAL GPM', 405, currentY + 3.5, { width: 70, align: 'right' });
        doc.text('OPERADOR', 480, currentY + 3.5, { width: 90, align: 'right' });
        currentY += 15;

        doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');
        for (const pl of pasteurizationLogs) {
            if (currentY > 700) {
                doc.addPage();
                currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
            }
            doc.text(new Date(pl.created_at).toLocaleString(), 40, currentY, { width: 100 });
            doc.text(`${parseFloat(pl.temperature_c).toFixed(1)} °C`, 145, currentY, { width: 85, align: 'right' });
            doc.text(`${pl.holding_time_seconds} s`, 235, currentY, { width: 85, align: 'right' });
            doc.text(`${parseFloat(pl.pressure_psi).toFixed(1)} PSI`, 325, currentY, { width: 75, align: 'right' });
            doc.text(`${parseFloat(pl.flow_rate_gpm).toFixed(1)} GPM`, 405, currentY, { width: 70, align: 'right' });
            doc.text(pl.operator_name || 'N/A', 480, currentY, { width: 90, align: 'right' });
            currentY += 12;
        }
    } else {
        doc.font('Helvetica-Oblique').fontSize(7).fillColor('#64748b').text('Sin registros específicos de corrida térmica registrados aún.', 42, currentY);
        currentY += 12;
    }
    currentY += 6;

    // 4. ENVASADO Y PRODUCTO TERMINADO
    if (currentY > 640) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
    }
    doc.rect(36, currentY, 540, 15).fill('#f1f5f9');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5).text('4. ENVASADO COMERCIAL Y PRODUCTO TERMINADO', 42, currentY + 4);
    currentY += 18;

    if (packagingRecords.length > 0) {
        doc.rect(36, currentY, 540, 14).fill('#e2e8f0');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5);
        doc.text('LOTE COMERCIAL', 40, currentY + 3.5, { width: 100 });
        doc.text('PRESENTACIÓN', 145, currentY + 3.5, { width: 110 });
        doc.text('UNIDADES', 260, currentY + 3.5, { width: 55, align: 'right' });
        doc.text('PESO UNIT', 320, currentY + 3.5, { width: 55, align: 'right' });
        doc.text('TOTAL LBS', 380, currentY + 3.5, { width: 65, align: 'right' });
        doc.text('ZONA FRÍO', 450, currentY + 3.5, { width: 60, align: 'center' });
        doc.text('ESTADO', 515, currentY + 3.5, { width: 55, align: 'right' });
        currentY += 15;

        doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');
        for (const pk of packagingRecords) {
            if (currentY > 700) {
                doc.addPage();
                currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
            }
            doc.text(pk.lot_code || 'N/A', 40, currentY, { width: 100 });
            doc.text(pk.presentation || 'cubeta 30LB', 145, currentY, { width: 110 });
            doc.text(String(pk.units_packaged || 0), 260, currentY, { width: 55, align: 'right' });
            doc.text(`${parseFloat(pk.weight_per_unit_lbs || 0).toFixed(2)} Lbs`, 320, currentY, { width: 55, align: 'right' });
            doc.text(`${parseFloat(pk.total_batch_weight_lbs || 0).toLocaleString()} Lbs`, 380, currentY, { width: 65, align: 'right' });
            doc.text(pk.warehouse_zone || 'COOLER', 450, currentY, { width: 60, align: 'center' });
            doc.text(pk.product_state || 'líquido', 515, currentY, { width: 55, align: 'right' });
            currentY += 12;
        }

        doc.rect(36, currentY, 540, 1).fill('#cbd5e1');
        currentY += 3;
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
        doc.text('TOTAL ENVASADO REAL:', 260, currentY, { width: 115, align: 'right' });
        doc.text(`${totals.packagedWeight.toLocaleString()} Lbs`, 380, currentY, { width: 65, align: 'right' });
        currentY += 16;
    } else {
        doc.font('Helvetica-Oblique').fontSize(7).fillColor('#64748b').text('Sin envasado registrado hasta la fecha.', 42, currentY);
        currentY += 16;
    }

    // 5. REMANENTES Y REPROCESOS
    if ((remanentesUsed && remanentesUsed.length > 0) || (remanentes && remanentes.length > 0)) {
        if (currentY > 620) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
        }
        doc.rect(36, currentY, 540, 15).fill('#f1f5f9');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5).text('5. REMANENTES DE PRODUCCIÓN Y REPROCESOS', 42, currentY + 4);
        currentY += 18;

        if (remanentesUsed && remanentesUsed.length > 0) {
            doc.font('Helvetica-Bold').fontSize(7).fillColor('#047857').text('5.1 REMANENTES DE OTRAS PRODUCCIONES UTILIZADOS EN ESTE LOTE', 42, currentY);
            currentY += 12;

            doc.rect(36, currentY, 540, 13).fill('#e2e8f0');
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5);
            doc.text('LOTE ORIGEN', 40, currentY + 3, { width: 95 });
            doc.text('FECHA ORIGEN', 140, currentY + 3, { width: 85 });
            doc.text('PRODUCTO', 230, currentY + 3, { width: 95 });
            doc.text('TIPO', 330, currentY + 3, { width: 75 });
            doc.text('CANTIDAD LBS', 410, currentY + 3, { width: 65, align: 'right' });
            doc.text('UBICACIÓN / NOTAS', 485, currentY + 3, { width: 85 });
            currentY += 14;

            doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');
            for (const ru of remanentesUsed) {
                if (currentY > 700) {
                    doc.addPage();
                    currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
                }
                doc.text(ru.source_batch_code || `Lote #${ru.batch_id}`, 40, currentY, { width: 95 });
                doc.text(ru.source_batch_date ? new Date(ru.source_batch_date).toLocaleDateString() : (ru.created_at ? new Date(ru.created_at).toLocaleDateString() : '-'), 140, currentY, { width: 85 });
                doc.text((ru.product_type || 'Huevo').toUpperCase(), 230, currentY, { width: 95 });
                doc.text(ru.remanente_type || 'pasteurizado', 330, currentY, { width: 75 });
                doc.text(`${parseFloat(ru.quantity_lbs || 0).toLocaleString()} Lbs`, 410, currentY, { width: 65, align: 'right' });
                doc.text(ru.notes || ru.storage_location || '-', 485, currentY, { width: 85, ellipsis: true });
                currentY += 11;
            }
            doc.rect(36, currentY, 540, 1).fill('#cbd5e1');
            currentY += 3;
            doc.font('Helvetica-Bold').fontSize(7).fillColor('#047857');
            doc.text('TOTAL REMANENTES UTILIZADOS:', 230, currentY, { width: 175, align: 'right' });
            doc.text(`${(totals.remanenteUsedWeight || 0).toLocaleString()} Lbs`, 410, currentY, { width: 65, align: 'right' });
            currentY += 14;
        }

        if (remanentes && remanentes.length > 0) {
            doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a').text('5.2 REMANENTES GENERADOS EN ESTA PRODUCCIÓN (HACIA CÁMARA / TANQUE)', 42, currentY);
            currentY += 12;

            doc.rect(36, currentY, 540, 13).fill('#e2e8f0');
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5);
            doc.text('CÓDIGO', 40, currentY + 3, { width: 80 });
            doc.text('PRODUCTO', 125, currentY + 3, { width: 105 });
            doc.text('TIPO REMANENTE', 235, currentY + 3, { width: 85 });
            doc.text('LBS', 325, currentY + 3, { width: 50, align: 'right' });
            doc.text('UBICACIÓN', 380, currentY + 3, { width: 85 });
            doc.text('ESTADO', 470, currentY + 3, { width: 50 });
            doc.text('NOTAS', 525, currentY + 3, { width: 50 });
            currentY += 14;

            doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');
            for (const rem of remanentes) {
                if (currentY > 700) {
                    doc.addPage();
                    currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
                }
                doc.text(rem.remanente_code || `REM-${rem.id}`, 40, currentY, { width: 80 });
                doc.text(rem.product_type, 125, currentY, { width: 105 });
                doc.text(rem.remanente_type, 235, currentY, { width: 85 });
                doc.text(`${parseFloat(rem.quantity_lbs || 0).toLocaleString()} Lbs`, 325, currentY, { width: 50, align: 'right' });
                doc.text(rem.storage_location || 'Tanque', 380, currentY, { width: 85 });
                doc.text(rem.status || 'disponible', 470, currentY, { width: 50 });
                doc.text(rem.notes || '-', 525, currentY, { width: 50 });
                currentY += 11;
            }
            doc.rect(36, currentY, 540, 1).fill('#cbd5e1');
            currentY += 6;
        }
    }

    // 6. HISTORIAL DE MERMAS DE PRODUCCIÓN
    if (wasteLogs && wasteLogs.length > 0) {
        if (currentY > 640) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
        }
        doc.rect(36, currentY, 540, 15).fill('#f1f5f9');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5).text('6. HISTORIAL DE MERMAS Y DESPERDICIOS REGISTRADOS', 42, currentY + 4);
        currentY += 18;

        doc.rect(36, currentY, 540, 14).fill('#e2e8f0');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5);
        doc.text('FECHA/HORA', 40, currentY + 3.5, { width: 95 });
        doc.text('ETAPA', 140, currentY + 3.5, { width: 85 });
        doc.text('TIPO MERMA', 230, currentY + 3.5, { width: 95 });
        doc.text('LIBRAS', 330, currentY + 3.5, { width: 55, align: 'right' });
        doc.text('MOTIVO / CAUSA', 395, currentY + 3.5, { width: 110 });
        doc.text('OPERADOR', 510, currentY + 3.5, { width: 65, align: 'right' });
        currentY += 15;

        doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');
        for (const w of wasteLogs) {
            if (currentY > 700) {
                doc.addPage();
                currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
            }
            doc.text(new Date(w.created_at).toLocaleString(), 40, currentY, { width: 95 });
            doc.text(w.stage || 'Producción', 140, currentY, { width: 85, ellipsis: true });
            doc.text(w.waste_type || 'Merma', 230, currentY, { width: 95, ellipsis: true });
            doc.text(`${parseFloat(w.quantity_lbs || 0).toLocaleString()} Lbs`, 330, currentY, { width: 55, align: 'right' });
            doc.text(w.reason || '-', 395, currentY, { width: 110, ellipsis: true });
            doc.text(w.operator_name || 'N/A', 510, currentY, { width: 65, align: 'right', ellipsis: true });
            currentY += 12;
        }
        doc.rect(36, currentY, 540, 1).fill('#cbd5e1');
        currentY += 3;
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#e11d48');
        doc.text('TOTAL MERMAS REGISTRADAS:', 140, currentY, { width: 185, align: 'right' });
        doc.text(`${totals.wasteLogsWeight.toLocaleString()} Lbs`, 330, currentY, { width: 55, align: 'right' });
        currentY += 14;
    }

    // Salto de página defensivo si falta espacio para el Balance Final
    if (currentY > 580) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
    }

    // 7. BALANCE GENERAL DE MASAS Y EFICIENCIA OPERATIVA
    doc.rect(36, currentY, 540, 16).fill('#047857');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5).text('BALANCE FINAL DE MASAS Y EFICIENCIA DE PLANTA', 42, currentY + 4);
    currentY += 20;

    doc.rect(36, currentY, 540, 84).fill('#ecfdf5').stroke('#a7f3d0');
    doc.fillColor('#065f46').font('Helvetica-Bold').fontSize(7.5);

    // Fila 1
    doc.text('Peso Total de Entrada (Materia Prima):', 45, currentY + 8);
    doc.font('Helvetica').text(`${totals.totalInputWeight.toLocaleString()} Lbs (100.00%)`, 210, currentY + 8);

    doc.font('Helvetica-Bold').text('Cajas de Huevo Procesadas:', 330, currentY + 8);
    doc.font('Helvetica').text(`${totals.totalBoxes.toLocaleString()} Cjas`, 470, currentY + 8);

    // Fila 2
    doc.font('Helvetica-Bold').text('Rendimiento Líquido Obtenido:', 45, currentY + 22);
    doc.font('Helvetica').text(`${totals.liquidYield.toLocaleString()} Lbs (${totals.yieldPct}%)`, 210, currentY + 22);

    doc.font('Helvetica-Bold').text('Rendimiento por Caja:', 330, currentY + 22);
    doc.font('Helvetica').text(`${totals.yieldPerBoxLbs} Lbs / Caja`, 470, currentY + 22);

    // Fila 3
    doc.font('Helvetica-Bold').text('Total Envasado Comercial:', 45, currentY + 36);
    doc.font('Helvetica').text(`${totals.packagedWeight.toLocaleString()} Lbs`, 210, currentY + 36);

    doc.font('Helvetica-Bold').text('Eficiencia de Envasado:', 330, currentY + 36);
    doc.font('Helvetica').text(`${totals.packagingEfficiencyPct}%`, 470, currentY + 36);

    // Fila 4: Líquido + Envasado y % Rendimiento Total
    doc.font('Helvetica-Bold').text('Líquido + Envasado (Total):', 45, currentY + 50);
    doc.font('Helvetica').text(`${totals.liquidPlusPackagedLbs.toLocaleString()} Lbs`, 210, currentY + 50);

    doc.font('Helvetica-Bold').text('% Rendimiento (Líq. + Env.):', 330, currentY + 50);
    doc.font('Helvetica').text(`${totals.liquidPlusPackagedYieldPct}%`, 470, currentY + 50);

    // Fila 5: Mermas
    doc.font('Helvetica-Bold').text('Merma de Cáscara Quebrada:', 45, currentY + 64);
    doc.font('Helvetica').text(`${totals.shellWaste.toLocaleString()} Lbs`, 210, currentY + 64);

    doc.font('Helvetica-Bold').text('Merma Tuberías / Envasado:', 330, currentY + 64);
    const packagingLoss = parseFloat(batch.packaging_loss_lbs || 0);
    doc.font('Helvetica').text(`${packagingLoss.toLocaleString()} Lbs`, 470, currentY + 64);

    // Fila 6: Remanentes y Estatus
    doc.font('Helvetica-Bold').text('Remanente para Reproceso:', 45, currentY + 76);
    doc.font('Helvetica').text(`${totals.remanenteWeight.toLocaleString()} Lbs`, 210, currentY + 76);

    doc.font('Helvetica-Bold').text('Estatus Oficial de Lote:', 330, currentY + 76);
    doc.font('Helvetica').text((batch.status || '').toUpperCase(), 470, currentY + 76);

    currentY += 94;

    reportPdfHelper.renderClosingFooter(doc, 36, currentY, 1, 'Lote de Producción');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();

    return new Promise((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
}

/**
 * Genera el archivo Excel del Resumen de Producción.
 */
async function generateBatchSummaryExcel(batchId, companyId) {
    const data = await getBatchExportData(batchId, companyId);
    if (!data) throw new Error('Lote de producción no encontrado');

    const { 
        batch, 
        rawMaterials, 
        tarimasUsed, 
        pasteurizationLogs, 
        remanentes, 
        remanentesUsed, 
        packagingRecords, 
        wasteLogs, 
        cipLogs, 
        totals, 
        company 
    } = data;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sipe Web SaaS - Huevo Industrial';

    // Hoja 1: Resumen General y Balance
    const wsSummary = workbook.addWorksheet('Resumen de Lote');
    wsSummary.columns = [
        { width: 32 }, { width: 35 }, { width: 22 }, { width: 25 }
    ];

    wsSummary.mergeCells('A1:D1');
    const titleCell = wsSummary.getCell('A1');
    titleCell.value = `${company.razon_social || 'EMPRESA'} - RESUMEN DE PRODUCCIÓN`;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsSummary.getRow(1).height = 30;

    wsSummary.addRow(['LOTE OFICIAL:', batch.batch_code_display || batch.batch_uuid, 'ESTADO:', (batch.status || '').toUpperCase()]);
    wsSummary.addRow(['PRODUCTO:', (batch.product_type || '').toUpperCase(), 'PRESENTACIÓN:', batch.presentation || 'N/A']);
    wsSummary.addRow(['OPERADOR LÍDER:', batch.operator_name || 'N/A', 'FECHA INICIO:', new Date(batch.started_at).toLocaleString()]);
    wsSummary.addRow(['LOTE PASTEURIZACIÓN:', batch.pasteurization_lot || 'N/A', 'ESTADO PAST.:', (batch.pasteurization_status || 'pendiente').toUpperCase()]);
    wsSummary.addRow(['BRIX OBJETIVO:', batch.target_brix ? `${batch.target_brix}°Bx` : 'N/A', 'FECHA FIN:', batch.completed_at ? new Date(batch.completed_at).toLocaleString() : 'En proceso']);
    wsSummary.addRow(['SÓLIDOS TOTALES:', batch.target_solids_pct ? `${batch.target_solids_pct}%` : 'N/A', 'REGISTROS CIP:', cipLogs?.length || 0]);
    wsSummary.addRow([]);

    // Balance
    wsSummary.mergeCells('A9:D9');
    const balTitle = wsSummary.getCell('A9');
    balTitle.value = 'BALANCE GENERAL DE MASAS Y RENDIMIENTO';
    balTitle.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    balTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
    balTitle.alignment = { horizontal: 'center' };

    wsSummary.addRow(['CONCEPTO', 'CANTIDAD (LBS)', '% SOBRE ENTRADA', 'DETALLE / OBSERVACIÓN']);
    const rH = wsSummary.getRow(10);
    rH.font = { bold: true };

    wsSummary.addRow(['Peso Entrada (Materia Prima)', totals.totalInputWeight, '100.00%', `${totals.totalBoxes} Cajas procesadas`]);
    wsSummary.addRow(['Rendimiento Líquido Obtenido', totals.liquidYield, `${totals.yieldPct}%`, 'Aprobado en pasteurización']);
    wsSummary.addRow(['Rendimiento por Caja (Lbs/Cja)', totals.yieldPerBoxLbs, '-', `${totals.yieldPerBoxLbs} Lbs por caja`]);
    wsSummary.addRow(['Total Envasado Comercial', totals.packagedWeight, `${totals.liquidYield > 0 ? ((totals.packagedWeight / totals.liquidYield) * 100).toFixed(2) : 0}%`, 'Terminado comercial']);
    wsSummary.addRow(['Líquido + Envasado Comercial', totals.liquidPlusPackagedLbs, `${totals.liquidPlusPackagedYieldPct}%`, 'Líquido más envasado total']);
    wsSummary.addRow(['Merma de Cáscara', totals.shellWaste, `${totals.totalInputWeight > 0 ? ((totals.shellWaste / totals.totalInputWeight) * 100).toFixed(2) : 0}%`, 'Desecho']);
    wsSummary.addRow(['Merma en Tuberías / Envasado', parseFloat(batch.packaging_loss_lbs || 0), '-', 'Merma']);
    wsSummary.addRow(['Remanente de Otras Prod. Utilizado', totals.remanenteUsedWeight || 0, '-', 'Remanentes recibidos de producciones previas']);
    wsSummary.addRow(['Remanente Generado en Lote', totals.remanenteWeight, '-', 'Almacenado para reproceso']);

    // Hoja 2: Sanitización CIP
    const wsCip = workbook.addWorksheet('Sanitización CIP');
    wsCip.columns = [
        { header: 'Fecha/Hora', key: 'date', width: 22 },
        { header: 'Lote Vinculado', key: 'batch', width: 20 },
        { header: 'Equipo Sanitizado', key: 'equipment', width: 24 },
        { header: 'Agente Químico', key: 'chemical', width: 28 },
        { header: 'Temperatura °C', key: 'temp', width: 16 },
        { header: 'Duración (min)', key: 'duration', width: 16 },
        { header: 'Estado Validación', key: 'status', width: 20 },
        { header: 'Operador Responsable', key: 'operator', width: 22 },
        { header: 'Notas / Observaciones', key: 'notes', width: 35 }
    ];
    const cipHeader = wsCip.getRow(1);
    cipHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cipHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };
    for (const cl of (cipLogs || [])) {
        wsCip.addRow({
            date: new Date(cl.created_at).toLocaleString(),
            batch: cl.batch_code || cl.batch_uuid || (cl.batch_id ? `#${cl.batch_id}` : 'General / Pre-operacional'),
            equipment: (cl.equipment_name || 'Pasteurizador').toUpperCase(),
            chemical: cl.chemical_used,
            temp: parseFloat(cl.temperature_c || 0),
            duration: parseInt(cl.duration_minutes || 0, 10),
            status: (cl.validation_status || 'OK').toUpperCase(),
            operator: cl.operator_name || '',
            notes: cl.notes || ''
        });
    }

    // Hoja 3: Materias Primas Quebradas
    const wsMp = workbook.addWorksheet('Materia Prima Quebrada');
    wsMp.columns = [
        { header: 'Lote Proveedor', key: 'provider_lot', width: 22 },
        { header: 'Proveedor', key: 'provider_name', width: 28 },
        { header: 'Tipo Huevo', key: 'egg_type', width: 16 },
        { header: 'Cajas', key: 'boxes_count', width: 12 },
        { header: 'Tarimas', key: 'tarimas_count', width: 12 },
        { header: 'Libras', key: 'quantity_lbs', width: 16 }
    ];
    const mpHeader = wsMp.getRow(1);
    mpHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    mpHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };

    for (const rm of rawMaterials) {
        wsMp.addRow({
            provider_lot: rm.provider_lot,
            provider_name: rm.provider_name || 'General',
            egg_type: rm.egg_type,
            boxes_count: rm.boxes_count || 0,
            tarimas_count: rm.tarimas?.length || 1,
            quantity_lbs: parseFloat(rm.quantity_lbs || 0)
        });
    }

    // Hoja 4: Detalle de Tarimas Utilizadas
    const wsTarimas = workbook.addWorksheet('Tarimas Utilizadas');
    wsTarimas.columns = [
        { header: 'Tarima #', key: 'tarima_number', width: 14 },
        { header: 'Lote Proveedor', key: 'provider_lot', width: 22 },
        { header: 'Proveedor', key: 'provider_name', width: 28 },
        { header: 'Tipo Huevo', key: 'egg_type', width: 16 },
        { header: 'Cajas Quebradas', key: 'boxes_count', width: 16 },
        { header: 'Libras', key: 'quantity_lbs', width: 16 },
        { header: 'Ubicación', key: 'storage_location', width: 18 }
    ];
    const tHeader = wsTarimas.getRow(1);
    tHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    tHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };

    for (const t of (tarimasUsed || [])) {
        wsTarimas.addRow({
            tarima_number: `#${t.tarima_number}`,
            provider_lot: t.provider_lot,
            provider_name: t.provider_name || 'General',
            egg_type: t.egg_type,
            boxes_count: t.boxes_count || 0,
            quantity_lbs: parseFloat(t.quantity_lbs || 0),
            storage_location: t.storage_location || 'Cámara Fría'
        });
    }

    // Hoja 5: Pasteurización HACCP
    const wsPast = workbook.addWorksheet('Pasteurización HACCP');
    wsPast.columns = [
        { header: 'Fecha/Hora', key: 'date', width: 22 },
        { header: 'Temp °C (PCC)', key: 'temp', width: 16 },
        { header: 'Retención (seg)', key: 'holding', width: 16 },
        { header: 'Presión (PSI)', key: 'pressure', width: 16 },
        { header: 'Caudal (GPM)', key: 'flow', width: 16 },
        { header: 'Operador Responsable', key: 'operator', width: 22 },
        { header: 'Notas / Observaciones', key: 'notes', width: 30 }
    ];
    const pastHeader = wsPast.getRow(1);
    pastHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    pastHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } };
    for (const pl of (pasteurizationLogs || [])) {
        wsPast.addRow({
            date: new Date(pl.created_at).toLocaleString(),
            temp: parseFloat(pl.temperature_c || 0),
            holding: pl.holding_time_seconds,
            pressure: parseFloat(pl.pressure_psi || 0),
            flow: parseFloat(pl.flow_rate_gpm || 0),
            operator: pl.operator_name || '',
            notes: pl.notes || ''
        });
    }

    // Hoja 6: Envasado y Empaque
    const wsPkg = workbook.addWorksheet('Envasado Comercial');
    wsPkg.columns = [
        { header: 'Lote Comercial', key: 'lot_code', width: 24 },
        { header: 'Presentación', key: 'presentation', width: 20 },
        { header: 'Unidades', key: 'units', width: 14 },
        { header: 'Peso Unit (Lbs)', key: 'unit_weight', width: 16 },
        { header: 'Total Lbs', key: 'total_lbs', width: 16 },
        { header: 'Zona Frío', key: 'zone', width: 16 },
        { header: 'Estado', key: 'state', width: 14 }
    ];
    const pkgHeader = wsPkg.getRow(1);
    pkgHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    pkgHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };

    for (const pk of packagingRecords) {
        wsPkg.addRow({
            lot_code: pk.lot_code,
            presentation: pk.presentation,
            units: pk.units_packaged,
            unit_weight: parseFloat(pk.weight_per_unit_lbs || 0),
            total_lbs: parseFloat(pk.total_batch_weight_lbs || 0),
            zone: pk.warehouse_zone,
            state: pk.product_state
        });
    }

    // Hoja 7: Remanentes de Otras Producciones Utilizados
    if (remanentesUsed && remanentesUsed.length > 0) {
        const wsRemUsed = workbook.addWorksheet('Remanentes de Otras Prod');
        wsRemUsed.columns = [
            { header: 'Lote Origen', key: 'source_batch', width: 22 },
            { header: 'Fecha Origen', key: 'source_date', width: 18 },
            { header: 'Producto', key: 'product_type', width: 24 },
            { header: 'Tipo Remanente', key: 'remanente_type', width: 18 },
            { header: 'Libras Utilizadas', key: 'quantity_lbs', width: 18 },
            { header: 'Ubicación / Notas', key: 'notes', width: 30 }
        ];
        const ruHeader = wsRemUsed.getRow(1);
        ruHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        ruHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };

        for (const ru of remanentesUsed) {
            wsRemUsed.addRow({
                source_batch: ru.source_batch_code || `Lote #${ru.batch_id}`,
                source_date: ru.source_batch_date ? new Date(ru.source_batch_date).toLocaleDateString() : (ru.created_at ? new Date(ru.created_at).toLocaleDateString() : '-'),
                product_type: (ru.product_type || 'Huevo').toUpperCase(),
                remanente_type: ru.remanente_type || 'pasteurizado',
                quantity_lbs: parseFloat(ru.quantity_lbs || 0),
                notes: ru.notes || ru.storage_location || '-'
            });
        }
    }

    // Hoja 8: Remanentes Generados
    if (remanentes && remanentes.length > 0) {
        const wsRemGen = workbook.addWorksheet('Remanentes Generados');
        wsRemGen.columns = [
            { header: 'Código', key: 'code', width: 18 },
            { header: 'Producto', key: 'product', width: 22 },
            { header: 'Tipo Remanente', key: 'type', width: 18 },
            { header: 'Libras', key: 'quantity_lbs', width: 16 },
            { header: 'Ubicación / Tanque', key: 'location', width: 22 },
            { header: 'Estado', key: 'status', width: 16 },
            { header: 'Fecha Generación', key: 'date', width: 20 },
            { header: 'Notas', key: 'notes', width: 35 }
        ];
        const remGenHeader = wsRemGen.getRow(1);
        remGenHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        remGenHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };

        for (const rem of remanentes) {
            wsRemGen.addRow({
                code: rem.remanente_code || `REM-${rem.id}`,
                product: rem.product_type,
                type: rem.remanente_type,
                quantity_lbs: parseFloat(rem.quantity_lbs || 0),
                location: rem.storage_location || 'Tanque',
                status: rem.status || 'disponible',
                date: new Date(rem.created_at).toLocaleString(),
                notes: rem.notes || ''
            });
        }
    }

    // Hoja 9: Mermas Registradas
    const wsWaste = workbook.addWorksheet('Historial de Mermas');
    wsWaste.columns = [
        { header: 'Fecha', key: 'date', width: 20 },
        { header: 'Etapa', key: 'stage', width: 18 },
        { header: 'Tipo Merma', key: 'waste_type', width: 22 },
        { header: 'Libras', key: 'quantity_lbs', width: 14 },
        { header: 'Motivo / Causa', key: 'reason', width: 35 },
        { header: 'Operador', key: 'operator', width: 22 }
    ];
    const wHeader = wsWaste.getRow(1);
    wHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    wHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D48' } };

    for (const w of (wasteLogs || [])) {
        wsWaste.addRow({
            date: new Date(w.created_at).toLocaleString(),
            stage: w.stage,
            waste_type: w.waste_type,
            quantity_lbs: parseFloat(w.quantity_lbs || 0),
            reason: w.reason || '',
            operator: w.operator_name || ''
        });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}

/**
 * Genera el archivo Word (.docx) del Resumen de Producción usando la biblioteca 'docx'.
 */
async function generateBatchSummaryWord(batchId, companyId) {
    const data = await getBatchExportData(batchId, companyId);
    if (!data) throw new Error('Lote de producción no encontrado');

    const { 
        batch, 
        rawMaterials, 
        tarimasUsed, 
        pasteurizationLogs, 
        remanentes, 
        remanentesUsed, 
        packagingRecords, 
        wasteLogs, 
        cipLogs, 
        totals, 
        company 
    } = data;

    const { Document, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, HeadingLevel, ShadingType } = docx;

    const thinBorder = {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' }
    };

    const makeHeaderCell = (text, widthPct = null) => new TableCell({
        borders: thinBorder,
        shading: { type: ShadingType.CLEAR, fill: '1E293B' },
        width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF' })] })]
    });

    const makeDataCell = (text, isBold = false, widthPct = null) => new TableCell({
        borders: thinBorder,
        width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
        children: [new Paragraph({ children: [new TextRun({ text: String(text ?? ''), bold: isBold })] })]
    });

    const docChildren = [
        new Paragraph({
            text: company.razon_social || 'PLANTA INDUSTRIAL DE PROCESAMIENTO',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER
        }),
        new Paragraph({
            text: `RESUMEN OFICIAL DE PRODUCCIÓN Y BALANCE DE MASAS`,
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER
        }),
        new Paragraph({
            text: `${(batch.batch_code_display || batch.batch_uuid || '').toUpperCase().startsWith('LOTE') ? '' : 'LOTE: '}${batch.batch_code_display || batch.batch_uuid} | Fecha: ${new Date(batch.started_at).toLocaleDateString()}`,
            alignment: AlignmentType.CENTER
        }),
        new Paragraph({ text: '' }),

        // Sección 1: Ficha del Lote
        new Paragraph({
            text: '1. FICHA TÉCNICA DEL LOTE DE PRODUCCIÓN',
            heading: HeadingLevel.HEADING_3
        }),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        makeDataCell('Lote Oficial:', true, 25),
                        makeDataCell(batch.batch_code_display || batch.batch_uuid, false, 25),
                        makeDataCell('Producto:', true, 25),
                        makeDataCell((batch.product_type || '').toUpperCase(), false, 25)
                    ]
                }),
                new TableRow({
                    children: [
                        makeDataCell('Presentación:', true, 25),
                        makeDataCell(batch.presentation || 'N/A', false, 25),
                        makeDataCell('Operador Responsable:', true, 25),
                        makeDataCell(batch.operator_name || 'N/A', false, 25)
                    ]
                }),
                new TableRow({
                    children: [
                        makeDataCell('Inicio:', true, 25),
                        makeDataCell(new Date(batch.started_at).toLocaleString(), false, 25),
                        makeDataCell('Finalización:', true, 25),
                        makeDataCell(batch.completed_at ? new Date(batch.completed_at).toLocaleString() : 'En proceso', false, 25)
                    ]
                }),
                new TableRow({
                    children: [
                        makeDataCell('Lote Pasteurización:', true, 25),
                        makeDataCell(batch.pasteurization_lot || 'N/A', false, 25),
                        makeDataCell('Estado Past.:', true, 25),
                        makeDataCell((batch.pasteurization_status || 'pendiente').toUpperCase(), false, 25)
                    ]
                }),
                new TableRow({
                    children: [
                        makeDataCell('Brix Objetivo:', true, 25),
                        makeDataCell(batch.target_brix ? `${batch.target_brix}°Bx` : 'N/A', false, 25),
                        makeDataCell('Sólidos Totales:', true, 25),
                        makeDataCell(batch.target_solids_pct ? `${batch.target_solids_pct}%` : 'N/A', false, 25)
                    ]
                })
            ]
        }),
        new Paragraph({ text: '' }),

        // Sección 2: Sanitización CIP
        new Paragraph({
            text: '2. CONTROL HIGIÉNICO Y SANITIZACIÓN PRE-OPERACIONAL (CIP)',
            heading: HeadingLevel.HEADING_3
        })
    ];

    if (cipLogs && cipLogs.length > 0) {
        docChildren.push(
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            makeHeaderCell('Fecha/Hora', 22),
                            makeHeaderCell('Equipo', 18),
                            makeHeaderCell('Químico', 22),
                            makeHeaderCell('Temp °C', 10),
                            makeHeaderCell('Tiempo', 10),
                            makeHeaderCell('Estado', 18)
                        ]
                    }),
                    ...cipLogs.map(cl => new TableRow({
                        children: [
                            makeDataCell(new Date(cl.created_at).toLocaleString()),
                            makeDataCell((cl.equipment_name || '').toUpperCase()),
                            makeDataCell(cl.chemical_used),
                            makeDataCell(`${parseFloat(cl.temperature_c || 0).toFixed(1)} °C`),
                            makeDataCell(`${cl.duration_minutes || 0}m`),
                            makeDataCell((cl.validation_status || 'OK').toUpperCase())
                        ]
                    }))
                ]
            })
        );
    } else {
        docChildren.push(new Paragraph({ text: 'Sin registros específicos de sanitización CIP vinculados.', italics: true }));
    }
    docChildren.push(new Paragraph({ text: '' }));

    // Sección 3: Materia Prima Quebrada
    docChildren.push(
        new Paragraph({
            text: '3. MATERIA PRIMA UTILIZADA EN EL QUEBRAJE',
            heading: HeadingLevel.HEADING_3
        }),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        makeHeaderCell('Lote MP', 20),
                        makeHeaderCell('Proveedor', 30),
                        makeHeaderCell('Tipo Huevo', 18),
                        makeHeaderCell('Cajas', 14),
                        makeHeaderCell('Libras', 18)
                    ]
                }),
                ...rawMaterials.map(rm => new TableRow({
                    children: [
                        makeDataCell(rm.provider_lot || 'N/A'),
                        makeDataCell(rm.provider_name || 'General'),
                        makeDataCell(rm.egg_type || 'Cáscara'),
                        makeDataCell(String(rm.boxes_count || 0)),
                        makeDataCell(`${parseFloat(rm.quantity_lbs || 0).toLocaleString()} Lbs`)
                    ]
                })),
                new TableRow({
                    children: [
                        new TableCell({
                            borders: thinBorder,
                            columnSpan: 4,
                            children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL PESO ENTRADA:', bold: true })] })]
                        }),
                        makeDataCell(`${totals.totalInputWeight.toLocaleString()} Lbs`, true)
                    ]
                })
            ]
        }),
        new Paragraph({ text: '' })
    );

    // Sección 4: Detalle de Tarimas Utilizadas
    if (tarimasUsed && tarimasUsed.length > 0) {
        docChildren.push(
            new Paragraph({
                text: '4. DETALLE DE TARIMAS UTILIZADAS EN ESTA PRODUCCIÓN',
                heading: HeadingLevel.HEADING_3
            }),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            makeHeaderCell('Tarima #', 12),
                            makeHeaderCell('Lote Proveedor', 22),
                            makeHeaderCell('Proveedor', 26),
                            makeHeaderCell('Tipo', 14),
                            makeHeaderCell('Cajas', 12),
                            makeHeaderCell('Libras', 14)
                        ]
                    }),
                    ...tarimasUsed.map(t => new TableRow({
                        children: [
                            makeDataCell(`#${t.tarima_number}`),
                            makeDataCell(t.provider_lot || 'N/A'),
                            makeDataCell(t.provider_name || 'General'),
                            makeDataCell(t.egg_type || 'Cáscara'),
                            makeDataCell(String(t.boxes_count || 0)),
                            makeDataCell(`${parseFloat(t.quantity_lbs || 0).toLocaleString()} Lbs`)
                        ]
                    }))
                ]
            }),
            new Paragraph({ text: '' })
        );
    }

    // Sección 5: Pasteurización HACCP
    docChildren.push(
        new Paragraph({
            text: '5. PARÁMETROS CRÍTICOS DE CONTROL HACCP (PASTEURIZACIÓN TÉRMICA)',
            heading: HeadingLevel.HEADING_3
        })
    );
    if (pasteurizationLogs && pasteurizationLogs.length > 0) {
        docChildren.push(
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            makeHeaderCell('Fecha/Hora', 24),
                            makeHeaderCell('Temp °C (Crítico)', 16),
                            makeHeaderCell('Retención (seg)', 16),
                            makeHeaderCell('Presión PSI', 14),
                            makeHeaderCell('Caudal GPM', 14),
                            makeHeaderCell('Operador', 16)
                        ]
                    }),
                    ...pasteurizationLogs.map(pl => new TableRow({
                        children: [
                            makeDataCell(new Date(pl.created_at).toLocaleString()),
                            makeDataCell(`${parseFloat(pl.temperature_c).toFixed(1)} °C`),
                            makeDataCell(`${pl.holding_time_seconds} s`),
                            makeDataCell(`${parseFloat(pl.pressure_psi).toFixed(1)} PSI`),
                            makeDataCell(`${parseFloat(pl.flow_rate_gpm).toFixed(1)} GPM`),
                            makeDataCell(pl.operator_name || 'N/A')
                        ]
                    }))
                ]
            })
        );
    } else {
        docChildren.push(new Paragraph({ text: 'Sin registros de corrida térmica registrados aún.', italics: true }));
    }
    docChildren.push(new Paragraph({ text: '' }));

    // Sección 6: Envasado y Empaque
    docChildren.push(
        new Paragraph({
            text: '6. ENVASADO COMERCIAL Y PRODUCTO TERMINADO',
            heading: HeadingLevel.HEADING_3
        }),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        makeHeaderCell('Lote Comercial', 24),
                        makeHeaderCell('Presentación', 20),
                        makeHeaderCell('Unidades', 14),
                        makeHeaderCell('Peso Unit', 14),
                        makeHeaderCell('Total Lbs', 14),
                        makeHeaderCell('Zona Frío', 14)
                    ]
                }),
                ...packagingRecords.map(pk => new TableRow({
                    children: [
                        makeDataCell(pk.lot_code || 'N/A'),
                        makeDataCell(pk.presentation || 'cubeta 30LB'),
                        makeDataCell(String(pk.units_packaged || 0)),
                        makeDataCell(`${parseFloat(pk.weight_per_unit_lbs || 0).toFixed(2)} Lbs`),
                        makeDataCell(`${parseFloat(pk.total_batch_weight_lbs || 0).toLocaleString()} Lbs`),
                        makeDataCell(pk.warehouse_zone || 'COOLER')
                    ]
                })),
                new TableRow({
                    children: [
                        new TableCell({
                            borders: thinBorder,
                            columnSpan: 4,
                            children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL ENVASADO REAL:', bold: true })] })]
                        }),
                        new TableCell({
                            borders: thinBorder,
                            columnSpan: 2,
                            children: [new Paragraph({ children: [new TextRun({ text: `${totals.packagedWeight.toLocaleString()} Lbs`, bold: true })] })]
                        })
                    ]
                })
            ]
        }),
        new Paragraph({ text: '' })
    );

    // Sección 7: Remanentes de Otras Producciones Utilizados
    if (remanentesUsed && remanentesUsed.length > 0) {
        docChildren.push(
            new Paragraph({
                text: '7. REMANENTES DE OTRAS PRODUCCIONES UTILIZADOS EN ESTE LOTE',
                heading: HeadingLevel.HEADING_3
            }),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            makeHeaderCell('Lote Origen', 22),
                            makeHeaderCell('Fecha Origen', 18),
                            makeHeaderCell('Producto', 20),
                            makeHeaderCell('Tipo', 16),
                            makeHeaderCell('Libras', 14),
                            makeHeaderCell('Notas', 20)
                        ]
                    }),
                    ...remanentesUsed.map(ru => new TableRow({
                        children: [
                            makeDataCell(ru.source_batch_code || `Lote #${ru.batch_id}`),
                            makeDataCell(ru.source_batch_date ? new Date(ru.source_batch_date).toLocaleDateString() : '-'),
                            makeDataCell((ru.product_type || 'Huevo').toUpperCase()),
                            makeDataCell(ru.remanente_type || 'pasteurizado'),
                            makeDataCell(`${parseFloat(ru.quantity_lbs || 0).toLocaleString()} Lbs`),
                            makeDataCell(ru.notes || '-')
                        ]
                    }))
                ]
            }),
            new Paragraph({ text: '' })
        );
    }

    // Sección 8: Remanentes Generados
    if (remanentes && remanentes.length > 0) {
        docChildren.push(
            new Paragraph({
                text: '8. REMANENTES GENERADOS EN ESTA PRODUCCIÓN',
                heading: HeadingLevel.HEADING_3
            }),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            makeHeaderCell('Código', 20),
                            makeHeaderCell('Producto', 24),
                            makeHeaderCell('Tipo', 18),
                            makeHeaderCell('Libras', 14),
                            makeHeaderCell('Ubicación', 24)
                        ]
                    }),
                    ...remanentes.map(rem => new TableRow({
                        children: [
                            makeDataCell(rem.remanente_code || `REM-${rem.id}`),
                            makeDataCell(rem.product_type),
                            makeDataCell(rem.remanente_type),
                            makeDataCell(`${parseFloat(rem.quantity_lbs || 0).toLocaleString()} Lbs`),
                            makeDataCell(rem.storage_location || 'Tanque')
                        ]
                    }))
                ]
            }),
            new Paragraph({ text: '' })
        );
    }

    // Sección 9: Mermas de Producción
    if (wasteLogs && wasteLogs.length > 0) {
        docChildren.push(
            new Paragraph({
                text: '9. HISTORIAL DE MERMAS DE PRODUCCIÓN REGISTRADAS',
                heading: HeadingLevel.HEADING_3
            }),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            makeHeaderCell('Fecha/Hora', 22),
                            makeHeaderCell('Etapa', 18),
                            makeHeaderCell('Tipo Merma', 20),
                            makeHeaderCell('Libras', 14),
                            makeHeaderCell('Motivo / Causa', 26)
                        ]
                    }),
                    ...wasteLogs.map(w => new TableRow({
                        children: [
                            makeDataCell(new Date(w.created_at).toLocaleString()),
                            makeDataCell(w.stage || 'Producción'),
                            makeDataCell(w.waste_type || 'Merma'),
                            makeDataCell(`${parseFloat(w.quantity_lbs || 0).toLocaleString()} Lbs`),
                            makeDataCell(w.reason || '-')
                        ]
                    })),
                    new TableRow({
                        children: [
                            new TableCell({
                                borders: thinBorder,
                                columnSpan: 3,
                                children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL MERMAS REGISTRADAS:', bold: true })] })]
                            }),
                            new TableCell({
                                borders: thinBorder,
                                columnSpan: 2,
                                children: [new Paragraph({ children: [new TextRun({ text: `${totals.wasteLogsWeight.toLocaleString()} Lbs`, bold: true })] })]
                            })
                        ]
                    })
                ]
            }),
            new Paragraph({ text: '' })
        );
    }

    // Sección 10: Balance General de Masas
    docChildren.push(
        new Paragraph({
            text: '10. BALANCE GENERAL DE MASAS Y EFICIENCIA OPERATIVA',
            heading: HeadingLevel.HEADING_3
        }),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        makeDataCell('Peso Total Entrada (Materia Prima):', true, 50),
                        makeDataCell(`${totals.totalInputWeight.toLocaleString()} Lbs (100.00%)`, false, 50)
                    ]
                }),
                new TableRow({
                    children: [
                        makeDataCell('Cajas de Huevo Procesadas:', true, 50),
                        makeDataCell(`${totals.totalBoxes.toLocaleString()} Cajas`, false, 50)
                    ]
                }),
                new TableRow({
                    children: [
                        makeDataCell('Rendimiento Líquido Pasteurizado:', true, 50),
                        makeDataCell(`${totals.liquidYield.toLocaleString()} Lbs (${totals.yieldPct}%)`, false, 50)
                    ]
                }),
                new TableRow({
                    children: [
                        makeDataCell('Rendimiento por Caja:', true, 50),
                        makeDataCell(`${totals.yieldPerBoxLbs} Lbs / Caja`, false, 50)
                    ]
                }),
                new TableRow({
                    children: [
                        makeDataCell('Total Envasado Comercial:', true, 50),
                        makeDataCell(`${totals.packagedWeight.toLocaleString()} Lbs`, false, 50)
                    ]
                }),
                new TableRow({
                    children: [
                        makeDataCell('Eficiencia de Envasado:', true, 50),
                        makeDataCell(`${totals.packagingEfficiencyPct}%`, false, 50)
                    ]
                }),
                new TableRow({
                    children: [
                        makeDataCell('Líquido + Envasado (Total):', true, 50),
                        makeDataCell(`${totals.liquidPlusPackagedLbs.toLocaleString()} Lbs`, false, 50)
                    ]
                }),
                new TableRow({
                    children: [
                        makeDataCell('% Rendimiento (Líq. + Env.):', true, 50),
                        makeDataCell(`${totals.liquidPlusPackagedYieldPct}%`, false, 50)
                    ]
                }),
                new TableRow({
                    children: [
                        makeDataCell('Merma de Cáscara:', true, 50),
                        makeDataCell(`${totals.shellWaste.toLocaleString()} Lbs`, false, 50)
                    ]
                }),
                new TableRow({
                    children: [
                        makeDataCell('Merma en Tuberías / Envasado:', true, 50),
                        makeDataCell(`${parseFloat(batch.packaging_loss_lbs || 0).toLocaleString()} Lbs`, false, 50)
                    ]
                }),
                new TableRow({
                    children: [
                        makeDataCell('Remanente para Reproceso:', true, 50),
                        makeDataCell(`${totals.remanenteWeight.toLocaleString()} Lbs`, false, 50)
                    ]
                }),
                new TableRow({
                    children: [
                        makeDataCell('Remanentes de Otras Prod. Utilizados:', true, 50),
                        makeDataCell(`${(totals.remanenteUsedWeight || 0).toLocaleString()} Lbs`, false, 50)
                    ]
                }),
                new TableRow({
                    children: [
                        makeDataCell('Estatus Oficial de Lote:', true, 50),
                        makeDataCell((batch.status || '').toUpperCase(), true, 50)
                    ]
                })
            ]
        })
    );

    const doc = new Document({
        sections: [{
            properties: {},
            children: docChildren
        }]
    });

    const buffer = await docx.Packer.toBuffer(doc);
    return buffer;
}

module.exports = {
    getBatchExportData,
    generateBatchSummaryPdf,
    generateBatchSummaryExcel,
    generateBatchSummaryWord
};
