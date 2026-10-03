module.exports = {
    ...require('./rhPlanillaLiquidaciones/rhPlanillaLiquidacionesQueries.controller'),
    ...require('./rhPlanillaLiquidaciones/rhPlanillaLiquidacionesMutations.controller'),
    ...require('./rhPlanillaLiquidaciones/rhPlanillaLiquidacionesCalculation.controller'),
    ...require('./rhPlanillaLiquidaciones/rhPlanillaLiquidacionesReports.controller')
};
