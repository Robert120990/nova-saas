const pool = require('../config/db');
const { extractDateOnly, normalizeDateRange } = require('./rhBiometricDate.helper');

/**
 * Actualizar o registrar ajuste individual de horas extra
 */
async function updateOvertimeEntry(companyId, userId, data) {
    const {
        empleado_id, device_uid, fecha, horas_extra_aprobadas, observacion,
        horas_trabajadas = 0, entrada = null, salida = null, corte_id = null
    } = data;

    const cleanFecha = extractDateOnly(fecha);
    if (!device_uid || !cleanFecha) {
        throw new Error('Faltan parámetros obligatorios (device_uid o fecha).');
    }

    const aprobadasNum = Math.max(0, parseFloat(horas_extra_aprobadas || 0));

    await pool.query(
        `INSERT INTO rh_biometric_daily_overtime (
            company_id, empleado_id, device_uid, fecha, entrada, salida,
            horas_trabajadas, horas_extra_aprobadas, es_editado, observacion,
            corte_id, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            horas_extra_aprobadas = VALUES(horas_extra_aprobadas),
            es_editado = 1,
            observacion = VALUES(observacion),
            updated_at = NOW()`,
        [
            companyId, empleado_id || null, device_uid, cleanFecha,
            entrada || null, salida || null, horas_trabajadas,
            aprobadasNum, observacion || null, corte_id || null, userId || null
        ]
    );

    await pool.query(
        `UPDATE rh_biometric_attendance_logs
         SET horas_extra = ?
         WHERE company_id = ? AND device_uid = ?
           AND punch_time >= ? AND punch_time <= ?`,
        [aprobadasNum, companyId, device_uid, `${cleanFecha} 00:00:00`, `${cleanFecha} 23:59:59`]
    );

    if (corte_id) {
        await pool.query(
            `UPDATE rh_biometric_cortes c
             SET total_horas_extra_aprobadas = (
                 SELECT COALESCE(SUM(horas_extra_aprobadas), 0)
                 FROM rh_biometric_daily_overtime
                 WHERE corte_id = c.id
             )
             WHERE id = ? AND company_id = ?`,
            [corte_id, companyId]
        );
    }

    return {
        success: true,
        message: 'Horas extra actualizadas exitosamente.',
        horas_extra_aprobadas: aprobadasNum,
        es_editado: 1
    };
}

/**
 * Congelar período por fechas
 */
async function freezePeriod(companyId, userId, data, getDailyOvertimeRowsFn) {
    const { nombre, observaciones } = data;
    const { startDate: fecha_inicio, endDate: fecha_fin } = normalizeDateRange(data.fecha_inicio, data.fecha_fin);

    if (!nombre || !fecha_inicio || !fecha_fin) {
        throw new Error('Debe proporcionar el nombre del corte, fecha de inicio y fecha de fin.');
    }

    const [overlap] = await pool.query(
        `SELECT id, nombre, fecha_inicio, fecha_fin FROM rh_biometric_cortes
         WHERE company_id = ? AND estado = 'congelado'
           AND NOT (fecha_fin < ? OR fecha_inicio > ?)`,
        [companyId, fecha_inicio, fecha_fin]
    );

    if (overlap.length > 0) {
        const o = overlap[0];
        throw new Error(`El rango colisiona con el corte congelado "${o.nombre}" (${extractDateOnly(o.fecha_inicio)} al ${extractDateOnly(o.fecha_fin)}).`);
    }

    const periodData = await getDailyOvertimeRowsFn(companyId, {
        startDate: fecha_inicio,
        endDate: fecha_fin,
        onlyOvertime: 0
    });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [corteResult] = await conn.query(
            `INSERT INTO rh_biometric_cortes (
                company_id, nombre, fecha_inicio, fecha_fin, estado,
                total_empleados, total_horas_trabajadas, total_horas_extra,
                total_horas_extra_aprobadas, observaciones, created_by
            ) VALUES (?, ?, ?, ?, 'congelado', ?, ?, ?, ?, ?, ?)`,
            [
                companyId, nombre, fecha_inicio, fecha_fin,
                periodData.summary.total_empleados,
                periodData.summary.total_horas_trabajadas,
                periodData.summary.total_horas_extra_calculadas,
                periodData.summary.total_horas_extra_aprobadas,
                observaciones || null,
                userId || null
            ]
        );
        const corteId = corteResult.insertId;

        for (const row of periodData.rows) {
            await conn.query(
                `INSERT INTO rh_biometric_daily_overtime (
                    company_id, corte_id, empleado_id, device_uid, fecha, entrada, salida,
                    horas_trabajadas, minutos_tardanza, horas_extra_calculadas,
                    horas_extra_aprobadas, es_editado, observacion, congelado, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                ON DUPLICATE KEY UPDATE
                    corte_id = VALUES(corte_id),
                    congelado = 1,
                    horas_trabajadas = VALUES(horas_trabajadas),
                    horas_extra_calculadas = VALUES(horas_extra_calculadas),
                    horas_extra_aprobadas = IF(es_editado = 1, horas_extra_aprobadas, VALUES(horas_extra_aprobadas)),
                    updated_at = NOW()`,
                [
                    companyId, corteId, row.empleado_id, row.device_uid, row.fecha,
                    row.entrada !== '---' ? row.entrada : null,
                    row.salida !== '---' ? row.salida : null,
                    row.horas_trabajadas, row.minutos_tardanza,
                    row.horas_extra_calculadas, row.horas_extra_aprobadas,
                    row.es_editado ? 1 : 0, row.observacion || null, userId || null
                ]
            );
        }

        await conn.query(
            `UPDATE rh_biometric_attendance_logs
             SET congelado = 1, corte_id = ?
             WHERE company_id = ? AND punch_time >= ? AND punch_time <= ?`,
            [corteId, companyId, `${fecha_inicio} 00:00:00`, `${fecha_fin} 23:59:59`]
        );

        await conn.commit();

        return {
            success: true,
            corte_id: corteId,
            message: `Período "${nombre}" congelado exitosamente con ${periodData.rows.length} registros.`
        };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

async function getCortesList(companyId) {
    const [rows] = await pool.query(
        `SELECT c.*, COALESCE(u.nombre, u.username) as created_by_name
         FROM rh_biometric_cortes c
         LEFT JOIN users u ON u.id = c.created_by
         WHERE c.company_id = ?
         ORDER BY c.fecha_fin DESC, c.id DESC`,
        [companyId]
    );
    return rows.map(c => ({
        ...c,
        fecha_inicio: extractDateOnly(c.fecha_inicio),
        fecha_fin: extractDateOnly(c.fecha_fin)
    }));
}

async function unfreezeCorte(companyId, corteId) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await conn.query(
            `UPDATE rh_biometric_attendance_logs
             SET congelado = 0, corte_id = NULL
             WHERE company_id = ? AND corte_id = ?`,
            [companyId, corteId]
        );

        await conn.query(
            `UPDATE rh_biometric_daily_overtime
             SET congelado = 0, corte_id = NULL
             WHERE company_id = ? AND corte_id = ?`,
            [companyId, corteId]
        );

        await conn.query(
            `DELETE FROM rh_biometric_cortes WHERE id = ? AND company_id = ?`,
            [corteId, companyId]
        );

        await conn.commit();
        return { success: true, message: 'Corte descongelado y reabierto correctamente.' };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

module.exports = {
    updateOvertimeEntry,
    freezePeriod,
    getCortesList,
    unfreezeCorte
};
