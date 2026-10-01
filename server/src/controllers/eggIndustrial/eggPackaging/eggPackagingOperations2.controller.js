const { owned, fail, number, pool } = require('./shared');
const { adjustPackagingStock, revertPackagingStock } = require('../../../services/eggStock.service');

const updatePackagingRecord = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const {
            units_packaged,
            weight_per_unit_lbs,
            operator_name,
            lot_code,
            product_type,
            presentation,
            batch_id,
            reopen_packaging
        } = req.body;
        const company_id = req.company_id;

        const [existing] = await connection.query(
            'SELECT * FROM egg_packaging_records WHERE id = ? AND company_id = ? FOR UPDATE',
            [id, company_id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Registro de empaque no encontrado.' });
        }
        const currentRecord = existing[0];
        if (Number(currentRecord.dispatched_units || 0) > 0) fail('No se puede editar un empaque con salidas comerciales.', 409);

        const userPerms = Array.isArray(req.user?.permissions)
            ? req.user.permissions
            : (typeof req.user?.permissions === 'string' ? JSON.parse(req.user?.permissions || '[]') : []);
        const canEditLots = req.eggAccess?.superAdmin || userPerms.includes('manage_egg_production_lots') || userPerms.includes('manage_egg_packaging_close');

        const finalUnits = number(units_packaged ?? currentRecord.units_packaged, 'Unidades', 1);
        const finalWeight = parseFloat(weight_per_unit_lbs !== undefined ? weight_per_unit_lbs : currentRecord.weight_per_unit_lbs);
        const total_batch_weight_lbs = finalUnits * finalWeight;

        // Si tiene permiso especial, puede cambiar lote de empaque, lote de producción, producto y presentación
        const finalLotCode = (canEditLots && lot_code && lot_code.trim()) ? lot_code.trim() : currentRecord.lot_code;
        const finalProductType = (canEditLots && product_type && product_type.trim()) ? product_type.trim() : currentRecord.product_type;
        const finalPresentation = (canEditLots && presentation && presentation.trim()) ? presentation.trim() : currentRecord.presentation;
        const finalBatchId = (canEditLots && batch_id) ? parseInt(batch_id, 10) : currentRecord.batch_id;

        number(finalUnits, 'Unidades', 1);
        number(finalWeight, 'Peso unitario', 0.001);
        const parent = await owned(connection, 'egg_production_batches', finalBatchId, company_id, true);
        if (parent.packaging_status === 'cerrado' || parent.status === 'bloqueado_haccp') fail('El lote está cerrado o bloqueado.', 409);
        const [other] = await connection.query('SELECT COALESCE(SUM(total_batch_weight_lbs), 0) AS weight FROM egg_packaging_records WHERE batch_id = ? AND company_id = ? AND id != ?', [finalBatchId, company_id, id]);
        const [remSum] = await connection.query('SELECT COALESCE(SUM(quantity_lbs), 0) as remanentes_lbs FROM egg_batch_remanentes WHERE target_batch_id = ? AND company_id = ?', [finalBatchId, company_id]);
        const totalAvailableLiquid = Number(parent.yield_liquid_lbs || 0) + Number(remSum[0]?.remanentes_lbs || 0);
        if (!canEditLots && (Number(other[0].weight) + total_batch_weight_lbs > totalAvailableLiquid + 0.01)) {
            fail('El peso supera el rendimiento disponible (incluyendo remanentes asignados).');
        }
        // Actualizar qr_code_payload si cambió algo clave
        let updatedQrPayload = currentRecord.qr_code_payload;
        try {
            const parsed = JSON.parse(currentRecord.qr_code_payload || '{}');
            parsed.lot_code = finalLotCode;
            parsed.product = finalProductType;
            parsed.presentation = finalPresentation;
            parsed.units = finalUnits;
            parsed.weight_lbs = total_batch_weight_lbs;
            updatedQrPayload = JSON.stringify(parsed);
        } catch {
            updatedQrPayload = JSON.stringify({
                lot_code: finalLotCode,
                product: finalProductType,
                presentation: finalPresentation,
                units: finalUnits,
                weight_lbs: total_batch_weight_lbs
            });
        }

        await connection.query(
            `UPDATE egg_packaging_records
             SET units_packaged = ?,
                 weight_per_unit_lbs = ?,
                 total_batch_weight_lbs = ?,
                 lot_code = ?,
                 product_type = ?,
                 presentation = ?,
                 batch_id = ?,
                 qr_code_payload = ?,
                 operator_name = ?
             WHERE id = ? AND company_id = ?`,
            [
                finalUnits,
                finalWeight,
                total_batch_weight_lbs,
                finalLotCode,
                finalProductType,
                finalPresentation,
                finalBatchId,
                updatedQrPayload,
                operator_name || currentRecord.operator_name,
                id,
                company_id
            ]
        );

        // Ajustar inventario comercial y registrar movimiento Kardex de ser necesario
        await adjustPackagingStock(
            connection,
            company_id,
            id,
            currentRecord,
            {
                units_packaged: finalUnits,
                product_type: finalProductType,
                presentation: finalPresentation,
                branch_id: parent.branch_id || currentRecord.branch_id
            }
        );

        // Si se solicitó reabrir el envasado del lote asociado
        if (canEditLots && reopen_packaging) {
            await connection.query(
                `UPDATE egg_production_batches
                 SET packaging_status = 'en_envasado',
                     status = CASE WHEN status = 'empaquetado' THEN 'pasteurizado' ELSE status END,
                     packaging_loss_lbs = 0,
                     packaging_efficiency_pct = 0
                 WHERE id = ? AND company_id = ?`,
                [finalBatchId, company_id]
            );
            await connection.query(
                `DELETE FROM egg_batch_waste_logs
                 WHERE batch_id = ? AND company_id = ? AND stage = 'envasado' AND waste_type = 'merma_tuberias_envasado'`,
                [finalBatchId, company_id]
            );
        }

        await connection.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'packaging.updated', 'info', ?, ?, ?)`,
            [
                company_id,
                `Empaque #${id} (${finalLotCode}) actualizado: ${finalUnits} unidades, ${total_batch_weight_lbs} Lbs, producto: ${finalProductType}.`,
                JSON.stringify({ packaging_id: parseInt(id), lot_code: finalLotCode, product_type: finalProductType, presentation: finalPresentation }),
                operator_name || req.user?.nombre || 'Operador'
            ]
        );

        await connection.commit();

        res.json({
            id,
            units_packaged: finalUnits,
            weight_per_unit_lbs: finalWeight,
            total_batch_weight_lbs,
            lot_code: finalLotCode,
            product_type: finalProductType,
            presentation: finalPresentation,
            batch_id: finalBatchId
        });
    } catch (error) {
        await connection.rollback();
        res.status(error.status || 500).json({ message: error.message });
    } finally {
        await connection.rollback();
        connection.release();
    }
};

