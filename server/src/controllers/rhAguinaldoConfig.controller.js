const pool = require('../config/db');

const TABLE = 'rh_aguinaldo_config';
const LABEL = 'Configuración de Aguinaldo';

const getAguinaldoConfigs = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT id, company_id,
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

const getAguinaldoConfig = async (req, res) => {
    try {
        const { id } = req.params;
        const [configs] = await pool.query(
            `SELECT id, company_id,
                    DATE_FORMAT(fecha_desde, '%Y-%m-%d') as fecha_desde,
                    DATE_FORMAT(fecha_hasta, '%Y-%m-%d') as fecha_hasta,
                    created_at
             FROM ${TABLE} WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (configs.length === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });

        const [detalles] = await pool.query(
            `SELECT id, anios_desde, anios_hasta, dias_aguinaldo
             FROM rh_aguinaldo_config_detalle WHERE aguinaldo_config_id = ? ORDER BY anios_desde ASC`,
            [id]
        );

        res.json({ ...configs[0], detalles });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createAguinaldoConfig = async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const { fecha_desde, fecha_hasta, detalles } = req.body;

        const [result] = await connection.query(
            `INSERT INTO ${TABLE} (fecha_desde, fecha_hasta, company_id) VALUES (?, ?, ?)`,
            [fecha_desde, fecha_hasta || null, req.company_id]
        );
        const configId = result.insertId;

        if (detalles && detalles.length > 0) {
            for (const det of detalles) {
                await connection.query(
                    `INSERT INTO rh_aguinaldo_config_detalle (aguinaldo_config_id, anios_desde, anios_hasta, dias_aguinaldo) VALUES (?, ?, ?, ?)`,
                    [configId, det.anios_desde, det.anios_hasta, det.dias_aguinaldo]
                );
            }
        }

        await connection.commit();
        res.status(201).json({ id: configId, message: `${LABEL} creada exitosamente` });
    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `Ya existe una configuración para esta fecha` });
        }
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

const updateAguinaldoConfig = async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const { id } = req.params;
        const { fecha_desde, fecha_hasta, detalles } = req.body;

        const [check] = await connection.query(`SELECT id FROM ${TABLE} WHERE id = ? AND company_id = ?`, [id, req.company_id]);
        if (check.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: `${LABEL} no encontrada` });
        }

        await connection.query(
            `UPDATE ${TABLE} SET fecha_desde = ?, fecha_hasta = ? WHERE id = ? AND company_id = ?`,
            [fecha_desde, fecha_hasta || null, id, req.company_id]
        );

        await connection.query(`DELETE FROM rh_aguinaldo_config_detalle WHERE aguinaldo_config_id = ?`, [id]);

        if (detalles && detalles.length > 0) {
            for (const det of detalles) {
                await connection.query(
                    `INSERT INTO rh_aguinaldo_config_detalle (aguinaldo_config_id, anios_desde, anios_hasta, dias_aguinaldo) VALUES (?, ?, ?, ?)`,
                    [id, det.anios_desde, det.anios_hasta, det.dias_aguinaldo]
                );
            }
        }

        await connection.commit();
        res.json({ message: `${LABEL} actualizada exitosamente` });
    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `Ya existe una configuración para esta fecha` });
        }
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

const deleteAguinaldoConfig = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ? AND company_id = ?`, [id, req.company_id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });
        res.json({ message: `${LABEL} eliminada` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getAguinaldoConfigs, getAguinaldoConfig, createAguinaldoConfig, updateAguinaldoConfig, deleteAguinaldoConfig };
