const pool = require('../config/db');
const pdfService = require('../services/pdf.service');
const excelService = require('../services/excel.service');

/**
 * Gestión de Turnos de Punto de Venta (Corte de Caja)
 */

const getConflictSellers = async (companyId, sellerIds, excludeShiftId = null) => {
    if (!sellerIds || sellerIds.length === 0) return [];
    const ids = sellerIds.map(Number).filter(Boolean);
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const excludeClause = excludeShiftId ? 'AND ps.id <> ?' : '';
    const query = `
        SELECT DISTINCT seller_id
        FROM (
            SELECT pss.seller_id
            FROM pos_shift_sellers pss
            JOIN pos_shifts ps ON ps.id = pss.shift_id
            WHERE ps.company_id = ? AND ps.status = 'open'
              ${excludeClause}
              AND pss.seller_id IN (${placeholders})
            UNION
            SELECT ps.seller_id
            FROM pos_shifts ps
            WHERE ps.company_id = ? AND ps.status = 'open'
              ${excludeClause}
              AND ps.seller_id IN (${placeholders})
        ) t
    `;
    const params = [
        companyId,
        ...(excludeShiftId ? [excludeShiftId] : []),
        ...ids,
        companyId,
        ...(excludeShiftId ? [excludeShiftId] : []),
        ...ids
    ];
    const [rows] = await pool.query(query, params);
    return rows.map(r => r.seller_id);
};

const getSellerNames = async (sellerIds) => {
    if (!sellerIds || sellerIds.length === 0) return [];
    const [rows] = await pool.query(
        'SELECT id, nombre FROM sellers WHERE id IN (?)',
        [sellerIds]
    );
    return rows;
};

const assertNoSellerConflicts = async (companyId, sellerIds, excludeShiftId = null) => {
    const conflicts = await getConflictSellers(companyId, sellerIds, excludeShiftId);
    if (conflicts.length === 0) return;
    const names = await getSellerNames(conflicts);
    const nameList = names.map(n => n.nombre).join(', ');
    const err = new Error(`Los vendedores ya asignados a otro turno activo no pueden seleccionarse: ${nameList}`);
    err.status = 400;
    throw err;
};

const getCurrentShift = async (req, res) => {
    const { pos_id, seller_id, branch_id } = req.query;
    try {
        let query = `
            SELECT s.*, sel.nombre as seller_name, p.nombre as pos_name
            FROM pos_shifts s
            LEFT JOIN sellers sel ON s.seller_id = sel.id
            LEFT JOIN points_of_sale p ON s.pos_id = p.id
            WHERE s.company_id = ? AND s.status = 'open'
        `;
        const params = [req.company_id];

        if (pos_id && pos_id !== 'undefined') {
            query += ` AND s.pos_id = ?`;
            params.push(pos_id);
        }

        if (branch_id && branch_id !== 'undefined') {
            query += ` AND s.branch_id = ?`;
            params.push(branch_id);
        }

        query += ` ORDER BY s.start_time DESC`;

        const [shifts] = await pool.query(query, params);

        if (shifts.length === 0) {
            return res.json({ open: false });
        }

        // Si se pidió un POS específico, devolver solo ese turno
        if (pos_id && pos_id !== 'undefined') {
            const shift = shifts[0];
            // Si también se envió seller_id, verificar si está asignado
            if (seller_id && seller_id !== 'undefined') {
                const [assigned] = await pool.query(`
                    SELECT id FROM pos_shift_sellers
                    WHERE shift_id = ? AND seller_id = ?
                `, [shift.id, seller_id]);
                const isAssigned = assigned.length > 0;
                if (!isAssigned) {
                    const [resp] = await pool.query(`
                        SELECT sel.nombre as responsable_name
                        FROM sellers sel
                        WHERE sel.id = ?
                    `, [shift.seller_id]);
                    return res.json({
                        open: true,
                        shift,
                        isAssigned: false,
                        responsable_name: resp[0]?.responsable_name || shift.seller_name
                    });
                }
                return res.json({ open: true, shift, isAssigned: true });
            }
            return res.json({ open: true, shift });
        }

        // Sin POS específico: devolver todos los turnos abiertos
        res.json({ open: true, shifts });
    } catch (error) {
        console.error('Error in getCurrentShift:', error);
        res.status(500).json({ message: 'Error al verificar turno' });
    }
};

