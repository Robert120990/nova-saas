const run = require('./migration_v240_rh_employee_shifts');

run()
    .then(() => {
        console.log('[Migration v240 Runner] Finalizado correctamente.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('[Migration v240 Runner Error]:', err);
        process.exit(1);
    });
