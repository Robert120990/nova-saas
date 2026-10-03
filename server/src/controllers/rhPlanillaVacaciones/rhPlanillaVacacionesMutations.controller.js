const pool = require('../../config/db');
const notificationService = require('../../services/notification.service');
const { persistBenefit } = require('../../services/rhBenefitsPersistence.service');

const createPlanilla = async (req, res) => {
    try {
        const result = await persistBenefit(pool, 'vacaciones', req.company_id, req.body);
        notificationService.notify('vacation_payroll_generated', req.company_id, req.user?.branch_id, { periodo: `${req.body.periodo_mes}/${req.body.periodo_año}`, total_empleados: 1, total_pagar: req.body.monto_recibir, fecha_generacion: new Date().toISOString().split('T')[0] }).catch(() => {});
        res.status(201).json(result);
    } catch (error) { res.status(error.status || 500).json({ message: error.message }); }
};
const updatePlanilla = async (req, res) => {
    try { res.json(await persistBenefit(pool, 'vacaciones', req.company_id, req.body, req.params.id)); }
    catch (error) { res.status(error.status || 500).json({ message: error.message }); }
};
const deletePlanilla = async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM rh_planilla_vacaciones WHERE id = ? AND company_id = ?', [req.params.id, req.company_id]);
        if (!result.affectedRows) return res.status(404).json({ message: 'Planilla no encontrada' });
        res.json({ message: 'Planilla eliminada' });
    } catch (error) { res.status(500).json({ message: error.message }); }
};
module.exports = { createPlanilla, updatePlanilla, deletePlanilla };
