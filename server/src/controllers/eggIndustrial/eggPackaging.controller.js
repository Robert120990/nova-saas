// Fachada compatible con las rutas existentes.
module.exports = {
    ...require('./eggPackaging/eggPackagingOperations1.controller'),
    ...require('./eggPackaging/eggPackagingOperations2.controller'),
    ...require('./eggPackaging/eggPackagingOperations3.controller'),
    ...require('./eggPackaging/eggPackagingOperations4.controller'),
    ...require('./eggPackaging/getTranslatedInventory.controller'),
    ...require('./eggPackaging/getInventoryOverview.controller'),
    ...require('./eggPackaging/exportTranslatedInventory.controller')
};
