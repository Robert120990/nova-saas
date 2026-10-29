const pool = require('../config/db');
const { getCatalogMeta, ensureAbsenceSchema } = require('./rhBiometricAbsences.catalog');

function toDateStr(val) {
    if (!val) return '';
    if (typeof val === 'string') return val.slice(0, 10);
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addOneDay(dateStr) {
    const d = new Date(`${dateStr}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
}

function buildAbsenceSummaryText(a) {
    const base = getCatalogMeta(a.subtipo)?.label || a.tipo || 'Ausencia';
    let stateTxt = 'SIN SOLICITUD';
    if (a.estado_autorizacion === 'pendiente') stateTxt = 'PENDIENTE AUTORIZAR';
    else if (a.estado_autorizacion === 'autorizado') stateTxt = a.goce_sueldo ? 'AUTORIZADO · CON GOCE' : 'AUTORIZADO · SIN GOCE';
    else if (a.estado_autorizacion === 'rechazado') stateTxt = 'NO AUTORIZADO';
    return `${base} [${stateTxt}]`;
}

async function enrichReportWithAbsences(companyId, filters, reportRows, summary, holidayMap, settings) {
    await ensureAbsenceSchema();

    const startDate = toDateStr(filters.startDate || filters.start_date);
    const endDate = toDateStr(filters.endDate || filters.end_date);
    const { branchId, departamentoId, search } = filters;

    const conds = ['a.company_id = ?'];
    const params = [companyId];
    if (startDate) { conds.push('a.fecha_fin >= ?'); params.push(startDate); }
    if (endDate) { conds.push('a.fecha_inicio <= ?'); params.push(endDate); }
    if (branchId && branchId !== 'todos') { conds.push('e.branch_id = ?'); params.push(branchId); }
    if (departamentoId && departamentoId !== 'todos') { conds.push('e.departamento_personal_id = ?'); params.push(departamentoId); }
    if (search && search.trim()) {
        const s = `%${search.trim()}%`;
        conds.push('(e.nombres LIKE ? OR e.apellidos LIKE ? OR e.codigo LIKE ? OR e.codigo_biometrico LIKE ?)');
        params.push(s, s, s, s);
    }

    const [absences] = await pool.query(
        `SELECT a.*, e.codigo AS empleado_codigo, e.codigo_biometrico,
                e.nombres, e.apellidos, COALESCE(e.exento_horas_extras, 0) AS exento_horas_extras,
                t.nombre AS turno_nombre, t.horas_jornada_diaria AS turno_jornada,
                c.descripcion AS cargo_nombre, dep.descripcion AS departamento_nombre
         FROM rh_empleado_ausencias a
         INNER JOIN rh_empleados e ON e.id = a.empleado_id
         LEFT JOIN rh_turnos t ON t.id = e.turno_id
         LEFT JOIN rh_cargos c ON c.id = e.cargo_id
         LEFT JOIN rh_departamentos dep ON dep.id = e.departamento_personal_id
         WHERE ${conds.join(' AND ')}
         ORDER BY a.fecha_inicio ASC`,
        params
    );

    summary.total_ausencias_justificadas = 0;
    summary.total_ausencias_injustificadas = 0;
    summary.total_permisos_pendientes = 0;

    if (!absences.length) return;

    const existingMap = new Map();
    for (const r of reportRows) {
        if (r.empleado_id && r.fecha) {
            existingMap.set(`${r.empleado_id}_${r.fecha}`, r);
        }
    }

    const todayStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/El_Salvador', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());

    for (const a of absences) {
        const fIni = toDateStr(a.fecha_inicio);
        const fFin = toDateStr(a.fecha_fin);
        if (!fIni || !fFin) continue;

        let cur = startDate && startDate > fIni ? startDate : fIni;
        const maxEnd = endDate && endDate < fFin ? endDate : fFin;
        const label = buildAbsenceSummaryText(a);
        const jornada = parseFloat(a.turno_jornada ?? settings.horas_jornada_diaria ?? 8.0);
        let guard = 0;

        while (cur <= maxEnd && guard < 62) {
            guard++;
            if (!endDate && cur > todayStr) break;

            const key = `${a.empleado_id}_${cur}`;
            const existingRow = existingMap.get(key);

            if (existingRow) {
                existingRow.observacion = existingRow.observacion
                    ? `${existingRow.observacion} | ${label}`
                    : label;
                existingRow.ausencia_estado = a.estado_autorizacion;
                existingRow.ausencia_label = label;
            } else {
                const isSunday = new Date(`${cur}T12:00:00Z`).getUTCDay() === 0;
                const [, m, d] = cur.split('-');
                const isFestivo = holidayMap.has(`${m}-${d}`);

                if (!isSunday || fIni === fFin) {
                    const isComision = a.subtipo === 'comision_trabajo_campo' && a.estado_autorizacion === 'autorizado';
                    const creditedHours = isComision ? jornada : 0;
                    if (creditedHours > 0) {
                        summary.total_horas_trabajadas = Number((summary.total_horas_trabajadas + creditedHours).toFixed(2));
                    }

                    if (a.estado_autorizacion === 'pendiente') summary.total_permisos_pendientes++;
                    else if (a.estado_autorizacion === 'autorizado' && a.categoria !== 'injustificada') summary.total_ausencias_justificadas++;
                    else summary.total_ausencias_injustificadas++;

                    const newRow = {
                        empleado_id: a.empleado_id,
                        device_uid: a.codigo_biometrico || a.empleado_codigo || String(a.empleado_id),
                        codigo: a.empleado_codigo || String(a.empleado_id),
                        nombre: `${a.nombres || ''} ${a.apellidos || ''}`.trim(),
                        turno: a.turno_nombre || 'General',
                        departamento: a.departamento_nombre || 'Sin Depto',
                        cargo: a.cargo_nombre || 'Sin Cargo',
                        fecha: cur,
                        entrada: isComision ? 'COMISIÓN' : (a.estado_autorizacion === 'pendiente' ? 'PENDIENTE' : (a.justificada ? 'PERMISO' : 'AUSENTE')),
                        salida_almuerzo: '---',
                        entrada_almuerzo: '---',
                        salida: isComision ? 'EXTERNA' : (a.goce_sueldo ? 'CON GOCE' : 'SIN GOCE'),
                        horas_trabajadas: creditedHours,
                        minutos_tardanza: 0,
                        es_llegada_tarde: false,
                        horas_extra: 0,
                        es_editado: false,
                        observacion: a.motivo ? `${label} — ${a.motivo}` : label,
                        congelado: false,
                        exento_horas_extras: !!a.exento_horas_extras,
                        es_festivo: isFestivo,
                        es_ausencia: !isComision,
                        ausencia_estado: a.estado_autorizacion,
                        ausencia_categoria: a.categoria,
                        ausencia_goce: !!a.goce_sueldo,
                        ausencia_label: label
                    };
                    reportRows.push(newRow);
                    existingMap.set(key, newRow);
                }
            }
            cur = addOneDay(cur);
        }
    }

    reportRows.sort((x, y) => x.fecha.localeCompare(y.fecha) || x.nombre.localeCompare(y.nombre));
    summary.total_registros = reportRows.length;
}

module.exports = { enrichReportWithAbsences };
