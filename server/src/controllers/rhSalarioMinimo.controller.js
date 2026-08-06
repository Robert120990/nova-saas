const pool = require('../config/db');

const TABLE = 'rh_salario_minimo_config';
const LABEL = 'Configuración de Salario Mínimo';

const getSalarioMinimoConfigs = async (req, res) => {
    try {
        const { search, page = 1, limit = 15 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT id, company_id, monto,
                   DATE_FORMAT(fecha_desde, '%Y-%m-%d') as fecha_desde,
                   DATE_FORMAT(fecha_hasta, '%Y-%m-%d') as fecha_hasta,
                   created_at
            FROM ${TABLE}
            WHERE company_id = ?
        `;
        let params = [req.company_id];

        if (search) {
            query += ` AND fecha_desde LIKE ?`;
            params.push(`%${search}%`);
        }

        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM (${query}) as sub`, params);
        const total = countResult[0].total;

        query += ` ORDER BY fecha_desde DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createSalarioMinimoConfig = async (req, res) => {
    const { fecha_desde, fecha_hasta, monto } = req.body;
    try {
        const [result] = await pool.query(
            `INSERT INTO ${TABLE} (fecha_desde, fecha_hasta, monto, company_id) VALUES (?, ?, ?, ?)`,
            [fecha_desde, fecha_hasta || null, monto, req.company_id]
        );
        res.status(201).json({ id: result.insertId, fecha_desde, fecha_hasta, monto });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `Ya existe una configuración para la fecha ${fecha_desde}` });
        }
        res.status(500).json({ message: error.message });
    }
};

const updateSalarioMinimoConfig = async (req, res) => {
    const { id } = req.params;
    const { fecha_desde, fecha_hasta, monto } = req.body;
    try {
        const [result] = await pool.query(
            `UPDATE ${TABLE} SET fecha_desde = ?, fecha_hasta = ?, monto = ? WHERE id = ? AND company_id = ?`,
            [fecha_desde, fecha_hasta || null, monto, id, req.company_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });
        res.json({ id, fecha_desde, fecha_hasta, monto });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `Ya existe una configuración para la fecha ${fecha_desde}` });
        }
        res.status(500).json({ message: error.message });
    }
};

const deleteSalarioMinimoConfig = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ? AND company_id = ?`, [id, req.company_id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });
        res.json({ message: `${LABEL} eliminada` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getSalarioMinimoConfigs, createSalarioMinimoConfig, updateSalarioMinimoConfig, deleteSalarioMinimoConfig };
