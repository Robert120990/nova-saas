const pool = require('../config/db');
const { extractDateOnly, normalizeDateRange } = require('./rhBiometricDate.helper');
const { recalculateFrozenCorteTotals } = require('./rhBiometricCortesSaldos.helper');

function clampHours(val) {
    const num = parseFloat(val);
    if (isNaN(num)) return 0;
    return parseFloat(Math.max(-24, Math.min(24, num)).toFixed(2));
}

/**
 * Actualizar o registrar ajuste individual de horas extra (acepta valores negativos ej. -4h sábado o déficit)
 */
async function updateOvertimeEntry(companyId, userId, data) {
    const {
        empleado_id, device_uid, fecha, horas_extra_aprobadas, observacion,
        horas_trabajadas = 0, entrada = null, salida = null, corte_id = null,
        horas_extra_avicola = null, es_dia_compensacion = 0
    } = data;

    const cleanFecha = extractDateOnly(fecha);
    if (!device_uid || !cleanFecha) {
        throw new Error('Faltan parámetros obligatorios (device_uid o fecha).');
    }

    const aprobadasNum = clampHours(horas_extra_aprobadas || 0);
    const avicolaNum = horas_extra_avicola !== null && horas_extra_avicola !== undefined
        ? Math.max(0, clampHours(horas_extra_avicola))
        : 0;
    const cleanEntrada = entrada && entrada !== '---' ? entrada : null;
    const cleanSalida = salida && salida !== '---' ? salida : null;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await conn.query(
            `INSERT INTO rh_biometric_daily_overtime (
                company_id, empleado_id, device_uid, fecha, entrada, salida,
                horas_trabajadas, horas_extra_aprobadas, horas_extra_avicola,
                es_dia_compensacion, es_editado, observacion, corte_id, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                horas_extra_aprobadas = VALUES(horas_extra_aprobadas),
                horas_extra_avicola = COALESCE(?, horas_extra_avicola),
                es_editado = 1,
                observacion = VALUES(observacion),
                updated_at = NOW()`,
            [
                companyId, empleado_id || null, device_uid, cleanFecha,
                cleanEntrada, cleanSalida, parseFloat(horas_trabajadas || 0),
                aprobadasNum, avicolaNum, es_dia_compensacion ? 1 : 0,
                observacion || null, corte_id || null, userId || null,
                horas_extra_avicola !== null && horas_extra_avicola !== undefined ? avicolaNum : null
            ]
        );

        await conn.query(
            `UPDATE rh_biometric_attendance_logs
             SET horas_extra = ?
             WHERE company_id = ? AND device_uid = ?
               AND punch_time >= ? AND punch_time <= ?`,
            [Math.max(0, aprobadasNum), companyId, device_uid, `${cleanFecha} 00:00:00`, `${cleanFecha} 23:59:59`]
        );

        if (corte_id) {
            await recalculateFrozenCorteTotals(conn, companyId, corte_id);
        }

        await conn.commit();
        return {
            success: true,
            message: 'Horas extra actualizadas exitosamente.',
            horas_extra_aprobadas: aprobadasNum,
            es_editado: 1
        };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

/**
 * Congelar período por fechas (persiste detalle diario + saldos por colaborador y arrastre de horas pendientes)
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

    const summary = periodData.summary || {};
    const empSummaries = Array.isArray(periodData.employeeSummaries) ? periodData.employeeSummaries : [];

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [corteResult] = await conn.query(
            `INSERT INTO rh_biometric_cortes (
                company_id, nombre, fecha_inicio, fecha_fin, estado,
                total_empleados, total_horas_trabajadas, total_horas_extra,
                total_horas_extra_aprobadas, total_horas_extra_produccion,
                total_horas_extra_transporte, total_horas_extra_avicola,
                total_horas_pendientes_aplicadas, total_horas_extra_pagables,
                observaciones, created_by
            ) VALUES (?, ?, ?, ?, 'congelado', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                companyId, nombre, fecha_inicio, fecha_fin,
                summary.total_empleados || 0,
                summary.total_horas_trabajadas || 0,
                summary.total_horas_extra_calculadas || 0,
                summary.total_horas_extra_aprobadas || 0,
                summary.total_horas_extra_produccion || 0,
                summary.total_horas_extra_transporte || 0,
                summary.total_horas_extra_avicola || 0,
                summary.total_horas_pendientes_aplicadas || 0,
                summary.total_horas_extra_pagables || 0,
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
                    horas_extra_aprobadas, horas_extra_avicola, es_dia_compensacion,
                    es_editado, observacion, congelado, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                ON DUPLICATE KEY UPDATE
                    corte_id = VALUES(corte_id),
                    congelado = 1,
                    horas_trabajadas = VALUES(horas_trabajadas),
                    horas_extra_calculadas = VALUES(horas_extra_calculadas),
                    horas_extra_aprobadas = IF(es_editado = 1, horas_extra_aprobadas, VALUES(horas_extra_aprobadas)),
                    horas_extra_avicola = GREATEST(horas_extra_avicola, VALUES(horas_extra_avicola)),
                    es_dia_compensacion = VALUES(es_dia_compensacion),
                    updated_at = NOW()`,
                [
                    companyId, corteId, row.empleado_id, row.device_uid, row.fecha,
                    row.entrada && row.entrada !== '---' ? row.entrada : null,
                    row.salida && row.salida !== '---' ? row.salida : null,
                    row.horas_trabajadas, row.minutos_tardanza,
                    row.horas_extra_calculadas, row.horas_extra_aprobadas,
                    row.horas_extra_avicola || 0, row.es_dia_compensacion ? 1 : 0,
                    row.es_editado ? 1 : 0, row.observacion || null, userId || null
                ]
            );
        }

        for (const emp of empSummaries) {
            await conn.query(
                `INSERT INTO rh_biometric_corte_saldos (
                    company_id, corte_id, empleado_id, device_uid, empleado_nombre,
                    area, categoria, horas_jornada_base,
                    horas_extra_periodo, horas_pendientes_anteriores, horas_extra_avicola,
                    saldo_neto, horas_pagables, saldo_arrastre_siguiente
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    horas_extra_periodo = VALUES(horas_extra_periodo),
                    horas_pendientes_anteriores = VALUES(horas_pendientes_anteriores),
                    horas_extra_avicola = VALUES(horas_extra_avicola),
                    saldo_neto = VALUES(saldo_neto),
                    horas_pagables = VALUES(horas_pagables),
                    saldo_arrastre_siguiente = VALUES(saldo_arrastre_siguiente),
                    updated_at = NOW()`,
                [
                    companyId, corteId, emp.empleado_id, emp.device_uid, emp.nombre,
                    emp.area, emp.categoria, emp.horas_jornada_base,
                    emp.horas_extra_periodo, emp.horas_pendientes_anteriores, emp.horas_extra_avicola,
                    emp.saldo_neto, emp.horas_pagables, emp.saldo_arrastre_siguiente
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
            message: `Período "${nombre}" congelado exitosamente con ${periodData.rows.length} registros y ${empSummaries.length} colaboradores consolidados.`
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
            `DELETE FROM rh_biometric_corte_saldos WHERE company_id = ? AND corte_id = ?`,
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

/**
 * Aprobación / denegación / ajuste masivo de horas extra en lote
 */
async function batchUpdateOvertimeEntries(companyId, userId, { entries = [], action = 'deny_zero', customHours = 0, observacion = '' }) {
    if (!Array.isArray(entries) || entries.length === 0) {
        throw new Error('Debe seleccionar al menos un registro para actualizar en lote.');
    }

    const conn = await pool.getConnection();
    const touchedCortes = new Set();
    let updatedCount = 0;

    try {
        await conn.beginTransaction();

        for (const item of entries) {
            const cleanFecha = extractDateOnly(item.fecha);
            if (!item.device_uid || !cleanFecha) continue;

            let aprobadas = 0;
            const calc = clampHours(item.horas_extra_calculadas || 0);
            const custom = clampHours(customHours || 0);

            if (action === 'approve_clock') aprobadas = calc;
            else if (action === 'deny_zero') aprobadas = 0;
            else if (action === 'set_custom') aprobadas = custom;
            else if (action === 'cap_hours') aprobadas = calc >= 0 ? Math.min(calc, Math.max(0, custom)) : calc;

            aprobadas = parseFloat(aprobadas.toFixed(2));
            const note = observacion && observacion.trim()
                ? observacion.trim()
                : (action === 'deny_zero' ? 'Denegadas en lote por jefatura' : (action === 'approve_clock' ? 'Aprobadas en lote según reloj' : `Ajuste en lote (${aprobadas} h)`));

            await conn.query(
                `INSERT INTO rh_biometric_daily_overtime (
                    company_id, empleado_id, device_uid, fecha, entrada, salida,
                    horas_trabajadas, horas_extra_calculadas, horas_extra_aprobadas,
                    es_editado, observacion, corte_id, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    horas_extra_aprobadas = VALUES(horas_extra_aprobadas),
                    es_editado = 1,
                    observacion = VALUES(observacion),
                    updated_at = NOW()`,
                [
                    companyId, item.empleado_id || null, item.device_uid, cleanFecha,
                    item.entrada && item.entrada !== '---' ? item.entrada : null,
                    item.salida && item.salida !== '---' ? item.salida : null,
                    parseFloat(item.horas_trabajadas || 0), calc, aprobadas,
                    note, item.corte_id || null, userId || null
                ]
            );

            await conn.query(
                `UPDATE rh_biometric_attendance_logs
                 SET horas_extra = ?
                 WHERE company_id = ? AND device_uid = ?
                   AND punch_time >= ? AND punch_time <= ?`,
                [Math.max(0, aprobadas), companyId, item.device_uid, `${cleanFecha} 00:00:00`, `${cleanFecha} 23:59:59`]
            );

            if (item.corte_id) touchedCortes.add(item.corte_id);
            updatedCount++;
        }

        for (const corteId of touchedCortes) {
            await recalculateFrozenCorteTotals(conn, companyId, corteId);
        }

        await conn.commit();
        return {
            success: true,
            updatedCount,
            message: `${updatedCount} registro(s) de horas extra actualizados en lote.`
        };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

module.exports = {
    updateOvertimeEntry,
    batchUpdateOvertimeEntries,
    freezePeriod,
    getCortesList,
    unfreezeCorte
};
