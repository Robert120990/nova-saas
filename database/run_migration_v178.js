const runMigration = require('./migration_v178_gas_coupon_liquidation');

(async () => {
    try {
        await runMigration();
        console.log('Migration v178 execution finished.');
        process.exit(0);
    } catch (err) {
        console.error('Fatal migration v178 error:', err);
        process.exit(1);
    }
})();
