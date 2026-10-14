const reopenService = require('../../services/gasCloseoutReopenRequest.service');

/**
 * Solicita la reapertura de un turno cerrado enviando una alerta con botones a Telegram.
 */
const requestReopen = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body || {};

        const result = await reopenService.createReopenRequest({
            closeoutId: id,
            companyId: req.company_id,
            branchId: req.branch_id || req.user?.branch_id,
            userId: req.user.id,
            userName: req.user.name || req.user.username || 'Usuario',
            reason: (reason || '').trim()
        });

        res.json(result);
    } catch (error) {
        console.error('Error requestReopen:', error);
        res.status(400).json({ message: error.message || 'Error al procesar la solicitud de apertura' });
    }
};

/**
 * Consulta el estado actual de solicitud de reapertura de un cierre.
 */
const getReopenStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const status = await reopenService.getCloseoutReopenStatus(id, req.company_id);
        res.json({
            hasPending: status?.status === 'pending',
            request: status
        });
    } catch (error) {
        console.error('Error getReopenStatus:', error);
        res.status(500).json({ message: 'Error al consultar estado de solicitud' });
    }
};

module.exports = {
    requestReopen,
    getReopenStatus
};
