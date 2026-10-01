const pool = require('../server/src/config/db');
const { migrate } = require('./migration_v245_egg_packaging_inventory_sync');

migrate(pool)
    .then(() => console.log('Migración v245: Sincronización de empaque e inventario completada con éxito.'))
    .catch(error => {
        console.error('Error en migración v245:', error);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
