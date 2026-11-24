const pool = require('../config/db');

function parseJsonSafe(val) {
    if (!val) return {};
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch { return {}; }
}

/**
 * Auditoría de usuarios del reloj ZKTeco vs empleados en NovaSaaS.
 * Combina el catálogo reportado por el conector (device_info.users) + actividad reciente en logs.
 */
async function getClockUsersComparison(companyId) {
    const [devices] = await pool.query(
        'SELECT id, nombre, device_info FROM rh_biometric_devices WHERE company_id = ? ORDER BY id ASC',
        [companyId]
    );
    const [employees] = await pool.query(
        `SELECT e.id, e.codigo, e.codigo_biometrico, e.es_activo,
                CONCAT(COALESCE(e.nombres, ''), ' ', COALESCE(e.apellidos, '')) as nombre_completo,
                c.descripcion as cargo_nombre, dep.descripcion as departamento_nombre
         FROM rh_empleados e
         LEFT JOIN rh_cargos c ON c.id = e.cargo_id
         LEFT JOIN rh_departamentos dep ON dep.id = e.departamento_personal_id
         WHERE e.company_id = ?
         ORDER BY e.es_activo DESC, e.nombres ASC`,
        [companyId]
    );

    const [recentStats] = await pool.query(
        `SELECT device_uid, COUNT(*) as total_punches_90d,
                DATE_FORMAT(MAX(punch_time), '%Y-%m-%d %H:%i:%s') as last_punch
         FROM rh_biometric_attendance_logs
         WHERE company_id = ?
           AND punch_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)
           AND punch_time <= DATE_ADD(NOW(), INTERVAL 1 DAY)
         GROUP BY device_uid`,
        [companyId]
    );

    const statByUid = new Map(recentStats.map(s => [String(s.device_uid).trim(), s]));
    const empByBio = new Map();
    for (const e of employees) {
        if (!e.codigo_biometrico) continue;
        const k = String(e.codigo_biometrico).trim();
        empByBio.set(k, e);
        const noZero = k.replace(/^0+/, '');
        if (noZero) empByBio.set(noZero, e);
    }

    const uidMap = new Map();
    for (const dev of devices) {
        const info = parseJsonSafe(dev.device_info);
        if (!Array.isArray(info.users)) continue;
        for (const u of info.users) {
            const uid = String(u.userId ?? u.uid ?? '').trim();
            if (!uid) continue;
            uidMap.set(uid, {
                device_uid: uid,
                clock_name: (u.name || '').trim(),
                role: u.role ?? 0,
                device_name: dev.nombre
            });
        }
    }

    for (const s of recentStats) {
        const uid = String(s.device_uid).trim();
        if (!uidMap.has(uid)) {
            uidMap.set(uid, {
                device_uid: uid,
                clock_name: '',
                role: 0,
                device_name: devices[0]?.nombre || 'Reloj ZKTeco'
            });
        }
    }

    const clockUsers = Array.from(uidMap.values())
        .map(u => {
            const cleanNoZero = u.device_uid.replace(/^0+/, '');
            const matched = empByBio.get(u.device_uid) || (cleanNoZero ? empByBio.get(cleanNoZero) : null) || null;
            const st = statByUid.get(u.device_uid);
            return {
                ...u,
                punches_90d: Number(st?.total_punches_90d || 0),
                last_punch: st?.last_punch || null,
                empleado_id: matched?.id || null,
                empleado_nombre: matched?.nombre_completo?.trim() || null,
                empleado_codigo: matched?.codigo || null,
                empleado_activo: matched ? !!matched.es_activo : null,
                departamento: matched?.departamento_nombre || null
            };
        })
        .sort((a, b) => (Number(a.device_uid) || 999999) - (Number(b.device_uid) || 999999));

    return {
        clockUsers,
        employees: employees.map(e => ({
            id: e.id,
            codigo: e.codigo,
            codigo_biometrico: e.codigo_biometrico,
            nombre_completo: (e.nombre_completo || '').trim(),
            es_activo: !!e.es_activo,
            cargo_nombre: e.cargo_nombre || '',
            departamento_nombre: e.departamento_nombre || ''
        })),
        summary: {
            total_clock_users: clockUsers.length,
            linked_count: clockUsers.filter(u => u.empleado_id).length,
            unlinked_active_punches: clockUsers.filter(u => !u.empleado_id && u.punches_90d > 0).length,
            employees_without_bio: employees.filter(e => e.es_activo && !e.codigo_biometrico).length
        }
    };
}

/**
 * Vincula un UID del reloj biométrico con un empleado de NovaSaaS y opcionalmente reasigna sus marcaciones.
 */
async function linkClockUserToEmployee(companyId, { empleado_id, codigo_biometrico, reattribute_logs = true }) {
    const bioCode = codigo_biometrico !== null && codigo_biometrico !== undefined
        ? String(codigo_biometrico).trim()
        : '';

    if (!empleado_id) throw Object.assign(new Error('Debe seleccionar un empleado.'), { status: 400 });

    const [empRows] = await pool.query(
        'SELECT id, nombres, apellidos FROM rh_empleados WHERE id = ? AND company_id = ?',
        [empleado_id, companyId]
    );
    if (!empRows.length) throw Object.assign(new Error('Empleado no encontrado.'), { status: 404 });

    if (bioCode) {
        await pool.query(
            'UPDATE rh_empleados SET codigo_biometrico = NULL WHERE company_id = ? AND codigo_biometrico = ? AND id != ?',
            [companyId, bioCode, empleado_id]
        );
    }

    await pool.query(
        'UPDATE rh_empleados SET codigo_biometrico = ? WHERE id = ? AND company_id = ?',
        [bioCode || null, empleado_id, companyId]
    );

    let reattributedCount = 0;
    if (reattribute_logs && bioCode) {
        const [upd] = await pool.query(
            `UPDATE rh_biometric_attendance_logs
             SET empleado_id = ?
             WHERE company_id = ? AND device_uid = ? AND congelado = 0`,
            [empleado_id, companyId, bioCode]
        );
        reattributedCount = upd.affectedRows || 0;
    }

    return {
        success: true,
        message: bioCode
            ? `UID ${bioCode} vinculado a ${empRows[0].nombres} ${empRows[0].apellidos} (${reattributedCount} marcaciones actualizadas).`
            : `Código biométrico desvinculado de ${empRows[0].nombres} ${empRows[0].apellidos}.`,
        reattributedCount
    };
}

module.exports = {
    parseJsonSafe,
    getClockUsersComparison,
    linkClockUserToEmployee
};