const openShift = async (req, res) => {
    const { pos_id, branch_id, seller_id, opening_balance, assigned_sellers } = req.body;
    
    try {
        // Verificar si ya hay uno abierto
        const [existing] = await pool.query(`
            SELECT id FROM pos_shifts 
            WHERE company_id = ? AND pos_id = ? AND status = 'open'
        `, [req.company_id, pos_id]);

        if (existing.length > 0) {
            return res.status(400).json({ message: 'Ya existe un turno abierto para este punto de venta' });
        }

        // Insertar responsable + vendedores adicionales en pos_shift_sellers
        const sellerIds = [seller_id];
        if (assigned_sellers && Array.isArray(assigned_sellers)) {
            for (const sid of assigned_sellers) {
                const id = Number(sid);
                if (id && !sellerIds.includes(id)) {
                    sellerIds.push(id);
                }
            }
        }

        // Validar que ningún vendedor esté asignado a otro turno activo
        try {
            await assertNoSellerConflicts(req.company_id, sellerIds);
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }

        // Calcular siguiente shift_number por sucursal + fecha
        const [numRow] = await pool.query(`
            SELECT COALESCE(MAX(shift_number), 0) + 1 AS next
            FROM pos_shifts
            WHERE company_id = ? AND pos_id = ? AND shift_date = CURDATE()
        `, [req.company_id, pos_id]);

        const shiftNumber = numRow[0].next;

        const [result] = await pool.query(`
            INSERT INTO pos_shifts (company_id, branch_id, pos_id, seller_id, start_time, shift_date, shift_number, opening_balance, status)
            VALUES (?, ?, ?, ?, NOW(), CURDATE(), ?, ?, 'open')
        `, [req.company_id, branch_id, pos_id, seller_id, shiftNumber, opening_balance || 0]);

        const shiftId = result.insertId;

        for (const sid of sellerIds) {
            await pool.query(`
                INSERT IGNORE INTO pos_shift_sellers (shift_id, seller_id)
                VALUES (?, ?)
            `, [shiftId, sid]);
        }

        const today = new Date().toISOString().split('T')[0];

        res.status(201).json({ 
            id: shiftId, 
            shift_id: shiftId,
            shift_number: shiftNumber,
            shift_date: today,
            assigned_count: sellerIds.length,
            message: 'Turno abierto exitosamente'
        });
    } catch (error) {
        console.error('Error in openShift:', error);
        res.status(500).json({ message: 'Error al abrir turno' });
    }
};

