const {
    pool,
    nodemailer,
    broadcastToCompany,
    notificationService,
    eggExportService,
    eggReportsExportService,
    eggQualityLetterExport,
    eggRawMaterialLabReport,
    eggOriginCertificate,
    reportPdfHelper,
    excelService,
    resolveEggCatalogProduct,
    safeNum,
    safeInt,
    computeJulianLotCode
} = require('./eggUtils');


// --- REPORTES CONSOLIDADOS DE PLANTA Y CALIDAD ---
const getRawMaterialsReport = async (req, res) => {
    try {
        const { format, start_date, end_date, provider_id, egg_type } = req.query;
        const filters = { startDate: start_date, endDate: end_date, providerId: provider_id, eggType: egg_type };

        if (format === 'excel') {
            const buffer = await eggReportsExportService.generateRawMaterialsReportExcel(req.company_id, filters);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="reporte_materia_prima.xlsx"');
            return res.send(buffer);
        }
        if (format === 'pdf') {
            const buffer = await eggReportsExportService.generateRawMaterialsReportPdf(req.company_id, filters);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="reporte_materia_prima.pdf"');
            return res.send(buffer);
        }

        const data = await eggReportsExportService.getRawMaterialsReportData(req.company_id, filters);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getProductionReport = async (req, res) => {
    try {
        const { format, start_date, end_date, product_type, status } = req.query;
        const filters = { startDate: start_date, endDate: end_date, productType: product_type, status };

        if (format === 'excel') {
            const buffer = await eggReportsExportService.generateProductionReportExcel(req.company_id, filters);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="reporte_produccion.xlsx"');
            return res.send(buffer);
        }
        if (format === 'pdf') {
            const buffer = await eggReportsExportService.generateProductionReportPdf(req.company_id, filters);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="reporte_produccion.pdf"');
            return res.send(buffer);
        }

        const data = await eggReportsExportService.getProductionReportData(req.company_id, filters);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getPackagingReport = async (req, res) => {
    try {
        const { format, start_date, end_date, product_type, presentation, batch_id } = req.query;
        const filters = { startDate: start_date, endDate: end_date, productType: product_type, presentation, batchId: batch_id };

        if (format === 'excel') {
            const buffer = await eggReportsExportService.generatePackagingReportExcel(req.company_id, filters);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="reporte_empaque.xlsx"');
            return res.send(buffer);
        }
        if (format === 'pdf') {
            const buffer = await eggReportsExportService.generatePackagingReportPdf(req.company_id, filters);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="reporte_empaque.pdf"');
            return res.send(buffer);
        }

        const data = await eggReportsExportService.getPackagingReportData(req.company_id, filters);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getQualityReport = async (req, res) => {
    try {
        const { format, start_date, end_date, quality_status } = req.query;
        const filters = { startDate: start_date, endDate: end_date, qualityStatus: quality_status };

        if (format === 'excel') {
            const buffer = await eggReportsExportService.generateQualityReportExcel(req.company_id, filters);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="reporte_calidad.xlsx"');
            return res.send(buffer);
        }
        if (format === 'pdf') {
            const buffer = await eggReportsExportService.generateQualityReportPdf(req.company_id, filters);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="reporte_calidad.pdf"');
            return res.send(buffer);
        }

        const data = await eggReportsExportService.getQualityReportData(req.company_id, filters);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getWastesReport = async (req, res) => {
    try {
        const { format, start_date, end_date, stage, batch_id } = req.query;
        const filters = { startDate: start_date, endDate: end_date, stage, batchId: batch_id };

        if (format === 'excel') {
            const buffer = await eggReportsExportService.generateWastesReportExcel(req.company_id, filters);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="reporte_mermas.xlsx"');
            return res.send(buffer);
        }
        if (format === 'pdf') {
            const buffer = await eggReportsExportService.generateWastesReportPdf(req.company_id, filters);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="reporte_mermas.pdf"');
            return res.send(buffer);
        }

        const data = await eggReportsExportService.getWastesReportData(req.company_id, filters);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 24. Vinculación de Códigos de Catálogo (Mapeo de Productos)
const normalizeCatalogCodes = (codes) => {
    const rawCodes = Array.isArray(codes) ? codes : String(codes || '').split(',');
    const uniqueCodes = new Map();

    rawCodes.forEach((code) => {
        const normalized = String(code || '').trim();
        if (normalized && !uniqueCodes.has(normalized.toLowerCase())) {
            uniqueCodes.set(normalized.toLowerCase(), normalized);
        }
    });

    return [...uniqueCodes.values()];
};


module.exports = {
    getRawMaterialsReport,
    getProductionReport,
    getPackagingReport,
    getQualityReport,
    getWastesReport
};
