const pool = require('../config/db');
const { extractDateOnly } = require('./rhBiometricDate.helper');

const FALLBACK_ANDELSA_AREAS = {
    '22': 'Quebradoras', '26': 'Empaque', '24': 'Bodega', '795': 'Transferencia',
    '23': 'Logistica', '27': 'Logistica', '21': 'Transferencia', '20': 'Bodega',
    '32': 'Quebraje', '790': 'Pasteurizacion', '794': 'Produccion', '793': 'Produccion',
    '25': 'Transferencia', '28': 'Transferencia'
};

function resolveAreaAndCategory(emp = {}) {
    const cleanDepto = String(emp.departamento_nombre || emp.depto_nombre || emp.departamento || '').trim();
    const cleanOcup = String(emp.ocupacion || '').trim();
    const cleanCargo = String(emp.cargo_nombre || emp.cargo || '').trim();
    const turnoNombre = String(emp.turno_nombre || '').trim();

    let area = '';
    if (cleanOcup && !/^operario$/i.test(cleanOcup)) area = cleanOcup;
    else if (cleanDepto && !/^planta$|^sin depto$/i.test(cleanDepto)) area = cleanDepto;
    else area = FALLBACK_ANDELSA_AREAS[String(emp.empleado_id || emp.id || '')] || cleanDepto || cleanCargo || 'Producción';

    const isTransporte = /log[ií]stica|transporte|chofer|ruta/i.test(`${area} ${cleanCargo} ${turnoNombre}`);
    return {
        area,
        categoria: isTransporte ? 'transporte' : 'produccion'
    };
}

/**
 * Obtiene el saldo de arrastre (HORAS PENDIENTES) del corte congelado inmediatamente anterior a `beforeDate`.
 */
async function getPreviousCorteCarryover(companyId, beforeDate, excludeCorteId = null) {
    const params = [companyId, beforeDate];
    let excludeSql = '';
    if (excludeCorteId) {
        excludeSql = 'AND id != ?';
        params.push(excludeCorteId);
    }

    const [prevCortes] = await pool.query(
        `SELECT id, nombre, DATE_FORMAT(fecha_fin, '%Y-%m-%d') as fecha_fin
         FROM rh_biometric_cortes
         WHERE company_id = ? AND estado = 'congelado' AND fecha_fin < ? ${excludeSql}
         ORDER BY fecha_fin DESC, id DESC
         LIMIT 1`,
        params
    );

    if (!prevCortes.length) {
        return { prevCorte: null, byEmpId: new Map(), byUid: new Map() };
    }

    const prevCorte = prevCortes[0];
    const [saldos] = await pool.query(
        `SELECT empleado_id, device_uid, saldo_arrastre_siguiente, area, categoria, horas_jornada_base
         FROM rh_biometric_corte_saldos
         WHERE company_id = ? AND corte_id = ?`,
        [companyId, prevCorte.id]
    );

    const byEmpId = new Map();
    const byUid = new Map();
    for (const s of saldos) {
        const carry = parseFloat(s.saldo_arrastre_siguiente || 0);
        if (s.empleado_id) byEmpId.set(Number(s.empleado_id), { carry, ...s });
        if (s.device_uid) byUid.set(String(s.device_uid).trim(), { carry, ...s });
    }
    return { prevCorte, byEmpId, byUid };
}

/**
 * Obtiene los saldos ya persistidos de un corte congelado específico.
 */
async function getSavedCorteSaldos(companyId, corteId) {
    const byEmpId = new Map();
    const byUid = new Map();
    if (!corteId) return { byEmpId, byUid, list: [] };

    const [rows] = await pool.query(
        `SELECT * FROM rh_biometric_corte_saldos WHERE company_id = ? AND corte_id = ? ORDER BY id ASC`,
        [companyId, corteId]
    );
    for (const s of rows) {
        if (s.empleado_id) byEmpId.set(Number(s.empleado_id), s);
        if (s.device_uid) byUid.set(String(s.device_uid).trim(), s);
    }
    return { byEmpId, byUid, list: rows };
}

