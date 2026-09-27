const { eggRules, pool, broadcastToCompany, notificationService } = require('./shared');

const completeProductionBatch = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const { yield_liquid_lbs, waste_shell_lbs, waste_loss_lbs } = req.body;

        // Traer datos del lote
        const [batches] = await connection.query('SELECT * FROM egg_production_batches WHERE id = ? AND company_id = ? FOR UPDATE', [id, req.company_id]);
        if (!batches.length) eggRules.fail('Lote no encontrado', 404);
        const batch = batches[0];

        // Cambiar estado a aprobado_calidad o mantener bloqueado_haccp, empaquetado o congelado
        let nextStatus = batch.status;
        if (nextStatus === 'en_proceso') {
            const [lab] = await connection.query(
                'SELECT release_status FROM egg_lab_micro_logs WHERE batch_id = ? AND company_id = ? ORDER BY id DESC LIMIT 1',
                [id, req.company_id]
            );
            if (lab.length && lab[0].release_status === 'liberado') {
                nextStatus = 'aprobado_calidad';
            } else if (batch.pasteurization_status === 'cerrado' || batch.pasteurization_status === 'pasteurizado') {
                nextStatus = 'pasteurizado';
            }
        }
        const values = [yield_liquid_lbs, waste_shell_lbs, waste_loss_lbs].map(v => eggRules.number(v, 'Peso'));
        if (values[0] <= 0) eggRules.fail('El rendimiento debe ser mayor a cero.');
        if (batch.completed_at) {
            const same = ['yield_liquid_lbs','waste_shell_lbs','waste_loss_lbs'].every((key,i) => Math.abs(Number(batch[key]) - values[i]) < 0.001);
            if (!same) eggRules.fail('El lote ya fue finalizado. Requiere corrección supervisada.', 409);
            await connection.commit();
            return res.json({ id, status: batch.status, yield_liquid_lbs: batch.yield_liquid_lbs, unchanged: true });
        }
        const [packaged] = await connection.query('SELECT COALESCE(SUM(total_batch_weight_lbs),0) AS lbs FROM egg_packaging_records WHERE batch_id = ? AND company_id = ?', [id, req.company_id]);
        if (values[0] < Number(packaged[0].lbs)) eggRules.fail('El rendimiento no puede ser menor al peso ya envasado.', 409);
        // El cierre físico no concede ni revoca un dictamen de laboratorio.

        await connection.query(
            `UPDATE egg_production_batches
             SET yield_liquid_lbs = ?, waste_shell_lbs = ?, waste_loss_lbs = ?, status = ?, completed_at = COALESCE(completed_at, NOW())
             WHERE id = ? AND company_id = ?`,
            [yield_liquid_lbs, waste_shell_lbs, waste_loss_lbs, nextStatus, id, req.company_id]
        );

        // Crear evento
        await connection.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'production.completed', 'info', ?, ?, ?)`,
            [req.company_id, `Lote de producción completado. Rendimiento líquido: ${yield_liquid_lbs} LBS, Desperdicio cáscara: ${waste_shell_lbs} LBS.`, JSON.stringify({ batch_id: id, yield_liquid_lbs, waste_shell_lbs }), batch.operator_name]
        );

        await connection.commit();
        const inputWeight = parseFloat(batch.input_weight_lbs || 0);
        const yieldPct = inputWeight > 0 ? Math.round((parseFloat(yield_liquid_lbs || 0) / inputWeight) * 10000) / 100 : 0;
        notificationService.notify('production_batch_completed', req.company_id, req.user?.branch_id, {
            lote_id: parseInt(id),
            producto: batch.product_type || '',
            cantidad: inputWeight,
            rendimiento: yieldPct,
            duracion: 0
        }).catch(() => { });

        res.json({ id, status: nextStatus, yield_liquid_lbs });
    } catch (error) {
        await connection.rollback();
        res.status(error.status || 500).json({ message: error.message });
    } finally { connection.release(); }
};

const createPasteurizationLog = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { batch_id, temperature_c, holding_time_seconds, pressure_psi, flow_rate_gpm, operator_name, pasteurization_lot } = req.body;
        const company_id = req.company_id;

        // Obtener el lote para saber el tipo de producto
        const [batches] = await connection.query('SELECT * FROM egg_production_batches WHERE id = ? AND company_id = ? FOR UPDATE', [batch_id, company_id]);
        if (batches.length === 0) return res.status(404).json({ message: 'Lote no encontrado' });
        const batch = batches[0];

        // Si la pasteurización ya estaba cerrada, evitar modificaciones e incongruencias
        if (batch.pasteurization_status === 'cerrado') {
            const userPerms = Array.isArray(req.user?.permissions) ? req.user.permissions : (typeof req.user?.permissions === 'string' ? JSON.parse(req.user?.permissions || '[]') : []);
            const canManage = req.eggAccess?.superAdmin || userPerms.includes('manage_egg_production_lots');
            if (!canManage) {
                return res.status(400).json({ message: 'La pasteurización de este lote ya fue CERRADA. Reabra la pasteurización o cuente con permiso especial para registrar nuevos parámetros.' });
            }
        }

        const evaluation = eggRules.evaluatePasteurization(batch.product_type, temperature_c, holding_time_seconds);
        const haccp_compliant = evaluation.compliant;
        const deviation_description = evaluation.reason;

        const resolvedPastLot = (pasteurization_lot && pasteurization_lot.trim())
            ? pasteurization_lot.trim()
            : (batch.pasteurization_lot || (batch.batch_code_display ? `PAST-${batch.batch_code_display.replace(/\s+/g, '')}` : `PAST-${batch_id}`));

        // Insertar log con lote de pasteurización
        const [result] = await connection.query(
            `INSERT INTO egg_pasteurization_logs (company_id, batch_id, pasteurization_lot, temperature_c, holding_time_seconds, pressure_psi, flow_rate_gpm, haccp_compliant, deviation_description, operator_name)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [company_id, batch_id, resolvedPastLot, temperature_c, holding_time_seconds, pressure_psi, flow_rate_gpm, haccp_compliant, deviation_description, operator_name]
        );

        if (!haccp_compliant) {
            // --- BLOQUEO AUTOMÁTICO DE LOTE ---
            await connection.query(
                `UPDATE egg_production_batches SET status = 'bloqueado_haccp', pasteurization_lot = COALESCE(pasteurization_lot, ?) WHERE id = ? AND company_id = ?`,
                [resolvedPastLot, batch_id, company_id]
            );

            // Crear evento crítico
            await connection.query(
                `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
                 VALUES (?, 'haccp.failure', 'critical', ?, ?, ?)`,
                [company_id, `ALERTA HACCP: Lote ${batch.batch_uuid} ha sido BLOQUEADO automáticamente debido a desviaciones críticas en pasteurización.`, JSON.stringify({ batch_id, temperature_c, holding_time_seconds, deviation_description }), operator_name]
            );

            // Emitir por WebSocket
            broadcastToCompany(company_id, 'haccp_alert', {
                message: `ALERTA DE SEGURIDAD ALIMENTARIA: Desviación HACCP en pasteurización. Lote ${batch.batch_uuid} BLOQUEADO automáticamente. ${deviation_description}`,
                temp: temperature_c,
                batchUuid: batch.batch_uuid
            });
        } else {
            // Actualizar lote si todo va bien y estaba en proceso
            await connection.query(
                `UPDATE egg_production_batches
                 SET status = CASE WHEN status = 'en_proceso' THEN 'pasteurizado' ELSE status END,
                     pasteurization_status = CASE WHEN pasteurization_status = 'cerrado' THEN 'cerrado' ELSE 'pasteurizado' END,
                     pasteurization_lot = COALESCE(pasteurization_lot, ?)
                 WHERE id = ? AND company_id = ?`,
                [resolvedPastLot, batch_id, company_id]
            );
        }

        await connection.commit();
        res.status(201).json({ id: result.insertId, haccp_compliant, deviation_description, batchStatus: haccp_compliant ? 'pasteurizado' : 'bloqueado_haccp', pasteurization_lot: resolvedPastLot });
    } catch (error) {
        await connection.rollback();
        res.status(error.status || 500).json({ message: error.message });
    } finally { connection.release(); }
};

