const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const reportPdfHelper = require('../utils/reportPdfHelper');

/**
 * 1. REPORTE DE MATERIA PRIMA
 * Mensual, por proveedor, por tipo de producto
 */
async function getRawMaterialsReportData(companyId, filters = {}) {
    const { startDate, endDate, providerId, eggType } = filters;
    let query = `
        SELECT rm.*, 
               COALESCE(p.nombre, p.nombre_comercial, 'Proveedor General') as provider_name,
               COALESCE(p.nit, 'N/A') as provider_nit,
               COALESCE(rm.fecha, rm.created_at) as reception_date,
               rm.weight_lbs as total_weight_lbs
        FROM egg_raw_materials rm
        LEFT JOIN providers p ON rm.provider_id = p.id
        WHERE rm.company_id = ?
    `;
    const params = [companyId];

    if (startDate) {
        query += ' AND DATE(COALESCE(rm.fecha, rm.created_at)) >= ?';
        params.push(startDate);
    }
    if (endDate) {
        query += ' AND DATE(COALESCE(rm.fecha, rm.created_at)) <= ?';
        params.push(endDate);
    }
    if (providerId) {
        query += ' AND rm.provider_id = ?';
        params.push(providerId);
    }
    if (eggType) {
        query += ' AND rm.egg_type = ?';
        params.push(eggType);
    }

    query += ' ORDER BY COALESCE(rm.fecha, rm.created_at) DESC, rm.id DESC';

    const [rows] = await pool.query(query, params);

    const totalBoxes = rows.reduce((s, r) => s + parseInt(r.total_boxes || 0, 10), 0);
    const totalWeightLbs = rows.reduce((s, r) => s + parseFloat(r.total_weight_lbs || 0), 0);
    const totalCurrentStockLbs = rows.reduce((s, r) => s + parseFloat(r.stock_lbs || 0), 0);

    return {
        rows,
        summary: {
            totalReceptions: rows.length,
            totalBoxes,
            totalWeightLbs,
            totalCurrentStockLbs
        }
    };
}

