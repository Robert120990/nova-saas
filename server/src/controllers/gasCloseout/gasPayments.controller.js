const {
    pool,
    sendCloseoutToRrs,
    dteService,
    notificationService,
    dteValidoExistsSql,
    applyCloseoutLubricantsInventory,
    revertCloseoutLubricantsInventory,
    CLOSEOUT_SECTIONS,
    SECTION_BUSINESS_FIELDS,
    NUMERIC_FIELDS,
    formatItemLabel,
    getNaturalKey,
    enrichSectionRows,
    getSectionRows,
    fieldChanges,
    buildSectionDiff,
    summarizeDiff,
    logCloseoutChange,
    logSectionChange,
    toDateStr,
    recalcularTanquesPosteriores,
    recalcularLubricantesPosteriores,
    logDeleteRow
} = require('./gasCloseoutUtils');


// --- REMESAS Y BOLETAS ---
exports.getRemesas = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT r.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
            FROM gas_station_closeout_remesas r
            LEFT JOIN gas_station_despachadores d ON r.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = r.closeout_id AND cd.despachador_id = r.despachador_id
            WHERE r.closeout_id = ?
            ORDER BY r.id ASC
        `, [id]);
        res.json(rows);
    } catch (error) {
        console.error('Error getRemesas:', error);
        res.status(500).json({ message: 'Error al obtener remesas' });
    }
};

exports.saveRemesas = async (req, res) => {
    try {
        const { id } = req.params;
        const { remesas } = req.body;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'remesas');

        // REPLACE-ALL STRATEGY
        // Preserve codigos and delivery status of remesas that are being re-saved (they exist in DB)
        const [existingRemesas] = await pool.query(
            `SELECT id, codigo, entregada, entrega_id FROM gas_station_closeout_remesas WHERE closeout_id = ?`,
            [id]
        );
        const existingData = {};
        existingRemesas.forEach(r => { 
            existingData[r.id] = { 
                codigo: r.codigo, 
                entregada: r.entregada, 
                entrega_id: r.entrega_id 
            }; 
        });

        await pool.query(`DELETE FROM gas_station_closeout_remesas WHERE closeout_id = ?`, [id]);

        if (remesas && remesas.length > 0) {
            const invalid = remesas.filter(r => !r.despachador_id);
            if (invalid.length > 0) {
                return res.status(400).json({ message: 'Todas las remesas deben tener un despachador asignado' });
            }
            const values = remesas.map((r, index) => {
                const prev = existingData[r.id] || {};
                let codigo = r.codigo || prev.codigo || null;
                if (!codigo) {
                    codigo = `REM-${id}-${index + 1}`;
                }
                const entregada = (r.entregada !== undefined) ? r.entregada : (prev.entregada || 0);
                const entregaId = (r.entrega_id !== undefined) ? r.entrega_id : (prev.entrega_id || null);

                return [
                    parseInt(id),
                    codigo,
                    r.documento || '',
                    r.descripcion || '',
                    r.despachador_id ? parseInt(r.despachador_id) : null,
                    r.tipo_operacion || 'venta_combustible',
                    parseFloat(r.monto) || 0,
                    entregada,
                    entregaId
                ];
            });
            await pool.query(
                `INSERT INTO gas_station_closeout_remesas (closeout_id, codigo, documento, descripcion, despachador_id, tipo_operacion, monto, entregada, entrega_id) VALUES ?`,
                [values]
            );
        }

        const [remaining] = await pool.query(`
            SELECT r.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
            FROM gas_station_closeout_remesas r
            LEFT JOIN gas_station_despachadores d ON r.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = r.closeout_id AND cd.despachador_id = r.despachador_id
            WHERE r.closeout_id = ?
            ORDER BY r.id ASC
        `, [id]);

        if (isReabierto) {
            await logSectionChange(req, id, 'remesas', beforeRows, remesas);
        }

        res.json(remaining);
    } catch (error) {
        console.error('Error saveRemesas:', error);
        res.status(500).json({ message: 'Error al guardar remesas' });
    }
};

exports.deleteRemesa = async (req, res) => {
    try {
        const { id, remesaId } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        let deletedRow = null;
        if (closeouts[0].estado === 'reabierto') {
            const [rows] = await pool.query(
                `SELECT * FROM gas_station_closeout_remesas WHERE id = ? AND closeout_id = ?`,
                [remesaId, id]
            );
            deletedRow = rows[0] || null;
        }

        const [result] = await pool.query(
            `DELETE FROM gas_station_closeout_remesas WHERE id = ? AND closeout_id = ?`,
            [remesaId, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Remesa no encontrada' });
        if (deletedRow) await logDeleteRow(req, id, 'remesas', deletedRow);
        res.json({ message: 'Remesa eliminada' });
    } catch (error) {
        console.error('Error deleteRemesa:', error);
        res.status(500).json({ message: 'Error al eliminar remesa' });
    }
};

// === Closeout Cupones ===


// --- CUPONES DE COMBUSTIBLE ---
exports.getCupones = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT c.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
            FROM gas_station_closeout_cupones c
            LEFT JOIN gas_station_despachadores d ON c.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = c.closeout_id AND cd.despachador_id = c.despachador_id
            WHERE c.closeout_id = ?
            ORDER BY c.id ASC
        `, [id]);
        res.json(rows);
    } catch (error) {
        console.error('Error getCupones:', error);
        res.status(500).json({ message: 'Error al obtener cupones' });
    }
};

