const pool = require('../../config/db');

const VALID_REASONS = new Set(['venta_factura', 'merma_dano', 'donacion', 'ajuste_inventario', 'otro']);

let schemaReadyPromise = null;

function round2(val) {
    return Math.round((Number(val) || 0) * 100) / 100;
}

function parseJsonSafe(val, fallback = []) {
    if (val === null || val === undefined) return fallback;
    if (typeof val !== 'string') return val;
    try {
        return JSON.parse(val);
    } catch {
        return fallback;
    }
}

function httpError(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    return err;
}

async function ensureWriteOffSchema() {
    if (!schemaReadyPromise) {
        schemaReadyPromise = pool.query(`
            CREATE TABLE IF NOT EXISTS egg_raw_material_writeoffs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NULL,
                raw_material_id INT NOT NULL,
                sale_id INT NULL,
                invoice_number VARCHAR(120) NULL,
                invoice_dte_type VARCHAR(20) NULL,
                invoice_date DATE NULL,
                invoice_total DECIMAL(14, 2) NULL DEFAULT 0.00,
                customer_id INT NULL,
                customer_name VARCHAR(200) NULL,
                reason_type ENUM('venta_factura', 'merma_dano', 'donacion', 'ajuste_inventario', 'otro') NOT NULL DEFAULT 'venta_factura',
                tarimas_json JSON NOT NULL,
                tarimas_count INT NOT NULL DEFAULT 0,
                boxes_count INT NOT NULL DEFAULT 0,
                quantity_lbs DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
                notes TEXT NULL,
                status ENUM('activo', 'revertido') NOT NULL DEFAULT 'activo',
                created_by INT NULL,
                operator_name VARCHAR(150) NULL,
                reverted_at DATETIME NULL,
                reverted_by INT NULL,
                reverted_by_name VARCHAR(150) NULL,
                revert_reason VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_writeoffs_company_status (company_id, status, created_at),
                INDEX idx_writeoffs_company_rm (company_id, raw_material_id, status),
                INDEX idx_writeoffs_company_sale (company_id, sale_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `).catch((err) => {
            schemaReadyPromise = null;
            throw err;
        });
    }
    return schemaReadyPromise;
}

/**
 * Devuelve un mapa de consumos por bajas activas (no producción) agrupados por raw_material_id y tarima_number.
 */
async function getConsumedWriteOffsByCompany(companyId, conn = pool, rawMaterialId = null) {
    await ensureWriteOffSchema();
    const params = [companyId];
    let sql = `
        SELECT id, raw_material_id, sale_id, invoice_number, customer_name, reason_type, tarimas_json, boxes_count, quantity_lbs, created_at
        FROM egg_raw_material_writeoffs
        WHERE company_id = ? AND status = 'activo'
    `;
    if (rawMaterialId) {
        sql += ' AND raw_material_id = ?';
        params.push(rawMaterialId);
    }
    const [rows] = await conn.query(sql, params);

    const map = {};
    for (const row of rows) {
        const rmId = row.raw_material_id;
        if (!map[rmId]) {
            map[rmId] = { tarimas: {}, totalBoxes: 0, totalLbs: 0, count: 0 };
        }
        map[rmId].totalBoxes += parseInt(row.boxes_count, 10) || 0;
        map[rmId].totalLbs = round2(map[rmId].totalLbs + (parseFloat(row.quantity_lbs) || 0));
        map[rmId].count += 1;

        const parsed = parseJsonSafe(row.tarimas_json, []);
        if (Array.isArray(parsed)) {
            for (const t of parsed) {
                const num = parseInt(t.tarima_number, 10) || 1;
                if (!map[rmId].tarimas[num]) {
                    map[rmId].tarimas[num] = { boxes: 0, lbs: 0, refs: [] };
                }
                const tBoxes = parseInt(t.boxes_count, 10) || 0;
                const tLbs = parseFloat(t.quantity_lbs) || 0;
                map[rmId].tarimas[num].boxes += tBoxes;
                map[rmId].tarimas[num].lbs = round2(map[rmId].tarimas[num].lbs + tLbs);
                map[rmId].tarimas[num].refs.push({
                    id: row.id,
                    sale_id: row.sale_id,
                    invoice_number: row.invoice_number || null,
                    customer_name: row.customer_name || null,
                    reason_type: row.reason_type,
                    boxes_count: tBoxes,
                    quantity_lbs: tLbs
                });
            }
        }
    }
    return map;
}

