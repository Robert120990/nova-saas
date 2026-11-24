const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
const pool = require('../server/src/config/db');
const { up } = require('./migration_v318_rh_omitir_marcador_digital');

(async () => {
    try {
        await up();
        console.log('[v318] Migración completada exitosamente.');
    } catch (error) {
        console.error('[v318] Error ejecutando migración:', error);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
})();
