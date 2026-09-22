const { runMigration } = require('./migration_v220_regularize_lubricants_initial_closeout');

runMigration()
    .then(() => {
        console.log('Migración v220 ejecutada con éxito.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Fallo en migración v220:', err);
        process.exit(1);
    });
