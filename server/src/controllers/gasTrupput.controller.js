const pool = require('../config/db');

function generateNumero(day, month, correlative) {
    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    const ccc = String(correlative).padStart(3, '0');
    return dd + mm + ccc;
}

exports.getTrupput = async (req, res) => {
    try {
        const { search, page = 1, limit = 15 } = req.query;
        const offset = (page - 1) * limit;
        const branchId = req.user?.branch_id || null;

        let where = 'WHERE t.company_id = ?';
        const params = [req.company_id];

        if (branchId) {
            where += ' AND t.branch_id = ?';
            params.push(branchId);
        }

        if (search) {
            where += ' AND (t.numero LIKE ? OR t.cliente_nombre LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s);
        }

        const countQuery = `SELECT COUNT(*) as total FROM gas_station_trupput t ${where}`;
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        const query = `
            SELECT t.*, c.nrc, c.nit, c.nombre AS customer_nombre
            FROM gas_station_trupput t
            LEFT JOIN customers c ON t.cliente_id = c.id
            ${where}
            ORDER BY t.created_at DESC
            LIMIT ? OFFSET ?
        `;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        console.error('Error getTrupput:', error);
        res.status(500).json({ message: 'Error al obtener clientes Trupput' });
    }
};

exports.getAvailableTrupputByClient = async (req, res) => {
    try {
        const { cliente_id } = req.params;
        const [rows] = await pool.query(`
            SELECT COALESCE(SUM(galones_disponibles), 0) as total_galones FROM gas_station_trupput
            WHERE company_id = ? AND cliente_id = ? AND galones_disponibles > 0
        `, [req.company_id, cliente_id]);
        res.json({ total_galones: parseFloat(rows[0].total_galones) });
    } catch (error) {
        console.error('Error getAvailableTrupputByClient:', error);
        res.status(500).json({ message: 'Error al obtener galones disponibles' });
    }
};

exports.createTrupput = async (req, res) => {
    try {
        const { cliente_id, cliente_nombre, galones, precio, notas, fecha } = req.body;
        if (!cliente_id || !galones || galones <= 0) {
            return res.status(400).json({ message: 'Cliente y galones son obligatorios' });
        }

        const galonesNum = parseFloat(galones);
        const precioNum = parseFloat(precio) || 0;
        const monto = Number((galonesNum * precioNum).toFixed(2));

        const trupputDate = fecha || new Date().toISOString().slice(0, 10);
        const d = new Date(trupputDate);
        const day = d.getDate();
        const month = d.getMonth() + 1;

        const [lastTrupput] = await pool.query(
            `SELECT numero FROM gas_station_trupput WHERE company_id = ? AND fecha = ? ORDER BY id DESC LIMIT 1`,
            [req.company_id, trupputDate]
        );

        let correlative = 1;
        if (lastTrupput.length > 0) {
            const lastNum = parseInt(lastTrupput[0].numero.slice(-3), 10);
            correlative = lastNum + 1;
        }

        const numero = generateNumero(day, month, correlative);
        const branchId = req.user?.branch_id || null;

        const [result] = await pool.query(
            `INSERT INTO gas_station_trupput (company_id, branch_id, numero, fecha, cliente_id, cliente_nombre, galones, precio, monto, galones_disponibles, notas)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.company_id, branchId, numero, trupputDate, cliente_id, cliente_nombre || '', galonesNum, precioNum, monto, galonesNum, notas || '']
        );

        await pool.query(
            `UPDATE customers SET es_trupput = TRUE WHERE id = ?`,
            [cliente_id]
        );

        const [created] = await pool.query(
            `SELECT t.*, c.nrc, c.nit, c.nombre AS customer_nombre FROM gas_station_trupput t LEFT JOIN customers c ON t.cliente_id = c.id WHERE t.id = ?`,
            [result.insertId]
        );

        res.status(201).json(created[0]);
    } catch (error) {
        console.error('Error createTrupput:', error);
        res.status(500).json({ message: 'Error al crear cliente Trupput' });
    }
};

exports.updateTrupput = async (req, res) => {
    try {
        const { id } = req.params;
        const { cliente_id, cliente_nombre, galones, precio, notas, fecha } = req.body;
        if (!cliente_id || !galones || galones <= 0) {
            return res.status(400).json({ message: 'Cliente y galones son obligatorios' });
        }

        const [existing] = await pool.query(
            `SELECT * FROM gas_station_trupput WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (existing.length === 0) return res.status(404).json({ message: 'Cliente Trupput no encontrado' });

        const trupput = existing[0];
        const usedGalones = parseFloat(trupput.galones) - parseFloat(trupput.galones_disponibles);
        const newGalones = parseFloat(galones);
        if (newGalones < usedGalones) {
            return res.status(400).json({ message: `El nuevo galonaje no puede ser menor a ${usedGalones.toFixed(4)} ya utilizado` });
        }
        const newDisponibles = newGalones - usedGalones;

        const precioNum = parseFloat(precio) || 0;
        const monto = Number((newGalones * precioNum).toFixed(2));

        const trupputDate = fecha || trupput.fecha;
        const d = new Date(trupputDate);
        const day = d.getDate();
        const month = d.getMonth() + 1;

        const [lastTrupput] = await pool.query(
            `SELECT numero FROM gas_station_trupput WHERE company_id = ? AND fecha = ? AND id != ? ORDER BY id DESC LIMIT 1`,
            [req.company_id, trupputDate, id]
        );

        let correlative = 1;
        if (lastTrupput.length > 0) {
            const lastNum = parseInt(lastTrupput[0].numero.slice(-3), 10);
            correlative = lastNum + 1;
        }
        const numero = generateNumero(day, month, correlative);

        await pool.query(
            `UPDATE gas_station_trupput SET numero = ?, fecha = ?, cliente_id = ?, cliente_nombre = ?, galones = ?, precio = ?, monto = ?, galones_disponibles = ?, notas = ? WHERE id = ?`,
            [numero, trupputDate, cliente_id, cliente_nombre || '', newGalones, precioNum, monto, newDisponibles, notas || '', id]
        );

        const [updated] = await pool.query(
            `SELECT t.*, c.nrc, c.nit, c.nombre AS customer_nombre FROM gas_station_trupput t LEFT JOIN customers c ON t.cliente_id = c.id WHERE t.id = ?`,
            [id]
        );

        res.json(updated[0]);
    } catch (error) {
        console.error('Error updateTrupput:', error);
        res.status(500).json({ message: 'Error al actualizar cliente Trupput' });
    }
};

exports.deleteTrupput = async (req, res) => {
    try {
        const { id } = req.params;
        const [existing] = await pool.query(
            `SELECT * FROM gas_station_trupput WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (existing.length === 0) return res.status(404).json({ message: 'Cliente Trupput no encontrado' });

        const usedGalones = parseFloat(existing[0].galones) - parseFloat(existing[0].galones_disponibles);
        if (usedGalones > 0) {
            return res.status(400).json({ message: `No se puede eliminar porque ya se han utilizado ${usedGalones.toFixed(4)} galones en cierres` });
        }

        await pool.query(`DELETE FROM gas_station_trupput WHERE id = ?`, [id]);
        res.json({ message: 'Cliente Trupput eliminado' });
    } catch (error) {
        console.error('Error deleteTrupput:', error);
        res.status(500).json({ message: 'Error al eliminar cliente Trupput' });
    }
};
