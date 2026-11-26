const crypto = require('crypto');
const pool = require('../config/db');
const clockUsersService = require('./rhBiometricClockUsers.service');
const updaterService = require('./rhBiometricUpdater.service');

const { parseJsonSafe } = clockUsersService;

async function getDevices(companyId) {
    const [rows] = await pool.query(
        `SELECT d.*, b.nombre as branch_name,
                (CASE WHEN d.last_seen >= NOW() - INTERVAL 90 SECOND THEN 1 ELSE 0 END) as is_online,
                (CASE WHEN d.last_seen >= NOW() - INTERVAL 90 SECOND
                       AND (d.last_sync IS NULL OR d.last_sync < NOW() - INTERVAL 24 HOUR)
                      THEN 1 ELSE 0 END) as is_sync_stale,
                (SELECT COUNT(*) FROM rh_biometric_attendance_logs
                 WHERE device_id = d.id AND punch_time >= '2018-01-01 00:00:00'
                   AND punch_time <= DATE_ADD(NOW(), INTERVAL 1 DAY)) as total_punches,
                (SELECT COUNT(*) FROM rh_biometric_attendance_logs
                 WHERE device_id = d.id AND (punch_time < '2018-01-01 00:00:00'
                   OR punch_time > DATE_ADD(NOW(), INTERVAL 1 DAY))) as invalid_date_punches,
                (SELECT DATE_FORMAT(MAX(punch_time), '%Y-%m-%d %H:%i:%s') FROM rh_biometric_attendance_logs
                 WHERE device_id = d.id AND punch_time >= '2018-01-01 00:00:00'
                   AND punch_time <= DATE_ADD(NOW(), INTERVAL 1 DAY)) as last_valid_punch_time
         FROM rh_biometric_devices d
         LEFT JOIN branches b ON b.id = d.branch_id
         WHERE d.company_id = ?
         ORDER BY d.id ASC`,
        [companyId]
    );

    return rows.map(d => {
        const info = parseJsonSafe(d.device_info);
        const logCounts = Number(info.log_counts || info.last_sync_logs || 0);
        const logCapacity = Number(info.log_capacity || 100000);
        const memoryPct = logCapacity > 0 ? Math.min(100, parseFloat(((logCounts / logCapacity) * 100).toFixed(1))) : 0;
        const compat = updaterService.evaluateDeviceCompatibility(d, info);
        const updatePolicy = info.update_policy === 'prompt' ? 'prompt' : 'auto';
        const pendingUpdate = info.pending_update_request || null;

        return {
            ...d,
            device_info: info,
            memory_pct: memoryPct,
            log_counts: logCounts,
            log_capacity: logCapacity,
            user_counts: Number(info.user_counts || (Array.isArray(info.users) ? info.users.length : 0)),
            agent_version: compat.installed_version,
            latest_agent_version: compat.latest_version,
            is_outdated_agent: compat.is_outdated,
            supports_remote_update: compat.supports_remote_update,
            update_policy: updatePolicy,
            update_requested: !!pendingUpdate,
            update_status: info.update_status || (pendingUpdate ? 'pending' : 'idle'),
            update_error: info.update_error || null,
            compatibility: compat,
            last_sync_error: info.last_sync_error || null,
            clock_drift_seconds: info.clock_drift_seconds ?? null,
            device_time: info.device_time || null
        };
    });
}

async function saveDevice(companyId, data) {
    const { id, branch_id, nombre, ip_address, port, comm_key, protocol, is_active } = data;
    const ip = String(ip_address || '').trim();
    if (!ip) {
        const err = new Error('Debe ingresar la dirección IP del reloj biométrico.');
        err.status = 400;
        throw err;
    }
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
    }

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

async function regenerateAgentKey(companyId, deviceId) {
    const newKey = crypto.randomBytes(24).toString('hex');
    await pool.query(
        `UPDATE rh_biometric_devices SET agent_key = ? WHERE id = ? AND company_id = ?`,
        [newKey, deviceId, companyId]
    );
    return newKey;
}

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

async function updateDeviceHeartbeat(deviceId, deviceInfo = null, status = 'online') {
    const [rows] = await pool.query('SELECT device_info FROM rh_biometric_devices WHERE id = ? LIMIT 1', [deviceId]);
    const current = parseJsonSafe(rows[0]?.device_info);
    let merged = current;

    if (deviceInfo && typeof deviceInfo === 'object') {
        merged = { ...current, ...deviceInfo };
        if (deviceInfo.clear_sync_error) {
            delete merged.last_sync_error;
            delete merged.clear_sync_error;
        }
        // Si el agente ya arrancó en la versión objetivo o reportó actualización completada, limpiar solicitud pendiente
        const targetVer = merged.pending_update_request?.target_version;
        if (deviceInfo.update_status === 'updated' || (targetVer && deviceInfo.agent_version && updaterService.compareSemver(deviceInfo.agent_version, targetVer) >= 0)) {
            delete merged.pending_update_request;
            merged.update_status = 'updated';
            merged.last_updated_at = new Date().toISOString();
            delete merged.update_error;
        }
    }

    await pool.query(
        `UPDATE rh_biometric_devices
         SET status = ?, last_seen = NOW(), device_info = ?
         WHERE id = ?`,
        [status, JSON.stringify(merged), deviceId]
    );
    return merged;
}

async function getDeviceLastPunch(deviceId, companyId) {
    const [rows] = await pool.query(
        `SELECT DATE_FORMAT(MAX(punch_time), '%Y-%m-%d %H:%i:%s') as last_punch_time, COUNT(*) as total_logs
         FROM rh_biometric_attendance_logs
         WHERE device_id = ? AND company_id = ?
           AND punch_time >= '2018-01-01 00:00:00'
           AND punch_time <= DATE_ADD(NOW(), INTERVAL 1 DAY)`,
        [deviceId, companyId]
    );
    return {
        last_punch_time: rows[0]?.last_punch_time || null,
        total_logs: rows[0]?.total_logs || 0
    };
}

async function cleanupInvalidDates(companyId) {
    const [res] = await pool.query(
        `DELETE FROM rh_biometric_attendance_logs
         WHERE company_id = ?
           AND congelado = 0
           AND (punch_time < '2018-01-01 00:00:00' OR punch_time > DATE_ADD(NOW(), INTERVAL 1 DAY))`,
        [companyId]
    );
    return {
        success: true,
        deletedCount: res.affectedRows || 0,
        message: `Limpieza completada: ${res.affectedRows || 0} registros con fechas CMOS corruptas eliminados.`
    };
}

module.exports = {
    getLatestAgentMetadata: updaterService.getAgentReleaseManifest,
    getDevices,
    saveDevice,
    regenerateAgentKey,
    getDeviceByAgentKey,
    updateDeviceHeartbeat,
    getDeviceLastPunch,
    cleanupInvalidDates,
    getClockUsersComparison: clockUsersService.getClockUsersComparison,
    linkClockUserToEmployee: clockUsersService.linkClockUserToEmployee,
    setDeviceUpdatePolicy: updaterService.setDeviceUpdatePolicy,
    requestRemoteDeviceUpdate: updaterService.requestRemoteDeviceUpdate,
    buildOneClickUpdaterBat: updaterService.buildOneClickUpdaterBat,
    evaluateDeviceCompatibility: updaterService.evaluateDeviceCompatibility,
    resolveBestServerUrl: updaterService.resolveBestServerUrl
};
