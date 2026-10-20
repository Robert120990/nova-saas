const inventoryAdjustmentCore = require('./inventoryAdjustment/inventoryAdjustmentCore.controller');
const inventoryAdjustmentReports = require('./inventoryAdjustment/inventoryAdjustmentReports.controller');

module.exports = {
    ...inventoryAdjustmentCore,
    ...inventoryAdjustmentReports
};