/**
 * Conjunto de fechas con ausencia justificada (vacaciones, incapacidad ISSS, permiso con goce)
 * para no descontar -4h de sábado cuando el colaborador está incapacitado o en vacaciones.
 */
async function getExcusedAbsenceSet(companyId, startDate, endDate) {
    const set = new Set();
    try {
        const [rows] = await pool.query(
            `SELECT empleado_id, DATE_FORMAT(fecha_inicio, '%Y-%m-%d') as fi,
                    DATE_FORMAT(fecha_fin, '%Y-%m-%d') as ff, tipo
             FROM rh_empleado_ausencias
             WHERE company_id = ?
               AND fecha_inicio <= ? AND fecha_fin >= ?
               AND (estado = 'autorizado' OR tipo IN ('incapacidad_isss', 'vacacion', 'vacaciones', 'maternidad', 'paternidad', 'duelo'))`,
            [companyId, endDate, startDate]
        );
        for (const a of rows) {
            if (!a.empleado_id) continue;
            const s = a.fi > startDate ? a.fi : startDate;
            const e = a.ff < endDate ? a.ff : endDate;
            const cur = new Date(`${s}T12:00:00Z`);
            const end = new Date(`${e}T12:00:00Z`);
            while (cur <= end) {
                set.add(`${a.empleado_id}_${cur.toISOString().slice(0, 10)}`);
                cur.setUTCDate(cur.getUTCDate() + 1);
            }
        }
    } catch { /* tabla opcional */ }
    return set;
}

/**
 * Retorna la lista de sábados (YYYY-MM-DD) dentro de [startDate, endDate] que no sean futuros (> today).
 */
