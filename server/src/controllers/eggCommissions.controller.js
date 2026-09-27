// Fachada compatible con las rutas existentes.
module.exports = {
    ...require('./eggCommissions/eggCommissionsOperations1.controller'),
    ...require('./eggCommissions/calculatePeriodCommissions.controller'),
    ...require('./eggCommissions/eggCommissionsOperations2.controller'),
    ...require('./eggCommissions/eggCommissionsOperations3.controller')
};
