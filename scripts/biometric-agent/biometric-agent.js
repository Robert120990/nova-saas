/**
 * ============================================================================
 * CONECTOR LOCAL DE MARCADOR DIGITAL ZKTECO — RECURSOS HUMANOS (SIPE WEB)
 * ============================================================================
 * Este conector se ejecuta en una computadora dentro de la red local (LAN)
 * donde está conectado el reloj biométrico ZKTeco (IP: 192.168.3.201, Puerto: 4370).
 *
 * Funciones principales:
 * 1. Conecta con el reloj biométrico vía protocolo ZK nativo por TCP socket (4370).
 * 2. Extrae las marcaciones de asistencia (huella, rostro, tarjeta, PIN).
 * 3. ALMACENAMIENTO LOCAL: Guarda respaldo continuo en 'attendance_backup.jsonl'
 *    y mantiene el cursor de sincronización en 'sync-state.json'.
 * 4. SINCRONIZACIÓN INCREMENTAL AUTO-REPARABLE: Descarta fechas corruptas de batería
 *    CMOS (ej. años 2000 o 2118) y repara cursores futuros automáticamente.
 * 5. Escucha eventos en tiempo real para reflejar marcaciones al instante.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// Reutilización de sockets TCP para evitar saturación de puertos en Windows
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 10, keepAliveMsecs: 30000 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10, keepAliveMsecs: 30000 });

let ZKLib;
try {
    ZKLib = require('node-zklib');
} catch {
    try {
        ZKLib = require(path.join(__dirname, 'node_modules', 'node-zklib'));
    } catch {
        console.error('\n[ERROR FATAL] La librería node-zklib no está instalada.');
        console.error('Por favor ejecute: npm install node-zklib\n');
        process.exit(1);
    }
}

const configPath = path.join(__dirname, 'config.json');
const statePath = path.join(__dirname, 'sync-state.json');
const backupPath = path.join(__dirname, 'attendance_backup.jsonl');

let config = {
    serverUrl: 'https://sys.sipesv.com',
    companyId: 9,
    deviceId: 1,
    agentKey: '',
    deviceIp: '192.168.3.201',
    devicePort: 4370,
    commKey: 0,
    protocol: 'tcp',
    syncIntervalSeconds: 30,
    realTimeEnabled: true
};

if (fs.existsSync(configPath)) {
    try {
        const loaded = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config = { ...config, ...loaded };
    } catch (e) {
        console.warn('[AVISO] Error leyendo config.json, usando valores por defecto:', e.message);
    }
}

let syncState = {
    lastPunchTime: null,
    lastLogCount: 0,
    totalPunchesSynced: 0,
    lastSyncDate: null
};

function formatDateObjLocal(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatLocalDateTime(val) {
    if (!val) return null;
    if (val instanceof Date) {
        return formatDateObjLocal(val);
    }
    if (typeof val === 'string') {
        const str = val.trim();
        // Si trae sufijo Z u offset UTC, convertir primero a hora local real de la PC
        if (str.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(str)) {
            const parsed = new Date(str);
            return formatDateObjLocal(parsed);
        }
        const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
        if (match) {
            return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
        }
        const fallback = new Date(str);
        if (!isNaN(fallback.getTime())) return formatDateObjLocal(fallback);
    }
    return null;
}

function isValidPunchTimeStr(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return false;
    const m = timeStr.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return false;
    const year = Number(m[1]);
    if (year < 2018) return false;
    const ms = new Date(timeStr.replace(' ', 'T')).getTime();
    if (isNaN(ms)) return false;
    // Rechazar fechas futuras corruptas (margen máximo +24h)
    return ms <= (Date.now() + 24 * 60 * 60 * 1000);
}

function loadSyncState() {
    if (fs.existsSync(statePath)) {
        try {
            const raw = fs.readFileSync(statePath, 'utf8');
            syncState = { ...syncState, ...JSON.parse(raw) };
            if (syncState.lastPunchTime) {
                const normalized = formatLocalDateTime(syncState.lastPunchTime);
                if (!normalized || !isValidPunchTimeStr(normalized)) {
                    log(`Cursor local corrupto/futuro detectado (${syncState.lastPunchTime}). Se restablecerá automáticamente.`, 'WARN');
                    syncState.lastPunchTime = null;
                    saveSyncState();
                } else if (normalized !== syncState.lastPunchTime) {
                    syncState.lastPunchTime = normalized;
                    saveSyncState();
                }
            }
        } catch (e) {
            log(`Aviso leyendo sync-state.json: ${e.message}`, 'WARN');
        }
    }
}

function saveSyncState() {
    try {
        syncState.lastSyncDate = new Date().toISOString();
        fs.writeFileSync(statePath, JSON.stringify(syncState, null, 2), 'utf8');
    } catch (e) {
        log(`Error al guardar sync-state.json: ${e.message}`, 'WARN');
    }
}

function reconcileCursorWithServer(serverLastPunch, totalServerLogs) {
    // 1. Limpiar cursor local si es inválido o futuro
    if (syncState.lastPunchTime) {
        const localNorm = formatLocalDateTime(syncState.lastPunchTime);
        if (!localNorm || !isValidPunchTimeStr(localNorm)) {
            log(`Auto-reparando cursor local inválido (${syncState.lastPunchTime}).`, 'WARN');
            syncState.lastPunchTime = null;
            saveSyncState();
        } else {
            syncState.lastPunchTime = localNorm;
        }
    }

    if (!serverLastPunch) return;
    const serverTimeStr = formatLocalDateTime(serverLastPunch);
    if (!serverTimeStr || !isValidPunchTimeStr(serverTimeStr)) return;

    const serverMs = new Date(serverTimeStr.replace(' ', 'T')).getTime();
    const localMs = syncState.lastPunchTime
        ? new Date(syncState.lastPunchTime.replace(' ', 'T')).getTime()
        : 0;

    // Actualizar si no hay cursor local, si el servidor está más adelante,
    // o si el cursor local quedó adelantado > 24h respecto al servidor (desincronización previa)
    if (!syncState.lastPunchTime || serverMs > localMs || (localMs - serverMs) > (24 * 60 * 60 * 1000)) {
        syncState.lastPunchTime = serverTimeStr;
        saveSyncState();
        log(`Cursor sincronizado con SIPE SaaS: ${serverTimeStr}${totalServerLogs !== undefined ? ` (${totalServerLogs} registros válidos en nube)` : ''}.`);
    }
}

function appendToLocalBackup(punches) {
    if (!Array.isArray(punches) || punches.length === 0) return;
    try {
        const lines = punches.map(p => JSON.stringify({
            uid: p.device_uid,
            time: p.punch_time,
            code: p.punch_code,
            verify: p.verify_type,
            recorded_at: formatLocalDateTime(new Date())
        })).join('\n') + '\n';
        fs.appendFileSync(backupPath, lines, 'utf8');
    } catch (e) {
        log(`Aviso al escribir en attendance_backup.jsonl: ${e.message}`, 'WARN');
    }
}

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--server' && args[i + 1]) config.serverUrl = args[++i];
    if (args[i] === '--key' && args[i + 1]) config.agentKey = args[++i];
    if (args[i] === '--ip' && args[i + 1]) config.deviceIp = args[++i];
    if (args[i] === '--port' && args[i + 1]) config.devicePort = parseInt(args[++i], 10);
    if (args[i] === '--interval' && args[i + 1]) config.syncIntervalSeconds = parseInt(args[++i], 10);
}
const isFullSync = args.includes('--full-sync') || args.includes('--force');

function log(msg, type = 'INFO') {
    const time = new Date().toLocaleTimeString('es-SV', { hour12: false });
    const prefix = type === 'ERROR' ? '❌ [ERROR]' : type === 'WARN' ? '⚠️ [AVISO]' : type === 'SUCCESS' ? '✅ [ÉXITO]' : 'ℹ️ [INFO]';
    console.log(`[${time}] ${prefix} ${msg}`);
}

function sendToServer(apiPath, method = 'POST', data = {}) {
    return new Promise((resolve, reject) => {
        try {
            const rawUrl = `${config.serverUrl.replace(/\/+$/, '')}${apiPath}`;
            const parsedUrl = new URL(rawUrl);
            const isHttps = parsedUrl.protocol === 'https:';
            const client = isHttps ? https : http;

            const postData = JSON.stringify(data);
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (isHttps ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    'x-agent-key': config.agentKey
                },
                agent: isHttps ? httpsAgent : httpAgent,
                rejectUnauthorized: false,
                timeout: 20000
            };

            const req = client.request(options, (res) => {
                let responseBody = '';
                res.on('data', chunk => { responseBody += chunk; });
                res.on('end', () => {
                    let parsed = responseBody;
                    try { parsed = JSON.parse(responseBody); } catch { /* ignore */ }
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        const errMsg = parsed?.message || `HTTP ${res.statusCode}`;
                        reject(new Error(errMsg));
                    }
                });
            });

            req.on('error', (err) => {
                const hint = (config.serverUrl.includes('localhost') || config.serverUrl.includes('127.0.0.1'))
                    ? ' (Sugerencia: Si ejecuta en otra PC, use la URL del servidor en config.json)'
                    : '';
                reject(new Error(`Conexión fallida a ${rawUrl}: ${err.message}${hint}`));
            });
            req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout de conexión con ${rawUrl}`)); });
            req.write(postData);
            req.end();
        } catch (err) {
            reject(err);
        }
    });
}

let zk = null;
let isDeviceConnected = false;
let isSyncing = false;
let syncTimer = null;

async function connectToDevice() {
    if (isDeviceConnected && zk) return true;

    log(`Conectando con Marcador Digital en ${config.deviceIp}:${config.devicePort} (${config.protocol.toUpperCase()})...`);
    try {
        zk = new ZKLib(
            config.deviceIp,
            config.devicePort,
            10000,
            4000,
            config.commKey || 0,
            config.protocol || 'tcp'
        );

        await zk.createSocket();
        isDeviceConnected = true;
        log(`Conexión establecida con el Marcador Digital ZKTeco (${config.deviceIp})`, 'SUCCESS');

        let info = {};
        try {
            if (typeof zk.getInfo === 'function') {
                const zkInfo = await zk.getInfo().catch(() => null);
                if (zkInfo) {
                    info = {
                        user_counts: zkInfo.userCounts,
                        log_counts: zkInfo.logCounts,
                        log_capacity: zkInfo.logCapacity,
                        connected_at: new Date().toISOString()
                    };
                    log(`Dispositivo: Usuarios: ${zkInfo.userCounts || 0} | Marcaciones: ${zkInfo.logCounts || 0} | Capacidad: ${zkInfo.logCapacity || 0}`);
                }
            }
        } catch (err) {
            log(`Aviso al consultar metadatos del dispositivo: ${err.message}`, 'WARN');
        }

        try {
            const hbRes = await sendToServer('/api/rh/biometric/heartbeat', 'POST', {
                status: 'online',
                device_info: info
            });
            log('Estado [ONLINE] reportado al servidor SIPE SaaS.', 'SUCCESS');
            reconcileCursorWithServer(hbRes?.last_punch_time, hbRes?.total_server_logs);
        } catch (serverErr) {
            log(`No se pudo reportar estado al servidor: ${serverErr.message}`, 'WARN');
        }

        if (config.realTimeEnabled && typeof zk.getRealTimeLogs === 'function') {
            try {
                await zk.getRealTimeLogs(async (event) => {
                    if (event && (event.userId || event.uid || event.user_id)) {
                        const uid = String(event.userId || event.user_id || event.uid);
                        const rawTime = event.attTime || event.time || new Date();
                        const timeStr = formatLocalDateTime(rawTime);
                        if (!isValidPunchTimeStr(timeStr)) {
                            log(`Marcación en tiempo real con fecha corrupta ignorada (${timeStr}). Revisar hora del reloj ZKTeco.`, 'WARN');
                            return;
                        }
                        log(`🔔 Marcación detectada en tiempo real: Empleado PIN: ${uid} a las ${timeStr}`);
                        try {
                            const singlePunch = [{
                                device_uid: uid,
                                punch_time: timeStr,
                                punch_code: typeof event.state === 'number' ? event.state : 0,
                                verify_type: typeof event.verifyType === 'number' ? event.verifyType : 1,
                                source: 'agent'
                            }];
                            const res = await sendToServer('/api/rh/biometric/sync', 'POST', { punches: singlePunch });
                            appendToLocalBackup(singlePunch);
                            syncState.lastPunchTime = timeStr;
                            syncState.totalPunchesSynced += (res.insertedCount || 0);
                            saveSyncState();
                            log('✓ Marcación en tiempo real sincronizada con SIPE', 'SUCCESS');
                        } catch (e) {
                            log(`Error enviando marcación en tiempo real: ${e.message}`, 'WARN');
                        }
                    }
                });
                log('Modo de escucha en tiempo real activado.', 'SUCCESS');
            } catch {
                log(`Modo en tiempo real no soportado por este firmware (se usará polling incremental cada ${config.syncIntervalSeconds}s).`, 'WARN');
            }
        }

        return true;
    } catch (err) {
        isDeviceConnected = false;
        zk = null;
        log(`No se pudo conectar al Marcador (${config.deviceIp}): ${err.message}`, 'ERROR');
        return false;
    }
}

async function syncAttendances() {
    if (isSyncing) return;
    isSyncing = true;

    try {
        const connected = await connectToDevice();
        if (!connected) {
            isSyncing = false;
            return;
        }

        log('Consultando registros de marcaciones en el dispositivo...');
        const attendances = await zk.getAttendances();
        const logsList = (attendances && Array.isArray(attendances.data))
            ? attendances.data
            : (Array.isArray(attendances) ? attendances : []);

        if (logsList.length === 0) {
            log('El dispositivo no contiene marcaciones almacenadas actualmente.');
            isSyncing = false;
            return;
        }

        let ignoredInvalidDates = 0;
        const punchesPayload = [];

        for (const item of logsList) {
            const uid = String(item.deviceUserId || item.userId || item.user_id || item.uid || '').trim();
            if (!uid) continue;
            const rawTime = item.recordTime || item.attTime || item.timestamp;
            const timeStr = formatLocalDateTime(rawTime);
            if (!isValidPunchTimeStr(timeStr)) {
                ignoredInvalidDates++;
                continue;
            }
            punchesPayload.push({
                device_uid: uid,
                punch_time: timeStr,
                punch_code: typeof item.punch === 'number' ? item.punch : (typeof item.state === 'number' ? item.state : 0),
                verify_type: typeof item.verifyType === 'number' ? item.verifyType : 1,
                source: 'agent',
                raw_data: {
                    ...item,
                    recordTime: timeStr
                }
            });
        }

        if (ignoredInvalidDates > 0) {
            log(`Filtrados ${ignoredInvalidDates} registros con fechas inválidas/corruptas del reloj (<2018 o >hoy+24h).`);
        }

        punchesPayload.sort((a, b) => new Date(a.punch_time.replace(' ', 'T')) - new Date(b.punch_time.replace(' ', 'T')));

        let toSync = punchesPayload;
        if (!isFullSync && syncState.lastPunchTime && isValidPunchTimeStr(syncState.lastPunchTime)) {
            const lastTimeMs = new Date(syncState.lastPunchTime.replace(' ', 'T')).getTime();
            const cutoffMs = lastTimeMs - (60 * 1000);
            toSync = punchesPayload.filter(p => new Date(p.punch_time.replace(' ', 'T')).getTime() > cutoffMs);
        }

        if (toSync.length === 0) {
            log(`Dispositivo con ${logsList.length} marcaciones (${punchesPayload.length} válidas). Todo sincronizado al día.`);
            syncState.lastLogCount = logsList.length;
            saveSyncState();
            isSyncing = false;
            return;
        }

        if (syncState.lastPunchTime && !isFullSync) {
            log(`⚡ Detectadas ${toSync.length} marcaciones NUEVAS válidas de ${logsList.length} en el reloj. Sincronizando...`);
        } else {
            log(`📥 Sincronización inicial/recuperación: ${toSync.length} marcaciones válidas a procesar...`);
        }

        const chunkSize = 300;
        let totalInserted = 0;
        let latestPunchTime = (syncState.lastPunchTime && isValidPunchTimeStr(syncState.lastPunchTime))
            ? syncState.lastPunchTime
            : null;

        for (let i = 0; i < toSync.length; i += chunkSize) {
            const chunk = toSync.slice(i, i + chunkSize);
            const res = await sendToServer('/api/rh/biometric/sync', 'POST', {
                punches: chunk,
                device_info: {
                    last_sync_logs: logsList.length,
                    valid_logs: punchesPayload.length,
                    sync_time: formatLocalDateTime(new Date())
                }
            });
            totalInserted += (res.insertedCount || 0);
            appendToLocalBackup(chunk);

            const chunkLastTime = chunk[chunk.length - 1]?.punch_time;
            if (chunkLastTime && isValidPunchTimeStr(chunkLastTime)) {
                if (!latestPunchTime || new Date(chunkLastTime.replace(' ', 'T')) > new Date(latestPunchTime.replace(' ', 'T'))) {
                    latestPunchTime = chunkLastTime;
                }
            }
        }

        if (latestPunchTime && isValidPunchTimeStr(latestPunchTime)) {
            syncState.lastPunchTime = latestPunchTime;
        }
        syncState.lastLogCount = logsList.length;
        syncState.totalPunchesSynced += totalInserted;
        saveSyncState();

        if (totalInserted > 0) {
            log(`🎉 ${totalInserted} marcaciones NUEVAS sincronizadas exitosamente en SIPE SaaS.`, 'SUCCESS');
        } else {
            log('Marcaciones al día en el servidor (los registros ya existían en SIPE).');
        }
    } catch (err) {
        log(`Error durante la sincronización: ${err.message}`, 'ERROR');
        if (err.message && (err.message.includes('ECONNRESET') || err.message.includes('closed') || err.message.includes('timeout'))) {
            isDeviceConnected = false;
            try { if (zk) await zk.disconnect(); } catch { /* ignore */ }
            zk = null;
        }
    } finally {
        isSyncing = false;
    }
}

async function startAgent() {
    loadSyncState();

    console.clear();
    console.log('========================================================================');
    console.log('   CONECTOR LOCAL MARCADOR DIGITAL ZKTECO — RECURSOS HUMANOS (SIPE)     ');
    console.log('========================================================================');
    console.log(` Servidor SaaS          : ${config.serverUrl}`);
    console.log(` Empresa ID             : ${config.companyId}`);
    console.log(` Dispositivo IP         : ${config.deviceIp}:${config.devicePort} (${config.protocol.toUpperCase()})`);
    console.log(` Intervalo de Sync      : Cada ${config.syncIntervalSeconds} segundos`);
    console.log(` Clave de Agente        : ${config.agentKey ? (config.agentKey.slice(0, 8) + '...' + config.agentKey.slice(-6)) : 'NO CONFIGURADA'}`);
    console.log(` Última Marcación Local : ${syncState.lastPunchTime || 'Sin historial / auto-recuperación'}`);
    console.log(` Archivo de Respaldo    : ${backupPath}`);
    console.log('------------------------------------------------------------------------');

    if (!config.agentKey) {
        log('ADVERTENCIA: No ha configurado "agentKey" en config.json.', 'WARN');
        log('Copie la clave desde la pantalla de Marcador Digital en el sistema SIPE WEB.', 'WARN');
    }

    try {
        const hb = await sendToServer('/api/rh/biometric/heartbeat', 'POST', {
            status: 'online',
            started_at: new Date().toISOString()
        });
        log('Conexión inicial con el servidor SIPE establecida. Estado [EN LÍNEA].', 'SUCCESS');
        reconcileCursorWithServer(hb?.last_punch_time, hb?.total_server_logs);
    } catch (hbErr) {
        log(`No se pudo contactar al servidor SIPE en ${config.serverUrl}: ${hbErr.message}`, 'WARN');
    }

    await syncAttendances();

    const intervalMs = Math.max(10, config.syncIntervalSeconds) * 1000;
    syncTimer = setInterval(syncAttendances, intervalMs);

    setInterval(async () => {
        try {
            const hb = await sendToServer('/api/rh/biometric/heartbeat', 'POST', {
                status: isDeviceConnected ? 'online' : 'error'
            });
            reconcileCursorWithServer(hb?.last_punch_time, hb?.total_server_logs);
        } catch { /* silencio en heartbeat secundario */ }
    }, 25000);
}

process.on('SIGINT', async () => {
    log('Deteniendo conector biométrico...');
    if (syncTimer) clearInterval(syncTimer);
    try {
        if (zk && isDeviceConnected) await zk.disconnect();
    } catch { /* ignore */ }
    process.exit(0);
});

startAgent();
