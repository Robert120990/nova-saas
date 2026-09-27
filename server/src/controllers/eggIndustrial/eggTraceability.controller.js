// Fachada compatible con las rutas existentes.
module.exports = {
    ...require('./eggTraceability/getTraceability.controller'),
    ...require('./eggTraceability/getTraceability360List.controller'),
    ...require('./eggTraceability/getTraceability360Stats.controller'),
    ...require('./eggTraceability/eggTraceabilityOperations1.controller'),
    ...require('./eggTraceability/exportQualityLetter.controller')
};
