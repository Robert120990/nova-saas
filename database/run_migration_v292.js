const { up } = require('./migration_v292_rh_banco_formatos_config');

(async () => {
    try {
        await up();
        console.log('Migration v292 finished successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error running migration v292:', err);
        process.exit(1);
    }
})();
