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
    logDeleteRow,
    deductAdvanceByFIFO,
    restoreAdvanceByFIFO,
    deductTrupputByFIFO,
    restoreTrupputByFIFO
} = require('./gasCloseoutUtils');


// --- ASIGNACIÓN DE DESPACHADORES Y MANGUERAS ---
exports.updateCloseoutDespachadores = async (req, res) => {
    try {
        const { id } = req.params;
        const { despachadores } = req.body;

        const [closeouts] = await pool.query(
            `SELECT * FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'No se puede modificar un cierre cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'despachadores');

        await pool.query(
            `DELETE FROM gas_station_closeout_despachadores WHERE closeout_id = ?`,
            [id]
        );

        const savedDespachadores = [];
        if (Array.isArray(despachadores) && despachadores.length > 0) {
            for (const d of despachadores) {
                const despId = typeof d === 'object' && d !== null ? (d.despachador_id || d.id) : d;
                if (!despId) continue;
                const [[existing]] = await pool.query(
                    `SELECT id, codigo, descripcion FROM gas_station_despachadores WHERE id = ? AND company_id = ?`,
                    [despId, req.company_id]
                );
                if (existing) {
                    const despNombre = (typeof d === 'object' && d !== null && d.nombre)
                        ? d.nombre
                        : (existing.descripcion || existing.codigo || '');
                    await pool.query(
                        `INSERT INTO gas_station_closeout_despachadores (closeout_id, despachador_id, nombre) VALUES (?, ?, ?)`,
                        [id, existing.id, despNombre]
                    );
                    savedDespachadores.push({ despachador_id: existing.id, nombre: despNombre });
                }
            }
        }

        await pool.query(
            `DELETE FROM gas_station_closeout_despachador_nozzles WHERE closeout_id = ?`,
            [id]
        );
        const savedIds = savedDespachadores.map(d => d.despachador_id);
        if (savedIds.length > 0) {
            const [liveAssignments] = await pool.query(
                `SELECT despachador_id, nozzle_id FROM gas_station_despachador_nozzles
                 WHERE company_id = ? AND despachador_id IN (?)`,
                [req.company_id, savedIds]
            );
            for (const a of liveAssignments) {
                await pool.query(
                    `INSERT INTO gas_station_closeout_despachador_nozzles (closeout_id, despachador_id, nozzle_id) VALUES (?, ?, ?)`,
                    [id, a.despachador_id, a.nozzle_id]
                );
            }
        }

        if (isReabierto) {
            await logSectionChange(req, id, 'despachadores', beforeRows, despachadores);
        }

        res.json({ despachadores: savedDespachadores });
    } catch (error) {
        console.error('Error updateCloseoutDespachadores:', error);
        res.status(500).json({ message: 'Error al actualizar despachadores' });
    }
};

exports.updateCloseoutDespachadorNozzles = async (req, res) => {
    try {
        const { id } = req.params;
        const { assignments } = req.body;

        const [closeouts] = await pool.query(
            `SELECT * FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'No se puede modificar un cierre cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'nozzles');

        await pool.query(
            `DELETE FROM gas_station_closeout_despachador_nozzles WHERE closeout_id = ?`,
            [id]
        );

        if (Array.isArray(assignments) && assignments.length > 0) {
            for (const a of assignments) {
                if (!a.despachador_id || !Array.isArray(a.nozzle_ids)) continue;
                for (const nid of a.nozzle_ids) {
                    await pool.query(
                        `INSERT INTO gas_station_closeout_despachador_nozzles (closeout_id, despachador_id, nozzle_id) VALUES (?, ?, ?)`,
                        [id, a.despachador_id, nid]
                    );
                }
            }
        }

        const [rows] = await pool.query(
            `SELECT * FROM gas_station_closeout_despachador_nozzles WHERE closeout_id = ?`,
            [id]
        );

        if (isReabierto) {
            await logSectionChange(req, id, 'nozzles', beforeRows, assignments);
        }

        res.json(rows);
    } catch (error) {
        console.error('Error updateCloseoutDespachadorNozzles:', error);
        res.status(500).json({ message: 'Error al actualizar asignaciones de mangueras' });
    }
};

// === Closeout Tarjetas ===


// --- ANTICIPOS DESPACHADOS ---
exports.getAnticiposDesp = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT ad.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion,
                   COALESCE(ga.total_disponible, 0) AS saldo_disponible
            FROM gas_station_closeout_anticipos_despachados ad
            LEFT JOIN gas_station_despachadores d ON ad.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = ad.closeout_id AND cd.despachador_id = ad.despachador_id
            LEFT JOIN (
                SELECT cliente_id, COALESCE(SUM(monto_disponible), 0) AS total_disponible
                FROM gas_station_advances
                WHERE company_id = ? AND monto_disponible > 0
                GROUP BY cliente_id
            ) ga ON ga.cliente_id = ad.cliente_id
            WHERE ad.closeout_id = ?
            ORDER BY ad.id ASC
        `, [req.company_id, id]);
        res.json(rows);
    } catch (error) {
        console.error('Error getAnticiposDesp:', error);
        res.status(500).json({ message: 'Error al obtener anticipos despachados' });
    }
};

exports.saveAnticiposDesp = async (req, res) => {
    try {
        const { id } = req.params;
        const { anticipos } = req.body;

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

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const isReabierto = closeouts[0].estado === 'reabierto';
            let beforeRows = [];
            if (isReabierto) {
                const [rows] = await connection.query(
                    `SELECT * FROM gas_station_closeout_anticipos_despachados WHERE closeout_id = ? ORDER BY id ASC`,
                    [id]
                );
                beforeRows = rows;
            }

            const [oldAnticipos] = await connection.query(
                `SELECT cliente_id, monto FROM gas_station_closeout_anticipos_despachados WHERE closeout_id = ?`,
                [id]
            );

            for (const old of oldAnticipos) {
                if (old.cliente_id && parseFloat(old.monto) > 0) {
                    await restoreAdvanceByFIFO(connection, req.company_id, old.cliente_id, old.monto);
                }
            }

            await connection.query(`DELETE FROM gas_station_closeout_anticipos_despachados WHERE closeout_id = ?`, [id]);

        const invalidAnticipos = anticipos.filter(a => !a.despachador_id);
        if (invalidAnticipos.length > 0) {
            return res.status(400).json({ message: 'Todos los anticipos deben tener un despachador asignado' });
        }

        const sinCliente = anticipos.filter(a => parseFloat(a.monto) > 0 && !a.cliente_id);
        if (sinCliente.length > 0) {
            return res.status(400).json({ message: 'Debe seleccionar un cliente para el anticipo despachado' });
        }

        if (anticipos && anticipos.length > 0) {
            for (const a of anticipos) {
                    if (a.cliente_id && parseFloat(a.monto) > 0) {
                        const [available] = await connection.query(
                            `SELECT COALESCE(SUM(monto_disponible), 0) as total FROM gas_station_advances WHERE company_id = ? AND cliente_id = ?`,
                            [req.company_id, a.cliente_id]
                        );
                        if (parseFloat(available[0].total) < parseFloat(a.monto)) {
                            throw new Error(`El cliente no tiene suficiente saldo disponible. Se requiere $${parseFloat(a.monto).toFixed(2)}, disponible: $${parseFloat(available[0].total).toFixed(2)}`);
                        }
                        await deductAdvanceByFIFO(connection, req.company_id, a.cliente_id, a.monto);
                    }

                    await connection.query(
                        `INSERT INTO gas_station_closeout_anticipos_despachados (closeout_id, cliente_id, cliente_nombre, documento, tipo_documento, producto_codigo, producto_descripcion, despachador_id, cantidad, precio, monto, placa, kilometraje) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            parseInt(id),
                            a.cliente_id ? parseInt(a.cliente_id) : null,
                            a.cliente_nombre || '',
                            a.documento || '',
                            a.tipo_documento || 'FAC',
                            a.producto_codigo || '',
                            a.producto_descripcion || '',
                            a.despachador_id ? parseInt(a.despachador_id) : null,
                            parseFloat(a.cantidad) || 0,
                            parseFloat(a.precio) || 0,
                            parseFloat(a.monto) || 0,
                            a.placa || '',
                            a.kilometraje || ''
                        ]
                    );
                }
            }

            const [remaining] = await connection.query(`
                SELECT ad.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion,
                       COALESCE(ga.total_disponible, 0) AS saldo_disponible
                FROM gas_station_closeout_anticipos_despachados ad
                LEFT JOIN gas_station_despachadores d ON ad.despachador_id = d.id
                LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = ad.closeout_id AND cd.despachador_id = ad.despachador_id
                LEFT JOIN (
                    SELECT cliente_id, COALESCE(SUM(monto_disponible), 0) AS total_disponible
                    FROM gas_station_advances
                    WHERE company_id = ? AND monto_disponible > 0
                    GROUP BY cliente_id
                ) ga ON ga.cliente_id = ad.cliente_id
                WHERE ad.closeout_id = ?
                ORDER BY ad.id ASC
            `, [req.company_id, id]);

            await connection.commit();

            if (isReabierto) {
                await logSectionChange(req, id, 'anticipos', beforeRows, anticipos);
            }

            res.json(remaining);
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error saveAnticiposDesp:', error);
        res.status(500).json({ message: error.message || 'Error al guardar anticipos despachados' });
    }
};

