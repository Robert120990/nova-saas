const pool = require('../config/db');

/**
 * Servicio centralizado para el Control de Envases Retornables (Cubetas y Tapaderas)
 * y generación de Estados de Cuenta por Cliente con soporte para presentaciones 30 LB y 32 LB.
 */

/**
 * Analiza un ítem de venta para determinar si corresponde a una cubeta retornable,
 * su cantidad y la presentación de peso (30 LB vs 32 LB).
 */
function parseCubetaItem(item) {
    if (!item) return { isCubeta: false, units: 0, weightType: null, productName: '' };

    const desc = (item.descripcion || item.product_name || item.nombre || '').toLowerCase();
    const origName = item.descripcion || item.product_name || item.nombre || '';

    // Descartar lubricantes / aceites automotrices que vienen en cubeta
    if (/(puma|aceite|lubricant|20w50|15w40|25w50|25w60|super hd|maxxima|valvulina)/i.test(desc)) {
        return { isCubeta: false, units: 0, weightType: null, productName: '' };
    }

    // Determinar presentación de peso (30 LB vs 32 LB)
    let weightType = '30 LB'; // Estándar por defecto
    if (/(32\s*\.?\s*lb|32lb)/i.test(desc)) {
        weightType = '32 LB';
    } else if (/(30\s*\.?\s*lb|30lb)/i.test(desc)) {
        weightType = '30 LB';
    }

    if (item.is_returnable && item.returnable_units > 0) {
        return { 
            isCubeta: true, 
            units: parseInt(item.returnable_units, 10),
            weightType,
            productName: origName
        };
    }

    // Verificar si es cubeta de ovoproducto o huevo
    const hasCubetaWord = desc.includes('cubeta') || desc.includes('cbt') || desc.includes('cub.');
    const isEggProduct = /(huevo|yema|clara|ovoproducto|ppg|pasteurizad)/i.test(desc);

    if (hasCubetaWord || isEggProduct) {
        if (!hasCubetaWord && !item.is_returnable) {
            return { isCubeta: false, units: 0, weightType: null, productName: '' };
        }

        // 1. Extraer si la descripción tiene el formato "Cant: X Uds" (creado en despachos automáticos)
        const udsMatch = desc.match(/cant:\s*(\d+)\s*uds/i);
        if (udsMatch && udsMatch[1]) {
            return { 
                isCubeta: true, 
                units: parseInt(udsMatch[1], 10),
                weightType,
                productName: origName
            };
        }

        // 2. Si la cantidad registrada ya es entera y menor o igual a 500, y la presentación es cubeta
        const rawQty = parseFloat(item.cantidad || 0);
        if (rawQty > 0) {
            let calculatedUnits = Math.max(1, Math.round(rawQty));

            if (weightType === '30 LB') {
                if (rawQty > 100 && rawQty % 30 === 0) {
                    calculatedUnits = Math.round(rawQty / 30);
                }
            } else if (weightType === '32 LB') {
                if (rawQty > 100 && rawQty % 32 === 0) {
                    calculatedUnits = Math.round(rawQty / 32);
                }
            }

            return { 
                isCubeta: true, 
                units: calculatedUnits,
                weightType,
                productName: origName
            };
        }
    }

    return { isCubeta: false, units: 0, weightType: null, productName: '' };
}

/**
 * Registra automáticamente la entrega de cubetas y tapaderas al facturar una venta,
 * clasificando el peso entregado (30 LB vs 32 LB) y llevando el saldo físico unificado.
 */
