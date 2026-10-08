const pool = require('../server/src/config/db');
const { migrate } = require('./migration_v254_move_energy_to_dashboard');

migrate(pool)
    .then(() => console.log('Migración v254 completada con éxito.'))
    .catch(error => {
        console.error('Error en migración v254:', error);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
