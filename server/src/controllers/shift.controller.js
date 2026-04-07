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
        if (seller_id && seller_id !== 'undefined') {
            query += ` AND s.seller_id = ?`;
            params.push(seller_id);
        }

        query += ` ORDER BY s.start_time DESC LIMIT 1`;

        const [shifts] = await pool.query(query, params);

        if (shifts.length === 0) {
            return res.json({ open: false });
        }

        res.json({ open: true, shift: shifts[0] });
    } catch (error) {
        console.error('Error in getCurrentShift:', error);
        res.status(500).json({ message: 'Error al verificar turno' });
    }
};

const openShift = async (req, res) => {
    const { pos_id, branch_id, seller_id, opening_balance } = req.body;
    
    try {
        // Verificar si ya hay uno abierto
        const [existing] = await pool.query(`
            SELECT id FROM pos_shifts 
            WHERE company_id = ? AND pos_id = ? AND status = 'open'
        `, [req.company_id, pos_id]);

        if (existing.length > 0) {
            return res.status(400).json({ message: 'Ya existe un turno abierto para este punto de venta' });
        }

        const [result] = await pool.query(`
            INSERT INTO pos_shifts (company_id, branch_id, pos_id, seller_id, start_time, opening_balance, status)
            VALUES (?, ?, ?, ?, NOW(), ?, 'open')
        `, [req.company_id, branch_id, pos_id, seller_id, opening_balance || 0]);

        res.status(201).json({ 
            id: result.insertId, 
            message: 'Turno abierto exitosamente',
            shift_id: result.insertId 
        });
    } catch (error) {
        console.error('Error in openShift:', error);
        res.status(500).json({ message: 'Error al abrir turno' });
    }
};

const getShiftSummary = async (req, res) => {    const { id } = req.params;
    console.log(`[DEBUG] getShiftSummary called for ID: ${id}`);
    try {
        // Obtener datos del turno
        const [shifts] = await pool.query('SELECT * FROM pos_shifts WHERE id = ? AND company_id = ?', [id, req.company_id]);
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
            difference: parseFloat(shift.difference || 0)
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

module.exports = { getCurrentShift, openShift, getShiftSummary, closeShift, getShiftsHistory };