async function recordSaleReturnables(dbConnection, saleData) {
    const conn = dbConnection || pool;
    const {
        company_id,
        customer_id,
        customer_name,
        sale_id,
        dte_type,
        numero_control,
        items,
        user_name,
        fecha_emision
    } = saleData;

    if (!company_id || !customer_id || !items || !Array.isArray(items) || items.length === 0) {
        return null;
    }

    // Calcular total de cubetas facturadas y desglose 30lb / 32lb
    let totalCubetas = 0;
    let cubetas30lb = 0;
    let cubetas32lb = 0;
    const itemsBreakdown = [];

    for (const it of items) {
        const parsed = parseCubetaItem(it);
        if (parsed.isCubeta && parsed.units > 0) {
            totalCubetas += parsed.units;
            if (parsed.weightType === '32 LB') {
                cubetas32lb += parsed.units;
            } else {
                cubetas30lb += parsed.units;
            }
            itemsBreakdown.push(`${parsed.units} cbt ${parsed.weightType}`);
        }
    }

    if (totalCubetas <= 0) {
        return null;
    }

    // Cada cubeta entregada va equipada con su tapadera hermética universal
    const totalTapaderas = totalCubetas;

    // Verificar si ya fue registrado previamente para este sale_id (idempotencia)
    if (sale_id) {
        const [existingMov] = await conn.query(
            `SELECT id FROM egg_returnable_movements 
             WHERE company_id = ? AND sale_id = ? LIMIT 1`,
            [company_id, sale_id]
        );
        if (existingMov && existingMov.length > 0) {
            // Actualizar si las columnas 30lb / 32lb estaban en 0
            await conn.query(
                `UPDATE egg_returnable_movements 
                 SET cubetas_30lb_qty = ?, cubetas_32lb_qty = ? 
                 WHERE id = ? AND cubetas_30lb_qty = 0 AND cubetas_32lb_qty = 0`,
                [cubetas30lb, cubetas32lb, existingMov[0].id]
            );
            return { skipped: true, reason: 'Sale already registered', movement_id: existingMov[0].id };
        }
    }

    // Obtener nombre del cliente si no viene
    let resolvedCustomerName = customer_name;
    if (!resolvedCustomerName) {
        const [custRows] = await conn.query(
            'SELECT nombre FROM customers WHERE id = ? LIMIT 1',
            [customer_id]
        );
        resolvedCustomerName = custRows[0]?.nombre || `Cliente #${customer_id}`;
    }

    // Buscar o crear registro en egg_returnable_packaging
    const [retRows] = await conn.query(
        `SELECT id FROM egg_returnable_packaging 
         WHERE company_id = ? AND customer_id = ? AND packaging_type = 'cubeta_30lb'
         LIMIT 1`,
        [company_id, customer_id]
    );

    let returnableId = retRows[0]?.id;
    if (!returnableId) {
        const [newRet] = await conn.query(
            `INSERT INTO egg_returnable_packaging 
             (company_id, customer_id, customer_name, packaging_type, initial_balance, initial_tapaderas, notes)
             VALUES (?, ?, ?, 'cubeta_30lb', 0, 0, 'Auto-creado desde Facturación DTE')`,
            [company_id, customer_id, resolvedCustomerName]
        );
        returnableId = newRet.insertId;
    }

    // Formatear documento de referencia
    const refDoc = numero_control 
        ? `${numero_control}` 
        : `DTE-${dte_type || '01'} / Venta #${sale_id}`;

    const movDate = fecha_emision ? new Date(fecha_emision) : new Date();

    const detailText = itemsBreakdown.length > 0 ? ` [${itemsBreakdown.join(', ')}]` : '';
    const notesText = `Facturación automática de ${totalCubetas} cubeta(s) con tapadera hermética${detailText}`;

    // Insertar movimiento detallado con 30lb y 32lb
    const [movResult] = await conn.query(
        `INSERT INTO egg_returnable_movements 
         (company_id, returnable_id, sale_id, movement_type, quantity, cubetas_qty, cubetas_30lb_qty, cubetas_32lb_qty, tapaderas_qty, movement_date, reference_document, notes, registered_by)
         VALUES (?, ?, ?, 'entrega', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            company_id,
            returnableId,
            sale_id || null,
            totalCubetas,
            totalCubetas,
            cubetas30lb,
            cubetas32lb,
            totalTapaderas,
            movDate,
            refDoc,
            notesText,
            user_name || 'Facturación Automática'
        ]
    );

    // Actualizar saldos del cliente
    await conn.query(
        `UPDATE egg_returnable_packaging 
         SET delivered_qty = delivered_qty + ?, 
             delivered_tapaderas = delivered_tapaderas + ?,
             last_movement_date = ?
         WHERE id = ? AND company_id = ?`,
        [totalCubetas, totalTapaderas, movDate, returnableId, company_id]
    );

    return {
        success: true,
        returnable_id: returnableId,
        movement_id: movResult.insertId,
        total_cubetas: totalCubetas,
        cubetas_30lb: cubetas30lb,
        cubetas_32lb: cubetas32lb,
        total_tapaderas: totalTapaderas
    };
}

/**
 * Sincroniza retroactivamente todas las ventas facturadas con cubetas
 * que aún no estén registradas en el control de envases retornables.
 */
async function syncHistoricalSales(company_id) {
    if (!company_id) return { syncedCount: 0, syncedCubetas: 0, customersUpdated: 0 };

    // Buscar ventas activas que tengan ítems con cubetas y cliente registrado
    const [salesRows] = await pool.query(
        `SELECT DISTINCT sh.id as sale_id, sh.company_id, sh.customer_id, 
                COALESCE(c.nombre, sh.cliente_nombre) as customer_name,
                sh.tipo_documento, sh.numero_control, sh.fecha_emision,
                u.nombre as user_name
         FROM sales_headers sh
         JOIN sales_items si ON sh.id = si.sale_id
         LEFT JOIN customers c ON sh.customer_id = c.id
         LEFT JOIN users u ON sh.seller_id = u.id
         WHERE sh.company_id = ? 
           AND sh.customer_id IS NOT NULL 
           AND sh.estado != 'ANULADA'
           AND (
               LOWER(si.descripcion) LIKE '%cubeta%' 
               OR si.product_id IN (
                   SELECT p.id FROM products p 
                   WHERE p.company_id = ? AND LOWER(p.nombre) LIKE '%cubeta%'
               )
           )
           AND sh.id NOT IN (
               SELECT erm.sale_id FROM egg_returnable_movements erm 
               WHERE erm.company_id = ? AND erm.sale_id IS NOT NULL
           )
         ORDER BY sh.fecha_emision ASC, sh.id ASC`,
        [company_id, company_id, company_id]
    );

    let syncedCount = 0;
    let syncedCubetas = 0;
    const affectedCustomers = new Set();

    for (const sale of salesRows) {
        // Obtener ítems de la venta
        const [items] = await pool.query(
            'SELECT * FROM sales_items WHERE sale_id = ?',
            [sale.sale_id]
        );

        const result = await recordSaleReturnables(pool, {
            company_id: sale.company_id,
            customer_id: sale.customer_id,
            customer_name: sale.customer_name,
            sale_id: sale.sale_id,
            dte_type: sale.tipo_documento,
            numero_control: sale.numero_control,
            items: items,
            user_name: sale.user_name || 'Sincronización Histórica',
            fecha_emision: sale.fecha_emision
        });

        if (result && result.success) {
            syncedCount++;
            syncedCubetas += result.total_cubetas;
            affectedCustomers.add(sale.customer_id);
        }
    }

    return {
        syncedCount,
        syncedCubetas,
        customersUpdated: affectedCustomers.size
    };
}

/**
 * Obtiene el Estado de Cuenta completo de Cubetas y Tapaderas para un cliente dado.
 * Calcula saldos acumulados paso a paso para auditoría tipo Kardex contable,
 * incluyendo el desglose histórico entregado en 30 LB y 32 LB.
 */
async function getCustomerStatement(company_id, returnableIdOrCustomerId) {
    // Buscar registro de packaging
    const [packRows] = await pool.query(
        `SELECT r.*, c.nombre as customer_full_name, c.telefono, c.direccion, c.nrc, c.nit, c.dias_credito
         FROM egg_returnable_packaging r
         LEFT JOIN customers c ON r.customer_id = c.id
         WHERE r.company_id = ? AND (r.id = ? OR r.customer_id = ?)
         LIMIT 1`,
        [company_id, returnableIdOrCustomerId, returnableIdOrCustomerId]
    );

    if (!packRows || packRows.length === 0) {
        return null;
    }

    const customerRecord = packRows[0];

    // Obtener movimientos ordenados cronológicamente
    const [movements] = await pool.query(
        `SELECT m.*, 
                sh.tipo_documento as dte_tipo, 
                sh.numero_control as dte_control,
                sh.codigo_generacion as dte_codigo
         FROM egg_returnable_movements m
         LEFT JOIN sales_headers sh ON m.sale_id = sh.id
         WHERE m.returnable_id = ? AND m.company_id = ?
         ORDER BY COALESCE(m.movement_date, DATE(m.created_at)) ASC, m.id ASC`,
        [customerRecord.id, company_id]
    );

    // Calcular saldos acumulados fila a fila
    let runningCubetas = customerRecord.initial_balance || 0;
    let runningTapaderas = customerRecord.initial_tapaderas || 0;
    let totalDelivered30lb = 0;
    let totalDelivered32lb = 0;

    const statementMovements = movements.map(m => {
        const cQty = parseInt(m.cubetas_qty || m.quantity || 0, 10);
        const tQty = parseInt(m.tapaderas_qty || m.quantity || 0, 10);
        let c30 = parseInt(m.cubetas_30lb_qty || 0, 10);
        let c32 = parseInt(m.cubetas_32lb_qty || 0, 10);

        if (m.movement_type === 'entrega') {
            // Deducción defensiva si estaban en 0
            if (c30 === 0 && c32 === 0 && cQty > 0) {
                if (/32\s*lb/i.test(m.notes || '')) {
                    c32 = cQty;
                } else {
                    c30 = cQty;
                }
            }
            totalDelivered30lb += c30;
            totalDelivered32lb += c32;
        }

        let cubetasIn = 0;
        let cubetasOut = 0;
        let tapaderasIn = 0;
        let tapaderasOut = 0;

        if (m.movement_type === 'entrega') {
            // Entrega al cliente: Aumenta la deuda del cliente con la planta
            cubetasIn = cQty;
            tapaderasIn = tQty;
            runningCubetas += cQty;
            runningTapaderas += tQty;
        } else if (m.movement_type === 'devolucion') {
            // Devolución a planta: Disminuye la deuda del cliente
            cubetasOut = cQty;
            tapaderasOut = tQty;
            runningCubetas -= cQty;
            runningTapaderas -= tQty;
        } else if (m.movement_type === 'ajuste') {
            // Ajuste (positivo o negativo)
            if (cQty >= 0) {
                cubetasIn = cQty;
                runningCubetas += cQty;
            } else {
                cubetasOut = Math.abs(cQty);
                runningCubetas -= Math.abs(cQty);
            }
            if (tQty >= 0) {
                tapaderasIn = tQty;
                runningTapaderas += tQty;
            } else {
                tapaderasOut = Math.abs(tQty);
                runningTapaderas -= Math.abs(tQty);
            }
        }

        return {
            id: m.id,
            movement_date: m.movement_date || m.created_at,
            movement_type: m.movement_type,
            reference_document: m.reference_document,
            sale_id: m.sale_id,
            dte_control: m.dte_control,
            cubetas_30lb: c30,
            cubetas_32lb: c32,
            cubetas_delivered: cubetasIn,
            cubetas_returned: cubetasOut,
            cubetas_balance: runningCubetas,
            tapaderas_delivered: tapaderasIn,
            tapaderas_returned: tapaderasOut,
            tapaderas_balance: runningTapaderas,
            difference_lids: runningCubetas - runningTapaderas,
            notes: m.notes,
            registered_by: m.registered_by
        };
    });

    const totalCubetasDelivered = customerRecord.delivered_qty || 0;
    const totalCubetasReturned = customerRecord.returned_qty || 0;
    const currentCubetas = customerRecord.current_balance || 0;

    const totalTapaderasDelivered = customerRecord.delivered_tapaderas || 0;
    const totalTapaderasReturned = customerRecord.returned_tapaderas || 0;
    const currentTapaderas = customerRecord.current_tapaderas || 0;

    const returnRateCubetas = totalCubetasDelivered > 0
        ? parseFloat(((totalCubetasReturned / totalCubetasDelivered) * 100).toFixed(1))
        : 100;

    const returnRateTapaderas = totalTapaderasDelivered > 0
        ? parseFloat(((totalTapaderasReturned / totalTapaderasDelivered) * 100).toFixed(1))
        : 100;

    return {
        customer: {
            id: customerRecord.id,
            customer_id: customerRecord.customer_id,
            customer_name: customerRecord.customer_full_name || customerRecord.customer_name,
            telefono: customerRecord.telefono,
            direccion: customerRecord.direccion,
            nrc: customerRecord.nrc,
            nit: customerRecord.nit,
            packaging_type: customerRecord.packaging_type,
            notes: customerRecord.notes,
            last_movement_date: customerRecord.last_movement_date
        },
        summary: {
            initial_cubetas: customerRecord.initial_balance || 0,
            delivered_cubetas: totalCubetasDelivered,
            returned_cubetas: totalCubetasReturned,
            current_cubetas: currentCubetas,

            delivered_cubetas_30lb: totalDelivered30lb,
            delivered_cubetas_32lb: totalDelivered32lb,

            initial_tapaderas: customerRecord.initial_tapaderas || 0,
            delivered_tapaderas: totalTapaderasDelivered,
            returned_tapaderas: totalTapaderasReturned,
            current_tapaderas: currentTapaderas,

            missing_tapaderas: Math.max(0, currentCubetas - currentTapaderas),
            return_rate_cubetas: returnRateCubetas,
            return_rate_tapaderas: returnRateTapaderas
        },
        movements: statementMovements
    };
}

module.exports = {
    parseCubetaItem,
    recordSaleReturnables,
    syncHistoricalSales,
    getCustomerStatement
};
