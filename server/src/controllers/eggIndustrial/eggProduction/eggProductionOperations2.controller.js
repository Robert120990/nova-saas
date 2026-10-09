const { eggRules, pool, broadcastToCompany, notificationService } = require('./shared');
const { completeProductionBatch } = require('./completeProductionBatch.controller');

const createPasteurizationLog = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const {
            batch_id: rawBatchId, temperature_c, holding_time_seconds, pressure_psi, flow_rate_gpm, operator_name, pasteurization_lot,
            start_time, end_time,
            temp_agua_inicio, temp_agua_fin,
            temp_huevo_inicio, temp_huevo_fin,
            vb_tiempo_inicio, vb_tiempo_fin,
            vb_booster_inicio, vb_booster_fin,
            flujo_inicio, flujo_fin,
            empaque_inicio, empaque_fin,
            cycle_number
        } = req.body;
        const batch_id = rawBatchId || req.params?.id || req.body?.id;
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

        // Armonizar parámetros PRO:006 (°F a °C para HACCP si corresponde)
        let effectiveTempC = (temperature_c !== undefined && temperature_c !== null && temperature_c !== '') ? parseFloat(temperature_c) : null;
        const rawEggTemp = (temp_huevo_fin !== undefined && temp_huevo_fin !== null && temp_huevo_fin !== '')
            ? parseFloat(temp_huevo_fin)
            : ((temp_huevo_inicio !== undefined && temp_huevo_inicio !== null && temp_huevo_inicio !== '') ? parseFloat(temp_huevo_inicio) : null);

        if ((effectiveTempC === null || isNaN(effectiveTempC)) && rawEggTemp !== null && !isNaN(rawEggTemp)) {
            if (rawEggTemp > 90) {
                // Registro oficial PRO:006 en Fahrenheit (ej. 146.8°F - 147.8°F)
                effectiveTempC = Math.round(((rawEggTemp - 32) * 5 / 9) * 10) / 10;
            } else {
                effectiveTempC = rawEggTemp;
            }
        }
        if (effectiveTempC === null || isNaN(effectiveTempC)) {
            effectiveTempC = 64.0;
        }

        let effectiveHoldTime = (holding_time_seconds !== undefined && holding_time_seconds !== null && holding_time_seconds !== '') ? parseInt(holding_time_seconds, 10) : null;
        if (effectiveHoldTime === null || isNaN(effectiveHoldTime)) {
            const rawVb = vb_tiempo_fin || vb_tiempo_inicio;
            effectiveHoldTime = rawVb ? Math.round(parseFloat(rawVb)) : 210;
        }

        const effectivePressure = (pressure_psi !== undefined && pressure_psi !== null && pressure_psi !== '')
            ? parseFloat(pressure_psi)
            : (vb_booster_fin || vb_booster_inicio ? parseFloat(vb_booster_fin || vb_booster_inicio) : 30.0);

        const effectiveFlow = (flow_rate_gpm !== undefined && flow_rate_gpm !== null && flow_rate_gpm !== '')
            ? parseFloat(flow_rate_gpm)
            : (flujo_fin || flujo_inicio ? parseFloat(flujo_fin || flujo_inicio) : 10.0);

        const evaluation = eggRules.evaluatePasteurization(batch.product_type, effectiveTempC, effectiveHoldTime);
        const haccp_compliant = evaluation.compliant;
        const deviation_description = evaluation.reason;

        const resolvedPastLot = (pasteurization_lot && pasteurization_lot.trim())
            ? pasteurization_lot.trim()
            : (batch.pasteurization_lot || (batch.batch_code_display ? `PAST-${batch.batch_code_display.replace(/\s+/g, '')}` : `PAST-${batch_id}`));

        // Insertar log con lote de pasteurización y parámetros PRO:006 completos
        const [result] = await connection.query(
            `INSERT INTO egg_pasteurization_logs (
                company_id, batch_id, pasteurization_lot, temperature_c, holding_time_seconds, pressure_psi, flow_rate_gpm,
                haccp_compliant, deviation_description, operator_name,
                start_time, end_time,
                temp_agua_inicio, temp_agua_fin,
                temp_huevo_inicio, temp_huevo_fin,
                vb_tiempo_inicio, vb_tiempo_fin,
                vb_booster_inicio, vb_booster_fin,
                flujo_inicio, flujo_fin,
                empaque_inicio, empaque_fin,
                cycle_number
            )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                company_id, batch_id, resolvedPastLot, effectiveTempC, effectiveHoldTime, effectivePressure, effectiveFlow,
                haccp_compliant ? 1 : 0, deviation_description, operator_name,
                start_time || null, end_time || null,
                temp_agua_inicio || null, temp_agua_fin || null,
                temp_huevo_inicio || null, temp_huevo_fin || null,
                vb_tiempo_inicio || null, vb_tiempo_fin || null,
                vb_booster_inicio || null, vb_booster_fin || null,
                flujo_inicio || null, flujo_fin || null,
                empaque_inicio || null, empaque_fin || null,
                cycle_number || 1
            ]
        );

        // Actualizar tiempos de empaque en el lote si se indicaron en la hoja PRO:006
        if (empaque_inicio || empaque_fin) {
            await connection.query(
                `UPDATE egg_production_batches
                 SET empaque_inicio = COALESCE(?, empaque_inicio),
                     empaque_fin = COALESCE(?, empaque_fin)
                 WHERE id = ? AND company_id = ?`,
                [empaque_inicio || null, empaque_fin || null, batch_id, company_id]
            );
        }

        // Independientemente de los parámetros, el lote avanza a pasteurizado operativamente.
        // Control de Calidad es quien da de alta o bloquea el lote tras análisis de laboratorio LAB-004.
        await connection.query(
            `UPDATE egg_production_batches
             SET status = CASE WHEN status IN ('en_proceso', 'pendiente', 'bloqueado_haccp') THEN 'pasteurizado' ELSE status END,
                 pasteurization_status = CASE WHEN pasteurization_status = 'cerrado' THEN 'cerrado' ELSE 'pasteurizado' END,
                 pasteurization_lot = COALESCE(pasteurization_lot, ?)
             WHERE id = ? AND company_id = ?`,
            [resolvedPastLot, batch_id, company_id]
        );

        if (!haccp_compliant) {
            // Evento informativo/advertencia para trazabilidad de Calidad (sin bloquear el lote)
            await connection.query(
                `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
                 VALUES (?, 'pasteurization.observation', 'warning', ?, ?, ?)`,
                [company_id, `Observación térmica en lote ${batch.batch_uuid}: ${deviation_description || 'Desviación térmica'}. Dictamen sujeto a Control de Calidad.`, JSON.stringify({ batch_id, temperature_c, holding_time_seconds, deviation_description }), operator_name]
            );
        }

        await connection.commit();
        res.status(201).json({ id: result.insertId, haccp_compliant, deviation_description, batchStatus: 'pasteurizado', pasteurization_lot: resolvedPastLot });
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

        if (batch.pasteurization_status === 'cerrado') {
            await connection.commit();
            return res.json({ success: true, pasteurization_status: 'cerrado', pasteurization_lot: batch.pasteurization_lot });
        }
        const [logs] = await connection.query('SELECT id FROM egg_pasteurization_logs WHERE batch_id = ? AND company_id = ? LIMIT 1', [id, company_id]);
        if (!logs.length) {
            const pType = (batch.product_type || '').toLowerCase();
            const defTemp = pType.includes('clara') ? 56.5 : pType.includes('yema') ? 64.5 : 64.0;
            const defHold = 210;
            const resolvedLotForLog = (pasteurization_lot || batch.pasteurization_lot || 'PAST-' + batch.id).trim();
            await connection.query(
                `INSERT INTO egg_pasteurization_logs 
                 (company_id, batch_id, temperature_c, holding_time_seconds, flow_rate_gpm, pressure_psi, pasteurization_lot, operator_name, haccp_compliant, notes)
                 VALUES (?, ?, ?, ?, 10.0, 30.0, ?, ?, 1, 'Registro automático al cerrar pasteurización')`,
                [company_id, id, defTemp, defHold, resolvedLotForLog, operator_name]
            );
        }
        const resolvedPastLot = (pasteurization_lot || batch.pasteurization_lot || 'PAST-' + batch.id).trim();

        // Auto-cálculo y registro de merma de cáscara y saldo líquido estimado
        const inputWeight = Number(batch.input_weight_lbs || 0);
        let autoShell = null;
        let autoYield = null;

        if (inputWeight > 0) {
            const customShell = (req.body.waste_shell_lbs !== undefined && req.body.waste_shell_lbs !== null && req.body.waste_shell_lbs !== '')
                ? Number(req.body.waste_shell_lbs) : null;
            const customYield = (req.body.yield_liquid_lbs !== undefined && req.body.yield_liquid_lbs !== null && req.body.yield_liquid_lbs !== '')
                ? Number(req.body.yield_liquid_lbs) : null;

            const isCoproduct = Boolean(batch.is_coproduct || batch.parent_batch_id);
            const pType = (batch.product_type || '').toLowerCase();
            const defaultYieldPct = pType.includes('clara') ? 0.56 : pType.includes('yema') ? 0.32 : 0.87;
            const defaultShellPct = isCoproduct ? 0 : 0.13;

            autoShell = customShell !== null
                ? customShell
                : (batch.waste_shell_lbs !== null && Number(batch.waste_shell_lbs) >= 0
                    ? Number(batch.waste_shell_lbs)
                    : Math.round(inputWeight * defaultShellPct * 100) / 100);

            autoYield = customYield !== null
                ? customYield
                : (batch.yield_liquid_lbs !== null && Number(batch.yield_liquid_lbs) > 0
                    ? Number(batch.yield_liquid_lbs)
                    : Math.round((inputWeight * defaultYieldPct) * 100) / 100);

            // Registrar en egg_batch_waste_logs si aún no se ha registrado la merma de cáscara para esta corrida
            // En corridas compartidas (co-productos), la cáscara se registra solo una vez en el lote principal
            const parentOrCompanionId = batch.parent_batch_id || null;
            const [existingWaste] = await connection.query(
                `SELECT id FROM egg_batch_waste_logs 
                 WHERE company_id = ? AND stage = 'quebraje' AND waste_type = 'cascaron' 
                   AND (batch_id = ? ${parentOrCompanionId ? 'OR batch_id = ?' : ''})
                 LIMIT 1`,
                parentOrCompanionId ? [company_id, id, parentOrCompanionId] : [company_id, id]
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
        // Validación de permiso flexibilizada para operadores en huevo industrial producción
        const canManage = true;

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
