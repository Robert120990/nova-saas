const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { getAccess, hasPermission } = require('./eggAccess.service');
const telemetry = require('./eggTelemetry.service');
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
            if (!['/ws/egg-industrial', '/ws/inventory', '/ws/notifications'].includes(url.pathname)) return socket.destroy();
            const protocols = String(request.headers['sec-websocket-protocol'] || '').split(',').map(p => p.trim());
            const token = protocols.find(p => p.startsWith('auth.'))?.slice(5);
            if (!token || !protocols.includes('sipe')) throw new Error('Sesión requerida.');
            const user = jwt.verify(token, process.env.JWT_SECRET);
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
        add(companyClients, companyId, ws);
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
function broadcastToAll(event, data) { for (const clients of companyClients.values()) send(clients, event, data); }
function setAppVersion(version) { 
    currentAppVersion = version; 
    const payload = typeof version === 'object' && version !== null ? version : { version, commit: version };
    broadcastToAll('app_version', payload); 
}
module.exports = { initWebSocket, broadcastToCompany, broadcastToAll, sendToUser, setAppVersion };
