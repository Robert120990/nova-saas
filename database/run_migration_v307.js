const migrate = require('./migration_v307_industrial_container_cutoffs');

migrate()
    .then(() => {
        console.log('Migración v307 completada con éxito.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error en migración v307:', err);
        process.exit(1);
    });