exports.saveCupones = async (req, res) => {
    try {
        const { id } = req.params;
        const { cupones } = req.body;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'cupones');

        // REPLACE-ALL STRATEGY
        await pool.query(`DELETE FROM gas_station_closeout_cupones WHERE closeout_id = ?`, [id]);

        const invalidCupones = cupones.filter(c => !c.despachador_id);
        if (invalidCupones.length > 0) {
            return res.status(400).json({ message: 'Todos los cupones deben tener un despachador asignado' });
        }

        if (cupones && cupones.length > 0) {
            const distributorIds = cupones.filter(c => c.distribuidora_id).map(c => parseInt(c.distribuidora_id));
            const distributorMap = {};
            if (distributorIds.length > 0) {
                const [distributors] = await pool.query(
                    `SELECT id, descripcion FROM gas_station_distributors WHERE id IN (?) AND company_id = ?`,
                    [distributorIds, req.company_id]
                );
                distributors.forEach(d => { distributorMap[d.id] = d.descripcion; });
            }

            const values = cupones.map(c => {
                const distribuidoraId = c.distribuidora_id ? parseInt(c.distribuidora_id) : null;
                const distribuidoraNombre = distribuidoraId ? (distributorMap[distribuidoraId] || '') : '';
                return [
                    parseInt(id),
                    c.cupon || '',
                    distribuidoraId,
                    distribuidoraNombre,
                    c.producto_codigo || '',
                    c.producto_descripcion || '',
                    parseFloat(c.monto) || 0,
                    c.despachador_id ? parseInt(c.despachador_id) : null
                ];
            });
            await pool.query(
                `INSERT INTO gas_station_closeout_cupones (closeout_id, cupon, distribuidora_id, distribuidora_nombre, producto_codigo, producto_descripcion, monto, despachador_id) VALUES ?`,
                [values]
            );
        }

        const [remaining] = await pool.query(`
            SELECT c.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
            FROM gas_station_closeout_cupones c
            LEFT JOIN gas_station_despachadores d ON c.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = c.closeout_id AND cd.despachador_id = c.despachador_id
            WHERE c.closeout_id = ?
            ORDER BY c.id ASC
        `, [id]);

        if (isReabierto) {
            await logSectionChange(req, id, 'cupones', beforeRows, cupones);
        }

        res.json(remaining);
    } catch (error) {
        console.error('Error saveCupones:', error);
        res.status(500).json({ message: 'Error al guardar cupones' });
    }
};