exports.deleteAnticipoDesp = async (req, res) => {
    try {
        const { id, anticipoId } = req.params;

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

        const [anticipo] = await pool.query(
            `SELECT cliente_id, monto FROM gas_station_closeout_anticipos_despachados WHERE id = ? AND closeout_id = ?`,
            [anticipoId, id]
        );
        if (anticipo.length === 0) return res.status(404).json({ message: 'Anticipo despachado no encontrado' });

        let deletedRow = null;
        if (closeouts[0].estado === 'reabierto') {
            const [rows] = await pool.query(
                `SELECT * FROM gas_station_closeout_anticipos_despachados WHERE id = ? AND closeout_id = ?`,
                [anticipoId, id]
            );
            deletedRow = rows[0] || null;
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            if (anticipo[0].cliente_id && parseFloat(anticipo[0].monto) > 0) {
                await restoreAdvanceByFIFO(connection, req.company_id, anticipo[0].cliente_id, anticipo[0].monto);
            }

            await connection.query(`DELETE FROM gas_station_closeout_anticipos_despachados WHERE id = ? AND closeout_id = ?`, [anticipoId, id]);

            await connection.commit();
            if (deletedRow) await logDeleteRow(req, id, 'anticipos', deletedRow);
            res.json({ message: 'Anticipo despachado eliminado' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error deleteAnticipoDesp:', error);
        res.status(500).json({ message: 'Error al eliminar anticipo despachado' });
    }
};

// === Closeout Despachos Trupput ===


// --- DESPACHOS TRUPPUT ---
exports.getTrupputDesp = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT td.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion,
                   COALESCE(gt.total_galones, 0) AS galones_disponibles
            FROM gas_station_closeout_trupput_despachos td
            LEFT JOIN gas_station_despachadores d ON td.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = td.closeout_id AND cd.despachador_id = td.despachador_id
            LEFT JOIN (
                SELECT cliente_id, COALESCE(SUM(galones_disponibles), 0) AS total_galones
                FROM gas_station_trupput
                WHERE company_id = ? AND galones_disponibles > 0
                GROUP BY cliente_id
            ) gt ON gt.cliente_id = td.cliente_id
            WHERE td.closeout_id = ?
            ORDER BY td.id ASC
        `, [req.company_id, id]);
        res.json(rows);
    } catch (error) {
        console.error('Error getTrupputDesp:', error);
        res.status(500).json({ message: 'Error al obtener despachos Trupput' });
    }
};

exports.saveTrupputDesp = async (req, res) => {
    try {
        const { id } = req.params;
        const { despachos } = req.body;

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

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const isReabierto = closeouts[0].estado === 'reabierto';
            let beforeRows = [];
            if (isReabierto) {
                const [rows] = await connection.query(
                    `SELECT * FROM gas_station_closeout_trupput_despachos WHERE closeout_id = ? ORDER BY id ASC`,
                    [id]
                );
                beforeRows = rows;
            }

            const [oldDespachos] = await connection.query(
                `SELECT cliente_id, galones FROM gas_station_closeout_trupput_despachos WHERE closeout_id = ?`,
                [id]
            );

            for (const old of oldDespachos) {
                if (old.cliente_id && parseFloat(old.galones) > 0) {
                    await restoreTrupputByFIFO(connection, req.company_id, old.cliente_id, old.galones);
                }
            }

            await connection.query(`DELETE FROM gas_station_closeout_trupput_despachos WHERE closeout_id = ?`, [id]);

            const invalidDespachos = (despachos || []).filter(d => !d.despachador_id);
            if (invalidDespachos.length > 0) {
                return res.status(400).json({ message: 'Todos los despachos deben tener un despachador asignado' });
            }

            const sinCliente = (despachos || []).filter(d => parseFloat(d.galones) > 0 && !d.cliente_id);
            if (sinCliente.length > 0) {
                return res.status(400).json({ message: 'Debe seleccionar un cliente para el despacho Trupput' });
            }

            if (despachos && despachos.length > 0) {
                for (const d of despachos) {
                    if (d.cliente_id && parseFloat(d.galones) > 0) {
                        const [available] = await connection.query(
                            `SELECT COALESCE(SUM(galones_disponibles), 0) as total FROM gas_station_trupput WHERE company_id = ? AND cliente_id = ? AND galones_disponibles > 0`,
                            [req.company_id, d.cliente_id]
                        );
                        if (parseFloat(available[0].total) < parseFloat(d.galones) - 0.0001) {
                            throw new Error(`El cliente no tiene suficiente saldo de galones. Se requieren ${parseFloat(d.galones).toFixed(4)}, disponibles: ${parseFloat(available[0].total).toFixed(4)}`);
                        }
                        await deductTrupputByFIFO(connection, req.company_id, d.cliente_id, d.galones);
                    }

                    await connection.query(
                        `INSERT INTO gas_station_closeout_trupput_despachos (closeout_id, cliente_id, cliente_nombre, documento, producto_codigo, producto_descripcion, despachador_id, galones, precio, monto, placa, kilometraje)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            parseInt(id),
                            d.cliente_id ? parseInt(d.cliente_id) : null,
                            d.cliente_nombre || '',
                            d.documento || '',
                            d.producto_codigo || '',
                            d.producto_descripcion || '',
                            d.despachador_id ? parseInt(d.despachador_id) : null,
                            parseFloat(d.galones) || 0,
                            parseFloat(d.precio) || 0,
                            parseFloat(d.monto) || 0,
                            d.placa || '',
                            d.kilometraje || ''
                        ]
                    );
                }
            }

            const [remaining] = await connection.query(`
                SELECT td.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion,
                       COALESCE(gt.total_galones, 0) AS galones_disponibles
                FROM gas_station_closeout_trupput_despachos td
                LEFT JOIN gas_station_despachadores d ON td.despachador_id = d.id
                LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = td.closeout_id AND cd.despachador_id = td.despachador_id
                LEFT JOIN (
                    SELECT cliente_id, COALESCE(SUM(galones_disponibles), 0) AS total_galones
                    FROM gas_station_trupput
                    WHERE company_id = ? AND galones_disponibles > 0
                    GROUP BY cliente_id
                ) gt ON gt.cliente_id = td.cliente_id
                WHERE td.closeout_id = ?
                ORDER BY td.id ASC
            `, [req.company_id, id]);

            await connection.commit();

            if (isReabierto) {
                await logSectionChange(req, id, 'trupput', beforeRows, despachos);
            }

            res.json(remaining);
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error saveTrupputDesp:', error);
        res.status(500).json({ message: error.message || 'Error al guardar despachos Trupput' });
    }
};

