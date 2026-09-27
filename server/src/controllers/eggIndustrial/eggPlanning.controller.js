// Fachada compatible con las rutas existentes.
module.exports = {
    computeJulianLotCode: require('./eggPlanning/shared').computeJulianLotCode,
    ...require('./eggPlanning/eggPlanningOperations1.controller'),
    ...require('./eggPlanning/eggPlanningOperations2.controller'),
    ...require('./eggPlanning/eggPlanningOperations3.controller'),
    ...require('./eggPlanning/getProductionSuggestions.controller'),
    ...require('./eggPlanning/getMonthlyProductionSuggestions.controller'),
    ...require('./eggPlanning/applyMonthlyPlan.controller'),
    ...require('./eggPlanning/getRawMaterialPlanning.controller'),
    ...require('./eggPlanning/eggPlanningOperations4.controller'),
    ...require('./eggPlanning/saveEggCustomerOrder.controller'),
    ...require('./eggPlanning/eggPlanningOperations5.controller'),
    ...require('./eggPlanning/getOrderDeliveryReceipt.controller')
};
