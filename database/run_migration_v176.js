const runMigrationRh = require('./migration_v176_rh_cuentas_planillas_bonificaciones');
const runMigrationEgg = require('./migration_v176_egg_dispatch_and_vehicle_logistics');

(async () => {
    try {
        if (typeof runMigrationRh === 'function') {
            await runMigrationRh();
        }
        if (typeof runMigrationEgg === 'function') {
            await runMigrationEgg();
        }
        console.log('Migration v176 execution finished successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Fatal migration v176 error:', err);
        process.exit(1);
    }
})();
