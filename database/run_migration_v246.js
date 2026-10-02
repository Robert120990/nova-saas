const pool = require('../server/src/config/db');
const { migrate } = require('./migration_v246_gas_readings_3_decimals');

migrate(pool)
    .then(() => console.log('Migración v246: Modificación de precisión de lecturas a 3 decimales completada con éxito.'))
    .catch(error => {
        console.error('Error en migración v246:', error);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
