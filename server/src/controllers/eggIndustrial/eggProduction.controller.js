// Fachada compatible con las rutas existentes.
module.exports = {
    ...require('./eggProduction/eggProductionOperations1.controller'),
    ...require('./eggProduction/createProductionBatch.controller'),
    ...require('./eggProduction/eggProductionOperations2.controller'),
    ...require('./eggProduction/eggProductionOperations3.controller'),
    ...require('./eggProduction/updateProductionBatch.controller'),
    ...require('./eggProduction/eggProductionOperations4.controller'),
    ...require('./eggProduction/eggProductionOperations5.controller'),
    ...require('./eggProduction/eggProductionOperations6.controller')
};