exports.deleteCupon = async (req, res) => {
    try {
        const { id, cuponId } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        let deletedRow = null;
        if (closeouts[0].estado === 'reabierto') {
            const [rows] = await pool.query(
                `SELECT * FROM gas_station_closeout_cupones WHERE id = ? AND closeout_id = ?`,
                [cuponId, id]
            );
            deletedRow = rows[0] || null;
        }

        const [result] = await pool.query(
            `DELETE FROM gas_station_closeout_cupones WHERE id = ? AND closeout_id = ?`,
            [cuponId, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Cupón no encontrado' });
        if (deletedRow) await logDeleteRow(req, id, 'cupones', deletedRow);
        res.json({ message: 'Cupón eliminado' });
    } catch (error) {
        console.error('Error deleteCupon:', error);
        res.status(500).json({ message: 'Error al eliminar cupón' });
    }
};

// === Closeout Descuentos ===


// --- PAGOS CON TARJETA / POS ---
exports.getTarjetas = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT t.*, p.nombre as pos_type_nombre, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
            FROM gas_station_closeout_tarjetas t
            LEFT JOIN gas_station_pos_types p ON t.pos_type_id = p.id
            LEFT JOIN gas_station_despachadores d ON t.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = t.closeout_id AND cd.despachador_id = t.despachador_id
            WHERE t.closeout_id = ?
            ORDER BY t.id ASC
        `, [id]);
        res.json(rows);
    } catch (error) {
        console.error('Error getTarjetas:', error);
        res.status(500).json({ message: 'Error al obtener tarjetas' });
    }
};

exports.saveTarjetas = async (req, res) => {
    try {
        const { id } = req.params;
        const { tarjetas } = req.body;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'tarjetas');

        await pool.query(`DELETE FROM gas_station_closeout_tarjetas WHERE closeout_id = ?`, [id]);

        const invalidTarjetas = tarjetas.filter(t => !t.despachador_id);
        if (invalidTarjetas.length > 0) {
            return res.status(400).json({ message: 'Todas las tarjetas deben tener un despachador asignado' });
        }

        if (tarjetas && tarjetas.length > 0) {
            const values = tarjetas.map(t => [
                parseInt(id),
                t.num_tarjeta || '',
                t.num_autorizacion || '',
                t.pos_type_id ? parseInt(t.pos_type_id) : null,
                t.despachador_id ? parseInt(t.despachador_id) : null,
                t.tipo_operacion || 'venta_combustible',
                parseFloat(t.monto) || 0
            ]);
            await pool.query(
                `INSERT INTO gas_station_closeout_tarjetas (closeout_id, num_tarjeta, num_autorizacion, pos_type_id, despachador_id, tipo_operacion, monto) VALUES ?`,
                [values]
            );
        }

        const [remaining] = await pool.query(`
            SELECT t.*, p.nombre as pos_type_nombre, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
            FROM gas_station_closeout_tarjetas t
            LEFT JOIN gas_station_pos_types p ON t.pos_type_id = p.id
            LEFT JOIN gas_station_despachadores d ON t.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = t.closeout_id AND cd.despachador_id = t.despachador_id
            WHERE t.closeout_id = ?
            ORDER BY t.id ASC
        `, [id]);

        if (isReabierto) {
            await logSectionChange(req, id, 'tarjetas', beforeRows, tarjetas);
        }

        res.json(remaining);
    } catch (error) {
        console.error('Error saveTarjetas:', error);
        res.status(500).json({ message: 'Error al guardar tarjetas' });
    }
};

exports.deleteTarjeta = async (req, res) => {
    try {
        const { id, tarjetaId } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        let deletedRow = null;
        if (closeouts[0].estado === 'reabierto') {
            const [rows] = await pool.query(
                `SELECT * FROM gas_station_closeout_tarjetas WHERE id = ? AND closeout_id = ?`,
                [tarjetaId, id]
            );
            deletedRow = rows[0] || null;
        }

        await pool.query(`DELETE FROM gas_station_closeout_tarjetas WHERE id = ? AND closeout_id = ?`, [tarjetaId, id]);
        if (deletedRow) await logDeleteRow(req, id, 'tarjetas', deletedRow);
        res.json({ message: 'Tarjeta eliminada' });
    } catch (error) {
        console.error('Error deleteTarjeta:', error);
        res.status(500).json({ message: 'Error al eliminar tarjeta' });
    }
};

// === Closeout Creditos ===


// --- CRÉDITOS EMPRESARIALES ---
exports.getCreditos = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT c.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
            FROM gas_station_closeout_creditos c
            LEFT JOIN gas_station_despachadores d ON c.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = c.closeout_id AND cd.despachador_id = c.despachador_id
            WHERE c.closeout_id = ?
            ORDER BY c.id ASC
        `, [id]);
        res.json(rows);
    } catch (error) {
        console.error('Error getCreditos:', error);
        res.status(500).json({ message: 'Error al obtener créditos' });
    }
};

