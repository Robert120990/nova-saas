const { eggRules, pool, eggExportService } = require('./shared');
const { executeExcelServiceInWorker, executePdfInWorker } = require('../../../services/reportWorkerPool.service');

const updateBatchRemanente = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const targetId = req.params.remanenteId || req.params.id;
        const {
            product_type,
            quantity_lbs,
            weight_lbs,
            is_pasteurized,
            remanente_type,
            storage_location,
            destination,
            status,
            target_batch_id,
            notes,
            operator_name
        } = req.body;
        const company_id = req.company_id || req.user?.company_id;

        const current = await eggRules.owned(connection, 'egg_batch_remanentes', targetId, company_id, true);
        if (current.target_batch_id || current.status !== 'disponible') eggRules.fail('El remanente está asignado o consumido; edite el lote de destino.', 409);
        if (target_batch_id || (status && status !== 'disponible')) eggRules.fail('Asigne el remanente desde el lote de producción.');
        const qty = quantity_lbs === undefined && weight_lbs === undefined ? Number(current.quantity_lbs) : eggRules.number(quantity_lbs ?? weight_lbs, 'Peso', 0.001);
        let remType = remanente_type;
        if (!remType && is_pasteurized !== undefined) {
            remType = is_pasteurized ? 'pasteurizado' : 'no_pasteurizado';
        }
        const loc = storage_location || destination;

        let targetBatch = target_batch_id !== undefined ? target_batch_id : null;
        if (status === 'disponible') {
            targetBatch = null;
        }

        await connection.query(
            `UPDATE egg_batch_remanentes
             SET product_type = COALESCE(?, product_type),
                 quantity_lbs = CASE WHEN ? > 0 THEN ? ELSE quantity_lbs END,
                 remanente_type = COALESCE(?, remanente_type),
                 storage_location = COALESCE(?, storage_location),
                 status = COALESCE(?, status),
                 target_batch_id = CASE
                     WHEN ? = 'disponible' THEN NULL
                     WHEN ? IS NOT NULL THEN ?
                     ELSE target_batch_id
                 END,
                 notes = COALESCE(?, notes),
                 operator_name = COALESCE(?, operator_name),
                 updated_at = NOW()
             WHERE id = ? AND company_id = ?`,
            [
                product_type || null,
                qty, qty,
                remType || null,
                loc || null,
                status || null,
                status || null,
                targetBatch,
                targetBatch,
                notes !== undefined ? notes : null,
                operator_name || null,
                targetId,
                company_id
            ]
        );
        await connection.commit();
        res.json({ success: true, message: 'Remanente actualizado con éxito.' });
    } catch (error) {
        await connection.rollback();
        res.status(error.status || 500).json({ message: error.message });
    } finally { connection.release(); }
};

const deleteBatchRemanente = async (req, res) => {
    try {
        const targetId = req.params.remanenteId || req.params.id;
        const [deleted] = await pool.query("DELETE FROM egg_batch_remanentes WHERE id = ? AND company_id = ? AND status = 'disponible' AND target_batch_id IS NULL", [targetId, req.company_id]);
        if (!deleted.affectedRows) eggRules.fail('Remanente no encontrado o ya asignado.', 409);
        res.json({ success: true, message: 'Remanente eliminado exitosamente.' });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

const closeBatchPackaging = (req, res) => require('../eggPackaging.controller').closeBatchPackaging(req, res);

const exportBatchSummary = async (req, res) => {
    try {
        const { id } = req.params;
        const { format } = req.query; // 'pdf', 'excel', 'word'
        const company_id = req.company_id;

        const data = await eggExportService.getBatchExportData(id, company_id);
        if (!data) {
            return res.status(404).json({ message: 'Lote de producción no encontrado' });
        }

        if (format === 'excel' || format === 'xlsx') {
            const buffer = await executeExcelServiceInWorker({
                serviceRelativePath: 'services/eggProductionExport.service',
                methodName: 'generateBatchSummaryExcel',
                args: [data]
            }, () => eggExportService.generateBatchSummaryExcel(data));
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="resumen_produccion_lote_${id}.xlsx"`);
            return res.send(buffer);
        }

        if (format === 'word' || format === 'docx') {
            const buffer = await eggExportService.generateBatchSummaryWord(id, company_id);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="resumen_produccion_lote_${id}.docx"`);
            return res.send(buffer);
        }

        // Default: PDF
        const buffer = await executePdfInWorker({
            serviceRelativePath: 'services/eggProductionExport.service',
            methodName: 'generateBatchSummaryPdf',
            args: [data]
        }, () => eggExportService.generateBatchSummaryPdf(data));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="resumen_produccion_lote_${id}.pdf"`);
        return res.send(buffer);
    } catch (error) {
        console.error('Error in exportBatchSummary:', error);
        res.status(error.status || 500).json({ message: error.message });
    }
};
module.exports = { updateBatchRemanente, deleteBatchRemanente, closeBatchPackaging, exportBatchSummary };
