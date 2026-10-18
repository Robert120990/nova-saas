/**
 * ============================================================================
 * CONECTOR LOCAL DE ESTACIÓN - WAYNE FUSION FFC (NOVASAAS SIPE WEB)
 * ============================================================================
 * Este script se ejecuta en una computadora dentro de la red local de la estación
 * de servicio (con acceso a https://10.19.4.15). Se conecta al servidor SaaS en la
 * nube (sys.sipesv.com) vía WebSocket seguro para actuar como puente y extraer
 * automáticamente las lecturas de los turnos cerrados sin necesidad de abrir puertos
 * ni tener IP pública en el router.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Cargar configuración local (soportando posible extensión oculta .txt en Windows)
const possibleConfigPaths = [
    path.join(__dirname, 'config.json'),
    path.join(__dirname, 'config.json.txt'),
    path.join(process.cwd(), 'config.json'),
    path.join(process.cwd(), 'config.json.txt')
];
let configLoadedFrom = null;

let config = {
    serverUrl: 'https://sys.sipesv.com',
    companyId: 1,
    branchId: 7,
    agentKey: '',
    fusionHost: 'https://10.19.4.15',
    fusionUser: 'manager',
    fusionPassword: ''
};

for (const p of possibleConfigPaths) {
    if (fs.existsSync(p)) {
        try {
            const raw = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''); // Remover BOM si existe
            const loaded = JSON.parse(raw);
            config = { ...config, ...loaded };
            configLoadedFrom = p;
            break;
        } catch (e) {
            console.error(`[ADVERTENCIA] Error leyendo ${path.basename(p)}:`, e.message);
        }
    }
}

// Soporte de argumentos de línea de comandos: --server, --company, --branch, --key, --host, --user, --pass
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--server' && args[i + 1]) config.serverUrl = args[++i];
    if (args[i] === '--company' && args[i + 1]) config.companyId = parseInt(args[++i], 10);
    if (args[i] === '--branch' && args[i + 1]) config.branchId = parseInt(args[++i], 10);
    if (args[i] === '--key' && args[i + 1]) config.agentKey = args[++i];
    if (args[i] === '--host' && args[i + 1]) config.fusionHost = args[++i];
    if (args[i] === '--user') config.fusionUser = (args[i + 1] !== undefined && !args[i + 1].startsWith('--')) ? args[++i] : '';
    if (args[i] === '--pass') config.fusionPassword = (args[i + 1] !== undefined && !args[i + 1].startsWith('--')) ? args[++i] : '';
}

const WSClass = typeof WebSocket !== 'undefined' ? WebSocket : (() => {
    try { return require('ws'); } catch { return null; }
})();

if (!WSClass) {
    console.error('[ERROR FATAL] WebSocket no disponible. Requiere Node.js v21+ o instalar ws: npm install ws');
    process.exit(1);
}

function log(msg) {
    const time = new Date().toLocaleTimeString('es-SV', { hour12: false });
    console.log(`[${time}] ${msg}`);
}

function sanitizeHost(raw) {
    if (!raw) return 'https://10.19.4.15';
    let h = String(raw).trim();
    if (!h.startsWith('http://') && !h.startsWith('https://')) h = `https://${h}`;
    try {
        const u = new URL(h);
        return `${u.protocol}//${u.host}`;
    } catch {
        return h;
    }
}

// Helper para peticiones HTTP/HTTPS directas al controlador Wayne Fusion local (ignora SSL autofirmado y admite TLS legado)
function ffcRequest(urlStr, options = {}, body = null) {
    return new Promise((resolve, reject) => {
        try {
            const url = new URL(urlStr);
            const isHttps = url.protocol === 'https:';
            const client = isHttps ? https : http;
            const reqOptions = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: options.method || 'GET',
                headers: Object.assign({ 'Content-Type': 'application/json' }, options.headers || {}),
                timeout: options.timeout || 15000
            };

            if (isHttps) {
                reqOptions.rejectUnauthorized = false;
                reqOptions.minVersion = 'TLSv1';
                reqOptions.ciphers = 'DEFAULT:@SECLEVEL=0';
            }

            const req = client.request(reqOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    let parsed = data;
                    try { parsed = JSON.parse(data); } catch { /* ignore */ }
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ status: res.statusCode, headers: res.headers, data: parsed });
                    } else {
                        const err = new Error(parsed?.message || `Fusion status ${res.statusCode}`);
                        err.status = res.statusCode;
                        err.data = parsed;
                        reject(err);
                    }
                });
            });

            req.on('error', (err) => {
                const isConn = ['ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENOTFOUND'].includes(err.code);
                const msg = isConn ? `No se pudo conectar con Fusion (${url.hostname}). Verifique la red local.` : `Error de red con Fusion: ${err.message}`;
                const error = new Error(msg);
                error.originalError = err;
                reject(error);
            });

            req.on('timeout', () => req.destroy(new Error(`Tiempo agotado conectando con Fusion (${url.hostname}).`)));
            if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
            req.end();
        } catch (e) {
            reject(e);
        }
    });
}

