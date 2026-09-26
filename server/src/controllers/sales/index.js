/**
 * Controlador Modularizado de Ventas (Barrel Export)
 * Re-exporta las funciones de cada subdominio manteniendo 100% de compatibilidad hacia atrás.
 */

module.exports = {
    ...require('./salesCore.controller'),
    ...require('./salesDte.controller'),
    ...require('./salesContingencyAndRetorno.controller'),
    ...require('./salesReportsAndRtee.controller')
};
