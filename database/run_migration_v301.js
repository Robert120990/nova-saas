const { up } = require('./migration_v301_rh_liquidaciones_ultima_planilla_horas_extras');

(async () => {
    try {
        await up();
        console.log('Migration v301 finished successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error running migration v301:', err);
        process.exit(1);
    }
})();