async function generateRawMaterialsReportPdf(companyId, filters = {}) {
    const data = await getRawMaterialsReportData(companyId, filters);
    const company = await reportPdfHelper.getCompanyInfo(companyId);

    const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margin: 30,
        bufferPages: true
    });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));

    const periodText = filters.startDate && filters.endDate 
        ? `Período: ${filters.startDate} al ${filters.endDate}` 
        : `Historial General de Ingresos de Materia Prima`;

    let currentY = reportPdfHelper.renderHeader(
        doc, company, 'REPORTE DE INGRESO DE MATERIA PRIMA (HUEVO EN CÁSCARA Y LÍQUIDO)', 
        periodText, 'landscape', 'Control Mensual por Proveedor y Tipo de Producto'
    );

    // Tabla
    const colX = { fecha: 30, lote: 85, prov: 170, tipo: 310, cajas: 410, peso: 470, stock: 540, calidad: 610, estatus: 690 };
    const colW = { fecha: 50, lote: 80, prov: 135, tipo: 95, cajas: 55, peso: 65, stock: 65, calidad: 75, estatus: 70 };

    doc.rect(30, currentY, 732, 14).fill('#f1f5f9');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5);
    doc.text('FECHA', colX.fecha, currentY + 3.5);
    doc.text('LOTE PROV.', colX.lote, currentY + 3.5);
    doc.text('PROVEEDOR', colX.prov, currentY + 3.5);
    doc.text('TIPO / CALIBRE', colX.tipo, currentY + 3.5);
    doc.text('CAJAS', colX.cajas, currentY + 3.5, { align: 'right' });
    doc.text('PESO REC. (LBS)', colX.peso, currentY + 3.5, { align: 'right' });
    doc.text('STOCK (LBS)', colX.stock, currentY + 3.5, { align: 'right' });
    doc.text('CALIDAD', colX.calidad, currentY + 3.5);
    doc.text('ESTATUS', colX.estatus, currentY + 3.5);
    currentY += 16;

    doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');

    for (const r of data.rows) {
        if (currentY > 520) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(
                doc, company, 'REPORTE DE INGRESO DE MATERIA PRIMA (HUEVO EN CÁSCARA Y LÍQUIDO)', 
                periodText, 'landscape', 'Control Mensual por Proveedor y Tipo de Producto'
            );
            doc.rect(30, currentY, 732, 14).fill('#f1f5f9');
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5);
            doc.text('FECHA', colX.fecha, currentY + 3.5);
            doc.text('LOTE PROV.', colX.lote, currentY + 3.5);
            doc.text('PROVEEDOR', colX.prov, currentY + 3.5);
            doc.text('TIPO / CALIBRE', colX.tipo, currentY + 3.5);
            doc.text('CAJAS', colX.cajas, currentY + 3.5, { align: 'right' });
            doc.text('PESO REC. (LBS)', colX.peso, currentY + 3.5, { align: 'right' });
            doc.text('STOCK (LBS)', colX.stock, currentY + 3.5, { align: 'right' });
            doc.text('CALIDAD', colX.calidad, currentY + 3.5);
            doc.text('ESTATUS', colX.estatus, currentY + 3.5);
            currentY += 16;
            doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');
        }

        const fDate = r.reception_date ? new Date(r.reception_date).toLocaleDateString() : 'N/A';
        doc.text(fDate, colX.fecha, currentY, { width: colW.fecha });
        doc.text(r.provider_lot || 'N/A', colX.lote, currentY, { width: colW.lote });
        doc.text(r.provider_name || 'General', colX.prov, currentY, { width: colW.prov });
        doc.text(`${r.egg_type} (${r.egg_size || 'L'})`, colX.tipo, currentY, { width: colW.tipo });
        doc.text(String(r.total_boxes || 0), colX.cajas, currentY, { width: colW.cajas, align: 'right' });
        doc.text(parseFloat(r.total_weight_lbs || 0).toLocaleString(), colX.peso, currentY, { width: colW.peso, align: 'right' });
        doc.text(parseFloat(r.stock_lbs || 0).toLocaleString(), colX.stock, currentY, { width: colW.stock, align: 'right' });
        doc.text(r.egg_classification || 'Grado A', colX.calidad, currentY, { width: colW.calidad });
        doc.text((r.quality_status || r.status || 'aprobado').toUpperCase(), colX.estatus, currentY, { width: colW.estatus });

        currentY += 11;
    }

    doc.rect(30, currentY, 732, 1).fill('#cbd5e1');
    currentY += 3;

    doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
    doc.text('TOTALES CONSOLIDADOS:', colX.tipo, currentY, { width: colW.tipo, align: 'right' });
    doc.text(data.summary.totalBoxes.toLocaleString(), colX.cajas, currentY, { width: colW.cajas, align: 'right' });
    doc.text(`${data.summary.totalWeightLbs.toLocaleString()} Lbs`, colX.peso, currentY, { width: colW.peso, align: 'right' });
    doc.text(`${data.summary.totalCurrentStockLbs.toLocaleString()} Lbs`, colX.stock, currentY, { width: colW.stock, align: 'right' });
    currentY += 16;

    reportPdfHelper.renderClosingFooter(doc, 30, currentY, data.rows.length, 'Recepciones de Materia Prima');
    reportPdfHelper.renderPageNumbers(doc);
    doc.end();

    return new Promise((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
}

/**
 * 2. REPORTE DE PRODUCCIÓN
 * Resumen de producciones: lb totales producidas, huevo quebrado, rango de fechas, por día, por producto.
 */
async function getProductionReportData(companyId, filters = {}) {
    const { startDate, endDate, productType, status, from, to } = filters;
    const startFilter = startDate || from;
    const endFilter = endDate || to;
    let query = `
        SELECT b.*
        FROM egg_production_batches b
        WHERE b.company_id = ?
    `;
    const params = [companyId];

    if (startFilter) {
        query += ' AND DATE(b.started_at) >= ?';
        params.push(startFilter);
    }
    if (endFilter) {
        query += ' AND DATE(b.started_at) <= ?';
        params.push(endFilter);
    }
    if (productType) {
        query += ' AND b.product_type = ?';
        params.push(productType);
    }
    if (status) {
        query += ' AND b.status = ?';
        params.push(status);
    }

    query += ' ORDER BY b.started_at DESC, b.id DESC';

    const [rows] = await pool.query(query, params);

    // Sumar empaquetado real, materias primas (cajas e insumos adicionales)
    for (const b of rows) {
        const [pkgSum] = await pool.query(
            'SELECT COALESCE(SUM(total_batch_weight_lbs), 0) as packaged_weight FROM egg_packaging_records WHERE batch_id = ? AND company_id = ?',
            [b.id, companyId]
        );
        b.packaged_weight_lbs = parseFloat(pkgSum[0]?.packaged_weight || 0);

        // Materias primas y tarimas de este lote
        const [rmRows] = await pool.query(
            'SELECT quantity_lbs, boxes_count, tarimas_json FROM batch_raw_materials WHERE batch_id = ?',
            [b.id]
        );

        let totalBoxes = 0;
        let rawEggInputLbs = 0;
        for (const rm of rmRows) {
            rawEggInputLbs += parseFloat(rm.quantity_lbs || 0);
            let boxes = parseInt(rm.boxes_count || 0, 10);
            if (!boxes && rm.tarimas_json) {
                try {
                    const tars = typeof rm.tarimas_json === 'string' ? JSON.parse(rm.tarimas_json) : rm.tarimas_json;
                    boxes = (tars || []).reduce((s, t) => s + (parseInt(t.boxes_count || 0, 10)), 0);
                } catch (e) { }
            }
            totalBoxes += boxes;
        }

        let ing = {};
        try {
            ing = typeof b.ingredients_json === 'string' ? JSON.parse(b.ingredients_json) : (b.ingredients_json || {});
        } catch (e) { ing = {}; }

        if (totalBoxes === 0) {
            totalBoxes = parseInt(ing.boxes_count || ing.raw_egg_boxes || 0, 10);
        }
        if (rawEggInputLbs === 0) {
            rawEggInputLbs = parseFloat(b.input_weight_lbs || 0);
        }

        // Insumos adicionales (azúcar, sal, ácido cítrico, leche en polvo, agua, ppg, etc.)
        const sugarLbs = parseFloat(ing.sugar_lbs || 0);
        const saltLbs = parseFloat(ing.salt_lbs || 0);
        const citricAcidLbs = parseFloat(ing.citric_acid_lbs || 0);
        const milkPowderLbs = parseFloat(ing.milk_powder_lbs || 0);
        const waterLbs = parseFloat(ing.water_lbs || ing.water_h2o_lbs || 0) + (parseFloat(ing.water_bottles || 0) * 41.8);
        const ppgLbs = parseFloat(ing.ppg_lbs || 0) + (parseFloat(ing.ppg_g || 0) / 453.592);
        const otherLbs = parseFloat(ing.other_ingredients_lbs || ing.other_lbs || 0);

        const additionalIngredientsLbs = Math.round((sugarLbs + saltLbs + citricAcidLbs + milkPowderLbs + waterLbs + ppgLbs + otherLbs) * 100) / 100;
        const totalYieldLbs = parseFloat(b.yield_liquid_lbs || 0);

        // Rendimiento neto de huevo puro descontando aditivos
        const netEggYieldLbs = Math.max(0, Math.round((totalYieldLbs - additionalIngredientsLbs) * 100) / 100);

        // Rendimiento en Libras por Caja de Huevo (eficacia por caja)
        const yieldPerBoxLbs = totalBoxes > 0 ? Math.round((netEggYieldLbs / totalBoxes) * 100) / 100 : 0;

        // Eficacia / Rendimiento de Huevo Puro % (net_egg_yield_lbs / raw_egg_input_lbs)
        const pureEggYieldPct = rawEggInputLbs > 0 ? Math.round(((netEggYieldLbs / rawEggInputLbs) * 100) * 10) / 10 : 0;

        // Propiedades asignadas para Frontend, PDF y Excel
        const liquidPlusPackagedLbs = Math.round((totalYieldLbs + b.packaged_weight_lbs) * 100) / 100;
        const liquidPlusPackagedYieldPct = rawEggInputLbs > 0 ? Math.round(((liquidPlusPackagedLbs / rawEggInputLbs) * 100) * 10) / 10 : 0;

        b.total_boxes = totalBoxes;
        b.raw_egg_input_lbs = rawEggInputLbs;
        b.egg_broken_lbs = rawEggInputLbs;
        b.actual_output_lbs = totalYieldLbs;
        b.additional_ingredients_lbs = additionalIngredientsLbs;
        b.net_egg_yield_lbs = netEggYieldLbs;
        b.yield_per_box_lbs = yieldPerBoxLbs;
        b.pure_egg_yield_pct = pureEggYieldPct;
        b.liquid_plus_packaged_lbs = liquidPlusPackagedLbs;
        b.liquid_plus_packaged_yield_pct = liquidPlusPackagedYieldPct;
        b.yield_pct = rawEggInputLbs > 0 ? Math.round(((totalYieldLbs / rawEggInputLbs) * 100) * 10) / 10 : 0;
    }

    const totalInputLbs = rows.reduce((s, r) => s + parseFloat(r.input_weight_lbs || 0), 0);
    const totalLiquidLbs = rows.reduce((s, r) => s + parseFloat(r.yield_liquid_lbs || 0), 0);
    const totalShellLbs = rows.reduce((s, r) => s + parseFloat(r.waste_shell_lbs || 0), 0);
    const totalPackagedLbs = rows.reduce((s, r) => s + parseFloat(r.packaged_weight_lbs || 0), 0);
    const totalBoxesSum = rows.reduce((s, r) => s + (r.total_boxes || 0), 0);
    const totalAdditionalIngLbs = rows.reduce((s, r) => s + (r.additional_ingredients_lbs || 0), 0);
    const totalNetEggLiquidLbs = rows.reduce((s, r) => s + (r.net_egg_yield_lbs || 0), 0);
    const avgYieldPerBox = totalBoxesSum > 0 ? Math.round((totalNetEggLiquidLbs / totalBoxesSum) * 100) / 100 : 0;
    const globalYieldPct = totalInputLbs > 0 ? ((totalLiquidLbs / totalInputLbs) * 100).toFixed(2) : '0.00';
    const globalPureEggYieldPct = totalInputLbs > 0 ? ((totalNetEggLiquidLbs / totalInputLbs) * 100).toFixed(2) : '0.00';
    const totalLiquidPlusPackagedLbs = Math.round((totalLiquidLbs + totalPackagedLbs) * 100) / 100;
    const globalLiquidPlusPackagedYieldPct = totalInputLbs > 0 ? ((totalLiquidPlusPackagedLbs / totalInputLbs) * 100).toFixed(2) : '0.00';

    return {
        rows,
        summary: {
            totalBatches: rows.length,
            totalInputLbs,
            totalLiquidLbs,
            totalShellLbs,
            totalPackagedLbs,
            totalBoxes: totalBoxesSum,
            totalAdditionalIngredientsLbs: totalAdditionalIngLbs,
            totalNetEggLiquidLbs: totalNetEggLiquidLbs,
            avgYieldPerBoxLbs: avgYieldPerBox,
            globalYieldPct,
            globalPureEggYieldPct,
            totalLiquidPlusPackagedLbs,
            globalLiquidPlusPackagedYieldPct
        }
    };
}

async function generateProductionReportPdf(companyId, filters = {}) {
    const data = await getProductionReportData(companyId, filters);
    const company = await reportPdfHelper.getCompanyInfo(companyId);

    const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margin: 30,
        bufferPages: true
    });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));

    const periodText = (filters.startDate || filters.from) && (filters.endDate || filters.to)
        ? `Período: ${filters.startDate || filters.from} al ${filters.endDate || filters.to}` 
        : `Historial Consolidado de Producciones Industriales`;

    let currentY = reportPdfHelper.renderHeader(
        doc, company, 'REPORTE CONSOLIDADO DE PRODUCCIÓN, RENDIMIENTO Y EFICACIA POR CAJA', 
        periodText, 'landscape', 'Rendimiento Neto de Huevo por Caja (Descontando Insumos Adicionales) y Balance de Masas'
    );

    const colX = { 
        lote: 30, 
        prod: 100, 
        fecha: 170, 
        input: 218, 
        cajas: 274, 
        insumos: 312, 
        neto: 360, 
        yieldBox: 412, 
        eficPura: 462, 
        pkg: 504, 
        liqEnv: 554, 
        rendTot: 610, 
        estatus: 660 
    };
    const colW = { 
        lote: 68, 
        prod: 68, 
        fecha: 46, 
        input: 54, 
        cajas: 36, 
        insumos: 46, 
        neto: 50, 
        yieldBox: 48, 
        eficPura: 40, 
        pkg: 48, 
        liqEnv: 54, 
        rendTot: 48, 
        estatus: 50 
    };

    doc.rect(30, currentY, 732, 14).fill('#f1f5f9');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6);
    doc.text('LOTE JULIANO', colX.lote, currentY + 3.5);
    doc.text('PRODUCTO', colX.prod, currentY + 3.5);
    doc.text('INICIO', colX.fecha, currentY + 3.5);
    doc.text('QUEBRAJE (LBS)', colX.input, currentY + 3.5, { align: 'right' });
    doc.text('CAJAS', colX.cajas, currentY + 3.5, { align: 'right' });
    doc.text('INSUMOS', colX.insumos, currentY + 3.5, { align: 'right' });
    doc.text('LÍQ. NETO', colX.neto, currentY + 3.5, { align: 'right' });
    doc.text('LBS/CAJA', colX.yieldBox, currentY + 3.5, { align: 'right' });
    doc.text('% EFIC.', colX.eficPura, currentY + 3.5, { align: 'right' });
    doc.text('ENVASADO', colX.pkg, currentY + 3.5, { align: 'right' });
    doc.text('LÍQ+ENV', colX.liqEnv, currentY + 3.5, { align: 'right' });
    doc.text('% REND.', colX.rendTot, currentY + 3.5, { align: 'right' });
    doc.text('ESTATUS', colX.estatus, currentY + 3.5);
    currentY += 16;

    doc.font('Helvetica').fontSize(6).fillColor('#1e293b');

    for (const r of data.rows) {
        if (currentY > 520) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(
                doc, company, 'REPORTE CONSOLIDADO DE PRODUCCIÓN, RENDIMIENTO Y EFICACIA POR CAJA', 
                periodText, 'landscape', 'Rendimiento Neto de Huevo por Caja (Descontando Insumos Adicionales) y Balance de Masas'
            );
            doc.rect(30, currentY, 732, 14).fill('#f1f5f9');
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6);
            doc.text('LOTE JULIANO', colX.lote, currentY + 3.5);
            doc.text('PRODUCTO', colX.prod, currentY + 3.5);
            doc.text('INICIO', colX.fecha, currentY + 3.5);
            doc.text('QUEBRAJE (LBS)', colX.input, currentY + 3.5, { align: 'right' });
            doc.text('CAJAS', colX.cajas, currentY + 3.5, { align: 'right' });
            doc.text('INSUMOS', colX.insumos, currentY + 3.5, { align: 'right' });
            doc.text('LÍQ. NETO', colX.neto, currentY + 3.5, { align: 'right' });
            doc.text('LBS/CAJA', colX.yieldBox, currentY + 3.5, { align: 'right' });
            doc.text('% EFIC.', colX.eficPura, currentY + 3.5, { align: 'right' });
            doc.text('ENVASADO', colX.pkg, currentY + 3.5, { align: 'right' });
            doc.text('LÍQ+ENV', colX.liqEnv, currentY + 3.5, { align: 'right' });
            doc.text('% REND.', colX.rendTot, currentY + 3.5, { align: 'right' });
            doc.text('ESTATUS', colX.estatus, currentY + 3.5);
            currentY += 16;
            doc.font('Helvetica').fontSize(6).fillColor('#1e293b');
        }

        const inputLbs = parseFloat(r.input_weight_lbs || 0);

        doc.text(r.batch_code_display || r.batch_uuid, colX.lote, currentY, { width: colW.lote });
        doc.text(r.product_type, colX.prod, currentY, { width: colW.prod });
        doc.text(new Date(r.started_at).toLocaleDateString(), colX.fecha, currentY, { width: colW.fecha });
        doc.text(inputLbs.toLocaleString(), colX.input, currentY, { width: colW.input, align: 'right' });
        doc.text(String(r.total_boxes || 0), colX.cajas, currentY, { width: colW.cajas, align: 'right' });
        doc.text(parseFloat(r.additional_ingredients_lbs || 0).toLocaleString(), colX.insumos, currentY, { width: colW.insumos, align: 'right' });
        doc.text(parseFloat(r.net_egg_yield_lbs || 0).toLocaleString(), colX.neto, currentY, { width: colW.neto, align: 'right' });
        doc.text(`${parseFloat(r.yield_per_box_lbs || 0).toFixed(1)} Lbs`, colX.yieldBox, currentY, { width: colW.yieldBox, align: 'right' });
        doc.text(`${parseFloat(r.pure_egg_yield_pct || 0).toFixed(1)}%`, colX.eficPura, currentY, { width: colW.eficPura, align: 'right' });
        doc.text(parseFloat(r.packaged_weight_lbs || 0).toLocaleString(), colX.pkg, currentY, { width: colW.pkg, align: 'right' });
        doc.text((parseFloat(r.liquid_plus_packaged_lbs || 0)).toLocaleString(), colX.liqEnv, currentY, { width: colW.liqEnv, align: 'right' });
        doc.text(`${parseFloat(r.liquid_plus_packaged_yield_pct || 0).toFixed(1)}%`, colX.rendTot, currentY, { width: colW.rendTot, align: 'right' });
        doc.text((r.status || '').toUpperCase(), colX.estatus, currentY, { width: colW.estatus });

        currentY += 11;
    }

    doc.rect(30, currentY, 732, 1).fill('#cbd5e1');
    currentY += 3;

    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#0f172a');
    doc.text('TOTALES:', colX.fecha, currentY, { width: colW.fecha, align: 'right' });
    doc.text(`${data.summary.totalInputLbs.toLocaleString()} Lbs`, colX.input, currentY, { width: colW.input, align: 'right' });
    doc.text(`${data.summary.totalBoxes.toLocaleString()} Cjs`, colX.cajas, currentY, { width: colW.cajas, align: 'right' });
    doc.text(`${data.summary.totalAdditionalIngredientsLbs.toLocaleString()} Lbs`, colX.insumos, currentY, { width: colW.insumos, align: 'right' });
    doc.text(`${data.summary.totalNetEggLiquidLbs.toLocaleString()} Lbs`, colX.neto, currentY, { width: colW.neto, align: 'right' });
    doc.text(`Prom: ${data.summary.avgYieldPerBoxLbs} Lbs/Cja`, colX.yieldBox, currentY, { width: colW.yieldBox, align: 'right' });
    doc.text(`${data.summary.globalPureEggYieldPct}%`, colX.eficPura, currentY, { width: colW.eficPura, align: 'right' });
    doc.text(`${data.summary.totalPackagedLbs.toLocaleString()} Lbs`, colX.pkg, currentY, { width: colW.pkg, align: 'right' });
    doc.text(`${data.summary.totalLiquidPlusPackagedLbs.toLocaleString()} Lbs`, colX.liqEnv, currentY, { width: colW.liqEnv, align: 'right' });
    doc.text(`${data.summary.globalLiquidPlusPackagedYieldPct}%`, colX.rendTot, currentY, { width: colW.rendTot, align: 'right' });
    currentY += 16;

    reportPdfHelper.renderClosingFooter(doc, 30, currentY, data.rows.length, 'Lotes de Producción');
    reportPdfHelper.renderPageNumbers(doc);
    doc.end();

    return new Promise((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
}

/**
 * 3. REPORTE DE EMPAQUE
 * Empaque por producción y presentación comercial
 */
async function getPackagingReportData(companyId, filters = {}) {
    const { startDate, endDate, productType, presentation, batchId } = filters;
    let query = `
        SELECT pk.*, b.batch_code_display, b.batch_uuid
        FROM egg_packaging_records pk
        JOIN egg_production_batches b ON pk.batch_id = b.id
        WHERE pk.company_id = ?
    `;
    const params = [companyId];

    if (startDate) {
        query += ' AND DATE(pk.created_at) >= ?';
        params.push(startDate);
    }
    if (endDate) {
        query += ' AND DATE(pk.created_at) <= ?';
        params.push(endDate);
    }
    if (productType) {
        query += ' AND pk.product_type = ?';
        params.push(productType);
    }
    if (presentation) {
        query += ' AND pk.presentation = ?';
        params.push(presentation);
    }
    if (batchId) {
        query += ' AND pk.batch_id = ?';
        params.push(batchId);
    }

    query += ' ORDER BY pk.created_at DESC, pk.id DESC';

    const [rows] = await pool.query(query, params);

    const totalUnits = rows.reduce((s, r) => s + parseInt(r.units_packaged || 0, 10), 0);
    const totalWeightLbs = rows.reduce((s, r) => s + parseFloat(r.total_batch_weight_lbs || 0), 0);

    return {
        rows,
        summary: {
            totalRecords: rows.length,
            totalUnits,
            totalWeightLbs
        }
    };
}

async function generatePackagingReportPdf(companyId, filters = {}) {
    const data = await getPackagingReportData(companyId, filters);
    const company = await reportPdfHelper.getCompanyInfo(companyId);

    const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margin: 30,
        bufferPages: true
    });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));

    const periodText = filters.startDate && filters.endDate 
        ? `Período: ${filters.startDate} al ${filters.endDate}` 
        : `Historial General de Empaque y Producto Terminado`;

    let currentY = reportPdfHelper.renderHeader(
        doc, company, 'REPORTE DE EMPAQUE Y ENVASADO POR PRODUCCIÓN', 
        periodText, 'landscape', 'Control de Unidades Envasadas, Libras y Zonas de Almacenamiento'
    );

    const colX = { fecha: 30, loteCom: 100, loteProd: 200, prod: 290, pres: 380, units: 470, unitW: 535, totalW: 600, zona: 670 };
    const colW = { fecha: 65, loteCom: 95, loteProd: 85, prod: 85, pres: 85, units: 60, unitW: 60, totalW: 65, zona: 90 };

    doc.rect(30, currentY, 732, 14).fill('#f1f5f9');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5);
    doc.text('FECHA', colX.fecha, currentY + 3.5);
    doc.text('LOTE COMERCIAL', colX.loteCom, currentY + 3.5);
    doc.text('LOTE ORIGEN', colX.loteProd, currentY + 3.5);
    doc.text('PRODUCTO', colX.prod, currentY + 3.5);
    doc.text('PRESENTACIÓN', colX.pres, currentY + 3.5);
    doc.text('UNIDADES', colX.units, currentY + 3.5, { align: 'right' });
    doc.text('PESO UNIT.', colX.unitW, currentY + 3.5, { align: 'right' });
    doc.text('TOTAL LBS', colX.totalW, currentY + 3.5, { align: 'right' });
    doc.text('ZONA BODEGA', colX.zona, currentY + 3.5);
    currentY += 16;

    doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');

    for (const r of data.rows) {
        if (currentY > 520) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(
                doc, company, 'REPORTE DE EMPAQUE Y ENVASADO POR PRODUCCIÓN', 
                periodText, 'landscape', 'Control de Unidades Envasadas, Libras y Zonas de Almacenamiento'
            );
            doc.rect(30, currentY, 732, 14).fill('#f1f5f9');
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5);
            doc.text('FECHA', colX.fecha, currentY + 3.5);
            doc.text('LOTE COMERCIAL', colX.loteCom, currentY + 3.5);
            doc.text('LOTE ORIGEN', colX.loteProd, currentY + 3.5);
            doc.text('PRODUCTO', colX.prod, currentY + 3.5);
            doc.text('PRESENTACIÓN', colX.pres, currentY + 3.5);
            doc.text('UNIDADES', colX.units, currentY + 3.5, { align: 'right' });
            doc.text('PESO UNIT.', colX.unitW, currentY + 3.5, { align: 'right' });
            doc.text('TOTAL LBS', colX.totalW, currentY + 3.5, { align: 'right' });
            doc.text('ZONA BODEGA', colX.zona, currentY + 3.5);
            currentY += 16;
            doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');
        }

        doc.text(new Date(r.created_at).toLocaleDateString(), colX.fecha, currentY, { width: colW.fecha });
        doc.text(r.lot_code || 'N/A', colX.loteCom, currentY, { width: colW.loteCom });
        doc.text(r.batch_code_display || r.batch_uuid, colX.loteProd, currentY, { width: colW.loteProd });
        doc.text(r.product_type || 'Huevo Entero', colX.prod, currentY, { width: colW.prod });
        doc.text(r.presentation || 'cubeta 30LB', colX.pres, currentY, { width: colW.pres });
        doc.text(String(r.units_packaged || 0), colX.units, currentY, { width: colW.units, align: 'right' });
        doc.text(`${parseFloat(r.weight_per_unit_lbs || 0).toFixed(2)} Lb`, colX.unitW, currentY, { width: colW.unitW, align: 'right' });
        doc.text(parseFloat(r.total_batch_weight_lbs || 0).toLocaleString(), colX.totalW, currentY, { width: colW.totalW, align: 'right' });
        doc.text(`${r.warehouse_zone || 'COOLER'} (${r.product_state || 'líquido'})`, colX.zona, currentY, { width: colW.zona });

        currentY += 11;
    }

    doc.rect(30, currentY, 732, 1).fill('#cbd5e1');
    currentY += 3;

    doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
    doc.text('TOTALES:', colX.pres, currentY, { width: colW.pres, align: 'right' });
    doc.text(data.summary.totalUnits.toLocaleString(), colX.units, currentY, { width: colW.units, align: 'right' });
    doc.text(`${data.summary.totalWeightLbs.toLocaleString()} Lbs`, colX.totalW, currentY, { width: colW.totalW, align: 'right' });
    currentY += 16;

    reportPdfHelper.renderClosingFooter(doc, 30, currentY, data.rows.length, 'Registros de Empaque');
    reportPdfHelper.renderPageNumbers(doc);
    doc.end();

    return new Promise((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
}

/**
 * 4. REPORTE DE CALIDAD CONGLOMERADO (MP y PRODUCCIONES)
 */
async function getQualityReportData(companyId, filters = {}) {
    const { startDate, endDate, qualityStatus } = filters;

    // Evaluaciones en MP
    let rmQuery = `
        SELECT rm.id, COALESCE(rm.fecha, rm.created_at) as date, rm.provider_lot, rm.egg_classification, rm.quality_status,
               rm.quality_defect_broken_pct, rm.quality_defect_dirty_pct, rm.quality_brix,
               rm.quality_inspector_name, rm.quality_notes, 'Materia Prima' as source_type,
               COALESCE(p.nombre, p.nombre_comercial, 'General') as provider_name
        FROM egg_raw_materials rm
        LEFT JOIN providers p ON rm.provider_id = p.id
        WHERE rm.company_id = ?
    `;
    const rmParams = [companyId];
    if (startDate) { rmQuery += ' AND DATE(COALESCE(rm.fecha, rm.created_at)) >= ?'; rmParams.push(startDate); }
    if (endDate) { rmQuery += ' AND DATE(COALESCE(rm.fecha, rm.created_at)) <= ?'; rmParams.push(endDate); }
    if (qualityStatus) { rmQuery += ' AND rm.quality_status = ?'; rmParams.push(qualityStatus); }

    const [rmRows] = await pool.query(rmQuery, rmParams);

    return {
        rows: rmRows,
        summary: {
            totalEvaluated: rmRows.length,
            approved: rmRows.filter(r => r.quality_status === 'aprobado').length,
            rejected: rmRows.filter(r => r.quality_status === 'rechazado' || r.egg_classification === 'No Conforme').length,
            conditional: rmRows.filter(r => r.quality_status === 'condicional').length,
            pending: rmRows.filter(r => r.quality_status === 'pendiente' || !r.quality_status).length
        }
    };
}

async function generateQualityReportPdf(companyId, filters = {}) {
    const data = await getQualityReportData(companyId, filters);
    const company = await reportPdfHelper.getCompanyInfo(companyId);

    const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margin: 30,
        bufferPages: true
    });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));

    const periodText = filters.startDate && filters.endDate 
        ? `Período: ${filters.startDate} al ${filters.endDate}` 
        : `Historial Consolidado de Control de Calidad LAB-004`;

    let currentY = reportPdfHelper.renderHeader(
        doc, company, 'REPORTE DE CALIDAD Y DICTÁMENES TÉCNICOS (LAB-004)', 
        periodText, 'landscape', 'Control Microbiológico, Físico-Químico y Dictamen por Lote'
    );

    const colX = { fecha: 30, lote: 100, prov: 195, grado: 310, dictamen: 395, rotos: 475, sucios: 535, brix: 595, inspector: 655 };
    const colW = { fecha: 65, lote: 90, prov: 110, grado: 80, dictamen: 75, rotos: 55, sucios: 55, brix: 55, inspector: 100 };

    doc.rect(30, currentY, 732, 14).fill('#f1f5f9');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5);
    doc.text('FECHA', colX.fecha, currentY + 3.5);
    doc.text('LOTE PROV.', colX.lote, currentY + 3.5);
    doc.text('PROVEEDOR', colX.prov, currentY + 3.5);
    doc.text('GRADO ASIGNADO', colX.grado, currentY + 3.5);
    doc.text('DICTAMEN', colX.dictamen, currentY + 3.5);
    doc.text('% ROTOS', colX.rotos, currentY + 3.5, { align: 'right' });
    doc.text('% SUCIOS', colX.sucios, currentY + 3.5, { align: 'right' });
    doc.text('°BRIX', colX.brix, currentY + 3.5, { align: 'right' });
    doc.text('INSPECTOR', colX.inspector, currentY + 3.5);
    currentY += 16;

    doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');

    for (const r of data.rows) {
        if (currentY > 520) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(
                doc, company, 'REPORTE DE CALIDAD Y DICTÁMENES TÉCNICOS (LAB-004)', 
                periodText, 'landscape', 'Control Microbiológico, Físico-Químico y Dictamen por Lote'
            );
            doc.rect(30, currentY, 732, 14).fill('#f1f5f9');
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5);
            doc.text('FECHA', colX.fecha, currentY + 3.5);
            doc.text('LOTE PROV.', colX.lote, currentY + 3.5);
            doc.text('PROVEEDOR', colX.prov, currentY + 3.5);
            doc.text('GRADO ASIGNADO', colX.grado, currentY + 3.5);
            doc.text('DICTAMEN', colX.dictamen, currentY + 3.5);
            doc.text('% ROTOS', colX.rotos, currentY + 3.5, { align: 'right' });
            doc.text('% SUCIOS', colX.sucios, currentY + 3.5, { align: 'right' });
            doc.text('°BRIX', colX.brix, currentY + 3.5, { align: 'right' });
            doc.text('INSPECTOR', colX.inspector, currentY + 3.5);
            currentY += 16;
            doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');
        }

        const isRejected = r.quality_status === 'rechazado' || r.egg_classification === 'No Conforme';

        doc.text(r.date ? new Date(r.date).toLocaleDateString() : 'N/A', colX.fecha, currentY, { width: colW.fecha });
        doc.text(r.provider_lot || 'N/A', colX.lote, currentY, { width: colW.lote });
        doc.text(r.provider_name || 'General', colX.prov, currentY, { width: colW.prov });

        if (isRejected) doc.fillColor('#dc2626').font('Helvetica-Bold');
        else doc.fillColor('#1e293b').font('Helvetica');

        doc.text(r.egg_classification || 'Grado A', colX.grado, currentY, { width: colW.grado });
        doc.text((r.quality_status || 'Aprobado').toUpperCase(), colX.dictamen, currentY, { width: colW.dictamen });

        doc.fillColor('#1e293b').font('Helvetica');
        doc.text(`${parseFloat(r.quality_defect_broken_pct || 0).toFixed(1)}%`, colX.rotos, currentY, { width: colW.rotos, align: 'right' });
        doc.text(`${parseFloat(r.quality_defect_dirty_pct || 0).toFixed(1)}%`, colX.sucios, currentY, { width: colW.sucios, align: 'right' });
        doc.text(r.quality_brix ? `${parseFloat(r.quality_brix).toFixed(1)}°` : '-', colX.brix, currentY, { width: colW.brix, align: 'right' });
        doc.text(r.quality_inspector_name || 'N/A', colX.inspector, currentY, { width: colW.inspector });

        currentY += 11;
    }

    doc.rect(30, currentY, 732, 1).fill('#cbd5e1');
    currentY += 4;

    doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
    doc.text(`TOTAL EVALUACIONES: ${data.summary.totalEvaluated} | APROBADOS: ${data.summary.approved} | NO CONFORMES/RECHAZADOS: ${data.summary.rejected} | CONDICIONALES: ${data.summary.conditional}`, 30, currentY);
    currentY += 16;

    reportPdfHelper.renderClosingFooter(doc, 30, currentY, data.rows.length, 'Evaluaciones de Calidad');
    reportPdfHelper.renderPageNumbers(doc);
    doc.end();

    return new Promise((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
}

/**
 * 5. REPORTE DE MERMAS E INVENTARIO POR PRODUCCIÓN Y PERÍODO
 */
async function getWastesReportData(companyId, filters = {}) {
    const { startDate, endDate, stage, batchId } = filters;
    let query = `
        SELECT w.*, b.batch_code_display, b.batch_uuid, b.product_type, b.input_weight_lbs
        FROM egg_batch_waste_logs w
        JOIN egg_production_batches b ON w.batch_id = b.id
        WHERE w.company_id = ?
    `;
    const params = [companyId];

    if (startDate) { query += ' AND DATE(w.created_at) >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND DATE(w.created_at) <= ?'; params.push(endDate); }
    if (stage) { query += ' AND w.stage = ?'; params.push(stage); }
    if (batchId) { query += ' AND w.batch_id = ?'; params.push(batchId); }

    query += ' ORDER BY w.created_at DESC, w.id DESC';

    const [rows] = await pool.query(query, params);
    const totalWasteLbs = rows.reduce((s, r) => s + parseFloat(r.quantity_lbs || 0), 0);

    const byStage = {};
    for (const r of rows) {
        const st = r.stage || 'otro';
        byStage[st] = (byStage[st] || 0) + parseFloat(r.quantity_lbs || 0);
    }

    return {
        rows,
        summary: {
            totalLogs: rows.length,
            totalWasteLbs,
            byStage
        }
    };
}

async function generateWastesReportPdf(companyId, filters = {}) {
    const data = await getWastesReportData(companyId, filters);
    const company = await reportPdfHelper.getCompanyInfo(companyId);

    const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margin: 30,
        bufferPages: true
    });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));

    const periodText = filters.startDate && filters.endDate 
        ? `Período: ${filters.startDate} al ${filters.endDate}` 
        : `Historial General de Mermas Industriales y Tuberías`;

    let currentY = reportPdfHelper.renderHeader(
        doc, company, 'REPORTE DE MERMAS OPERATIVAS DE PRODUCCIÓN Y ENVASADO', 
        periodText, 'landscape', 'Control de Pérdidas por Quebraje, Tuberías, Desperdicios y Envasado'
    );

    const colX = { fecha: 30, lote: 100, prod: 200, etapa: 290, tipo: 380, lbs: 480, motivo: 560, operador: 670 };
    const colW = { fecha: 65, lote: 95, prod: 85, etapa: 85, tipo: 95, lbs: 75, motivo: 105, operador: 90 };

    doc.rect(30, currentY, 732, 14).fill('#f1f5f9');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5);
    doc.text('FECHA', colX.fecha, currentY + 3.5);
    doc.text('LOTE PROD.', colX.lote, currentY + 3.5);
    doc.text('PRODUCTO', colX.prod, currentY + 3.5);
    doc.text('ETAPA', colX.etapa, currentY + 3.5);
    doc.text('TIPO DE MERMA', colX.tipo, currentY + 3.5);
    doc.text('MERMA (LBS)', colX.lbs, currentY + 3.5, { align: 'right' });
    doc.text('MOTIVO / OBSERVACIÓN', colX.motivo, currentY + 3.5);
    doc.text('RESPONSABLE', colX.operador, currentY + 3.5);
    currentY += 16;

    doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');

    for (const r of data.rows) {
        if (currentY > 520) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(
                doc, company, 'REPORTE DE MERMAS OPERATIVAS DE PRODUCCIÓN Y ENVASADO', 
                periodText, 'landscape', 'Control de Pérdidas por Quebraje, Tuberías, Desperdicios y Envasado'
            );
            doc.rect(30, currentY, 732, 14).fill('#f1f5f9');
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5);
            doc.text('FECHA', colX.fecha, currentY + 3.5);
            doc.text('LOTE PROD.', colX.lote, currentY + 3.5);
            doc.text('PRODUCTO', colX.prod, currentY + 3.5);
            doc.text('ETAPA', colX.etapa, currentY + 3.5);
            doc.text('TIPO DE MERMA', colX.tipo, currentY + 3.5);
            doc.text('MERMA (LBS)', colX.lbs, currentY + 3.5, { align: 'right' });
            doc.text('MOTIVO / OBSERVACIÓN', colX.motivo, currentY + 3.5);
            doc.text('RESPONSABLE', colX.operador, currentY + 3.5);
            currentY += 16;
            doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');
        }

        doc.text(new Date(r.created_at).toLocaleDateString(), colX.fecha, currentY, { width: colW.fecha });
        doc.text(r.batch_code_display || r.batch_uuid, colX.lote, currentY, { width: colW.lote });
        doc.text(r.product_type || 'Huevo Entero', colX.prod, currentY, { width: colW.prod });
        doc.text((r.stage || '').toUpperCase(), colX.etapa, currentY, { width: colW.etapa });
        doc.text(r.waste_type || 'Merma', colX.tipo, currentY, { width: colW.tipo });
        doc.text(parseFloat(r.quantity_lbs || 0).toLocaleString(), colX.lbs, currentY, { width: colW.lbs, align: 'right' });
        doc.text(r.reason || '-', colX.motivo, currentY, { width: colW.motivo });
        doc.text(r.operator_name || 'N/A', colX.operador, currentY, { width: colW.operador });

        currentY += 11;
    }

    doc.rect(30, currentY, 732, 1).fill('#cbd5e1');
    currentY += 3;

    doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
    doc.text('TOTAL MERMAS REGISTRADAS:', colX.tipo, currentY, { width: colW.tipo, align: 'right' });
    doc.text(`${data.summary.totalWasteLbs.toLocaleString()} Lbs`, colX.lbs, currentY, { width: colW.lbs, align: 'right' });
    currentY += 16;

    reportPdfHelper.renderClosingFooter(doc, 30, currentY, data.rows.length, 'Registros de Mermas');
    reportPdfHelper.renderPageNumbers(doc);
    doc.end();

    return new Promise((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
}

/**
 * EXCEL GENERATORS
 */
async function generateRawMaterialsReportExcel(companyId, filters = {}) {
    const data = await getRawMaterialsReportData(companyId, filters);
    const excelService = require('./excel.service');
    const columns = [
        { header: 'Fecha', key: 'fecha', width: 14 },
        { header: 'Lote Proveedor', key: 'lote', width: 22 },
        { header: 'Proveedor', key: 'proveedor', width: 28 },
        { header: 'Tipo Huevo', key: 'tipo', width: 18 },
        { header: 'Calibre', key: 'calibre', width: 12 },
        { header: 'Cajas', key: 'cajas', width: 12 },
        { header: 'Peso Recibido (Lbs)', key: 'peso', width: 20 },
        { header: 'Stock Actual (Lbs)', key: 'stock', width: 18 },
        { header: 'Calidad / Grado', key: 'calidad', width: 16 },
        { header: 'Dictamen', key: 'estatus', width: 16 }
    ];
    const rows = data.rows.map(r => ({
        fecha: r.reception_date ? new Date(r.reception_date).toLocaleDateString() : 'N/A',
        lote: r.provider_lot || 'N/A',
        proveedor: r.provider_name || 'General',
        tipo: r.egg_type,
        calibre: r.egg_size || 'L',
        cajas: parseInt(r.total_boxes || 0, 10),
        peso: parseFloat(r.total_weight_lbs || 0),
        stock: parseFloat(r.stock_lbs || 0),
        calidad: r.egg_classification || 'Grado A',
        estatus: (r.quality_status || r.status || 'aprobado').toUpperCase()
    }));
    return await excelService.createExcelBuffer({
        title: 'REPORTE DE INGRESO DE MATERIA PRIMA',
        sheets: [{ name: 'Materia Prima', columns, data: rows }]
    });
}

async function generateProductionReportExcel(companyId, filters = {}) {
    const data = await getProductionReportData(companyId, filters);
    const excelService = require('./excel.service');
    const columns = [
        { header: 'Lote Juliano', key: 'lote', width: 20 },
        { header: 'Producto', key: 'producto', width: 22 },
        { header: 'Presentación', key: 'presentacion', width: 18 },
        { header: 'Inicio', key: 'inicio', width: 16 },
        { header: 'Fin', key: 'fin', width: 16 },
        { header: 'Quebraje MP (Lbs)', key: 'quebraje', width: 18 },
        { header: 'Cajas de Huevo (MP)', key: 'cajas', width: 18 },
        { header: 'Insumos Adicionales (Lbs)', key: 'insumos', width: 22 },
        { header: 'Líquido Pasteurizado Total (Lbs)', key: 'rendimiento_total', width: 24 },
        { header: 'Huevo Líquido Neto (Lbs)', key: 'huevo_neto', width: 22 },
        { header: 'Rendimiento por Caja (Lbs/Cja)', key: 'rend_caja', width: 24 },
        { header: '% Eficacia Huevo Puro', key: 'eficacia_pura', width: 20 },
        { header: 'Merma Cáscara (Lbs)', key: 'cascara', width: 18 },
        { header: 'Envasado Real (Lbs)', key: 'envasado', width: 18 },
        { header: 'Líquido + Envasado (Lbs)', key: 'liq_env', width: 22 },
        { header: '% Rendimiento (Líq. + Env.)', key: 'rend_liq_env_pct', width: 26 },
        { header: '% Rendimiento Líquido Base', key: 'rendimiento_pct', width: 22 },
        { header: 'Estado', key: 'estado', width: 16 }
    ];
    const rows = data.rows.map(r => {
        const inp = parseFloat(r.input_weight_lbs || 0);
        const yld = parseFloat(r.yield_liquid_lbs || 0);
        const pkg = parseFloat(r.packaged_weight_lbs || 0);
        const liqEnv = parseFloat(r.liquid_plus_packaged_lbs || (yld + pkg));
        const rendLiqEnv = parseFloat(r.liquid_plus_packaged_yield_pct || (inp > 0 ? ((liqEnv / inp) * 100) : 0));
        return {
            lote: r.batch_code_display || r.batch_uuid,
            producto: r.product_type,
            presentacion: r.presentation || 'N/A',
            inicio: new Date(r.started_at).toLocaleDateString(),
            fin: r.completed_at ? new Date(r.completed_at).toLocaleDateString() : 'En proceso',
            quebraje: inp,
            cajas: r.total_boxes || 0,
            insumos: r.additional_ingredients_lbs || 0,
            rendimiento_total: yld,
            huevo_neto: r.net_egg_yield_lbs || 0,
            rend_caja: r.yield_per_box_lbs || 0,
            eficacia_pura: `${(r.pure_egg_yield_pct || 0).toFixed(1)}%`,
            cascara: parseFloat(r.waste_shell_lbs || 0),
            envasado: pkg,
            liq_env: liqEnv,
            rend_liq_env_pct: `${rendLiqEnv.toFixed(1)}%`,
            rendimiento_pct: inp > 0 ? `${((yld / inp) * 100).toFixed(1)}%` : '0%',
            estado: (r.status || '').toUpperCase()
        };
    });
    return await excelService.createExcelBuffer({
        title: 'REPORTE DE PRODUCCIÓN, RENDIMIENTO Y EFICACIA POR CAJA',
        sheets: [{ name: 'Producción', columns, data: rows }]
    });
}

async function generatePackagingReportExcel(companyId, filters = {}) {
    const data = await getPackagingReportData(companyId, filters);
    const excelService = require('./excel.service');
    const columns = [
        { header: 'Fecha', key: 'fecha', width: 14 },
        { header: 'Lote Comercial', key: 'lote_com', width: 22 },
        { header: 'Lote Producción', key: 'lote_prod', width: 20 },
        { header: 'Producto', key: 'producto', width: 22 },
        { header: 'Presentación', key: 'presentacion', width: 20 },
        { header: 'Unidades', key: 'unidades', width: 14 },
        { header: 'Peso Unit (Lbs)', key: 'peso_unit', width: 16 },
        { header: 'Total Lbs', key: 'total_lbs', width: 16 },
        { header: 'Zona Frío', key: 'zona', width: 16 },
        { header: 'Estado', key: 'estado', width: 14 }
    ];
    const rows = data.rows.map(r => ({
        fecha: new Date(r.created_at).toLocaleDateString(),
        lote_com: r.lot_code || 'N/A',
        lote_prod: r.batch_code_display || r.batch_uuid,
        producto: r.product_type || 'Huevo Entero',
        presentacion: r.presentation || 'cubeta 30LB',
        unidades: parseInt(r.units_packaged || 0, 10),
        peso_unit: parseFloat(r.weight_per_unit_lbs || 0),
        total_lbs: parseFloat(r.total_batch_weight_lbs || 0),
        zona: r.warehouse_zone || 'COOLER',
        estado: r.product_state || 'líquido'
    }));
    return await excelService.createExcelBuffer({
        title: 'REPORTE DE EMPAQUE Y ENVASADO POR PRODUCCIÓN',
        sheets: [{ name: 'Empaque', columns, data: rows }]
    });
}

async function generateQualityReportExcel(companyId, filters = {}) {
    const data = await getQualityReportData(companyId, filters);
    const excelService = require('./excel.service');
    const columns = [
        { header: 'Fecha', key: 'fecha', width: 14 },
        { header: 'Lote Materia Prima', key: 'lote', width: 22 },
        { header: 'Proveedor', key: 'proveedor', width: 26 },
        { header: 'Grado Asignado', key: 'grado', width: 18 },
        { header: 'Dictamen', key: 'dictamen', width: 18 },
        { header: '% Rotos', key: 'rotos', width: 14 },
        { header: '% Sucios', key: 'sucios', width: 14 },
        { header: '°Brix', key: 'brix', width: 12 },
        { header: 'Inspector', key: 'inspector', width: 24 },
        { header: 'Observaciones', key: 'notas', width: 35 }
    ];
    const rows = data.rows.map(r => ({
        fecha: r.date ? new Date(r.date).toLocaleDateString() : 'N/A',
        lote: r.provider_lot || 'N/A',
        proveedor: r.provider_name || 'General',
        grado: r.egg_classification || 'Grado A',
        dictamen: (r.quality_status || 'Aprobado').toUpperCase(),
        rotos: `${parseFloat(r.quality_defect_broken_pct || 0).toFixed(1)}%`,
        sucios: `${parseFloat(r.quality_defect_dirty_pct || 0).toFixed(1)}%`,
        brix: r.quality_brix ? `${parseFloat(r.quality_brix).toFixed(1)}°` : '-',
        inspector: r.quality_inspector_name || 'N/A',
        notas: r.quality_notes || ''
    }));
    return await excelService.createExcelBuffer({
        title: 'REPORTE CONSOLIDADO DE CALIDAD (LAB-004)',
        sheets: [{ name: 'Calidad', columns, data: rows }]
    });
}

async function generateWastesReportExcel(companyId, filters = {}) {
    const data = await getWastesReportData(companyId, filters);
    const excelService = require('./excel.service');
    const columns = [
        { header: 'Fecha', key: 'fecha', width: 14 },
        { header: 'Lote Producción', key: 'lote', width: 20 },
        { header: 'Producto', key: 'producto', width: 22 },
        { header: 'Etapa', key: 'etapa', width: 18 },
        { header: 'Tipo Merma', key: 'tipo', width: 20 },
        { header: 'Libras', key: 'libras', width: 14 },
        { header: 'Motivo / Causa', key: 'motivo', width: 35 },
        { header: 'Responsable', key: 'operador', width: 22 }
    ];
    const rows = data.rows.map(r => ({
        fecha: new Date(r.created_at).toLocaleDateString(),
        lote: r.batch_code_display || r.batch_uuid,
        producto: r.product_type || 'Huevo Entero',
        etapa: (r.stage || '').toUpperCase(),
        tipo: r.waste_type || 'Merma',
        libras: parseFloat(r.quantity_lbs || 0),
        motivo: r.reason || '-',
        operador: r.operator_name || 'N/A'
    }));
    return await excelService.createExcelBuffer({
        title: 'REPORTE DE MERMAS OPERATIVAS DE PRODUCCIÓN Y ENVASADO',
        sheets: [{ name: 'Mermas', columns, data: rows }]
    });
}

module.exports = {
    getRawMaterialsReportData,
    generateRawMaterialsReportPdf,
    generateRawMaterialsReportExcel,
    getProductionReportData,
    generateProductionReportPdf,
    generateProductionReportExcel,
    getPackagingReportData,
    generatePackagingReportPdf,
    generatePackagingReportExcel,
    getQualityReportData,
    generateQualityReportPdf,
    generateQualityReportExcel,
    getWastesReportData,
    generateWastesReportPdf,
    generateWastesReportExcel
};
