const rhBiometricReportService = require('../../services/rhBiometricReport.service');

const getAttendanceReport = async (req, res) => {
    try {
        const data = await rhBiometricReportService.getAttendanceReportData(req.company_id, req.query);
        res.json({ success: true, ...data });
    } catch (e) {
        console.error('Error al consultar reporte de asistencia:', e);
        res.status(500).json({ message: e.message });
    }
};

const exportAttendanceReport = async (req, res) => {
    try {
        const format = (req.query.format || '').toLowerCase();
        if (format === 'excel') {
            const buffer = await rhBiometricReportService.generateAttendanceExcel(req.company_id, req.query);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="reporte_asistencia.xlsx"');
            return res.send(buffer);
        }

        const pdfBuffer = await rhBiometricReportService.generateAttendancePdf(req.company_id, req.query);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="reporte_asistencia.pdf"');
        res.send(pdfBuffer);
    } catch (e) {
        console.error('Error al exportar reporte de asistencia:', e);
        res.status(500).json({ message: e.message || 'Error al exportar reporte.' });
    }
};

module.exports = {
    getAttendanceReport,
    exportAttendanceReport
};
