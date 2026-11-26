/**
 * ============================================================================
 * CONECTOR LOCAL DE MARCADOR DIGITAL ZKTECO — RECURSOS HUMANOS (SIPE WEB)
 * ============================================================================
 * Versión 2.1.0:
 * 1. Conexión limpia por ciclo (evita fuga de listeners TCP en node-zklib).
 * 2. Manejo robusto de ZKError (reporta errores reales al servidor SIPE).
 * 3. Sincronización automática de catálogo de usuarios del reloj (zk.getUsers).
 * 4. Cursor incremental anti-CMOS (descarta años corruptos <2018 o >hoy+24h).
 * 5. Auto-actualización verificada por SHA-256 + verificación de sintaxis Node.
 * 6. Intervalo adaptativo para relojes con >20,000 marcaciones almacenadas.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const AGENT_VERSION = '2.2.1';
const USERS_SYNC_INTERVAL_MS = 10 * 60 * 1000; // Sincronizar catálogo de usuarios del reloj cada 10 min
const SELF_UPDATE_CHECK_MS = 15 * 60 * 1000;   // Revisar auto-actualización cada 15 min

function compareSemver(a, b) {
    const parse = (v) => String(v || '0.0.0').replace(/^[^0-9]*/, '').split('.').map(n => parseInt(n, 10) || 0);
    const pa = parse(a);
    const pb = parse(b);
    for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0) ? 1 : -1;
    }
    return 0;
}

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
    syncIntervalSeconds: 60,
    autoUpdate: true
};

