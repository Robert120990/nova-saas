const pool = require('../server/src/config/db');
const { migrate } = require('./migration_v235_gas_closeout_fusion');

migrate(pool)
    .then(() => console.log('Migración v235: Campos Fusion FFC completada con éxito.'))
    .catch(error => {
        console.error('Error en migración v235:', error);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
