const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const pool = require('../config/db');
const { parseJsonSafe } = require('./rhBiometricClockUsers.service');

const DEFAULT_PUBLIC_SERVER_URL = 'https://sys.sipesv.com';

const AGENT_SCRIPT_CANDIDATES = [
    path.resolve(__dirname, '../../../scripts/biometric-agent/biometric-agent.js'),
    path.resolve(process.cwd(), 'scripts/biometric-agent/biometric-agent.js'),
    path.resolve(__dirname, '../../scripts/biometric-agent/biometric-agent.js')
];

const AGENT_COMPATIBLE_PROTOCOLS = ['tcp', 'udp'];
const AGENT_COMPATIBLE_MODELS = ['ZKTeco TCP/UDP (Puerto 4370)', 'ZKTime / iClock / K40 / MB20 / UFace'];
const MIN_NODE_MAJOR = 18;
const AGENT_CHANGELOG = [
    'Conexión limpia por ciclo sin fuga de memoria ni sockets colgados en node-zklib',
    'Auto-actualización verificada por SHA-256 con respaldo automático (.bak) y modo automático o bajo confirmación',
    'Sincronización de catálogo de usuarios del reloj (zk.getUsers) y soporte para 50,000+ registros sin timeout',
    'Filtro anti-CMOS automático (descarta fechas corruptas como año 2000 o 2118)',
    'Soporte BOM UTF-8 en config.json/sync-state.json y auto-reparación de serverUrl en actualizador 1-clic'
];

let cachedManifest = {
    mtimeMs: 0,
    version: '2.2.1',
    sha256: null,
    filePath: null,
    release_date: '2026-11-26'
};

function isPrivateOrLocalHostname(hostname) {
    const h = String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
    if (!h) return true;
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') return true;
    if (/^127\./.test(h)) return true;
    if (/^10\./.test(h)) return true;
    if (/^192\.168\./.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
    if (/^169\.254\./.test(h)) return true;
    if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)) return true;
    return false;
}

function parseUrlOriginSafe(raw) {
    if (!raw || typeof raw !== 'string') return null;
    try {
        const u = new URL(raw.trim());
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        return { protocol: u.protocol.replace(':', ''), host: u.host, hostname: u.hostname, origin: u.origin };
    } catch {
        return null;
    }
}

function getPreferredLanIp() {
    const candidates = [];
    try {
        const nets = os.networkInterfaces();
        for (const name of Object.keys(nets)) {
            const isVirtual = /(vethernet|wsl|docker|hyper-v|virtual|vmware|vbox|tailscale|zerotier|loopback|nordlynx|tun|tap)/i.test(name);
            for (const net of nets[name] || []) {
                if (net.family !== 'IPv4' || net.internal) continue;
                const ip = net.address;
                let score = isVirtual ? 0 : 100;
                if (ip.startsWith('192.168.')) score += 50;
                else if (ip.startsWith('10.')) score += 40;
                else if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) score += 20;
                else if (/^169\.254\./.test(ip)) score -= 100;
                else if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) score -= 50;
                candidates.push({ ip, score });
            }
        }
    } catch { /* fallback */ }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.ip || '127.0.0.1';
}

function resolveBestServerUrl(req) {
    const envUrl = process.env.BIOMETRIC_SERVER_URL || process.env.PUBLIC_URL || process.env.APP_URL;
    const parsedEnv = parseUrlOriginSafe(envUrl);
    if (parsedEnv) return parsedEnv.origin;

    const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
    const isHttps = req?.protocol === 'https' || forwardedProto === 'https';

    const forwardedHost = String(req?.headers?.['x-forwarded-host'] || '').split(',')[0].trim();
    const rawHost = String(req?.get?.('host') || req?.headers?.host || '').trim();
    const originParsed = parseUrlOriginSafe(req?.headers?.origin);
    const refererParsed = parseUrlOriginSafe(req?.headers?.referer);

    const hostCandidates = [];
    if (forwardedHost) {
        const hostname = forwardedHost.split(':')[0];
        const proto = (isHttps || /\.sipesv\.com$/i.test(hostname)) ? 'https' : 'http';
        hostCandidates.push({ hostname, origin: `${proto}://${forwardedHost}` });
    }
    if (originParsed) hostCandidates.push({ hostname: originParsed.hostname, origin: originParsed.origin });
    if (refererParsed) hostCandidates.push({ hostname: refererParsed.hostname, origin: refererParsed.origin });
    if (rawHost) {
        const hostname = rawHost.split(':')[0];
        const proto = (isHttps || /\.sipesv\.com$/i.test(hostname)) ? 'https' : 'http';
        hostCandidates.push({ hostname, origin: `${proto}://${rawHost}` });
    }

    for (const c of hostCandidates) {
        if (!isPrivateOrLocalHostname(c.hostname)) {
            return c.origin.replace(/\/+$/, '');
        }
    }

    if (process.env.NODE_ENV === 'production') {
        return DEFAULT_PUBLIC_SERVER_URL;
    }

    const backendPort = process.env.PORT || 4000;
    return `http://${getPreferredLanIp()}:${backendPort}`;
}