/**
 * Devuelve el consumo acumulado en producción por lote y tarima (excluyendo lotes cancelados).
 */
async function getProductionConsumptionByCompany(companyId, conn = pool) {
    const [prodRows] = await conn.query(
        `SELECT brm.raw_material_id, brm.tarimas_json
         FROM batch_raw_materials brm
         JOIN egg_production_batches b ON b.id = brm.batch_id
         WHERE b.company_id = ? AND b.status != 'cancelado'`,
        [companyId]
    );

    const map = {};
    for (const pr of prodRows) {
        const rmId = pr.raw_material_id;
        if (!map[rmId]) map[rmId] = {};
        const parsed = parseJsonSafe(pr.tarimas_json, []);
        if (!Array.isArray(parsed)) continue;
        for (const t of parsed) {
            const num = parseInt(t.tarima_number, 10) || 1;
            if (!map[rmId][num]) map[rmId][num] = { boxes: 0, lbs: 0 };
            map[rmId][num].boxes += parseInt(t.boxes_count, 10) || 0;
            map[rmId][num].lbs = round2(map[rmId][num].lbs + (parseFloat(t.quantity_lbs) || 0));
        }
    }
    return map;
}

/**
 * Calcula la disponibilidad exacta por tarima de un lote específico descontando producción + bajas activas.
 */
async function computeLotTarimaAvailability(conn, companyId, rm) {
    const [prodRows] = await conn.query(
        `SELECT brm.tarimas_json
         FROM batch_raw_materials brm
         JOIN egg_production_batches b ON b.id = brm.batch_id
         WHERE b.company_id = ? AND brm.raw_material_id = ? AND b.status != 'cancelado'`,
        [companyId, rm.id]
    );

    const prodByTarima = {};
    for (const pr of prodRows) {
        const parsed = parseJsonSafe(pr.tarimas_json, []);
        if (!Array.isArray(parsed)) continue;
        for (const t of parsed) {
            const num = parseInt(t.tarima_number, 10) || 1;
            if (!prodByTarima[num]) prodByTarima[num] = { boxes: 0, lbs: 0 };
            prodByTarima[num].boxes += parseInt(t.boxes_count, 10) || 0;
            prodByTarima[num].lbs = round2(prodByTarima[num].lbs + (parseFloat(t.quantity_lbs) || 0));
        }
    }

    const writeOffMap = await getConsumedWriteOffsByCompany(companyId, conn, rm.id);
    const woByTarima = writeOffMap[rm.id]?.tarimas || {};

    let originalTarimas = parseJsonSafe(rm.tarimas_json, []);
    if (!Array.isArray(originalTarimas) || originalTarimas.length === 0) {
        originalTarimas = [{
            tarima_number: 1,
            boxes_count: parseInt(rm.initial_boxes || rm.total_boxes, 10) || 0,
            net_weight_lbs: parseFloat(rm.weight_lbs) || 0,
            storage_location: rm.storage_location || 'abajo'
        }];
    }

    const lotCode = (rm.provider_lot || 'LOTE').trim().toUpperCase();
    return originalTarimas.map((t, idx) => {
        const tarimaNum = parseInt(t.tarima_number, 10) || (idx + 1);
        const origBoxes = parseInt(t.boxes_count, 10) || 0;
        const origLbs = round2(parseFloat(t.net_weight_lbs || t.gross_weight_lbs) || 0);
        const prod = prodByTarima[tarimaNum] || { boxes: 0, lbs: 0 };
        const wo = woByTarima[tarimaNum] || { boxes: 0, lbs: 0, refs: [] };
        const availBoxes = Math.max(0, origBoxes - prod.boxes - wo.boxes);
        const availLbs = Math.max(0, round2(origLbs - prod.lbs - wo.lbs));
        const isDepleted = (availBoxes <= 0 && availLbs <= 0.01) || parseFloat(rm.stock_lbs || 0) <= 0.01;

        return {
            tarima_number: tarimaNum,
            original_boxes: origBoxes,
            original_lbs: origLbs,
            prod_boxes: prod.boxes,
            prod_lbs: prod.lbs,
            writeoff_boxes: wo.boxes,
            writeoff_lbs: wo.lbs,
            available_boxes: availBoxes,
            available_lbs: availLbs,
            barcode: `TAR-${lotCode}-${String(tarimaNum).padStart(2, '0')}`,
            storage_location: t.storage_location || rm.storage_location || 'abajo',
            is_depleted: isDepleted
        };
    });
}

