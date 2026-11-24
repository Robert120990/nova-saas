const pool = require('../config/db');
const reportPdfHelper = require('../utils/reportPdfHelper');
const excelService = require('./excel.service');

const CATEGORY_LABELS = {
    empaque: 'Material de Empaque',
    aditivo: 'Ingredientes y Aditivos',
    quimico_cip: 'Químicos CIP y Sanitización',
    suministro: 'Suministros de Planta'
};

const MOVEMENT_LABELS = {
    entrada_compra: 'Entrada / Compra',
    entrada_inicial: 'Inventario Inicial',
    salida_produccion: 'Salida a Producción / Envasado',
    salida_cip: 'Salida Lavado CIP',
    ajuste_positivo: 'Ajuste Positivo (+)',
    ajuste_negativo: 'Ajuste Negativo (-)'
};

function formatYMD(dateInput) {
    if (!dateInput) return null;
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
        return dateInput.trim();
    }
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function computeStockStatus(currentStock, minStock) {
    const curr = parseFloat(currentStock) || 0;
    const min = parseFloat(minStock) || 0;
    if (curr <= 0) return 'agotado';
    if (min > 0 && curr <= min) return 'bajo_stock';
    return 'ok';
}

async function getSuppliesOverview(companyId) {
    const [rows] = await pool.query(
        `SELECT * FROM egg_industrial_supplies
         WHERE company_id = ?
         ORDER BY FIELD(category, 'empaque', 'aditivo', 'quimico_cip', 'suministro'), item_name ASC`,
        [companyId]
    );

    const supplies = rows.map(r => {
        const current_stock = parseFloat(r.current_stock || 0);
        const min_stock = parseFloat(r.min_stock || 0);
        const unit_cost = parseFloat(r.unit_cost || 0);
        const total_value = +(current_stock * unit_cost).toFixed(2);
        const stock_status = computeStockStatus(current_stock, min_stock);
        return {
            ...r,
            current_stock,
            min_stock,
            unit_cost,
            dose_per_batch: r.dose_per_batch !== null ? parseFloat(r.dose_per_batch) : null,
            total_value,
            stock_status,
            category_label: CATEGORY_LABELS[r.category] || r.category
        };
    });

    const summary = {
        total_items: supplies.length,
        total_inventory_value: +supplies.reduce((s, i) => s + i.total_value, 0).toFixed(2),
        empaque_count: supplies.filter(i => i.category === 'empaque').length,
        empaque_value: +supplies.filter(i => i.category === 'empaque').reduce((s, i) => s + i.total_value, 0).toFixed(2),
        aditivo_count: supplies.filter(i => i.category === 'aditivo').length,
        aditivo_value: +supplies.filter(i => i.category === 'aditivo').reduce((s, i) => s + i.total_value, 0).toFixed(2),
        quimico_cip_count: supplies.filter(i => i.category === 'quimico_cip').length,
        quimico_cip_value: +supplies.filter(i => i.category === 'quimico_cip').reduce((s, i) => s + i.total_value, 0).toFixed(2),
        low_stock_count: supplies.filter(i => i.stock_status === 'bajo_stock').length,
        out_of_stock_count: supplies.filter(i => i.stock_status === 'agotado').length,
        optimal_stock_count: supplies.filter(i => i.stock_status === 'ok').length
    };

    const [movements] = await pool.query(
        `SELECT * FROM egg_industrial_supply_movements
         WHERE company_id = ?
         ORDER BY movement_date DESC, id DESC
         LIMIT 150`,
        [companyId]
    );

    const formattedMovements = movements.map(m => ({
        ...m,
        movement_date: formatYMD(m.movement_date),
        quantity: parseFloat(m.quantity || 0),
        previous_stock: parseFloat(m.previous_stock || 0),
        new_stock: parseFloat(m.new_stock || 0),
        unit_cost: parseFloat(m.unit_cost || 0),
        total_cost: parseFloat(m.total_cost || 0),
        movement_label: MOVEMENT_LABELS[m.movement_type] || m.movement_type
    }));

    let batches = [];
    try {
        const [batchRows] = await pool.query(
            `SELECT id, batch_number, lot_code, product_type, status
             FROM egg_production_batches
             WHERE company_id = ?
             ORDER BY id DESC
             LIMIT 40`,
            [companyId]
        );
        batches = batchRows;
    } catch {
        batches = [];
    }

    return { supplies, summary, movements: formattedMovements, batches };
}

