const pool = require('../config/db');
const {
    getTodayDateOnly,
    formatToSqlDateTime,
    isValidBiometricDateTime,
    appendPunchTimeBounds
} = require('./rhBiometricDate.helper');
const deviceService = require('./rhBiometricDevice.service');

/**
 * Servicio de Marcaciones del Marcador Digital Biométrico (ZKTeco) en Recursos Humanos
 */

const PUNCH_TYPE_MAP = {
    0: 'entrada',
    1: 'salida',
    2: 'salida_almuerzo',
    3: 'entrada_almuerzo',
    4: 'horas_extra_entrada',
    5: 'horas_extra_salida'
};

const VERIFY_TYPE_MAP = {
    0: 'Contraseña',
    1: 'Huella Digital',
    2: 'Tarjeta RFID',
    3: 'Contraseña',
    4: 'Rostro / Facial',
    15: 'Rostro / Facial'
};

/**
 * Procesa un lote de marcaciones enviadas por el conector LAN.
 * Vinculación ESTRICTA por `codigo_biometrico` (nunca cruza por `codigo` de planilla ni `emp.id`).
 */
async function processBatchPunches(companyId, deviceId, punches = []) {
    if (!Array.isArray(punches) || punches.length === 0) {
        return { totalReceived: 0, insertedCount: 0, skippedInvalidDates: 0 };
    }

    const [employees] = await pool.query(
        `SELECT id, codigo_biometrico
         FROM rh_empleados
         WHERE company_id = ? AND codigo_biometrico IS NOT NULL AND codigo_biometrico != ''`,
        [companyId]
    );

    const empMap = new Map();
    for (const emp of employees) {
        const bio = String(emp.codigo_biometrico).trim().toLowerCase();
        if (!bio) continue;
        empMap.set(bio, emp.id);
        const bioNoZero = bio.replace(/^0+/, '');
        if (bioNoZero) empMap.set(bioNoZero, emp.id);
    }

    let insertedCount = 0;
    let skippedInvalidDates = 0;
    const values = [];

    for (const p of punches) {
        const uid = String(p.device_uid || p.user_id || p.userId || p.uid || '').trim();
        if (!uid) continue;

        const punchTimeStr = p.punch_time || p.record_time || p.timestamp || p.time;
        if (!punchTimeStr) continue;

        const normalizedTime = formatToSqlDateTime(punchTimeStr);
        if (!normalizedTime || !isValidBiometricDateTime(normalizedTime)) {
            skippedInvalidDates++;
            continue;
        }

        const cleanUid = uid.toLowerCase();
        const cleanUidNoZero = cleanUid.replace(/^0+/, '');
        const empleadoId = empMap.get(cleanUid) || (cleanUidNoZero ? empMap.get(cleanUidNoZero) : null) || null;

        const punchCode = typeof p.punch_code === 'number'
            ? p.punch_code
            : (typeof p.punch === 'number' ? p.punch : (typeof p.state === 'number' ? p.state : 0));
        let punchType = p.punch_type || (p.punch_code !== undefined && p.punch_code > 0 ? PUNCH_TYPE_MAP[punchCode] : null);
        const timePart = normalizedTime.slice(11, 19);
        if (!punchType) {
            if (timePart >= '15:00:00') punchType = 'salida';
            else if (timePart >= '11:30:00' && timePart < '13:00:00') punchType = 'salida_almuerzo';
            else if (timePart >= '13:00:00' && timePart < '14:30:00') punchType = 'entrada_almuerzo';
            else punchType = 'entrada';
        }

        const verifyType = typeof p.verify_type === 'number' ? p.verify_type : (typeof p.verifyType === 'number' ? p.verifyType : 1);
        const verifyLabel = p.verify_label || VERIFY_TYPE_MAP[verifyType] || 'Huella Digital';
        const source = p.source || 'agent';
        const rawJson = p.raw_data ? JSON.stringify(p.raw_data) : JSON.stringify(p);

        values.push([
            companyId, deviceId || null, uid, empleadoId, normalizedTime,
            punchType, punchCode, verifyType, verifyLabel, source, rawJson
        ]);
    }

    if (values.length > 0) {
        const [res] = await pool.query(
            `INSERT IGNORE INTO rh_biometric_attendance_logs
             (company_id, device_id, device_uid, empleado_id, punch_time, punch_type, punch_code, verify_type, verify_label, source, raw_data)
             VALUES ?`,
            [values]
        );
        insertedCount = res.affectedRows || 0;
    }

    if (deviceId) {
        await pool.query(
            `UPDATE rh_biometric_devices SET last_sync = NOW(), last_seen = NOW(), status = 'online' WHERE id = ?`,
            [deviceId]
        );
    }

    return { totalReceived: punches.length, insertedCount, skippedInvalidDates };
}

