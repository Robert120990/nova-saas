const pool = require('../config/db');
const { getRrsPool } = require('../config/rrsDb');

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

        const getSearchWords = (term) => {
            const words = term.trim().split(/\s+/).filter(Boolean);
            return [...new Set(words)];
        };

        const searchWords = search ? getSearchWords(search) : [];
        searchWords.forEach(word => {
            query += ` AND (p.nombre LIKE ? OR p.nombre_comercial LIKE ? OR p.nit LIKE ? OR p.nrc LIKE ? OR pc.documento LIKE ?) `;
            const searchTerm = `%${word}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        });

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

        const [empresaRows] = await pool.query(
            'SELECT setting_value FROM sales_settings WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL)) AND setting_key = ?',
            [companyId, check.branch_id || null, check.branch_id || null, 'empresa_rrs']
        );
        const rrsEmpresa = empresaRows[0]?.setting_value || '015';

        const nrc = (check.provider_nrc || '').replace(/\s/g, '');
        const codProveedor = `${rrsEmpresa}${check.provider_id}${nrc}`;
        const llave = `${check.id}`;
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

const syncProviders = async (req, res) => {
    try {
        const { branch_id } = req.body;
        const companyId = req.company_id || req.user?.company_id;

        if (!branch_id) {
            return res.status(400).json({ message: 'branch_id es requerido' });
        }

        const [configs] = await pool.query(
            'SELECT * FROM branch_chq_config WHERE company_id = ? AND branch_id = ?',
            [companyId, branch_id]
        );

        if (configs.length === 0) {
            return res.status(400).json({
                message: 'Configuración de Chq Contado no encontrada para esta sucursal. Primero configure el código de destino.'
            });
        }

        const rrsIdEmpresa = configs[0].rrs_id_empresa;
        const rrsEmpresa = rrsIdEmpresa || '015';

        const [providers] = await pool.query(
            'SELECT id, nombre, nombre_comercial, nit, nrc, direccion, telefono, correo FROM providers WHERE company_id = ?',
            [companyId]
        );

        const rrs = getRrsPool();
        let created = 0;
        let updated = 0;
        let errors = [];

        for (const p of providers) {
            try {
                const nrc = (p.nrc || '').replace(/\s/g, '');
                const nit = (p.nit || '').replace(/\s/g, '');
                const codigoBusqueda = `${rrsEmpresa}${p.id}${nrc}`;

                let existing = null;

                if (nit) {
                    const [rows] = await rrs.query(
                        'SELECT * FROM proveedores WHERE id_empresa = ? AND nit = ?',
                        [rrsIdEmpresa, nit]
                    );
                    if (rows.length > 0) existing = rows[0];
                }

                if (!existing && nrc) {
                    const [rows] = await rrs.query(
                        'SELECT * FROM proveedores WHERE id_empresa = ? AND nrc = ?',
                        [rrsIdEmpresa, nrc]
                    );
                    if (rows.length > 0) existing = rows[0];
                }

                if (!existing) {
                    const [rows] = await rrs.query(
                        'SELECT * FROM proveedores WHERE id_empresa = ? AND codigo = ?',
                        [rrsIdEmpresa, codigoBusqueda]
                    );
                    if (rows.length > 0) existing = rows[0];
                }

                if (existing) {
                    await rrs.query(`
                        UPDATE proveedores SET
                            codigo = ?,
                            nombre = ?,
                            nombre_comercial = ?,
                            direccion = ?,
                            telefono = ?,
                            correo = ?,
                            nrc = ?,
                            nit = ?
                        WHERE id = ? AND id_empresa = ?
                    `, [
                        codigoBusqueda,
                        (p.nombre || '').substring(0, 80),
                        (p.nombre_comercial || '').substring(0, 150),
                        (p.direccion || '').substring(0, 100),
                        (p.telefono || '').substring(0, 20),
                        (p.correo || '').substring(0, 150),
                        nrc || '',
                        nit || '',
                        existing.id,
                        rrsIdEmpresa
                    ]);
                    updated++;
                } else {
                    const providerId = `${rrsIdEmpresa}-${companyId}-${p.id}`;
                    await rrs.query(`
                        INSERT INTO proveedores
                            (id, id_empresa, codigo, nombre, nombre_comercial, direccion, telefono,
                             correo, nit, nrc, tipo, es_exento, es_extranjero, con_retencion,
                             con_percepcion, con_credito, limite_credito, cuenta_contable,
                             es_exento_fovial, dif, napa, rnpa, id_tipo_doc, id_tipo_per, id_giro,
                             es_exento_cotrans)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'P', 0, 0, 0, 0, 0, 0, '', 0, '', '', '', '', '', '', 0)
                    `, [
                        providerId,
                        rrsIdEmpresa,
                        codigoBusqueda,
                        (p.nombre || '').substring(0, 80),
                        (p.nombre_comercial || '').substring(0, 150),
                        (p.direccion || '').substring(0, 100),
                        (p.telefono || '').substring(0, 20),
                        (p.correo || '').substring(0, 150),
                        nit || '',
                        nrc || ''
                    ]);
                    created++;
                }
            } catch (e) {
                errors.push(`Proveedor #${p.id} (${p.nombre}): ${e.message}`);
            }
        }

        res.json({
            message: `Sincronización completada. Creados: ${created}, Actualizados: ${updated}, Errores: ${errors.length}`,
            created,
            updated,
            errors
        });
    } catch (error) {
        console.error('Error al sincronizar proveedores:', error);
        res.status(500).json({ message: 'Error al sincronizar proveedores: ' + error.message });
    }
};