async function saveSupplyItem(companyId, payload = {}, user = null) {
    const id = payload.id ? parseInt(payload.id, 10) : null;
    const itemCode = String(payload.item_code || '').trim().toUpperCase();
    const itemName = String(payload.item_name || '').trim();
    if (!itemCode || !itemName) {
        const err = new Error('El código y el nombre del insumo son obligatorios.');
        err.status = 400;
        throw err;
    }

    const category = payload.category || 'empaque';
    const subcategory = payload.subcategory ? String(payload.subcategory).trim() : null;
    const unitOfMeasure = payload.unit_of_measure || 'unidad';
    const minStock = Math.max(0, parseFloat(payload.min_stock) || 0);
    const unitCost = Math.max(0, parseFloat(payload.unit_cost) || 0);
    const dosePerBatch = payload.dose_per_batch !== undefined && payload.dose_per_batch !== ''
        ? Math.max(0, parseFloat(payload.dose_per_batch) || 0)
        : null;
    const location = payload.location ? String(payload.location).trim() : 'Bodega de Insumos Planta';
    const notes = payload.notes ? String(payload.notes).trim() : null;

    try {
        if (id) {
            await pool.query(
                `UPDATE egg_industrial_supplies
                 SET item_code = ?, item_name = ?, category = ?, subcategory = ?,
                     unit_of_measure = ?, min_stock = ?, unit_cost = ?,
                     dose_per_batch = ?, location = ?, notes = ?
                 WHERE id = ? AND company_id = ?`,
                [itemCode, itemName, category, subcategory, unitOfMeasure, minStock, unitCost, dosePerBatch, location, notes, id, companyId]
            );

            await pool.query(
                'UPDATE egg_costing_packaging SET unit_cost = ? WHERE company_id = ? AND item_code = ?',
                [unitCost, companyId, itemCode]
            );
        } else {
            const initialStock = Math.max(0, parseFloat(payload.current_stock) || 0);
            const [ins] = await pool.query(
                `INSERT INTO egg_industrial_supplies
                 (company_id, item_code, item_name, category, subcategory, unit_of_measure,
                  current_stock, min_stock, unit_cost, dose_per_batch, location, status, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo', ?)`,
                [companyId, itemCode, itemName, category, subcategory, unitOfMeasure, initialStock, minStock, unitCost, dosePerBatch, location, notes]
            );

            if (initialStock > 0) {
                const totalCost = +(initialStock * unitCost).toFixed(2);
                await pool.query(
                    `INSERT INTO egg_industrial_supply_movements
                     (company_id, supply_id, item_code, item_name, category, movement_type,
                      quantity, previous_stock, new_stock, unit_cost, total_cost, reference_doc, notes, user_id, user_name, movement_date)
                     VALUES (?, ?, ?, ?, ?, 'entrada_inicial', ?, 0, ?, ?, ?, 'INV-INICIAL', ?, ?, ?, CURDATE())`,
                    [
                        companyId, ins.insertId, itemCode, itemName, category,
                        initialStock, initialStock, unitCost, totalCost,
                        notes || 'Existencia inicial al registrar insumo',
                        user?.id || null, user?.nombre || user?.username || 'Sistema'
                    ]
                );
            }
        }
    } catch (err) {
        if (err && err.code === 'ER_DUP_ENTRY') {
            const dupErr = new Error(`Ya existe un insumo registrado con el código "${itemCode}".`);
            dupErr.status = 400;
            throw dupErr;
        }
        throw err;
    }

    return getSuppliesOverview(companyId);
}

