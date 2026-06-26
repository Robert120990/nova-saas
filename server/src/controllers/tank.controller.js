const pool = require('../config/db');

const TABLE = 'gas_station_tanks';

exports.getTanks = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        let where = 'WHERE company_id = ?';
        let params = [req.company_id];
        if (req.user.branch_id) {
            where += ' AND branch_id = ?';
            params.push(req.user.branch_id);
        }
        if (search) {
            where += ' AND (codigo LIKE ? OR descripcion LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM ${TABLE} ${where}`, params);
        const total = countResult[0].total;
        const [rows] = await pool.query(`SELECT * FROM ${TABLE} ${where} ORDER BY codigo ASC LIMIT ? OFFSET ?`, [...params, parseInt(limit), parseInt(offset)]);
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener tanques' });
    }
};

exports.createTank = async (req, res) => {
    try {
        const data = { ...req.body, company_id: req.company_id, branch_id: req.user.branch_id };
        const [result] = await pool.query(`INSERT INTO ${TABLE} SET ?`, [data]);
        res.status(201).json({ id: result.insertId, ...data });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Ya existe un tanque con ese código' });
        res.status(500).json({ message: 'Error al crear tanque' });
    }
};

exports.updateTank = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(`UPDATE ${TABLE} SET ? WHERE id = ? AND company_id = ? AND branch_id = ?`, [req.body, id, req.company_id, req.user.branch_id]);
        res.json({ message: 'Tanque actualizado' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Ya existe un tanque con ese código' });
        res.status(500).json({ message: 'Error al actualizar tanque' });
    }
};

exports.deleteTank = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(`DELETE FROM ${TABLE} WHERE id = ? AND company_id = ? AND branch_id = ?`, [id, req.company_id, req.user.branch_id]);
        res.json({ message: 'Tanque eliminado' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar tanque' });
    }
};
