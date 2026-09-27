const pool = require('../server/src/config/db');
const { migrate } = require('./migration_v234_egg_integrity');
migrate(pool).then(() => console.log('Migración v234: integridad industrial completada.'))
    .catch(error => { console.error(error); process.exitCode = 1; })
    .finally(() => pool.end());