const getShiftSummary = async (req, res) => {    const { id } = req.params;
    console.log(`[DEBUG] getShiftSummary called for ID: ${id}`);
    try {
        // Obtener datos del turno con nombres
        const [shifts] = await pool.query(`
            SELECT ps.*, s.nombre as seller_name, p.nombre as pos_name, b.nombre as branch_name
            FROM pos_shifts ps
            LEFT JOIN sellers s ON ps.seller_id = s.id
            LEFT JOIN points_of_sale p ON ps.pos_id = p.id
            LEFT JOIN branches b ON ps.branch_id = b.id
            WHERE ps.id = ? AND ps.company_id = ?
        `, [id, req.company_id]);
        if (shifts.length === 0) {
            console.error(`[DEBUG] Shift ${id} not found for company ${req.company_id}`);
            return res.status(404).json({ message: 'Turno no encontrado' });
        }
        const shift = shifts[0];
        console.log(`[DEBUG] Found shift:`, JSON.stringify(shift));

        // Sumar ventas por método de pago con nombres reales.
        // sales_payments.monto para efectivo ('01') guarda el billete recibido (puede incluir vuelto),
        // por lo que se asigna por venta: no-cash conserva su monto exacto y efectivo recibe el
        // remanente de total_pagar (GREATEST(0, total_pagar - pagos no-cash)).
        const [salesByMethod] = await pool.query(`
            SELECT 
                a.metodo_pago as code, 
                cat.description as name, 
                SUM(CASE WHEN a.metodo_pago = '01' THEN GREATEST(0, COALESCE(a.total_pagar, 0) - a.non_cash) ELSE a.sum_monto END) as total
            FROM (
                SELECT 
                    h.id,
                    h.total_pagar,
                    h.non_cash,
                    p.metodo_pago,
                    SUM(p.monto) as sum_monto
                FROM (
                    SELECT 
                        h.id, 
                        h.total_pagar,
                        COALESCE(SUM(CASE WHEN p.metodo_pago != '01' THEN p.monto ELSE 0 END), 0) as non_cash
                    FROM sales_headers h
                    JOIN sales_payments p ON p.sale_id = h.id
                    WHERE h.shift_id = ? AND h.estado = 'emitido'
                    AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = h.id AND status = 'INVALIDADO')
                    GROUP BY h.id
                ) h
                JOIN sales_payments p ON p.sale_id = h.id
                GROUP BY h.id, h.total_pagar, h.non_cash, p.metodo_pago
            ) a
            LEFT JOIN cat_017_forma_pago cat ON a.metodo_pago COLLATE utf8mb4_unicode_ci = cat.code COLLATE utf8mb4_unicode_ci
            GROUP BY a.metodo_pago, cat.description
        `, [id]);
        console.log(`[DEBUG] Sales by Method:`, JSON.stringify(salesByMethod));

        // Obtener Gastos
        const [expenses] = await pool.query('SELECT description, amount FROM pos_shift_expenses WHERE shift_id = ?', [id]);
        
        // Obtener Ingresos
        const [incomes] = await pool.query(`
            SELECT i.description, i.amount, i.payment_method, cat.description as payment_method_name 
            FROM pos_shift_incomes i
            LEFT JOIN cat_017_forma_pago cat ON i.payment_method COLLATE utf8mb4_unicode_ci = cat.code COLLATE utf8mb4_unicode_ci
            WHERE i.shift_id = ?
         `, [id]);

        // Obtener Remesas
        const [remesas] = await pool.query('SELECT numero, description, amount FROM pos_shift_remesas WHERE shift_id = ? ORDER BY numero', [id]);

        // Obtener Canjes de Puntos
        const [puntos] = await pool.query('SELECT description, amount FROM pos_shift_puntos WHERE shift_id = ?', [id]);

        // Ventas por categoría de producto
        const [salesByCategory] = await pool.query(`
            SELECT 
                COALESCE(pc.name, 'Sin Categoría') as categoria,
                SUM(si.cantidad * si.precio_unitario) as total
            FROM sales_items si
            JOIN sales_headers h ON si.sale_id = h.id
            LEFT JOIN products p ON si.product_id = p.id
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            WHERE h.shift_id = ? AND h.estado = 'emitido'
            AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = h.id AND status = 'INVALIDADO')
            GROUP BY pc.name
            ORDER BY total DESC
        `, [id]);

        let totalSales = 0;
        let cashSales = 0;
        const methods = salesByMethod.map(m => {
            const total = parseFloat(m.total || 0);
            if (m.code === '01') cashSales = total;
            totalSales += total;
            return {
                code: m.code,
                name: m.name || `Método ${m.code}`,
                total: total
            };
        });

        const summary = {
            id: Number(shift.id),
            status: shift.status,
            pos_id: shift.pos_id,
            seller_name: shift.seller_name || 'Sin vendedor',
            pos_name: shift.pos_name || 'Sin terminal',
            branch_name: shift.branch_name || 'Sin sucursal',
            start_time: shift.start_time,
            end_time: shift.end_time || null,
            opening_balance: parseFloat(shift.opening_balance || 0),
            total_sales: totalSales,
            cash: cashSales,
            methods: methods,
            expenses: expenses.map(e => ({ description: e.description, amount: parseFloat(e.amount || 0) })),
            incomes: incomes.map(i => ({ description: i.description, amount: parseFloat(i.amount || 0), method: i.payment_method_name, payment_method: i.payment_method })),
            remesas: remesas.map(r => ({ numero: r.numero, description: r.description, amount: parseFloat(r.amount || 0) })),
            puntos: puntos.map(p => ({ description: p.description, amount: parseFloat(p.amount || 0) })),
            arqueado: shift.arqueado ? 1 : 0,
            total_expenses: parseFloat(shift.total_expenses || expenses.reduce((acc, e) => acc + parseFloat(e.amount || 0), 0)),
            total_incomes: parseFloat(shift.total_incomes || incomes.reduce((acc, i) => acc + parseFloat(i.amount || 0), 0)),
            total_remesas: parseFloat(shift.total_remesas || remesas.reduce((acc, r) => acc + parseFloat(r.amount || 0), 0)),
            total_puntos: parseFloat(shift.total_puntos || puntos.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0)),
            actual: parseFloat(shift.actual_cash || 0),
            expected: parseFloat(shift.expected_cash || (parseFloat(shift.opening_balance || 0) + cashSales)),
            difference: parseFloat(shift.difference || 0),
            salesByCategory: salesByCategory.map(c => ({
                categoria: c.categoria,
                total: parseFloat(c.total || 0)
            }))
        };

        summary.expected_cash = summary.opening_balance + summary.cash + summary.total_incomes - summary.total_expenses - summary.total_remesas - summary.total_puntos;

        console.log(`[DEBUG] Final Summary:`, JSON.stringify(summary));
        res.json(summary);
    } catch (error) {
        console.error('Error in getShiftSummary:', error);
        res.status(500).json({ message: 'Error al obtener resumen del turno', detail: error.message });
    }
};