let cachedToken = null;
let tokenExpiresAt = 0;

async function getFusionToken(host, username, password, forceNew = false) {
    const now = Date.now();
    if (!forceNew && cachedToken && tokenExpiresAt > now + 60000) return cachedToken;

    const baseHost = sanitizeHost(host);
    const uName = (username !== undefined && username !== null) ? String(username).trim() : '';
    const pwd = (password !== undefined && password !== null) ? String(password).trim() : '';

    const tryLogin = async (u, p) => {
        const res = await ffcRequest(`${baseHost}/fusion/login`, { method: 'POST' }, {
            userName: u,
            username: u,
            password: p
        });
        return res.data?.accessToken;
    };

    try {
        const token = await tryLogin(uName, pwd);
        if (!token) throw new Error('Autenticación en Fusion no devolvió accessToken');
        cachedToken = token;
        tokenExpiresAt = now + (15 * 60 * 1000);
        return token;
    } catch (err) {
        if (err.status === 401 || err.status === 403) {
            const variants = [
                { u: uName.toLowerCase(), p: pwd },
                { u: uName.toUpperCase(), p: pwd },
                { u: uName, p: pwd.toLowerCase() },
                { u: uName, p: pwd.toUpperCase() },
                { u: uName.toLowerCase(), p: pwd.toUpperCase() },
                { u: uName.toUpperCase(), p: pwd.toLowerCase() },
                { u: uName.toLowerCase(), p: pwd.toLowerCase() },
                { u: uName.toUpperCase(), p: pwd.toUpperCase() }
            ];
            for (const v of variants) {
                if (v.u === uName && v.p === pwd) continue;
                try {
                    const token = await tryLogin(v.u, v.p);
                    if (token) {
                        cachedToken = token;
                        tokenExpiresAt = now + (15 * 60 * 1000);
                        return token;
                    }
                } catch {
                    // seguir probando
                }
            }
        }
        throw err;
    }
}

async function ffcAuthedRequest(endpoint, host, username, password, method = 'GET', body = null) {
    const baseHost = sanitizeHost(host);
    let token = null;
    try {
        token = await getFusionToken(baseHost, username, password);
    } catch (err) {
        if (!username && !password) {
            log(`[Fusion] Sin credenciales: intentando petición directa a ${endpoint}`);
        } else {
            throw err;
        }
    }
    const headers = token ? { Authorization: token } : {};
    try {
        return await ffcRequest(`${baseHost}${endpoint}`, { method, headers }, body);
    } catch (err) {
        if (token && (err.status === 401 || err.status === 403)) {
            token = await getFusionToken(baseHost, username, password, true);
            return await ffcRequest(`${baseHost}${endpoint}`, { method, headers: { Authorization: token } }, body);
        }
        throw err;
    }
}

const fmtD = (d) => (!d || d.length !== 8 ? '' : `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`);
const fmtT = (t) => (!t || t.length !== 6 ? '' : `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`);
const fmtDT = (d, t) => {
    if (!d || d.length !== 8) return '';
    const time = t && t.length === 6 ? `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}` : '00:00:00';
    return `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)} ${time}`;
};

