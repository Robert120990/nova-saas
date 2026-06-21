const pool = require('../config/db');

exports.initCloseout = async (req, res) => {
    try {
        const { seller_id, seller_name, fecha_turno, numero_turno } = req.body;
        if (!seller_id || !fecha_turno || !numero_turno) {
            return res.status(400).json({ message: 'seller_id, fecha_turno y numero_turno son requeridos' });
        }

        const [result] = await pool.query(
            `INSERT INTO gas_station_closeouts (company_id, seller_id, seller_name, fecha_turno, numero_turno) VALUES (?, ?, ?, ?, ?)`,
            [req.company_id, seller_id, seller_name || '', fecha_turno, numero_turno]
        );
        const closeoutId = result.insertId;

        const [nozzles] = await pool.query(`
            SELECT n.id as nozzle_id, n.codigo as codigo_pistola,
                   p.id as product_id, p.codigo as codigo_producto, p.nombre as descripcion_producto,
                   p.precio_unitario
            FROM gas_station_nozzles n
            JOIN products p ON n.product_id = p.id
            WHERE n.company_id = ?
        `, [req.company_id]);

        const readings = [];
        for (const n of nozzles) {
            const [lastReading] = await pool.query(`
                SELECT r.lectura_actual
                FROM gas_station_closeout_readings r
                JOIN gas_station_closeouts c ON r.closeout_id = c.id
                WHERE r.nozzle_id = ? AND c.company_id = ? AND c.estado = 'cerrado'
                ORDER BY c.created_at DESC
                LIMIT 1
            `, [n.nozzle_id, req.company_id]);

            const lectura_anterior = lastReading.length > 0 ? parseFloat(lastReading[0].lectura_actual) : 0;

            await pool.query(`
                INSERT INTO gas_station_closeout_readings
                (closeout_id, nozzle_id, product_id, codigo_pistola, codigo_producto, descripcion_producto, precio, lectura_anterior, lectura_actual, calibracion, diferencia, monto)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0)
            `, [closeoutId, n.nozzle_id, n.product_id, n.codigo_pistola, n.codigo_producto, n.descripcion_producto, n.precio_unitario, lectura_anterior]);

            readings.push({
                nozzle_id: n.nozzle_id,
                codigo_pistola: n.codigo_pistola,
                codigo_producto: n.codigo_producto,
                descripcion_producto: n.descripcion_producto,
                precio: n.precio_unitario,
                lectura_anterior,
                lectura_actual: 0,
                calibracion: 0,
                diferencia: 0,
                monto: 0
            });
        }

        res.status(201).json({ id: closeoutId, readings });
    } catch (error) {
        console.error('Error initCloseout:', error);
        res.status(500).json({ message: 'Error al iniciar cierre de lecturas' });
    }
};

exports.getCloseouts = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        let where = 'WHERE c.company_id = ?';
        let params = [req.company_id];

        if (search) {
            where += ' AND (c.numero_turno LIKE ? OR c.seller_name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM gas_station_closeouts c ${where}`, params
        );
        const total = countResult[0].total;

        const [rows] = await pool.query(`
            SELECT c.*,
                   (SELECT COUNT(*) FROM gas_station_closeout_readings WHERE closeout_id = c.id) as total_lecturas,
                   (SELECT COALESCE(SUM(monto), 0) FROM gas_station_closeout_readings WHERE closeout_id = c.id) as total_monto,
                   (SELECT COALESCE(SUM(diferencia), 0) FROM gas_station_closeout_readings WHERE closeout_id = c.id) as total_diferencia
            FROM gas_station_closeouts c
            ${where}
            ORDER BY c.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), parseInt(offset)]);

        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        console.error('Error getCloseouts:', error);
        res.status(500).json({ message: 'Error al obtener cierres de lecturas' });
    }
};

exports.getCloseout = async (req, res) => {
    try {
        const { id } = req.params;

        const [closeouts] = await pool.query(
            `SELECT * FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });

        const [readings] = await pool.query(`
            SELECT * FROM gas_station_closeout_readings
            WHERE closeout_id = ?
            ORDER BY codigo_pistola ASC
        `, [id]);

        res.json({ ...closeouts[0], readings });
    } catch (error) {
        console.error('Error getCloseout:', error);
        res.status(500).json({ message: 'Error al obtener cierre de lecturas' });
    }
};

