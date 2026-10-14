const { up } = require('./migration_v291_rh_planillas_snapshot_and_traslados');

(async () => {
    try {
        await up();
        console.log('Migration v291 finished successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error running migration v291:', err);
        process.exit(1);
    }
})();
