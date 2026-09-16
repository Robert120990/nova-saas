const os = require('os');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
let ssh2 = null;
try {
    ssh2 = require('ssh2');
} catch (err) {
    console.warn('[Terminal] ssh2 module not available:', err.message);
}

// Formatear duración de uptime
function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (parts.length === 0 || s > 0) parts.push(`${s}s`);
    return parts.join(' ');
}

// 1. Obtener información de estado del servidor
const getSystemInfo = async (req, res) => {
    try {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memoryUsagePct = ((usedMem / totalMem) * 100).toFixed(1);

        const cpus = os.cpus() || [];
        const cpuModel = cpus.length > 0 ? cpus[0].model : 'N/A';

        let currentUser = 'root';
        try {
            currentUser = os.userInfo().username;
        } catch {
            currentUser = process.env.USER || process.env.USERNAME || 'unknown';
        }

        res.json({
            success: true,
            info: {
                hostname: os.hostname(),
                platform: os.platform(),
                release: os.release(),
                arch: os.arch(),
                type: os.type(),
                uptimeSeconds: Math.floor(os.uptime()),
                uptimeFormatted: formatUptime(os.uptime()),
                totalMemBytes: totalMem,
                freeMemBytes: freeMem,
                usedMemBytes: usedMem,
                memoryUsagePct: parseFloat(memoryUsagePct),
                cpuModel: cpuModel.trim(),
                cpuCores: cpus.length,
                currentUser: currentUser,
                nodeVersion: process.version,
                initialCwd: process.cwd(),
                ssh2Available: !!ssh2,
                serverTime: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('[Terminal] Error al obtener info del sistema:', error);
        res.status(500).json({ success: false, message: 'Error al obtener información del servidor: ' + error.message });
    }
};

// 2. Ejecutar comando local en el host
const executeCommand = async (req, res) => {
    const startTime = Date.now();
    try {
        let { command, cwd, timeout = 45000 } = req.body;

        if (!command || typeof command !== 'string' || !command.trim()) {
            return res.status(400).json({ success: false, message: 'El comando a ejecutar es requerido.' });
        }

        command = command.trim();
        let activeCwd = cwd && typeof cwd === 'string' && fs.existsSync(cwd) ? path.resolve(cwd) : process.cwd();

        // Manejar comando nativo "cd" de manera interactiva
        if (command === 'cd' || command === 'cd ~') {
            const homeDir = os.homedir();
            return res.json({
                success: true,
                output: `Directorio de trabajo cambiado a: ${homeDir}`,
                stdout: `Directorio de trabajo cambiado a: ${homeDir}`,
                stderr: '',
                exitCode: 0,
                cwd: homeDir,
                executionTimeMs: Date.now() - startTime
            });
        }

        if (command.startsWith('cd ')) {
            const targetArg = command.substring(3).trim().replace(/^['"]|['"]$/g, '');
            const targetPath = path.resolve(activeCwd, targetArg);

            if (fs.existsSync(targetPath)) {
                const stat = fs.statSync(targetPath);
                if (stat.isDirectory()) {
                    return res.json({
                        success: true,
                        output: `Directorio de trabajo cambiado a: ${targetPath}`,
                        stdout: `Directorio de trabajo cambiado a: ${targetPath}`,
                        stderr: '',
                        exitCode: 0,
                        cwd: targetPath,
                        executionTimeMs: Date.now() - startTime
                    });
                } else {
                    return res.json({
                        success: false,
                        output: `Error: "${targetArg}" no es un directorio.`,
                        stdout: '',
                        stderr: `Error: "${targetArg}" no es un directorio.`,
                        exitCode: 1,
                        cwd: activeCwd,
                        executionTimeMs: Date.now() - startTime
                    });
                }
            } else {
                return res.json({
                    success: false,
                    output: `Error: El directorio "${targetArg}" no existe.`,
                    stdout: '',
                    stderr: `Error: El directorio "${targetArg}" no existe.`,
                    exitCode: 1,
                    cwd: activeCwd,
                    executionTimeMs: Date.now() - startTime
                });
            }
        }

        // Determinar shell según el sistema operativo
        const isWindows = process.platform === 'win32';
        const shell = isWindows ? (process.env.COMSPEC || 'powershell.exe') : (process.env.SHELL || '/bin/bash');

        const maxBuffer = 15 * 1024 * 1024; // 15MB buffer
        const execTimeout = Math.min(Math.max(parseInt(timeout) || 45000, 5000), 120000);

        exec(command, {
            cwd: activeCwd,
            timeout: execTimeout,
            maxBuffer: maxBuffer,
            shell: shell,
            env: {
                ...process.env,
                FORCE_COLOR: '1',
                COLUMNS: '120',
                LINES: '40'
            }
        }, (error, stdout, stderr) => {
            const executionTimeMs = Date.now() - startTime;
            const stdoutStr = stdout ? stdout.toString() : '';
            const stderrStr = stderr ? stderr.toString() : '';

            let combinedOutput = stdoutStr;
            if (stderrStr) {
                combinedOutput = combinedOutput ? `${combinedOutput}\n${stderrStr}` : stderrStr;
            }

            if (error) {
                const isTimeout = error.killed && error.signal === 'SIGTERM';
                const exitCode = typeof error.code === 'number' ? error.code : 1;
                return res.json({
                    success: false,
                    output: isTimeout 
                        ? (combinedOutput ? `${combinedOutput}\n` : '') + `[Error: Tiempo límite excedido (${execTimeout / 1000}s)]`
                        : (combinedOutput || error.message),
                    stdout: stdoutStr,
                    stderr: stderrStr || error.message,
                    exitCode: exitCode,
                    cwd: activeCwd,
                    executionTimeMs: executionTimeMs
                });
            }

            res.json({
                success: true,
                output: combinedOutput || '[Comando ejecutado exitosamente sin salida de texto]',
                stdout: stdoutStr,
                stderr: stderrStr,
                exitCode: 0,
                cwd: activeCwd,
                executionTimeMs: executionTimeMs
            });
        });

    } catch (error) {
        console.error('[Terminal] Error fatal en executeCommand:', error);
        res.status(500).json({
            success: false,
            message: 'Error al ejecutar comando: ' + error.message,
            executionTimeMs: Date.now() - startTime
        });
    }
};

// 3. Ejecutar comando vía conexión SSH remota
const executeSsh = async (req, res) => {
    const startTime = Date.now();
    try {
        const {
            host,
            port = 22,
            username = 'root',
            password,
            privateKey,
            passphrase,
            command,
            timeout = 45000
        } = req.body;

        if (!host || !host.trim()) {
            return res.status(400).json({ success: false, message: 'La dirección host SSH es requerida.' });
        }
        if (!command || !command.trim()) {
            return res.status(400).json({ success: false, message: 'El comando remoto a ejecutar es requerido.' });
        }

        if (!ssh2 || !ssh2.Client) {
            return res.status(500).json({
                success: false,
                message: 'El módulo nativo ssh2 no se encuentra disponible en el backend. Contacte al administrador.'
            });
        }

        const conn = new ssh2.Client();
        const execTimeout = Math.min(Math.max(parseInt(timeout) || 45000, 5000), 120000);

        let timeoutHandle = null;
        let isCompleted = false;

        const cleanup = () => {
            if (timeoutHandle) clearTimeout(timeoutHandle);
            try { conn.end(); } catch {}
        };

        timeoutHandle = setTimeout(() => {
            if (!isCompleted) {
                isCompleted = true;
                cleanup();
                return res.json({
                    success: false,
                    output: `[Error SSH: Tiempo límite excedido (${execTimeout / 1000}s)]`,
                    stdout: '',
                    stderr: 'Timeout de conexión o ejecución SSH',
                    exitCode: 124,
                    executionTimeMs: Date.now() - startTime
                });
            }
        }, execTimeout);

        conn.on('ready', () => {
            conn.exec(command, (err, stream) => {
                if (err) {
                    if (!isCompleted) {
                        isCompleted = true;
                        cleanup();
                        return res.json({
                            success: false,
                            output: `Error al iniciar comando remoto: ${err.message}`,
                            stdout: '',
                            stderr: err.message,
                            exitCode: 1,
                            executionTimeMs: Date.now() - startTime
                        });
                    }
                    return;
                }

                let stdoutStr = '';
                let stderrStr = '';

                stream.on('data', (data) => {
                    stdoutStr += data.toString();
                });

                stream.stderr.on('data', (data) => {
                    stderrStr += data.toString();
                });

                stream.on('close', (code, signal) => {
                    if (!isCompleted) {
                        isCompleted = true;
                        cleanup();

                        let combinedOutput = stdoutStr;
                        if (stderrStr) {
                            combinedOutput = combinedOutput ? `${combinedOutput}\n${stderrStr}` : stderrStr;
                        }

                        const exitCode = typeof code === 'number' ? code : (signal ? 1 : 0);

                        res.json({
                            success: exitCode === 0,
                            output: combinedOutput || '[Comando SSH ejecutado sin salida de texto]',
                            stdout: stdoutStr,
                            stderr: stderrStr,
                            exitCode: exitCode,
                            executionTimeMs: Date.now() - startTime
                        });
                    }
                });
            });
        });

        conn.on('error', (err) => {
            if (!isCompleted) {
                isCompleted = true;
                cleanup();
                res.json({
                    success: false,
                    output: `Fallo de autenticación / conexión SSH con ${username}@${host}:${port}: ${err.message}`,
                    stdout: '',
                    stderr: err.message,
                    exitCode: 1,
                    executionTimeMs: Date.now() - startTime
                });
            }
        });

        // Configuración de credenciales de conexión
        const sshConfig = {
            host: host.trim(),
            port: parseInt(port) || 22,
            username: username ? username.trim() : 'root',
            readyTimeout: 15000,
            keepaliveInterval: 5000,
        };

        if (password) {
            sshConfig.password = password;
        }
        if (privateKey) {
            sshConfig.privateKey = privateKey;
            if (passphrase) {
                sshConfig.passphrase = passphrase;
            }
        }

        conn.connect(sshConfig);

    } catch (error) {
        console.error('[Terminal] Error fatal en executeSsh:', error);
        res.status(500).json({
            success: false,
            message: 'Error al procesar solicitud SSH: ' + error.message,
            executionTimeMs: Date.now() - startTime
        });
    }
};

// 4. Probar conectividad SSH rápida
const testSshConnection = async (req, res) => {
    const startTime = Date.now();
    try {
        const {
            host,
            port = 22,
            username = 'root',
            password,
            privateKey,
            passphrase,
            timeout = 10000
        } = req.body;

        if (!host || !host.trim()) {
            return res.status(400).json({ success: false, message: 'La dirección host es requerida.' });
        }

        if (!ssh2 || !ssh2.Client) {
            return res.status(500).json({
                success: false,
                message: 'El módulo ssh2 no se encuentra disponible.'
            });
        }

        const conn = new ssh2.Client();
        let isDone = false;
        const testTimeout = Math.min(Math.max(parseInt(timeout) || 10000, 3000), 20000);

        const timer = setTimeout(() => {
            if (!isDone) {
                isDone = true;
                try { conn.end(); } catch {}
                return res.json({
                    success: false,
                    message: `Tiempo de espera agotado al conectar a ${host}:${port} (${testTimeout / 1000}s).`,
                    latencyMs: Date.now() - startTime
                });
            }
        }, testTimeout);

        conn.on('ready', () => {
            if (!isDone) {
                isDone = true;
                clearTimeout(timer);
                const latency = Date.now() - startTime;
                conn.end();
                return res.json({
                    success: true,
                    message: `Conexión SSH exitosa con ${username}@${host}:${port}`,
                    latencyMs: latency,
                    authenticated: true
                });
            }
        });

        conn.on('error', (err) => {
            if (!isDone) {
                isDone = true;
                clearTimeout(timer);
                const latency = Date.now() - startTime;
                return res.json({
                    success: false,
                    message: `Error al conectar por SSH: ${err.message}`,
                    latencyMs: latency,
                    authenticated: false
                });
            }
        });

        const sshConfig = {
            host: host.trim(),
            port: parseInt(port) || 22,
            username: username ? username.trim() : 'root',
            readyTimeout: testTimeout,
        };

        if (password) sshConfig.password = password;
        if (privateKey) {
            sshConfig.privateKey = privateKey;
            if (passphrase) sshConfig.passphrase = passphrase;
        }

        conn.connect(sshConfig);

    } catch (error) {
        res.status(500).json({ success: false, message: 'Error en prueba de conexión SSH: ' + error.message });
    }
};

module.exports = {
    getSystemInfo,
    executeCommand,
    executeSsh,
    testSshConnection
};
