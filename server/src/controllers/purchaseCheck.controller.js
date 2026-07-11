const pool = require('../config/db');
const mysql = require('mysql2/promise');

let rrsPool = null;
function getRrsPool() {
    if (rrsPool) return rrsPool;
    rrsPool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: 'db_system_rrs',
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        decimalNumbers: true,
        enableKeepAlive: true,
        keepAliveInitialDelay: 30000
    });
    return rrsPool;
}

const getChecks = async (req, res) => {
    try {
        const { search, page = 1, limit = 15, branch_id, destino, status } = req.query;
        const offset = (page - 1) * limit;
        const companyId = req.company_id || req.user?.company_id;
        const branchFilter = branch_id || req.user?.branch_id;

        let query = `
            SELECT pc.*,
                   p.nombre AS provider_nombre,
                   p.nrc AS provider_nrc,
                   b.nombre AS branch_nombre,
                   u.nombre AS usuario_nombre
            FROM purchase_checks pc
            LEFT JOIN providers p ON pc.provider_id = p.id
            LEFT JOIN branches b ON pc.branch_id = b.id
            LEFT JOIN users u ON pc.usuario_id = u.id
            WHERE pc.company_id = ?
        `;
        let params = [companyId];

        if (branchFilter) {
            query += " AND pc.branch_id = ?";
            params.push(branchFilter);
        }

        if (destino) {
            query += " AND pc.destino = ?";
            params.push(destino);
        }

        if (status) {
            query += " AND pc.status = ?";
            params.push(status);
        }

        if (search) {
            query += ` AND (p.nombre LIKE ? OR pc.documento LIKE ?) `;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }

        const countQuery = `SELECT COUNT(*) as total FROM (${query}) as sub`;
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        query += ` ORDER BY pc.fecha DESC, pc.id DESC LIMIT ? OFFSET ? `;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);

        res.json({
            data: rows,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error al obtener cheques:', error);
        res.status(500).json({ message: 'Error al obtener cheques' });
    }
};

const getCheckById = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.user?.company_id;

        const [rows] = await pool.query(`
            SELECT pc.*,
                   p.nombre AS provider_nombre,
                   b.nombre AS branch_nombre
            FROM purchase_checks pc
            LEFT JOIN providers p ON pc.provider_id = p.id
            LEFT JOIN branches b ON pc.branch_id = b.id
            WHERE pc.id = ? AND pc.company_id = ?
        `, [id, companyId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Cheque no encontrado' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Error al obtener detalle del cheque:', error);
        res.status(500).json({ message: 'Error al obtener detalle del cheque' });
    }
};