// Implementación de operaciones locales sobre Fusion FFC
async function handleAction(action, payload) {
    const host = payload?.config?.host || config.fusionHost;
    const user = payload?.config?.username !== undefined ? payload.config.username : config.fusionUser;
    const pass = payload?.config?.password !== undefined ? payload.config.password : config.fusionPassword;

    if (action === 'updateAgent') {
        const targetDir = configLoadedFrom ? path.dirname(configLoadedFrom) : __dirname;
        if (payload?.newConfig && typeof payload.newConfig === 'object') {
            config = { ...config, ...payload.newConfig };
            const cfgPath = configLoadedFrom || path.join(targetDir, 'config.json');
            fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), 'utf8');
            log(`[AutoUpdate] Archivo config.json actualizado (Empresa #${config.companyId}, Estación #${config.branchId})`);
        }
        if (payload?.newScript && typeof payload.newScript === 'string' && payload.newScript.includes('startAgent')) {
            const scriptPath = path.join(targetDir, 'fusion-agent.js');
            fs.writeFileSync(scriptPath, payload.newScript, 'utf8');
            log('[AutoUpdate] Archivo fusion-agent.js actualizado desde la nube.');
        }
        return {
            success: true,
            companyId: config.companyId,
            branchId: config.branchId,
            updatedAt: new Date().toISOString()
        };
    }

    if (action === 'testConnection') {
        try {
            const token = await getFusionToken(host, user, pass, true);
            return { success: true, host, token: token ? 'OK' : 'FAIL' };
        } catch (err) {
            if (!user && !pass) {
                try {
                    await ffcRequest(`${sanitizeHost(host)}/fusion/period/list/shift`, { method: 'GET' });
                    return { success: true, host, token: 'SIN_AUTH' };
                } catch {
                    throw err;
                }
            }
            throw err;
        }
    }

    if (action === 'getShiftPeriods') {
        const res = await ffcAuthedRequest('/fusion/period/list/shift', host, user, pass);
        const rawList = res.data?.list || res.data || [];
        const periods = rawList.map(p => {
            const isClosed = Boolean(p.endDate && p.endDate.trim() && p.endTime && p.endTime.trim());
            return {
                id: p.id,
                parentId: p.parentId,
                periodType: p.periodType || 'Shift',
                startDate: p.startDate,
                startTime: p.startTime,
                endDate: p.endDate || null,
                endTime: p.endTime || null,
                isClosed,
                estado: isClosed ? 'cerrado' : 'abierto',
                startFormatted: fmtDT(p.startDate, p.startTime),
                endFormatted: isClosed ? fmtDT(p.endDate, p.endTime) : 'En curso',
                transationStart: p.transationStart,
                transationEnd: p.transationEnd,
                transationCount: p.transationCount || 0
            };
        });
        periods.sort((a, b) => b.id - a.id);
        return periods;
    }

    if (action === 'getPeriodTotalizers') {
        const periodId = payload.periodId;
        const infoRes = await ffcAuthedRequest(`/fusion/period/info/shift/${periodId}`, host, user, pass);
        const info = infoRes.data;
        if (!info) throw new Error(`No se encontró información para el turno ${periodId} en Fusion.`);

        let dateStart = fmtD(info.startDate);
        let timeStart = fmtT(info.startTime);
        let dateEnd = fmtD(info.endDate);
        let timeEnd = fmtT(info.endTime);

        if (!dateEnd || !timeEnd) {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            const ss = String(now.getSeconds()).padStart(2, '0');
            dateEnd = `${y}-${m}-${d}`;
            timeEnd = `${hh}:${mm}:${ss}`;
        }

        const filterPayload = {
            dateStart, timeStart, dateEnd, timeEnd,
            genericNumber1: Number(periodId),
            genericNumber2: info.transationStart || 0,
            genericNumber3: info.transationEnd || info.transationStart || 0,
            genericString1: 'S'
        };

        // 1. Totalizadores de pistolas (Others)
        const totRes = await ffcAuthedRequest('/fusion/data/periodOthersTotalizer', host, user, pass, 'POST', filterPayload);
        const rawRows = totRes.data?.data || [];
        const totalizers = rawRows.map((r, index) => {
            const obj = {};
            for (const col of (r.row || [])) obj[col.name] = col.value;
            return {
                index,
                pumpId: Number(obj.pumpId),
                hoseId: Number(obj.hoseId),
                gradeId: Number(obj.gradeId),
                initialVolume: parseFloat(obj.initialVolume) || 0,
                finalVolume: parseFloat(obj.finalVolume) || 0,
                turnAround: parseFloat(obj.turnAround) || 0
            };
        });

        // 2. Ventas (Sales)
        let pumpSales = { totalMoney: 0, totalVolume: 0, grades: [] };
        try {
            const salesRes = await ffcAuthedRequest('/fusion/data/periodSalesByProductPumpSale', host, user, pass, 'POST', filterPayload);
            const salesRows = salesRes.data?.data || [];
            let sumMoney = 0;
            let sumVolume = 0;
            const grades = salesRows.map(r => {
                const obj = {};
                for (const col of (r.row || [])) obj[col.name] = col.value;
                const volume = parseFloat(obj.totalVolume) || 0;
                const money = parseFloat(obj.totalMoney) || 0;
                sumMoney += money;
                sumVolume += volume;
                return {
                    grade: obj.gradeId || '',
                    volume: Number(volume.toFixed(3)),
                    amount: Number(money.toFixed(2))
                };
            });
            pumpSales = {
                totalMoney: Number(sumMoney.toFixed(2)),
                totalVolume: Number(sumVolume.toFixed(3)),
                grades
            };
        } catch (e) {
            log(`[AVISO] periodSalesByProductPumpSale: ${e.message}`);
        }

        return {
            periodInfo: {
                id: Number(periodId),
                startDate: info.startDate,
                startTime: info.startTime,
                endDate: info.endDate,
                endTime: info.endTime,
                isClosed: Boolean(info.endDate && info.endTime),
                startFormatted: fmtDT(info.startDate, info.startTime),
                endFormatted: info.endDate ? fmtDT(info.endDate, info.endTime) : 'En curso',
                transationCount: info.transationCount || 0
            },
            totalizers,
            pumpSales
        };
    }

    throw new Error(`Acción desconocida: ${action}`);
}

