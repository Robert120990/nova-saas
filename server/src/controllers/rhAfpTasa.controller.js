const pool = require('../config/db');

const TABLE = 'rh_afp_tasas';
const LABEL = 'Tasa de AFP';

const getAfpTasas = async (req, res) => {
    try {
        const { search, page = 1, limit = 15 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT t.id, t.company_id, t.afp_id, t.porcentaje_empleado, t.porcentaje_patrono, t.tope_quincenal, t.tope_mensual, t.created_at,
                   DATE_FORMAT(t.fecha_desde, '%Y-%m-%d') as fecha_desde,
                   DATE_FORMAT(t.fecha_hasta, '%Y-%m-%d') as fecha_hasta,
                   a.codigo as afp_codigo, a.descripcion as afp_descripcion
            FROM ${TABLE} t
            INNER JOIN rh_afp a ON a.id = t.afp_id
            WHERE t.company_id = ?
        `;
        let params = [req.company_id];

        if (search) {
            query += ` AND (a.descripcion LIKE ? OR a.codigo LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s);
        }

        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM (${query}) as sub`, params);
        const total = countResult[0].total;

        query += ` ORDER BY a.descripcion ASC, t.fecha_desde DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createAfpTasa = async (req, res) => {
    const { afp_id, fecha_desde, fecha_hasta, porcentaje_empleado, porcentaje_patrono, tope_quincenal, tope_mensual } = req.body;
    try {
        const [result] = await pool.query(
            `INSERT INTO ${TABLE} (afp_id, fecha_desde, fecha_hasta, porcentaje_empleado, porcentaje_patrono, tope_quincenal, tope_mensual, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [afp_id, fecha_desde, fecha_hasta || null, porcentaje_empleado, porcentaje_patrono, tope_quincenal, tope_mensual, req.company_id]
        );
        res.status(201).json({ id: result.insertId, afp_id, fecha_desde, fecha_hasta, porcentaje_empleado, porcentaje_patrono, tope_quincenal, tope_mensual });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `Ya existe una tasa configurada para esta AFP en la fecha ${fecha_desde}` });
        }
        res.status(500).json({ message: error.message });
    }
};

const updateAfpTasa = async (req, res) => {
    const { id } = req.params;
    const { afp_id, fecha_desde, fecha_hasta, porcentaje_empleado, porcentaje_patrono, tope_quincenal, tope_mensual } = req.body;
    try {
        const [result] = await pool.query(
            `UPDATE ${TABLE} SET afp_id = ?, fecha_desde = ?, fecha_hasta = ?, porcentaje_empleado = ?, porcentaje_patrono = ?, tope_quincenal = ?, tope_mensual = ? WHERE id = ? AND company_id = ?`,
            [afp_id, fecha_desde, fecha_hasta || null, porcentaje_empleado, porcentaje_patrono, tope_quincenal, tope_mensual, id, req.company_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });
        res.json({ id, afp_id, fecha_desde, fecha_hasta, porcentaje_empleado, porcentaje_patrono, tope_quincenal, tope_mensual });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `Ya existe una tasa configurada para esta AFP en la fecha ${fecha_desde}` });
        }
        res.status(500).json({ message: error.message });
    }
};

const deleteAfpTasa = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ? AND company_id = ?`, [id, req.company_id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });
        res.json({ message: `${LABEL} eliminada` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getAfpTasas, createAfpTasa, updateAfpTasa, deleteAfpTasa };
