const pool = require('../config/db');

const TABLE = 'rh_renta_config';
const LABEL = 'Configuración de Renta';

const getRentaConfigs = async (req, res) => {
    try {
        const { search, page = 1, limit = 15 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT id, company_id, tipo,
                   DATE_FORMAT(fecha_desde, '%Y-%m-%d') as fecha_desde,
                   DATE_FORMAT(fecha_hasta, '%Y-%m-%d') as fecha_hasta,
                   created_at
            FROM ${TABLE}
            WHERE company_id = ?
        `;
        let params = [req.company_id];

        if (search) {
            query += ` AND (tipo LIKE ? OR fecha_desde LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s);
        }

        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM (${query}) as sub`, params);
        const total = countResult[0].total;

        query += ` ORDER BY tipo ASC, fecha_desde DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getRentaConfig = async (req, res) => {
    try {
        const { id } = req.params;
        const [configs] = await pool.query(
            `SELECT id, company_id, tipo,
                    DATE_FORMAT(fecha_desde, '%Y-%m-%d') as fecha_desde,
                    DATE_FORMAT(fecha_hasta, '%Y-%m-%d') as fecha_hasta,
                    created_at
             FROM ${TABLE} WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (configs.length === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });

        const [detalles] = await pool.query(
            `SELECT id, sueldo_inicial, sueldo_final, porcentaje, valor_descuento, exceso
             FROM rh_renta_config_detalle WHERE renta_config_id = ? ORDER BY sueldo_inicial ASC`,
            [id]
        );

        res.json({ ...configs[0], detalles });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createRentaConfig = async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const { tipo, fecha_desde, fecha_hasta, detalles } = req.body;

        const [result] = await connection.query(
            `INSERT INTO ${TABLE} (tipo, fecha_desde, fecha_hasta, company_id) VALUES (?, ?, ?, ?)`,
            [tipo, fecha_desde, fecha_hasta || null, req.company_id]
        );
        const configId = result.insertId;

        if (detalles && detalles.length > 0) {
            for (const det of detalles) {
                await connection.query(
                    `INSERT INTO rh_renta_config_detalle (renta_config_id, sueldo_inicial, sueldo_final, porcentaje, valor_descuento, exceso) VALUES (?, ?, ?, ?, ?, ?)`,
                    [configId, det.sueldo_inicial, det.sueldo_final, det.porcentaje, det.valor_descuento, det.exceso]
                );
            }
        }

        await connection.commit();
        res.status(201).json({ id: configId, message: `${LABEL} creada exitosamente` });
    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `Ya existe una configuración para este tipo y fecha` });
        }
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

const updateRentaConfig = async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const { id } = req.params;
        const { tipo, fecha_desde, fecha_hasta, detalles } = req.body;

        const [check] = await connection.query(`SELECT id FROM ${TABLE} WHERE id = ? AND company_id = ?`, [id, req.company_id]);
        if (check.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: `${LABEL} no encontrada` });
        }

        await connection.query(
            `UPDATE ${TABLE} SET tipo = ?, fecha_desde = ?, fecha_hasta = ? WHERE id = ? AND company_id = ?`,
            [tipo, fecha_desde, fecha_hasta || null, id, req.company_id]
        );

        await connection.query(`DELETE FROM rh_renta_config_detalle WHERE renta_config_id = ?`, [id]);

        if (detalles && detalles.length > 0) {
            for (const det of detalles) {
                await connection.query(
                    `INSERT INTO rh_renta_config_detalle (renta_config_id, sueldo_inicial, sueldo_final, porcentaje, valor_descuento, exceso) VALUES (?, ?, ?, ?, ?, ?)`,
                    [id, det.sueldo_inicial, det.sueldo_final, det.porcentaje, det.valor_descuento, det.exceso]
                );
            }
        }

        await connection.commit();
        res.json({ message: `${LABEL} actualizada exitosamente` });
    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `Ya existe una configuración para este tipo y fecha` });
        }
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

const deleteRentaConfig = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ? AND company_id = ?`, [id, req.company_id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });
        res.json({ message: `${LABEL} eliminada` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getRentaConfigs, getRentaConfig, createRentaConfig, updateRentaConfig, deleteRentaConfig };