const closePasteurization = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const company_id = req.company_id;
        const { pasteurization_lot, notes } = req.body;
        const operator_name = req.body.operator_name || req.user?.nombre || 'Operador Pasteurización';

        const [batches] = await connection.query(
            'SELECT * FROM egg_production_batches WHERE id = ? AND company_id = ? FOR UPDATE',
            [id, company_id]
        );
        if (batches.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Lote no encontrado.' });
        }
        const batch = batches[0];

        if (batch.status === 'bloqueado_haccp') {
            await connection.rollback();
            return res.status(400).json({ message: 'No se puede cerrar pasteurización de un lote bloqueado por HACCP.' });
        }

        if (batch.pasteurization_status === 'cerrado') {
            await connection.commit();
            return res.json({ success: true, pasteurization_status: 'cerrado', pasteurization_lot: batch.pasteurization_lot });
        }
        const [logs] = await connection.query('SELECT id FROM egg_pasteurization_logs WHERE batch_id = ? AND company_id = ? AND haccp_compliant = 1 LIMIT 1', [id, company_id]);
        if (!logs.length) eggRules.fail('Registre una pasteurización conforme antes de cerrar.');
        const resolvedPastLot = (pasteurization_lot || batch.pasteurization_lot || 'PAST-' + batch.id).trim();

        // Auto-cálculo y registro de merma de cáscara (13% fijo) y saldo líquido estimado (87%)
        const inputWeight = Number(batch.input_weight_lbs || 0);
        let autoShell = null;
        let autoYield = null;

        if (inputWeight > 0) {
            const customShell = (req.body.waste_shell_lbs !== undefined && req.body.waste_shell_lbs !== null && req.body.waste_shell_lbs !== '')
                ? Number(req.body.waste_shell_lbs) : null;
            const customYield = (req.body.yield_liquid_lbs !== undefined && req.body.yield_liquid_lbs !== null && req.body.yield_liquid_lbs !== '')
                ? Number(req.body.yield_liquid_lbs) : null;

            autoShell = customShell !== null
                ? customShell
                : (batch.waste_shell_lbs !== null && Number(batch.waste_shell_lbs) > 0
                    ? Number(batch.waste_shell_lbs)
                    : Math.round(inputWeight * 0.13 * 100) / 100);

            autoYield = customYield !== null
                ? customYield
                : (batch.yield_liquid_lbs !== null && Number(batch.yield_liquid_lbs) > 0
                    ? Number(batch.yield_liquid_lbs)
                    : Math.round((inputWeight - autoShell) * 100) / 100);

            // Registrar en egg_batch_waste_logs si aún no se ha registrado la merma de cáscara para este lote
            const [existingWaste] = await connection.query(
                'SELECT id FROM egg_batch_waste_logs WHERE batch_id = ? AND company_id = ? AND stage = "quebraje" AND waste_type = "cascaron" LIMIT 1',
                [id, company_id]
            );
            if (!existingWaste.length && autoShell > 0) {
                await connection.query(
                    `INSERT INTO egg_batch_waste_logs (company_id, batch_id, stage, waste_type, quantity_lbs, reason, operator_name)
                     VALUES (?, ?, 'quebraje', 'cascaron', ?, 'Merma automática de cáscara (13% fijo tras pasteurización)', ?)`,
                    [company_id, id, autoShell, operator_name]
                );
            }
        }

        await connection.query(
            `UPDATE egg_production_batches
             SET pasteurization_status = 'cerrado',
                 pasteurization_lot = ?,
                 status = CASE WHEN status = 'en_proceso' THEN 'pasteurizado' ELSE status END,
                 waste_shell_lbs = COALESCE(waste_shell_lbs, ?),
                 yield_liquid_lbs = COALESCE(yield_liquid_lbs, ?),
                 pasteurization_closed_at = NOW(),
                 pasteurization_closed_by = ?
             WHERE id = ? AND company_id = ?`,
            [resolvedPastLot, autoShell, autoYield, operator_name, id, company_id]
        );

        await connection.query(
            `UPDATE egg_pasteurization_logs
             SET pasteurization_lot = ?
             WHERE batch_id = ? AND company_id = ? AND (pasteurization_lot IS NULL OR pasteurization_lot = '')`,
            [resolvedPastLot, id, company_id]
        );

        await connection.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'pasteurization.closed', 'info', ?, ?, ?)`,
            [
                company_id,
                `Pasteurización del lote #${id} (${batch.batch_code_display || batch.batch_uuid}) cerrada con lote pasteurizado: ${resolvedPastLot}. Cáscara 13%: ${autoShell || 0} Lbs, Líquido: ${autoYield || 0} Lbs.`,
                JSON.stringify({ batch_id: parseInt(id), pasteurization_lot: resolvedPastLot, waste_shell_lbs: autoShell, yield_liquid_lbs: autoYield, notes }),
                operator_name
            ]
        );

        await connection.commit();
        res.json({
            success: true,
            message: `Pasteurización cerrada exitosamente con lote: ${resolvedPastLot}. Merma cáscara (13%): ${autoShell || 0} Lbs, Rendimiento líquido: ${autoYield || 0} Lbs.`,
            pasteurization_lot: resolvedPastLot,
            pasteurization_status: 'cerrado',
            waste_shell_lbs: autoShell,
            yield_liquid_lbs: autoYield
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error in closePasteurization:', error);
        res.status(error.status || 500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

const reopenPasteurization = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const company_id = req.company_id;
        const userPerms = Array.isArray(req.user?.permissions) ? req.user.permissions : (typeof req.user?.permissions === 'string' ? JSON.parse(req.user?.permissions || '[]') : []);
        const canManage = req.eggAccess?.superAdmin || userPerms.includes('manage_egg_production_lots');
        if (!canManage) {
            await connection.rollback();
            return res.status(403).json({ message: 'No tiene el permiso especial requerido para reabrir la pasteurización de este lote.' });
        }

        const [batches] = await connection.query(
            'SELECT * FROM egg_production_batches WHERE id = ? AND company_id = ? FOR UPDATE',
            [id, company_id]
        );
        if (batches.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Lote no encontrado.' });
        }

        await connection.query(
            `UPDATE egg_production_batches
             SET pasteurization_status = 'en_proceso',
                 pasteurization_closed_at = NULL,
                 pasteurization_closed_by = NULL
             WHERE id = ? AND company_id = ?`,
            [id, company_id]
        );

        await connection.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'pasteurization.reopened', 'warning', ?, ?, ?)`,
            [
                company_id,
                `Pasteurización del lote #${id} (${batches[0].batch_code_display || batches[0].batch_uuid}) reabierta para ajustes por ${req.user?.nombre || 'Administrador'}.`,
                JSON.stringify({ batch_id: parseInt(id) }),
                req.user?.nombre || 'Operador'
            ]
        );

        await connection.commit();
        res.json({ success: true, message: 'Pasteurización reabierta exitosamente.', pasteurization_status: 'en_proceso' });
    } catch (error) {
        await connection.rollback();
        console.error('Error in reopenPasteurization:', error);
        res.status(error.status || 500).json({ message: error.message });
    } finally {
        connection.release();
    }
};
module.exports = { completeProductionBatch, createPasteurizationLog, closePasteurization, reopenPasteurization };
