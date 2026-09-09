const runMigration = require('./migration_v176_rh_cuentas_planillas_bonificaciones');

(async () => {
    try {
        await runMigration();
        console.log('Migration v176 execution finished.');
        process.exit(0);
    } catch (err) {
        console.error('Fatal migration v176 error:', err);
        process.exit(1);
    }
})();
