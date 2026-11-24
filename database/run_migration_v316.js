const migrate = require('./migration_v316_industrial_supplies_inventory');

migrate()
    .then(() => {
        console.log('Migración v316 completada con éxito.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error en migración v316:', err);
        process.exit(1);
    });
