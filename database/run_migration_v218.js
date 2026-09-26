const { runMigration } = require('./migration_v218_inventario_inicial_motivo');

runMigration()
    .then(() => {
        console.log('Migración v218 ejecutada con éxito.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Fallo en migración v218:', err);
        process.exit(1);
    });
