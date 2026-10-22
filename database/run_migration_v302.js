const { up } = require('./migration_v302_idempotency_keys');

(async () => {
    try {
        await up();
        console.log('Migration v302 finished successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error running migration v302:', err);
        process.exit(1);
    }
})();
