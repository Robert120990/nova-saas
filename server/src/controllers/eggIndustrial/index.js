/**
 * Controlador Modularizado de Huevo Industrial
 * Re-exporta las funciones de cada subdominio manteniendo 100% de compatibilidad hacia atrás.
 */

const eggReception = require('./eggReception.controller');
const eggProduction = require('./eggProduction.controller');
const eggPackaging = require('./eggPackaging.controller');
const eggCosts = require('./eggCosts.controller');
const eggPlanning = require('./eggPlanning.controller');
const eggQualityLab = require('./eggQualityLab.controller');
const eggTraceability = require('./eggTraceability.controller');
const eggReports = require('./eggReports.controller');

module.exports = {
    ...eggReception,
    ...eggProduction,
    ...eggPackaging,
    ...eggCosts,
    ...eggPlanning,
    ...eggQualityLab,
    ...eggTraceability,
    ...eggReports
};
