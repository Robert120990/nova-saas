const pool = require('../server/src/config/db');
const migration = require('./migration_v239_rh_biometric_config_and_reports');

async function run() {
    try {
        await migration.up(pool);
        console.log('Migración v239 ejecutada con éxito.');
        process.exit(0);
    } catch (error) {
        console.error('Error ejecutando migración v239:', error);
        process.exit(1);
    }
}

run();
