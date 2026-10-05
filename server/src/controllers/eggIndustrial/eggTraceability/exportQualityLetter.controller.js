const { eggQualityLetterExport } = require('./shared');
const { executeExcelServiceInWorker, executePdfInWorker } = require('../../../services/reportWorkerPool.service');

const exportQualityLetter = async (req, res) => {
    try {
        const { batchId } = req.params;
        const company_id = req.company_id || req.user?.company_id;
        const { format = 'pdf', customer_name, customer_contact, use_existing_customer, scope = 'all' } = req.query;

        const letterData = await eggQualityLetterExport.getQualityLetterData(batchId, company_id, {
            customer_name,
            customer_contact,
            use_existing_customer: use_existing_customer === 'true'
        });

        if (!letterData) {
            return res.status(404).json({ message: 'Lote de producción no encontrado para generar carta de calidad.' });
        }

        const safeCode = (letterData.lotCode || `LOTE-${batchId}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        const prefix = scope === 'fq' ? 'Analisis_FQ' : scope === 'mb' ? 'Analisis_MB' : 'Carta_Calidad';

        if (format === 'word') {
            const buffer = await eggQualityLetterExport.generateQualityLetterWord(letterData, scope);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="${prefix}_${safeCode}.docx"`);
            return res.send(buffer);
        }

        if (format === 'excel') {
            const buffer = await executeExcelServiceInWorker({
                serviceRelativePath: 'services/eggQualityLetterExport.service',
                methodName: 'generateQualityLetterExcel',
                args: [letterData, scope]
            }, () => eggQualityLetterExport.generateQualityLetterExcel(letterData, scope));
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${prefix}_${safeCode}.xlsx"`);
            return res.send(buffer);
        }

        // Por defecto PDF estilo cotización con membrete Eggcelent/ANDELSA
        const pdfBuffer = await executePdfInWorker({
            serviceRelativePath: 'services/eggQualityLetterExport.service',
            methodName: 'generateQualityLetterPdf',
            args: [letterData, scope]
        }, () => eggQualityLetterExport.generateQualityLetterPdf(letterData, scope));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${prefix}_${safeCode}.pdf"`);
        return res.send(pdfBuffer);
    } catch (error) {
        console.error('Error in exportQualityLetter:', error);
        res.status(500).json({ message: error.message });
    }
};
module.exports = { exportQualityLetter };
