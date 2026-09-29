/**
 * ============================================================================
 * CONECTOR LOCAL DE MARCADOR DIGITAL ZKTECO — RECURSOS HUMANOS (SIPE WEB)
 * ============================================================================
 * Este conector se ejecuta en una computadora dentro de la red local (LAN)
 * donde está conectado el reloj biométrico ZKTeco (IP: 192.168.3.201, Puerto: 4370).
 *
 * Funciones principales:
 * 1. Conecta con el reloj biométrico vía protocolo ZK nativo por TCP socket (4370).
 * 2. Extrae automáticamente las marcaciones de asistencia (huella, rostro, tarjeta, PIN).
 * 3. Transmite las marcaciones al servidor SaaS (sys.sipesv.com o local) vía HTTPS seguro.
 * 4. Escucha eventos en tiempo real para reflejar las marcaciones al instante.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

let ZKLib;
try {
    ZKLib = require('node-zklib');
} catch (e) {
    try {
        ZKLib = require(path.join(__dirname, 'node_modules', 'node-zklib'));
    } catch (e2) {
        console.error('\n[ERROR FATAL] La librería node-zklib no está instalada.');
        console.error('Por favor ejecute: npm install node-zklib\n');
        process.exit(1);
    }
}

// Cargar configuración local
const configPath = path.join(__dirname, 'config.json');
let config = {
    serverUrl: 'http://localhost:4000',
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

// Parámetros por línea de comandos
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--server' && args[i + 1]) config.serverUrl = args[++i];
    if (args[i] === '--key' && args[i + 1]) config.agentKey = args[++i];
    if (args[i] === '--ip' && args[i + 1]) config.deviceIp = args[++i];
    if (args[i] === '--port' && args[i + 1]) config.devicePort = parseInt(args[++i], 10);
    if (args[i] === '--interval' && args[i + 1]) config.syncIntervalSeconds = parseInt(args[++i], 10);
}

function log(msg, type = 'INFO') {
    const time = new Date().toLocaleTimeString('es-SV', { hour12: false });
    const prefix = type === 'ERROR' ? '❌ [ERROR]' : type === 'WARN' ? '⚠️ [AVISO]' : type === 'SUCCESS' ? '✅ [ÉXITO]' : 'ℹ️ [INFO]';
    console.log(`[${time}] ${prefix} ${msg}`);
}

/**
 * Petición HTTP/HTTPS al servidor SIPE SaaS
 */
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
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    'x-agent-key': config.agentKey
                },
                rejectUnauthorized: false, // Permite certificados autofirmados si los hubiese
                timeout: 15000
            };

            const req = client.request(options, (res) => {
                let responseBody = '';
                res.on('data', chunk => responseBody += chunk);
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

            req.on('error', (err) => reject(err));
            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout de conexión con el servidor SIPE')); });
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
let lastSyncedCount = 0;

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

        // Obtener información del equipo
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

        // Notificar latido inicial al servidor SaaS
        try {
            await sendToServer('/api/rh/biometric/heartbeat', 'POST', {
                status: 'online',
                device_info: info
            });
            log('Estado [ONLINE] reportado al servidor SIPE SaaS.', 'SUCCESS');
        } catch (serverErr) {
            log(`No se pudo reportar estado al servidor: ${serverErr.message}`, 'WARN');
        }

        // Iniciar escucha en tiempo real si está habilitado
        if (config.realTimeEnabled && typeof zk.getRealTimeLogs === 'function') {
            try {
                await zk.getRealTimeLogs(async (event) => {
                    if (event && (event.userId || event.uid || event.user_id)) {
                        log(`🔔 Marcación detectada en tiempo real: Empleado PIN: ${event.userId || event.user_id}`);
                        try {
                            const singlePunch = [{
                                device_uid: event.userId || event.user_id,
                                punch_time: event.attTime || event.time || new Date().toISOString(),
                                punch_code: event.state || 0,
                                verify_type: event.verifyType || 1,
                                source: 'biometric'
                            }];
                            await sendToServer('/api/rh/biometric/sync', 'POST', { punches: singlePunch });
                            log(`✓ Marcación en tiempo real sincronizada con SIPE`, 'SUCCESS');
                        } catch (e) {
                            log(`Error enviando marcación en tiempo real: ${e.message}`, 'WARN');
                        }
                    }
                });
                log('Modo de escucha en tiempo real activado.', 'SUCCESS');
            } catch (rtErr) {
                log(`Modo en tiempo real no soportado por este firmware (se usará polling cada ${config.syncIntervalSeconds}s).`, 'WARN');
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
        const logsList = (attendances && Array.isArray(attendances.data)) ? attendances.data : (Array.isArray(attendances) ? attendances : []);

        log(`Registros leídos del dispositivo: ${logsList.length} marcaciones.`);

        if (logsList.length > 0) {
            // Mapear al formato esperado por el backend
            const punchesPayload = logsList.map(item => ({
                device_uid: String(item.deviceUserId || item.userId || item.user_id || item.uid || ''),
                punch_time: item.recordTime || item.attTime || item.timestamp,
                punch_code: typeof item.punch === 'number' ? item.punch : (typeof item.state === 'number' ? item.state : 0),
                verify_type: typeof item.verifyType === 'number' ? item.verifyType : 1,
                raw_data: item
            }));

            // Enviar en bloques de 500 registros para optimizar red
            const chunkSize = 500;
            let totalInserted = 0;

            for (let i = 0; i < punchesPayload.length; i += chunkSize) {
                const chunk = punchesPayload.slice(i, i + chunkSize);
                const res = await sendToServer('/api/rh/biometric/sync', 'POST', {
                    punches: chunk,
                    device_info: {
                        last_sync_logs: logsList.length,
                        sync_time: new Date().toISOString()
                    }
                });
                totalInserted += (res.insertedCount || 0);
            }

            if (totalInserted > 0) {
                log(`🎉 ${totalInserted} marcaciones NUEVAS sincronizadas exitosamente en SIPE SaaS.`, 'SUCCESS');
            } else {
                log(`Marcaciones al día en el servidor (sin registros nuevos).`);
            }
            lastSyncedCount = logsList.length;
        } else {
            log('El dispositivo no contiene marcaciones almacenadas actualmente.');
        }
    } catch (err) {
        log(`Error durante la sincronización: ${err.message}`, 'ERROR');
        // Si el socket murió, forzar reconexión en el siguiente ciclo
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
    console.clear();
    console.log('========================================================================');
    console.log('   CONECTOR LOCAL MARCADOR DIGITAL ZKTECO — RECURSOS HUMANOS (SIPE)     ');
    console.log('========================================================================');
    console.log(` Servidor SaaS      : ${config.serverUrl}`);
    console.log(` Empresa ID         : ${config.companyId}`);
    console.log(` Dispositivo IP     : ${config.deviceIp}:${config.devicePort} (${config.protocol.toUpperCase()})`);
    console.log(` Intervalo de Sync  : Cada ${config.syncIntervalSeconds} segundos`);
    console.log(` Clave de Agente    : ${config.agentKey ? (config.agentKey.slice(0, 8) + '...' + config.agentKey.slice(-6)) : 'NO CONFIGURADA'}`);
    console.log('------------------------------------------------------------------------');

    if (!config.agentKey) {
        log('ADVERTENCIA: No ha configurado "agentKey" en config.json.', 'WARN');
        log('Copie la clave desde la pantalla de Marcador Digital en el sistema SIPE WEB.', 'WARN');
    }

    // Primera sincronización inmediata
    await syncAttendances();

    // Ciclo recurrente de sincronización
    const intervalMs = Math.max(10, config.syncIntervalSeconds) * 1000;
    syncTimer = setInterval(syncAttendances, intervalMs);

    // Heartbeat cada 60 segundos hacia el servidor
    setInterval(async () => {
        try {
            await sendToServer('/api/rh/biometric/heartbeat', 'POST', {
                status: isDeviceConnected ? 'online' : 'error'
            });
        } catch { /* silencio en heartbeat secundario */ }
    }, 60000);
}

// Cierre elegante
process.on('SIGINT', async () => {
    log('Deteniendo conector biométrico...');
    if (syncTimer) clearInterval(syncTimer);
    try {
        if (zk && isDeviceConnected) await zk.disconnect();
    } catch { /* ignore */ }
    process.exit(0);
});

startAgent();
