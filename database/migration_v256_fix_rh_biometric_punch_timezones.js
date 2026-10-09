const pool = require('../server/src/config/db');

/**
 * Migración v256: Corregir desfase de zona horaria (+6 horas UTC) en marcaciones del Marcador Biométrico ZKTeco
 * 
 * Causa raíz: Al sincronizar marcaciones desde el reloj digital, las fechas Date se convertían
 * a UTC mediante .toISOString(), sumando 6 horas a la hora real marcada por los trabajadores en El Salvador.
 * Esto hacía que salidas normales de 16:xx se guardaran como 22:xx, y salidas nocturnas pasaran a la madrugada del día siguiente.
 * 
 * Esta migración resta 6 horas a todas las marcaciones afectadas y recalcula su punch_type a los horarios correctos de El Salvador.
 */
async function migrate(dbPool = pool) {
    console.log('[Migration v256] Iniciando corrección de zona horaria en marcaciones biométricas...');

    // 1. Verificación idempotente: comprobar si aún existen marcaciones desplazadas a las 22:xx el 2026-09-11
    const [checkRows] = await dbPool.query(`
        SELECT COUNT(*) as count
        FROM rh_biometric_attendance_logs
        WHERE company_id = 9
          AND DATE(punch_time) = '2026-09-11'
          AND HOUR(punch_time) = 22
    `);

    const needsCorrection = checkRows[0]?.count > 0;

    if (!needsCorrection) {
        console.log('[Migration v256] ✅ Las marcaciones ya se encuentran corregidas o no requieren ajuste.');
        return;
    }

    console.log(`[Migration v256] Se detectaron registros desfasados. Procediendo a ajustar horas (-6 horas)...`);

    const conn = await dbPool.getConnection();
    try {
        await conn.beginTransaction();

        // 2. Restar 6 horas a todas las marcaciones de ANDELSA (company_id = 9) sincronizadas por agente
        const [updateTimeRes] = await conn.query(`
            UPDATE rh_biometric_attendance_logs
            SET punch_time = DATE_SUB(punch_time, INTERVAL 6 HOUR)
            WHERE company_id = 9 AND source = 'agent'
        `);
        console.log(`[Migration v256] Marcaciones ajustadas en hora: ${updateTimeRes.affectedRows}`);

        // 3. Recalcular punch_type según las horas locales de El Salvador
        const [updateTypeRes] = await conn.query(`
            UPDATE rh_biometric_attendance_logs
            SET punch_type = CASE
                WHEN TIME(punch_time) >= '15:00:00' THEN 'salida'
                WHEN TIME(punch_time) >= '11:30:00' AND TIME(punch_time) < '13:00:00' THEN 'salida_almuerzo'
                WHEN TIME(punch_time) >= '13:00:00' AND TIME(punch_time) < '14:30:00' THEN 'entrada_almuerzo'
                ELSE 'entrada'
            END
            WHERE company_id = 9 AND source = 'agent'
        `);
        console.log(`[Migration v256] Tipos de marcación reclasificados: ${updateTypeRes.affectedRows}`);

        await conn.commit();
        console.log('[Migration v256] ✅ Corrección de zona horaria completada exitosamente.');
    } catch (err) {
        await conn.rollback();
        console.error('[Migration v256] ❌ Error aplicando corrección:', err);
        throw err;
    } finally {
        conn.release();
    }
}

module.exports = { migrate };
