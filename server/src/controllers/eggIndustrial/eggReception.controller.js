// Fachada compatible con las rutas existentes.
module.exports = {
    ...require('./eggReception/eggReceptionOperations1.controller'),
    ...require('./eggReception/eggReceptionOperations2.controller'),
    ...require('./eggReception/eggReceptionOperations3.controller')
};
