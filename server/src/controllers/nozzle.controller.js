const pool = require('../config/db');

const TABLE = 'gas_station_nozzles';

exports.getNozzles = async (req, res) => {
    try {
        const { search, page = 1, limit = 15 } = req.query;
        const offset = (page - 1) * limit;
        let where = 'WHERE n.company_id = ?';
        let params = [req.company_id];
        if (req.user.branch_id) {
            where += ' AND n.branch_id = ?';
            params.push(req.user.branch_id);
        }
        if (search) {
            where += ' AND (n.codigo LIKE ? OR n.descripcion LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM ${TABLE} n ${where}`, params);
        const total = countResult[0].total;
        const [rows] = await pool.query(`
            SELECT n.*, i.codigo as island_codigo, i.descripcion as island_descripcion,
                   p.codigo as product_codigo, p.nombre as product_nombre, p.tipo_combustible
            FROM ${TABLE} n
            LEFT JOIN gas_station_islands i ON n.island_id = i.id
            LEFT JOIN products p ON n.product_id = p.id
            ${where} ORDER BY n.codigo ASC LIMIT ? OFFSET ?`, [...params, parseInt(limit), parseInt(offset)]);
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener pistolas' });
    }
};

exports.createNozzle = async (req, res) => {
    try {
        const branchId = req.body.branch_id || (req.headers['x-branch-id'] ? parseInt(req.headers['x-branch-id']) : null) || req.branch_id || req.user?.branch_id || null;
        const data = { ...req.body, company_id: req.company_id, branch_id: branchId };
        const [result] = await pool.query(`INSERT INTO ${TABLE} SET ?`, [data]);
        res.status(201).json({ id: result.insertId, ...data });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Ya existe una pistola con ese código' });
        res.status(500).json({ message: 'Error al crear pistola' });
    }
};

exports.updateNozzle = async (req, res) => {
    try {
        const { id } = req.params;
        const isSuperAdmin = req.user?.role === 'SuperAdmin' || req.user?.role?.toLowerCase() === 'superadmin';
        let where = 'WHERE id = ? AND company_id = ?';
        let params = [req.body, id, req.company_id];
        if (!isSuperAdmin) {
            const targetBranchId = req.headers['x-branch-id'] ? parseInt(req.headers['x-branch-id']) : (req.branch_id || req.user?.branch_id);
            if (targetBranchId) {
                where += ' AND (branch_id = ? OR branch_id IS NULL)';
                params.push(targetBranchId);
            }
        }
        await pool.query(`UPDATE ${TABLE} SET ? ${where}`, params);
        res.json({ message: 'Pistola actualizada' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Ya existe una pistola con ese código' });
        res.status(500).json({ message: 'Error al actualizar pistola' });
    }
};

exports.deleteNozzle = async (req, res) => {
    try {
        const { id } = req.params;
        const isSuperAdmin = req.user?.role === 'SuperAdmin' || req.user?.role?.toLowerCase() === 'superadmin';
        let where = 'WHERE id = ? AND company_id = ?';
        let params = [id, req.company_id];
        if (!isSuperAdmin) {
            const targetBranchId = req.headers['x-branch-id'] ? parseInt(req.headers['x-branch-id']) : (req.branch_id || req.user?.branch_id);
            if (targetBranchId) {
                where += ' AND (branch_id = ? OR branch_id IS NULL)';
                params.push(targetBranchId);
            }
        }
        await pool.query(`DELETE FROM ${TABLE} ${where}`, params);
        res.json({ message: 'Pistola eliminada' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar pistola' });
    }
};
