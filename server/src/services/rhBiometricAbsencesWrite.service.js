const pool = require('../config/db');
const { getCatalogMeta, ensureAbsenceSchema } = require('./rhBiometricAbsences.catalog');

const VALID_CATEGORIES = new Set(['ley', 'interna', 'injustificada']);
const VALID_AUTH_STATES = new Set(['sin_solicitud', 'pendiente', 'autorizado', 'rechazado']);
const VALID_MODALITIES = new Set(['dia_completo', 'medio_dia', 'por_horas']);

function toDateStr(val) {
    if (!val) return '';
    return String(val).trim().slice(0, 10);
}

function timeToMinutes(t) {
    if (!t) return null;
    const parts = String(t).trim().split(':');
    if (parts.length < 2) return null;
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

function buildBadRequest(msg) {
    const err = new Error(msg);
    err.status = 400;
    return err;
}

async function saveAbsence(companyId, userId, payload = {}) {
    await ensureAbsenceSchema();

    const editId = payload.id ? parseInt(payload.id, 10) : null;
    const empleadoId = parseInt(payload.empleado_id, 10);
    if (!empleadoId) throw buildBadRequest('Debe seleccionar un colaborador válido.');

    const [empRows] = await pool.query(
        `SELECT e.id, COALESCE(t.horas_jornada_diaria, 8.00) AS jornada_horas
         FROM rh_empleados e
         LEFT JOIN rh_turnos t ON t.id = e.turno_id
         WHERE e.id = ? AND e.company_id = ? LIMIT 1`,
        [empleadoId, companyId]
    );
    if (!empRows.length) throw buildBadRequest('El colaborador seleccionado no pertenece a esta empresa.');
    const jornadaHoras = parseFloat(empRows[0].jornada_horas) || 8.0;

    const fechaInicio = toDateStr(payload.fecha_inicio);
    const fechaFin = toDateStr(payload.fecha_fin || payload.fecha_inicio);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) {
        throw buildBadRequest('Las fechas de inicio y fin son obligatorias (formato YYYY-MM-DD).');
    }
    if (fechaInicio > fechaFin) {
        throw buildBadRequest('La fecha de inicio no puede ser posterior a la fecha de fin.');
    }

    const meta = getCatalogMeta(payload.subtipo);
    const categoria = VALID_CATEGORIES.has(payload.categoria)
        ? payload.categoria
        : (meta?.categoria || 'injustificada');
    const subtipo = payload.subtipo || (categoria === 'ley' ? 'incapacidad_isss' : categoria === 'interna' ? 'permiso_personal' : 'falta_sin_aviso');
    const legacyTipo = meta?.legacyTipo || payload.tipo || (categoria === 'ley' ? 'incapacidad' : categoria === 'interna' ? 'permiso' : 'inasistencia');

    const modalidad = VALID_MODALITIES.has(payload.modalidad_tiempo) ? payload.modalidad_tiempo : 'dia_completo';
    let horaInicio = modalidad === 'por_horas' && payload.hora_inicio ? String(payload.hora_inicio).slice(0, 8) : null;
    let horaFin = modalidad === 'por_horas' && payload.hora_fin ? String(payload.hora_fin).slice(0, 8) : null;

    let horasAusencia = parseFloat(payload.horas_ausencia);
    if (modalidad === 'por_horas') {
        if (fechaInicio !== fechaFin) {
            throw buildBadRequest('Los permisos por horas deben registrarse para una misma fecha.');
        }
        const mIni = timeToMinutes(horaInicio);
        const mFin = timeToMinutes(horaFin);
        if (mIni === null || mFin === null || mFin <= mIni) {
            throw buildBadRequest('En permisos por horas debe indicar una hora de inicio y fin válidas (fin mayor que inicio).');
        }
        horasAusencia = Number(((mFin - mIni) / 60).toFixed(2));
    } else if (modalidad === 'medio_dia') {
        horasAusencia = Number.isFinite(horasAusencia) && horasAusencia > 0 ? horasAusencia : Number((jornadaHoras / 2).toFixed(2));
    } else {
        horasAusencia = Number.isFinite(horasAusencia) && horasAusencia > 0 ? horasAusencia : jornadaHoras;
    }

    // Evitar traslapes accidentales de día completo para el mismo colaborador
    if (modalidad === 'dia_completo') {
        const overlapParams = [companyId, empleadoId, fechaFin, fechaInicio];
        let overlapSql = `SELECT id FROM rh_empleado_ausencias
                          WHERE company_id = ? AND empleado_id = ?
                            AND modalidad_tiempo = 'dia_completo'
                            AND fecha_inicio <= ? AND fecha_fin >= ?`;
        if (editId) {
            overlapSql += ' AND id != ?';
            overlapParams.push(editId);
        }
        const [overlaps] = await pool.query(overlapSql, overlapParams);
        if (overlaps.length > 0) {
            throw buildBadRequest('Ya existe una inasistencia o permiso de día completo registrado en esas fechas para este colaborador. Puede editar el registro existente.');
        }
    }

    let pidioPermiso = payload.pidio_permiso !== undefined
        ? (payload.pidio_permiso ? 1 : 0)
        : (meta?.defaultPidioPermiso ?? 0);

    let estadoAuth = VALID_AUTH_STATES.has(payload.estado_autorizacion)
        ? payload.estado_autorizacion
        : (categoria === 'injustificada' ? (pidioPermiso ? 'rechazado' : 'sin_solicitud') : 'pendiente');

    if (estadoAuth === 'pendiente') pidioPermiso = 1;
    if (categoria === 'injustificada' && estadoAuth === 'autorizado') {
        estadoAuth = pidioPermiso ? 'rechazado' : 'sin_solicitud';
    }

    let goceSueldo = payload.goce_sueldo !== undefined
        ? (payload.goce_sueldo ? 1 : 0)
        : (meta?.defaultGoceSueldo ?? 0);
    let afectaSeptimo = payload.afecta_septimo_dia !== undefined
        ? (payload.afecta_septimo_dia ? 1 : 0)
        : (meta?.defaultAfectaSeptimo ?? 0);

    if (categoria === 'injustificada' || estadoAuth === 'rechazado' || estadoAuth === 'sin_solicitud') {
        goceSueldo = 0;
    }
    if (estadoAuth === 'autorizado' && categoria !== 'injustificada') {
        if (payload.afecta_septimo_dia === undefined) afectaSeptimo = 0;
    }

    const justificada = (estadoAuth === 'autorizado' && categoria !== 'injustificada') ? 1 : 0;
    const motivo = (payload.motivo || '').trim() || (meta?.label || 'Registro desde Marcador Digital');
    const docRef = payload.documento_referencia ? String(payload.documento_referencia).trim().slice(0, 120) : null;
    const notasAuth = payload.notas_autorizacion ? String(payload.notas_autorizacion).trim() : null;
    const isResolvedDecision = estadoAuth === 'autorizado' || estadoAuth === 'rechazado';

    if (editId) {
        const [existing] = await pool.query(
            'SELECT id, estado_autorizacion, autorizado_por, fecha_autorizacion FROM rh_empleado_ausencias WHERE id = ? AND company_id = ?',
            [editId, companyId]
        );
        if (!existing.length) {
            const notFound = new Error('Registro de ausencia no encontrado.');
            notFound.status = 404;
            throw notFound;
        }
        const prev = existing[0];
        const keepPrevAuth = isResolvedDecision && prev.estado_autorizacion === estadoAuth && prev.autorizado_por;
        const nextAutorizadoPor = isResolvedDecision ? (keepPrevAuth ? prev.autorizado_por : (userId || null)) : null;
        const nextFechaAuth = isResolvedDecision ? (keepPrevAuth ? prev.fecha_autorizacion : new Date()) : null;

        await pool.query(
            `UPDATE rh_empleado_ausencias
             SET empleado_id = ?, tipo = ?, categoria = ?, subtipo = ?,
                 pidio_permiso = ?, estado_autorizacion = ?, goce_sueldo = ?, afecta_septimo_dia = ?,
                 modalidad_tiempo = ?, horas_ausencia = ?, hora_inicio = ?, hora_fin = ?,
                 fecha_inicio = ?, fecha_fin = ?, motivo = ?, justificada = ?,
                 documento_referencia = ?, autorizado_por = ?, fecha_autorizacion = ?, notas_autorizacion = ?
             WHERE id = ? AND company_id = ?`,
            [
                empleadoId, legacyTipo, categoria, subtipo,
                pidioPermiso, estadoAuth, goceSueldo, afectaSeptimo,
                modalidad, horasAusencia, horaInicio, horaFin,
                fechaInicio, fechaFin, motivo, justificada,
                docRef, nextAutorizadoPor, nextFechaAuth, notasAuth,
                editId, companyId
            ]
        );
        return { id: editId, updated: true };
    }

    const autorizadoPor = isResolvedDecision ? (userId || null) : null;
    const fechaAutorizacion = isResolvedDecision ? new Date() : null;

    const [res] = await pool.query(
        `INSERT INTO rh_empleado_ausencias
         (company_id, empleado_id, tipo, categoria, subtipo, pidio_permiso, estado_autorizacion,
          goce_sueldo, afecta_septimo_dia, modalidad_tiempo, horas_ausencia, hora_inicio, hora_fin,
          fecha_inicio, fecha_fin, motivo, justificada, documento_referencia,
          solicitado_por, autorizado_por, fecha_autorizacion, notas_autorizacion, origen)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'marcador')`,
        [
            companyId, empleadoId, legacyTipo, categoria, subtipo, pidioPermiso, estadoAuth,
            goceSueldo, afectaSeptimo, modalidad, horasAusencia, horaInicio, horaFin,
            fechaInicio, fechaFin, motivo, justificada, docRef,
            userId || null, autorizadoPor, fechaAutorizacion, notasAuth
        ]
    );

    return { id: res.insertId, created: true };
}

