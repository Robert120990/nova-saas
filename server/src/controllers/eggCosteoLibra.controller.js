// Fachada compatible con las rutas existentes.
module.exports = {
    ...require('./eggCosteoLibra/eggCosteoLibraOperations1.controller'),
    ...require('./eggCosteoLibra/eggCosteoLibraOperations2.controller'),
    ...require('./eggCosteoLibra/eggCosteoLibraOperations3.controller'),
    ...require('./eggCosteoLibra/calculateDynamicCost.controller'),
    ...require('./eggCosteoLibra/eggCosteoLibraOperations4.controller')
};
