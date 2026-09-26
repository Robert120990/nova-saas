/**
 * Contingency Controller
 */

const contingencyService = require('../contingency/contingencyService');

async function start(req, res) {
    try {
        if (req.body.companyId || req.body.company_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'No está permitido enviar IDs de empresa en el cuerpo.' 
            });
        }
        const payload = { ...req.body, companyId: req.company_id, branchId: req.branch_id };
        console.log(`[SecurityAudit] Contingency START for Company: ${req.company_id}`);
        const result = await contingencyService.startContingency(payload);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
}

async function stop(req, res) {
    const { id } = req.params;
    try {
        // 1. Enviar reporte a Hacienda PRIMERO
        const reportResult = await contingencyService.sendContingencyReport(id);
        const reportOk = Boolean(reportResult?.success && (reportResult?.selloRecepcion || reportResult?.message?.includes('sin documentos')));

        if (!reportOk && reportResult && !reportResult.success) {
            return res.status(400).json({
                success: false,
                message: `No se pudo cerrar la contingencia: Hacienda no recibió el reporte del evento (${reportResult.message || 'Error de conexión'}).`,
                report: reportResult
            });
        }

        // 2. Cerrar el período en base de datos SOLO si Hacienda aceptó el reporte
        const result = await contingencyService.stopContingency(id);
        result.report = reportResult;

        // 3. Iniciar de inmediato la retransmisión de documentos acumulados vía BullMQ
        const { contingencyQueue } = require('../queue');
        contingencyQueue.enqueueContingencyDocuments(req.company_id).catch(err => {
            console.error('[ContingencyController] Error encolando documentos en BullMQ:', err.message);
        });

        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
}

async function reportDocument(req, res) {
    try {
        const payload = { ...req.body, companyId: req.company_id };
        const result = await contingencyService.addToContingencyQueue(payload);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
}

async function getStatus(req, res) {
    try {
        const result = await contingencyService.getContingencyStatus(req.company_id);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
}

async function simulateOutage(req, res) {
    try {
        const { enabled } = req.body;
        const { setSimulatedOutage, isSimulatedOutage } = require('../config/haciendaConfig');
        await setSimulatedOutage(enabled);
        res.status(200).json({ success: true, simulatedOutage: isSimulatedOutage() });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
}

async function triggerAutoCloseCheck(req, res) {
    try {
        const { checkAndAutoCloseContingencies } = require('../jobs/autoCloseContingency');
        await checkAndAutoCloseContingencies({ bypassCooldown: req.body?.bypassCooldown !== false });
        res.status(200).json({ success: true, message: 'Verificación ejecutada' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
}

module.exports = { start, stop, reportDocument, getStatus, simulateOutage, triggerAutoCloseCheck };