async function authorizeAbsence(companyId, userId, absenceId, decision = {}) {
    await ensureAbsenceSchema();
    const id = parseInt(absenceId, 10);
    const [rows] = await pool.query(
        'SELECT * FROM rh_empleado_ausencias WHERE id = ? AND company_id = ? LIMIT 1',
        [id, companyId]
    );
    if (!rows.length) {
        const err = new Error('Registro de permiso o inasistencia no encontrado.');
        err.status = 404;
        throw err;
    }

    const current = rows[0];
    const nextState = decision.estado_autorizacion;
    if (!['autorizado', 'rechazado', 'pendiente'].includes(nextState)) {
        throw buildBadRequest('Estado de decisión inválido. Use autorizado, rechazado o pendiente.');
    }

    let nextCategoria = current.categoria;
    let goceSueldo = decision.goce_sueldo !== undefined ? (decision.goce_sueldo ? 1 : 0) : current.goce_sueldo;
    let afectaSeptimo = decision.afecta_septimo_dia !== undefined ? (decision.afecta_septimo_dia ? 1 : 0) : current.afecta_septimo_dia;
    let justificada = 0;
    let autorizadoPor = null;
    let fechaAutorizacion = null;

    if (nextState === 'autorizado') {
        if (nextCategoria === 'injustificada') nextCategoria = 'interna';
        justificada = 1;
        if (decision.afecta_septimo_dia === undefined) afectaSeptimo = 0;
        autorizadoPor = userId || null;
        fechaAutorizacion = new Date();
    } else if (nextState === 'rechazado') {
        goceSueldo = 0;
        justificada = 0;
        if (decision.afecta_septimo_dia === undefined) afectaSeptimo = 1;
        autorizadoPor = userId || null;
        fechaAutorizacion = new Date();
    }

    const notas = decision.notas_autorizacion !== undefined
        ? (String(decision.notas_autorizacion).trim() || null)
        : current.notas_autorizacion;

    await pool.query(
        `UPDATE rh_empleado_ausencias
         SET categoria = ?, estado_autorizacion = ?, goce_sueldo = ?, afecta_septimo_dia = ?,
             justificada = ?, autorizado_por = ?, fecha_autorizacion = ?, notas_autorizacion = ?
         WHERE id = ? AND company_id = ?`,
        [nextCategoria, nextState, goceSueldo, afectaSeptimo, justificada, autorizadoPor, fechaAutorizacion, notas, id, companyId]
    );

    return { id, estado_autorizacion: nextState, goce_sueldo: goceSueldo };
}

async function deleteAbsence(companyId, absenceId) {
    await ensureAbsenceSchema();
    const [res] = await pool.query(
        'DELETE FROM rh_empleado_ausencias WHERE id = ? AND company_id = ?',
        [parseInt(absenceId, 10), companyId]
    );
    if (res.affectedRows === 0) {
        const err = new Error('Registro de ausencia no encontrado.');
        err.status = 404;
        throw err;
    }
    return { deleted: true };
}

module.exports = {
    saveAbsence,
    authorizeAbsence,
    deleteAbsence
};
