const runMigration = require('./migration_v180_gas_lubricants_report_menu');

(async () => {
    try {
        await runMigration();
        console.log('Migration v180 execution finished.');
        process.exit(0);
    } catch (err) {
        console.error('Fatal migration v180 error:', err);
        process.exit(1);
    }
})();
