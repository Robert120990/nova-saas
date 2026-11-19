const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { getAccess, hasPermission } = require('./eggAccess.service');
const telemetry = require('./eggTelemetry.service');
const { checkSessionStatus } = require('../middlewares/auth');
const companyClients = new Map();
const userClients = new Map();
let currentAppVersion = 'unknown';
function add(map, key, socket) {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(socket);
}
function remove(map, key, socket) {
    map.get(key)?.delete(socket);
    if (map.get(key)?.size === 0) map.delete(key);
}
function send(clients, event, data) {
    const payload = JSON.stringify({ event, data });
    for (const socket of clients || []) if (socket.readyState === WebSocket.OPEN) socket.send(payload);
}
const fusionAgent = require('./fusionAgent.service');

function initWebSocket(server, appVersion = 'unknown') {
    currentAppVersion = appVersion;
    const wss = new WebSocket.Server({ noServer: true, maxPayload: 16 * 1024, handleProtocols: () => 'sipe' });
    server.on('upgrade', async (request, socket, head) => {
        try {
            const url = new URL(request.url, `http://${request.headers.host}`);
            if (url.pathname === '/ws/fusion-agent') {
                return await fusionAgent.handleUpgrade(request, socket, head);
            }
            if (!['/ws/egg-industrial', '/ws/inventory', '/ws/notifications', '/ws/restaurant'].includes(url.pathname)) return socket.destroy();
            const protocols = String(request.headers['sec-websocket-protocol'] || '').split(',').map(p => p.trim());
            const token = protocols.find(p => p.startsWith('auth.'))?.slice(5);
            if (!token || !protocols.includes('sipe')) throw new Error('Sesión requerida.');
            const user = jwt.verify(token, process.env.JWT_SECRET);
            if (user.session_id) {
                const sessionStatus = await checkSessionStatus(user.session_id, user.id);
                if (!sessionStatus.valid) throw new Error('Sesión finalizada.');
            }
            const companyId = Number(url.searchParams.get('company_id'));
            if (!Number.isInteger(companyId) || companyId <= 0) throw new Error('Empresa inválida.');
            const access = await getAccess(user, companyId);
            if (url.pathname === '/ws/egg-industrial' && !hasPermission(access, 'view_industrial_dashboard')) throw new Error('Sin permiso de panel.');
            request.wsContext = { companyId, user, path: url.pathname };
            wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request));
        } catch {
            socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy();
        }
    });
    wss.on('connection', (ws, req) => {
        const { companyId, user, path } = req.wsContext;
        ws.sessionId = user?.session_id ? Number(user.session_id) : null;
        add(companyClients, companyId, ws);
        if (user?.id) add(userClients, Number(user.id), ws);
        const versionPayload = typeof currentAppVersion === 'object' && currentAppVersion !== null
            ? currentAppVersion
            : { version: currentAppVersion, commit: currentAppVersion };
        send([ws], 'app_version', versionPayload);
        if (path === '/ws/egg-industrial') send([ws], 'telemetry_initial', telemetry.stateFor(companyId));
        const expiry = setTimeout(() => ws.close(1008, 'Sesión expirada'), Math.min(Math.max(0, (user.exp * 1000) - Date.now()), 2147483647));
        ws.on('message', async message => {
            try {
                if (path !== '/ws/egg-industrial') return;
                const access = await getAccess(user, companyId);
                if (!hasPermission(access, 'manage_egg_telemetry_simulation')) return ws.close(1008, 'Sin permiso de simulación');
                const { event, data } = JSON.parse(message);
                send([ws], 'telemetry_update', telemetry.command(companyId, event, data));
            } catch { send([ws], 'command_error', { message: 'Comando inválido o no autorizado.' }); }
        });
        ws.on('close', () => { clearTimeout(expiry); remove(companyClients, companyId, ws); remove(userClients, Number(user.id), ws); });
        ws.on('error', () => ws.close());
    });
}
const broadcastToCompany = (companyId, event, data) => send(companyClients.get(Number(companyId)), event, data);
const sendToUser = (userId, event, data) => send(userClients.get(Number(userId)), event, data);

function hasActiveSocketForSession(userId, sessionId) {
    const clients = userClients.get(Number(userId));
    if (!clients || !sessionId) return false;
    const targetId = Number(sessionId);
    for (const socket of clients) {
        if (socket.readyState === WebSocket.OPEN && socket.sessionId === targetId) {
            return true;
        }
    }
    return false;
}

function disconnectUserSessions(userId, { excludeSessionId = null, targetSessionIds = null, payload = null } = {}) {
    const clients = userClients.get(Number(userId));
    if (!clients || clients.size === 0) return 0;

    const targets = Array.isArray(targetSessionIds) ? new Set(targetSessionIds.map(Number)) : null;
    const excluded = excludeSessionId !== null && excludeSessionId !== undefined ? Number(excludeSessionId) : null;
    const rawPayload = payload ? JSON.stringify({ event: 'session_terminated', data: payload }) : null;
    let count = 0;

    for (const socket of Array.from(clients)) {
        const matches = targets
            ? targets.has(socket.sessionId)
            : (excluded === null || socket.sessionId !== excluded);
        if (!matches) continue;

        count += 1;
        if (socket.readyState === WebSocket.OPEN) {
            if (rawPayload) {
                try {
                    socket.send(rawPayload, () => {
                        try { socket.close(4001, 'Session terminated'); } catch { /* ignore */ }
                    });
                } catch {
                    try { socket.close(4001, 'Session terminated'); } catch { /* ignore */ }
                }
            } else {
                try { socket.close(4001, 'Session terminated'); } catch { /* ignore */ }
            }
        } else {
            try { socket.close(4001, 'Session terminated'); } catch { /* ignore */ }
        }
    }
    return count;
}

function broadcastToAll(event, data) { for (const clients of companyClients.values()) send(clients, event, data); }
function setAppVersion(version) { 
    currentAppVersion = version; 
    const payload = typeof version === 'object' && version !== null ? version : { version, commit: version };
    broadcastToAll('app_version', payload); 
}
module.exports = {
    initWebSocket,
    broadcastToCompany,
    broadcastToAll,
    sendToUser,
    hasActiveSocketForSession,
    disconnectUserSessions,
    setAppVersion
};
