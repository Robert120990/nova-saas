const pool = require('../config/db');

const TABLE = 'gas_station_despachadores';

exports.getDespachadores = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        let where = 'WHERE company_id = ?';
        let params = [req.company_id];
        if (search) {
            where += ' AND (codigo LIKE ? OR descripcion LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM ${TABLE} ${where}`, params);
        const total = countResult[0].total;
        const [rows] = await pool.query(`SELECT * FROM ${TABLE} ${where} ORDER BY codigo ASC LIMIT ? OFFSET ?`, [...params, parseInt(limit), parseInt(offset)]);
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener despachadores' });
    }
};

exports.createDespachador = async (req, res) => {
    try {
        const { codigo, descripcion } = req.body;
        if (!codigo) return res.status(400).json({ message: 'El código es obligatorio' });
        const [result] = await pool.query(
            `INSERT INTO ${TABLE} (company_id, codigo, descripcion) VALUES (?, ?, ?)`,
            [req.company_id, codigo, descripcion || '']
        );
        res.status(201).json({ id: result.insertId, codigo, descripcion: descripcion || '' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Ya existe un despachador con ese código' });
        res.status(500).json({ message: 'Error al crear despachador' });
    }
};

exports.updateDespachador = async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo, descripcion } = req.body;
        if (!codigo) return res.status(400).json({ message: 'El código es obligatorio' });
        await pool.query(
            `UPDATE ${TABLE} SET codigo = ?, descripcion = ? WHERE id = ? AND company_id = ?`,
            [codigo, descripcion || '', id, req.company_id]
        );
        res.json({ message: 'Despachador actualizado' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Ya existe un despachador con ese código' });
        res.status(500).json({ message: 'Error al actualizar despachador' });
    }
};

exports.deleteDespachador = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(`DELETE FROM ${TABLE} WHERE id = ? AND company_id = ?`, [id, req.company_id]);
        res.json({ message: 'Despachador eliminado' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar despachador' });
    }
};

exports.getDespachadorNozzles = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT nozzle_id FROM gas_station_despachador_nozzles WHERE despachador_id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        res.json(rows.map(r => r.nozzle_id));
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener asignaciones' });
    }
};

exports.updateDespachadorNozzles = async (req, res) => {
    try {
        const { id } = req.params;
        const { nozzle_ids } = req.body;
        if (!Array.isArray(nozzle_ids)) {
            return res.status(400).json({ message: 'Se requiere una lista de IDs de mangueras' });
        }

        await pool.query(`DELETE FROM gas_station_despachador_nozzles WHERE despachador_id = ? AND company_id = ?`, [id, req.company_id]);

        if (nozzle_ids.length > 0) {
            const values = nozzle_ids.map(n => [req.company_id, parseInt(id), parseInt(n)]);
            await pool.query(
                `INSERT INTO gas_station_despachador_nozzles (company_id, despachador_id, nozzle_id) VALUES ?`,
                [values]
            );
        }

        res.json({ message: 'Asignaciones actualizadas' });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar asignaciones' });
    }
};

exports.getAllAssignments = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT dn.nozzle_id, dn.despachador_id, d.codigo as despachador_codigo
            FROM gas_station_despachador_nozzles dn
            JOIN gas_station_despachadores d ON d.id = dn.despachador_id
            WHERE dn.company_id = ?
        `, [req.company_id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener asignaciones' });
    }
};
