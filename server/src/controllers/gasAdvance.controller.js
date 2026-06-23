const pool = require('../config/db');

function generateNumero(day, month, correlative) {
    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    const ccc = String(correlative).padStart(3, '0');
    return dd + mm + ccc;
}

exports.getAdvances = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const branchId = req.user?.branch_id || null;

        let where = 'WHERE a.company_id = ?';
        const params = [req.company_id];

        if (branchId) {
            where += ' AND a.branch_id = ?';
            params.push(branchId);
        }

        if (search) {
            where += ' AND (a.numero LIKE ? OR a.cliente_nombre LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s);
        }

        const countQuery = `SELECT COUNT(*) as total FROM gas_station_advances a ${where}`;
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        const query = `
            SELECT a.*, c.nrc, c.nit, c.nombre AS customer_nombre
            FROM gas_station_advances a
            LEFT JOIN customers c ON a.cliente_id = c.id
            ${where}
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
        `;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        console.error('Error getAdvances:', error);
        res.status(500).json({ message: 'Error al obtener anticipos' });
    }
};

exports.getAvailableAdvancesByClient = async (req, res) => {
    try {
        const { cliente_id } = req.params;
        const [rows] = await pool.query(`
            SELECT COALESCE(SUM(monto_disponible), 0) as total_disponible FROM gas_station_advances
            WHERE company_id = ? AND cliente_id = ? AND monto_disponible > 0
        `, [req.company_id, cliente_id]);
        res.json({ total_disponible: parseFloat(rows[0].total_disponible) });
    } catch (error) {
        console.error('Error getAvailableAdvancesByClient:', error);
        res.status(500).json({ message: 'Error al obtener disponible' });
    }
};

exports.createAdvance = async (req, res) => {
    try {
        const { cliente_id, cliente_nombre, monto, notas, fecha } = req.body;
        console.log('[createAdvance] body:', JSON.stringify({ cliente_id, cliente_nombre, monto }));
        if (!cliente_id || !monto || monto <= 0) {
            return res.status(400).json({ message: 'Cliente y monto son obligatorios' });
        }

        const advanceDate = fecha || new Date().toISOString().slice(0, 10);
        const d = new Date(advanceDate);
        const day = d.getDate();
        const month = d.getMonth() + 1;

        const [lastAdvance] = await pool.query(
            `SELECT numero FROM gas_station_advances WHERE company_id = ? AND fecha = ? ORDER BY id DESC LIMIT 1`,
            [req.company_id, advanceDate]
        );

        let correlative = 1;
        if (lastAdvance.length > 0) {
            const lastNum = parseInt(lastAdvance[0].numero.slice(-3), 10);
            correlative = lastNum + 1;
        }

        const numero = generateNumero(day, month, correlative);
        const branchId = req.user?.branch_id || null;

        const [result] = await pool.query(
            `INSERT INTO gas_station_advances (company_id, branch_id, numero, fecha, cliente_id, cliente_nombre, monto, monto_disponible, notas)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.company_id, branchId, numero, advanceDate, cliente_id, cliente_nombre || '', monto, monto, notas || '']
        );

        const [created] = await pool.query(
            `SELECT a.*, c.nrc, c.nit, c.nombre AS customer_nombre FROM gas_station_advances a LEFT JOIN customers c ON a.cliente_id = c.id WHERE a.id = ?`,
            [result.insertId]
        );

        res.status(201).json(created[0]);
    } catch (error) {
        console.error('Error createAdvance:', error);
        res.status(500).json({ message: 'Error al crear anticipo' });
    }
};

exports.updateAdvance = async (req, res) => {
    try {
        const { id } = req.params;
        const { cliente_id, cliente_nombre, monto, notas, fecha } = req.body;
        if (!cliente_id || !monto || monto <= 0) {
            return res.status(400).json({ message: 'Cliente y monto son obligatorios' });
        }

        const [existing] = await pool.query(
            `SELECT * FROM gas_station_advances WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (existing.length === 0) return res.status(404).json({ message: 'Anticipo no encontrado' });

        const advance = existing[0];
        const usedAmount = parseFloat(advance.monto) - parseFloat(advance.monto_disponible);
        const newMonto = parseFloat(monto);
        if (newMonto < usedAmount) {
            return res.status(400).json({ message: `El nuevo monto no puede ser menor a $${usedAmount.toFixed(2)} ya utilizado` });
        }
        const newDisponible = newMonto - usedAmount;

        const advanceDate = fecha || advance.fecha;
        const d = new Date(advanceDate);
        const day = d.getDate();
        const month = d.getMonth() + 1;

        const [lastAdvance] = await pool.query(
            `SELECT numero FROM gas_station_advances WHERE company_id = ? AND fecha = ? AND id != ? ORDER BY id DESC LIMIT 1`,
            [req.company_id, advanceDate, id]
        );

        let correlative = 1;
        if (lastAdvance.length > 0) {
            const lastNum = parseInt(lastAdvance[0].numero.slice(-3), 10);
            correlative = lastNum + 1;
        }
        const numero = generateNumero(day, month, correlative);

        await pool.query(
            `UPDATE gas_station_advances SET numero = ?, fecha = ?, cliente_id = ?, cliente_nombre = ?, monto = ?, monto_disponible = ?, notas = ? WHERE id = ?`,
            [numero, advanceDate, cliente_id, cliente_nombre || '', newMonto, newDisponible, notas || '', id]
        );

        const [updated] = await pool.query(
            `SELECT a.*, c.nrc, c.nit, c.nombre AS customer_nombre FROM gas_station_advances a LEFT JOIN customers c ON a.cliente_id = c.id WHERE a.id = ?`,
            [id]
        );

        res.json(updated[0]);
    } catch (error) {
        console.error('Error updateAdvance:', error);
        res.status(500).json({ message: 'Error al actualizar anticipo' });
    }
};

exports.deleteAdvance = async (req, res) => {
    try {
        const { id } = req.params;
        const [existing] = await pool.query(
            `SELECT * FROM gas_station_advances WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (existing.length === 0) return res.status(404).json({ message: 'Anticipo no encontrado' });

        const usedAmount = parseFloat(existing[0].monto) - parseFloat(existing[0].monto_disponible);
        if (usedAmount > 0) {
            return res.status(400).json({ message: `No se puede eliminar porque ya se han utilizado $${usedAmount.toFixed(2)} de este anticipo en cierres` });
        }

        await pool.query(`DELETE FROM gas_station_advances WHERE id = ?`, [id]);
        res.json({ message: 'Anticipo eliminado' });
    } catch (error) {
        console.error('Error deleteAdvance:', error);
        res.status(500).json({ message: 'Error al eliminar anticipo' });
    }
};
