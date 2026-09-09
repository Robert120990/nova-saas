const runMigration = require('./migration_v174_crm_quotations');

(async () => {
    try {
        await runMigration();
        console.log('Migration v174 execution finished.');
        process.exit(0);
    } catch (err) {
        console.error('Fatal migration v174 error:', err);
        process.exit(1);
    }
})();
