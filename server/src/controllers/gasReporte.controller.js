/**
 * Gas Station Reports Controller (Facade / Barrel Export)
 * 
 * Modularized into:
 * - ./gasStation/gasSalesAnalytics.controller.js (Ventas, galonajes, resúmenes, complementarias y analítica)
 * - ./gasStation/gasInventoryAudits.controller.js (Inventario combustible, detalle de cierres, lubricantes y comparativas)
 */

const gasSalesAnalytics = require('./gasStation/gasSalesAnalytics.controller');
const gasInventoryAudits = require('./gasStation/gasInventoryAudits.controller');

module.exports = {
    ...gasSalesAnalytics,
    ...gasInventoryAudits
};
