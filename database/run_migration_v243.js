const runMigration = require('./migration_v243_encrypt_energy_credentials');

runMigration()
    .then(() => {
        console.log('Migración v243 ejecutada satisfactoriamente.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error al ejecutar la migración v243:', err);
        process.exit(1);
    });
