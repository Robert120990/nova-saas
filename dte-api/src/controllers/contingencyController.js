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
        try {
            const reportResult = await contingencyService.sendContingencyReport(id);
            result.report = reportResult;
        } catch (err) {
            console.error('[Contingency] Error enviando reporte:', err.message);
            result.reportError = err.message;
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

module.exports = { start, stop, reportDocument, getStatus };
