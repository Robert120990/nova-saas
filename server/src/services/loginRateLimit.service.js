/**
 * Rate-limit persistente de login (tabla login_rate_limits).
 * - Contador por (ip + username) para intentos fallidos de credenciales.
 * - Techo adicional por IP (username = '') contra fuerza bruta rotando usuarios.
 * - Los logins exitosos limpian los contadores (no consumen intentos).
 * - Bloqueos en BD: sobreviven reinicios y permiten desbloqueo administrativo.
 */
const pool = require('../config/db');

const MAX_ATTEMPTS = parseInt(process.env.LOGIN_MAX_ATTEMPTS, 10) || 10;
const IP_MAX_ATTEMPTS = parseInt(process.env.LOGIN_IP_MAX_ATTEMPTS, 10) || 30;
const WINDOW_MINUTES = parseInt(process.env.LOGIN_WINDOW_MINUTES, 10) || 15;
const PURGE_AFTER_DAYS = 2;

/** IP del cliente con la misma normalización que usa auth.controller. */
function getClientIp(req) {
    const raw = req.headers['x-client-public-ip']
        || (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim()
        || req.socket.remoteAddress
        || req.ip
        || '';
    return String(raw).replace(/^::ffff:/, '').replace(/^::1$/, '127.0.0.1');
}

/**
 * ¿Está bloqueado este (ip, username) o esta IP completa?
 * Devuelve { blocked, minutes, reason }.
 */
async function checkBlocked(ip, username) {
    const [rows] = await pool.query(
        `SELECT username, blocked_until FROM login_rate_limits
         WHERE ip = ? AND (username = ? OR username = '')
           AND blocked_until IS NOT NULL AND blocked_until > NOW()`,
        [ip, username]
    );
    if (rows.length === 0) return { blocked: false, minutes: 0, reason: null };

    const row = rows.find(r => r.username !== '') || rows[0];
    const msLeft = new Date(row.blocked_until).getTime() - Date.now();
    const minutes = Math.max(1, Math.ceil(msLeft / 60000));
    return {
        blocked: true,
        minutes,
        reason: row.username !== '' ? 'user' : 'ip'
    };
}

/** Registra un intento fallido y bloquea si corresponde. */
async function recordFailure(ip, username) {
    // Purga perezosa de registros viejos (índice idx_window_start).
    await pool.query(
        `DELETE FROM login_rate_limits WHERE window_start < DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [PURGE_AFTER_DAYS]
    );

    // Upsert del contador (ip+username): reinicia la ventana si expiró.
    await pool.query(
        `INSERT INTO login_rate_limits (ip, username, failed_attempts, window_start)
         VALUES (?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE
           failed_attempts = IF (window_start < DATE_SUB(NOW(), INTERVAL ? MINUTE), 1, failed_attempts + 1),
           window_start    = IF (window_start < DATE_SUB(NOW(), INTERVAL ? MINUTE), NOW(), window_start),
           blocked_until   = IF (window_start < DATE_SUB(NOW(), INTERVAL ? MINUTE), NULL, blocked_until)`,
        [ip, username, WINDOW_MINUTES, WINDOW_MINUTES, WINDOW_MINUTES]
    );

    // Bloqueo por usuario.
    await pool.query(
        `UPDATE login_rate_limits
         SET blocked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE)
         WHERE ip = ? AND username = ? AND failed_attempts >= ?
           AND (blocked_until IS NULL OR blocked_until < NOW())`,
        [WINDOW_MINUTES, ip, username, MAX_ATTEMPTS]
    );

    // Techo por IP (fila con username = '').
    await pool.query(
        `INSERT INTO login_rate_limits (ip, username, failed_attempts, window_start)
         VALUES (?, '', 1, NOW())
         ON DUPLICATE KEY UPDATE
           failed_attempts = IF (window_start < DATE_SUB(NOW(), INTERVAL ? MINUTE), 1, failed_attempts + 1),
           window_start    = IF (window_start < DATE_SUB(NOW(), INTERVAL ? MINUTE), NOW(), window_start)`,
        [ip, WINDOW_MINUTES, WINDOW_MINUTES]
    );
    await pool.query(
        `UPDATE login_rate_limits
         SET blocked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE)
         WHERE ip = ? AND username = '' AND failed_attempts >= ?
           AND (blocked_until IS NULL OR blocked_until < NOW())`,
        [WINDOW_MINUTES, ip, IP_MAX_ATTEMPTS]
    );
}

/** Login exitoso: limpia contadores de (ip+username) y el techo por IP. */
async function recordSuccess(ip, username) {
    await pool.query(
        `DELETE FROM login_rate_limits WHERE ip = ? AND (username = ? OR username = '')`,
        [ip, username]
    );
}

/** Desbloqueo administrativo: elimina registros por username y/o ip. */
async function unlock({ username, ip } = {}) {
    const where = [];
    const params = [];
    if (username) { where.push('username = ?'); params.push(String(username).trim().toLowerCase()); }
    if (ip) { where.push('ip = ?'); params.push(String(ip).trim()); }
    if (where.length === 0) return 0;
    const [result] = await pool.query(
        `DELETE FROM login_rate_limits WHERE ${where.join(' AND ')}`,
        params
    );
    return result.affectedRows;
}

module.exports = {
    getClientIp,
    checkBlocked,
    recordFailure,
    recordSuccess,
    unlock,
    MAX_ATTEMPTS,
    IP_MAX_ATTEMPTS,
    WINDOW_MINUTES
};
