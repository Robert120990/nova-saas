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
        // Cerrar el período
        const result = await contingencyService.stopContingency(id);
        // Enviar reporte a Hacienda
        let reportOk = false;
        try {
            const reportResult = await contingencyService.sendContingencyReport(id);
            result.report = reportResult;
            reportOk = Boolean(reportResult?.success && reportResult?.selloRecepcion);
        } catch (err) {
            console.error('[Contingency] Error enviando reporte:', err.message);
            result.reportError = err.message;
        }

        // Iniciar de inmediato la retransmisión de documentos acumulados vía BullMQ solo si el evento fue confirmado en MH
        if (reportOk || !result.report) {
            const { contingencyQueue } = require('../queue');
            contingencyQueue.enqueueContingencyDocuments(req.company_id).catch(err => {
                console.error('[ContingencyController] Error encolando documentos en BullMQ:', err.message);
            });
        } else {
            console.warn(`[ContingencyController] Reporte de evento #${id} no confirmado aún por MH (${result.report?.message}). Los documentos se retransmitirán tan pronto el evento sea aceptado.`);
        }

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
