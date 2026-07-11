const pool = require('../config/db');

exports.getPendingRemesas = async (req, res) => {
    try {
        const { search, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let where = `WHERE r.entregada = 0 AND c.company_id = ?`;
        const params = [req.company_id];

        if (req.user.branch_id) {
            where += ` AND c.branch_id = ?`;
            params.push(req.user.branch_id);
        }

        if (search) {
            where += ` AND (r.codigo LIKE ? OR r.documento LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total
             FROM gas_station_closeout_remesas r
             JOIN gas_station_closeouts c ON r.closeout_id = c.id
             ${where}`,
            params
        );
        const total = countResult[0].total;

        const [rows] = await pool.query(
            `SELECT r.id, r.codigo, r.documento, r.descripcion, r.tipo_operacion, r.monto,
                    r.despachador_id, r.closeout_id, r.entregada,
                    c.numero_turno, c.fecha_turno,
                    d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
             FROM gas_station_closeout_remesas r
             JOIN gas_station_closeouts c ON r.closeout_id = c.id
             LEFT JOIN gas_station_despachadores d ON r.despachador_id = d.id
             ${where}
             ORDER BY c.fecha_turno DESC, r.id DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (error) {
        console.error('Error getPendingRemesas:', error);
        res.status(500).json({ message: 'Error al obtener remesas pendientes' });
    }
};

exports.createDelivery = async (req, res) => {
    try {
        const { fecha, hora, responsable, comentario, remesa_ids } = req.body;

        if (!fecha || !hora) {
            return res.status(400).json({ message: 'Fecha y hora son requeridas' });
        }
        if (!remesa_ids || !Array.isArray(remesa_ids) || remesa_ids.length === 0) {
            return res.status(400).json({ message: 'Debe seleccionar al menos una remesa' });
        }

        let remesaQuery = `SELECT r.id FROM gas_station_closeout_remesas r
             JOIN gas_station_closeouts c ON r.closeout_id = c.id
             WHERE r.id IN (?) AND c.company_id = ? AND r.entregada = 0`;
        const remesaParams = [remesa_ids, req.company_id];

        if (req.user.branch_id) {
            remesaQuery += ` AND c.branch_id = ?`;
            remesaParams.push(req.user.branch_id);
        }

        const [remesas] = await pool.query(remesaQuery, remesaParams);

        if (remesas.length !== remesa_ids.length) {
            const foundIds = remesas.map(r => r.id);
            const missing = remesa_ids.filter(id => !foundIds.includes(id));
            const [alreadyDelivered] = await pool.query(
                `SELECT id FROM gas_station_closeout_remesas WHERE id IN (?) AND entregada = 1`,
                [missing]
            );
            if (alreadyDelivered.length > 0) {
                return res.status(400).json({
                    message: `Algunas remesas ya están entregadas (IDs: ${alreadyDelivered.map(r => r.id).join(', ')})`
                });
            }
            return res.status(400).json({
                message: 'Algunas remesas no fueron encontradas o no están disponibles'
            });
        }

        const branch_id = req.user.branch_id || 0;

        const [result] = await pool.query(
            `INSERT INTO gas_station_remesa_deliveries (company_id, branch_id, fecha, hora, responsable, comentario) VALUES (?, ?, ?, ?, ?, ?)`,
            [req.company_id, branch_id, fecha, hora, responsable || '', comentario || '']
        );

        const deliveryId = result.insertId;

        await pool.query(
            `UPDATE gas_station_closeout_remesas SET entregada = 1, entrega_id = ? WHERE id IN (?)`,
            [deliveryId, remesa_ids]
        );

        const [delivery] = await pool.query(`
            SELECT d.*,
                   COUNT(r.id) as total_remesas,
                   COALESCE(SUM(r.monto), 0) as monto_total
            FROM gas_station_remesa_deliveries d
            LEFT JOIN gas_station_closeout_remesas r ON d.id = r.entrega_id
            WHERE d.id = ?
            GROUP BY d.id
        `, [deliveryId]);

        res.json(delivery[0]);
    } catch (error) {
        console.error('Error createDelivery:', error);
        res.status(500).json({ message: 'Error al crear entrega' });
    }
};

exports.updateDelivery = async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha, hora, responsable, comentario, remesa_ids } = req.body;

        const [deliveries] = await pool.query(
            `SELECT id FROM gas_station_remesa_deliveries WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (deliveries.length === 0) {
            return res.status(404).json({ message: 'Entrega no encontrada' });
        }

        if (!fecha || !hora) {
            return res.status(400).json({ message: 'Fecha y hora son requeridas' });
        }
        if (!remesa_ids || !Array.isArray(remesa_ids) || remesa_ids.length === 0) {
            return res.status(400).json({ message: 'Debe seleccionar al menos una remesa' });
        }

        let remesaQuery = `SELECT r.id FROM gas_station_closeout_remesas r
             JOIN gas_station_closeouts c ON r.closeout_id = c.id
             WHERE r.id IN (?) AND c.company_id = ? AND (r.entregada = 0 OR r.entrega_id = ?)`;
        const remesaParams = [remesa_ids, req.company_id, parseInt(id)];

        if (req.user.branch_id) {
            remesaQuery += ` AND c.branch_id = ?`;
            remesaParams.push(req.user.branch_id);
        }

        const [remesas] = await pool.query(remesaQuery, remesaParams);

        if (remesas.length !== remesa_ids.length) {
            return res.status(400).json({
                message: 'Algunas remesas no están disponibles (ya entregadas en otra entrega o no encontradas)'
            });
        }

        await pool.query(
            `UPDATE gas_station_remesa_deliveries SET fecha = ?, hora = ?, responsable = ?, comentario = ? WHERE id = ?`,
            [fecha, hora, responsable || '', comentario || '', id]
        );

        await pool.query(
            `UPDATE gas_station_closeout_remesas SET entregada = 0, entrega_id = NULL WHERE entrega_id = ? AND id NOT IN (?)`,
            [id, remesa_ids]
        );

        await pool.query(
            `UPDATE gas_station_closeout_remesas SET entregada = 1, entrega_id = ? WHERE id IN (?) AND entregada = 0`,
            [id, remesa_ids]
        );

        const [delivery] = await pool.query(`
            SELECT d.*,
                   COUNT(r.id) as total_remesas,
                   COALESCE(SUM(r.monto), 0) as monto_total
            FROM gas_station_remesa_deliveries d
            LEFT JOIN gas_station_closeout_remesas r ON d.id = r.entrega_id
            WHERE d.id = ?
            GROUP BY d.id
        `, [id]);

        res.json(delivery[0]);
    } catch (error) {
        console.error('Error updateDelivery:', error);
        res.status(500).json({ message: 'Error al actualizar entrega' });
    }
};

exports.getDeliveries = async (req, res) => {
    try {
        const { page = 1, limit = 20, search } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let where = `WHERE d.company_id = ?`;
        const params = [req.company_id];

        if (req.user.branch_id) {
            where += ` AND d.branch_id = ?`;
            params.push(req.user.branch_id);
        }

        if (search) {
            where += ` AND d.responsable LIKE ?`;
            params.push(`%${search}%`);
        }

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM gas_station_remesa_deliveries d ${where}`,
            params
        );
        const total = countResult[0].total;

        const [rows] = await pool.query(
            `SELECT d.*,
                    COUNT(r.id) as total_remesas,
                    COALESCE(SUM(r.monto), 0) as monto_total
             FROM gas_station_remesa_deliveries d
             LEFT JOIN gas_station_closeout_remesas r ON d.id = r.entrega_id
             ${where}
             GROUP BY d.id
             ORDER BY d.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (error) {
        console.error('Error getDeliveries:', error);
        res.status(500).json({ message: 'Error al obtener entregas' });
    }
};

exports.getDelivery = async (req, res) => {
    try {
        const { id } = req.params;

        const [deliveries] = await pool.query(
            `SELECT * FROM gas_station_remesa_deliveries WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );

        if (deliveries.length === 0) {
            return res.status(404).json({ message: 'Entrega no encontrada' });
        }

        const [remesas] = await pool.query(
            `SELECT r.*, c.numero_turno, c.fecha_turno,
                    d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
             FROM gas_station_closeout_remesas r
             JOIN gas_station_closeouts c ON r.closeout_id = c.id
             LEFT JOIN gas_station_despachadores d ON r.despachador_id = d.id
             WHERE r.entrega_id = ?
             ORDER BY r.id ASC`,
            [id]
        );

        res.json({ ...deliveries[0], remesas });
    } catch (error) {
        console.error('Error getDelivery:', error);
        res.status(500).json({ message: 'Error al obtener entrega' });
    }
};

exports.deleteDelivery = async (req, res) => {
    try {
        const { id } = req.params;

        const [deliveries] = await pool.query(
            `SELECT id FROM gas_station_remesa_deliveries WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );

        if (deliveries.length === 0) {
            return res.status(404).json({ message: 'Entrega no encontrada' });
        }

        await pool.query(
            `UPDATE gas_station_closeout_remesas SET entregada = 0, entrega_id = NULL WHERE entrega_id = ?`,
            [id]
        );

        await pool.query(`DELETE FROM gas_station_remesa_deliveries WHERE id = ?`, [id]);

        res.json({ message: 'Entrega eliminada' });
    } catch (error) {
        console.error('Error deleteDelivery:', error);
        res.status(500).json({ message: 'Error al eliminar entrega' });
    }
};
