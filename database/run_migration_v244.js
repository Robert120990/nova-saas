const pool = require('../server/src/config/db');
const { migrate } = require('./migration_v244_egg_coproduct_batches');

migrate(pool)
    .then(() => console.log('Migración v244: Lotes co-productos de huevo industrial completada con éxito.'))
    .catch(error => {
        console.error('Error en migración v244:', error);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
