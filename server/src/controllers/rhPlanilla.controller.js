module.exports = {
    ...require('./rhPlanilla/rhPlanillaQueries.controller'),
    ...require('./rhPlanilla/rhPlanillaEmployee.controller'),
    ...require('./rhPlanilla/rhPlanillaReports.controller'),
    ...require('./rhPlanilla/rhPlanillaMutations.controller'),
    ...require('./rhPlanilla/rhPlanillaExports.controller')
};
