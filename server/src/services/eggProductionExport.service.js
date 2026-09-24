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

    // 2. Registros de pasteurización
    const [pasteurizationLogs] = await pool.query(
        `SELECT * FROM egg_pasteurization_logs 
         WHERE batch_id = ? AND company_id = ?
         ORDER BY created_at ASC`,
        [batchId, companyId]
    );

    // 3. Remanentes y reprocesos
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

    return {
        batch,
        rawMaterials,
        pasteurizationLogs,
        remanentes,
        packagingRecords,
        wasteLogs,
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

    const { batch, rawMaterials, pasteurizationLogs, remanentes, packagingRecords, wasteLogs, totals, company } = data;

    const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'portrait',
        margin: 36,
        bufferPages: true
    });

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));

    const title = `RESUMEN DE PRODUCCIÓN Y BALANCE DE MASAS - LOTE ${batch.batch_code_display || batch.batch_uuid}`;
    const subtitle = `PLANTA INDUSTRIAL DE PROCESAMIENTO Y PASTEURIZACIÓN DE OVOPRODUCTOS`;
    const periodText = `Fecha de Procesamiento: ${new Date(batch.started_at).toLocaleDateString()} | Estado: ${(batch.status || '').toUpperCase()}`;

    let currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);

    // 1. FICHA TÉCNICA DEL LOTE
    doc.rect(36, currentY, 540, 16).fill('#1e293b');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5).text('1. INFORMACIÓN GENERAL Y PARÁMETROS DEL LOTE', 42, currentY + 4);
    currentY += 22;

    doc.rect(36, currentY, 540, 48).fill('#f8fafc').stroke('#e2e8f0');
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

    doc.font('Helvetica-Bold').text('Brix Esperado:', 42, currentY + 34);
    doc.font('Helvetica').text(batch.target_brix ? `${batch.target_brix}°Bx` : 'N/A', 105, currentY + 34);

    doc.font('Helvetica-Bold').text('Sólidos Totales:', 240, currentY + 34);
    doc.font('Helvetica').text(batch.target_solids_pct ? `${batch.target_solids_pct}%` : 'N/A', 305, currentY + 34);

    doc.font('Helvetica-Bold').text('Estado:', 410, currentY + 34);
    doc.font('Helvetica').text((batch.status || '').toUpperCase(), 445, currentY + 34);

    currentY += 56;

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

    // 3. PASTEURIZACIÓN
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

    // 5. REMANENTES Y REPROCESOS (si existen)
    if (remanentes.length > 0) {
        doc.rect(36, currentY, 540, 15).fill('#f1f5f9');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5).text('5. REMANENTES, REPROCESOS Y REUTILIZABLES', 42, currentY + 4);
        currentY += 18;

        doc.rect(36, currentY, 540, 14).fill('#e2e8f0');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5);
        doc.text('PRODUCTO', 40, currentY + 3.5, { width: 120 });
        doc.text('TIPO REMANENTE', 165, currentY + 3.5, { width: 100 });
        doc.text('LBS', 270, currentY + 3.5, { width: 50, align: 'right' });
        doc.text('UBICACIÓN', 325, currentY + 3.5, { width: 100 });
        doc.text('ESTADO', 430, currentY + 3.5, { width: 60 });
        doc.text('NOTAS', 495, currentY + 3.5, { width: 75 });
        currentY += 15;

        doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');
        for (const rem of remanentes) {
            doc.text(rem.product_type, 40, currentY, { width: 120 });
            doc.text(rem.remanente_type, 165, currentY, { width: 100 });
            doc.text(`${parseFloat(rem.quantity_lbs || 0).toLocaleString()} Lbs`, 270, currentY, { width: 50, align: 'right' });
            doc.text(rem.storage_location || 'Tanque', 325, currentY, { width: 100 });
            doc.text(rem.status || 'disponible', 430, currentY, { width: 60 });
            doc.text(rem.notes || '-', 495, currentY, { width: 75 });
            currentY += 12;
        }
        currentY += 6;
    }

    // Salto de página defensivo si falta espacio para el Balance Final
    if (currentY > 580) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
    }

    // 6. BALANCE GENERAL DE MASAS Y EFICIENCIA OPERATIVA
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

    const { batch, rawMaterials, pasteurizationLogs, remanentes, packagingRecords, wasteLogs, totals, company } = data;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sipe Web SaaS - Huevo Industrial';

    // Hoja 1: Resumen General y Balance
    const wsSummary = workbook.addWorksheet('Resumen de Lote');
    wsSummary.columns = [
        { width: 28 }, { width: 35 }, { width: 22 }, { width: 22 }
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
    wsSummary.addRow(['BRIX OBJETIVO:', batch.target_brix ? `${batch.target_brix}°Bx` : 'N/A', 'FECHA FIN:', batch.completed_at ? new Date(batch.completed_at).toLocaleString() : 'En proceso']);
    wsSummary.addRow([]);

    // Balance
    wsSummary.mergeCells('A7:D7');
    const balTitle = wsSummary.getCell('A7');
    balTitle.value = 'BALANCE GENERAL DE MASAS Y RENDIMIENTO';
    balTitle.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    balTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
    balTitle.alignment = { horizontal: 'center' };

    wsSummary.addRow(['CONCEPTO', 'CANTIDAD (LBS)', '% SOBRE ENTRADA', 'DETALLE / OBSERVACIÓN']);
    const rH = wsSummary.getRow(8);
    rH.font = { bold: true };

    wsSummary.addRow(['Peso Entrada (Materia Prima)', totals.totalInputWeight, '100.00%', `${totals.totalBoxes} Cajas procesadas`]);
    wsSummary.addRow(['Rendimiento Líquido Obtenido', totals.liquidYield, `${totals.yieldPct}%`, 'Aprobado en pasteurización']);
    wsSummary.addRow(['Rendimiento por Caja (Lbs/Cja)', totals.yieldPerBoxLbs, '-', `${totals.yieldPerBoxLbs} Lbs por caja`]);
    wsSummary.addRow(['Total Envasado Comercial', totals.packagedWeight, `${totals.liquidYield > 0 ? ((totals.packagedWeight / totals.liquidYield) * 100).toFixed(2) : 0}%`, 'Terminado comercial']);
    wsSummary.addRow(['Líquido + Envasado Comercial', totals.liquidPlusPackagedLbs, `${totals.liquidPlusPackagedYieldPct}%`, 'Líquido más envasado total']);
    wsSummary.addRow(['Merma de Cáscara', totals.shellWaste, `${totals.totalInputWeight > 0 ? ((totals.shellWaste / totals.totalInputWeight) * 100).toFixed(2) : 0}%`, 'Desecho']);
    wsSummary.addRow(['Merma en Tuberías / Envasado', parseFloat(batch.packaging_loss_lbs || 0), '-', 'Merma']);
    wsSummary.addRow(['Remanente / Reproceso', totals.remanenteWeight, '-', 'Almacenado']);

    // Hoja 2: Materias Primas Quebradas
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

    // Hoja 3: Envasado y Empaque
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

    // Hoja 4: Mermas Registradas
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

    for (const w of wasteLogs) {
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

    const { batch, rawMaterials, pasteurizationLogs, remanentes, packagingRecords, wasteLogs, totals, company } = data;

    const { Document, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, HeadingLevel } = docx;

    const thinBorder = {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
    };

    const doc = new Document({
        sections: [{
            properties: {},
            children: [
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
                    text: `LOTE: ${batch.batch_code_display || batch.batch_uuid} | Fecha: ${new Date(batch.started_at).toLocaleDateString()}`,
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
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Lote Oficial:', bold: true }), new TextRun(` ${batch.batch_code_display || batch.batch_uuid}`)] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Producto:', bold: true }), new TextRun(` ${(batch.product_type || '').toUpperCase()}`)] })] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Presentación:', bold: true }), new TextRun(` ${batch.presentation || 'N/A'}`)] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Operador Responsable:', bold: true }), new TextRun(` ${batch.operator_name || 'N/A'}`)] })] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Inicio:', bold: true }), new TextRun(` ${new Date(batch.started_at).toLocaleString()}`)] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Finalización:', bold: true }), new TextRun(` ${batch.completed_at ? new Date(batch.completed_at).toLocaleString() : 'En proceso'}`)] })] })
                            ]
                        })
                    ]
                }),
                new Paragraph({ text: '' }),

                // Sección 2: Materia Prima
                new Paragraph({
                    text: '2. MATERIA PRIMA UTILIZADA EN EL QUEBRAJE',
                    heading: HeadingLevel.HEADING_3
                }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Lote MP', bold: true })] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Proveedor', bold: true })] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Tipo', bold: true })] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Cajas', bold: true })] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Libras', bold: true })] })] })
                            ]
                        }),
                        ...rawMaterials.map(rm => new TableRow({
                            children: [
                                new TableCell({ borders: thinBorder, children: [new Paragraph(rm.provider_lot || '')] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph(rm.provider_name || 'General')] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph(rm.egg_type || '')] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph(String(rm.boxes_count || 0))] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph(`${parseFloat(rm.quantity_lbs || 0).toLocaleString()} Lbs`)] })
                            ]
                        })),
                        new TableRow({
                            children: [
                                new TableCell({ borders: thinBorder, columnSpan: 4, children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL PESO ENTRADA:', bold: true })] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: `${totals.totalInputWeight.toLocaleString()} Lbs`, bold: true })] })] })
                            ]
                        })
                    ]
                }),
                new Paragraph({ text: '' }),

                // Sección 3: Envasado y Empaque
                new Paragraph({
                    text: '3. ENVASADO Y PRODUCTO TERMINADO',
                    heading: HeadingLevel.HEADING_3
                }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Lote Comercial', bold: true })] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Presentación', bold: true })] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Unidades', bold: true })] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Total Lbs', bold: true })] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Zona Frío', bold: true })] })] })
                            ]
                        }),
                        ...packagingRecords.map(pk => new TableRow({
                            children: [
                                new TableCell({ borders: thinBorder, children: [new Paragraph(pk.lot_code || '')] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph(pk.presentation || '')] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph(String(pk.units_packaged || 0))] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph(`${parseFloat(pk.total_batch_weight_lbs || 0).toLocaleString()} Lbs`)] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph(pk.warehouse_zone || 'COOLER')] })
                            ]
                        })),
                        new TableRow({
                            children: [
                                new TableCell({ borders: thinBorder, columnSpan: 3, children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL ENVASADO REAL:', bold: true })] })] }),
                                new TableCell({ borders: thinBorder, columnSpan: 2, children: [new Paragraph({ children: [new TextRun({ text: `${totals.packagedWeight.toLocaleString()} Lbs`, bold: true })] })] })
                            ]
                        })
                    ]
                }),
                new Paragraph({ text: '' }),

                // Sección 4: Balance de Masas
                new Paragraph({
                    text: '4. BALANCE GENERAL DE MASAS Y EFICIENCIA OPERATIVA',
                    heading: HeadingLevel.HEADING_3
                }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Peso Total Entrada:', bold: true })] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph(`${totals.totalInputWeight.toLocaleString()} Lbs (100%)`)] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Cajas de Huevo (MP):', bold: true })] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph(`${totals.totalBoxes.toLocaleString()} Cjas`)] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Rendimiento Líquido Pasteurizado:', bold: true })] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph(`${totals.liquidYield.toLocaleString()} Lbs (${totals.yieldPct}%)`)] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Rendimiento por Caja:', bold: true })] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph(`${totals.yieldPerBoxLbs} Lbs / Caja`)] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Envasado Real:', bold: true })] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph(`${totals.packagedWeight.toLocaleString()} Lbs`)] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Líquido + Envasado (Total):', bold: true })] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph(`${totals.liquidPlusPackagedLbs.toLocaleString()} Lbs`)] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: '% Rendimiento (Líq. + Env.):', bold: true })] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph(`${totals.liquidPlusPackagedYieldPct}%`)] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Merma Cáscara:', bold: true })] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph(`${totals.shellWaste.toLocaleString()} Lbs`)] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Merma en Tuberías / Envasado:', bold: true })] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph(`${parseFloat(batch.packaging_loss_lbs || 0).toLocaleString()} Lbs`)] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ borders: thinBorder, children: [new Paragraph({ children: [new TextRun({ text: 'Eficiencia de Envasado:', bold: true })] })] }),
                                new TableCell({ borders: thinBorder, children: [new Paragraph(`${totals.packagingEfficiencyPct}%`)] })
                            ]
                        })
                    ]
                })
            ]
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
