const { runMigration } = require('./migration_v219_sync_inventory_stock');

runMigration()
    .then(() => {
        console.log('Migración v219 ejecutada con éxito.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Fallo en migración v219:', err);
        process.exit(1);
    });
