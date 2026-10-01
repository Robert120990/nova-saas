const pool = require('../server/src/config/db');
const { migrate } = require('./migration_v236_egg_packaging_inventory_sync');
migrate(pool)
    .then(() => console.log('Migración v236: sincronización de envasado con inventario completada con éxito.'))
    .catch(error => { console.error(error); process.exitCode = 1; })
    .finally(() => pool.end());
