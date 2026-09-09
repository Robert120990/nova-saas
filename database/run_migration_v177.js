const runMigration = require('./migration_v177_cxc_statement_report_permission');

(async () => {
    try {
        await runMigration();
        console.log('Migration v177 execution finished.');
        process.exit(0);
    } catch (err) {
        console.error('Fatal migration v177 error:', err);
        process.exit(1);
    }
})();
