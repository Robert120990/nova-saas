const pool = require('../config/db');

const getBranches = async (req, res) => {
    const companyId = req.query.company_id || req.company_id;
    const userId = req.user.id;
    const isSuperAdmin = req.user.role === 'SuperAdmin';

    try {
        let sql = `
            SELECT b.*,
                   d.description AS departamento_nombre,
                   m.description AS municipio_nombre
            FROM branches b
            LEFT JOIN cat_012_departamento d ON b.departamento = d.code
            LEFT JOIN cat_013_municipio m ON b.municipio = m.code and b.departamento = m.dep_code
            WHERE b.company_id = ?
        `;
        let params = [companyId];

        if (!isSuperAdmin) {
            sql += ` AND b.id IN (SELECT sucursal_id FROM usuario_sucursal WHERE usuario_id = ?)`;
            params.push(userId);
        }

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener sucursales' });
    }
};

const createBranch = async (req, res) => {
    const { tipo_establecimiento, ...otherData } = req.body;
    console.log('CREATE BRANCH body:', req.body);
    console.log('CREATE BRANCH file:', req.file);
    const data = {
        ...otherData,
        tipo_establecimiento: tipo_establecimiento || '01',
        company_id: req.company_id
    };
    if (req.file) {
        data.logo_url = '/uploads/' + req.file.filename;
    }
    try {
        const [result] = await pool.query('INSERT INTO branches SET ?', [data]);
        res.status(201).json({ id: result.insertId, ...data });
    } catch (error) {
        console.error('CREATE ERROR:', error);
        res.status(500).json({ message: 'Error al crear establecimiento', error: error.message });
    }
};

const updateBranch = async (req, res) => {
    const { id } = req.params;
    console.log('UPDATE BRANCH - id:', id, 'company_id:', req.company_id);
    console.log('UPDATE BRANCH - body:', JSON.stringify(req.body));
    console.log('UPDATE BRANCH - file:', req.file);

    const data = { ...req.body };
    if (req.file) {
        data.logo_url = '/uploads/' + req.file.filename;
    }

    console.log('UPDATE BRANCH - final data:', JSON.stringify(data));

    try {
        const [result] = await pool.query('UPDATE branches SET ? WHERE id = ? AND company_id = ?', [data, id, req.company_id]);
        console.log('UPDATE BRANCH - rows affected:', result.affectedRows);
        res.json({ message: 'Establecimiento actualizado' });
    } catch (error) {
        console.error('UPDATE ERROR:', error);
        res.status(500).json({ message: 'Error al actualizar establecimiento', error: error.message });
    }
};

const deleteBranch = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM branches WHERE id = ? AND company_id = ?', [id, req.company_id]);
        res.json({ message: 'Sucursal eliminada' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar sucursal' });
    }
};

module.exports = { getBranches, createBranch, updateBranch, deleteBranch };