const createCheck = async (req, res) => {
    try {
        const { branch_id, fecha, provider_id, monto, destino } = req.body;
        const companyId = req.company_id || req.user?.company_id;
        const usuarioId = req.user?.id;
        const branchId = branch_id || req.user?.branch_id;

        if (!fecha || !provider_id || !monto || !destino) {
            return res.status(400).json({ message: 'Fecha, proveedor, monto y destino son requeridos' });
        }

        if (!['P', 'T'].includes(destino)) {
            return res.status(400).json({ message: 'Destino debe ser P (Pista) o T (Tienda)' });
        }

        const [result] = await pool.query(`
            INSERT INTO purchase_checks (company_id, branch_id, provider_id, fecha, monto, destino, usuario_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [companyId, branchId, provider_id, fecha, monto, destino, usuarioId]);

        res.status(201).json({ message: 'Cheque registrado con éxito', id: result.insertId });
    } catch (error) {
        console.error('Error al registrar cheque:', error);
        res.status(500).json({ message: 'Error al registrar cheque: ' + error.message });
    }
};

const updateCheck = async (req, res) => {
    try {
        const { id } = req.params;
        const { branch_id, fecha, provider_id, monto, destino } = req.body;
        const companyId = req.company_id || req.user?.company_id;

        const [existing] = await pool.query(
            'SELECT * FROM purchase_checks WHERE id = ? AND company_id = ?',
            [id, companyId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: 'Cheque no encontrado' });
        }

        if (existing[0].status !== 'PENDIENTE') {
            return res.status(400).json({ message: 'No se puede editar un cheque que ya fue ' + existing[0].status.toLowerCase() });
        }

        await pool.query(`
            UPDATE purchase_checks SET
                branch_id = ?, fecha = ?, provider_id = ?, monto = ?, destino = ?
            WHERE id = ? AND company_id = ?
        `, [
            branch_id || existing[0].branch_id,
            fecha || existing[0].fecha,
            provider_id || existing[0].provider_id,
            monto || existing[0].monto,
            destino || existing[0].destino,
            id, companyId
        ]);

        res.json({ message: 'Cheque actualizado con éxito' });
    } catch (error) {
        console.error('Error al actualizar cheque:', error);
        res.status(500).json({ message: 'Error al actualizar cheque: ' + error.message });
    }
};

const deleteCheck = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.user?.company_id;

        const [existing] = await pool.query(
            'SELECT * FROM purchase_checks WHERE id = ? AND company_id = ?',
            [id, companyId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: 'Cheque no encontrado' });
        }

        if (existing[0].status !== 'PENDIENTE') {
            return res.status(400).json({ message: 'No se puede eliminar un cheque que ya fue ' + existing[0].status.toLowerCase() });
        }

        await pool.query('DELETE FROM purchase_checks WHERE id = ? AND company_id = ?', [id, companyId]);

        res.json({ message: 'Cheque eliminado con éxito' });
    } catch (error) {
        console.error('Error al eliminar cheque:', error);
        res.status(500).json({ message: 'Error al eliminar cheque: ' + error.message });
    }
};

const deliverCheck = async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha_entrega, documento } = req.body;
        const companyId = req.company_id || req.user?.company_id;

        if (!fecha_entrega) {
            return res.status(400).json({ message: 'Fecha de entrega es requerida' });
        }

        const [existing] = await pool.query(
            'SELECT * FROM purchase_checks WHERE id = ? AND company_id = ?',
            [id, companyId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: 'Cheque no encontrado' });
        }

        if (existing[0].status !== 'PENDIENTE') {
            return res.status(400).json({ message: 'El cheque ya fue ' + existing[0].status.toLowerCase() });
        }

        await pool.query(`
            UPDATE purchase_checks SET
                status = 'ENTREGADO',
                fecha_entrega = ?,
                documento = ?
            WHERE id = ? AND company_id = ?
        `, [fecha_entrega, documento || null, id, companyId]);

        res.json({ message: 'Cheque marcado como entregado con éxito' });
    } catch (error) {
        console.error('Error al entregar cheque:', error);
        res.status(500).json({ message: 'Error al entregar cheque: ' + error.message });
    }
};

const requestCheck = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.user?.company_id;

        const [existing] = await pool.query(
            `SELECT pc.*, p.nrc AS provider_nrc, p.nombre AS provider_nombre
             FROM purchase_checks pc
             LEFT JOIN providers p ON pc.provider_id = p.id
             WHERE pc.id = ? AND pc.company_id = ?`,
            [id, companyId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: 'Cheque no encontrado' });
        }

        const check = existing[0];

        if (check.status !== 'PENDIENTE') {
            return res.status(400).json({ message: 'Solo se pueden solicitar cheques en estado PENDIENTE' });
        }

        const [configs] = await pool.query(
            'SELECT * FROM branch_chq_config WHERE company_id = ? AND branch_id = ?',
            [companyId, check.branch_id]
        );

        if (configs.length === 0) {
            return res.status(400).json({
                message: 'Configuración de Chq Contado no encontrada para esta sucursal. Primero configure el código de destino en Ajustes.'
            });
        }

        const config = configs[0];

        const nrc = (check.provider_nrc || '').replace(/\s/g, '');
        const codProveedor = `015${check.id}${nrc}`;
        const llave = `${config.rrs_id_empresa}-CHQ${String(check.id).padStart(20, '0')}`;
        const tipoDestino = check.destino === 'P' ? 'PISTA' : 'TIENDA';
        const fechaDate = check.fecha instanceof Date
            ? check.fecha.toISOString().split('T')[0]
            : String(check.fecha).substring(0, 10);

        const rrs = getRrsPool();
        const conn = await rrs.getConnection();
        try {
            const [result] = await conn.execute(`
                INSERT INTO solicitud_chq_contado
                    (id_empresa, fecha, cod_proveedor, monto, fecha_entrega, num_ccf, num_cheque,
                     llave_cheque, llave, cod_destino, tipo_destino, id_rubro)
                VALUES (?, ?, ?, ?, ' ', ' ', ' ', ' ', ?, ?, ?, ?)
            `, [
                config.rrs_id_empresa,
                fechaDate,
                codProveedor,
                parseFloat(check.monto) || 0,
                llave,
                config.cod_destino,
                tipoDestino,
                ''
            ]);

            const corr = result.insertId;

            await pool.query(
                "UPDATE purchase_checks SET status = 'SOLICITADO' WHERE id = ? AND company_id = ?",
                [id, companyId]
            );

            res.json({ message: 'Solicitud enviada a RRS con éxito', corr, llave });
        } catch (error) {
            await conn.rollback().catch(() => {});
            throw error;
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Error al solicitar cheque:', error);
        res.status(500).json({ message: 'Error al solicitar cheque a RRS: ' + error.message });
    }
};

const getChqConfig = async (req, res) => {
    try {
        const { branchId } = req.params;
        const companyId = req.company_id || req.user?.company_id;

        const [configs] = await pool.query(
            'SELECT * FROM branch_chq_config WHERE company_id = ? AND branch_id = ?',
            [companyId, branchId]
        );

        let destinos = [];
        try {
            const rrs = getRrsPool();
            const [rows] = await rrs.query(
                `SELECT dc.*, e.nombre as estacion_nombre
                 FROM destinos_cheques dc
                 JOIN empresas e ON e.id = dc.id_estacion
                 WHERE e.id_empresa_mayor IN (SELECT id_empresa_mayor FROM empresas WHERE id = ?)
                 ORDER BY dc.id`,
                [configs.length > 0 ? configs[0].rrs_id_empresa : '']
            );
            destinos = rows;
        } catch (e) {
            console.error('Error fetching destinos from RRS:', e.message);
        }

        res.json({
            config: configs.length > 0 ? configs[0] : null,
            destinos
        });
    } catch (error) {
        console.error('Error al obtener config:', error);
        res.status(500).json({ message: 'Error al obtener configuración' });
    }
};

const saveChqConfig = async (req, res) => {
    try {
        const { branch_id, rrs_id_empresa, cod_destino } = req.body;
        const companyId = req.company_id || req.user?.company_id;

        if (!branch_id || !rrs_id_empresa || !cod_destino) {
            return res.status(400).json({ message: 'branch_id, rrs_id_empresa y cod_destino son requeridos' });
        }

        await pool.query(`
            INSERT INTO branch_chq_config (company_id, branch_id, rrs_id_empresa, cod_destino, id_rubro)
            VALUES (?, ?, ?, ?, '')
            ON DUPLICATE KEY UPDATE
                rrs_id_empresa = VALUES(rrs_id_empresa),
                cod_destino = VALUES(cod_destino),
                id_rubro = ''
        `, [companyId, branch_id, rrs_id_empresa, cod_destino]);

        res.json({ message: 'Configuración guardada con éxito' });
    } catch (error) {
        console.error('Error al guardar config:', error);
        res.status(500).json({ message: 'Error al guardar configuración: ' + error.message });
    }
};

module.exports = {
    getChecks,
    getCheckById,
    createCheck,
    updateCheck,
    deleteCheck,
    deliverCheck,
    requestCheck,
    getChqConfig,
    saveChqConfig
};
