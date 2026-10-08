const { eggReportsExportService } = require('./shared');
const eggSalesReportService = require('../../../services/eggSalesReport.service');

const getRawMaterialsReport = async (req, res) => {
    try {
        const { format, start_date = req.query.from, end_date = req.query.to, provider_id, egg_type } = req.query;
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
        res.json({ ...data, data: data.rows });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getProductionReport = async (req, res) => {
    try {
        const { format, start_date = req.query.from, end_date = req.query.to, product_type, status } = req.query;
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
        res.json({ success: true, data: data.rows, rows: data.rows, summary: data.summary });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getPackagingReport = async (req, res) => {
    try {
        const { format, start_date = req.query.from, end_date = req.query.to, product_type, presentation, batch_id } = req.query;
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
        res.json({ ...data, data: data.rows });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getQualityReport = async (req, res) => {
    try {
        const { format, start_date = req.query.from, end_date = req.query.to, quality_status } = req.query;
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
        res.json({ ...data, data: data.rows });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getWastesReport = async (req, res) => {
    try {
        const { format, start_date = req.query.from, end_date = req.query.to, stage, batch_id } = req.query;
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
        res.json({ ...data, data: data.rows });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getSalesByProductReport = async (req, res) => {
    try {
        const { format, start_date = req.query.from, end_date = req.query.to, customer_id, product_type } = req.query;
        const filters = { startDate: start_date, endDate: end_date, customerId: customer_id, productType: product_type, viewType: 'product' };

        if (format === 'excel') {
            const buffer = await eggSalesReportService.generateEggSalesExcel(req.company_id, filters);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="reporte_ventas_por_producto.xlsx"');
            return res.send(buffer);
        }
        if (format === 'pdf') {
            const buffer = await eggSalesReportService.generateEggSalesPdf(req.company_id, filters);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="reporte_ventas_por_producto.pdf"');
            return res.send(buffer);
        }

        const data = await eggSalesReportService.getEggSalesReportData(req.company_id, filters);
        res.json({
            success: true,
            data: data.byProduct,
            rows: data.byProduct,
            summary: data.summary,
            byCustomer: data.byCustomer
        });
    } catch (error) {
        console.error('[getSalesByProductReport error]:', error);
        res.status(500).json({ message: error.message });
    }
};

const getSalesByCustomerReport = async (req, res) => {
    try {
        const { format, start_date = req.query.from, end_date = req.query.to, customer_id, product_type } = req.query;
        const filters = { startDate: start_date, endDate: end_date, customerId: customer_id, productType: product_type, viewType: 'customer' };

        if (format === 'excel') {
            const buffer = await eggSalesReportService.generateEggSalesExcel(req.company_id, filters);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="reporte_ventas_por_cliente.xlsx"');
            return res.send(buffer);
        }
        if (format === 'pdf') {
            const buffer = await eggSalesReportService.generateEggSalesPdf(req.company_id, filters);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="reporte_ventas_por_cliente.pdf"');
            return res.send(buffer);
        }

        const data = await eggSalesReportService.getEggSalesReportData(req.company_id, filters);
        res.json({
            success: true,
            data: data.byCustomer,
            rows: data.byCustomer,
            summary: data.summary,
            byProduct: data.byProduct
        });
    } catch (error) {
        console.error('[getSalesByCustomerReport error]:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getRawMaterialsReport,
    getProductionReport,
    getPackagingReport,
    getQualityReport,
    getWastesReport,
    getSalesByProductReport,
    getSalesByCustomerReport
};

