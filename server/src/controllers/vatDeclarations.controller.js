const pool = require('../config/db');
const reportPdfHelper = require('../utils/reportPdfHelper');
const excelService = require('../services/excel.service');
const {
    getPeriodText,
    getAnticipoCuentaData,
    getRetencionesEmitidasData,
    getRetencionesRecibidasData,
    getPercepcionesData,
    getComprasData
} = require('../services/vatDeclarations.service');
const { generateDeclarationsPdf } = require('../services/vatDeclarationsPdf.service');
const { generateDeclarationsExcel } = require('../services/vatDeclarationsExcel.service');

const getRequestMeta = async (req) => {
    const companyId = req.company_id || req.user?.company_id;
    const branchId = req.query.branch_id !== undefined ? req.query.branch_id : (req.user?.branch_id || 'all');
    const currentDate = new Date();
    const year = parseInt(req.query.year, 10) || currentDate.getFullYear();
    const month = parseInt(req.query.month, 10) || (currentDate.getMonth() + 1);
    const search = req.query.search || '';

    const company = await reportPdfHelper.getCompanyInfo(companyId);

    let branchName = 'TODAS / CONSOLIDADO';
    if (branchId && branchId !== 'all') {
        const [bRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branchId]);
        branchName = bRows[0]?.nombre || '---';
    }

    return {
        companyId,
        branchId,
        year,
        month,
        search,
        periodText: getPeriodText(month, year),
        company,
        branchName
    };
};

const handleList = (getDataFn, name) => async (req, res) => {
    try {
        const meta = await getRequestMeta(req);
        if (!meta.companyId) return res.status(401).json({ message: 'No autorizado' });

        const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
        let limit = undefined;
        let offset = undefined;
        let page = 1;

        if (hasPagination && req.query.limit !== 'all') {
            page = Math.max(1, parseInt(req.query.page, 10) || 1);
            limit = Math.max(1, parseInt(req.query.limit, 10) || 100);
            offset = (page - 1) * limit;
        }

        const { items, summary } = await getDataFn({
            companyId: meta.companyId,
            branchId: meta.branchId,
            year: meta.year,
            month: meta.month,
            search: meta.search,
            limit,
            offset
        });

        res.json({
            success: true,
            data: items,
            summary,
            pagination: {
                total: summary.total_records,
                page,
                limit: limit || summary.total_records,
                totalPages: limit ? Math.ceil(summary.total_records / limit) : 1
            }
        });
    } catch (e) {
        console.error(`[VAT Declarations] Error en ${name}:`, e);
        res.status(500).json({ message: `Error consultando ${name}`, error: e.message });
    }
};

const handlePdf = (type, getDataFn, prefix) => async (req, res) => {
    try {
        const meta = await getRequestMeta(req);
        if (!meta.companyId) return res.status(401).json({ message: 'No autorizado' });

        const { items, summary } = await getDataFn({
            companyId: meta.companyId,
            branchId: meta.branchId,
            year: meta.year,
            month: meta.month,
            search: meta.search
        });

        const buffer = await generateDeclarationsPdf(type, items, summary, meta);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${prefix}_${meta.year}_${meta.month}.pdf"`);
        res.send(buffer);
    } catch (e) {
        console.error(`[VAT Declarations] Error PDF en ${type}:`, e);
        res.status(500).json({ message: `Error generando PDF de ${type}`, error: e.message });
    }
};

const handleExcel = (type, getDataFn, prefix) => async (req, res) => {
    try {
        const meta = await getRequestMeta(req);
        if (!meta.companyId) return res.status(401).json({ message: 'No autorizado' });

        const { items, summary } = await getDataFn({
            companyId: meta.companyId,
            branchId: meta.branchId,
            year: meta.year,
            month: meta.month,
            search: meta.search
        });

        const buffer = await generateDeclarationsExcel(type, items, summary, meta);
        excelService.sendExcelResponse(res, buffer, `${prefix}_${meta.year}_${meta.month}.xlsx`);
    } catch (e) {
        console.error(`[VAT Declarations] Error Excel en ${type}:`, e);
        res.status(500).json({ message: `Error generando Excel de ${type}`, error: e.message });
    }
};

// 1. Anticipo a Cuenta 2%
const getAnticipoCuenta = handleList(getAnticipoCuentaData, 'anticipo a cuenta');
const getAnticipoCuentaPdf = handlePdf('anticipo', getAnticipoCuentaData, 'anexo_anticipo_2pct');
const getAnticipoCuentaExcel = handleExcel('anticipo', getAnticipoCuentaData, 'anexo_anticipo_2pct');

// 2. Retenciones Emitidas
const getRetencionesEmitidas = handleList(getRetencionesEmitidasData, 'retenciones emitidas');
const getRetencionesEmitidasPdf = handlePdf('retenciones_emitidas', getRetencionesEmitidasData, 'anexo_retenciones_emitidas');
const getRetencionesEmitidasExcel = handleExcel('retenciones_emitidas', getRetencionesEmitidasData, 'anexo_retenciones_emitidas');

// 3. Retenciones Recibidas
const getRetencionesRecibidas = handleList(getRetencionesRecibidasData, 'retenciones recibidas');
const getRetencionesRecibidasPdf = handlePdf('retenciones_recibidas', getRetencionesRecibidasData, 'anexo_retenciones_recibidas');
const getRetencionesRecibidasExcel = handleExcel('retenciones_recibidas', getRetencionesRecibidasData, 'anexo_retenciones_recibidas');

// 4. Percepciones
const getPercepciones = handleList(getPercepcionesData, 'percepciones');
const getPercepcionesPdf = handlePdf('percepciones', getPercepcionesData, 'anexo_percepciones_1pct');
const getPercepcionesExcel = handleExcel('percepciones', getPercepcionesData, 'anexo_percepciones_1pct');

// 5. Compras (Libro de Compras)
const getCompras = handleList(getComprasData, 'compras');
const getComprasPdf = handlePdf('compras', getComprasData, 'anexo_libro_compras');
const getComprasExcel = handleExcel('compras', getComprasData, 'anexo_libro_compras');

module.exports = {
    getAnticipoCuenta,
    getAnticipoCuentaPdf,
    getAnticipoCuentaExcel,
    getRetencionesEmitidas,
    getRetencionesEmitidasPdf,
    getRetencionesEmitidasExcel,
    getRetencionesRecibidas,
    getRetencionesRecibidasPdf,
    getRetencionesRecibidasExcel,
    getPercepciones,
    getPercepcionesPdf,
    getPercepcionesExcel,
    getCompras,
    getComprasPdf,
    getComprasExcel
};
