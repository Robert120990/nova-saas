const pool = require('../config/db');

/**
 * Retrieves the POS IDs configured as "Tienda" (Store).
 */
const getPuntosVentaTienda = async (companyId, branchId) => {
    let posIds = [];

    if (branchId && branchId !== 'all') {
        const [rows] = await pool.query(
            `SELECT setting_value FROM sales_settings 
             WHERE company_id = ? AND branch_id = ? AND setting_key = 'puntos_venta_tienda'`,
            [companyId, branchId]
        );
        if (rows.length && rows[0].setting_value) {
            try {
                const parsed = JSON.parse(rows[0].setting_value);
                if (Array.isArray(parsed)) posIds = parsed.map(Number).filter(id => !isNaN(id) && id > 0);
            } catch (e) {}
        }
    }

    if (posIds.length === 0) {
        const [settingsRows] = await pool.query(
            `SELECT setting_value FROM sales_settings 
             WHERE company_id = ? AND setting_key = 'puntos_venta_tienda'`,
            [companyId]
        );
        for (const s of settingsRows) {
            try {
                const parsed = JSON.parse(s.setting_value);
                if (Array.isArray(parsed)) posIds.push(...parsed.map(Number).filter(id => !isNaN(id) && id > 0));
            } catch (e) {}
        }
    }

    // Fallback: search by name in points_of_sale
    if (posIds.length === 0) {
        const [fallbackRows] = await pool.query(
            `SELECT id FROM points_of_sale 
             WHERE company_id = ? AND (LOWER(nombre) LIKE '%tienda%' OR LOWER(nombre) LIKE '%super%')`,
            [companyId]
        );
        posIds = fallbackRows.map(r => r.id);
    }

    return [...new Set(posIds)];
};

/**
 * Fetches and groups store sales grouped by shift and POS terminal.
 */
const fetchStoreSalesByShiftData = async (companyId, branchId, startDate, endDate, shiftId = null) => {
    const posIds = await getPuntosVentaTienda(companyId, branchId);

    if (posIds.length === 0) {
        return {
            posIds: [],
            posGroups: [],
            totals: { count: 0, total_contado: 0, total_credito: 0, grand_total: 0 }
        };
    }

    // 1. Query shifts in the period
    let shiftSql = `
        SELECT 
            ps.id AS shift_id,
            ps.shift_number,
            ps.shift_date,
            ps.start_time,
            ps.end_time,
            ps.status,
            ps.opening_balance,
            ps.cash_sales,
            ps.card_sales,
            ps.total_sales,
            ps.pos_id,
            p.nombre AS pos_name,
            ps.branch_id,
            b.nombre AS branch_name,
            ps.seller_id,
            sel.nombre AS seller_name
        FROM pos_shifts ps
        JOIN points_of_sale p ON ps.pos_id = p.id
        JOIN branches b ON ps.branch_id = b.id
        LEFT JOIN sellers sel ON ps.seller_id = sel.id
        WHERE ps.company_id = ?
          AND ps.pos_id IN (?)
    `;
    const shiftParams = [companyId, posIds];

    if (shiftId) {
        shiftSql += ` AND ps.id = ?`;
        shiftParams.push(shiftId);
    } else {
        if (startDate && endDate) {
            shiftSql += ` AND ps.start_time BETWEEN ? AND ?`;
            shiftParams.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
        }
        if (branchId && branchId !== 'all') {
            shiftSql += ` AND ps.branch_id = ?`;
            shiftParams.push(branchId);
        }
    }

    shiftSql += ` ORDER BY p.nombre ASC, ps.start_time ASC, ps.id ASC`;

    const [shifts] = await pool.query(shiftSql, shiftParams);

    if (shifts.length === 0) {
        return {
            posIds,
            posGroups: [],
            totals: { count: 0, total_contado: 0, total_credito: 0, grand_total: 0 }
        };
    }

    const shiftIds = shifts.map(s => s.shift_id);

    // 2. Query sales associated with these shifts
    const [sales] = await pool.query(`
        SELECT 
            h.id,
            h.shift_id,
            h.fecha_emision,
            h.hora_emision,
            h.created_at,
            h.tipo_documento,
            h.condicion_operacion,
            h.numero_control,
            h.codigo_generacion,
            COALESCE(c.nombre, h.cliente_nombre, 'Consumidor Final') AS cliente_nombre,
            COALESCE(c.nit, '') AS cliente_nit,
            COALESCE(c.nrc, '') AS cliente_nrc,
            COALESCE(s.nombre, 'Vendedor') AS vendedor_nombre,
            h.total_gravado,
            h.total_iva,
            h.total_pagar,
            d.numero_control AS dte_numero_control,
            d.codigo_generacion AS dte_codigo_generacion
        FROM sales_headers h
        LEFT JOIN customers c ON h.customer_id = c.id
        LEFT JOIN sellers s ON h.seller_id = s.id
        LEFT JOIN dtes d ON h.id = d.venta_id
        WHERE h.company_id = ?
          AND h.shift_id IN (?)
          AND LOWER(h.estado) = 'emitido'
          AND (d.status IS NULL OR d.status != 'INVALIDADO')
        ORDER BY h.shift_id ASC, h.id ASC
    `, [companyId, shiftIds]);

    // Index sales by shift_id
    const salesByShift = {};
    for (const sale of sales) {
        if (!salesByShift[sale.shift_id]) salesByShift[sale.shift_id] = [];
        salesByShift[sale.shift_id].push(sale);
    }

    // 3. Group by POS and Shift
    const posMap = {};
    let overallCount = 0;
    let overallContado = 0;
    let overallCredito = 0;
    let overallGrandTotal = 0;

    for (const shift of shifts) {
        const posId = shift.pos_id;
        if (!posMap[posId]) {
            posMap[posId] = {
                pos_id: posId,
                pos_name: shift.pos_name,
                branch_name: shift.branch_name,
                total_pos: 0,
                total_contado: 0,
                total_credito: 0,
                sales_count: 0,
                shifts: []
            };
        }

        const shiftSales = salesByShift[shift.shift_id] || [];
        let shiftContado = 0;
        let shiftCredito = 0;
        let shiftTotal = 0;

        shiftSales.forEach(s => {
            const amount = parseFloat(s.total_pagar || 0);
            shiftTotal += amount;
            if (s.condicion_operacion === 1) {
                shiftContado += amount;
            } else {
                shiftCredito += amount;
            }
        });

        posMap[posId].total_pos += shiftTotal;
        posMap[posId].total_contado += shiftContado;
        posMap[posId].total_credito += shiftCredito;
        posMap[posId].sales_count += shiftSales.length;

        overallCount += shiftSales.length;
        overallContado += shiftContado;
        overallCredito += shiftCredito;
        overallGrandTotal += shiftTotal;

        posMap[posId].shifts.push({
            ...shift,
            sales: shiftSales,
            total_shift: shiftTotal,
            total_contado: shiftContado,
            total_credito: shiftCredito,
            sales_count: shiftSales.length
        });
    }

    return {
        posIds,
        posGroups: Object.values(posMap),
        totals: {
            count: overallCount,
            total_contado: overallContado,
            total_credito: overallCredito,
            grand_total: overallGrandTotal
        }
    };
};

module.exports = {
    getPuntosVentaTienda,
    fetchStoreSalesByShiftData
};
