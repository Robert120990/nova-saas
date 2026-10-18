const WebSocket = require('ws');
const crypto = require('crypto');
const pool = require('../config/db');

// Registro de agentes locales conectados por estación: Map<`${companyId}:${branchId}`, AgentInfo>
const connectedAgents = new Map();

// Registro de peticiones RPC pendientes: Map<requestId, { resolve, reject, timer }>
const pendingRequests = new Map();

const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws, req) => {
    const { companyId, branchId, remoteAddress, agentKey, boundKeys } = req.agentContext;
    const primaryKey = `${companyId}:${branchId}`;
    const keysToBind = Array.isArray(boundKeys) && boundKeys.length > 0 ? boundKeys : [primaryKey];

    // Si ya existía un socket anterior para cualquiera de las sucursales vinculadas, cerrarlo limpiamente
    for (const k of keysToBind) {
        const prev = connectedAgents.get(k);
        if (prev && prev.ws !== ws && prev.ws.readyState === WebSocket.OPEN) {
            try { prev.ws.close(1000, 'Reemplazado por nueva conexión de agente'); } catch { /* ignore */ }
        }
    }

    const agentRecord = {
        ws,
        companyId,
        branchId,
        agentKey: agentKey || '',
        boundKeys: keysToBind,
        remoteAddress,
        connectedAt: new Date().toISOString(),
        lastPing: Date.now()
    };

    for (const k of keysToBind) {
        connectedAgents.set(k, agentRecord);
    }

    console.log(`[FusionAgent] Conector conectado para [${keysToBind.join(', ')}] desde ${remoteAddress}`);

    ws.send(JSON.stringify({
        type: 'CONNECTED',
        message: 'Conectado exitosamente al servidor SaaS como Conector Fusion FFC',
        companyId,
        branchId,
        boundBranches: keysToBind
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'PONG' || data.type === 'PING') {
                agentRecord.lastPing = Date.now();
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
        for (const k of keysToBind) {
            const current = connectedAgents.get(k);
            if (current && current.ws === ws) {
                connectedAgents.delete(k);
            }
        }
        console.log(`[FusionAgent] Conector desconectado para [${keysToBind.join(', ')}]`);
    });

    ws.on('error', (err) => {
        console.warn(`[FusionAgent] Error en socket [${keysToBind.join(', ')}]:`, err.message);
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
        let companyId = parseInt(url.searchParams.get('company_id') || request.headers['x-company-id'], 10);
        let branchId = parseInt(url.searchParams.get('branch_id') || request.headers['x-branch-id'], 10);
        const providedKey = (url.searchParams.get('key') || request.headers['x-agent-key'] || '').trim();

        if (!providedKey) {
            socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
            socket.destroy();
            return;
        }

        // Buscar todas las estaciones que compartan esta clave de agente (soporta estaciones migradas de empresa/sucursal)
        const [matchingRows] = await pool.query(
            `SELECT company_id, branch_id FROM gas_station_settings
             WHERE setting_key = 'fusion_agent_key' AND setting_value = ?
             ORDER BY updated_at DESC, id DESC`,
            [providedKey]
        );

        let isValid = false;
        if (matchingRows.length > 0) {
            isValid = true;
            if (!companyId || !branchId) {
                companyId = Number(matchingRows[0].company_id);
                branchId = Number(matchingRows[0].branch_id);
            }
        } else if (companyId && branchId) {
            const validKey = await getOrGenerateAgentKey(companyId, branchId);
            isValid = (providedKey === validKey);
        }

        if (!isValid) {
            socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
            socket.destroy();
            return;
        }

        const boundKeys = Array.from(new Set([
            ...(companyId && branchId ? [`${companyId}:${branchId}`] : []),
            ...matchingRows.map(r => `${r.company_id}:${r.branch_id}`)
        ]));

        const remoteAddress = request.headers['x-forwarded-for'] || request.socket.remoteAddress || '127.0.0.1';
        request.agentContext = { companyId, branchId, remoteAddress, agentKey: providedKey, boundKeys };

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
 * Resolver un agente conectado por companyId:branchId o por clave compartida
 */
function resolveAgent(companyId, branchId, agentKey = null) {
    const key = `${companyId}:${branchId}`;
    const direct = connectedAgents.get(key);
    if (direct && direct.ws && direct.ws.readyState === WebSocket.OPEN) {
        return direct;
    }
    if (agentKey) {
        for (const candidate of connectedAgents.values()) {
            if (candidate && candidate.agentKey === agentKey && candidate.ws && candidate.ws.readyState === WebSocket.OPEN) {
                connectedAgents.set(key, candidate);
                return candidate;
            }
        }
    }
    return null;
}

/**
 * Comprobar si hay un conector de estación en línea para la sucursal
 */
function isAgentConnected(companyId, branchId, agentKey = null) {
    return Boolean(resolveAgent(companyId, branchId, agentKey));
}

/**
 * Obtener estado del conector
 */
function getAgentStatus(companyId, branchId, agentKey = null) {
    const agent = resolveAgent(companyId, branchId, agentKey);
    if (!agent) {
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
    const agent = resolveAgent(companyId, branchId);

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

function getLauncherBatContent() {
    return `@echo off\r\ntitle Conector Wayne Fusion FFC - SIPE WEB\r\ncolor 0A\r\ncd /d "%~dp0"\r\necho Conector Local Wayne Fusion FFC - SIPE WEB\r\nwhere node >nul 2>nul\r\nif %errorlevel% neq 0 ( echo [ERROR] Node.js no instalado. Descargue desde https://nodejs.org & pause & exit /b 1 )\r\nif not exist "fusion-agent.js" (\r\n    if exist "fusion-agent.js.txt" ( ren "fusion-agent.js.txt" "fusion-agent.js" )\r\n    if exist "%USERPROFILE%\\Downloads\\fusion-agent.js" ( copy /y "%USERPROFILE%\\Downloads\\fusion-agent.js" "fusion-agent.js" >nul )\r\n    if exist "%USERPROFILE%\\Descargas\\fusion-agent.js" ( copy /y "%USERPROFILE%\\Descargas\\fusion-agent.js" "fusion-agent.js" >nul )\r\n)\r\nif not exist "fusion-agent.js" (\r\n    color 0C\r\n    echo [ERROR] Falta el archivo 'fusion-agent.js' en esta carpeta: %~dp0\r\n    echo Mueva los 3 archivos descargados (fusion-agent.js, config.json, iniciar-agente.bat) a esta misma carpeta.\r\n    pause\r\n    exit /b 1\r\n)\r\nnode fusion-agent.js\r\nif %errorlevel% neq 0 pause\r\n`;
}

function getAgentScriptPath() {
    const fs = require('fs');
    const path = require('path');
    const possiblePaths = [
        path.resolve(__dirname, '../assets/fusion-agent.js'),
        path.resolve(__dirname, '../../../scripts/fusion-agent/fusion-agent.js'),
        path.resolve(process.cwd(), 'scripts/fusion-agent/fusion-agent.js'),
        path.resolve(process.cwd(), '../scripts/fusion-agent/fusion-agent.js'),
        path.resolve(__dirname, '../../scripts/fusion-agent/fusion-agent.js')
    ];
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

module.exports = {
    handleUpgrade,
    isAgentConnected,
    getAgentStatus,
    callAgent,
    getOrGenerateAgentKey,
    getLauncherBatContent,
    getAgentScriptPath
};