exports.deleteTrupputDesp = async (req, res) => {
    try {
        const { id, despachoId } = req.params;

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

        const [despacho] = await pool.query(
            `SELECT cliente_id, galones FROM gas_station_closeout_trupput_despachos WHERE id = ? AND closeout_id = ?`,
            [despachoId, id]
        );
        if (despacho.length === 0) return res.status(404).json({ message: 'Despacho Trupput no encontrado' });

        let deletedRow = null;
        if (closeouts[0].estado === 'reabierto') {
            const [rows] = await pool.query(
                `SELECT * FROM gas_station_closeout_trupput_despachos WHERE id = ? AND closeout_id = ?`,
                [despachoId, id]
            );
            deletedRow = rows[0] || null;
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            if (despacho[0].cliente_id && parseFloat(despacho[0].galones) > 0) {
                await restoreTrupputByFIFO(connection, req.company_id, despacho[0].cliente_id, despacho[0].galones);
            }

            await connection.query(`DELETE FROM gas_station_closeout_trupput_despachos WHERE id = ? AND closeout_id = ?`, [despachoId, id]);

            await connection.commit();
            if (deletedRow) await logDeleteRow(req, id, 'trupput', deletedRow);
            res.json({ message: 'Despacho Trupput eliminado' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error deleteTrupputDesp:', error);
        res.status(500).json({ message: 'Error al eliminar despacho Trupput' });
    }
};

// === Get Last Turno ===
