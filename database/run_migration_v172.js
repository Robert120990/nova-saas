const runMigration = require('./migration_v172_inventory_valuation_and_turnover_reports_menu');

runMigration()
    .then(() => {
        console.log('Migration v172 execution complete.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration v172 failed:', err);
        process.exit(1);
    });
