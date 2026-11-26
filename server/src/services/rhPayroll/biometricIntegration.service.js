const { splitOvertimeDayNight } = require('../rhBiometricCalc.helper');

/**
 * Integración opcional entre el Marcador Biométrico (cortes congelados, horas extra y ausencias)
 * y la generación de planilla quincenal.
 * Solo se activa cuando `rh_biometric_settings.vincular_con_planilla = 1`.
 */

function getQuincenaDateRange(anio, mes, quincena) {
    const y = parseInt(anio, 10);
    const m = parseInt(mes, 10);
    const mPad = String(m).padStart(2, '0');
    if (quincena === 'primera') {
        return { startDate: `${y}-${mPad}-01`, endDate: `${y}-${mPad}-15` };
    }
    const lastDay = new Date(y, m, 0).getDate();
    return { startDate: `${y}-${mPad}-16`, endDate: `${y}-${mPad}-${String(lastDay).padStart(2, '0')}` };
}

/**
 * Retorna un mapa por empleado_id con:
 * - horasExtraDiurnas: total de horas extra diurnas aprobadas en el período
 * - horasExtraNocturnas: total de horas extra nocturnas aprobadas en el período
 * - diasAusenciaSinGoce: total de días autorizados sin goce o injustificados en el período
 * - enabled: booleano indicando si la empresa tiene activa la vinculación
 */
async function getBiometricPayrollContext(pool, companyId, periodoAnio, periodoMes, quincena) {
    const empty = { enabled: false, byEmployee: new Map(), range: null };

    const [settingsRows] = await pool.query(
        'SELECT vincular_con_planilla, calcular_horas_extra FROM rh_biometric_settings WHERE company_id = ? LIMIT 1',
        [companyId]
    ).catch(() => [[]]);

    if (!settingsRows.length || !settingsRows[0].vincular_con_planilla) {
        return empty;
    }

    const range = getQuincenaDateRange(periodoAnio, periodoMes, quincena);
    const byEmployee = new Map();
    const ensure = (empId) => {
        if (!byEmployee.has(empId)) {
            byEmployee.set(empId, { horasExtraDiurnas: 0, horasExtraNocturnas: 0, diasAusenciaSinGoce: 0 });
        }
        return byEmployee.get(empId);
    };

    // 1. Horas extra aprobadas (priorizando saldos consolidados con arrastre de cortes congelados)
    if (settingsRows[0].calcular_horas_extra) {
        const [frozenSaldos] = await pool.query(
            `SELECT s.empleado_id, SUM(s.horas_pagables) as horas_pagables
             FROM rh_biometric_corte_saldos s
             JOIN rh_biometric_cortes c ON c.id = s.corte_id
             WHERE s.company_id = ? AND c.estado = 'congelado'
               AND s.empleado_id IS NOT NULL
               AND c.fecha_fin >= ? AND c.fecha_fin <= ?
             GROUP BY s.empleado_id`,
            [companyId, range.startDate, range.endDate]
        ).catch(() => [[]]);

        if (frozenSaldos.length > 0) {
            for (const r of frozenSaldos) {
                const entry = ensure(r.empleado_id);
                const pagables = Math.max(0, parseFloat(r.horas_pagables || 0));
                entry.horasExtraDiurnas = parseFloat((entry.horasExtraDiurnas + pagables).toFixed(2));
            }
        } else {
            const [otRows] = await pool.query(
                `SELECT empleado_id, salida, horas_extra_aprobadas
                 FROM rh_biometric_daily_overtime
                 WHERE company_id = ? AND empleado_id IS NOT NULL
                   AND fecha >= ? AND fecha <= ?
                   AND horas_extra_aprobadas > 0`,
                [companyId, range.startDate, range.endDate]
            ).catch(() => [[]]);

            for (const r of otRows) {
                const entry = ensure(r.empleado_id);
                const mins = Math.round(parseFloat(r.horas_extra_aprobadas || 0) * 60);
                const split = splitOvertimeDayNight(r.salida ? `2026-01-01 ${r.salida}` : null, mins);
                entry.horasExtraDiurnas = parseFloat((entry.horasExtraDiurnas + split.horasExtraDiurnas).toFixed(2));
                entry.horasExtraNocturnas = parseFloat((entry.horasExtraNocturnas + split.horasExtraNocturnas).toFixed(2));
            }
        }
    }

    // 2. Ausencias sin goce de sueldo o injustificadas en el rango de la quincena
    const [absRows] = await pool.query(
        `SELECT empleado_id, DATE_FORMAT(fecha_inicio, '%Y-%m-%d') as fi,
                DATE_FORMAT(fecha_fin, '%Y-%m-%d') as ff, goce_sueldo, tipo, estado
         FROM rh_empleado_ausencias
         WHERE company_id = ?
           AND fecha_inicio <= ? AND fecha_fin >= ?
           AND (
               (estado = 'autorizado' AND goce_sueldo = 0)
               OR tipo = 'injustificada'
           )`,
        [companyId, range.endDate, range.startDate]
    ).catch(() => [[]]);

    for (const a of absRows) {
        const effStart = a.fi > range.startDate ? a.fi : range.startDate;
        const effEnd = a.ff < range.endDate ? a.ff : range.endDate;
        const msStart = new Date(`${effStart}T12:00:00Z`).getTime();
        const msEnd = new Date(`${effEnd}T12:00:00Z`).getTime();
        if (isNaN(msStart) || isNaN(msEnd) || msEnd < msStart) continue;
        const days = Math.floor((msEnd - msStart) / 86400000) + 1;
        const entry = ensure(a.empleado_id);
        entry.diasAusenciaSinGoce = Math.min(15, entry.diasAusenciaSinGoce + days);
    }

    return { enabled: true, byEmployee, range };
}

module.exports = {
    getQuincenaDateRange,
    getBiometricPayrollContext
};
