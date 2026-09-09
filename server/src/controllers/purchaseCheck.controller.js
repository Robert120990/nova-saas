const pool = require('../config/db');
const { getRrsPool } = require('../config/rrsDb');
const excelService = require('../services/excel.service');
const reportPdfHelper = require('../utils/reportPdfHelper');

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

const resolveRrsNumCheque = async (check, companyId) => {
    const [configs] = await pool.query(
        'SELECT rrs_id_empresa FROM branch_chq_config WHERE company_id = ? AND branch_id = ?',
        [companyId, check.branch_id]
    );

    if (configs.length === 0) return null;

    const rrsIdEmpresa = configs[0].rrs_id_empresa;
    const rrs = getRrsPool();
    const [rows] = await rrs.query(
        `SELECT num_cheque FROM solicitud_chq_contado
         WHERE llave IN (?, ?) AND num_cheque != ' ' AND num_cheque IS NOT NULL
         ORDER BY id DESC LIMIT 1`,
        [`${rrsIdEmpresa}-${check.id}`, String(check.id)]
    );

    if (rows.length === 0) return null;

    const numCheque = String(rows[0].num_cheque || '').trim();
    if (!numCheque) return null;

    await pool.query(
        'UPDATE purchase_checks SET rrs_num_cheque = ? WHERE id = ? AND company_id = ?',
        [numCheque, check.id, companyId]
    );

    return numCheque;
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

        const check = existing[0];

        if (check.status === 'ENTREGADO') {
            return res.status(400).json({ message: 'El cheque ya fue entregado' });
        }

        if (check.status !== 'SOLICITADO') {
            return res.status(400).json({ message: 'Solo se pueden entregar cheques en estado SOLICITADO' });
        }

        let numCheque = check.rrs_num_cheque;
        if (!numCheque || !String(numCheque).trim()) {
            numCheque = await resolveRrsNumCheque(check, companyId);
            if (!numCheque) {
                return res.status(400).json({ message: 'El cheque aún no ha sido generado por RRS' });
            }
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
        const codProveedor = nrc;
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

const verifyProvidersInRrs = async (req, res) => {
    try {
        const branchId = req.query.branch_id || req.user?.branch_id;
        const companyId = req.company_id || req.user?.company_id;

        if (!branchId) {
            return res.status(400).json({ message: 'branch_id es requerido para verificar en RRS' });
        }

        const [configs] = await pool.query(
            'SELECT * FROM branch_chq_config WHERE company_id = ? AND branch_id = ?',
            [companyId, branchId]
        );

        if (configs.length === 0 || !configs[0].rrs_id_empresa) {
            return res.status(400).json({
                configured: false,
                message: 'Configuración de Chq Contado no encontrada para esta sucursal. Configure el ID Empresa RRS primero.'
            });
        }

        const rrsIdEmpresa = configs[0].rrs_id_empresa;

        const [providers] = await pool.query(
            'SELECT id, nombre, nombre_comercial, nit, nrc, direccion, telefono, correo FROM providers WHERE company_id = ? ORDER BY nombre ASC',
            [companyId]
        );

        const rrs = getRrsPool();
        const [rrsRows] = await rrs.query(
            'SELECT id, codigo, nombre, nit, nrc FROM proveedores WHERE id_empresa = ?',
            [rrsIdEmpresa]
        );

        const clean = (val) => (val || '').toString().replace(/[^a-zA-Z0-9]/g, '').trim();

        const byNit = new Map();
        const byNrc = new Map();
        const byCodigo = new Map();
        const byId = new Map();
        const rawNit = new Map();
        const rawNrc = new Map();

        for (const r of rrsRows) {
            const cNit = clean(r.nit);
            const cNrc = clean(r.nrc);
            const cCod = clean(r.codigo);

            if (r.id) byId.set(r.id.trim(), r);
            if (cNit && !byNit.has(cNit)) byNit.set(cNit, r);
            if (cNrc && !byNrc.has(cNrc)) byNrc.set(cNrc, r);
            if (cCod && !byCodigo.has(cCod)) byCodigo.set(cCod, r);

            const rNit = (r.nit || '').trim();
            const rNrc = (r.nrc || '').trim();
            if (rNit && !rawNit.has(rNit)) rawNit.set(rNit, r);
            if (rNrc && !rawNrc.has(rNrc)) rawNrc.set(rNrc, r);
        }

        let matchedCount = 0;
        let notMatchedCount = 0;

        const evaluatedProviders = providers.map(p => {
            const cNit = clean(p.nit);
            const cNrc = clean(p.nrc);
            const rNit = (p.nit || '').trim();
            const rNrc = (p.nrc || '').trim();
            const providerId = `${rrsIdEmpresa}-${companyId}-${p.id}`.substring(0, 20);

            let found = null;
            if (byId.has(providerId)) found = byId.get(providerId);
            else if (cNit && byNit.has(cNit)) found = byNit.get(cNit);
            else if (rNit && rawNit.has(rNit)) found = rawNit.get(rNit);
            else if (cNrc && byNrc.has(cNrc)) found = byNrc.get(cNrc);
            else if (rNrc && rawNrc.has(rNrc)) found = rawNrc.get(rNrc);
            else if (cNrc && byCodigo.has(cNrc)) found = byCodigo.get(cNrc);

            const exists = Boolean(found);
            if (exists) {
                matchedCount++;
            } else {
                notMatchedCount++;
            }

            return {
                id: p.id,
                nombre: p.nombre,
                nombre_comercial: p.nombre_comercial,
                nit: p.nit,
                nrc: p.nrc,
                direccion: p.direccion,
                telefono: p.telefono,
                correo: p.correo,
                exists_in_rrs: exists,
                rrs_id: found ? found.id : null,
                rrs_codigo: found ? found.codigo : null,
                rrs_nombre: found ? found.nombre : null
            };
        });

        res.json({
            configured: true,
            rrs_id_empresa: rrsIdEmpresa,
            total: providers.length,
            matched: matchedCount,
            not_matched: notMatchedCount,
            providers: evaluatedProviders
        });
    } catch (error) {
        console.error('Error al verificar proveedores en RRS:', error);
        res.status(500).json({ message: 'Error al verificar proveedores en RRS: ' + error.message });
    }
};

const syncProviders = async (req, res) => {
    try {
        const { branch_id, provider_ids } = req.body;
        const companyId = req.company_id || req.user?.company_id;

        if (!branch_id) {
            return res.status(400).json({ message: 'branch_id es requerido' });
        }

        const [configs] = await pool.query(
            'SELECT * FROM branch_chq_config WHERE company_id = ? AND branch_id = ?',
            [companyId, branch_id]
        );

        if (configs.length === 0 || !configs[0].rrs_id_empresa) {
            return res.status(400).json({
                message: 'Configuración de Chq Contado no encontrada para esta sucursal. Primero configure el código de destino e ID Empresa RRS.'
            });
        }

        const rrsIdEmpresa = configs[0].rrs_id_empresa;

        let queryProviders = 'SELECT id, nombre, nombre_comercial, nit, nrc, direccion, telefono, correo FROM providers WHERE company_id = ?';
        const params = [companyId];

        const pIds = Array.isArray(provider_ids) ? provider_ids : (provider_ids ? [provider_ids] : null);
        if (pIds && pIds.length > 0) {
            queryProviders += ' AND id IN (?)';
            params.push(pIds);
        }

        const [providers] = await pool.query(queryProviders, params);

        if (providers.length === 0) {
            return res.status(400).json({ message: 'No se encontraron proveedores para sincronizar' });
        }

        const rrs = getRrsPool();
        let created = 0;
        let updated = 0;
        let errors = [];

        const clean = (val) => (val || '').toString().replace(/[^a-zA-Z0-9]/g, '').trim();

        for (const p of providers) {
            try {
                const nrc = (p.nrc || '').trim();
                const nit = (p.nit || '').trim();
                const cNrc = clean(nrc);
                const cNit = clean(nit);
                const codigoBusqueda = nrc || cNrc;
                const providerId = `${rrsIdEmpresa}-${companyId}-${p.id}`.substring(0, 20);

                let existing = null;

                // 1. Match by providerId if previously generated/synced
                const [byIdRows] = await rrs.query(
                    'SELECT * FROM proveedores WHERE id_empresa = ? AND id = ?',
                    [rrsIdEmpresa, providerId]
                );
                if (byIdRows.length > 0) existing = byIdRows[0];

                // 2. Match by NIT
                if (!existing && (nit || cNit)) {
                    const [rows] = await rrs.query(
                        `SELECT * FROM proveedores WHERE id_empresa = ? AND (nit = ? OR REPLACE(REPLACE(nit, '-', ''), ' ', '') = ?)`,
                        [rrsIdEmpresa, nit, cNit]
                    );
                    if (rows.length > 0) existing = rows[0];
                }

                // 3. Match by NRC
                if (!existing && (nrc || cNrc)) {
                    const [rows] = await rrs.query(
                        `SELECT * FROM proveedores WHERE id_empresa = ? AND (nrc = ? OR REPLACE(REPLACE(nrc, '-', ''), ' ', '') = ?)`,
                        [rrsIdEmpresa, nrc, cNrc]
                    );
                    if (rows.length > 0) existing = rows[0];
                }

                // 4. Match by Codigo
                if (!existing && (codigoBusqueda || cNrc)) {
                    const [rows] = await rrs.query(
                        `SELECT * FROM proveedores WHERE id_empresa = ? AND (codigo = ? OR REPLACE(REPLACE(codigo, '-', ''), ' ', '') = ?)`,
                        [rrsIdEmpresa, codigoBusqueda, cNrc]
                    );
                    if (rows.length > 0) existing = rows[0];
                }

                const codigoFinal = (codigoBusqueda || cNrc || String(p.id)).substring(0, 10);

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
                        codigoFinal || existing.codigo,
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
                    await rrs.query(`
                        INSERT INTO proveedores
                            (id, id_empresa, codigo, nombre, nombre_comercial, direccion, telefono,
                             correo, nit, nrc, tipo, es_exento, es_extranjero, con_retencion,
                             con_percepcion, con_credito, limite_credito, cuenta_contable,
                             es_exento_fovial, dif, napa, rnpa, id_tipo_doc, id_tipo_per, id_giro,
                             es_exento_cotrans)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'P', 0, 0, 0, 0, 0, 0, '', 0, '', '', '', '', '', '', 0)
                        ON DUPLICATE KEY UPDATE
                            codigo = VALUES(codigo),
                            nombre = VALUES(nombre),
                            nombre_comercial = VALUES(nombre_comercial),
                            direccion = VALUES(direccion),
                            telefono = VALUES(telefono),
                            correo = VALUES(correo),
                            nit = VALUES(nit),
                            nrc = VALUES(nrc)
                    `, [
                        providerId,
                        rrsIdEmpresa,
                        codigoFinal,
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
                console.error(`Error al procesar proveedor #${p.id}:`, e.message);
                errors.push(`Proveedor #${p.id} (${p.nombre}): ${e.message}`);
            }
        }

        if (providers.length === 1 && errors.length > 0) {
            return res.status(400).json({
                message: `Error al enviar proveedor a RRS: ${errors[0]}`,
                errors
            });
        }

        const msg = providers.length === 1
            ? `Proveedor enviado a RRS con éxito (${created > 0 ? 'creado' : 'actualizado'})`
            : `Sincronización completada. Creados: ${created}, Actualizados: ${updated}, Errores: ${errors.length}`;

        res.json({
            message: msg,
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

const getPurchaseCheckReportPDF = async (req, res) => {
    try {
        const { start_date, end_date, branch_id, destino, status, provider_id } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Rango de fechas requerido' });
        }

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        let sql = `
            SELECT pc.*,
                   p.nombre AS provider_nombre,
                   p.nrc AS provider_nrc,
                   p.nit AS provider_nit,
                   b.nombre AS branch_nombre,
                   u.nombre AS usuario_nombre
            FROM purchase_checks pc
            LEFT JOIN providers p ON pc.provider_id = p.id
            LEFT JOIN branches b ON pc.branch_id = b.id
            LEFT JOIN users u ON pc.usuario_id = u.id
            WHERE pc.company_id = ? AND pc.fecha BETWEEN ? AND ?
        `;
        const params = [companyId, start_date, end_date];

        if (branch_id && branch_id !== 'all') {
            sql += ' AND pc.branch_id = ?';
            params.push(branch_id);
        }

        if (destino && destino !== 'all') {
            sql += ' AND pc.destino = ?';
            params.push(destino);
        }

        if (status && status !== 'all') {
            sql += ' AND pc.status = ?';
            params.push(status);
        }

        if (provider_id && provider_id !== 'all') {
            sql += ' AND pc.provider_id = ?';
            params.push(provider_id);
        }

        sql += ' ORDER BY pc.fecha ASC, pc.id ASC';

        const [rows] = await pool.query(sql, params);

        // Excel export
        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Cheques de Contado',
                    columns: [
                        { header: 'Fecha', key: 'fecha', width: 15 },
                        { header: 'N. Cheque', key: 'num_cheque', width: 16 },
                        { header: 'Proveedor', key: 'proveedor', width: 35 },
                        { header: 'NRC', key: 'nrc', width: 15 },
                        { header: 'Sucursal', key: 'sucursal', width: 22 },
                        { header: 'Destino', key: 'destino', width: 12 },
                        { header: 'Estado', key: 'estado', width: 15 },
                        { header: 'F. Entrega', key: 'fecha_entrega', width: 15 },
                        { header: 'Documento', key: 'documento', width: 20 },
                        { header: 'Monto', key: 'monto', width: 15 }
                    ],
                    data: rows.map(r => ({
                        fecha: reportPdfHelper.formatDate(r.fecha),
                        num_cheque: r.rrs_num_cheque || '---',
                        proveedor: r.provider_nombre || '---',
                        nrc: r.provider_nrc || '---',
                        sucursal: r.branch_nombre || '---',
                        destino: r.destino === 'P' ? 'PISTA' : (r.destino === 'T' ? 'TIENDA' : (r.destino || '---')),
                        estado: r.status || '---',
                        fecha_entrega: r.fecha_entrega ? reportPdfHelper.formatDate(r.fecha_entrega) : '---',
                        documento: r.documento || '---',
                        monto: `$${parseFloat(r.monto || 0).toFixed(2)}`
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Reporte_Cheques_Contado_${start_date}_al_${end_date}.xlsx`);
        }

        // PDF Generation
        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

        let branchName = 'TODAS LAS SUCURSALES';
        if (branch_id && branch_id !== 'all' && rows.length > 0) {
            branchName = (rows[0].branch_nombre || '').toUpperCase();
        } else if (branch_id && branch_id !== 'all') {
            const [bRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (bRows.length > 0) branchName = (bRows[0].nombre || '').toUpperCase();
        }

        let subtitle = `SUCURSAL: ${branchName}`;
        if (destino && destino !== 'all') {
            subtitle += `    |    DESTINO: ${destino === 'P' ? 'PISTA' : 'TIENDA'}`;
        }
        if (status && status !== 'all') {
            subtitle += `    |    ESTADO: ${status}`;
        }

        const periodText = `DEL ${reportPdfHelper.formatDate(start_date)} AL ${reportPdfHelper.formatDate(end_date)}`;

        const startX = 30;
        const tableWidth = 732; // 792 - 60
        const colWidths = {
            fecha: 50,
            num: 65,
            proveedor: 195,
            sucursal: 85,
            destino: 45,
            estado: 65,
            f_entrega: 50,
            documento: 75,
            monto: 102
        };
        const colX = {
            fecha: startX,
            num: startX + colWidths.fecha,
            proveedor: startX + colWidths.fecha + colWidths.num,
            sucursal: startX + colWidths.fecha + colWidths.num + colWidths.proveedor,
            destino: startX + colWidths.fecha + colWidths.num + colWidths.proveedor + colWidths.sucursal,
            estado: startX + colWidths.fecha + colWidths.num + colWidths.proveedor + colWidths.sucursal + colWidths.destino,
            f_entrega: startX + colWidths.fecha + colWidths.num + colWidths.proveedor + colWidths.sucursal + colWidths.destino + colWidths.estado,
            documento: startX + colWidths.fecha + colWidths.num + colWidths.proveedor + colWidths.sucursal + colWidths.destino + colWidths.estado + colWidths.f_entrega,
            monto: startX + colWidths.fecha + colWidths.num + colWidths.proveedor + colWidths.sucursal + colWidths.destino + colWidths.estado + colWidths.f_entrega + colWidths.documento
        };

        const drawTableHeader = (y) => {
            doc.rect(startX, y, tableWidth, 14).fill('#f1f5f9');
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('FECHA', colX.fecha + 2, y + 3, { width: colWidths.fecha - 4 });
            doc.text('N. CHEQUE', colX.num + 2, y + 3, { width: colWidths.num - 4 });
            doc.text('PROVEEDOR', colX.proveedor + 2, y + 3, { width: colWidths.proveedor - 4 });
            doc.text('SUCURSAL', colX.sucursal + 2, y + 3, { width: colWidths.sucursal - 4 });
            doc.text('DESTINO', colX.destino, y + 3, { width: colWidths.destino, align: 'center' });
            doc.text('ESTADO', colX.estado + 2, y + 3, { width: colWidths.estado - 4 });
            doc.text('F. ENTREGA', colX.f_entrega + 2, y + 3, { width: colWidths.f_entrega - 4 });
            doc.text('DOCUMENTO', colX.documento + 2, y + 3, { width: colWidths.documento - 4 });
            doc.text('MONTO', colX.monto, y + 3, { width: colWidths.monto - 4, align: 'right' });
            return y + 17;
        };

        let currentY = reportPdfHelper.renderHeader(doc, company, 'REPORTE DE CHEQUES DE CONTADO', periodText, 'landscape', subtitle);
        currentY = drawTableHeader(currentY);

        let grandTotal = 0;
        let rowCount = 0;

        rows.forEach(row => {
            if (currentY > 510) {
                doc.addPage();
                currentY = reportPdfHelper.renderHeader(doc, company, 'REPORTE DE CHEQUES DE CONTADO', periodText, 'landscape', subtitle);
                currentY = drawTableHeader(currentY);
            }

            const rowMonto = parseFloat(row.monto || 0);
            doc.fontSize(7).font('Helvetica').fillColor('#334155');
            doc.text(reportPdfHelper.formatDate(row.fecha), colX.fecha + 2, currentY, { width: colWidths.fecha - 4 });
            doc.text(row.rrs_num_cheque || '---', colX.num + 2, currentY, { width: colWidths.num - 4 });
            doc.text((row.provider_nombre || '---').toUpperCase(), colX.proveedor + 2, currentY, { width: colWidths.proveedor - 6, truncate: true });
            doc.text((row.branch_nombre || '---').toUpperCase(), colX.sucursal + 2, currentY, { width: colWidths.sucursal - 4, truncate: true });

            const destinoLabel = row.destino === 'P' ? 'PISTA' : (row.destino === 'T' ? 'TIENDA' : (row.destino || '---'));
            doc.text(destinoLabel, colX.destino, currentY, { width: colWidths.destino, align: 'center' });

            const statusColors = {
                'PENDIENTE': '#b45309',
                'SOLICITADO': '#1d4ed8',
                'ENTREGADO': '#15803d'
            };
            doc.font('Helvetica-Bold').fillColor(statusColors[row.status] || '#475569');
            doc.text(row.status || '---', colX.estado + 2, currentY, { width: colWidths.estado - 4 });

            doc.font('Helvetica').fillColor('#334155');
            doc.text(row.fecha_entrega ? reportPdfHelper.formatDate(row.fecha_entrega) : '---', colX.f_entrega + 2, currentY, { width: colWidths.f_entrega - 4 });
            doc.text(row.documento || '---', colX.documento + 2, currentY, { width: colWidths.documento - 4, truncate: true });
            doc.text(reportPdfHelper.fmt(rowMonto), colX.monto, currentY, { width: colWidths.monto - 4, align: 'right' });

            grandTotal += rowMonto;
            rowCount++;
            currentY += 13;
        });

        if (currentY > 490) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, 'REPORTE DE CHEQUES DE CONTADO', periodText, 'landscape', subtitle);
        }

        // Línea de gran total
        doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + tableWidth, currentY).stroke();
        currentY += 4;
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('TOTAL GENERAL:', colX.documento - 50, currentY, { width: 50 + colWidths.documento - 6, align: 'right' });
        doc.text(reportPdfHelper.fmt(grandTotal), colX.monto, currentY, { width: colWidths.monto - 4, align: 'right' });
        currentY += 18;

        currentY = reportPdfHelper.renderClosingFooter(doc, startX, currentY, rowCount, 'Cheques');
        reportPdfHelper.renderPageNumbers(doc);

        doc.end();
        const pdfBuffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Reporte_Cheques_Contado_${start_date}_al_${end_date}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error al generar reporte de cheques de contado:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error al generar reporte de cheques de contado: ' + error.message });
        }
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
    verifyProvidersInRrs,
    revertCheck,
    getRrsNumCheque,
    getPurchaseCheckReportPDF
};
