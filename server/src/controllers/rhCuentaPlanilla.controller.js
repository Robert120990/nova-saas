const pool = require('../config/db');

const TABLE = 'rh_cuentas_planillas';
const LABEL = 'Cuenta de planilla';

const getCuentasPlanillas = async (req, res) => {
    try {
        const { search, page = 1, limit = 15 } = req.query;
        const offset = (page - 1) * limit;

        let query = `SELECT * FROM ${TABLE} WHERE company_id = ?`;
        let params = [req.company_id];

        if (search) {
            query += ` AND (codigo LIKE ? OR descripcion LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s);
        }

        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM (${query}) as sub`, params);
        const total = countResult[0].total;

        query += ` ORDER BY orden ASC, codigo ASC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getNextOrden = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT COALESCE(MAX(orden), 0) + 1 AS next FROM ${TABLE} WHERE company_id = ?`,
            [req.company_id]
        );
        res.json({ next: rows[0].next });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createCuentaPlanilla = async (req, res) => {
    try {
        const { codigo, descripcion, operacion, tipo_valor, activa, aparece_recibos, aparece_planilla, orden } = req.body;

        let finalOrden = parseInt(orden);
        if (!finalOrden || finalOrden < 1) {
            const [maxRow] = await pool.query(
                `SELECT COALESCE(MAX(orden), 0) + 1 AS next FROM ${TABLE} WHERE company_id = ?`,
                [req.company_id]
            );
            finalOrden = maxRow[0].next;
        }

        const [result] = await pool.query(
            `INSERT INTO ${TABLE} (codigo, descripcion, operacion, tipo_valor, activa, aparece_recibos, aparece_planilla, orden, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [codigo, descripcion, operacion || 'sumar', tipo_valor || 'valor', activa ?? 1, aparece_recibos ?? 1, aparece_planilla ?? 1, finalOrden, req.company_id]
        );
        res.status(201).json({ id: result.insertId, codigo, descripcion });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `El código de ${LABEL} ya existe en esta empresa` });
        }
        res.status(500).json({ message: error.message });
    }
};

const updateCuentaPlanilla = async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo, descripcion, operacion, tipo_valor, activa, aparece_recibos, aparece_planilla, orden } = req.body;
        const [result] = await pool.query(
            `UPDATE ${TABLE} SET codigo = ?, descripcion = ?, operacion = ?, tipo_valor = ?, activa = ?, aparece_recibos = ?, aparece_planilla = ?, orden = ? WHERE id = ? AND company_id = ?`,
            [codigo, descripcion, operacion, tipo_valor, activa ?? 1, aparece_recibos ?? 1, aparece_planilla ?? 1, orden || 0, id, req.company_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });
        res.json({ id, codigo, descripcion });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `El código de ${LABEL} ya existe en esta empresa` });
        }
        res.status(500).json({ message: error.message });
    }
};

const deleteCuentaPlanilla = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ? AND company_id = ?`, [id, req.company_id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });
        res.json({ message: `${LABEL} eliminada` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getCuentasPlanillas, getNextOrden, createCuentaPlanilla, updateCuentaPlanilla, deleteCuentaPlanilla };