exports.saveCreditos = async (req, res) => {
    try {
        const { id } = req.params;
        const { creditos } = req.body;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id, fecha_turno FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const closeoutBranchId = closeouts[0].branch_id;
        const fechaTurno = closeouts[0].fecha_turno ? (
            typeof closeouts[0].fecha_turno === 'string'
                ? closeouts[0].fecha_turno.substring(0, 10)
                : closeouts[0].fecha_turno.toISOString().substring(0, 10)
        ) : null;

        // Check if closeout credits affect CxC
        const [settingsRows] = await pool.query(
            `SELECT setting_key, setting_value FROM gas_station_settings
             WHERE company_id = ? AND (branch_id = ? OR branch_id IS NULL)
               AND setting_key IN ('creditos_afectan_cxc', 'creditos_afectan_cxc_desde')
             ORDER BY (branch_id = ?) DESC`,
            [req.company_id, closeoutBranchId, closeoutBranchId]
        );
        const affectsCxcActive = settingsRows.find(r => r.setting_key === 'creditos_afectan_cxc')?.setting_value === '1';
        const desdeFecha = settingsRows.find(r => r.setting_key === 'creditos_afectan_cxc_desde')?.setting_value || null;
        const isAffectingCxc = affectsCxcActive && (!desdeFecha || (fechaTurno && fechaTurno >= desdeFecha));

        const incomingCreditos = Array.isArray(creditos) ? creditos : [];

        const invalidCreditos = incomingCreditos.filter(c => !c.despachador_id);
        if (invalidCreditos.length > 0) {
            return res.status(400).json({ message: 'Todos los créditos deben tener un despachador asignado' });
        }

        if (isAffectingCxc) {
            const sinCliente = incomingCreditos.filter(c => !c.cliente_id);
            if (sinCliente.length > 0) {
                return res.status(400).json({
                    message: 'La configuración de gasolinera requiere que cada crédito tenga un cliente asignado para afectar Cuentas por Cobrar.'
                });
            }
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'creditos');

        // Check existing credits and any payments registered against them
        const [existingCredits] = await pool.query(`
            SELECT c.*, COALESCE(SUM(cp.monto), 0) as total_abonado
            FROM gas_station_closeout_creditos c
            LEFT JOIN customer_payments cp ON cp.gas_credito_id = c.id
            WHERE c.closeout_id = ?
            GROUP BY c.id
        `, [id]);

        const existingMap = new Map();
        for (const ec of existingCredits) {
            existingMap.set(ec.id, ec);
        }

        // Validate that no credit with payments was deleted
        const incomingIdSet = new Set(incomingCreditos.map(c => parseInt(c.id)).filter(Boolean));
        for (const ec of existingCredits) {
            const totalAbonado = parseFloat(ec.total_abonado) || 0;
            if (totalAbonado > 0 && !incomingIdSet.has(ec.id)) {
                return res.status(400).json({
                    message: `No se puede eliminar el crédito ${ec.documento ? '#' + ec.documento : 'ID ' + ec.id} (${ec.cliente_nombre}) porque ya tiene abonos registrados por $${totalAbonado.toFixed(2)} en Cuentas por Cobrar.`
                });
            }
        }

        // Validate that credits with payments are not modified in an invalid way
        for (const c of incomingCreditos) {
            const cId = parseInt(c.id);
            if (cId && existingMap.has(cId)) {
                const ec = existingMap.get(cId);
                const totalAbonado = parseFloat(ec.total_abonado) || 0;
                if (totalAbonado > 0) {
                    if (c.cliente_id && parseInt(c.cliente_id) !== parseInt(ec.cliente_id)) {
                        return res.status(400).json({
                            message: `No se puede cambiar el cliente del crédito ${ec.documento ? '#' + ec.documento : 'ID ' + ec.id} porque ya tiene abonos registrados en Cuentas por Cobrar.`
                        });
                    }
                    const newMonto = parseFloat(c.monto) || 0;
                    if (newMonto < totalAbonado - 0.001) {
                        return res.status(400).json({
                            message: `El monto del crédito ${ec.documento ? '#' + ec.documento : 'ID ' + ec.id} ($${newMonto.toFixed(2)}) no puede ser menor a los abonos ya registrados en CxC ($${totalAbonado.toFixed(2)}).`
                        });
                    }
                }
            }
        }

        // Delete only removed credits that have 0 payments
        const idsToDelete = existingCredits
            .filter(ec => !incomingIdSet.has(ec.id) && (parseFloat(ec.total_abonado) || 0) === 0)
            .map(ec => ec.id);

        if (idsToDelete.length > 0) {
            await pool.query(`DELETE FROM gas_station_closeout_creditos WHERE id IN (?) AND closeout_id = ?`, [idsToDelete, id]);
        }

        // Update existing or Insert new
        for (const c of incomingCreditos) {
            const cId = parseInt(c.id);
            if (cId && existingMap.has(cId)) {
                await pool.query(`
                    UPDATE gas_station_closeout_creditos
                    SET documento = ?, tipo_documento = ?, cliente_id = ?, cliente_nombre = ?,
                        producto_codigo = ?, producto_descripcion = ?, despachador_id = ?,
                        cantidad = ?, precio = ?, monto = ?, placa = ?, kilometraje = ?
                    WHERE id = ? AND closeout_id = ?
                `, [
                    c.documento || '',
                    c.tipo_documento || 'FAC',
                    c.cliente_id ? parseInt(c.cliente_id) : null,
                    c.cliente_nombre || '',
                    c.producto_codigo || '',
                    c.producto_descripcion || '',
                    c.despachador_id ? parseInt(c.despachador_id) : null,
                    parseFloat(c.cantidad) || 0,
                    parseFloat(c.precio) || 0,
                    parseFloat(c.monto) || 0,
                    c.placa || '',
                    c.kilometraje || '',
                    cId,
                    id
                ]);
            } else {
                await pool.query(`
                    INSERT INTO gas_station_closeout_creditos
                    (closeout_id, documento, tipo_documento, cliente_id, cliente_nombre, producto_codigo, producto_descripcion, despachador_id, cantidad, precio, monto, placa, kilometraje)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    parseInt(id),
                    c.documento || '',
                    c.tipo_documento || 'FAC',
                    c.cliente_id ? parseInt(c.cliente_id) : null,
                    c.cliente_nombre || '',
                    c.producto_codigo || '',
                    c.producto_descripcion || '',
                    c.despachador_id ? parseInt(c.despachador_id) : null,
                    parseFloat(c.cantidad) || 0,
                    parseFloat(c.precio) || 0,
                    parseFloat(c.monto) || 0,
                    c.placa || '',
                    c.kilometraje || ''
                ]);
            }
        }

        const [remaining] = await pool.query(`
            SELECT c.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
            FROM gas_station_closeout_creditos c
            LEFT JOIN gas_station_despachadores d ON c.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = c.closeout_id AND cd.despachador_id = c.despachador_id
            WHERE c.closeout_id = ?
            ORDER BY c.id ASC
        `, [id]);

        if (isReabierto) {
            await logSectionChange(req, id, 'creditos', beforeRows, creditos);
        }

        res.json(remaining);
    } catch (error) {
        console.error('Error saveCreditos:', error);
        res.status(500).json({ message: 'Error al guardar créditos' });
    }
};

exports.deleteCredito = async (req, res) => {
    try {
        const { id, creditoId } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        // Check if there are abonos in customer_payments
        const [payments] = await pool.query(
            `SELECT COALESCE(SUM(monto), 0) as total_abonado FROM customer_payments WHERE gas_credito_id = ?`,
            [creditoId]
        );
        const totalAbonado = parseFloat(payments[0]?.total_abonado) || 0;
        if (totalAbonado > 0) {
            return res.status(400).json({
                message: `No se puede eliminar este crédito porque ya tiene abonos registrados por $${totalAbonado.toFixed(2)} en Cuentas por Cobrar.`
            });
        }

        let deletedRow = null;
        if (closeouts[0].estado === 'reabierto') {
            const [rows] = await pool.query(
                `SELECT * FROM gas_station_closeout_creditos WHERE id = ? AND closeout_id = ?`,
                [creditoId, id]
            );
            deletedRow = rows[0] || null;
        }

        await pool.query(`DELETE FROM gas_station_closeout_creditos WHERE id = ? AND closeout_id = ?`, [creditoId, id]);
        if (deletedRow) await logDeleteRow(req, id, 'creditos', deletedRow);
        res.json({ message: 'Crédito eliminado' });
    } catch (error) {
        console.error('Error deleteCredito:', error);
        res.status(500).json({ message: 'Error al eliminar crédito' });
    }
};

// === Closeout Vales ===


// --- VALES DE COMBUSTIBLE ---
exports.getVales = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT v.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
            FROM gas_station_closeout_vales v
            LEFT JOIN gas_station_despachadores d ON v.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = v.closeout_id AND cd.despachador_id = v.despachador_id
            WHERE v.closeout_id = ?
            ORDER BY v.id ASC
        `, [id]);
        res.json(rows);
    } catch (error) {
        console.error('Error getVales:', error);
        res.status(500).json({ message: 'Error al obtener vales' });
    }
};

exports.saveVales = async (req, res) => {
    try {
        const { id } = req.params;
        const { vales } = req.body;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'vales');

        await pool.query(`DELETE FROM gas_station_closeout_vales WHERE closeout_id = ?`, [id]);

        const invalidVales = vales.filter(v => !v.despachador_id);
        if (invalidVales.length > 0) {
            return res.status(400).json({ message: 'Todos los vales deben tener un despachador asignado' });
        }

        if (vales && vales.length > 0) {
            const values = vales.map(v => [
                parseInt(id),
                v.documento || '',
                v.tipo_documento || 'FAC',
                v.cliente_id ? parseInt(v.cliente_id) : null,
                v.cliente_nombre || '',
                v.producto_codigo || '',
                v.producto_descripcion || '',
                v.despachador_id ? parseInt(v.despachador_id) : null,
                parseFloat(v.cantidad) || 0,
                parseFloat(v.precio) || 0,
                parseFloat(v.monto) || 0,
                v.placa || '',
                v.kilometraje || ''
            ]);
            await pool.query(
                `INSERT INTO gas_station_closeout_vales (closeout_id, documento, tipo_documento, cliente_id, cliente_nombre, producto_codigo, producto_descripcion, despachador_id, cantidad, precio, monto, placa, kilometraje) VALUES ?`,
                [values]
            );
        }

        const [remaining] = await pool.query(`
            SELECT v.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
            FROM gas_station_closeout_vales v
            LEFT JOIN gas_station_despachadores d ON v.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = v.closeout_id AND cd.despachador_id = v.despachador_id
            WHERE v.closeout_id = ?
            ORDER BY v.id ASC
        `, [id]);

        if (isReabierto) {
            await logSectionChange(req, id, 'vales', beforeRows, vales);
        }

        res.json(remaining);
    } catch (error) {
        console.error('Error saveVales:', error);
        res.status(500).json({ message: 'Error al guardar vales' });
    }
};

exports.deleteVale = async (req, res) => {
    try {
        const { id, valeId } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        let deletedRow = null;
        if (closeouts[0].estado === 'reabierto') {
            const [rows] = await pool.query(
                `SELECT * FROM gas_station_closeout_vales WHERE id = ? AND closeout_id = ?`,
                [valeId, id]
            );
            deletedRow = rows[0] || null;
        }

        await pool.query(`DELETE FROM gas_station_closeout_vales WHERE id = ? AND closeout_id = ?`, [valeId, id]);
        if (deletedRow) await logDeleteRow(req, id, 'vales', deletedRow);
        res.json({ message: 'Vale eliminado' });
    } catch (error) {
        console.error('Error deleteVale:', error);
        res.status(500).json({ message: 'Error al eliminar vale' });
    }
};

async function deductAdvanceByFIFO(pool, companyId, clienteId, monto) {
    const [advances] = await pool.query(
        `SELECT id, monto_disponible FROM gas_station_advances WHERE company_id = ? AND cliente_id = ? AND monto_disponible > 0 ORDER BY fecha ASC, id ASC`,
        [companyId, clienteId]
    );
    let remaining = parseFloat(monto);
    for (const adv of advances) {
        if (remaining <= 0) break;
        const deduct = Math.min(remaining, parseFloat(adv.monto_disponible));
        await pool.query(
            `UPDATE gas_station_advances SET monto_disponible = monto_disponible - ? WHERE id = ?`,
            [deduct, adv.id]
        );
        remaining -= deduct;
    }
}

async function restoreAdvanceByFIFO(pool, companyId, clienteId, monto) {
    const [advances] = await pool.query(
        `SELECT id, monto, monto_disponible FROM gas_station_advances WHERE company_id = ? AND cliente_id = ? ORDER BY fecha DESC, id DESC`,
        [companyId, clienteId]
    );
    let remaining = parseFloat(monto);
    for (const adv of advances) {
        if (remaining <= 0) break;
        const restore = Math.min(remaining, parseFloat(adv.monto) - parseFloat(adv.monto_disponible));
        await pool.query(
            `UPDATE gas_station_advances SET monto_disponible = monto_disponible + ? WHERE id = ?`,
            [restore, adv.id]
        );
        remaining -= restore;
    }
}

async function deductTrupputByFIFO(pool, companyId, clienteId, galones) {
    const [trupput] = await pool.query(
        `SELECT id, galones_disponibles FROM gas_station_trupput WHERE company_id = ? AND cliente_id = ? AND galones_disponibles > 0 ORDER BY fecha ASC, id ASC`,
        [companyId, clienteId]
    );
    let remaining = parseFloat(galones);
    for (const t of trupput) {
        if (remaining <= 0) break;
        const deduct = Math.min(remaining, parseFloat(t.galones_disponibles));
        await pool.query(
            `UPDATE gas_station_trupput SET galones_disponibles = galones_disponibles - ? WHERE id = ?`,
            [deduct, t.id]
        );
        remaining -= deduct;
    }
}

async function restoreTrupputByFIFO(pool, companyId, clienteId, galones) {
    const [trupput] = await pool.query(
        `SELECT id, galones, galones_disponibles FROM gas_station_trupput WHERE company_id = ? AND cliente_id = ? ORDER BY fecha DESC, id DESC`,
        [companyId, clienteId]
    );
    let remaining = parseFloat(galones);
    for (const t of trupput) {
        if (remaining <= 0) break;
        const restore = Math.min(remaining, parseFloat(t.galones) - parseFloat(t.galones_disponibles));
        await pool.query(
            `UPDATE gas_station_trupput SET galones_disponibles = galones_disponibles + ? WHERE id = ?`,
            [restore, t.id]
        );
        remaining -= restore;
    }
}

// === Closeout Anticipos Despachados ===

