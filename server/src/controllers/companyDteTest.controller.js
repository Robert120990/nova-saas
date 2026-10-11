/**
 * Company DTE Test Controller
 * Manages test emissions and progress for MH accreditation.
 */

const companyDteTestService = require('../services/companyDteTest.service');

const getTestSummary = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, message: 'ID de empresa requerido' });
        }
        const data = await companyDteTestService.getTestSummary(id);
        res.json({ success: true, data });
    } catch (error) {
        console.error('[CompanyDteTestController.getTestSummary] Error:', error);
        res.status(500).json({ success: false, message: error.message || 'Error al obtener resumen de pruebas' });
    }
};

const emitSingleTest = async (req, res) => {
    try {
        const { id } = req.params;
        const { testType } = req.body;
        if (!id || !testType) {
            return res.status(400).json({ success: false, message: 'ID de empresa y tipo de prueba requeridos' });
        }
        const result = await companyDteTestService.emitSingleTest(id, testType, req.user);
        res.json(result);
    } catch (error) {
        console.error('[CompanyDteTestController.emitSingleTest] Error:', error);
        res.status(400).json({ 
            success: false, 
            message: error.message || 'Error al ejecutar prueba de emisión DTE',
            error: error.message 
        });
    }
};

module.exports = {
    getTestSummary,
    emitSingleTest
};
