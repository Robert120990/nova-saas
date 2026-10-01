const run = require('./migration_v241_sistema_energetico');

run()
    .then(() => {
        console.log('[Migration v241 Runner] Finalizado correctamente.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('[Migration v241 Runner Error]:', err);
        process.exit(1);
    });