async function registerSupplyMovement(companyId, payload = {}, user = null) {
    const supplyId = parseInt(payload.supply_id, 10);
    const [rows] = await pool.query(
        'SELECT * FROM egg_industrial_supplies WHERE id = ? AND company_id = ?',
        [supplyId, companyId]
    );
    if (!rows.length) {
        const err = new Error('Insumo no encontrado.');
        err.status = 404;
        throw err;
    }

    const supply = rows[0];
    const movementType = payload.movement_type || 'entrada_compra';
    const quantity = Math.max(0, parseFloat(payload.quantity) || 0);
    if (quantity <= 0) {
        const err = new Error('La cantidad del movimiento debe ser mayor a cero.');
        err.status = 400;
        throw err;
    }

    const prevStock = parseFloat(supply.current_stock || 0);
    const isOutbound = ['salida_produccion', 'salida_cip', 'ajuste_negativo'].includes(movementType);
    if (isOutbound && quantity > prevStock) {
        const err = new Error(`Stock insuficiente en ${supply.item_name}. Disponible: ${prevStock} ${supply.unit_of_measure}.`);
        err.status = 400;
        throw err;
    }

    const newStock = isOutbound
        ? +(prevStock - quantity).toFixed(2)
        : +(prevStock + quantity).toFixed(2);

    const unitCost = payload.unit_cost !== undefined && payload.unit_cost !== ''
        ? Math.max(0, parseFloat(payload.unit_cost) || 0)
        : parseFloat(supply.unit_cost || 0);
    const totalCost = +(quantity * unitCost).toFixed(2);
    const movementDate = formatYMD(payload.movement_date) || formatYMD(new Date());

    await pool.query(
        `UPDATE egg_industrial_supplies
         SET current_stock = ?, unit_cost = ?
         WHERE id = ? AND company_id = ?`,
        [newStock, unitCost > 0 ? unitCost : supply.unit_cost, supplyId, companyId]
    );

    if (movementType === 'entrada_compra' && unitCost > 0) {
        await pool.query(
            'UPDATE egg_costing_packaging SET unit_cost = ? WHERE company_id = ? AND item_code = ?',
            [unitCost, companyId, supply.item_code]
        );
    }

    await pool.query(
        `INSERT INTO egg_industrial_supply_movements
         (company_id, supply_id, item_code, item_name, category, movement_type,
          quantity, previous_stock, new_stock, unit_cost, total_cost,
          reference_doc, batch_id, batch_code, provider_name, notes, user_id, user_name, movement_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            companyId, supplyId, supply.item_code, supply.item_name, supply.category, movementType,
            quantity, prevStock, newStock, unitCost, totalCost,
            payload.reference_doc ? String(payload.reference_doc).trim() : null,
            payload.batch_id ? parseInt(payload.batch_id, 10) : null,
            payload.batch_code ? String(payload.batch_code).trim() : null,
            payload.provider_name ? String(payload.provider_name).trim() : null,
            payload.notes ? String(payload.notes).trim() : null,
            user?.id || null, user?.nombre || user?.username || 'Sistema', movementDate
        ]
    );

    return getSuppliesOverview(companyId);
}

async function syncSuppliesWithCosting(companyId) {
    // 1. Sincronizar desde egg_costing_packaging (match por item_code)
    const [pkgRows] = await pool.query(
        'SELECT * FROM egg_costing_packaging WHERE company_id = ?',
        [companyId]
    );
    for (const p of pkgRows) {
        if (!p.item_code) continue;
        await pool.query(
            `INSERT INTO egg_industrial_supplies
             (company_id, item_code, item_name, category, subcategory, unit_of_measure, current_stock, min_stock, unit_cost, product_id, costing_source_type, costing_source_id)
             VALUES (?, ?, ?, 'empaque', ?, 'unidad', 0, 200, ?, ?, 'packaging', ?)
             ON DUPLICATE KEY UPDATE
                unit_cost = CASE WHEN VALUES(unit_cost) > 0 THEN VALUES(unit_cost) ELSE egg_industrial_supplies.unit_cost END,
                product_id = COALESCE(egg_industrial_supplies.product_id, VALUES(product_id))`,
            [companyId, p.item_code, p.item_name, p.category || 'recipiente', p.unit_cost || 0, p.product_id || null, p.id]
        );
    }

    // 2. Sincronizar desde egg_costing_cip_items sin duplicar (match por nombre normalizado o costing_source_id)
    const [cipRows] = await pool.query(
        "SELECT * FROM egg_costing_cip_items WHERE company_id = ? AND status = 'activo'",
        [companyId]
    );
    const seenCipNames = new Set();
    for (const c of cipRows) {
        const normName = String(c.item_name || '').trim().toLowerCase();
        if (!normName || seenCipNames.has(normName)) continue;
        seenCipNames.add(normName);

        const unitCost = (parseFloat(c.presentation_qty) || 0) > 0
            ? +((parseFloat(c.presentation_cost) || 0) / parseFloat(c.presentation_qty)).toFixed(4)
            : 0;

        const [existingCip] = await pool.query(
            `SELECT id FROM egg_industrial_supplies
             WHERE company_id = ? AND (LOWER(TRIM(item_name)) = ? OR (costing_source_type = 'cip' AND costing_source_id = ?))
             LIMIT 1`,
            [companyId, normName, c.id]
        );

        if (existingCip.length > 0) {
            await pool.query(
                `UPDATE egg_industrial_supplies
                 SET unit_cost = CASE WHEN ? > 0 THEN ? ELSE unit_cost END,
                     dose_per_batch = COALESCE(?, dose_per_batch),
                     costing_source_type = 'cip',
                     costing_source_id = ?
                 WHERE id = ? AND company_id = ?`,
                [unitCost, unitCost, c.dose_per_batch || null, c.id, existingCip[0].id, companyId]
            );
        } else {
            const cleanCode = `CIP-${String(c.item_name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)}`;
            await pool.query(
                `INSERT IGNORE INTO egg_industrial_supplies
                 (company_id, item_code, item_name, category, subcategory, unit_of_measure, current_stock, min_stock, unit_cost, dose_per_batch, costing_source_type, costing_source_id)
                 VALUES (?, ?, ?, 'quimico_cip', 'sanitizante', ?, 0, 20, ?, ?, 'cip', ?)`,
                [companyId, cleanCode, c.item_name, c.presentation_unit || 'kg', unitCost, c.dose_per_batch || null, c.id]
            );
        }
    }

    return getSuppliesOverview(companyId);
}

async function deleteSupplyItem(companyId, supplyId) {
    await pool.query('DELETE FROM egg_industrial_supplies WHERE id = ? AND company_id = ?', [supplyId, companyId]);
    return getSuppliesOverview(companyId);
}

async function exportSuppliesReport(companyId, query = {}, res) {
    const company = await reportPdfHelper.getCompanyInfo(companyId);
    const overview = await getSuppliesOverview(companyId);
    const { format, category } = query;

    const items = category && category !== 'all'
        ? overview.supplies.filter(s => s.category === category)
        : overview.supplies;

    const totalValue = +items.reduce((s, i) => s + i.total_value, 0).toFixed(2);
    const periodText = `FECHA DE CORTE: ${reportPdfHelper.formatDate(new Date())}`;

    if (format === 'excel') {
        const rows = items.map(i => ({
            item_code: i.item_code, item_name: i.item_name, category_label: i.category_label,
            unit_of_measure: i.unit_of_measure, current_stock: i.current_stock, min_stock: i.min_stock,
            stock_status: i.stock_status.toUpperCase(), unit_cost: i.unit_cost, total_value: i.total_value,
            location: i.location || 'Bodega Planta'
        }));
        rows.push({
            item_code: 'TOTAL', item_name: `${items.length} Insumos Registrados`, category_label: '',
            unit_of_measure: '', current_stock: '', min_stock: '', stock_status: '', unit_cost: '',
            total_value: totalValue, location: ''
        });
        const buffer = await excelService.createExcelBuffer({
            title: `INVENTARIO VALORIZADO DE INSUMOS - HUEVO INDUSTRIAL (${periodText})`,
            sheets: [{
                name: 'Inventario Insumos',
                columns: [
                    { header: 'Código', key: 'item_code', width: 18 },
                    { header: 'Descripción del Insumo', key: 'item_name', width: 38 },
                    { header: 'Categoría', key: 'category_label', width: 26 },
                    { header: 'Unidad', key: 'unit_of_measure', width: 12 },
                    { header: 'Existencia Actual', key: 'current_stock', width: 16 },
                    { header: 'Stock Mínimo', key: 'min_stock', width: 14 },
                    { header: 'Estado', key: 'stock_status', width: 14 },
                    { header: 'Costo Unit. ($)', key: 'unit_cost', width: 16 },
                    { header: 'Valor Total ($)', key: 'total_value', width: 18 },
                    { header: 'Ubicación', key: 'location', width: 24 }
                ],
                data: rows
            }]
        });
        return excelService.sendExcelResponse(res, buffer, `inventario_insumos_industrial_${formatYMD(new Date())}.xlsx`);
    }

    return reportPdfHelper.buildPDF(res, 'landscape', (doc) => {
        let y = reportPdfHelper.renderHeader(doc, company, 'REPORTE DE INVENTARIO VALORIZADO DE INSUMOS INDUSTRIALES', periodText, 'landscape', 'PLANTA DE HUEVO INDUSTRIAL');

        const cols = [
            { label: 'CÓDIGO', x: 30, w: 85, align: 'left' },
            { label: 'DESCRIPCIÓN DEL INSUMO', x: 115, w: 215, align: 'left' },
            { label: 'CATEGORÍA', x: 330, w: 115, align: 'left' },
            { label: 'UNIDAD', x: 445, w: 50, align: 'center' },
            { label: 'EXISTENCIA', x: 495, w: 65, align: 'right' },
            { label: 'MÍNIMO', x: 560, w: 55, align: 'right' },
            { label: 'COSTO UNIT.', x: 615, w: 68, align: 'right' },
            { label: 'VALOR TOTAL', x: 683, w: 79, align: 'right' }
        ];

        const drawHeader = (topY) => {
            doc.rect(30, topY, 732, 14).fill('#f1f5f9');
            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, topY + 14).lineTo(762, topY + 14).stroke();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
            cols.forEach(c => doc.text(c.label, c.x + 2, topY + 4, { width: c.w - 4, align: c.align, lineBreak: false }));
            return topY + 17;
        };

        y = drawHeader(y);

        items.forEach((it, idx) => {
            if (y > 510) {
                doc.addPage();
                y = reportPdfHelper.renderHeader(doc, company, 'REPORTE DE INVENTARIO VALORIZADO DE INSUMOS INDUSTRIALES', periodText, 'landscape', 'PLANTA DE HUEVO INDUSTRIAL');
                y = drawHeader(y);
            }
            if (idx % 2 === 1) doc.rect(30, y - 2, 732, 13).fill('#f8fafc');
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a').text(it.item_code, cols[0].x + 2, y, { width: cols[0].w - 4, lineBreak: false });
            doc.font('Helvetica').text(reportPdfHelper.fitText(doc, it.item_name, cols[1].w - 4), cols[1].x + 2, y, { width: cols[1].w - 4, lineBreak: false });
            doc.fillColor('#475569').text(reportPdfHelper.fitText(doc, it.category_label, cols[2].w - 4), cols[2].x + 2, y, { width: cols[2].w - 4, lineBreak: false });
            doc.text(it.unit_of_measure, cols[3].x + 2, y, { width: cols[3].w - 4, align: 'center', lineBreak: false });
            doc.font('Helvetica-Bold').fillColor('#0f172a').text(Number(it.current_stock).toLocaleString('en-US'), cols[4].x + 2, y, { width: cols[4].w - 4, align: 'right', lineBreak: false });
            doc.font('Helvetica').fillColor('#64748b').text(Number(it.min_stock).toLocaleString('en-US'), cols[5].x + 2, y, { width: cols[5].w - 4, align: 'right', lineBreak: false });
            doc.fillColor('#0f172a').text(`$ ${Number(it.unit_cost).toFixed(4)}`, cols[6].x + 2, y, { width: cols[6].w - 4, align: 'right', lineBreak: false });
            doc.font('Helvetica-Bold').text(reportPdfHelper.fmt(it.total_value), cols[7].x + 2, y, { width: cols[7].w - 4, align: 'right', lineBreak: false });
            y += 13;
        });

        doc.rect(30, y, 732, 16).fill('#f1f5f9');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('VALOR TOTAL DEL INVENTARIO DE INSUMOS', cols[0].x + 2, y + 4, { width: 400, lineBreak: false });
        doc.text(reportPdfHelper.fmt(totalValue, false), cols[7].x + 2, y + 4, { width: cols[7].w - 4, align: 'right', lineBreak: false });
        y += 22;

        reportPdfHelper.renderClosingFooter(doc, 30, y, items.length, 'Insumos');
        reportPdfHelper.renderPageNumbers(doc);
        doc.end();
    });
}

module.exports = {
    getSuppliesOverview,
    saveSupplyItem,
    registerSupplyMovement,
    syncSuppliesWithCosting,
    deleteSupplyItem,
    exportSuppliesReport
};