function listSaturdaysInRange(startDate, endDate, maxDate = null) {
    const result = [];
    const cap = maxDate && maxDate < endDate ? maxDate : endDate;
    if (!startDate || !cap || startDate > cap) return result;
    const cur = new Date(`${startDate}T12:00:00Z`);
    const end = new Date(`${cap}T12:00:00Z`);
    while (cur <= end) {
        if (cur.getUTCDay() === 6) {
            result.push(cur.toISOString().slice(0, 10));
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return result;
}

/**
 * Consolida el resumen por colaborador (H.E. período + HORAS PENDIENTES + Avícola = Saldo Neto / Pagables / Arrastre)
 * y los subtotales globales por categoría (Producción vs Transporte vs Avícola).
 */
function buildEmployeeSaldosSummary(rows, { carryover = null, savedSaldos = null, permitirSaldoNegativo = false } = {}) {
    const empMap = new Map();

    for (const r of rows) {
        const empKey = r.employee_key || (r.empleado_id ? `emp_${r.empleado_id}` : `uid_${r.device_uid}`);
        if (!empMap.has(empKey)) {
            const saved = savedSaldos
                ? ((r.empleado_id && savedSaldos.byEmpId.get(Number(r.empleado_id))) || savedSaldos.byUid.get(String(r.device_uid).trim()) || null)
                : null;
            const prev = carryover
                ? ((r.empleado_id && carryover.byEmpId.get(Number(r.empleado_id))) || carryover.byUid.get(String(r.device_uid).trim()) || null)
                : null;

            const resolved = resolveAreaAndCategory(r);
            const pendingPrev = saved
                ? parseFloat(saved.horas_pendientes_anteriores || 0)
                : (permitirSaldoNegativo && prev ? parseFloat(prev.carry || 0) : 0);

            empMap.set(empKey, {
                employee_key: empKey,
                empleado_id: r.empleado_id || saved?.empleado_id || null,
                device_uid: String(r.device_uid || saved?.device_uid || ''),
                codigo: r.codigo || r.device_uid || '---',
                nombre: r.nombre || saved?.empleado_nombre || `UID ${r.device_uid}`,
                cargo: r.cargo || 'Sin Cargo',
                departamento: r.departamento || 'Sin Depto',
                area: saved?.area || resolved.area,
                categoria: saved?.categoria || resolved.categoria,
                horas_jornada_base: parseFloat(saved?.horas_jornada_base || r.jornada_horas || (resolved.categoria === 'transporte' ? 8 : 9)),
                dias_registrados: 0,
                sabados_compensados: 0,
                horas_trabajadas: 0,
                llegadas_tarde: 0,
                minutos_tardanza: 0,
                horas_extra_calculadas: 0,
                horas_extra_periodo: 0,
                horas_pendientes_anteriores: pendingPrev,
                horas_extra_avicola: saved ? parseFloat(saved.horas_extra_avicola || 0) : 0,
                _hasSavedAvicola: !!(saved && parseFloat(saved.horas_extra_avicola || 0) > 0),
                horas_extra_diurnas: 0,
                horas_extra_nocturnas: 0
            });
        }

        const emp = empMap.get(empKey);
        emp.dias_registrados += 1;
        if (r.es_dia_compensacion || (r.es_sabado && Number(r.horas_extra_aprobadas) < 0)) {
            emp.sabados_compensados += 1;
        }
        emp.horas_trabajadas += Number(r.horas_trabajadas || 0);
        if (r.es_llegada_tarde) {
            emp.llegadas_tarde += 1;
            emp.minutos_tardanza += Number(r.minutos_tardanza || 0);
        }
        emp.horas_extra_calculadas += Number(r.horas_extra_calculadas || 0);
        emp.horas_extra_periodo += Number(r.horas_extra_aprobadas || 0);
        if (!emp._hasSavedAvicola) {
            emp.horas_extra_avicola += Number(r.horas_extra_avicola || 0);
        }
        emp.horas_extra_diurnas += Number(r.horas_extra_diurnas || 0);
        emp.horas_extra_nocturnas += Number(r.horas_extra_nocturnas || 0);
    }

    let totalProduccion = 0;
    let totalTransporte = 0;
    let totalAvicola = 0;
    let totalPendientesAplicadas = 0;
    let totalNeto = 0;
    let totalPagables = 0;
    let totalArrastreSiguiente = 0;

    const employeeSummaries = Array.from(empMap.values())
        .map(emp => {
            const periodo = parseFloat(emp.horas_extra_periodo.toFixed(2));
            const pendientes = parseFloat(emp.horas_pendientes_anteriores.toFixed(2));
            const avicola = parseFloat(emp.horas_extra_avicola.toFixed(2));
            const saldoNeto = parseFloat((periodo + pendientes).toFixed(2));
            const pagables = parseFloat(Math.max(0, saldoNeto).toFixed(2));
            const arrastre = saldoNeto < 0 ? saldoNeto : 0;

            if (emp.categoria === 'transporte') totalTransporte += saldoNeto;
            else totalProduccion += saldoNeto;
            totalAvicola += avicola;
            totalPendientesAplicadas += pendientes;
            totalNeto += saldoNeto;
            totalPagables += pagables;
            totalArrastreSiguiente += arrastre;

            const { _hasSavedAvicola, ...clean } = emp;
            return {
                ...clean,
                horas_trabajadas: parseFloat(emp.horas_trabajadas.toFixed(2)),
                horas_extra_calculadas: parseFloat(emp.horas_extra_calculadas.toFixed(2)),
                horas_extra_periodo: periodo,
                horas_pendientes_anteriores: pendientes,
                horas_extra_avicola: avicola,
                saldo_neto: saldoNeto,
                horas_pagables: pagables,
                saldo_arrastre_siguiente: arrastre,
                horas_extra_diurnas: parseFloat(emp.horas_extra_diurnas.toFixed(2)),
                horas_extra_nocturnas: parseFloat(emp.horas_extra_nocturnas.toFixed(2))
            };
        })
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));

    return {
        employeeSummaries,
        categoryTotals: {
            total_horas_extra_produccion: parseFloat(totalProduccion.toFixed(2)),
            total_horas_extra_transporte: parseFloat(totalTransporte.toFixed(2)),
            total_horas_extra_avicola: parseFloat(totalAvicola.toFixed(2)),
            total_horas_pendientes_aplicadas: parseFloat(totalPendientesAplicadas.toFixed(2)),
            total_horas_extra_netas: parseFloat(totalNeto.toFixed(2)),
            total_horas_extra_pagables: parseFloat(totalPagables.toFixed(2)),
            total_saldo_arrastre_siguiente: parseFloat(totalArrastreSiguiente.toFixed(2))
        }
    };
}

