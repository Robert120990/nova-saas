const pool = require('../server/src/config/db');
const { migrate } = require('./migration_v235_egg_coproduct_batches');
migrate(pool)
    .then(() => console.log('Migración v235: soporte para lotes co-productos completada con éxito.'))
    .catch(error => { console.error(error); process.exitCode = 1; })
    .finally(() => pool.end());
