/**
 * Servicio Modularizado de Generación de Documentos PDF (Barrel Export)
 * Re-exporta las funciones de cada dominio manteniendo 100% de compatibilidad hacia atrás.
 */

module.exports = {
    ...require('./inventoryPdf.service'),
    ...require('./statementsPdf.service'),
    ...require('./salesBillingPdf.service'),
    ...require('./payrollPdf.service'),
    ...require('./gasStationPdf.service')
};
