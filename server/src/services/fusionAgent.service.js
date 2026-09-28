const WebSocket = require('ws');
const crypto = require('crypto');
const pool = require('../config/db');

// Registro de agentes locales conectados por estación: Map<`${companyId}:${branchId}`, AgentInfo>
const connectedAgents = new Map();

// Registro de peticiones RPC pendientes: Map<requestId, { resolve, reject, timer }>
const pendingRequests = new Map();

const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws, req) => {
    const { companyId, branchId, remoteAddress } = req.agentContext;
    const key = `${companyId}:${branchId}`;

    // Si ya existía un socket anterior para esta sucursal, cerrarlo limpiamente
    const prev = connectedAgents.get(key);
    if (prev && prev.ws !== ws && prev.ws.readyState === WebSocket.OPEN) {
        try { prev.ws.close(1000, 'Reemplazado por nueva conexión de agente'); } catch { /* ignore */ }
    }

    connectedAgents.set(key, {
        ws,
        companyId,
        branchId,
        remoteAddress,
        connectedAt: new Date().toISOString(),
        lastPing: Date.now()
    });

    console.log(`[FusionAgent] Conector conectado para Empresa #${companyId}, Estación #${branchId} desde ${remoteAddress}`);

    ws.send(JSON.stringify({
        type: 'CONNECTED',
        message: 'Conectado exitosamente al servidor SaaS como Conector Fusion FFC',
        companyId,
        branchId
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'PONG' || data.type === 'PING') {
                const agent = connectedAgents.get(key);
                if (agent) agent.lastPing = Date.now();
                if (data.type === 'PING') ws.send(JSON.stringify({ type: 'PONG' }));
                return;
            }

            if (data.type === 'FUSION_RESPONSE') {
                const pending = pendingRequests.get(data.requestId);
                if (pending) {
                    clearTimeout(pending.timer);
                    pendingRequests.delete(data.requestId);
                    if (data.success) {
                        pending.resolve(data.data);
                    } else {
                        pending.reject(new Error(data.error || 'Error reportado por el Conector Fusion local'));
                    }
                }
            }
        } catch (err) {
            console.warn('[FusionAgent] Mensaje inválido del agente:', err.message);
        }
    });

    ws.on('close', () => {
        const current = connectedAgents.get(key);
        if (current && current.ws === ws) {
            connectedAgents.delete(key);
            console.log(`[FusionAgent] Conector desconectado para Empresa #${companyId}, Estación #${branchId}`);
        }
    });

    ws.on('error', (err) => {
        console.warn(`[FusionAgent] Error en socket Empresa #${companyId}, Estación #${branchId}:`, err.message);
        try { ws.close(); } catch { /* ignore */ }
    });
});

/**
 * Obtener o generar clave de seguridad para el conector local de una estación
 */
async function getOrGenerateAgentKey(companyId, branchId) {
    const [rows] = await pool.query(
        `SELECT setting_value FROM gas_station_settings 
         WHERE company_id = ? AND branch_id = ? AND setting_key = 'fusion_agent_key'`,
        [companyId, branchId]
    );

    if (rows.length > 0 && rows[0].setting_value) {
        return rows[0].setting_value.trim();
    }

    const newKey = crypto.randomBytes(24).toString('hex');
    await pool.query(
        `INSERT INTO gas_station_settings (company_id, branch_id, setting_key, setting_value)
         VALUES (?, ?, 'fusion_agent_key', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
        [companyId, branchId, newKey]
    );
    return newKey;
}

/**
 * Manejo de la actualización HTTP -> WebSocket para /ws/fusion-agent
 */
async function handleUpgrade(request, socket, head) {
    try {
        const url = new URL(request.url, `http://${request.headers.host}`);
        const companyId = parseInt(url.searchParams.get('company_id') || request.headers['x-company-id'], 10);
        const branchId = parseInt(url.searchParams.get('branch_id') || request.headers['x-branch-id'], 10);
        const providedKey = (url.searchParams.get('key') || request.headers['x-agent-key'] || '').trim();

        if (!companyId || !branchId || !providedKey) {
            socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
            socket.destroy();
            return;
        }

        const validKey = await getOrGenerateAgentKey(companyId, branchId);
        if (providedKey !== validKey) {
            socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
            socket.destroy();
            return;
        }

        const remoteAddress = request.headers['x-forwarded-for'] || request.socket.remoteAddress || '127.0.0.1';
        request.agentContext = { companyId, branchId, remoteAddress };

        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    } catch (err) {
        console.error('[FusionAgent] Error en handshake de agente:', err);
        socket.write('HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n');
        socket.destroy();
    }
}

/**
 * Comprobar si hay un conector de estación en línea para la sucursal
 */
function isAgentConnected(companyId, branchId) {
    const key = `${companyId}:${branchId}`;
    const agent = connectedAgents.get(key);
    return Boolean(agent && agent.ws && agent.ws.readyState === WebSocket.OPEN);
}

/**
 * Obtener estado del conector
 */
function getAgentStatus(companyId, branchId) {
    const key = `${companyId}:${branchId}`;
    const agent = connectedAgents.get(key);
    if (!agent || agent.ws.readyState !== WebSocket.OPEN) {
        return { connected: false };
    }
    return {
        connected: true,
        connectedAt: agent.connectedAt,
        remoteAddress: agent.remoteAddress,
        lastPing: agent.lastPing
    };
}

/**
 * Enviar petición RPC al conector local de la estación
 */
function callAgent(companyId, branchId, action, payload, timeoutMs = 25000) {
    const key = `${companyId}:${branchId}`;
    const agent = connectedAgents.get(key);

    if (!agent || agent.ws.readyState !== WebSocket.OPEN) {
        throw new Error(`No hay ningún Conector Local conectado para la estación #${branchId}. Inicie el agente en la estación.`);
    }

    const requestId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            pendingRequests.delete(requestId);
            reject(new Error(`Tiempo agotado (${timeoutMs / 1000}s) esperando respuesta del Conector Local Fusion en la estación.`));
        }, timeoutMs);

        pendingRequests.set(requestId, { resolve, reject, timer });

        agent.ws.send(JSON.stringify({
            type: 'FUSION_REQUEST',
            requestId,
            action,
            payload
        }), (err) => {
            if (err) {
                clearTimeout(timer);
                pendingRequests.delete(requestId);
                reject(new Error(`Error enviando comando al Conector Local: ${err.message}`));
            }
        });
    });
}

module.exports = {
    handleUpgrade,
    isAgentConnected,
    getAgentStatus,
    callAgent,
    getOrGenerateAgentKey
};
