/**
 * Restaurant Controller Facade
 * Cleanly re-exports all subcontrollers to comply with architectural modularity rules
 */
const orders = require('./restaurant/restaurantOrders.controller');
const tables = require('./restaurant/restaurantTables.controller');
const stations = require('./restaurant/restaurantStations.controller');
const modifiers = require('./restaurant/restaurantModifiers.controller');
const config = require('./restaurant/restaurantConfig.controller');
const kds = require('./restaurant/restaurantKds.controller');
const split = require('./restaurant/restaurantSplit.controller');
const discounts = require('./restaurant/restaurantDiscounts.controller');
const waiters = require('./restaurant/restaurantWaiters.controller');

module.exports = {
    ...orders,
    ...tables,
    ...stations,
    ...modifiers,
    ...config,
    ...kds,
    ...split,
    ...discounts,
    ...waiters
};