/**
 * Recalcula y sincroniza `rh_biometric_corte_saldos` y totales de `rh_biometric_cortes`
 * después de editar horas dentro de un corte congelado.
 */
async function recalculateFrozenCorteTotals(conn, companyId, corteId) {
    const [dailyRows] = await conn.query(
        `SELECT device_uid, empleado_id,
                SUM(horas_trabajadas) as sum_trab,
                SUM(horas_extra_calculadas) as sum_calc,
                SUM(horas_extra_aprobadas) as sum_aprob,
                SUM(COALESCE(horas_extra_avicola, 0)) as sum_avicola
         FROM rh_biometric_daily_overtime
         WHERE company_id = ? AND corte_id = ?
         GROUP BY device_uid, empleado_id`,
        [companyId, corteId]
    );

    const [saldosRows] = await conn.query(
        `SELECT * FROM rh_biometric_corte_saldos WHERE company_id = ? AND corte_id = ?`,
        [companyId, corteId]
    );
    const saldosMap = new Map(saldosRows.map(s => [String(s.device_uid), s]));

    let totTrab = 0;
    let totCalc = 0;
    let totNeto = 0;
    let totPagable = 0;
    let totProd = 0;
    let totTransp = 0;
    let totAvicola = 0;
    let totPend = 0;

    for (const d of dailyRows) {
        const uid = String(d.device_uid);
        const existing = saldosMap.get(uid);
        const periodo = parseFloat(Number(d.sum_aprob || 0).toFixed(2));
        const pendientes = existing ? parseFloat(existing.horas_pendientes_anteriores || 0) : 0;
        const avicola = existing && Number(existing.horas_extra_avicola || 0) > 0 && Number(d.sum_avicola || 0) === 0
            ? parseFloat(existing.horas_extra_avicola || 0)
            : parseFloat(Number(d.sum_avicola || 0).toFixed(2));
        const neto = parseFloat((periodo + pendientes).toFixed(2));
        const pagables = parseFloat(Math.max(0, neto).toFixed(2));
        const arrastre = neto < 0 ? neto : 0;

        totTrab += Number(d.sum_trab || 0);
        totCalc += Number(d.sum_calc || 0);
        totNeto += neto;
        totPagable += pagables;
        totAvicola += avicola;
        totPend += pendientes;
        if (existing?.categoria === 'transporte') totTransp += neto;
        else totProd += neto;

        if (existing) {
            await conn.query(
                `UPDATE rh_biometric_corte_saldos
                 SET horas_extra_periodo = ?, saldo_neto = ?, horas_pagables = ?, saldo_arrastre_siguiente = ?, updated_at = NOW()
                 WHERE id = ?`,
                [periodo, neto, pagables, arrastre, existing.id]
            );
        }
    }

    await conn.query(
        `UPDATE rh_biometric_cortes
         SET total_empleados = ?,
             total_horas_trabajadas = ?,
             total_horas_extra = ?,
             total_horas_extra_aprobadas = ?,
             total_horas_extra_produccion = ?,
             total_horas_extra_transporte = ?,
             total_horas_extra_avicola = ?,
             total_horas_pendientes_aplicadas = ?,
             total_horas_extra_pagables = ?,
             updated_at = NOW()
         WHERE id = ? AND company_id = ?`,
        [
            dailyRows.length,
            parseFloat(totTrab.toFixed(2)),
            parseFloat(totCalc.toFixed(2)),
            parseFloat(totNeto.toFixed(2)),
            parseFloat(totProd.toFixed(2)),
            parseFloat(totTransp.toFixed(2)),
            parseFloat(totAvicola.toFixed(2)),
            parseFloat(totPend.toFixed(2)),
            parseFloat(totPagable.toFixed(2)),
            corteId,
            companyId
        ]
    );
}

module.exports = {
    FALLBACK_ANDELSA_AREAS,
    resolveAreaAndCategory,
    getPreviousCorteCarryover,
    getSavedCorteSaldos,
    getExcusedAbsenceSet,
    listSaturdaysInRange,
    buildEmployeeSaldosSummary,
    recalculateFrozenCorteTotals,
    extractDateOnly
};