// Guarda (o re-guarda) los datos del arqueo de un turno sin cambiar su estado.
// Se ejecuta en transacción: elimina gastos/ingresos/remesas previos y los re-inserta,
// recalculando el efectivo esperado, el contado y la diferencia.
const saveArqueoData = async (conn, shift, { actual_cash, expenses = [], incomes = [], remesas = [], puntos = [] }) => {
    const { id } = shift;

    // 1. Limpiar datos previos del arqueo (permite re-arqueo sin duplicados)
    await conn.query(`DELETE FROM pos_shift_expenses WHERE shift_id = ?`, [id]);
    await conn.query(`DELETE FROM pos_shift_incomes WHERE shift_id = ?`, [id]);
    await conn.query(`DELETE FROM pos_shift_remesas WHERE shift_id = ?`, [id]);
    await conn.query(`DELETE FROM pos_shift_puntos WHERE shift_id = ?`, [id]);

    // 2. Guardar gastos
    let totalExpenses = 0;
    for (const exp of expenses) {
        const amount = parseFloat(exp.amount || 0);
        if (amount > 0) {
            await conn.query(`
                INSERT INTO pos_shift_expenses (shift_id, description, amount)
                VALUES (?, ?, ?)
            `, [id, exp.description || 'Gasto operativo', amount]);
            totalExpenses += amount;
        }
    }

    // 3. Guardar otros ingresos
    let totalIncomes = 0;
    let cashIncomes = 0;
    for (const inc of incomes) {
        const amount = parseFloat(inc.amount || 0);
        if (amount > 0) {
            await conn.query(`
                INSERT INTO pos_shift_incomes (shift_id, description, amount, payment_method)
                VALUES (?, ?, ?, ?)
            `, [id, inc.description || 'Ingreso adicional', amount, inc.payment_method || '01']);

            totalIncomes += amount;
            if (inc.payment_method === '01') {
                cashIncomes += amount;
            }
        }
    }

    // 4. Guardar remesas
    let totalRemesas = 0;
    let remesaNum = 0;
    for (const rem of remesas) {
        const amount = parseFloat(rem.amount || 0);
        if (amount > 0) {
            remesaNum++;
            await conn.query(`
                INSERT INTO pos_shift_remesas (shift_id, numero, description, amount)
                VALUES (?, ?, ?, ?)
            `, [id, remesaNum, rem.description || 'Remesa', amount]);
            totalRemesas += amount;
        }
    }

    // 4b. Guardar canjes de puntos
    let totalPuntos = 0;
    for (const punto of puntos) {
        const amount = parseFloat(punto.amount || 0);
        if (amount > 0) {
            await conn.query(`
                INSERT INTO pos_shift_puntos (shift_id, description, amount)
                VALUES (?, ?, ?)
            `, [id, punto.description || 'Canje de puntos', amount]);
            totalPuntos += amount;
        }
    }

    // 5. Calcular totales de ventas del turno.
    // Misma asignación que getShiftSummary: efectivo = remanente de total_pagar por venta.
    const [salesTotals] = await conn.query(`
        SELECT 
            SUM(CASE WHEN a.metodo_pago = '01' THEN GREATEST(0, COALESCE(a.total_pagar, 0) - a.non_cash) ELSE 0 END) as cash,
            SUM(CASE WHEN a.metodo_pago = '01' THEN GREATEST(0, COALESCE(a.total_pagar, 0) - a.non_cash) ELSE a.sum_monto END) as total,
            SUM(CASE WHEN a.metodo_pago IN ('02', '03') THEN a.sum_monto ELSE 0 END) as card,
            SUM(CASE WHEN a.metodo_pago = '20' THEN a.sum_monto ELSE 0 END) as transfer,
            SUM(CASE WHEN a.metodo_pago NOT IN ('01', '02', '03', '20') THEN a.sum_monto ELSE 0 END) as other
        FROM (
            SELECT 
                h.id,
                h.total_pagar,
                h.non_cash,
                p.metodo_pago,
                SUM(p.monto) as sum_monto
            FROM (
                SELECT 
                    h.id, 
                    h.total_pagar,
                    COALESCE(SUM(CASE WHEN p.metodo_pago != '01' THEN p.monto ELSE 0 END), 0) as non_cash
                FROM sales_headers h
                JOIN sales_payments p ON p.sale_id = h.id
                WHERE h.shift_id = ? AND h.estado = 'emitido'
                AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = h.id AND status = 'INVALIDADO')
                GROUP BY h.id
            ) h
            JOIN sales_payments p ON p.sale_id = h.id
            GROUP BY h.id, h.total_pagar, h.non_cash, p.metodo_pago
        ) a
    `, [id]);

    const totals = salesTotals[0];
    const cashSales = parseFloat(totals.cash || 0);
    const cardSales = parseFloat(totals.card || 0);
    const transferSales = parseFloat(totals.transfer || 0);
    const otherSales = parseFloat(totals.other || 0);

    // EFECTIVO ESPERADO = (FONDO + VENTAS CASH + INGRESOS CASH) - GASTOS - REMESAS - PUNTOS
    const expectedCash = parseFloat(shift.opening_balance) + cashSales + cashIncomes - totalExpenses - totalRemesas - totalPuntos;
    const actualCash = parseFloat(actual_cash || 0);
    const difference = actualCash - expectedCash;

    await conn.query(`
        UPDATE pos_shifts SET 
            expected_cash = ?,
            actual_cash = ?,
            difference = ?,
            cash_sales = ?,
            card_sales = ?,
            transfer_sales = ?,
            other_sales = ?,
            total_sales = ?,
            total_expenses = ?,
            total_incomes = ?,
            total_remesas = ?,
            total_puntos = ?,
            arqueado = 1
        WHERE id = ?
    `, [
        expectedCash,
        actualCash,
        difference,
        cashSales,
        cardSales,
        transferSales,
        otherSales,
        parseFloat(totals.total || 0),
        totalExpenses,
        totalIncomes,
        totalRemesas,
        totalPuntos,
        id
    ]);

    return { expectedCash, actualCash, difference, cardSales, transferSales, otherSales, totalExpenses, totalIncomes, totalRemesas, totalPuntos };
};