const deletePackagingRecord = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const company_id = req.company_id;

        const [existing] = await connection.query(
            'SELECT * FROM egg_packaging_records WHERE id = ? AND company_id = ? FOR UPDATE',
            [id, company_id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Registro de empaque no encontrado.' });
        }

        if (Number(existing[0].dispatched_units || 0) > 0) fail('No se puede eliminar un empaque con salidas comerciales.', 409);
        const batch = await owned(connection, 'egg_production_batches', existing[0].batch_id, company_id, true);
        if (batch.packaging_status === 'cerrado') fail('Reabra el lote antes de eliminar empaques.', 409);
        // Check if this packaging record is linked to a blast freezer log
        const [freezerRefs] = await connection.query(
            'SELECT id FROM egg_blast_freezer_logs WHERE packaging_id = ?',
            [id]
        );
        if (freezerRefs.length > 0) {
            return res.status(400).json({ message: 'No se puede eliminar: este empaque tiene registros de Blast Freezer asociados. Elimine primero los registros de congelación.' });
        }

        // Revertir inventario comercial y registrar salida en Kardex
        await revertPackagingStock(
            connection,
            company_id,
            id,
            existing[0],
            existing[0].units_packaged,
            'ANULACION_ENVASADO'
        );

        await connection.query('DELETE FROM egg_packaging_records WHERE id = ? AND company_id = ?', [id, company_id]);

        await connection.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'packaging.deleted', 'warning', ?, ?, ?)`,
            [company_id, `Empaque #${id} eliminado.`, JSON.stringify({ packaging_id: parseInt(id) }), existing[0].operator_name]
        );

        await connection.commit();

        res.json({ id, deleted: true });
    } catch (error) {
        await connection.rollback();
        res.status(error.status || 500).json({ message: error.message });
    }
};

const getBlastFreezerLogs = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT fl.*, pr.lot_code, b.product_type
             FROM egg_blast_freezer_logs fl
             LEFT JOIN egg_packaging_records pr ON fl.packaging_id = pr.id
             LEFT JOIN egg_production_batches b ON pr.batch_id = b.id
             WHERE fl.company_id = ?
             ORDER BY fl.created_at DESC`,
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

const createBlastFreezerLog = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { packaging_id, freezer_location, core_temperature_c, freezing_duration_hours, status } = req.body;
        const company_id = req.company_id;
        await owned(connection, 'egg_packaging_records', packaging_id, company_id, true);

        const [result] = await connection.query(
            `INSERT INTO egg_blast_freezer_logs (company_id, packaging_id, freezer_location, core_temperature_c, freezing_duration_hours, status)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [company_id, packaging_id, freezer_location, core_temperature_c, freezing_duration_hours, status || 'congelando']
        );

        // Si ya está completado el congelado, actualizar el lote general
        if (status === 'congelado_ok') {
            const [pkgs] = await connection.query('SELECT batch_id FROM egg_packaging_records WHERE id = ? AND company_id = ?', [packaging_id, company_id]);
            if (pkgs.length > 0) {
                await connection.query(
                    `UPDATE egg_production_batches SET status = CASE WHEN status IN ('bloqueado_haccp', 'aprobado_calidad') THEN status ELSE 'congelado' END WHERE id = ? AND company_id = ?`,
                    [pkgs[0].batch_id, company_id]
                );
            }
        }

        await connection.commit();

        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        await connection.rollback();
        res.status(error.status || 500).json({ message: error.message });
    }
};
module.exports = { updatePackagingRecord, deletePackagingRecord, getBlastFreezerLogs, createBlastFreezerLog };
