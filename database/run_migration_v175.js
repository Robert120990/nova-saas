const runMigration = require('./migration_v175_egg_quality_and_coa_enhancements');

(async () => {
    try {
        await runMigration();
        console.log('Migration v175 execution finished.');
        process.exit(0);
    } catch (err) {
        console.error('Fatal migration v175 error:', err);
        process.exit(1);
    }
})();
