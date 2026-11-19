const pool = require('../config/db');
const { invalidateSessionCache, getTerminationMessage } = require('../middlewares/auth');
const websocketService = require('./websocket.service');
const loginRateLimit = require('./loginRateLimit.service');

const ACTIVE_OTHER_DEVICE_WINDOW_MINUTES = 5;

function extractDeviceId(req) {
    const raw = req?.headers?.['x-device-id'] ?? req?.body?.device_id ?? '';
    const trimmed = String(raw).trim();
    if (!trimmed) return null;
    return trimmed.slice(0, 64);
}

function extractClientIp(req) {
    if (!req || !req.headers) return '127.0.0.1';
    try {
        return loginRateLimit.getClientIp(req);
    } catch {
        const networkRaw = req.ip || req.socket?.remoteAddress || '';
        return String(networkRaw).replace(/^::ffff:/, '').replace(/^::1$/, '127.0.0.1') || '127.0.0.1';
    }
}

function parseDeviceSummary(userAgent) {
    if (!userAgent || typeof userAgent !== 'string') {
        return 'Navegador desconocido';
    }
    const ua = userAgent;

    let browser = 'Navegador';
    if (/Edg\//i.test(ua) || /Edge\//i.test(ua)) browser = 'Edge';
    else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = 'Opera';
    else if (/CriOS\//i.test(ua) || /Chrome\//i.test(ua)) browser = 'Chrome';
    else if (/FxiOS\//i.test(ua) || /Firefox\//i.test(ua)) browser = 'Firefox';
    else if (/Safari\//i.test(ua)) browser = 'Safari';
    else if (/MSIE|Trident\//i.test(ua)) browser = 'Internet Explorer';

    let os = '';
    if (/Windows/i.test(ua)) os = 'Windows';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
    else if (/Linux|X11/i.test(ua)) os = 'Linux';

    return os ? `${browser} en ${os}` : browser;
}

function formatSessionSummary(row) {
    return {
        id: row.id,
        ip_address: row.ip_address || null,
        device: parseDeviceSummary(row.user_agent),
        company_name: row.company_name || null,
        branch_name: row.branch_name || null,
        last_heartbeat: row.last_heartbeat || null,
        logged_in_at: row.logged_in_at || null
    };
}

function isRecentlyActiveSession(row) {
    if (!row) return false;
    if (websocketService.hasActiveSocketForSession(row.user_id, row.id)) {
        return true;
    }
    if (!row.last_heartbeat) return false;
    const heartbeatTs = new Date(row.last_heartbeat).getTime();
    if (Number.isNaN(heartbeatTs)) return false;
    return (Date.now() - heartbeatTs) <= ACTIVE_OTHER_DEVICE_WINDOW_MINUTES * 60 * 1000;
}

async function findActiveOtherSessions(userId, currentDeviceId, excludeSessionId = null) {
    const [rows] = await pool.query(
        `SELECT us.id, us.user_id, us.company_id, us.branch_id, us.ip_address, us.user_agent,
                us.device_id, us.logged_in_at, us.last_heartbeat,
                c.razon_social AS company_name, b.nombre AS branch_name
         FROM user_sessions us
         LEFT JOIN companies c ON us.company_id = c.id
         LEFT JOIN branches b ON us.branch_id = b.id
         WHERE us.user_id = ? AND us.is_active = 1
         ORDER BY us.last_heartbeat DESC`,
        [userId]
    );

    return rows
        .filter(row => {
            if (excludeSessionId != null && Number(row.id) === Number(excludeSessionId)) return false;
            if (currentDeviceId && row.device_id === currentDeviceId) return false;
            return isRecentlyActiveSession(row);
        })
        .map(formatSessionSummary);
}

async function revokeSessionRows(connection, sessionIds, { reason, replacedBySessionId = null }) {
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) return;
    const placeholders = sessionIds.map(() => '?').join(', ');
    await connection.query(
        `UPDATE user_sessions
         SET is_active = 0,
             terminated_reason = ?,
             terminated_at = NOW(),
             replaced_by_session_id = ?
         WHERE id IN (${placeholders})`,
        [reason, replacedBySessionId, ...sessionIds]
    );
}

async function createExclusiveSession({ userId, companyId, branchId, req, allowConcurrent = false }) {
    const ip = extractClientIp(req);
    const ua = req?.headers?.['user-agent'] ? String(req.headers['user-agent']).slice(0, 500) : null;
    const deviceId = extractDeviceId(req);

    const connection = await pool.getConnection();
    let newSessionId;
    let sameDeviceIds = [];
    let otherRevokedIds = [];
    let notableOtherSessions = [];

    try {
        await connection.beginTransaction();

        // Lock existing active session rows for this user before evaluating & replacing them.
        await connection.query(
            'SELECT id FROM user_sessions WHERE user_id = ? AND is_active = 1 FOR UPDATE',
            [userId]
        );

        const [existingRows] = await connection.query(
            `SELECT us.id, us.user_id, us.company_id, us.branch_id, us.ip_address, us.user_agent,
                    us.device_id, us.logged_in_at, us.last_heartbeat,
                    c.razon_social AS company_name, b.nombre AS branch_name
             FROM user_sessions us
             LEFT JOIN companies c ON us.company_id = c.id
             LEFT JOIN branches b ON us.branch_id = b.id
             WHERE us.user_id = ? AND us.is_active = 1
             ORDER BY us.last_heartbeat DESC`,
            [userId]
        );

        const [insertResult] = await connection.query(
            'INSERT INTO user_sessions (user_id, company_id, branch_id, ip_address, user_agent, device_id) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, companyId, branchId, ip, ua, deviceId]
        );
        newSessionId = insertResult.insertId;

        if (allowConcurrent) {
            if (deviceId) {
                sameDeviceIds = existingRows
                    .filter(row => row.device_id === deviceId)
                    .map(row => row.id);
                await revokeSessionRows(connection, sameDeviceIds, {
                    reason: 'logout',
                    replacedBySessionId: newSessionId
                });
            }
        } else {
            sameDeviceIds = existingRows
                .filter(row => Boolean(deviceId && row.device_id === deviceId))
                .map(row => row.id);

            const otherRows = existingRows.filter(row => !deviceId || row.device_id !== deviceId);
            otherRevokedIds = otherRows.map(row => row.id);
            notableOtherSessions = otherRows.filter(isRecentlyActiveSession);

            await revokeSessionRows(connection, sameDeviceIds, {
                reason: 'logout',
                replacedBySessionId: newSessionId
            });
            await revokeSessionRows(connection, otherRevokedIds, {
                reason: 'replaced_by_new_login',
                replacedBySessionId: newSessionId
            });
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    for (const id of sameDeviceIds) {
        invalidateSessionCache(id);
    }
    for (const id of otherRevokedIds) {
        invalidateSessionCache(id);
    }

    if (otherRevokedIds.length > 0) {
        websocketService.disconnectUserSessions(userId, {
            targetSessionIds: otherRevokedIds,
            payload: {
                reason: 'replaced_by_new_login',
                message: getTerminationMessage('replaced_by_new_login'),
                newDevice: parseDeviceSummary(ua),
                newIp: ip,
                at: new Date().toISOString()
            }
        });
    }

    return {
        sessionId: newSessionId,
        previousSessionClosed: notableOtherSessions.length > 0,
        closedSessionsCount: notableOtherSessions.length,
        replacedSession: notableOtherSessions.length > 0 ? formatSessionSummary(notableOtherSessions[0]) : null
    };
}

async function switchSessionContext({ sessionId, userId, companyId, branchId, req }) {
    if (!sessionId || !userId) return false;
    const deviceId = extractDeviceId(req);
    const [result] = await pool.query(
        `UPDATE user_sessions
         SET company_id = ?,
             branch_id = ?,
             last_heartbeat = NOW(),
             device_id = COALESCE(device_id, ?)
         WHERE id = ? AND user_id = ? AND is_active = 1`,
        [companyId, branchId, deviceId, sessionId, userId]
    );
    return result.affectedRows > 0;
}

async function revokeSession({ sessionId, userId = null, reason = 'logout', disconnectSocket = true }) {
    if (!sessionId) return false;

    const params = [reason, sessionId];
    let sql = `UPDATE user_sessions
               SET is_active = 0, terminated_reason = ?, terminated_at = NOW()
               WHERE id = ?`;
    if (userId) {
        sql += ' AND user_id = ?';
        params.push(userId);
    }

    const [result] = await pool.query(sql, params);
    invalidateSessionCache(sessionId);

    if (disconnectSocket && userId) {
        websocketService.disconnectUserSessions(userId, {
            targetSessionIds: [sessionId],
            payload: {
                reason,
                message: getTerminationMessage(reason),
                at: new Date().toISOString()
            }
        });
    }

    return result.affectedRows > 0;
}

module.exports = {
    extractDeviceId,
    extractClientIp,
    parseDeviceSummary,
    formatSessionSummary,
    isRecentlyActiveSession,
    findActiveOtherSessions,
    createExclusiveSession,
    switchSessionContext,
    revokeSession
};
