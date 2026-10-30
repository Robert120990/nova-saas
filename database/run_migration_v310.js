const migrate = require('./migration_v310_rh_contratos_laborales');

migrate()
    .then(() => {
        console.log('Migración v310 completada con éxito.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error en migración v310:', err);
        process.exit(1);
    });

