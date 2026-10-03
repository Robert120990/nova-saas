const pool = require('../../config/db');
const notificationService = require('../../services/notification.service');
const { persistBenefit } = require('../../services/rhBenefitsPersistence.service');

const createLiquidacion = async (req, res) => {
    try {
        const result = await persistBenefit(pool, 'liquidaciones', req.company_id, req.body);
        notificationService.notify('settlement_created', req.company_id, req.user?.branch_id, { empleado_nombre: '', tipo_liquidacion: '', monto_total: req.body.total_devengado, motivo: '', fecha: new Date().toISOString().split('T')[0] }).catch(() => {});
        res.status(201).json(result);
    } catch (error) { res.status(error.status || 500).json({ message: error.message }); }
};
const updateLiquidacion = async (req, res) => {
    try { res.json(await persistBenefit(pool, 'liquidaciones', req.company_id, req.body, req.params.id)); }
    catch (error) { res.status(error.status || 500).json({ message: error.message }); }
};
const deleteLiquidacion = async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM rh_planilla_liquidaciones WHERE id = ? AND company_id = ?', [req.params.id, req.company_id]);
        if (!result.affectedRows) return res.status(404).json({ message: 'Planilla no encontrada' });
        res.json({ message: 'Planilla eliminada' });
    } catch (error) { res.status(500).json({ message: error.message }); }
};
module.exports = { createLiquidacion, updateLiquidacion, deleteLiquidacion };
