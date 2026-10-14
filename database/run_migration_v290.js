const { up } = require('./migration_v290_import_missing_raul_sosa_expenses');

(async () => {
    try {
        await up();
        console.log('Migration v290 finished successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error running migration v290:', err);
        process.exit(1);
    }
})();
