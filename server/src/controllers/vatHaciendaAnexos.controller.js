const vatHaciendaAnexosCsvService = require('../services/vatHaciendaAnexosCsv.service');

const ANNEX_EMPTY_MESSAGES = {
    contribuyentes: 'No existen ventas a contribuyentes válidas en el período seleccionado',
    consumidor: 'No existen ventas a consumidor final válidas en el período seleccionado',
    compras: 'No existen compras válidas para el Anexo 3 en el período seleccionado',
    sujetos_excluidos: 'No existen compras a sujetos excluidos en el período seleccionado',
    anticipo_recibido: 'No existen registros de anticipo a cuenta 2% recibido en el período seleccionado',
    retencion_recibida: 'No existen retenciones de IVA 1% recibidas en el período seleccionado',
    percepcion_recibida: 'No existen percepciones de IVA 1% recibidas en el período seleccionado',
    percepcion_efectuada: 'No existen percepciones de IVA 1% efectuadas en el período seleccionado',
    retencion_efectuada: 'No existen retenciones de IVA 1% efectuadas en el período seleccionado'
};

const resolvePeriodParams = (req) => {
    const companyId = req.company_id || req.user?.company_id;
    const { year, month, branch_id: branchId = 'all' } = req.query;
    return { companyId, year, month, branchId };
};

const buildAnnexOptions = (req, periodParams) => ({
    ...periodParams,
    tipoIngreso: req.query.tipo_ingreso || '3',
    clampFutureDates: req.query.clamp_future_dates === 'true' || req.query.clamp_future_dates === '1',
    overrideF07: req.query.override_f07 === 'true' || req.query.override_f07 === '1',
    tipoOperacion: req.query.tipo_operacion,
    tipoClasificacion: req.query.tipo_clasificacion,
    tipoSector: req.query.tipo_sector,
    tipoCosto: req.query.tipo_costo
});

const getAnexosSummary = async (req, res) => {
    try {
        const { companyId, year, month, branchId } = resolvePeriodParams(req);
        if (!companyId) return res.status(401).json({ message: 'No autorizado' });
        if (!year || !month) return res.status(400).json({ message: 'Año y mes son obligatorios' });

        const data = await vatHaciendaAnexosCsvService.getHaciendaAnexosSummary({
            companyId,
            branchId,
            year,
            month
        });

        return res.json({ success: true, data });
    } catch (error) {
        console.error('[VAT Hacienda Anexos] Summary error:', error);
        return res.status(500).json({ message: 'Error al obtener resumen de anexos para Hacienda' });
    }
};

const sendCsvForType = async (req, res, annexType) => {
    try {
        if (!vatHaciendaAnexosCsvService.ANNEX_KEYS.includes(annexType)) {
            return res.status(400).json({ message: 'Tipo de anexo no válido' });
        }

        const periodParams = resolvePeriodParams(req);
        if (!periodParams.companyId) return res.status(401).json({ message: 'No autorizado' });
        if (!periodParams.year || !periodParams.month) {
            return res.status(400).json({ message: 'Año y mes son obligatorios' });
        }

        const options = buildAnnexOptions(req, periodParams);
        const { csv, count, filename } = await vatHaciendaAnexosCsvService.generateAnnexCsvByType(annexType, options);

        if (count === 0) {
            return res.status(404).json({
                message: ANNEX_EMPTY_MESSAGES[annexType] || 'No existen registros válidos para este anexo'
            });
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(Buffer.from(csv, 'utf8'));
    } catch (error) {
        console.error(`[VAT Hacienda Anexos] CSV error (${annexType}):`, error);
        return res.status(500).json({ message: 'Error al generar el archivo CSV del anexo' });
    }
};

const downloadAnnexCsvByType = async (req, res) => sendCsvForType(req, res, req.params.type);

const downloadTaxpayersAnnexCsv = async (req, res) => sendCsvForType(req, res, 'contribuyentes');

const downloadPurchasesAnnexCsv = async (req, res) => sendCsvForType(req, res, 'compras');

module.exports = {
    getAnexosSummary,
    downloadAnnexCsvByType,
    downloadTaxpayersAnnexCsv,
    downloadPurchasesAnnexCsv
};
