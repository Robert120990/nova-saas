const pool = require('../server/src/config/db');
const { migrate } = require('./migration_v253_branch_remision_con_valores');

migrate(pool)
    .then(() => console.log('Migración v253 completada con éxito.'))
    .catch(error => {
        console.error('Error en migración v253:', error);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
