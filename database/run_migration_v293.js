const { up } = require('./migration_v293_rh_calculo_renta_modo');

(async () => {
    try {
        await up();
        console.log('Migration v293 finished successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error running migration v293:', err);
        process.exit(1);
    }
})();
