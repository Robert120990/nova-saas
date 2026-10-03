module.exports = {
    ...require('./rhPlanillaVacaciones/rhPlanillaVacacionesQueries.controller'),
    ...require('./rhPlanillaVacaciones/rhPlanillaVacacionesMutations.controller'),
    ...require('./rhPlanillaVacaciones/rhPlanillaVacacionesCalculation.controller'),
    ...require('./rhPlanillaVacaciones/rhPlanillaVacacionesReports.controller'),
    ...require('./rhPlanillaVacaciones/rhPlanillaVacacionesEligibility.controller')
};