/**
 * Busca facturas de venta de la empresa para vincularlas a tarimas de materia prima.
 */
async function searchAvailableInvoices(companyId, query = {}) {
    await ensureWriteOffSchema();
    const search = String(query.search || '').trim();
    const onlyShellEggs = String(query.only_shell_eggs || 'false') === 'true';
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 30, 1), 100);

    const shellCondition = `(
        UPPER(si.descripcion) LIKE '%CASCARA%'
        OR UPPER(si.descripcion) LIKE '%CÁSCARA%'
        OR (UPPER(si.descripcion) LIKE '%HUEVO%' AND (UPPER(si.descripcion) LIKE '%CARTON%' OR UPPER(si.descripcion) LIKE '%CAJA%'))
        OR UPPER(si.descripcion) LIKE '%HUEVO FRESCO%'
    )`;

    const where = [
        's.company_id = ?',
        "COALESCE(LOWER(s.estado), '') NOT IN ('anulado', 'invalidado', 'cancelado', 'borrador')"
    ];
    const params = [companyId];

    if (onlyShellEggs) {
        where.push(`EXISTS (SELECT 1 FROM sales_items si WHERE si.sale_id = s.id AND ${shellCondition})`);
    }

    if (search) {
        const like = `%${search}%`;
        where.push(`(
            s.numero_control LIKE ?
            OR s.codigo_generacion LIKE ?
            OR CAST(s.id AS CHAR) LIKE ?
            OR COALESCE(s.cliente_nombre, c.nombre, c.nombre_comercial, '') LIKE ?
            OR EXISTS (SELECT 1 FROM sales_items si WHERE si.sale_id = s.id AND si.descripcion LIKE ?)
        )`);
        params.push(like, like, like, like, like);
    }

    const sql = `
        SELECT
            s.id,
            s.dte_type,
            s.tipo_documento,
            s.numero_control,
            s.codigo_generacion,
            s.fecha_emision,
            s.estado,
            s.total_pagar,
            s.customer_id,
            COALESCE(NULLIF(TRIM(s.cliente_nombre), ''), c.nombre, c.nombre_comercial, 'Consumidor Final') AS customer_name,
            COALESCE(c.nit, c.numero_documento) AS customer_doc,
            EXISTS (SELECT 1 FROM sales_items si WHERE si.sale_id = s.id AND ${shellCondition}) AS is_shell_egg,
            COALESCE(wo.linked_count, 0) AS linked_count,
            COALESCE(wo.linked_boxes, 0) AS linked_boxes,
            COALESCE(wo.linked_lbs, 0) AS linked_lbs
        FROM sales_headers s
        LEFT JOIN customers c ON c.id = s.customer_id
        LEFT JOIN (
            SELECT sale_id, COUNT(*) AS linked_count, SUM(boxes_count) AS linked_boxes, SUM(quantity_lbs) AS linked_lbs
            FROM egg_raw_material_writeoffs
            WHERE company_id = ? AND status = 'activo' AND sale_id IS NOT NULL
            GROUP BY sale_id
        ) wo ON wo.sale_id = s.id
        WHERE ${where.join(' AND ')}
        ORDER BY ${search ? 's.fecha_emision DESC, s.id DESC' : 'is_shell_egg DESC, s.fecha_emision DESC, s.id DESC'}
        LIMIT ?
    `;

    const [rows] = await pool.query(sql, [companyId, ...params, limit]);
    if (rows.length === 0) return [];

    const saleIds = rows.map((r) => r.id);
    const [itemRows] = await pool.query(
        `SELECT sale_id, descripcion, cantidad, precio_unitario, venta_gravada, venta_exenta
         FROM sales_items
         WHERE sale_id IN (?)
         ORDER BY id ASC`,
        [saleIds]
    );

    const itemsBySale = {};
    for (const item of itemRows) {
        if (!itemsBySale[item.sale_id]) itemsBySale[item.sale_id] = [];
        itemsBySale[item.sale_id].push({
            descripcion: item.descripcion,
            cantidad: parseFloat(item.cantidad) || 0,
            precio_unitario: parseFloat(item.precio_unitario) || 0,
            subtotal: round2((parseFloat(item.venta_gravada) || 0) + (parseFloat(item.venta_exenta) || 0))
        });
    }

    return rows.map((r) => ({
        ...r,
        is_shell_egg: Boolean(r.is_shell_egg),
        total_pagar: round2(r.total_pagar),
        linked_count: parseInt(r.linked_count, 10) || 0,
        linked_boxes: parseInt(r.linked_boxes, 10) || 0,
        linked_lbs: round2(r.linked_lbs),
        invoice_label: r.numero_control || r.codigo_generacion || `FAC-${r.id}`,
        items: itemsBySale[r.id] || []
    }));
}