function startAgent() {
    console.log('================================================================');
    console.log('   CONECTOR LOCAL DE ESTACIÓN - WAYNE FUSION FFC (NOVASAAS)     ');
    console.log('================================================================');
    console.log(` Servidor SaaS   : ${config.serverUrl}`);
    console.log(` Empresa ID     : ${config.companyId} | Estación ID: ${config.branchId}`);
    console.log(` Controlador IP : ${config.fusionHost}`);
    console.log(` Usuario Fusion : ${config.fusionUser || '(En blanco / Sin usuario)'}`);
    console.log(` Clave Fusion   : ${config.fusionPassword ? '••••••••' : '(En blanco / Sin contraseña)'}`);
    const keyPreview = config.agentKey ? `${config.agentKey.slice(0, 6)}...${config.agentKey.slice(-4)}` : '(VACIA - REQUERIDA)';
    console.log(` Clave Conector : ${keyPreview}`);
    if (configLoadedFrom) {
        console.log(` Archivo Config : ${path.basename(configLoadedFrom)}`);
    } else {
        console.log(' Archivo Config : [No encontrado config.json, usando parametros]');
    }
    console.log('----------------------------------------------------------------');

    if (!config.agentKey || !config.agentKey.trim()) {
        log('❌ [ERROR FATAL] Falta la clave de seguridad del conector (agentKey).');
        log('   Para solucionarlo, descargue el archivo config.json desde SIPE WEB');
        log('   o ejecute con: node fusion-agent.js --branch <id> --key <clave>');
        log('   Reintentando en 10 segundos...');
        setTimeout(startAgent, 10000);
        return;
    }

    let wsUrl = config.serverUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    if (!wsUrl.includes('/ws/fusion-agent')) {
        wsUrl = `${wsUrl.replace(/\/+$/, '')}/ws/fusion-agent`;
    }
    const fullUrl = `${wsUrl}?company_id=${config.companyId}&branch_id=${config.branchId}&key=${encodeURIComponent(config.agentKey)}`;

    log(`Conectando con ${config.serverUrl}...`);

    let ws;
    let heartbeatTimer = null;

    try {
        ws = new WSClass(fullUrl);
    } catch (e) {
        log(`Error al iniciar socket: ${e.message}. Reintentando en 5s...`);
        setTimeout(startAgent, 5000);
        return;
    }

    ws.onopen = async () => {
        log(`✅ Conexión establecida con ${config.serverUrl} (Canal Seguro Activo)`);
        log(`🟢 Conector en línea listo para recibir consultas desde la nube.`);
        heartbeatTimer = setInterval(() => {
            if (ws.readyState === WSClass.OPEN) {
                ws.send(JSON.stringify({ type: 'PING' }));
            }
        }, 25000);

        // Diagnóstico visual inmediato de comunicación con el controlador Fusion local
        log(`[Fusion Local] Verificando comunicación con controlador en ${config.fusionHost}...`);
        try {
            await getFusionToken(config.fusionHost, config.fusionUser, config.fusionPassword, true);
            log(`[Fusion Local] ✅ Autenticación exitosa en Wayne Fusion FFC (${config.fusionHost})`);
        } catch (err) {
            if (!config.fusionUser && !config.fusionPassword) {
                try {
                    await ffcRequest(`${sanitizeHost(config.fusionHost)}/fusion/period/list/shift`, { method: 'GET' });
                    log(`[Fusion Local] ✅ Comunicación exitosa con Wayne Fusion sin credenciales (${config.fusionHost})`);
                } catch (e2) {
                    log(`[Fusion Local] ❌ Error conectando con Fusion: ${err.message}`);
                    log(`[Fusion Local]    (Verifique que la IP ${config.fusionHost} sea accesible desde esta PC)`);
                }
            } else {
                log(`[Fusion Local] ❌ Error conectando con Fusion: ${err.message}`);
                log(`[Fusion Local]    (Verifique que la IP ${config.fusionHost} sea accesible desde esta PC y que el usuario/clave sean correctos)`);
            }
        }
    };

    ws.onmessage = async (event) => {
        try {
            const raw = typeof event.data === 'string' ? event.data : event.data?.toString();
            const msg = JSON.parse(raw);

            if (msg.type === 'CONNECTED') {
                log(`[SaaS] ${msg.message}`);
                return;
            }

            if (msg.type === 'PONG') return;

            if (msg.type === 'FUSION_REQUEST') {
                log(`📥 Petición de la nube: [${msg.action}] (Req: ${msg.requestId.slice(0, 8)})`);
                try {
                    const result = await handleAction(msg.action, msg.payload);
                    ws.send(JSON.stringify({
                        type: 'FUSION_RESPONSE',
                        requestId: msg.requestId,
                        success: true,
                        data: result
                    }));
                    log(`📤 Respuesta enviada exitosamente para [${msg.action}]`);
                } catch (err) {
                    log(`❌ Error procesando [${msg.action}]: ${err.message}`);
                    ws.send(JSON.stringify({
                        type: 'FUSION_RESPONSE',
                        requestId: msg.requestId,
                        success: false,
                        error: err.message
                    }));
                }
            }
        } catch (e) {
            log(`Error parseando mensaje recibido: ${e.message}`);
        }
    };

    ws.onclose = (event) => {
        clearInterval(heartbeatTimer);
        const reason = event.reason ? ` (${event.reason})` : '';
        const hint1006 = event.code === 1006 
            ? ' -> El servidor SaaS rechazo la conexion. Revise que la clave (agentKey) corresponda a la Estacion #' + config.branchId + '.'
            : '';
        log(`⚠️ Conexión cerrada con el servidor SaaS (Código: ${event.code}${reason})${hint1006}. Reintentando en 5 segundos...`);
        setTimeout(startAgent, 5000);
    };

    ws.onerror = (err) => {
        log(`❌ Error de conexión con el servidor SaaS: ${err.message || 'Error de socket'}`);
        try { ws.close(); } catch { /* ignore */ }
    };
}

startAgent();