const saveArqueo = async (req, res) => {
    const { id } = req.params;
    const { actual_cash, expenses = [], incomes = [], remesas = [], puntos = [] } = req.body;

    try {
        const [shifts] = await pool.query('SELECT * FROM pos_shifts WHERE id = ? AND company_id = ?', [id, req.company_id]);
        if (shifts.length === 0) return res.status(404).json({ message: 'Turno no encontrado' });

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const result = await saveArqueoData(conn, shifts[0], { actual_cash, expenses, incomes, remesas, puntos });
            await conn.commit();
            res.json({ message: 'Arqueo guardado correctamente', summary: result });
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error in saveArqueo:', error);
        res.status(500).json({ message: 'Error al guardar arqueo' });
    }
};

const closeShift = async (req, res) => {
    const { id } = req.params;
    const { actual_cash, expenses = [], incomes = [], remesas = [], puntos = [] } = req.body;

    try {
        // Obtener resumen actual
        const [shifts] = await pool.query('SELECT * FROM pos_shifts WHERE id = ? AND company_id = ?', [id, req.company_id]);
        if (shifts.length === 0) return res.status(404).json({ message: 'Turno no encontrado' });
        const shift = shifts[0];

        if (shift.status === 'closed') return res.status(400).json({ message: 'El turno ya se encuentra cerrado' });

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            // Si vienen datos de arqueo, guardarlos antes de finalizar
            let summary = null;
            const hasArqueoData = actual_cash !== undefined && actual_cash !== null && actual_cash !== '';
            if (hasArqueoData) {
                summary = await saveArqueoData(conn, shift, { actual_cash, expenses, incomes, remesas, puntos });
            }

            // Finalizar el turno (el arqueo no es requisito)
            await conn.query(
                `UPDATE pos_shifts SET end_time = NOW(), status = 'closed' WHERE id = ?`,
                [id]
            );

            await conn.commit();

            if (!summary) {
                const [updated] = await pool.query('SELECT * FROM pos_shifts WHERE id = ?', [id]);
                const s = updated[0];
                summary = {
                    expectedCash: parseFloat(s.expected_cash || 0),
                    actualCash: parseFloat(s.actual_cash || 0),
                    difference: parseFloat(s.difference || 0),
                    totalExpenses: parseFloat(s.total_expenses || 0),
                    totalIncomes: parseFloat(s.total_incomes || 0),
                    totalRemesas: parseFloat(s.total_remesas || 0),
                    totalPuntos: parseFloat(s.total_puntos || 0)
                };
            }

            res.json({
                message: 'Turno finalizado correctamente',
                summary: {
                    expected: summary.expectedCash,
                    actual: summary.actualCash,
                    difference: summary.difference,
                    expenses: summary.totalExpenses,
                    incomes: summary.totalIncomes,
                    remesas: summary.totalRemesas,
                    puntos: summary.totalPuntos
                }
            });
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error in closeShift:', error);
        res.status(500).json({ message: 'Error al cerrar turno' });
    }
};

