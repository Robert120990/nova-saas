const pool = require('../config/db');

/**
 * Gestión de Turnos de Punto de Venta (Corte de Caja)
 */

const getCurrentShift = async (req, res) => {
    const { pos_id, seller_id } = req.query;
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

        // Sumar ventas por método de pago con nombres reales
        const [salesByMethod] = await pool.query(`
            SELECT 
                p.metodo_pago as code, 
                cat.description as name, 
                SUM(p.monto) as total
            FROM sales_payments p
            JOIN sales_headers h ON p.sale_id = h.id
            LEFT JOIN cat_017_forma_pago cat ON p.metodo_pago COLLATE utf8mb4_unicode_ci = cat.code COLLATE utf8mb4_unicode_ci
            WHERE h.shift_id = ? AND h.estado = 'emitido'
            AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = h.id AND status = 'INVALIDADO')
            GROUP BY p.metodo_pago, cat.description
        `, [id]);
        console.log(`[DEBUG] Sales by Method:`, JSON.stringify(salesByMethod));

        // Obtener Gastos
        const [expenses] = await pool.query('SELECT description, amount FROM pos_shift_expenses WHERE shift_id = ?', [id]);
        
        // Obtener Ingresos
        const [incomes] = await pool.query(`
            SELECT i.description, i.amount, cat.description as payment_method_name 
            FROM pos_shift_incomes i
            LEFT JOIN cat_017_forma_pago cat ON i.payment_method COLLATE utf8mb4_unicode_ci = cat.code COLLATE utf8mb4_unicode_ci
            WHERE i.shift_id = ?
         `, [id]);

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
            incomes: incomes.map(i => ({ description: i.description, amount: parseFloat(i.amount || 0), method: i.payment_method_name })),
            total_expenses: parseFloat(shift.total_expenses || expenses.reduce((acc, e) => acc + parseFloat(e.amount || 0), 0)),
            total_incomes: parseFloat(shift.total_incomes || incomes.reduce((acc, i) => acc + parseFloat(i.amount || 0), 0)),
            actual: parseFloat(shift.actual_cash || 0),
            expected: parseFloat(shift.expected_cash || (parseFloat(shift.opening_balance || 0) + cashSales)),
            difference: parseFloat(shift.difference || 0),
            salesByCategory: salesByCategory.map(c => ({
                categoria: c.categoria,
                total: parseFloat(c.total || 0)
            }))
        };

        summary.expected_cash = summary.opening_balance + summary.cash + summary.total_incomes - summary.total_expenses;

        console.log(`[DEBUG] Final Summary:`, JSON.stringify(summary));
        res.json(summary);
    } catch (error) {
        console.error('Error in getShiftSummary:', error);
        res.status(500).json({ message: 'Error al obtener resumen del turno', detail: error.message });
    }
};

