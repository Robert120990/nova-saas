// Fachada compatible con las rutas existentes.
module.exports = {
    ...require('./eggDispatch/eggDispatchOperations1.controller'),
    ...require('./eggDispatch/eggDispatchOperations2.controller'),
    ...require('./eggDispatch/getDispatchRouteDetail.controller'),
    ...require('./eggDispatch/saveDispatchRoute.controller'),
    ...require('./eggDispatch/eggDispatchOperations3.controller'),
    ...require('./eggDispatch/eggDispatchOperations4.controller'),
    ...require('./eggDispatch/removeStopFromRoute.controller'),
    ...require('./eggDispatch/getDispatchRouteManifestPdf.controller'),
    ...require('./eggDispatch/autoInvoiceDispatchRoute.controller')
};