async function createManualPunch(companyId, data) {
    const { empleado_id, punch_time, punch_type, notas, device_id } = data;
    if (!empleado_id) throw Object.assign(new Error('Seleccione un empleado.'), { status: 400 });
    if (!punch_time) throw Object.assign(new Error('Ingrese fecha y hora de la marcación.'), { status: 400 });

    const [emp] = await pool.query(
        'SELECT id, codigo, codigo_biometrico FROM rh_empleados WHERE id = ? AND company_id = ?',
        [empleado_id, companyId]
    );
    if (!emp.length) throw Object.assign(new Error('Empleado no encontrado.'), { status: 404 });

    const uid = emp[0].codigo_biometrico || emp[0].codigo || String(emp[0].id);
    const normalizedTime = formatToSqlDateTime(punch_time) || punch_time;

    const [res] = await pool.query(
        `INSERT INTO rh_biometric_attendance_logs
         (company_id, device_id, device_uid, empleado_id, punch_time, punch_type, punch_code, verify_type, verify_label, source, notas)
         VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'Registro Manual', 'manual', ?)`,
        [companyId, device_id || null, uid, empleado_id, normalizedTime, punch_type || 'entrada', notas || 'Marcación manual por RH']
    );

    return { id: res.insertId, success: true };
}

async function updateManualPunch(companyId, punchId, data, userLabel = 'RH') {
    const [existing] = await pool.query(
        `SELECT id, source, congelado, notas FROM rh_biometric_attendance_logs
         WHERE id = ? AND company_id = ? LIMIT 1`,
        [punchId, companyId]
    );
    if (!existing.length) throw Object.assign(new Error('Marcación no encontrada.'), { status: 404 });
    if (existing[0].source !== 'manual') {
        throw Object.assign(new Error('Solo se pueden editar marcaciones registradas manualmente. Las marcas del reloj están protegidas.'), { status: 403 });
    }
    if (existing[0].congelado) {
        throw Object.assign(new Error('No se puede editar una marcación perteneciente a un corte congelado.'), { status: 409 });
    }

    const { punch_time, punch_type, notas } = data;
    const normalizedTime = punch_time ? (formatToSqlDateTime(punch_time) || punch_time) : null;
    if (!normalizedTime) throw Object.assign(new Error('Fecha y hora válidas requeridas.'), { status: 400 });

    const auditNote = (notas && notas.trim())
        ? `${notas.trim()} [Editado por ${userLabel}]`
        : `${existing[0].notas || 'Marcación manual'} [Editado por ${userLabel}]`;

    await pool.query(
        `UPDATE rh_biometric_attendance_logs
         SET punch_time = ?, punch_type = ?, notas = ?
         WHERE id = ? AND company_id = ?`,
        [normalizedTime, punch_type || 'entrada', auditNote.slice(0, 250), punchId, companyId]
    );

    return { id: Number(punchId), success: true, message: 'Marcación manual actualizada correctamente.' };
}

async function deleteManualPunch(companyId, punchId) {
    const [existing] = await pool.query(
        `SELECT id, source, congelado FROM rh_biometric_attendance_logs
         WHERE id = ? AND company_id = ? LIMIT 1`,
        [punchId, companyId]
    );
    if (!existing.length) throw Object.assign(new Error('Marcación no encontrada.'), { status: 404 });
    if (existing[0].source !== 'manual') {
        throw Object.assign(new Error('Solo se pueden eliminar marcaciones manuales. Las marcas del reloj biométrico son inmutables.'), { status: 403 });
    }
    if (existing[0].congelado) {
        throw Object.assign(new Error('No se puede eliminar una marcación de un corte congelado.'), { status: 409 });
    }

    await pool.query('DELETE FROM rh_biometric_attendance_logs WHERE id = ? AND company_id = ?', [punchId, companyId]);
    return { success: true, message: 'Marcación manual eliminada correctamente.' };
}

