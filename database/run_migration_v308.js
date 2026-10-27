const migrate = require('./migration_v308_industrial_containers_daily_ledger');

migrate()
    .then(() => {
        console.log('Migración v308 completada con éxito.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error en migración v308:', err);
        process.exit(1);
    });
