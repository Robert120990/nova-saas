// Fachada compatible con las rutas existentes.
module.exports = {
    ...require('./eggQualityLab/eggQualityLabOperations1.controller'),
    ...require('./eggQualityLab/eggQualityLabOperations2.controller'),
    ...require('./eggQualityLab/eggQualityLabOperations3.controller'),
    ...require('./eggQualityLab/eggQualityLabOperations4.controller')
};