async function getAttendanceLogs(companyId, query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.max(1, Math.min(200, parseInt(query.limit, 10) || 25));
    const offset = (page - 1) * limit;

    const conditions = ['l.company_id = ?'];
    const params = [companyId];

    const rawStart = query.start_date || query.startDate;
    const rawEnd = query.end_date || query.endDate;
    const { startDate, endDate } = appendPunchTimeBounds(conditions, params, 'l', rawStart, rawEnd);

    const pType = query.punch_type || query.punchType;
    const pSource = query.source;
    const dId = query.device_id || query.deviceId;

    if (pType && pType !== 'todos') {
        conditions.push('l.punch_type = ?');
        params.push(pType);
    }
    if (pSource && pSource !== 'todos') {
        if (pSource === 'biometrico' || pSource === 'reloj') {
            conditions.push("(l.source IN ('agent', 'biometric', 'biometrico', '') OR l.source IS NULL)");
        } else {
            conditions.push('l.source = ?');
            params.push(pSource);
        }
    }
    if (dId && dId !== 'todos') {
        conditions.push('l.device_id = ?');
        params.push(dId);
    }
    if (query.search && query.search.trim()) {
        const s = `%${query.search.trim()}%`;
        conditions.push('(e.nombres LIKE ? OR e.apellidos LIKE ? OR e.codigo LIKE ? OR l.device_uid LIKE ?)');
        params.push(s, s, s, s);
    }

    const whereSql = conditions.join(' AND ');

    const [[statsRow]] = await pool.query(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN l.punch_type = 'entrada' THEN 1 ELSE 0 END) as entradas_rango,
                SUM(CASE WHEN l.punch_type = 'salida' THEN 1 ELSE 0 END) as salidas_rango,
                COUNT(DISTINCT COALESCE(l.empleado_id, l.device_uid)) as empleados_activos_rango
         FROM rh_biometric_attendance_logs l
         LEFT JOIN rh_empleados e ON e.id = l.empleado_id
         WHERE ${whereSql}`,
        params
    );

    const total = Number(statsRow?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const [rows] = await pool.query(
        `SELECT l.*,
                DATE_FORMAT(l.punch_time, '%Y-%m-%d %H:%i:%s') as punch_time_str,
                e.codigo as empleado_codigo,
                e.nombres as empleado_nombres,
                e.apellidos as empleado_apellidos,
                CONCAT(COALESCE(e.nombres, ''), ' ', COALESCE(e.apellidos, '')) as empleado_nombre_completo,
                c.descripcion as cargo_nombre,
                dep.descripcion as departamento_nombre,
                d.nombre as device_nombre,
                d.ip_address as device_ip
         FROM rh_biometric_attendance_logs l
         LEFT JOIN rh_empleados e ON e.id = l.empleado_id
         LEFT JOIN rh_cargos c ON c.id = e.cargo_id
         LEFT JOIN rh_departamentos dep ON dep.id = e.departamento_personal_id
         LEFT JOIN rh_biometric_devices d ON d.id = l.device_id
         WHERE ${whereSql}
         ORDER BY l.punch_time DESC, l.id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    const normalizedRows = rows.map(r => ({
        ...r,
        punch_time: r.punch_time_str || r.punch_time
    }));

    const today = getTodayDateOnly();
    const isTodayRange = startDate === today && endDate === today;

    return {
        data: normalizedRows,
        total,
        page,
        limit,
        totalPages,
        pagination: { total, page, limit, totalPages },
        appliedRange: { startDate, endDate },
        summary: {
            total_hoy: total,
            entradas_hoy: Number(statsRow?.entradas_rango || 0),
            salidas_hoy: Number(statsRow?.salidas_rango || 0),
            empleados_activos_hoy: Number(statsRow?.empleados_activos_rango || 0),
            is_today_range: isTodayRange
        }
    };
}

module.exports = {
    ...deviceService,
    processBatchPunches,
    createManualPunch,
    updateManualPunch,
    deleteManualPunch,
    getAttendanceLogs
};