if (fs.existsSync(configPath)) {
    try {
        const rawConfig = fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '');
        const loaded = JSON.parse(rawConfig);
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

function getErrorMessage(err) {
    if (!err) return 'Error desconocido';
    if (typeof err === 'string') return err;
    if (err.err && typeof err.err === 'object' && err.err.message) {
        return err.command ? `${err.command}: ${err.err.message}` : err.err.message;
    }
    if (typeof err.toast === 'function') {
        try { const t = err.toast(); if (t) return t; } catch { /* ignore */ }
    }
    if (err.message) return err.message;
    try { return JSON.stringify(err); } catch { return String(err); }
}

function log(msg, type = 'INFO') {
    const time = new Date().toLocaleTimeString('es-SV', { hour12: false });
    const prefix = type === 'ERROR' ? '❌ [ERROR]' : type === 'WARN' ? '⚠️ [AVISO]' : type === 'SUCCESS' ? '✅ [ÉXITO]' : 'ℹ️ [INFO]';
    console.log(`[${time}] ${prefix} ${msg}`);
}

function formatDateObjLocal(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatLocalDateTime(val) {
    if (!val) return null;
    if (val instanceof Date) return formatDateObjLocal(val);
    if (typeof val === 'string') {
        const str = val.trim();
        if (str.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(str)) {
            return formatDateObjLocal(new Date(str));
        }
        const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
        if (match) return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
        const fallback = new Date(str);
        if (!isNaN(fallback.getTime())) return formatDateObjLocal(fallback);
    }
    return null;
}

function isValidPunchTimeStr(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return false;
    const m = timeStr.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return false;
    if (Number(m[1]) < 2018) return false;
    const ms = new Date(timeStr.replace(' ', 'T')).getTime();
    if (isNaN(ms)) return false;
    return ms <= (Date.now() + 24 * 60 * 60 * 1000);
}

function saveSyncState() {
    try {
        syncState.lastSyncDate = new Date().toISOString();
        fs.writeFileSync(statePath, JSON.stringify(syncState, null, 2), 'utf8');
    } catch (e) {
        log(`Error al guardar sync-state.json: ${e.message}`, 'WARN');
    }
}

function isPrivateServerUrl(urlStr) {
    try {
        const h = new URL(urlStr).hostname.toLowerCase();
        return h === 'localhost' || h === '127.0.0.1' || h === '::1'
            || /^192\.168\./.test(h)
            || /^10\./.test(h)
            || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
    } catch {
        return false;
    }
}

let privateUrlHintShown = false;
function maybeLogPrivateUrlHint(errMsg) {
    if (privateUrlHintShown) return;
    if (!isPrivateServerUrl(config.serverUrl)) return;
    if (!/(ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|Timeout)/i.test(String(errMsg || ''))) return;
    privateUrlHintShown = true;
    log(
        `SUGERENCIA: config.json apunta a una IP local (${config.serverUrl}) que no responde. `
        + `Si usa SIPE en la nube, cambie "serverUrl" a "https://sys.sipesv.com" en config.json `
        + `o ejecute "actualizar-conector.bat" descargado desde https://sys.sipesv.com.`,
        'WARN'
    );
}

function loadSyncState() {
    if (!fs.existsSync(statePath)) return;
    try {
        const raw = fs.readFileSync(statePath, 'utf8').replace(/^\uFEFF/, '');
        syncState = { ...syncState, ...JSON.parse(raw) };
        if (syncState.lastPunchTime) {
            const normalized = formatLocalDateTime(syncState.lastPunchTime);
            if (!normalized || !isValidPunchTimeStr(normalized)) {
                log(`Cursor local corrupto/futuro detectado (${syncState.lastPunchTime}). Restableciendo automáticamente.`, 'WARN');
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

function reconcileCursorWithServer(serverLastPunch, totalServerLogs) {
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

    if (!syncState.lastPunchTime || serverMs > localMs || (localMs - serverMs) > (24 * 60 * 60 * 1000)) {
        syncState.lastPunchTime = serverTimeStr;
        saveSyncState();
        log(`Cursor sincronizado con SIPE SaaS: ${serverTimeStr}${totalServerLogs !== undefined ? ` (${totalServerLogs} registros en nube)` : ''}.`);
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

function requestServer(apiPath, method = 'POST', data = null, rawResponse = false) {
    return new Promise((resolve, reject) => {
        try {
            const rawUrl = `${config.serverUrl.replace(/\/+$/, '')}${apiPath}`;
            const parsedUrl = new URL(rawUrl);
            const isHttps = parsedUrl.protocol === 'https:';
            const client = isHttps ? https : http;

            const postData = data !== null && method !== 'GET' ? JSON.stringify(data) : '';
            const headers = { 'x-agent-key': config.agentKey };
            if (postData) {
                headers['Content-Type'] = 'application/json';
                headers['Content-Length'] = Buffer.byteLength(postData);
            }

            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (isHttps ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method,
                headers,
                agent: isHttps ? httpsAgent : httpAgent,
                rejectUnauthorized: false,
                timeout: 25000
            };

            const req = client.request(options, (res) => {
                let responseBody = '';
                res.on('data', chunk => { responseBody += chunk; });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        if (rawResponse) return resolve(responseBody);
                        try { return resolve(JSON.parse(responseBody)); } catch { return resolve(responseBody); }
                    }
                    let errMsg = `HTTP ${res.statusCode}`;
                    try { errMsg = JSON.parse(responseBody)?.message || errMsg; } catch { /* ignore */ }
                    reject(new Error(errMsg));
                });
            });

            req.on('error', (err) => reject(new Error(`Conexión fallida a ${rawUrl}: ${err.message}`)));
            req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout de conexión con ${rawUrl}`)); });
            if (postData) req.write(postData);
            req.end();
        } catch (err) {
            reject(err);
        }
    });
}

let lastDeviceReachable = false;
let lastUsersSyncMs = 0;
let lastUpdateCheckMs = 0;
let lastNotifiedPromptVersion = null;
let isSyncing = false;
let syncTimeout = null;
let isShuttingDown = false;

async function handleHeartbeatUpdate(hb) {
    if (!hb || !hb.latest_agent_version) return false;
    const latestVersion = hb.latest_agent_version;
    const expectedSha256 = hb.agent_script_sha256;
    const updatePolicy = hb.update_policy === 'prompt' ? 'prompt' : 'auto';
    const updateRequested = !!hb.update_requested;
    const isCompatible = hb.is_compatible !== false;

    const hasNewer = compareSemver(latestVersion, AGENT_VERSION) > 0;
    if (!hasNewer && !updateRequested) return false;

    if (!isCompatible) {
        log(`Versión v${latestVersion} disponible pero marcada no compatible con este equipo/protocolo. Se omite actualización.`, 'WARN');
        return false;
    }

    if (!updateRequested && (updatePolicy === 'prompt' || config.autoUpdate === false)) {
        if (lastNotifiedPromptVersion !== latestVersion) {
            lastNotifiedPromptVersion = latestVersion;
            log(`🔔 Conector más reciente compatible disponible (v${AGENT_VERSION} -> v${latestVersion}). Apruebe la actualización desde SIPE WEB > Conector LAN.`, 'INFO');
        }
        return false;
    }

    if (!updateRequested && Date.now() - lastUpdateCheckMs < SELF_UPDATE_CHECK_MS && lastUpdateCheckMs > 0) {
        return false;
    }
    lastUpdateCheckMs = Date.now();

    try {
        const currentContent = fs.readFileSync(__filename, 'utf8');
        const currentHash = crypto.createHash('sha256').update(currentContent, 'utf8').digest('hex');
        if (expectedSha256 && currentHash === expectedSha256) {
            if (updateRequested) {
                await requestServer('/api/rh/biometric/heartbeat', 'POST', {
                    status: lastDeviceReachable ? 'online' : 'error',
                    device_info: { agent_version: AGENT_VERSION, node_version: process.version, update_status: 'updated' }
                }).catch(() => {});
            }
            return false;
        }

        log(`⬇️ Aplicando actualización de conector (v${AGENT_VERSION} -> v${latestVersion})${updateRequested ? ' [solicitada remotamente]' : ' [automática]'}...`);
        await requestServer('/api/rh/biometric/heartbeat', 'POST', {
            status: lastDeviceReachable ? 'online' : 'error',
            device_info: { agent_version: AGENT_VERSION, node_version: process.version, update_status: 'updating' }
        }).catch(() => {});

        const newScript = await requestServer('/api/rh/biometric/agent-script', 'GET', null, true);
        if (!newScript || typeof newScript !== 'string' || !newScript.includes('AGENT_VERSION')) {
            throw new Error('Script descargado inválido.');
        }

        const downloadedHash = crypto.createHash('sha256').update(newScript, 'utf8').digest('hex');
        if (expectedSha256 && downloadedHash !== expectedSha256) {
            throw new Error('Hash SHA-256 no coincide; actualización abortada por seguridad.');
        }

        const tmpPath = `${__filename}.update.tmp`;
        const bakPath = `${__filename}.bak`;
        fs.writeFileSync(tmpPath, newScript, 'utf8');
        const check = spawnSync(process.execPath, ['--check', tmpPath], { encoding: 'utf8' });
        if (check.status !== 0) {
            try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
            throw new Error(`Error de sintaxis en nueva versión: ${check.stderr}`);
        }

        try { fs.copyFileSync(__filename, bakPath); } catch { /* backup best-effort */ }
        fs.renameSync(tmpPath, __filename);

        await requestServer('/api/rh/biometric/heartbeat', 'POST', {
            status: lastDeviceReachable ? 'online' : 'error',
            device_info: {
                agent_version: latestVersion,
                node_version: process.version,
                platform: process.platform,
                update_status: 'updated'
            }
        }).catch(() => {});

        log(`✅ Actualización a v${latestVersion} aplicada con respaldo en biometric-agent.js.bak. Reiniciando...`, 'SUCCESS');

        if (process.env.BIOMETRIC_WRAPPER === '1') {
            process.exit(42);
        } else {
            const child = spawn(process.execPath, [__filename, ...process.argv.slice(2)], {
                detached: true,
                stdio: 'inherit'
            });
            child.unref();
            process.exit(0);
        }
        return true;
    } catch (err) {
        const msg = getErrorMessage(err);
        log(`No se pudo auto-actualizar el conector: ${msg}`, 'WARN');
        await requestServer('/api/rh/biometric/heartbeat', 'POST', {
            status: lastDeviceReachable ? 'online' : 'error',
            device_info: {
                agent_version: AGENT_VERSION,
                node_version: process.version,
                update_status: 'failed',
                update_error: `${formatLocalDateTime(new Date())}: ${msg}`
            }
        }).catch(() => {});
        return false;
    }
}

async function safeDisconnectZk(zk) {
    if (!zk) return;
    try { await zk.disconnect(); } catch { /* ignore */ }
    try {
        if (zk.zklibTcp?.socket && !zk.zklibTcp.socket.destroyed) {
            zk.zklibTcp.socket.removeAllListeners();
            zk.zklibTcp.socket.destroy();
        }
    } catch { /* ignore */ }
}

function getAdaptiveIntervalMs(logCount) {
    const configured = Math.max(15, parseInt(config.syncIntervalSeconds, 10) || 60);
    // Para relojes con >20,000 marcaciones (~25s por lectura TCP), usar mínimo 60s para evitar saturación
    const effectiveSecs = logCount > 20000 ? Math.max(60, configured) : configured;
    return effectiveSecs * 1000;
}

async function syncAttendances() {
    if (isSyncing || isShuttingDown) return;
    isSyncing = true;
    let zk = null;
    let currentLogCount = syncState.lastLogCount || 0;

    try {
        zk = new ZKLib(
            config.deviceIp,
            config.devicePort,
            60000, // Timeout amplio (60s) para relojes con >50,000 registros
            15000,
            config.commKey || 0,
            config.protocol || 'tcp'
        );

        await zk.createSocket();
        lastDeviceReachable = true;

        const deviceInfoPayload = {
            agent_version: AGENT_VERSION,
            node_version: process.version,
            platform: process.platform,
            connected_at: new Date().toISOString()
        };

        try {
            if (typeof zk.getInfo === 'function') {
                const zkInfo = await zk.getInfo();
                if (zkInfo) {
                    deviceInfoPayload.user_counts = zkInfo.userCounts || 0;
                    deviceInfoPayload.log_counts = zkInfo.logCounts || 0;
                    deviceInfoPayload.log_capacity = zkInfo.logCapacity || 100000;
                    currentLogCount = zkInfo.logCounts || 0;
                }
            }
        } catch (infoErr) {
            log(`Aviso consultando getInfo(): ${getErrorMessage(infoErr)}`, 'WARN');
        }

        // Sincronizar catálogo de usuarios del reloj periódicamente (cada 10 min)
        if (Date.now() - lastUsersSyncMs >= USERS_SYNC_INTERVAL_MS && typeof zk.getUsers === 'function') {
            try {
                const usersRes = await zk.getUsers();
                const rawUsers = Array.isArray(usersRes?.data) ? usersRes.data : (Array.isArray(usersRes) ? usersRes : []);
                if (rawUsers.length > 0) {
                    deviceInfoPayload.users = rawUsers.map(u => ({
                        uid: u.uid,
                        userId: String(u.userId || u.uid || '').trim(),
                        name: (u.name || '').trim(),
                        role: u.role ?? 0
                    }));
                    deviceInfoPayload.users_synced_at = new Date().toISOString();
                    lastUsersSyncMs = Date.now();
                    log(`Catálogo de usuarios del reloj leído: ${rawUsers.length} usuarios.`);
                }
            } catch (uErr) {
                log(`Aviso consultando usuarios del reloj: ${getErrorMessage(uErr)}`, 'WARN');
            }
        }

        const tFetch = Date.now();
        const attendances = await zk.getAttendances();
        const fetchMs = Date.now() - tFetch;
        const logsList = Array.isArray(attendances?.data)
            ? attendances.data
            : (Array.isArray(attendances) ? attendances : []);

        // Desconectar inmediatamente al terminar de leer el reloj para liberar socket y evitar fugas
        await safeDisconnectZk(zk);
        zk = null;

        currentLogCount = logsList.length || currentLogCount;
        deviceInfoPayload.last_sync_logs = logsList.length;

        if (logsList.length === 0) {
            log('El dispositivo no contiene marcaciones almacenadas actualmente.');
            await requestServer('/api/rh/biometric/heartbeat', 'POST', {
                status: 'online',
                device_info: { ...deviceInfoPayload, clear_sync_error: true }
            }).catch(() => {});
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
                raw_data: { ...item, recordTime: timeStr }
            });
        }

        punchesPayload.sort((a, b) => a.punch_time.localeCompare(b.punch_time));

        let toSync = punchesPayload;
        if (!isFullSync && syncState.lastPunchTime && isValidPunchTimeStr(syncState.lastPunchTime)) {
            const lastTimeMs = new Date(syncState.lastPunchTime.replace(' ', 'T')).getTime();
            const cutoffMs = lastTimeMs - (60 * 1000);
            toSync = punchesPayload.filter(p => new Date(p.punch_time.replace(' ', 'T')).getTime() > cutoffMs);
        }

        deviceInfoPayload.valid_logs = punchesPayload.length;
        deviceInfoPayload.ignored_cmos_logs = ignoredInvalidDates;
        deviceInfoPayload.last_fetch_ms = fetchMs;
        deviceInfoPayload.sync_time = formatLocalDateTime(new Date());
        deviceInfoPayload.clear_sync_error = true;

        if (toSync.length === 0) {
            log(`Reloj leído (${logsList.length} marcas en ${(fetchMs / 1000).toFixed(1)}s). Todo sincronizado al día.`);
            syncState.lastLogCount = logsList.length;
            saveSyncState();
            const hb = await requestServer('/api/rh/biometric/heartbeat', 'POST', {
                status: 'online',
                device_info: deviceInfoPayload
            });
            reconcileCursorWithServer(hb?.last_punch_time, hb?.total_server_logs);
            await handleHeartbeatUpdate(hb);
            return;
        }

        log(`⚡ Sincronizando ${toSync.length} marcaciones nuevas (${logsList.length} en reloj, lectura ${(fetchMs / 1000).toFixed(1)}s)...`);

        const chunkSize = 300;
        let totalInserted = 0;
        let latestPunchTime = (syncState.lastPunchTime && isValidPunchTimeStr(syncState.lastPunchTime))
            ? syncState.lastPunchTime
            : null;

        for (let i = 0; i < toSync.length; i += chunkSize) {
            const chunk = toSync.slice(i, i + chunkSize);
            const isLastChunk = (i + chunkSize) >= toSync.length;
            const res = await requestServer('/api/rh/biometric/sync', 'POST', {
                punches: chunk,
                device_info: isLastChunk ? deviceInfoPayload : undefined
            });
            totalInserted += (res.insertedCount || 0);
            appendToLocalBackup(chunk);

            const chunkLastTime = chunk[chunk.length - 1]?.punch_time;
            if (chunkLastTime && isValidPunchTimeStr(chunkLastTime)) {
                if (!latestPunchTime || chunkLastTime > latestPunchTime) {
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
            log(`🎉 ${totalInserted} marcaciones NUEVAS sincronizadas en SIPE SaaS (última: ${syncState.lastPunchTime}).`, 'SUCCESS');
        } else {
            log('Marcaciones al día en el servidor (registros ya existentes).');
        }
    } catch (err) {
        lastDeviceReachable = false;
        const msg = getErrorMessage(err);
        log(`Error durante la sincronización: ${msg}`, 'ERROR');
        maybeLogPrivateUrlHint(msg);
        await requestServer('/api/rh/biometric/heartbeat', 'POST', {
            status: 'error',
            device_info: {
                agent_version: AGENT_VERSION,
                last_sync_error: `${formatLocalDateTime(new Date())}: ${msg}`
            }
        }).catch(() => {});
    } finally {
        await safeDisconnectZk(zk);
        isSyncing = false;
        if (!isShuttingDown) {
            const delayMs = getAdaptiveIntervalMs(currentLogCount);
            syncTimeout = setTimeout(syncAttendances, delayMs);
        }
    }
}

async function startAgent() {
    loadSyncState();

    console.log('========================================================================');
    console.log(`   CONECTOR LOCAL MARCADOR DIGITAL ZKTECO v${AGENT_VERSION} — SIPE WEB         `);
    console.log('========================================================================');
    console.log(` Servidor SaaS          : ${config.serverUrl}`);
    console.log(` Empresa / Dispositivo  : #${config.companyId} / #${config.deviceId}`);
    console.log(` Dispositivo IP         : ${config.deviceIp}:${config.devicePort} (${config.protocol.toUpperCase()})`);
    console.log(` Intervalo Base         : ${config.syncIntervalSeconds}s (adaptativo >=60s si >20k marcas)`);
    console.log(` Clave de Agente        : ${config.agentKey ? (config.agentKey.slice(0, 8) + '...' + config.agentKey.slice(-6)) : 'NO CONFIGURADA'}`);
    console.log(` Última Marcación Local : ${syncState.lastPunchTime || 'Sin historial / auto-recuperación'}`);
    console.log('------------------------------------------------------------------------');

    if (!config.agentKey) {
        log('ADVERTENCIA: No ha configurado "agentKey" en config.json.', 'WARN');
    }

    try {
        const hb = await requestServer('/api/rh/biometric/heartbeat', 'POST', {
            status: 'online',
            device_info: { agent_version: AGENT_VERSION, node_version: process.version, platform: process.platform, started_at: new Date().toISOString() }
        });
        log('Conexión inicial con SIPE SaaS establecida.', 'SUCCESS');
        reconcileCursorWithServer(hb?.last_punch_time, hb?.total_server_logs);
        const updated = await handleHeartbeatUpdate(hb);
        if (updated) return;
    } catch (hbErr) {
        const errMsg = getErrorMessage(hbErr);
        log(`No se pudo contactar al servidor SIPE en ${config.serverUrl}: ${errMsg}`, 'WARN');
        maybeLogPrivateUrlHint(errMsg);
    }

    await syncAttendances();

    // Heartbeat de salud cada 30s (solo reporta 'online' si el último ciclo alcanzó el reloj)
    setInterval(async () => {
        if (isShuttingDown) return;
        try {
            const hb = await requestServer('/api/rh/biometric/heartbeat', 'POST', {
                status: lastDeviceReachable ? 'online' : 'error',
                device_info: { agent_version: AGENT_VERSION, node_version: process.version, platform: process.platform }
            });
            reconcileCursorWithServer(hb?.last_punch_time, hb?.total_server_logs);
            if (!isSyncing) {
                await handleHeartbeatUpdate(hb);
            }
        } catch { /* silencio en heartbeat secundario */ }
    }, 30000);
}

process.on('SIGINT', () => {
    isShuttingDown = true;
    log('Deteniendo conector biométrico...');
    if (syncTimeout) clearTimeout(syncTimeout);
    process.exit(0);
});

startAgent();