const revertCheck = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.user?.company_id;

        const [existing] = await pool.query(
            `SELECT pc.*, p.nrc AS provider_nrc
             FROM purchase_checks pc
             LEFT JOIN providers p ON pc.provider_id = p.id
             WHERE pc.id = ? AND pc.company_id = ?`,
            [id, companyId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: 'Cheque no encontrado' });
        }

        const check = existing[0];

        if (check.status !== 'SOLICITADO') {
            return res.status(400).json({ message: 'Solo se pueden revertir cheques en estado SOLICITADO' });
        }

        const [configs] = await pool.query(
            'SELECT * FROM branch_chq_config WHERE company_id = ? AND branch_id = ?',
            [companyId, check.branch_id]
        );

        const rrsIdEmpresa = configs.length > 0 ? configs[0].rrs_id_empresa : '';
        const llave = `${rrsIdEmpresa}-${check.id}`;

        const rrs = getRrsPool();
        const [deleted] = await rrs.query(
            'DELETE FROM solicitud_chq_contado WHERE llave = ?',
            [llave]
        );

        await pool.query(
            "UPDATE purchase_checks SET status = 'PENDIENTE' WHERE id = ? AND company_id = ?",
            [id, companyId]
        );

        res.json({
            message: `Solicitud revertida con éxito. ${deleted.affectedRows > 0 ? 'Registro eliminado de RRS.' : 'No se encontró registro en RRS.'}`
        });
    } catch (error) {
        console.error('Error al revertir cheque:', error);
        res.status(500).json({ message: 'Error al revertir cheque: ' + error.message });
    }
};

const getRrsNumCheque = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.json({});
        }

        const companyId = req.company_id || req.user?.company_id;

        const [checks] = await pool.query(
            'SELECT id, branch_id FROM purchase_checks WHERE id IN (?) AND company_id = ?',
            [ids, companyId]
        );

        if (checks.length === 0) return res.json({});

        const branchIds = [...new Set(checks.map(c => c.branch_id))];

        const [configs] = await pool.query(
            'SELECT branch_id, rrs_id_empresa FROM branch_chq_config WHERE company_id = ? AND branch_id IN (?)',
            [companyId, branchIds]
        );

        const branchRrsMap = {};
        for (const cfg of configs) {
            branchRrsMap[cfg.branch_id] = cfg.rrs_id_empresa;
        }

        const rrs = getRrsPool();
        const llaveToCheckId = {};
        const llaves = [];

        for (const check of checks) {
            const rrsId = branchRrsMap[check.branch_id];
            if (!rrsId) continue;
            const llave = `${rrsId}-${check.id}`;
            llaveToCheckId[llave] = check.id;
            llaves.push(llave);
        }

        if (llaves.length === 0) return res.json({});

        const [rrsRows] = await rrs.query(
            `SELECT llave, num_cheque FROM solicitud_chq_contado WHERE llave IN (?) AND num_cheque != ' ' AND num_cheque IS NOT NULL`,
            [llaves]
        );

        const result = {};

        for (const row of rrsRows) {
            const checkId = llaveToCheckId[row.llave];
            if (checkId && row.num_cheque && row.num_cheque.trim()) {
                const numCheque = row.num_cheque.trim();
                result[checkId] = numCheque;
                await pool.query(
                    'UPDATE purchase_checks SET rrs_num_cheque = ? WHERE id = ?',
                    [numCheque, checkId]
                );
            }
        }

        res.json(result);
    } catch (error) {
        console.error('Error al obtener num_cheque de RRS:', error);
        res.status(500).json({ message: 'Error al obtener num_cheque de RRS: ' + error.message });
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
    saveChqConfig,
    syncProviders,
    revertCheck,
    getRrsNumCheque
};