exports.updateReading = async (req, res) => {
    try {
        const { closeoutId, id } = req.params;
        const { lectura_actual, calibracion, lectura_anterior: newAnterior } = req.body;

        const [closeouts] = await pool.query(
            `SELECT estado FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [closeoutId, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado, no se puede modificar' });
        }

        const [current] = await pool.query(
            `SELECT lectura_anterior, precio FROM gas_station_closeout_readings WHERE id = ? AND closeout_id = ?`,
            [id, closeoutId]
        );
        if (current.length === 0) return res.status(404).json({ message: 'Lectura no encontrada' });

        const lectura_anterior = newAnterior !== undefined ? parseFloat(newAnterior) : parseFloat(current[0].lectura_anterior);
        const precio = parseFloat(current[0].precio);
        const newLectura = lectura_actual !== undefined ? parseFloat(lectura_actual) : undefined;
        const newCalibracion = calibracion !== undefined ? parseFloat(calibracion) : undefined;

        const finalLectura = newLectura !== undefined ? newLectura : parseFloat(current[0].lectura_actual);
        const finalCalibracion = newCalibracion !== undefined ? newCalibracion : parseFloat(current[0].calibracion);
        const diferencia = finalLectura - lectura_anterior - finalCalibracion;
        const monto = diferencia * precio;

        await pool.query(`
            UPDATE gas_station_closeout_readings
            SET lectura_actual = ?, calibracion = ?, lectura_anterior = ?, diferencia = ?, monto = ?
            WHERE id = ? AND closeout_id = ?
        `, [finalLectura, finalCalibracion, lectura_anterior, diferencia, monto, id, closeoutId]);

        res.json({ id: parseInt(id), lectura_actual: finalLectura, calibracion: finalCalibracion, lectura_anterior, diferencia, monto });
    } catch (error) {
        console.error('Error updateReading:', error);
        res.status(500).json({ message: 'Error al actualizar lectura' });
    }
};

exports.deleteCloseout = async (req, res) => {
    try {
        const { id } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'No se puede eliminar un cierre cerrado' });
        }

        await pool.query(`DELETE FROM gas_station_closeout_readings WHERE closeout_id = ?`, [id]);
        await pool.query(`DELETE FROM gas_station_closeouts WHERE id = ?`, [id]);

        res.json({ message: 'Cierre eliminado exitosamente' });
    } catch (error) {
        console.error('Error deleteCloseout:', error);
        res.status(500).json({ message: 'Error al eliminar cierre de lecturas' });
    }
};

exports.closeCloseout = async (req, res) => {
    try {
        const { id } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }

        await pool.query(
            `UPDATE gas_station_closeouts SET estado = 'cerrado', closed_at = NOW() WHERE id = ?`,
            [id]
        );

        res.json({ message: 'Cierre cerrado exitosamente' });
    } catch (error) {
        console.error('Error closeCloseout:', error);
        res.status(500).json({ message: 'Error al cerrar cierre de lecturas' });
    }
};

// === Expense Categories ===

exports.getExpenseCategories = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, name FROM gas_station_expense_categories WHERE company_id = ? ORDER BY name`,
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error getExpenseCategories:', error);
        res.status(500).json({ message: 'Error al obtener rubros' });
    }
};

exports.createExpenseCategory = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'Nombre es requerido' });
        const [result] = await pool.query(
            `INSERT INTO gas_station_expense_categories (company_id, name) VALUES (?, ?)`,
            [req.company_id, name]
        );
        res.status(201).json({ id: result.insertId, name });
    } catch (error) {
        console.error('Error createExpenseCategory:', error);
        res.status(500).json({ message: 'Error al crear rubro' });
    }
};

exports.updateExpenseCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'Nombre es requerido' });
        const [result] = await pool.query(
            `UPDATE gas_station_expense_categories SET name = ? WHERE id = ? AND company_id = ?`,
            [name, id, req.company_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Rubro no encontrado' });
        res.json({ id: parseInt(id), name });
    } catch (error) {
        console.error('Error updateExpenseCategory:', error);
        res.status(500).json({ message: 'Error al actualizar rubro' });
    }
};

exports.deleteExpenseCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(
            `DELETE FROM gas_station_expense_categories WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Rubro no encontrado' });
        res.json({ message: 'Rubro eliminado' });
    } catch (error) {
        console.error('Error deleteExpenseCategory:', error);
        res.status(500).json({ message: 'Error al eliminar rubro' });
    }
};

// === Closeout Expenses ===

exports.getExpenses = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT * FROM gas_station_closeout_expenses WHERE closeout_id = ? ORDER BY id ASC`,
            [id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error getExpenses:', error);
        res.status(500).json({ message: 'Error al obtener gastos' });
    }
};

exports.saveExpenses = async (req, res) => {
    try {
        const { id } = req.params;
        const { expenses } = req.body;

        const [closeouts] = await pool.query(
            `SELECT estado FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }

        await pool.query(`DELETE FROM gas_station_closeout_expenses WHERE closeout_id = ?`, [id]);

        if (expenses && expenses.length > 0) {
            const values = expenses.map(e => [
                parseInt(id),
                e.rubro || '',
                e.fecha || null,
                e.documento || '',
                e.tipo || 'ccf',
                e.proveedor || '',
                parseFloat(e.valor) || 0
            ]);
            await pool.query(
                `INSERT INTO gas_station_closeout_expenses (closeout_id, rubro, fecha, documento, tipo, proveedor, valor) VALUES ?`,
                [values]
            );
        }

        const [remaining] = await pool.query(
            `SELECT * FROM gas_station_closeout_expenses WHERE closeout_id = ? ORDER BY id ASC`,
            [id]
        );

        res.json(remaining);
    } catch (error) {
        console.error('Error saveExpenses:', error);
        res.status(500).json({ message: 'Error al guardar gastos' });
    }
};

exports.deleteExpense = async (req, res) => {
    try {
        const { id, expenseId } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }

        const [result] = await pool.query(
            `DELETE FROM gas_station_closeout_expenses WHERE id = ? AND closeout_id = ?`,
            [expenseId, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Gasto no encontrado' });
        res.json({ message: 'Gasto eliminado' });
    } catch (error) {
        console.error('Error deleteExpense:', error);
        res.status(500).json({ message: 'Error al eliminar gasto' });
    }
};