function compareSemver(a, b) {
    const parse = (v) => String(v || '0.0.0').replace(/^[^0-9]*/, '').split('.').map(n => parseInt(n, 10) || 0);
    const pa = parse(a);
    const pb = parse(b);
    for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0) ? 1 : -1;
    }
    return 0;
}

function getAgentReleaseManifest() {
    for (const candidate of AGENT_SCRIPT_CANDIDATES) {
        if (!fs.existsSync(candidate)) continue;
        try {
            const stat = fs.statSync(candidate);
            if (cachedManifest.filePath === candidate && cachedManifest.mtimeMs === stat.mtimeMs) {
                return {
                    ...cachedManifest,
                    compatible_protocols: AGENT_COMPATIBLE_PROTOCOLS,
                    compatible_models: AGENT_COMPATIBLE_MODELS,
                    min_node_version: `${MIN_NODE_MAJOR}.0.0`,
                    changelog: AGENT_CHANGELOG
                };
            }
            const content = fs.readFileSync(candidate, 'utf8');
            const match = content.match(/AGENT_VERSION\s*=\s*['"]([^'"]+)['"]/);
            const version = match ? match[1] : '2.2.0';
            const sha256 = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
            cachedManifest = {
                mtimeMs: stat.mtimeMs,
                version,
                sha256,
                filePath: candidate,
                release_date: new Date(stat.mtimeMs).toISOString().slice(0, 10)
            };
            return {
                ...cachedManifest,
                compatible_protocols: AGENT_COMPATIBLE_PROTOCOLS,
                compatible_models: AGENT_COMPATIBLE_MODELS,
                min_node_version: `${MIN_NODE_MAJOR}.0.0`,
                changelog: AGENT_CHANGELOG
            };
        } catch { /* try next */ }
    }
    return {
        ...cachedManifest,
        compatible_protocols: AGENT_COMPATIBLE_PROTOCOLS,
        compatible_models: AGENT_COMPATIBLE_MODELS,
        min_node_version: `${MIN_NODE_MAJOR}.0.0`,
        changelog: AGENT_CHANGELOG
    };
}

function evaluateDeviceCompatibility(device, info = {}) {
    const manifest = getAgentReleaseManifest();
    const reasons = [];
    const protocol = String(device?.protocol || 'tcp').toLowerCase();
    if (!manifest.compatible_protocols.includes(protocol)) {
        reasons.push(`Protocolo "${protocol}" no soportado por el conector.`);
    }

    if (info.node_version) {
        const major = parseInt(String(info.node_version).replace(/^v/i, '').split('.')[0], 10);
        if (!isNaN(major) && major < MIN_NODE_MAJOR) {
            reasons.push(`Node.js en la PC (${info.node_version}) es inferior al mínimo recomendado (v${MIN_NODE_MAJOR}).`);
        }
    }

    const installedVersion = info.agent_version || null;
    const isOutdated = !installedVersion || compareSemver(manifest.version, installedVersion) > 0;
    const supportsRemoteUpdate = !!installedVersion && compareSemver(installedVersion, '2.1.0') >= 0;

    return {
        compatible: reasons.length === 0,
        reasons,
        installed_version: installedVersion || '1.x (antigua)',
        latest_version: manifest.version,
        release_date: manifest.release_date,
        is_outdated: isOutdated,
        supports_remote_update: supportsRemoteUpdate,
        compatible_protocols: manifest.compatible_protocols,
        compatible_models: manifest.compatible_models,
        min_node_version: manifest.min_node_version,
        changelog: manifest.changelog
    };
}

async function setDeviceUpdatePolicy(companyId, deviceId, policy) {
    const normalized = policy === 'prompt' ? 'prompt' : 'auto';
    const [rows] = await pool.query(
        'SELECT id, device_info FROM rh_biometric_devices WHERE id = ? AND company_id = ? LIMIT 1',
        [deviceId, companyId]
    );
    if (!rows.length) throw Object.assign(new Error('Dispositivo no encontrado.'), { status: 404 });

    const info = parseJsonSafe(rows[0].device_info);
    info.update_policy = normalized;

    await pool.query(
        'UPDATE rh_biometric_devices SET device_info = ? WHERE id = ? AND company_id = ?',
        [JSON.stringify(info), deviceId, companyId]
    );

    return {
        success: true,
        update_policy: normalized,
        message: normalized === 'auto'
            ? 'Modo de actualización automática activado para el conector.'
            : 'Modo de solicitud de confirmación activado (el conector esperará aprobación antes de actualizar).'
    };
}

