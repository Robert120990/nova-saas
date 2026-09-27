const { pool } = require('./shared');

const deleteScheduledProduction = async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.company_id || req.user?.company_id;

        const [existing] = await pool.query(
            'SELECT * FROM egg_scheduled_productions WHERE id = ? AND company_id = ?',
            [id, company_id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: 'Producción no encontrada.' });
        }

        if (existing[0].status === 'completado') {
            return res.status(400).json({
                message: `No se puede eliminar una producción completada/finalizada en planta con trazabilidad cerrada.`
            });
        }

        // Si tiene corrida vinculada en producción, desvincularla para no dejar huérfana la FK
        await pool.query(
            'UPDATE egg_production_batches SET scheduled_production_id = NULL WHERE scheduled_production_id = ? AND company_id = ?',
            [id, company_id]
        );

        await pool.query(
            'DELETE FROM egg_scheduled_productions WHERE id = ? AND company_id = ?',
            [id, company_id]
        );

        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'calendar.deleted', 'warning', ?, ?, ?)`,
            [
                company_id,
                `Producción programada ${existing[0].lot_code} para ${existing[0].production_date} eliminada.`,
                JSON.stringify({ id, lot_code: existing[0].lot_code }),
                req.user?.nombre || 'Planificador'
            ]
        );

        res.json({ message: 'Producción programada eliminada correctamente.' });
    } catch (error) {
        console.error('Error al eliminar producción:', error);
        res.status(500).json({ message: error.message });
    }
};

const startBatchFromSchedule = async (req, res) => {
    try {
        const { owned, fail } = require('../../../services/eggRules.service');
        const schedule = await owned(pool, 'egg_scheduled_productions', req.params.id, req.company_id);
        if (schedule.batch_id) return res.json({ batch_id: schedule.batch_id, scheduled_id: schedule.id, message: 'El programa ya tiene un lote.' });
        if (!Array.isArray(req.body.raw_materials) || !req.body.raw_materials.length) fail('Abra Producción y seleccione la materia prima real para iniciar este programa.');
        req.body = { ...req.body, scheduled_production_id: schedule.id, branch_id: schedule.branch_id || req.branch_id,
            product_type: req.body.product_type || schedule.product_profile, presentation: schedule.presentation,
            batch_code_display: schedule.lot_code, target_solids_pct: schedule.target_solids_pct };
        return require('../eggProduction.controller').createProductionBatch(req, res);
    } catch (error) { res.status(error.status || 500).json({ message: error.message }); }
};

const toggleTaskStatus = async (req, res) => {
    try {
        const { taskId } = req.params;
        const company_id = req.company_id;

        const [taskRows] = await pool.query(
            'SELECT * FROM egg_scheduled_tasks WHERE id = ? AND company_id = ?',
            [taskId, company_id]
        );

        if (taskRows.length === 0) {
            return res.status(404).json({ message: 'Tarea no encontrada.' });
        }

        const currentStatus = taskRows[0].checklist_status;
        let nextStatus = 'en_progreso';
        let completedAt = null;

        if (currentStatus === 'pendiente') {
            nextStatus = 'completado';
            completedAt = new Date();
        } else if (currentStatus === 'completado') {
            nextStatus = 'pendiente';
            completedAt = null;
        } else {
            nextStatus = 'completado';
            completedAt = new Date();
        }

        await pool.query(
            'UPDATE egg_scheduled_tasks SET checklist_status = ?, completed_at = ? WHERE id = ? AND company_id = ?',
            [nextStatus, completedAt, taskId, company_id]
        );

        res.json({ id: taskId, checklist_status: nextStatus, completed_at: completedAt });
    } catch (error) {
        console.error('Error al alternar tarea:', error);
        res.status(500).json({ message: error.message });
    }
};
module.exports = { deleteScheduledProduction, startBatchFromSchedule, toggleTaskStatus };
