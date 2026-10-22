/**
 * Dashboard Controller Facade
 * 
 * Re-exports all specialized dashboard sub-controllers.
 * Complies with Single Responsibility Principle and the max 350-line rule.
 */

const dashboardGeneral = require('./dashboard/dashboardGeneral.controller');
const dashboardPista = require('./dashboard/dashboardPista.controller');
const dashboardTienda = require('./dashboard/dashboardTienda.controller');
const dashboardAndelsa = require('./dashboard/dashboardAndelsa.controller');
const dashboardServer = require('./dashboard/dashboardServer.controller');

module.exports = {
    ...dashboardGeneral,
    ...dashboardPista,
    ...dashboardTienda,
    ...dashboardAndelsa,
    ...dashboardServer
};
