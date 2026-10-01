const pool = require('../config/db');
const crypto = require('crypto');

/**
 * Servicio de Control de Marcador Digital Biométrico (ZKTeco) en Recursos Humanos
 */

const PUNCH_TYPE_MAP = { 0: 'entrada', 1: 'salida', 2: 'salida_almuerzo', 3: 'entrada_almuerzo', 4: 'horas_extra_entrada', 5: 'horas_extra_salida' };
const VERIFY_TYPE_MAP = { 0: 'Contraseña', 1: 'Huella Digital', 2: 'Tarjeta RFID', 3: 'Contraseña', 4: 'Rostro / Facial', 15: 'Rostro / Facial' };

/**
 * Obtener dispositivos configurados por empresa
 */
async function getDevices(companyId) {
    const [rows] = await pool.query(
        `SELECT d.*, b.nombre as branch_name,
                (CASE WHEN d.last_seen >= NOW() - INTERVAL 90 SECOND THEN 1 ELSE 0 END) as is_online,
                (SELECT COUNT(*) FROM rh_biometric_attendance_logs WHERE device_id = d.id) as total_punches
         FROM rh_biometric_devices d
         LEFT JOIN branches b ON b.id = d.branch_id
         WHERE d.company_id = ?
         ORDER BY d.id ASC`,
        [companyId]
    );
    return rows;
}

/**
 * Crear o actualizar dispositivo
 */
async function saveDevice(companyId, data) {
    const { id, branch_id, nombre, ip_address, port, comm_key, protocol, is_active } = data;
    const ip = (ip_address || '192.168.3.201').trim();
    const tcpPort = parseInt(port, 10) || 4370;
    const keyComm = parseInt(comm_key, 10) || 0;
    const proto = protocol === 'udp' ? 'udp' : 'tcp';
    const active = is_active === false || is_active === 0 ? 0 : 1;

    if (id) {
        await pool.query(
            `UPDATE rh_biometric_devices
             SET branch_id = ?, nombre = ?, ip_address = ?, port = ?, comm_key = ?, protocol = ?, is_active = ?
             WHERE id = ? AND company_id = ?`,
            [branch_id || null, nombre || 'Marcador Digital ZKTeco', ip, tcpPort, keyComm, proto, active, id, companyId]
        );
        const [updated] = await pool.query('SELECT * FROM rh_biometric_devices WHERE id = ?', [id]);
        return updated[0];
    } else {
        const agentKey = crypto.randomBytes(24).toString('hex');
        const [res] = await pool.query(
            `INSERT INTO rh_biometric_devices
             (company_id, branch_id, nombre, ip_address, port, comm_key, protocol, agent_key, is_active, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'offline')`,
            [companyId, branch_id || null, nombre || 'Marcador Digital ZKTeco', ip, tcpPort, keyComm, proto, agentKey, active]
        );
        const [created] = await pool.query('SELECT * FROM rh_biometric_devices WHERE id = ?', [res.insertId]);
        return created[0];
    }
}

/**
 * Regenerar Clave de Agente
 */
async function regenerateAgentKey(companyId, deviceId) {
    const newKey = crypto.randomBytes(24).toString('hex');
    await pool.query(
        `UPDATE rh_biometric_devices SET agent_key = ? WHERE id = ? AND company_id = ?`,
        [newKey, deviceId, companyId]
    );
    return newKey;
}

/**
 * Obtener dispositivo por clave de conector local (para autenticar peticiones del agente)
 */
async function getDeviceByAgentKey(agentKey) {
    if (!agentKey) return null;
    const [rows] = await pool.query(
        `SELECT d.*, c.nombre_comercial as company_name
         FROM rh_biometric_devices d
         JOIN companies c ON c.id = d.company_id
         WHERE d.agent_key = ? AND d.is_active = 1
         LIMIT 1`,
        [agentKey.trim()]
    );
    return rows.length ? rows[0] : null;
}

/**
 * Actualizar estado y latido (heartbeat) desde el conector
 */
async function updateDeviceHeartbeat(deviceId, deviceInfo = null, status = 'online') {
    const infoJson = deviceInfo ? JSON.stringify(deviceInfo) : null;
    await pool.query(
        `UPDATE rh_biometric_devices
         SET status = ?, last_seen = NOW(), device_info = COALESCE(?, device_info)
         WHERE id = ?`,
        [status, infoJson, deviceId]
    );
}

/**
 * Guardar lote de marcaciones (desde el agente o sincronización)
 */