/**
 * Lista paginada del historial de bajas y vinculaciones de facturas con lotes de huevo.
 */
async function listWriteOffs(companyId, query = {}) {
    await ensureWriteOffSchema();
    const search = String(query.search || '').trim();
    const status = String(query.status || '').trim();
    const reasonType = String(query.reason_type || '').trim();
    const rawMaterialId = query.raw_material_id ? parseInt(query.raw_material_id, 10) : null;
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 15, 1), 100);
    const offset = (page - 1) * limit;

    const where = ['w.company_id = ?'];
    const params = [companyId];

    if (status && ['activo', 'revertido'].includes(status)) {
        where.push('w.status = ?');
        params.push(status);
    }
    if (reasonType && VALID_REASONS.has(reasonType)) {
        where.push('w.reason_type = ?');
        params.push(reasonType);
    }
    if (rawMaterialId) {
        where.push('w.raw_material_id = ?');
        params.push(rawMaterialId);
    }
    if (search) {
        const like = `%${search}%`;
        where.push(`(
            COALESCE(w.invoice_number, '') LIKE ?
            OR COALESCE(w.customer_name, '') LIKE ?
            OR COALESCE(w.notes, '') LIKE ?
            OR COALESCE(w.operator_name, '') LIKE ?
            OR COALESCE(rm.provider_lot, '') LIKE ?
            OR COALESCE(p.nombre, '') LIKE ?
        )`);
        params.push(like, like, like, like, like, like);
    }

    const whereSql = where.join(' AND ');

    const [[countRow]] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM egg_raw_material_writeoffs w
         LEFT JOIN egg_raw_materials rm ON rm.id = w.raw_material_id
         LEFT JOIN providers p ON p.id = rm.provider_id
         WHERE ${whereSql}`,
        params
    );

    const [rows] = await pool.query(
        `SELECT
            w.*,
            rm.provider_lot,
            rm.egg_type,
            rm.egg_size,
            rm.egg_color,
            rm.fecha AS lot_reception_date,
            COALESCE(p.nombre, p.nombre_comercial, 'Proveedor') AS provider_name
         FROM egg_raw_material_writeoffs w
         LEFT JOIN egg_raw_materials rm ON rm.id = w.raw_material_id
         LEFT JOIN providers p ON p.id = rm.provider_id
         WHERE ${whereSql}
         ORDER BY w.created_at DESC, w.id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    const [[summaryRow]] = await pool.query(
        `SELECT
            SUM(CASE WHEN status = 'activo' THEN 1 ELSE 0 END) AS active_writeoffs,
            SUM(CASE WHEN status = 'revertido' THEN 1 ELSE 0 END) AS reverted_writeoffs,
            COALESCE(SUM(CASE WHEN status = 'activo' THEN tarimas_count ELSE 0 END), 0) AS total_tarimas_written_off,
            COALESCE(SUM(CASE WHEN status = 'activo' THEN boxes_count ELSE 0 END), 0) AS total_boxes_written_off,
            COALESCE(SUM(CASE WHEN status = 'activo' THEN quantity_lbs ELSE 0 END), 0) AS total_lbs_written_off,
            COUNT(DISTINCT CASE WHEN status = 'activo' AND (sale_id IS NOT NULL OR NULLIF(TRIM(invoice_number), '') IS NOT NULL)
                THEN COALESCE(CAST(sale_id AS CHAR), invoice_number) END) AS linked_invoices_count
         FROM egg_raw_material_writeoffs
         WHERE company_id = ?`,
        [companyId]
    );

    const total = parseInt(countRow?.total, 10) || 0;
    return {
        data: rows.map((r) => ({
            ...r,
            invoice_total: round2(r.invoice_total),
            quantity_lbs: round2(r.quantity_lbs),
            quantity_kg: round2((parseFloat(r.quantity_lbs) || 0) * 0.453592),
            tarimas: parseJsonSafe(r.tarimas_json, [])
        })),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        summary: {
            active_writeoffs: parseInt(summaryRow?.active_writeoffs, 10) || 0,
            reverted_writeoffs: parseInt(summaryRow?.reverted_writeoffs, 10) || 0,
            total_tarimas_written_off: parseInt(summaryRow?.total_tarimas_written_off, 10) || 0,
            total_boxes_written_off: parseInt(summaryRow?.total_boxes_written_off, 10) || 0,
            total_lbs_written_off: round2(summaryRow?.total_lbs_written_off),
            linked_invoices_count: parseInt(summaryRow?.linked_invoices_count, 10) || 0
        }
    };
}