async function requestRemoteDeviceUpdate(companyId, deviceId, userLabel = 'Admin') {
    const manifest = getAgentReleaseManifest();
    const [rows] = await pool.query(
        'SELECT * FROM rh_biometric_devices WHERE id = ? AND company_id = ? LIMIT 1',
        [deviceId, companyId]
    );
    if (!rows.length) throw Object.assign(new Error('Dispositivo no encontrado.'), { status: 404 });

    const dev = rows[0];
    const info = parseJsonSafe(dev.device_info);
    const compat = evaluateDeviceCompatibility(dev, info);

    if (!compat.compatible) {
        throw Object.assign(new Error(`El conector v${manifest.version} no es compatible: ${compat.reasons.join(' ')}`), { status: 400 });
    }

    info.pending_update_request = {
        target_version: manifest.version,
        target_sha256: manifest.sha256,
        requested_at: new Date().toISOString(),
        requested_by: userLabel
    };
    info.update_status = 'pending';
    delete info.update_error;

    await pool.query(
        'UPDATE rh_biometric_devices SET device_info = ? WHERE id = ? AND company_id = ?',
        [JSON.stringify(info), deviceId, companyId]
    );

    return {
        success: true,
        target_version: manifest.version,
        supports_remote_update: compat.supports_remote_update,
        message: compat.supports_remote_update
            ? `Orden de actualización a v${manifest.version} enviada. El conector se actualizará automáticamente en el próximo heartbeat (~30s).`
            : `Orden registrada, pero la PC aún ejecuta ${compat.installed_version}. Ejecute "actualizar-conector.bat" una sola vez en la PC de planta para activar futuras actualizaciones automáticas.`
    };
}

/**
 * Genera un script Windows 1-Clic (actualizar-conector.bat) pre-configurado para el dispositivo.
 * Detiene el conector anterior, descarga la última versión autenticada con x-agent-key,
 * preserva/crea config.json, limpia cursores CMOS corruptos y reinicia el conector.
 */