async function processBatchPunches(companyId, deviceId, punches = []) {
    if (!Array.isArray(punches) || punches.length === 0) {
        return { totalReceived: 0, insertedCount: 0 };
    }

    // Cache de mapeo de empleados en memoria para velocidad
    const [employees] = await pool.query(
        `SELECT id, codigo, codigo_biometrico, CONCAT(nombres, ' ', apellidos) as nombre_completo
         FROM rh_empleados
         WHERE company_id = ?`,
        [companyId]
    );

    const empMap = new Map();
    for (const emp of employees) {
        if (emp.codigo_biometrico) empMap.set(String(emp.codigo_biometrico).trim().toLowerCase(), emp.id);
        if (emp.codigo) {
            empMap.set(String(emp.codigo).trim().toLowerCase(), emp.id);
            // También normalizado sin ceros iniciales
            const num = String(emp.codigo).replace(/^0+/, '');
            if (num) empMap.set(num.toLowerCase(), emp.id);
        }
        empMap.set(String(emp.id), emp.id);
    }

    let insertedCount = 0;
    const values = [];

    for (const p of punches) {
        const uid = String(p.device_uid || p.user_id || p.userId || p.uid || '').trim();
        if (!uid) continue;

        let punchTimeStr = p.punch_time || p.record_time || p.timestamp || p.time;
        if (!punchTimeStr) continue;

        // Normalizar fecha
        const dateObj = new Date(punchTimeStr);
        if (isNaN(dateObj.getTime())) continue;
        const normalizedTime = dateObj.toISOString().slice(0, 19).replace('T', ' ');

        // Resolver empleado
        const cleanUid = uid.toLowerCase();
        const cleanUidNoZero = cleanUid.replace(/^0+/, '');
        const empleadoId = empMap.get(cleanUid) || (cleanUidNoZero ? empMap.get(cleanUidNoZero) : null) || null;

        const punchCode = typeof p.punch_code === 'number' ? p.punch_code : (typeof p.punch === 'number' ? p.punch : (typeof p.state === 'number' ? p.state : 0));
        let punchType = p.punch_type || (p.punch_code !== undefined && p.punch_code > 0 ? PUNCH_TYPE_MAP[punchCode] : null);
        const timePart = normalizedTime.slice(11, 19);
        if (!punchType) {
            if (timePart >= '15:00:00') {
                punchType = 'salida';
            } else if (timePart >= '11:30:00' && timePart < '13:00:00') {
                punchType = 'salida_almuerzo';
            } else if (timePart >= '13:00:00' && timePart < '14:30:00') {
                punchType = 'entrada_almuerzo';
            } else {
                punchType = 'entrada';
            }
        }

        const verifyType = typeof p.verify_type === 'number' ? p.verify_type : (typeof p.verifyType === 'number' ? p.verifyType : 1);
        const verifyLabel = p.verify_label || VERIFY_TYPE_MAP[verifyType] || 'Huella Digital';

        const source = p.source || 'agent';
        const rawJson = p.raw_data ? JSON.stringify(p.raw_data) : JSON.stringify(p);

        values.push([
            companyId,
            deviceId || null,
            uid,
            empleadoId,
            normalizedTime,
            punchType,
            punchCode,
            verifyType,
            verifyLabel,
            source,
            rawJson
        ]);
    }

    if (values.length > 0) {
        // Inserción en bloques con INSERT IGNORE para omitir duplicados
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
            `UPDATE rh_biometric_devices
             SET last_sync = NOW(), last_seen = NOW(), status = 'online'
             WHERE id = ?`,
            [deviceId]
        );
    }

    return { totalReceived: punches.length, insertedCount };
}

/**
 * Registrar Marcación Manual
 */
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
    const dateObj = new Date(punch_time);
    const normalizedTime = isNaN(dateObj.getTime()) ? punch_time : dateObj.toISOString().slice(0, 19).replace('T', ' ');

    const [res] = await pool.query(
        `INSERT INTO rh_biometric_attendance_logs
         (company_id, device_id, device_uid, empleado_id, punch_time, punch_type, punch_code, verify_type, verify_label, source, notas)
         VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'Registro Manual', 'manual', ?)`,
        [companyId, device_id || null, uid, empleado_id, normalizedTime, punch_type || 'entrada', notas || 'Marcación manual por RH']
    );

    return { id: res.insertId, success: true };
}

/**
 * Listado de Marcaciones con Paginación y Filtros
 */
async function getAttendanceLogs(companyId, query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.max(1, Math.min(200, parseInt(query.limit, 10) || 25));
    const offset = (page - 1) * limit;

    const conditions = ['l.company_id = ?'];
    const params = [companyId];

    const sDate = query.start_date || query.startDate;
    const eDate = query.end_date || query.endDate;
    const pType = query.punch_type || query.punchType;
    const pSource = query.source;
    const dId = query.device_id || query.deviceId;

    if (sDate) {
        conditions.push('DATE(l.punch_time) >= ?');
        params.push(sDate);
    }
    if (eDate) {
        conditions.push('DATE(l.punch_time) <= ?');
        params.push(eDate);
    }
    if (pType && pType !== 'todos') {
        conditions.push('l.punch_type = ?');
        params.push(pType);
    }
    if (pSource && pSource !== 'todos') {
        conditions.push('l.source = ?');
        params.push(pSource);
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

    // Conteo total
    const [countRes] = await pool.query(
        `SELECT COUNT(*) as total
         FROM rh_biometric_attendance_logs l
         LEFT JOIN rh_empleados e ON e.id = l.empleado_id
         WHERE ${whereSql}`,
        params
    );
    const total = countRes[0].total;

    // Registros
    const [rows] = await pool.query(
        `SELECT l.*,
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

    // Resumen del día de hoy
    const [todaySummary] = await pool.query(
        `SELECT
            COUNT(*) as total_hoy,
            SUM(CASE WHEN punch_type = 'entrada' THEN 1 ELSE 0 END) as entradas_hoy,
            SUM(CASE WHEN punch_type = 'salida' THEN 1 ELSE 0 END) as salidas_hoy,
            COUNT(DISTINCT empleado_id) as empleados_activos_hoy
         FROM rh_biometric_attendance_logs
         WHERE company_id = ? AND DATE(punch_time) = CURDATE()`,
        [companyId]
    );

    return {
        data: rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        summary: todaySummary[0] || { total_hoy: 0, entradas_hoy: 0, salidas_hoy: 0, empleados_activos_hoy: 0 }
    };
}

module.exports = {
    getDevices,
    saveDevice,
    regenerateAgentKey,
    getDeviceByAgentKey,
    updateDeviceHeartbeat,
    processBatchPunches,
    createManualPunch,
    getAttendanceLogs
};
