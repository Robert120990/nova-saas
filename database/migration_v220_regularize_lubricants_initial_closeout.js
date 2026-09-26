const pool = require('../server/src/config/db');

async function runMigration() {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Eliminar filas vacías en closeout 104 (cierre previo de prueba con ceros antes de iniciar lubricantes)
        await conn.query("DELETE FROM gas_station_closeout_lubricant_readings WHERE closeout_id = 104");

        // 2. Regularizar closeout 105 (primer turno real con lubricantes):
        // La carga inicial que el cajero digitó en recarga (al estar inicial bloqueada) se traslada a lectura_inicial
        await conn.query(`
            UPDATE gas_station_closeout_lubricant_readings
            SET lectura_inicial = recarga, recarga = 0
            WHERE closeout_id = 105 AND lectura_inicial = 0 AND recarga > 0
        `);

        await conn.commit();
        console.log('Migración v220: Lecturas iniciales de lubricantes regularizadas con éxito.');
    } catch (e) {
        await conn.rollback();
        console.error('Error en migración v220:', e);
        throw e;
    } finally {
        conn.release();
    }
}

module.exports = { runMigration };