function buildOneClickUpdaterBat(device, serverUrl) {
    const cleanUrl = String(serverUrl || DEFAULT_PUBLIC_SERVER_URL).trim().replace(/\/+$/, '').replace(/[^a-zA-Z0-9.:/_-]/g, '');
    const agentKey = String(device.agent_key || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
    const deviceIp = String(device.ip_address || '').trim().replace(/[^a-zA-Z0-9.:_-]/g, '');
    const devicePort = parseInt(device.port, 10) || 4370;
    const commKey = parseInt(device.comm_key, 10) || 0;
    const protocol = device.protocol === 'udp' ? 'udp' : 'tcp';
    const companyId = parseInt(device.company_id, 10) || 1;
    const deviceId = parseInt(device.id, 10) || 1;
    const manifest = getAgentReleaseManifest();

    const syncConfigPs = [
        "$p = Join-Path $PWD 'config.json';",
        "$utf8 = New-Object System.Text.UTF8Encoding $false;",
        "$cfg = [ordered]@{};",
        "if (Test-Path $p) { try { $raw = [System.IO.File]::ReadAllText($p).TrimStart([char]0xFEFF); $old = $raw | ConvertFrom-Json; foreach ($prop in $old.PSObject.Properties) { $cfg[$prop.Name] = $prop.Value } } catch { Write-Host '[AVISO] config.json danado, regenerando...' } };",
        "$prevUrl = [string]$cfg['serverUrl'];",
        `$cfg['serverUrl'] = '${cleanUrl}';`,
        `$cfg['companyId'] = ${companyId};`,
        `$cfg['deviceId'] = ${deviceId};`,
        `$cfg['agentKey'] = '${agentKey}';`,
        `if ('${deviceIp}') { $cfg['deviceIp'] = '${deviceIp}' };`,
        `$cfg['devicePort'] = ${devicePort};`,
        `$cfg['commKey'] = ${commKey};`,
        `$cfg['protocol'] = '${protocol}';`,
        "if (-not $cfg.Contains('syncIntervalSeconds')) { $cfg['syncIntervalSeconds'] = 60 };",
        "$cfg['autoUpdate'] = $true;",
        "[System.IO.File]::WriteAllText($p, ($cfg | ConvertTo-Json -Depth 4), $utf8);",
        `if ($prevUrl -and $prevUrl -ne '${cleanUrl}') { Write-Host ('[OK] serverUrl actualizado: ' + $prevUrl + ' -> ${cleanUrl}') } else { Write-Host '[OK] config.json verificado (${cleanUrl}).' }`
    ].join(' ');

    const repairCmosPs = [
        "try {",
        "$p = Join-Path $PWD 'sync-state.json';",
        "$utf8 = New-Object System.Text.UTF8Encoding $false;",
        "$s = ([System.IO.File]::ReadAllText($p).TrimStart([char]0xFEFF)) | ConvertFrom-Json;",
        "if ($s.lastPunchTime -and [int]($s.lastPunchTime.Substring(0,4)) -gt (Get-Date).Year) {",
        "$s.lastPunchTime = $null;",
        "[System.IO.File]::WriteAllText($p, ($s | ConvertTo-Json -Depth 4), $utf8);",
        "Write-Host '[OK] Cursor CMOS futuro reparado.';",
        "}",
        "} catch {}"
    ].join(' ');

    return [
        '@echo off',
        'setlocal enabledelayedexpansion',
        `title Actualizador 1-Clic Conector Biometrico v${manifest.version} - SIPE WEB`,
        'color 0B',
        'cd /d "%~dp0"',
        '',
        'echo ======================================================================',
        `echo   ACTUALIZADOR AUTOMATICO CONECTOR ZKTECO v${manifest.version} (SIPE WEB)`,
        'echo ======================================================================',
        'echo Carpeta de instalacion: %cd%',
        'echo.',
        '',
        'echo [1/5] Deteniendo cualquier conector biometrico anterior...',
        'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like \'*biometric-agent*\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>nul',
        'timeout /t 2 /nobreak >nul',
        '',
        'echo [2/5] Verificando Node.js...',
        'set "NODE_CMD="',
        'where node >nul 2>nul && set "NODE_CMD=node"',
        'if not defined NODE_CMD if exist "%ProgramFiles%\\nodejs\\node.exe" set "NODE_CMD=%ProgramFiles%\\nodejs\\node.exe"',
        'if not defined NODE_CMD if exist "%ProgramFiles(x86)%\\nodejs\\node.exe" set "NODE_CMD=%ProgramFiles(x86)%\\nodejs\\node.exe"',
        'if not defined NODE_CMD if exist "%LOCALAPPDATA%\\Programs\\nodejs\\node.exe" set "NODE_CMD=%LOCALAPPDATA%\\Programs\\nodejs\\node.exe"',
        'if not defined NODE_CMD (',
        '  color 0C',
        '  echo [ERROR] Node.js no esta instalado. Descarguelo desde https://nodejs.org',
        '  pause',
        '  exit /b 1',
        ')',
        '',
        `echo [3/5] Descargando conector mas reciente (v${manifest.version}) desde ${cleanUrl}...`,
        'if exist "biometric-agent.js" copy /y "biometric-agent.js" "biometric-agent.js.bak" >nul 2>nul',
        `powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri '${cleanUrl}/api/rh/biometric/agent-script' -Headers @{'x-agent-key'='${agentKey}'} -OutFile 'biometric-agent.js.new'"`,
        'if %errorlevel% neq 0 (',
        '  color 0C',
        '  echo [ERROR] No se pudo descargar la actualizacion desde el servidor.',
        '  if exist "biometric-agent.js.new" del /f /q "biometric-agent.js.new"',
        '  pause',
        '  exit /b 1',
        ')',
        '"%NODE_CMD%" --check "biometric-agent.js.new" >nul 2>nul',
        'if %errorlevel% neq 0 (',
        '  color 0C',
        '  echo [ERROR] El archivo descargado no supero la verificacion de sintaxis.',
        '  del /f /q "biometric-agent.js.new"',
        '  pause',
        '  exit /b 1',
        ')',
        'move /y "biometric-agent.js.new" "biometric-agent.js" >nul',
        `echo [OK] biometric-agent.js actualizado a v${manifest.version}.`,
        '',
        'echo [4/5] Sincronizando configuracion (config.json) y reparando cursor CMOS...',
        `powershell -NoProfile -Command "${syncConfigPs}"`,
        'if exist "sync-state.json" (',
        `  powershell -NoProfile -Command "${repairCmosPs}"`,
        ')',
        'if not exist "node_modules\\node-zklib" (',
        '  echo [INFO] Instalando node-zklib...',
        `  if not exist "package.json" echo {"name":"sipe-biometric-agent","version":"${manifest.version}","private":true} > package.json`,
        '  call npm install node-zklib --no-audit --no-fund --omit=dev',
        ')',
        '',
        'echo [5/5] Iniciando el conector actualizado...',
        'echo.',
        ':run_loop',
        'set "BIOMETRIC_WRAPPER=1"',
        '"%NODE_CMD%" biometric-agent.js',
        'if %errorlevel% equ 42 (',
        '  timeout /t 2 /nobreak >nul',
        '  goto run_loop',
        ')',
        'pause',
        ''
    ].join('\r\n');
}

module.exports = {
    compareSemver,
    resolveBestServerUrl,
    getAgentReleaseManifest,
    evaluateDeviceCompatibility,
    setDeviceUpdatePolicy,
    requestRemoteDeviceUpdate,
    buildOneClickUpdaterBat
};
