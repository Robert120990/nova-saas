const migrate = require('./migration_v319_egg_closed_batch_edit_audit');

migrate()
    .then(() => {
        console.log('Migración v319 completada con éxito.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error en migración v319:', err);
        process.exit(1);
    });
