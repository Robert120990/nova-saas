const pool = require('../server/src/config/db');
const { migrate } = require('./migration_v247_gas_tank_readings_nullable');

migrate(pool)
    .then(() => console.log('Migración v247 completada con éxito.'))
    .catch(error => {
        console.error('Error en migración v247:', error);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
