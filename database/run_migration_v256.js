const pool = require('../server/src/config/db');
const { migrate } = require('./migration_v256_fix_rh_biometric_punch_timezones');

migrate(pool)
    .then(() => {
        console.log('Migración v256 finalizada.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error ejecutando migración v256:', err);
        process.exit(1);
    });