const getShiftsHistory = async (req, res) => {
    const { branch_id, seller_id, status, search, start_date, end_date, page = 1, limit = 15 } = req.query;
    try {
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 15));
        const offset = (pageNum - 1) * limitNum;

        let countSql = `
            SELECT COUNT(*) as total
            FROM pos_shifts s
            JOIN sellers sel ON s.seller_id = sel.id
            JOIN points_of_sale p ON s.pos_id = p.id
            JOIN branches b ON s.branch_id = b.id
            WHERE s.company_id = ?
        `;
        let dataSql = `
            SELECT s.*, 
                COALESCE(sales.total, s.total_sales, 0) as total_sales,
                COALESCE(sales.cash_sales, s.cash_sales, 0) as cash_sales,
                COALESCE(sales.card_sales, s.card_sales, 0) as card_sales,
                COALESCE(sales.transfer_sales, s.transfer_sales, 0) as transfer_sales,
                COALESCE(sales.other_sales, s.other_sales, 0) as other_sales,
                sel.nombre as seller_name, p.nombre as pos_name, b.nombre as branch_name
            FROM pos_shifts s
            JOIN sellers sel ON s.seller_id = sel.id
            JOIN points_of_sale p ON s.pos_id = p.id
            JOIN branches b ON s.branch_id = b.id
            LEFT JOIN (
                SELECT 
                    b.shift_id,
                    SUM(CASE WHEN b.metodo_pago = '01' THEN GREATEST(0, COALESCE(b.total_pagar, 0) - b.non_cash) ELSE b.sum_monto END) as total,
                    SUM(CASE WHEN b.metodo_pago = '01' THEN GREATEST(0, COALESCE(b.total_pagar, 0) - b.non_cash) ELSE 0 END) as cash_sales,
                    SUM(CASE WHEN b.metodo_pago IN ('02', '03') THEN b.sum_monto ELSE 0 END) as card_sales,
                    SUM(CASE WHEN b.metodo_pago = '20' THEN b.sum_monto ELSE 0 END) as transfer_sales,
                    SUM(CASE WHEN b.metodo_pago NOT IN ('01', '02', '03', '20') THEN b.sum_monto ELSE 0 END) as other_sales
                FROM (
                    SELECT 
                        h.shift_id,
                        h.total_pagar,
                        h.non_cash,
                        p.metodo_pago,
                        SUM(p.monto) as sum_monto
                    FROM (
                        SELECT 
                            h.id, 
                            h.shift_id,
                            h.total_pagar,
                            COALESCE(SUM(CASE WHEN p.metodo_pago != '01' THEN p.monto ELSE 0 END), 0) as non_cash
                        FROM sales_headers h
                        JOIN sales_payments p ON p.sale_id = h.id
                        WHERE h.estado = 'emitido'
                        AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = h.id AND status = 'INVALIDADO')
                        GROUP BY h.id
                    ) h
                    JOIN sales_payments p ON p.sale_id = h.id
                    GROUP BY h.id, h.shift_id, h.total_pagar, h.non_cash, p.metodo_pago
                ) b
                GROUP BY b.shift_id
            ) sales ON sales.shift_id = s.id
            WHERE s.company_id = ?
        `;
        const params = [req.company_id];

        if (branch_id) {
            countSql += ` AND s.branch_id = ?`;
            dataSql += ` AND s.branch_id = ?`;
            params.push(branch_id);
        }
        if (seller_id) {
            countSql += ` AND s.seller_id = ?`;
            dataSql += ` AND s.seller_id = ?`;
            params.push(seller_id);
        }
        if (status) {
            countSql += ` AND s.status = ?`;
            dataSql += ` AND s.status = ?`;
            params.push(status);
        }
        if (search) {
            countSql += ` AND (sel.nombre LIKE ? OR p.nombre LIKE ?)`;
            dataSql += ` AND (sel.nombre LIKE ? OR p.nombre LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }
        if (start_date) {
            countSql += ` AND s.start_time >= ?`;
            dataSql += ` AND s.start_time >= ?`;
            params.push(`${start_date} 00:00:00`);
        }
        if (end_date) {
            countSql += ` AND s.start_time <= ?`;
            dataSql += ` AND s.start_time <= ?`;
            params.push(`${end_date} 23:59:59`);
        }

        dataSql += ` ORDER BY s.start_time DESC LIMIT ? OFFSET ?`;
        const dataParams = [...params, limitNum, offset];

        const [[{ total }]] = await pool.query(countSql, params);
        const [rows] = await pool.query(dataSql, dataParams);
        const totalPages = Math.ceil(total / limitNum);

        res.json({ data: rows, total, page: pageNum, totalPages });
    } catch (error) {
        console.error('Error in getShiftsHistory:', error);
        res.status(500).json({ message: 'Error al obtener historial de turnos' });
    }
};

const exportArqueosPDF = async (req, res) => {
    try {
        const { start_date, end_date, branch_id, pos_ids } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });
        if (!start_date || !end_date) return res.status(400).json({ message: 'Rango de fechas es requerido' });

        const [companyRows] = await pool.query('SELECT razon_social, nit FROM companies WHERE id = ?', [companyId]);
        const company = companyRows[0] || { razon_social: 'EMPRESA', nit: '' };

        let branchName = 'Todas las sucursales';
        if (branch_id && branch_id !== 'all') {
            const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (branchRows.length > 0) branchName = branchRows[0].nombre;
        }

        let sql = `
            SELECT
                s.id,
                s.shift_number,
                s.start_time,
                s.end_time,
                s.status,
                s.arqueado,
                s.opening_balance,
                s.total_sales,
                s.cash_sales,
                s.card_sales,
                s.transfer_sales,
                s.other_sales,
                s.total_incomes,
                s.total_expenses,
                s.total_remesas,
                s.total_puntos,
                s.expected_cash,
                s.actual_cash,
                s.difference,
                sel.nombre as seller_name,
                p.nombre as pos_name,
                b.nombre as branch_name
            FROM pos_shifts s
            JOIN sellers sel ON s.seller_id = sel.id
            JOIN points_of_sale p ON s.pos_id = p.id
            JOIN branches b ON s.branch_id = b.id
            WHERE s.company_id = ?
        `;
        const params = [companyId];
        sql += ' AND s.start_time BETWEEN ? AND ?';
        params.push(`${start_date} 00:00:00`, `${end_date} 23:59:59`);
        if (branch_id && branch_id !== 'all') {
            sql += ' AND s.branch_id = ?';
            params.push(branch_id);
        }
        if (pos_ids) {
            const ids = pos_ids.split(',').map(n => parseInt(n, 10)).filter(n => Number.isInteger(n) && n > 0);
            if (ids.length > 0) sql += ` AND s.pos_id IN (${ids.join(',')})`;
        }
        sql += ' ORDER BY s.start_time ASC, s.id ASC';

        const [rows] = await pool.query(sql, params);

        const num = (v) => parseFloat(v || 0);
        const mapRow = (r) => {
            const start = r.start_time ? new Date(r.start_time) : null;
            const end = r.end_time ? new Date(r.end_time) : null;
            return {
                fecha: start ? `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}/${start.getFullYear()}` : '---',
                hora_inicio: start ? `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}` : '',
                hora_fin: end ? `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}` : '',
                turno: r.shift_number != null ? `#${r.shift_number}` : '---',
                sucursal: r.branch_name || '---',
                pos: r.pos_name || '---',
                vendedor: r.seller_name || '---',
                estado: r.arqueado ? 'Arqueado' : r.status === 'open' ? 'Abierto' : 'Cerrado',
                fondo: num(r.opening_balance),
                ventas: num(r.total_sales),
                ingresos: num(r.total_incomes),
                gastos: num(r.total_expenses),
                remesas: num(r.total_remesas),
                puntos: num(r.total_puntos),
                esperado: num(r.expected_cash),
                contado: num(r.actual_cash),
                diferencia: num(r.difference),
            };
        };

        const mappedRows = rows.map(mapRow);

        const reportData = {
            company_name: company.razon_social,
            company_nit: company.nit,
            branch_name: branchName,
            start_date,
            end_date,
            data: mappedRows,
            totales: {
                fondo: mappedRows.reduce((s, r) => s + r.fondo, 0),
                ventas: mappedRows.reduce((s, r) => s + r.ventas, 0),
                ingresos: mappedRows.reduce((s, r) => s + r.ingresos, 0),
                gastos: mappedRows.reduce((s, r) => s + r.gastos, 0),
                remesas: mappedRows.reduce((s, r) => s + r.remesas, 0),
                puntos: mappedRows.reduce((s, r) => s + r.puntos, 0),
                esperado: mappedRows.reduce((s, r) => s + r.esperado, 0),
                contado: mappedRows.reduce((s, r) => s + r.contado, 0),
                diferencia: mappedRows.reduce((s, r) => s + r.diferencia, 0),
            }
        };

        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                title: `Reporte de Arqueos ${start_date} al ${end_date}`,
                sheets: [{
                    name: 'Arqueos',
                    columns: [
                        { header: 'Fecha', key: 'fecha', width: 16 },
                        { header: 'Turno', key: 'turno', width: 10 },
                        { header: 'Sucursal', key: 'sucursal', width: 24 },
                        { header: 'POS', key: 'pos', width: 20 },
                        { header: 'Vendedor', key: 'vendedor', width: 22 },
                        { header: 'Estado', key: 'estado', width: 12 },
                        { header: 'Fondo', key: 'fondo', width: 12 },
                        { header: 'Ventas', key: 'ventas', width: 12 },
                        { header: 'Ingresos', key: 'ingresos', width: 12 },
                        { header: 'Gastos', key: 'gastos', width: 12 },
                        { header: 'Remesas', key: 'remesas', width: 12 },
                        { header: 'Puntos', key: 'puntos', width: 12 },
                        { header: 'Efectivo Esperado', key: 'esperado', width: 16 },
                        { header: 'Efectivo Contado', key: 'contado', width: 16 },
                        { header: 'Diferencia', key: 'diferencia', width: 14 },
                    ],
                    data: mappedRows.map(r => ({
                        ...r,
                        fondo: r.fondo.toFixed(2),
                        ventas: r.ventas.toFixed(2),
                        ingresos: r.ingresos.toFixed(2),
                        gastos: r.gastos.toFixed(2),
                        remesas: r.remesas.toFixed(2),
                        puntos: r.puntos.toFixed(2),
                        esperado: r.esperado.toFixed(2),
                        contado: r.contado.toFixed(2),
                        diferencia: r.diferencia.toFixed(2),
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Reporte_Arqueos_${start_date}_al_${end_date}.xlsx`);
        }

        const pdfBuffer = await pdfService.generateArqueosReportPDF(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Reporte_Arqueos_${start_date}_al_${end_date}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error in exportArqueosPDF:', error);
        res.status(500).json({ message: 'Error al generar reporte de arqueos' });
    }
};

const getShiftSellers = async (req, res) => {
    const { id } = req.params;
    try {
        const [shift] = await pool.query(
            'SELECT seller_id FROM pos_shifts WHERE id = ? AND company_id = ?',
            [id, req.company_id]
        );
        if (shift.length === 0) {
            return res.status(404).json({ message: 'Turno no encontrado' });
        }

        const [rows] = await pool.query(`
            SELECT pss.id, pss.seller_id, sel.nombre as seller_name, pss.assigned_at
            FROM pos_shift_sellers pss
            JOIN sellers sel ON pss.seller_id = sel.id
            WHERE pss.shift_id = ?
            ORDER BY pss.id
        `, [id]);

        const responsableId = shift[0].seller_id;
        const sellers = rows.map(r => ({
            ...r,
            isResponsable: r.seller_id === responsableId
        }));

        res.json(sellers);
    } catch (error) {
        console.error('Error in getShiftSellers:', error);
        res.status(500).json({ message: 'Error al obtener vendedores del turno' });
    }
};

const updateShiftSellers = async (req, res) => {
    const { id } = req.params;
    const { seller_ids } = req.body;

    try {
        const [shift] = await pool.query(
            'SELECT * FROM pos_shifts WHERE id = ? AND company_id = ?',
            [id, req.company_id]
        );
        if (shift.length === 0) {
            return res.status(404).json({ message: 'Turno no encontrado' });
        }
        if (shift[0].status !== 'open') {
            return res.status(400).json({ message: 'El turno ya está cerrado' });
        }

        const allIds = [shift[0].seller_id];
        if (seller_ids && Array.isArray(seller_ids)) {
            for (const sid of seller_ids) {
                const num = Number(sid);
                if (num && !allIds.includes(num)) {
                    allIds.push(num);
                }
            }
        }

        // Validar que ningún vendedor esté asignado a otro turno activo
        try {
            await assertNoSellerConflicts(req.company_id, allIds, Number(id));
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }

        // Reemplazar todos los sellers asignados (siempre incluir responsable)
        await pool.query('DELETE FROM pos_shift_sellers WHERE shift_id = ?', [id]);

        for (const sid of allIds) {
            await pool.query(`
                INSERT IGNORE INTO pos_shift_sellers (shift_id, seller_id)
                VALUES (?, ?)
            `, [id, sid]);
        }

        const [rows] = await pool.query(`
            SELECT pss.id, pss.seller_id, sel.nombre as seller_name, pss.assigned_at
            FROM pos_shift_sellers pss
            JOIN sellers sel ON pss.seller_id = sel.id
            WHERE pss.shift_id = ?
            ORDER BY pss.id
        `, [id]);

        const responsableId = shift[0].seller_id;
        const sellers = rows.map(r => ({
            ...r,
            isResponsable: r.seller_id === responsableId
        }));

        res.json({ sellers, message: 'Vendedores actualizados correctamente' });
    } catch (error) {
        console.error('Error in updateShiftSellers:', error);
        res.status(500).json({ message: 'Error al actualizar vendedores del turno' });
    }
};

const deleteShift = async (req, res) => {
    try {
        const { id } = req.params;

        const [sales] = await pool.query(
            'SELECT COUNT(*) as count FROM sales_headers WHERE shift_id = ? AND company_id = ?',
            [id, req.company_id]
        );

        if (sales[0].count > 0) {
            return res.status(409).json({
                message: `No se puede eliminar el turno porque tiene ${sales[0].count} venta(s) asociada(s).`
            });
        }

        await pool.query('DELETE FROM pos_shift_sellers WHERE shift_id = ?', [id]);
        await pool.query('DELETE FROM pos_shift_incomes WHERE shift_id = ?', [id]);
        await pool.query('DELETE FROM pos_shift_expenses WHERE shift_id = ?', [id]);
        await pool.query('DELETE FROM pos_shift_remesas WHERE shift_id = ?', [id]);
        await pool.query('DELETE FROM pos_shift_puntos WHERE shift_id = ?', [id]);
        await pool.query('DELETE FROM pos_shifts WHERE id = ? AND company_id = ?', [id, req.company_id]);

        res.json({ message: 'Turno eliminado correctamente' });
    } catch (error) {
        console.error('Error in deleteShift:', error);
        res.status(500).json({ message: 'Error al eliminar el turno' });
    }
};

const updateShift = async (req, res) => {
    try {
        const { id } = req.params;
        const { seller_id, pos_id, opening_balance, shift_number } = req.body;

        const [shifts] = await pool.query(
            'SELECT * FROM pos_shifts WHERE id = ? AND company_id = ?',
            [id, req.company_id]
        );
        if (shifts.length === 0) {
            return res.status(404).json({ message: 'Turno no encontrado' });
        }

        if (seller_id && Number(seller_id) !== Number(shifts[0].seller_id)) {
            try {
                await assertNoSellerConflicts(req.company_id, [seller_id], Number(id));
            } catch (err) {
                return res.status(err.status || 400).json({ message: err.message });
            }
        }

        const [result] = await pool.query(
            `UPDATE pos_shifts SET seller_id = ?, pos_id = ?, opening_balance = ?, shift_number = ?
             WHERE id = ? AND company_id = ?`,
            [seller_id, pos_id, opening_balance, shift_number, id, req.company_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Turno no encontrado' });
        }

        res.json({ message: 'Turno actualizado correctamente' });
    } catch (error) {
        console.error('Error in updateShift:', error);
        res.status(500).json({ message: 'Error al actualizar el turno' });
    }
};

module.exports = { getCurrentShift, openShift, getShiftSummary, saveArqueo, closeShift, getShiftsHistory, exportArqueosPDF, getShiftSellers, updateShiftSellers, updateShift, deleteShift };
