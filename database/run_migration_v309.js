const migrate = require('./migration_v309_backfill_providers_nit');

(async () => {
    try {
        await migrate();
        console.log('Migration v309 finished successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration v309 failed:', err);
        process.exit(1);
    }
})();
