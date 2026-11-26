const rhBiometricCortesService = require('../../services/rhBiometricCortes.service');
const rhBiometricCortesReportService = require('../../services/rhBiometricCortesReport.service');
const { executeExcelServiceInWorker } = require('../../services/reportWorkerPool.service');

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

/**
 * Actualizar horas extra en lote (aprobar reloj, denegar 0h, tope o valor fijo)
 */
const batchUpdateOvertimeEntries = async (req, res) => {
    try {
        const result = await rhBiometricCortesService.batchUpdateOvertimeEntries(req.company_id, req.user?.id, req.body);
        res.json(result);
    } catch (error) {
        console.error('Error al actualizar horas extra en lote:', error);
        res.status(400).json({ message: error.message || 'Error al actualizar horas extra en lote' });
    }
};

/**
 * Exportar período congelado en PDF o Excel (Resumen Global con firmas por fila o Detallado por Persona)
 */
const exportCorteReport = async (req, res) => {
    try {
        const corteId = Number(req.params.id);
        if (!corteId) {
            return res.status(400).json({ message: 'ID de corte inválido.' });
        }
        const format = String(req.query.format || 'pdf').toLowerCase();
        const scope = String(req.query.scope || 'global').toLowerCase() === 'person' ? 'detallado' : 'global';

        if (format === 'excel' || format === 'xlsx') {
            const buffer = await executeExcelServiceInWorker(
                {
                    serviceRelativePath: 'services/rhBiometricCortesReport.service',
                    methodName: 'generateCorteExcel',
                    args: [req.company_id, corteId, req.query]
                },
                () => rhBiometricCortesReportService.generateCorteExcel(req.company_id, corteId, req.query)
            );
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="control_horas_corte_${corteId}_${scope}.xlsx"`);
            return res.send(buffer);
        }

        const pdfBuffer = await rhBiometricCortesReportService.generateCortePdf(req.company_id, corteId, req.query);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="control_horas_corte_${corteId}_${scope}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error al exportar corte biométrico:', error);
        res.status(500).json({ message: error.message || 'Error al exportar reporte del período congelado.' });
    }
};

module.exports = {
    getPendingOvertimeSummary,
    getDailyOvertimeRows,
    updateOvertimeEntry,
    batchUpdateOvertimeEntries,
    freezePeriod,
    getCortesList,
    unfreezeCorte,
    exportCorteReport
};
