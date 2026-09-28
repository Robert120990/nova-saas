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
const fs = require('fs');
const path = require('path');

// Cargar configuración local
const configPath = path.join(__dirname, 'config.json');
let config = {
    serverUrl: 'https://sys.sipesv.com',
    companyId: 1,
    branchId: 2,
    agentKey: '',
    fusionHost: 'https://10.19.4.15',
    fusionUser: 'MANAGER',
    fusionPassword: 'MANAGER'
};

if (fs.existsSync(configPath)) {
    try {
        const loaded = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config = { ...config, ...loaded };
    } catch (e) {
        console.error('[ADVERTENCIA] Error leyendo config.json, usando valores por defecto:', e.message);
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
    if (args[i] === '--user' && args[i + 1]) config.fusionUser = args[++i];
    if (args[i] === '--pass' && args[i + 1]) config.fusionPassword = args[++i];
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

// Helper para peticiones HTTPS directas al controlador Wayne Fusion local (ignora SSL autofirmado)
function ffcRequest(urlStr, options = {}, body = null) {
    return new Promise((resolve, reject) => {
        try {
            const url = new URL(urlStr);
            const reqOptions = {
                hostname: url.hostname,
                port: url.port || 443,
                path: url.pathname + url.search,
                method: options.method || 'GET',
                headers: Object.assign({ 'Content-Type': 'application/json' }, options.headers || {}),
                rejectUnauthorized: false,
                timeout: options.timeout || 15000
            };

            const req = https.request(reqOptions, (res) => {
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
    const uName = (username || 'MANAGER').trim();
    const pwd = (password || 'MANAGER').trim();

    try {
        const loginRes = await ffcRequest(`${baseHost}/fusion/login`, { method: 'POST' }, {
            userName: uName,
            password: pwd
        });
        const token = loginRes.data?.accessToken;
        if (!token) throw new Error('Autenticación en Fusion no devolvió accessToken');
        cachedToken = token;
        tokenExpiresAt = now + (15 * 60 * 1000);
        return token;
    } catch (err) {
        if ((err.status === 401 || err.status === 403) && uName !== uName.toUpperCase()) {
            const retryRes = await ffcRequest(`${baseHost}/fusion/login`, { method: 'POST' }, {
                userName: uName.toUpperCase(),
                password: pwd
            });
            const token = retryRes.data?.accessToken;
            if (token) {
                cachedToken = token;
                tokenExpiresAt = now + (15 * 60 * 1000);
                return token;
            }
        }
        throw err;
    }
}

async function ffcAuthedRequest(endpoint, host, username, password, method = 'GET', body = null) {
    const baseHost = sanitizeHost(host);
    let token = await getFusionToken(baseHost, username, password);
    try {
        return await ffcRequest(`${baseHost}${endpoint}`, { method, headers: { Authorization: token } }, body);
    } catch (err) {
        if (err.status === 401 || err.status === 403) {
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
    const user = payload?.config?.username || config.fusionUser;
    const pass = payload?.config?.password || config.fusionPassword;

    if (action === 'testConnection') {
        const token = await getFusionToken(host, user, pass, true);
        return { success: true, host, token: token ? 'OK' : 'FAIL' };
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
    console.log(` Usuario Fusion : ${config.fusionUser}`);
    console.log('----------------------------------------------------------------');

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

    ws.onopen = () => {
        log(`✅ Conexión establecida con ${config.serverUrl} (Canal Seguro Activo)`);
        log(`🟢 Conector en línea listo para recibir consultas desde la nube.`);
        heartbeatTimer = setInterval(() => {
            if (ws.readyState === WSClass.OPEN) {
                ws.send(JSON.stringify({ type: 'PING' }));
            }
        }, 25000);
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
        log(`⚠️ Conexión cerrada con el servidor SaaS (Código: ${event.code}${reason}). Reintentando en 5 segundos...`);
        setTimeout(startAgent, 5000);
    };

    ws.onerror = (err) => {
        log(`❌ Error de conexión con el servidor SaaS: ${err.message || 'Error de socket'}`);
        try { ws.close(); } catch { /* ignore */ }
    };
}

startAgent();
