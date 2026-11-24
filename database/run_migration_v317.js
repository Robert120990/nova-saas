const migrate = require('./migration_v317_egg_raw_material_writeoffs');

migrate()
    .then(() => {
        console.log('Migración v317 completada con éxito.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error en migración v317:', err);
        process.exit(1);
    });
