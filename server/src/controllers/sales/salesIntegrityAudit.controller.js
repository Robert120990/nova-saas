const salesIntegrityAuditService = require('../../services/salesIntegrityAudit.service');

/**
 * Controlador para Auditoría Forense de Integridad y Duplicidad de Ventas
 */

/**
 * Obtiene el diagnóstico forense completo de ventas en formato JSON
 */
async function getSalesIntegrityAudit(req, res) {
    try {
        const companyId = req.companyId || req.company_id || req.user?.company_id || req.headers['x-company-id'];
        if (!companyId) {
            return res.status(400).json({ success: false, message: 'Identificador de empresa (company_id) no proporcionado.' });
        }

        const auditData = await salesIntegrityAuditService.runSalesIntegrityAudit(companyId);
        return res.json({
            success: true,
            data: auditData,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error en getSalesIntegrityAudit:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al ejecutar la auditoría de integridad de ventas.',
            error: error.message
        });
    }
}

/**
 * Exporta el dictamen de auditoría forense en PDF oficial
 */
async function exportSalesIntegrityAuditPDF(req, res) {
    try {
        const companyId = req.companyId || req.company_id || req.user?.company_id || req.headers['x-company-id'];
        if (!companyId) {
            return res.status(400).json({ success: false, message: 'Identificador de empresa (company_id) no proporcionado.' });
        }

        const pdfBuffer = await salesIntegrityAuditService.generateAuditPdfBuffer(companyId);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Auditoria_Integridad_Ventas_${Date.now()}.pdf"`);
        return res.send(pdfBuffer);
    } catch (error) {
        console.error('Error en exportSalesIntegrityAuditPDF:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al generar el dictamen PDF de auditoría.',
            error: error.message
        });
    }
}

/**
 * Sincroniza los sellos de recepción existentes en la tabla `dtes` hacia `sales_headers`
 */
async function syncUnsyncedDteStamps(req, res) {
    try {
        const companyId = req.companyId || req.company_id || req.user?.company_id || req.headers['x-company-id'];
        if (!companyId) {
            return res.status(400).json({ success: false, message: 'Identificador de empresa (company_id) no proporcionado.' });
        }

        const syncResult = await salesIntegrityAuditService.syncUnsyncedDteStamps(companyId);
        return res.json({
            success: true,
            message: `Sincronización completada: ${syncResult.updatedCount} sellos vinculados con éxito.`,
            data: syncResult
        });
    } catch (error) {
        console.error('Error en syncUnsyncedDteStamps:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al sincronizar sellos de recepción de DTE.',
            error: error.message
        });
    }
}

module.exports = {
    getSalesIntegrityAudit,
    exportSalesIntegrityAuditPDF,
    syncUnsyncedDteStamps
};
