const pool = require('../config/db');
const notificationService = require('../services/notification.service');
const asyncHandler = require('../utils/asyncHandler');

const cleanEmptyStrings = (body) => {
    const data = {};
    Object.entries(body || {}).forEach(([key, value]) => {
        if (!(typeof value === 'string' && value.trim() === '')) {
            data[key] = value;
        }
    });
    return data;
};

const respondDupEntry = (error, res) => {
    const msg = error.sqlMessage?.includes('codigo_mh')
        ? 'El código MH ya existe en esta empresa'
        : 'El código de sucursal ya existe en esta empresa';
    res.status(409).json({ message: msg });
};

const getBranches = asyncHandler(async (req, res) => {
    const companyId = req.query.company_id || req.company_id;
    const userId = req.user.id;
    const isSuperAdmin = req.user.role === 'SuperAdmin';

    let sql = `
        SELECT b.*,
               d.description AS departamento_nombre,
               m.description AS municipio_nombre,
               dist.description AS distrito_nombre
        FROM branches b
        LEFT JOIN cat_012_departamento d ON b.departamento = d.code
        LEFT JOIN cat_013_municipio m ON b.municipio = m.code and b.departamento = m.dep_code
        LEFT JOIN cat_008_distrito dist ON b.distrito = dist.code AND b.departamento = dist.dep_code
        WHERE b.company_id = ?
    `;
    let params = [companyId];

    if (!isSuperAdmin) {
        sql += ` AND b.id IN (SELECT sucursal_id FROM usuario_sucursal WHERE usuario_id = ?)`;
        params.push(userId);
    }

    const [rows] = await pool.query(sql, params);
    res.json(rows);
});

const createBranch = asyncHandler(async (req, res) => {
    const codigo = (req.body.codigo || '').trim();
    const nombre = (req.body.nombre || '').trim();
    if (!codigo || !nombre) {
        return res.status(400).json({ message: 'El código y el nombre de la sucursal son obligatorios' });
    }
    const data = cleanEmptyStrings(req.body);
    data.codigo = codigo;
    data.nombre = nombre;
    data.tipo_establecimiento = req.body.tipo_establecimiento || '01';
    data.company_id = req.company_id;
    if (req.file) {
        data.logo_url = '/uploads/' + req.file.filename;
    }
    try {
        const [result] = await pool.query('INSERT INTO branches SET ?', [data]);
        notificationService.notify('branch_created', req.company_id, result.insertId, {
            sucursal_id: result.insertId,
            nombre,
            codigo
        }).catch(() => {});
        res.status(201).json({ id: result.insertId, ...data });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return respondDupEntry(error, res);
        throw error;
    }
});

const updateBranch = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = cleanEmptyStrings(req.body);
    if (req.file) {
        data.logo_url = '/uploads/' + req.file.filename;
    }
    if (Object.keys(data).length === 0) {
        return res.status(400).json({ message: 'No hay datos para actualizar' });
    }
    try {
        const [result] = await pool.query('UPDATE branches SET ? WHERE id = ? AND company_id = ?', [data, id, req.company_id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Establecimiento no encontrado' });
        res.json({ message: 'Establecimiento actualizado' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return respondDupEntry(error, res);
        throw error;
    }
});

const deleteBranch = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await pool.query('DELETE FROM branches WHERE id = ? AND company_id = ?', [id, req.company_id]);
    res.json({ message: 'Sucursal eliminada' });
});

module.exports = { getBranches, createBranch, updateBranch, deleteBranch };
