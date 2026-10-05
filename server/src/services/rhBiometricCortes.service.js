const pool = require('../config/db');
const { getSettings, getHolidays } = require('./rhBiometricConfig.service');

function timeStringToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
}

function extractTime(dt) {
    if (!dt) return '---';
    try {
        const d = new Date(dt);
        return isNaN(d.getTime()) ? '---' : d.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch { return '---'; }
}

function extractDateOnly(dt) {
    if (!dt) return '';
    try {
        const d = new Date(dt);
        if (isNaN(d.getTime())) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch { return ''; }
}

function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
}

/**
 * Obtener el último corte congelado de la empresa
 */
async function getLastCorte(companyId) {
    const [rows] = await pool.query(
        `SELECT id, company_id, nombre, fecha_inicio, fecha_fin, estado,
                total_empleados, total_horas_trabajadas, total_horas_extra,
                total_horas_extra_aprobadas, observaciones, created_at
         FROM rh_biometric_cortes
         WHERE company_id = ? AND estado = 'congelado'
         ORDER BY fecha_fin DESC, id DESC
         LIMIT 1`,
        [companyId]
    );
    if (!rows || rows.length === 0) return null;
    const c = rows[0];
    return {
        ...c,
        fecha_inicio: extractDateOnly(c.fecha_inicio),
        fecha_fin: extractDateOnly(c.fecha_fin)
    };
}

/**
 * Resumen de período pendiente de reporte
 */
async function getPendingRangeSummary(companyId) {
    const lastCorte = await getLastCorte(companyId);
    let startDate;
    if (lastCorte) {
        startDate = addDays(lastCorte.fecha_fin, 1);
    } else {
        const [minRow] = await pool.query(
            `SELECT MIN(DATE(punch_time)) as min_date FROM rh_biometric_attendance_logs WHERE company_id = ?`,
            [companyId]
        );
        startDate = minRow[0]?.min_date ? extractDateOnly(minRow[0].min_date) : extractDateOnly(new Date());
    }

    const [maxRow] = await pool.query(
        `SELECT MAX(DATE(punch_time)) as max_date FROM rh_biometric_attendance_logs WHERE company_id = ?`,
        [companyId]
    );
    const today = extractDateOnly(new Date());
    const latestPunchDate = maxRow[0]?.max_date ? extractDateOnly(maxRow[0].max_date) : today;
    const endDate = latestPunchDate > today ? latestPunchDate : today;

    // Calcular totales estimados para el rango pendiente
    const pendingData = await getDailyOvertimeRows(companyId, {
        startDate,
        endDate,
        mode: 'pending'
    });

    return {
        ultimo_corte: lastCorte,
        rango_pendiente: {
            fecha_inicio: startDate,
            fecha_fin: endDate,
            total_filas: pendingData.summary.total_filas,
            total_empleados: pendingData.summary.total_empleados,
            total_horas_trabajadas: pendingData.summary.total_horas_trabajadas,
            total_horas_extra_calculadas: pendingData.summary.total_horas_extra_calculadas,
            total_horas_extra_aprobadas: pendingData.summary.total_horas_extra_aprobadas,
            total_editados: pendingData.summary.total_editados
        }
    };
}

/**
 * Obtener detalle de horas extra y asistencia diaria para un rango o corte
 */
async function getDailyOvertimeRows(companyId, filters = {}) {
    const { corteId, search, onlyOvertime, departmentId } = filters;
    let startDate = filters.startDate;
    let endDate = filters.endDate;

    // Si viene por corteId, consultar fechas del corte
    if (corteId) {
        const [corteRows] = await pool.query(
            `SELECT * FROM rh_biometric_cortes WHERE id = ? AND company_id = ?`,
            [corteId, companyId]
        );
        if (corteRows.length > 0) {
            startDate = extractDateOnly(corteRows[0].fecha_inicio);
            endDate = extractDateOnly(corteRows[0].fecha_fin);
        }
    }

    if (!startDate || !endDate) {
        const today = extractDateOnly(new Date());
        startDate = startDate || today;
        endDate = endDate || today;
    }

    const settings = await getSettings(companyId);
    const conditions = ['l.company_id = ?', 'DATE(l.punch_time) >= ?', 'DATE(l.punch_time) <= ?'];
    const params = [companyId, startDate, endDate];

    if (departmentId && departmentId !== 'todos') {
        conditions.push('e.departamento_personal_id = ?');
        params.push(departmentId);
    }

    if (search && search.trim()) {
        const s = `%${search.trim()}%`;
        conditions.push('(e.nombres LIKE ? OR e.apellidos LIKE ? OR e.codigo LIKE ? OR l.device_uid LIKE ?)');
        params.push(s, s, s, s);
    }

    // Traer marcaciones del rango
    const [punches] = await pool.query(
        `SELECT l.id, l.device_uid, l.empleado_id, l.punch_time, l.punch_type, l.source,
                l.congelado, l.corte_id,
                e.codigo as empleado_codigo,
                CONCAT(COALESCE(e.nombres, ''), ' ', COALESCE(e.apellidos, '')) as empleado_nombre,
                c.descripcion as cargo_nombre, dep.descripcion as departamento_nombre,
                COALESCE(e.exento_horas_extras, 0) as exento_horas_extras,
                t.nombre as turno_nombre,
                t.hora_entrada as turno_hora_entrada,
                t.hora_salida as turno_hora_salida,
                t.tolerancia_entrada_minutos as turno_tolerancia,
                t.horas_jornada_diaria as turno_jornada_horas
         FROM rh_biometric_attendance_logs l
         LEFT JOIN rh_empleados e ON e.id = l.empleado_id
         LEFT JOIN rh_turnos t ON t.id = e.turno_id
         LEFT JOIN rh_cargos c ON c.id = e.cargo_id
         LEFT JOIN rh_departamentos dep ON dep.id = e.departamento_personal_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY l.punch_time ASC`,
        params
    );

    // Traer ajustes previos guardados en rh_biometric_daily_overtime para este rango
    const [savedAdjustments] = await pool.query(
        `SELECT * FROM rh_biometric_daily_overtime
         WHERE company_id = ? AND fecha >= ? AND fecha <= ?`,
        [companyId, startDate, endDate]
    );
    const adjustmentMap = new Map();
    savedAdjustments.forEach(adj => {
        const fKey = extractDateOnly(adj.fecha);
        adjustmentMap.set(`${adj.device_uid}_${fKey}`, adj);
    });

    const holidays = await getHolidays(companyId, settings.pais_festivos || 'SV');
    const holidayMap = new Set();
    holidays.forEach(h => {
        if (h.is_active) holidayMap.add(`${String(h.mes).padStart(2, '0')}-${String(h.dia).padStart(2, '0')}`);
    });

    // Agrupar por empleado y fecha
    const grouped = new Map();
    for (const p of punches) {
        const dateKey = extractDateOnly(p.punch_time);
        if (!dateKey) continue;
        const key = `${p.device_uid}_${dateKey}`;
        if (!grouped.has(key)) {
            grouped.set(key, {
                empleado_id: p.empleado_id,
                device_uid: p.device_uid,
                codigo: p.empleado_codigo || p.device_uid,
                nombre: p.empleado_nombre ? p.empleado_nombre.trim() : `Empleado UID ${p.device_uid}`,
                departamento: p.departamento_nombre || 'Sin Depto',
                cargo: p.cargo_nombre || 'Sin Cargo',
                fecha: dateKey,
                exento_horas_extras: !!p.exento_horas_extras,
                turno_nombre: p.turno_nombre || 'General',
                hora_entrada_esperada: p.turno_hora_entrada || settings.hora_entrada || '08:00:00',
                tolerancia_minutos: parseInt(p.turno_tolerancia ?? settings.tolerancia_entrada_minutos ?? 15, 10),
                jornada_horas: parseFloat(p.turno_jornada_horas ?? settings.horas_jornada_diaria ?? 8.00),
                congelado: !!p.congelado,
                corte_id: p.corte_id,
                punches: []
            });
        }
        grouped.get(key).punches.push(p);
    }

    const rows = [];
    const empSet = new Set();
    let totalMinutosTrabajados = 0;
    let totalHorasExtraCalculadas = 0;
    let totalHorasExtraAprobadas = 0;
    let totalEditados = 0;

    for (const item of grouped.values()) {
        const sorted = item.punches.sort((a, b) => new Date(a.punch_time) - new Date(b.punch_time));
        const horaEntrada = sorted[0].punch_time;
        let horaSalidaAlmuerzo = null, horaEntradaAlmuerzo = null, horaSalida = null;

        if (sorted.length === 2) {
            horaSalida = sorted[1].punch_time;
        } else if (sorted.length === 3) {
            horaSalidaAlmuerzo = sorted[1].punch_time;
            horaSalida = sorted[2].punch_time;
        } else if (sorted.length >= 4) {
            horaSalidaAlmuerzo = sorted[1].punch_time;
            horaEntradaAlmuerzo = sorted[2].punch_time;
            horaSalida = sorted[sorted.length - 1].punch_time;
        }

        const entradaEsperadaMins = timeStringToMinutes(item.hora_entrada_esperada);
        const limiteEntrada = entradaEsperadaMins + item.tolerancia_minutos;

        let minutosTardanza = 0, esLlegadaTarde = false;
        if (horaEntrada) {
            const entradaRealMins = timeStringToMinutes(extractTime(horaEntrada));
            if (entradaRealMins > limiteEntrada) {
                minutosTardanza = entradaRealMins - entradaEsperadaMins;
                esLlegadaTarde = true;
            }
        }

        let minutosTrabajados = 0;
        if (horaEntrada && horaSalida) {
            let diffMins = Math.max(0, Math.floor((new Date(horaSalida) - new Date(horaEntrada)) / 60000));
            if (horaSalidaAlmuerzo && horaEntradaAlmuerzo) {
                const lunchMins = Math.max(0, Math.floor((new Date(horaEntradaAlmuerzo) - new Date(horaSalidaAlmuerzo)) / 60000));
                diffMins = Math.max(0, diffMins - lunchMins);
            }
            minutosTrabajados = diffMins;
            totalMinutosTrabajados += minutosTrabajados;
        }

        const horasTrabajadas = parseFloat((minutosTrabajados / 60).toFixed(2));
        let horasExtraCalculadas = 0;
        if (!item.exento_horas_extras && horasTrabajadas > item.jornada_horas) {
            horasExtraCalculadas = parseFloat((horasTrabajadas - item.jornada_horas).toFixed(2));
        }

        // Revisar si existe ajuste guardado
        const adj = adjustmentMap.get(`${item.device_uid}_${item.fecha}`);
        const isEdited = adj ? !!adj.es_editado : false;
        const horasExtraAprobadas = adj && adj.horas_extra_aprobadas !== null
            ? parseFloat(Number(adj.horas_extra_aprobadas).toFixed(2))
            : horasExtraCalculadas;
        const observacion = adj?.observacion || '';
        const isFrozen = adj ? !!adj.congelado : item.congelado;
        const activeCorteId = adj?.corte_id || item.corte_id;

        if (onlyOvertime && horasExtraCalculadas <= 0 && horasExtraAprobadas <= 0) {
            continue;
        }

        empSet.add(item.device_uid);
        totalHorasExtraCalculadas += horasExtraCalculadas;
        totalHorasExtraAprobadas += horasExtraAprobadas;
        if (isEdited) totalEditados++;

        const [, m, d] = item.fecha.split('-');
        rows.push({
            id: adj?.id || null,
            empleado_id: item.empleado_id,
            device_uid: item.device_uid,
            codigo: item.codigo,
            nombre: item.nombre,
            cargo: item.cargo,
            departamento: item.departamento,
            fecha: item.fecha,
            entrada: extractTime(horaEntrada),
            salida: extractTime(horaSalida),
            horas_trabajadas: horasTrabajadas,
            minutos_tardanza: minutosTardanza,
            es_llegada_tarde: esLlegadaTarde,
            horas_extra_calculadas: horasExtraCalculadas,
            horas_extra_aprobadas: horasExtraAprobadas,
            es_editado: isEdited,
            observacion,
            congelado: isFrozen,
            corte_id: activeCorteId,
            exento_horas_extras: item.exento_horas_extras,
            es_festivo: holidayMap.has(`${m}-${d}`)
        });
    }

    return {
        rows,
        summary: {
            total_filas: rows.length,
            total_empleados: empSet.size,
            total_horas_trabajadas: parseFloat((totalMinutosTrabajados / 60).toFixed(2)),
            total_horas_extra_calculadas: parseFloat(totalHorasExtraCalculadas.toFixed(2)),
            total_horas_extra_aprobadas: parseFloat(totalHorasExtraAprobadas.toFixed(2)),
            total_editados: totalEditados
        },
        range: {
            fecha_inicio: startDate,
            fecha_fin: endDate
        }
    };
}

/**
 * Actualizar o registrar ajuste individual de horas extra
 */
async function updateOvertimeEntry(companyId, userId, data) {
    const {
        empleado_id, device_uid, fecha, horas_extra_aprobadas, observacion,
        horas_trabajadas = 0, entrada = null, salida = null, corte_id = null
    } = data;

    if (!device_uid || !fecha) {
        throw new Error('Faltan parámetros obligatorios (device_uid o fecha).');
    }

    const aprobadasNum = Math.max(0, parseFloat(horas_extra_aprobadas || 0));

    // Upsert en rh_biometric_daily_overtime
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
            companyId, empleado_id || null, device_uid, fecha,
            entrada || null, salida || null, horas_trabajadas,
            aprobadasNum, observacion || null, corte_id || null, userId || null
        ]
    );

    // Actualizar también rh_biometric_attendance_logs para mantener consistencia
    await pool.query(
        `UPDATE rh_biometric_attendance_logs
         SET horas_extra = ?
         WHERE company_id = ? AND device_uid = ? AND DATE(punch_time) = ?`,
        [aprobadasNum, companyId, device_uid, fecha]
    );

    // Si el registro pertenece a un corte congelado, actualizar el acumulado del corte
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
async function freezePeriod(companyId, userId, data) {
    const { nombre, fecha_inicio, fecha_fin, observaciones } = data;

    if (!nombre || !fecha_inicio || !fecha_fin) {
        throw new Error('Debe proporcionar el nombre del corte, fecha de inicio y fecha de fin.');
    }

    if (fecha_inicio > fecha_fin) {
        throw new Error('La fecha de inicio no puede ser posterior a la fecha de fin.');
    }

    // Validar que no haya solapamiento con cortes congelados existentes
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

    // Calcular datos del período a congelar
    const periodData = await getDailyOvertimeRows(companyId, {
        startDate: fecha_inicio,
        endDate: fecha_fin
    });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Crear registro del corte
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

        // 2. Insertar o actualizar cada registro diario como CONGELADO vinculado a este corte
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

        // 3. Marcar las marcaciones originales de rh_biometric_attendance_logs en ese rango
        await conn.query(
            `UPDATE rh_biometric_attendance_logs
             SET congelado = 1, corte_id = ?
             WHERE company_id = ? AND DATE(punch_time) >= ? AND DATE(punch_time) <= ?`,
            [corteId, companyId, fecha_inicio, fecha_fin]
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

/**
 * Listar cortes congelados de la empresa
 */
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

/**
 * Descongelar / reabrir corte
 */
async function unfreezeCorte(companyId, corteId) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Quitar congelado de logs
        await conn.query(
            `UPDATE rh_biometric_attendance_logs
             SET congelado = 0, corte_id = NULL
             WHERE company_id = ? AND corte_id = ?`,
            [companyId, corteId]
        );

        // 2. Quitar congelado de tabla diaria
        await conn.query(
            `UPDATE rh_biometric_daily_overtime
             SET congelado = 0, corte_id = NULL
             WHERE company_id = ? AND corte_id = ?`,
            [companyId, corteId]
        );

        // 3. Eliminar el corte
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
    getLastCorte,
    getPendingRangeSummary,
    getDailyOvertimeRows,
    updateOvertimeEntry,
    freezePeriod,
    getCortesList,
    unfreezeCorte
};
