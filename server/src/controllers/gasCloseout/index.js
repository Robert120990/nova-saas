/**
 * Controlador Modularizado de Cierres de Gasolinera (Barrel Export)
 * Re-exporta las funciones de cada subdominio manteniendo 100% de compatibilidad hacia atrás.
 */

module.exports = {
    ...require('./gasCloseoutCore.controller'),
    ...require('./gasExpensesAdelantos.controller'),
    ...require('./gasPayments.controller'),
    ...require('./gasStationOperations.controller'),
    ...require('./gasLubricantsAndPrint.controller')
};
