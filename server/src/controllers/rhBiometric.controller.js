/**
 * Controlador de Marcador Digital Biométrico (Fachada / Facade)
 * Desacoplado en submódulos especializados:
 * - rhBiometricCore: Dispositivos, sincronización agente y marcaciones
 * - rhBiometricConfig: Turnos, configuración, festivos y horas extras
 * - rhBiometricReport: Reporte de asistencia, PDF y Excel
 */

const coreController = require('./rhBiometric/rhBiometricCore.controller');
const configController = require('./rhBiometric/rhBiometricConfig.controller');
const reportController = require('./rhBiometric/rhBiometricReport.controller');
const cortesController = require('./rhBiometric/rhBiometricCortes.controller');

module.exports = {
    ...coreController,
    ...configController,
    ...reportController,
    ...cortesController
};

