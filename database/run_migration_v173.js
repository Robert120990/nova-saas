const runMigration = require('./migration_v173_vat_liquidation_menu');

(async () => {
    try {
        await runMigration();
        process.exit(0);
    } catch (err) {
        console.error('Fatal migration error:', err);
        process.exit(1);
    }
})();
