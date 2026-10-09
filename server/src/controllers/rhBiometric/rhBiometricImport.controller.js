const rhBiometricZkImportService = require('../../services/rhBiometricZkImport.service');
const { executeExcelServiceInWorker } = require('../../services/reportWorkerPool.service');
const { generateAndelsaOvertimeExcel } = require('../../services/rhBiometricAndelsaExcel.service');

/**
 * Listar carpetas con archivos de horas disponibles en el servidor
 */
const getZkFolders = async (req, res) => {
    try {
        const data = rhBiometricZkImportService.getAvailableZkFolders(req.query.basePath);
        res.json({ success: true, ...data });
    } catch (error) {
        console.error('Error al listar carpetas ZK:', error);
        res.status(500).json({ message: error.message || 'Error al listar carpetas de archivos biométricos' });
    }
};

/**
 * Previsualizar los archivos de una carpeta y mapeo con empleados
 */
const previewZkFolder = async (req, res) => {
    try {
        const { folderPath } = req.body;
        if (!folderPath) {
            return res.status(400).json({ message: 'Debe especificar la ruta de la carpeta (folderPath).' });
        }
        const data = await rhBiometricZkImportService.previewZkFolder(req.company_id, folderPath);
        res.json({ success: true, ...data });
    } catch (error) {
        console.error('Error al previsualizar carpeta ZK:', error);
        res.status(500).json({ message: error.message || 'Error al previsualizar carpeta de archivos biométricos' });
    }
};

/**
 * Importar las marcaciones y horas extra de los archivos a la base de datos
 */
const importZkFolder = async (req, res) => {
    try {
        const result = await rhBiometricZkImportService.importZkFolder(req.company_id, req.body, req.user?.id);
        res.json(result);
    } catch (error) {
        console.error('Error al importar archivos ZK:', error);
        res.status(400).json({ message: error.message || 'Error al importar archivos de asistencia' });
    }
};

/**
 * Descargar directamente el Excel consolidado de una quincena
 */
const exportZkConsolidatedExcel = async (req, res) => {
    try {
        const buffer = await executeExcelServiceInWorker(
            {
                serviceRelativePath: 'services/rhBiometricAndelsaExcel.service',
                methodName: 'generateAndelsaOvertimeExcel',
                args: [req.company_id, req.query]
            },
            () => generateAndelsaOvertimeExcel(req.company_id, req.query)
        );

        const startDate = req.query.startDate || 'quincena';
        const endDate = req.query.endDate || '';
        const filename = `Horas_Extras_Consolidado_${startDate}_al_${endDate}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (error) {
        console.error('Error al generar Excel consolidado de quincena:', error);
        res.status(500).json({ message: error.message || 'Error al generar Excel consolidado' });
    }
};

module.exports = {
    getZkFolders,
    previewZkFolder,
    importZkFolder,
    exportZkConsolidatedExcel
};