/**
 * Registra transaccionalmente la baja de una o más tarimas de un lote y vincula opcionalmente una factura.
 */
async function createWriteOff(companyId, branchId, user, payload = {}) {
    await ensureWriteOffSchema();

    const rawMaterialId = parseInt(payload.raw_material_id, 10);
    if (!rawMaterialId) throw httpError('Debe seleccionar un lote de huevo (materia prima).');

    const reasonType = VALID_REASONS.has(payload.reason_type) ? payload.reason_type : 'venta_factura';
    const rawTarimas = Array.isArray(payload.tarimas) ? payload.tarimas : [];
    if (rawTarimas.length === 0) {
        throw httpError('Debe seleccionar al menos una tarima para dar de baja.');
    }

    const saleId = payload.sale_id ? parseInt(payload.sale_id, 10) : null;
    let invoiceNumber = payload.invoice_number ? String(payload.invoice_number).trim() : null;
    let invoiceDteType = payload.invoice_dte_type ? String(payload.invoice_dte_type).trim() : null;
    let invoiceDate = payload.invoice_date || null;
    let invoiceTotal = payload.invoice_total !== undefined && payload.invoice_total !== null ? round2(payload.invoice_total) : 0;
    let customerId = payload.customer_id ? parseInt(payload.customer_id, 10) : null;
    let customerName = payload.customer_name ? String(payload.customer_name).trim() : null;

    if (reasonType === 'venta_factura' && !saleId && !invoiceNumber) {
        throw httpError('Debe seleccionar una factura del sistema o ingresar un número de factura.');
    }

    const operatorName = String(payload.operator_name || user?.name || user?.username || 'Operador').trim();
    const notes = payload.notes ? String(payload.notes).trim() : null;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        if (saleId) {
            const [saleRows] = await conn.query(
                `SELECT s.id, s.dte_type, s.numero_control, s.codigo_generacion, s.fecha_emision, s.estado, s.total_pagar,
                        s.customer_id, COALESCE(NULLIF(TRIM(s.cliente_nombre), ''), c.nombre, c.nombre_comercial, 'Consumidor Final') AS resolved_customer
                 FROM sales_headers s
                 LEFT JOIN customers c ON c.id = s.customer_id
                 WHERE s.id = ? AND s.company_id = ?`,
                [saleId, companyId]
            );
            if (saleRows.length === 0) {
                throw httpError('La factura seleccionada no pertenece a esta empresa o no existe.', 404);
            }
            const sale = saleRows[0];
            if (['anulado', 'invalidado', 'cancelado'].includes(String(sale.estado || '').toLowerCase())) {
                throw httpError('No se puede vincular una factura anulada o invalidada.', 409);
            }
            invoiceNumber = sale.numero_control || sale.codigo_generacion || `FAC-${sale.id}`;
            invoiceDteType = sale.dte_type || null;
            invoiceDate = sale.fecha_emision ? String(sale.fecha_emision).slice(0, 10) : null;
            invoiceTotal = round2(sale.total_pagar);
            customerId = sale.customer_id || null;
            customerName = sale.resolved_customer || customerName;
        }

        const [rmRows] = await conn.query(
            'SELECT * FROM egg_raw_materials WHERE id = ? AND company_id = ? FOR UPDATE',
            [rawMaterialId, companyId]
        );
        if (rmRows.length === 0) {
            throw httpError('El lote de materia prima no existe.', 404);
        }
        const rm = rmRows[0];
        if (['anulado', 'cancelado'].includes(String(rm.status || '').toLowerCase())) {
            throw httpError('No se pueden dar de baja tarimas de un lote anulado.', 409);
        }

        const availTarimas = await computeLotTarimaAvailability(conn, companyId, rm);
        const availByNum = new Map(availTarimas.map((t) => [t.tarima_number, t]));

        const seenNums = new Set();
        const normalizedTarimas = [];
        let totalBoxes = 0;
        let totalLbs = 0;

        for (const item of rawTarimas) {
            const num = parseInt(item.tarima_number, 10);
            if (!num || seenNums.has(num)) {
                throw httpError(`Tarima inválida o duplicada (#${item.tarima_number}).`);
            }
            seenNums.add(num);

            const avail = availByNum.get(num);
            if (!avail) {
                throw httpError(`La tarima #${num} no existe en el lote ${rm.provider_lot || rm.id}.`);
            }
            if (avail.is_depleted || (avail.available_boxes <= 0 && avail.available_lbs <= 0.01)) {
                throw httpError(`La tarima #${num} ya se encuentra agotada.`);
            }

            const reqBoxes = item.boxes_count !== undefined && item.boxes_count !== ''
                ? parseInt(item.boxes_count, 10)
                : avail.available_boxes;

            let reqLbs;
            if (item.quantity_lbs !== undefined && item.quantity_lbs !== '' && !Number.isNaN(Number(item.quantity_lbs))) {
                reqLbs = round2(item.quantity_lbs);
            } else if (avail.available_boxes > 0) {
                reqLbs = reqBoxes === avail.available_boxes
                    ? avail.available_lbs
                    : round2((avail.available_lbs / avail.available_boxes) * reqBoxes);
            } else {
                reqLbs = avail.available_lbs;
            }

            if (reqBoxes < 0 || reqLbs < 0 || (reqBoxes === 0 && reqLbs <= 0)) {
                throw httpError(`La cantidad a dar de baja en tarima #${num} debe ser mayor a cero.`);
            }
            if (reqBoxes > avail.available_boxes) {
                throw httpError(`Tarima #${num}: solo dispone de ${avail.available_boxes} cajas (solicitado: ${reqBoxes}).`);
            }
            if (reqLbs > avail.available_lbs + 0.05) {
                throw httpError(`Tarima #${num}: solo dispone de ${avail.available_lbs} lbs (solicitado: ${reqLbs} lbs).`);
            }

            const finalLbs = Math.min(reqLbs, avail.available_lbs);
            normalizedTarimas.push({
                tarima_number: num,
                barcode: avail.barcode,
                storage_location: avail.storage_location,
                boxes_count: reqBoxes,
                quantity_lbs: finalLbs,
                full_tarima: reqBoxes === avail.available_boxes && Math.abs(finalLbs - avail.available_lbs) <= 0.05
            });
            totalBoxes += reqBoxes;
            totalLbs = round2(totalLbs + finalLbs);
        }

        const currentLotLbs = round2(rm.stock_lbs);
        const currentLotBoxes = parseInt(rm.total_boxes, 10) || 0;
        if (totalLbs > currentLotLbs + 0.1) {
            throw httpError(`Saldo en libras insuficiente en lote ${rm.provider_lot} (disponible: ${currentLotLbs} lbs, baja: ${totalLbs} lbs).`);
        }
        if (totalBoxes > currentLotBoxes && currentLotBoxes > 0) {
            throw httpError(`Saldo en cajas insuficiente en lote ${rm.provider_lot} (disponible: ${currentLotBoxes} cajas, baja: ${totalBoxes} cajas).`);
        }

        const effectiveLbs = Math.min(totalLbs, currentLotLbs);
        const resolvedBranch = branchId || rm.branch_id || null;

        const [insertRes] = await conn.query(
            `INSERT INTO egg_raw_material_writeoffs (
                company_id, branch_id, raw_material_id, sale_id, invoice_number, invoice_dte_type,
                invoice_date, invoice_total, customer_id, customer_name, reason_type,
                tarimas_json, tarimas_count, boxes_count, quantity_lbs, notes, status, created_by, operator_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo', ?, ?)`,
            [
                companyId, resolvedBranch, rawMaterialId, saleId, invoiceNumber, invoiceDteType,
                invoiceDate, invoiceTotal, customerId, customerName, reasonType,
                JSON.stringify(normalizedTarimas), normalizedTarimas.length, totalBoxes, effectiveLbs,
                notes, user?.id || null, operatorName
            ]
        );

        const newStockLbs = Math.max(0, round2(currentLotLbs - effectiveLbs));
        const newTotalBoxes = Math.max(0, currentLotBoxes - totalBoxes);

        await conn.query(
            'UPDATE egg_raw_materials SET stock_lbs = ?, total_boxes = ? WHERE id = ? AND company_id = ?',
            [newStockLbs, newTotalBoxes, rawMaterialId, companyId]
        );

        const tarimaLabels = normalizedTarimas.map((t) => `#${t.tarima_number}`).join(', ');
        const desc = invoiceNumber
            ? `Baja de ${normalizedTarimas.length} tarima(s) (${tarimaLabels} / ${totalBoxes} cajas / ${effectiveLbs} lbs) del lote ${rm.provider_lot || '#' + rm.id} vinculada a factura ${invoiceNumber}.`
            : `Baja no productiva (${reasonType}) de ${normalizedTarimas.length} tarima(s) (${tarimaLabels} / ${totalBoxes} cajas / ${effectiveLbs} lbs) del lote ${rm.provider_lot || '#' + rm.id}.`;

        await conn.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'raw_material.tarima_writeoff', 'info', ?, ?, ?)`,
            [
                companyId,
                desc,
                JSON.stringify({
                    writeoff_id: insertRes.insertId,
                    raw_material_id: rawMaterialId,
                    sale_id: saleId,
                    invoice_number: invoiceNumber,
                    reason_type: reasonType,
                    tarimas: normalizedTarimas,
                    boxes_count: totalBoxes,
                    quantity_lbs: effectiveLbs
                }),
                operatorName
            ]
        );

        await conn.commit();
        return {
            id: insertRes.insertId,
            raw_material_id: rawMaterialId,
            sale_id: saleId,
            invoice_number: invoiceNumber,
            customer_name: customerName,
            reason_type: reasonType,
            tarimas_count: normalizedTarimas.length,
            boxes_count: totalBoxes,
            quantity_lbs: effectiveLbs,
            tarimas: normalizedTarimas,
            remaining_lot_stock_lbs: newStockLbs,
            remaining_lot_boxes: newTotalBoxes
        };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

/**
 * Revierte una baja activa y restaura las tarimas, cajas y libras al inventario del lote.
 */
async function revertWriteOff(companyId, id, user, revertReason = null) {
    await ensureWriteOffSchema();
    const writeOffId = parseInt(id, 10);
    if (!writeOffId) throw httpError('ID de baja inválido.');

    const operatorName = String(user?.name || user?.username || 'Operador').trim();
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [rows] = await conn.query(
            'SELECT * FROM egg_raw_material_writeoffs WHERE id = ? AND company_id = ? FOR UPDATE',
            [writeOffId, companyId]
        );
        if (rows.length === 0) {
            throw httpError('Registro de baja no encontrado.', 404);
        }
        const wo = rows[0];
        if (wo.status === 'revertido') {
            throw httpError('Esta baja ya fue revertida anteriormente.', 409);
        }

        const [rmRows] = await conn.query(
            'SELECT id, provider_lot, weight_lbs, stock_lbs, total_boxes, initial_boxes FROM egg_raw_materials WHERE id = ? AND company_id = ? FOR UPDATE',
            [wo.raw_material_id, companyId]
        );

        await conn.query(
            `UPDATE egg_raw_material_writeoffs
             SET status = 'revertido',
                 reverted_at = NOW(),
                 reverted_by = ?,
                 reverted_by_name = ?,
                 revert_reason = ?
             WHERE id = ? AND company_id = ?`,
            [user?.id || null, operatorName, revertReason ? String(revertReason).trim().slice(0, 250) : null, writeOffId, companyId]
        );

        let restoredLbs = 0;
        let restoredBoxes = 0;
        if (rmRows.length > 0) {
            const rm = rmRows[0];
            const maxLbs = parseFloat(rm.weight_lbs) || 0;
            const currentLbs = parseFloat(rm.stock_lbs) || 0;
            const nextLbs = maxLbs > 0 ? Math.min(maxLbs, round2(currentLbs + (parseFloat(wo.quantity_lbs) || 0))) : round2(currentLbs + (parseFloat(wo.quantity_lbs) || 0));

            const currentBoxes = parseInt(rm.total_boxes, 10) || 0;
            const addBoxes = parseInt(wo.boxes_count, 10) || 0;
            const maxBoxes = parseInt(rm.initial_boxes, 10) || 0;
            const nextBoxes = maxBoxes > 0 ? Math.min(maxBoxes, currentBoxes + addBoxes) : (currentBoxes + addBoxes);

            await conn.query(
                'UPDATE egg_raw_materials SET stock_lbs = ?, total_boxes = ? WHERE id = ? AND company_id = ?',
                [nextLbs, nextBoxes, rm.id, companyId]
            );
            restoredLbs = nextLbs;
            restoredBoxes = nextBoxes;

            await conn.query(
                `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
                 VALUES (?, 'raw_material.tarima_writeoff_reverted', 'warning', ?, ?, ?)`,
                [
                    companyId,
                    `Reversión de baja #${writeOffId} (${wo.boxes_count} cajas / ${wo.quantity_lbs} lbs) devueltas al lote ${rm.provider_lot || '#' + rm.id}.`,
                    JSON.stringify({ writeoff_id: writeOffId, raw_material_id: rm.id, revert_reason: revertReason || null }),
                    operatorName
                ]
            );
        }

        await conn.commit();
        return {
            id: writeOffId,
            status: 'revertido',
            restored_lot_stock_lbs: restoredLbs,
            restored_lot_boxes: restoredBoxes
        };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

module.exports = {
    ensureWriteOffSchema,
    getConsumedWriteOffsByCompany,
    getProductionConsumptionByCompany,
    computeLotTarimaAvailability,
    searchAvailableInvoices,
    listWriteOffs,
    createWriteOff,
    revertWriteOff
};