const closeShift = async (req, res) => {
    const { id } = req.params;
    const { actual_cash, expenses = [], incomes = [] } = req.body;

    try {
        // Obtener resumen actual
        const [shifts] = await pool.query('SELECT * FROM pos_shifts WHERE id = ? AND company_id = ?', [id, req.company_id]);
        if (shifts.length === 0) return res.status(404).json({ message: 'Turno no encontrado' });
        const shift = shifts[0];

        if (shift.status === 'closed') return res.status(400).json({ message: 'El turno ya se encuentra cerrado' });

        // 1. Guardar gastos
        let totalExpenses = 0;
        if (expenses.length > 0) {
            for (const exp of expenses) {
                const amount = parseFloat(exp.amount || 0);
                if (amount > 0) {
                    await pool.query(`
                        INSERT INTO pos_shift_expenses (shift_id, description, amount)
                        VALUES (?, ?, ?)
                    `, [id, exp.description || 'Gasto operativo', amount]);
                    totalExpenses += amount;
                }
            }
        }

        // 2. Guardar otros ingresos
        let totalIncomes = 0;
        let cashIncomes = 0;
        if (incomes.length > 0) {
            for (const inc of incomes) {
                const amount = parseFloat(inc.amount || 0);
                if (amount > 0) {
                    await pool.query(`
                        INSERT INTO pos_shift_incomes (shift_id, description, amount, payment_method)
                        VALUES (?, ?, ?, ?)
                    `, [id, inc.description || 'Ingreso adicional', amount, inc.payment_method || '01']);
                    
                    totalIncomes += amount;
                    if (inc.payment_method === '01') {
                        cashIncomes += amount;
                    }
                }
            }
        }

        // 3. Calcular totales para el cierre persistente
        const [salesTotals] = await pool.query(`
            SELECT 
                SUM(CASE WHEN p.metodo_pago = '01' THEN p.monto ELSE 0 END) as cash,
                SUM(p.monto) as total
            FROM sales_payments p
            JOIN sales_headers h ON p.sale_id = h.id
            WHERE h.shift_id = ? AND h.estado = 'emitido'
            AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = h.id AND status = 'INVALIDADO')
        `, [id]);

        const totals = salesTotals[0];
        const cashSales = parseFloat(totals.cash || 0);
        
        // EFECTIVO ESPERADO = (FONDO + VENTAS CASH + INGRESOS CASH) - GASTOS
        const expectedCash = parseFloat(shift.opening_balance) + cashSales + cashIncomes - totalExpenses;
        const actualCash = parseFloat(actual_cash || 0);
        const difference = actualCash - expectedCash;

        await pool.query(`
            UPDATE pos_shifts SET 
                end_time = NOW(),
                expected_cash = ?,
                actual_cash = ?,
                difference = ?,
                cash_sales = ?,
                total_sales = ?,
                total_expenses = ?,
                total_incomes = ?,
                status = 'closed'
            WHERE id = ?
        `, [
            expectedCash, 
            actualCash, 
            difference, 
            cashSales, 
            parseFloat(totals.total || 0),
            totalExpenses,
            totalIncomes,
            id
        ]);

        res.json({ 
            message: 'Turno cerrado existosamente', 
            summary: {
                expected: expectedCash,
                actual: actualCash,
                difference: difference,
                expenses: totalExpenses,
                incomes: totalIncomes
            }
        });
    } catch (error) {
        console.error('Error in closeShift:', error);
        res.status(500).json({ message: 'Error al cerrar turno' });
    }
};

const getShiftsHistory = async (req, res) => {
    const { branch_id, seller_id, status, search, start_date, end_date } = req.query;
    try {
        let sql = `
            SELECT s.*, sel.nombre as seller_name, p.nombre as pos_name, b.nombre as branch_name
            FROM pos_shifts s
            JOIN sellers sel ON s.seller_id = sel.id
            JOIN points_of_sale p ON s.pos_id = p.id
            JOIN branches b ON s.branch_id = b.id
            WHERE s.company_id = ?
        `;
        const params = [req.company_id];

        if (branch_id) {
            sql += ` AND s.branch_id = ?`;
            params.push(branch_id);
        }
        if (seller_id) {
            sql += ` AND s.seller_id = ?`;
            params.push(seller_id);
        }
        if (status) {
            sql += ` AND s.status = ?`;
            params.push(status);
        }
        if (search) {
            sql += ` AND (sel.nombre LIKE ? OR p.nombre LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }
        if (start_date) {
            sql += ` AND s.start_time >= ?`;
            params.push(`${start_date} 00:00:00`);
        }
        if (end_date) {
            sql += ` AND s.start_time <= ?`;
            params.push(`${end_date} 23:59:59`);
        }

        sql += ` ORDER BY s.start_time DESC LIMIT 50`;

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('Error in getShiftsHistory:', error);
        res.status(500).json({ message: 'Error al obtener historial de turnos' });
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

        // Reemplazar todos los sellers asignados (siempre incluir responsable)
        await pool.query('DELETE FROM pos_shift_sellers WHERE shift_id = ?', [id]);

        const allIds = [shift[0].seller_id];
        if (seller_ids && Array.isArray(seller_ids)) {
            for (const sid of seller_ids) {
                const num = Number(sid);
                if (num && !allIds.includes(num)) {
                    allIds.push(num);
                }
            }
        }
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

module.exports = { getCurrentShift, openShift, getShiftSummary, closeShift, getShiftsHistory, getShiftSellers, updateShiftSellers };
