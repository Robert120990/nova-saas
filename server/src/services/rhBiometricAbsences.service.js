const pool = require('../config/db');
const { getSettings, getHolidays } = require('./rhBiometricConfig.service');
const { ABSENCE_CATALOG, getCatalogMeta, ensureAbsenceSchema } = require('./rhBiometricAbsences.catalog');

function getTodaySv() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/El_Salvador',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
}

function toDateStr(val) {
    if (!val) return '';
    if (typeof val === 'string') return val.slice(0, 10);
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function timeToMinutes(t) {
    if (!t) return 0;
    const [h, m] = String(t).split(':');
    return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
}

function extractTimeStr(dt) {
    if (!dt) return null;
    if (typeof dt === 'string') {
        const m = dt.trim().match(/(\d{2}:\d{2}:\d{2})/);
        if (m && !dt.trim().endsWith('Z')) return m[1];
    }
    const d = new Date(dt);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString('es-SV', { timeZone: 'America/El_Salvador', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

async function getDailyAttendanceRadar(companyId, filters = {}) {
    await ensureAbsenceSchema();
    const targetDate = toDateStr(filters.date) || getTodaySv();
    const { branchId, departamentoId, search, statusFilter = 'todos' } = filters;

    const settings = await getSettings(companyId);
    const holidays = await getHolidays(companyId, settings.pais_festivos || 'SV');
    const [yr, mo, dy] = targetDate.split('-').map(Number);
    const matchedHoliday = holidays.find(h =>
        h.is_active && Number(h.mes) === mo && Number(h.dia) === dy && (!h.anio || Number(h.anio) === yr)
    );
    const isSunday = new Date(`${targetDate}T12:00:00Z`).getUTCDay() === 0;

    const empConds = ['e.company_id = ?', 'e.es_activo = 1'];
    const empParams = [companyId];
    if (branchId && branchId !== 'todos') { empConds.push('e.branch_id = ?'); empParams.push(branchId); }
    if (departamentoId && departamentoId !== 'todos') { empConds.push('e.departamento_personal_id = ?'); empParams.push(departamentoId); }
    if (search && search.trim()) {
        const s = `%${search.trim()}%`;
        empConds.push('(e.nombres LIKE ? OR e.apellidos LIKE ? OR e.codigo LIKE ? OR e.codigo_biometrico LIKE ?)');
        empParams.push(s, s, s, s);
    }

    const [employees] = await pool.query(
        `SELECT e.id, e.codigo, e.codigo_biometrico, e.nombres, e.apellidos, e.fecha_ingreso,
                e.en_vacaciones, e.incapacitado, e.turno_id,
                c.descripcion AS cargo_nombre, dep.descripcion AS departamento_nombre, b.nombre AS branch_name,
                t.nombre AS turno_nombre, t.hora_entrada AS turno_entrada, t.hora_salida AS turno_salida,
                t.tolerancia_entrada_minutos AS turno_tolerancia, t.horas_jornada_diaria AS turno_jornada
         FROM rh_empleados e
         LEFT JOIN rh_turnos t ON t.id = e.turno_id
         LEFT JOIN rh_cargos c ON c.id = e.cargo_id
         LEFT JOIN rh_departamentos dep ON dep.id = e.departamento_personal_id
         LEFT JOIN branches b ON b.id = e.branch_id
         WHERE ${empConds.join(' AND ')}
         ORDER BY e.apellidos ASC, e.nombres ASC`,
        empParams
    );

    const [punches] = await pool.query(
        `SELECT id, empleado_id, device_uid,
                DATE_FORMAT(punch_time, '%Y-%m-%d %H:%i:%s') AS punch_time,
                punch_type, source
         FROM rh_biometric_attendance_logs
         WHERE company_id = ? AND punch_time >= ? AND punch_time <= ?
         ORDER BY punch_time ASC`,
        [companyId, `${targetDate} 00:00:00`, `${targetDate} 23:59:59`]
    );

    const [absences] = await pool.query(
        `SELECT a.*, COALESCE(u.nombre, u.username) AS autorizado_por_nombre
         FROM rh_empleado_ausencias a
         LEFT JOIN users u ON u.id = a.autorizado_por
         WHERE a.company_id = ? AND a.fecha_inicio <= ? AND a.fecha_fin >= ?
         ORDER BY a.id DESC`,
        [companyId, targetDate, targetDate]
    );

    const punchByEmpId = new Map();
    const punchByUid = new Map();
    for (const p of punches) {
        if (p.empleado_id) {
            if (!punchByEmpId.has(p.empleado_id)) punchByEmpId.set(p.empleado_id, []);
            punchByEmpId.get(p.empleado_id).push(p);
        }
        if (p.device_uid) {
            const key = String(p.device_uid).trim().toLowerCase().replace(/^0+/, '');
            if (!punchByUid.has(key)) punchByUid.set(key, []);
            punchByUid.get(key).push(p);
        }
    }

    const absenceByEmpId = new Map();
    for (const a of absences) {
        if (!absenceByEmpId.has(a.empleado_id)) {
            absenceByEmpId.set(a.empleado_id, {
                ...a,
                fecha_inicio: toDateStr(a.fecha_inicio),
                fecha_fin: toDateStr(a.fecha_fin),
                subtipo_label: getCatalogMeta(a.subtipo)?.label || a.tipo
            });
        }
    }

    const summary = {
        total_activos: 0, asistieron: 0, sin_justificar: 0,
        pendientes_autorizar: 0, autorizados_con_goce: 0,
        autorizados_sin_goce: 0, injustificadas: 0, descanso_festivo: 0
    };
    const allRows = [];

    for (const emp of employees) {
        const ingresoStr = toDateStr(emp.fecha_ingreso);
        if (ingresoStr && ingresoStr > targetDate) continue;

        summary.total_activos++;
        const uidKey = String(emp.codigo_biometrico || emp.codigo || '').trim().toLowerCase().replace(/^0+/, '');
        const empPunches = punchByEmpId.get(emp.id) || (uidKey ? punchByUid.get(uidKey) : null) || [];
        const empAbsence = absenceByEmpId.get(emp.id) || null;

        const horaEsperada = emp.turno_entrada || settings.hora_entrada || '08:00:00';
        const tolerancia = parseInt(emp.turno_tolerancia ?? settings.tolerancia_entrada_minutos ?? 15, 10);
        const jornadaHoras = parseFloat(emp.turno_jornada ?? settings.horas_jornada_diaria ?? 8.0);

        let radarStatus = 'ausente_sin_justificar';
        let primeraEntrada = null;
        let ultimaSalida = null;
        let minutosTardanza = 0;

        if (empPunches.length > 0) {
            radarStatus = 'asistio';
            primeraEntrada = extractTimeStr(empPunches[0].punch_time);
            if (empPunches.length > 1) ultimaSalida = extractTimeStr(empPunches[empPunches.length - 1].punch_time);
            const entradaMins = timeToMinutes(primeraEntrada);
            const limiteMins = timeToMinutes(horaEsperada) + tolerancia;
            if (entradaMins > limiteMins) minutosTardanza = entradaMins - timeToMinutes(horaEsperada);
            summary.asistieron++;
        } else if (empAbsence) {
            if (empAbsence.estado_autorizacion === 'pendiente') {
                radarStatus = 'permiso_pendiente';
                summary.pendientes_autorizar++;
            } else if (empAbsence.categoria === 'injustificada' || empAbsence.estado_autorizacion === 'rechazado' || empAbsence.estado_autorizacion === 'sin_solicitud') {
                radarStatus = 'falta_injustificada';
                summary.injustificadas++;
            } else {
                radarStatus = 'ausencia_autorizada';
                if (empAbsence.goce_sueldo) summary.autorizados_con_goce++;
                else summary.autorizados_sin_goce++;
            }
        } else if (emp.en_vacaciones || emp.incapacitado) {
            radarStatus = 'ausencia_autorizada';
            summary.autorizados_con_goce++;
        } else if (matchedHoliday || isSunday) {
            radarStatus = 'descanso_festivo';
            summary.descanso_festivo++;
        } else {
            radarStatus = 'ausente_sin_justificar';
            summary.sin_justificar++;
        }

        allRows.push({
            empleado_id: emp.id,
            codigo: emp.codigo || '',
            codigo_biometrico: emp.codigo_biometrico || emp.codigo || String(emp.id),
            nombres: emp.nombres,
            apellidos: emp.apellidos,
            empleado_nombre: `${emp.nombres || ''} ${emp.apellidos || ''}`.trim(),
            fecha_ingreso: ingresoStr || null,
            cargo_nombre: emp.cargo_nombre || 'Sin Cargo',
            departamento_nombre: emp.departamento_nombre || 'Sin Depto',
            branch_name: emp.branch_name || 'Principal',
            turno_nombre: emp.turno_nombre || 'General',
            hora_entrada_esperada: String(horaEsperada).slice(0, 5),
            jornada_horas: jornadaHoras,
            fecha: targetDate,
            radar_status: radarStatus,
            primera_entrada: primeraEntrada,
            ultima_salida: ultimaSalida,
            total_marcaciones: empPunches.length,
            minutos_tardanza: minutosTardanza,
            en_vacaciones_flag: !!emp.en_vacaciones,
            incapacitado_flag: !!emp.incapacitado,
            ausencia: empAbsence
        });
    }

    const filteredRows = statusFilter === 'todos' ? allRows : allRows.filter(r => {
        if (statusFilter === 'sin_justificar') return r.radar_status === 'ausente_sin_justificar';
        if (statusFilter === 'pendiente') return r.radar_status === 'permiso_pendiente' || r.ausencia?.estado_autorizacion === 'pendiente';
        if (statusFilter === 'justificados') return r.radar_status === 'ausencia_autorizada';
        if (statusFilter === 'injustificadas') return r.radar_status === 'falta_injustificada';
        if (statusFilter === 'asistieron') return r.radar_status === 'asistio';
        return true;
    });

    return {
        date: targetDate,
        is_holiday: !!matchedHoliday,
        holiday_name: matchedHoliday?.nombre || null,
        is_sunday: isSunday,
        summary,
        rows: filteredRows
    };
}

async function getAbsencesList(companyId, filters = {}) {
    await ensureAbsenceSchema();
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(filters.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const conds = ['a.company_id = ?'];
    const params = [companyId];

    let startDate = toDateStr(filters.startDate || filters.start_date);
    let endDate = toDateStr(filters.endDate || filters.end_date);
    if (startDate && endDate && startDate > endDate) {
        const tmp = startDate;
        startDate = endDate;
        endDate = tmp;
    }
    if (startDate) { conds.push('a.fecha_fin >= ?'); params.push(startDate); }
    if (endDate) { conds.push('a.fecha_inicio <= ?'); params.push(endDate); }
    if (filters.empleadoId) { conds.push('a.empleado_id = ?'); params.push(filters.empleadoId); }
    if (filters.categoria && filters.categoria !== 'todos') { conds.push('a.categoria = ?'); params.push(filters.categoria); }
    if (filters.estadoAutorizacion && filters.estadoAutorizacion !== 'todos') {
        conds.push('a.estado_autorizacion = ?');
        params.push(filters.estadoAutorizacion);
    }
    if (filters.search && filters.search.trim()) {
        const s = `%${filters.search.trim()}%`;
        conds.push('(e.nombres LIKE ? OR e.apellidos LIKE ? OR e.codigo LIKE ? OR a.motivo LIKE ? OR a.documento_referencia LIKE ?)');
        params.push(s, s, s, s, s);
    }

    const whereSql = conds.join(' AND ');
    const [[stats]] = await pool.query(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN a.estado_autorizacion = 'pendiente' THEN 1 ELSE 0 END) AS pendientes,
                SUM(CASE WHEN a.estado_autorizacion = 'autorizado' AND a.goce_sueldo = 1 THEN 1 ELSE 0 END) AS autorizados_con_goce,
                SUM(CASE WHEN a.estado_autorizacion = 'autorizado' AND a.goce_sueldo = 0 THEN 1 ELSE 0 END) AS autorizados_sin_goce,
                SUM(CASE WHEN a.categoria = 'injustificada' OR a.estado_autorizacion IN ('rechazado','sin_solicitud') THEN 1 ELSE 0 END) AS injustificadas
         FROM rh_empleado_ausencias a
         LEFT JOIN rh_empleados e ON e.id = a.empleado_id
         WHERE ${whereSql}`,
        params
    );

    const [rows] = await pool.query(
        `SELECT a.*,
                (DATEDIFF(a.fecha_fin, a.fecha_inicio) + 1) AS total_dias,
                e.codigo AS empleado_codigo, e.codigo_biometrico, e.nombres AS empleado_nombres,
                e.apellidos AS empleado_apellidos, e.fecha_ingreso,
                CONCAT(COALESCE(e.nombres, ''), ' ', COALESCE(e.apellidos, '')) AS empleado_nombre,
                c.descripcion AS cargo_nombre, dep.descripcion AS departamento_nombre,
                COALESCE(us.nombre, us.username) AS solicitado_por_nombre,
                COALESCE(ua.nombre, ua.username) AS autorizado_por_nombre
         FROM rh_empleado_ausencias a
         LEFT JOIN rh_empleados e ON e.id = a.empleado_id
         LEFT JOIN rh_cargos c ON c.id = e.cargo_id
         LEFT JOIN rh_departamentos dep ON dep.id = e.departamento_personal_id
         LEFT JOIN users us ON us.id = a.solicitado_por
         LEFT JOIN users ua ON ua.id = a.autorizado_por
         WHERE ${whereSql}
         ORDER BY a.fecha_inicio DESC, a.id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    const total = Number(stats?.total || 0);
    return {
        data: rows.map(r => ({
            ...r,
            fecha_inicio: toDateStr(r.fecha_inicio),
            fecha_fin: toDateStr(r.fecha_fin),
            subtipo_label: getCatalogMeta(r.subtipo)?.label || r.tipo
        })),
        pagination: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
        summary: {
            total,
            pendientes: Number(stats?.pendientes || 0),
            autorizados_con_goce: Number(stats?.autorizados_con_goce || 0),
            autorizados_sin_goce: Number(stats?.autorizados_sin_goce || 0),
            injustificadas: Number(stats?.injustificadas || 0)
        }
    };
}

const writeOps = require('./rhBiometricAbsencesWrite.service');

module.exports = {
    ABSENCE_CATALOG,
    getDailyAttendanceRadar,
    getAbsencesList,
    ...writeOps
};
