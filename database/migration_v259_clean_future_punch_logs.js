/**
 * Migración v259:
 * Limpieza de marcaciones corruptas con fechas en el futuro lejano (ej. años 2027, 2029, 2035, 2118)
 * generadas por desconfiguraciones accidentales del reloj biométrico.
 */

const pool = require('../server/src/config/db');

async function up() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    console.log('[v259] Eliminando registros corruptos con fecha futura (> año 2026)...');

    const [res] = await conn.query(`
      DELETE FROM rh_biometric_attendance_logs
      WHERE punch_time > '2026-12-31 23:59:59'
    `);

    console.log(`[v259] Se eliminaron ${res.affectedRows} registros con fecha futura.`);

    await conn.commit();
    console.log('[v259] Migración completada con éxito.');
  } catch (err) {
    await conn.rollback();
    console.error('[v259] Error en migración:', err);
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { up };
