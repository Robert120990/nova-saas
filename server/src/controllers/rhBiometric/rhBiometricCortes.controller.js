const rhBiometricCortesService = require('../../services/rhBiometricCortes.service');

/**
 * Obtener resumen del rango pendiente de reportar y último corte congelado
 */
const getPendingOvertimeSummary = async (req, res) => {
    try {
        const data = await rhBiometricCortesService.getPendingRangeSummary(req.company_id);
        res.json({ success: true, ...data });
    } catch (error) {
        console.error('Error al obtener resumen de corte pendiente:', error);
        res.status(500).json({ message: error.message || 'Error al obtener resumen de corte pendiente' });
    }
};

/**
 * Obtener listado de horas diarias y horas extra (filtrado por rango pendiente o por corte)
 */
const getDailyOvertimeRows = async (req, res) => {
    try {
        const data = await rhBiometricCortesService.getDailyOvertimeRows(req.company_id, req.query);
        res.json({ success: true, ...data });
    } catch (error) {
        console.error('Error al consultar horas extra:', error);
        res.status(500).json({ message: error.message || 'Error al consultar horas extra' });
    }
};

/**
 * Editar horas extra de un colaborador en una fecha (permite editar en pendientes y en congelados)
 */
const updateOvertimeEntry = async (req, res) => {
    try {
        const result = await rhBiometricCortesService.updateOvertimeEntry(req.company_id, req.user?.id, req.body);
        res.json(result);
    } catch (error) {
        console.error('Error al actualizar horas extra:', error);
        res.status(400).json({ message: error.message || 'Error al actualizar horas extra' });
    }
};

/**
 * Congelar período por fechas
 */
const freezePeriod = async (req, res) => {
    try {
        const result = await rhBiometricCortesService.freezePeriod(req.company_id, req.user?.id, req.body);
        res.json(result);
    } catch (error) {
        console.error('Error al congelar período:', error);
        res.status(400).json({ message: error.message || 'Error al congelar período' });
    }
};

/**
 * Listar historial de cortes congelados
 */
const getCortesList = async (req, res) => {
    try {
        const cortes = await rhBiometricCortesService.getCortesList(req.company_id);
        res.json({ success: true, data: cortes });
    } catch (error) {
        console.error('Error al listar cortes congelados:', error);
        res.status(500).json({ message: error.message || 'Error al listar cortes' });
    }
};

/**
 * Descongelar o reabrir corte
 */
const unfreezeCorte = async (req, res) => {
    try {
        const result = await rhBiometricCortesService.unfreezeCorte(req.company_id, req.params.id);
        res.json(result);
    } catch (error) {
        console.error('Error al descongelar corte:', error);
        res.status(400).json({ message: error.message || 'Error al descongelar corte' });
    }
};

module.exports = {
    getPendingOvertimeSummary,
    getDailyOvertimeRows,
    updateOvertimeEntry,
    freezePeriod,
    getCortesList,
    unfreezeCorte
};
