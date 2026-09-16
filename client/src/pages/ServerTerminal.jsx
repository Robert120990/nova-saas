import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
    Terminal as TerminalIcon,
    Play,
    Trash2,
    Copy,
    Check,
    Server,
    Cpu,
    HardDrive,
    RefreshCw,
    Key,
    Shield,
    Globe,
    Clock,
    CornerDownLeft,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Folder,
    Maximize2,
    Minimize2,
    Download,
    Wifi
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const QUICK_COMMANDS = [
    { label: 'PM2 Estado', cmd: 'pm2 status', group: 'PM2' },
    { label: 'PM2 Logs (50)', cmd: 'pm2 logs --lines 50 --nostream', group: 'PM2' },
    { label: 'Git Estado', cmd: 'git status', group: 'Git' },
    { label: 'Git Últimos Commits', cmd: 'git log -n 5 --oneline', group: 'Git' },
    { label: 'Espacio Disco (df -h)', cmd: 'df -h', group: 'Sistema' },
    { label: 'Memoria RAM (free -m)', cmd: 'free -m', group: 'Sistema' },
    { label: 'Uptime & Carga', cmd: 'uptime', group: 'Sistema' },
    { label: 'Procesos Top', cmd: 'ps aux --sort=-%mem | head -n 15', group: 'Sistema' },
    { label: 'Puertos Escuchando', cmd: 'ss -tulpn || netstat -tuln', group: 'Red' },
    { label: 'Salud DTE API', cmd: 'curl -s http://localhost:5000/api/health || echo "DTE no responde"', group: 'Servicios' },
    { label: 'Salud Backend 4000', cmd: 'curl -I http://localhost:4000/api/changelog', group: 'Servicios' },
];

export default function ServerTerminal() {
    const { user } = useAuth();
    const [mode, setMode] = useState('local'); // 'local' | 'ssh'
    const [command, setCommand] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);
    const [outputHistory, setOutputHistory] = useState([
        {
            id: 'init-1',
            type: 'system',
            text: 'Terminal del Servidor SaaS v2.0 iniciada.\nEscriba un comando o seleccione un acceso rápido para comenzar.',
            timestamp: new Date().toLocaleTimeString(),
            cwd: '~'
        }
    ]);
    const [commandHistory, setCommandHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [currentCwd, setCurrentCwd] = useState('');
    const [sshCwd, setSshCwd] = useState('~');
    const [isCopied, setIsCopied] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // SSH Credentials State
    const [sshConfig, setSshConfig] = useState(() => {
        try {
            const saved = localStorage.getItem('nova_terminal_ssh_config');
            if (saved) return JSON.parse(saved);
        } catch {}
        return {
            host: '5.252.55.29',
            port: 22,
            username: 'root',
            password: '',
            privateKey: ''
        };
    });
    const [isTestingSsh, setIsTestingSsh] = useState(false);
    const [sshStatus, setSshStatus] = useState(null);

    const outputEndRef = useRef(null);
    const inputRef = useRef(null);

    // Obtener información del sistema y host
    const { data: sysData, refetch: refetchSysInfo, isFetching: isFetchingSys } = useQuery({
        queryKey: ['server-terminal-info'],
        queryFn: async () => {
            const res = await axios.get('/api/terminal/system-info');
            return res.data?.info || {};
        },
        staleTime: 30000,
        refetchOnWindowFocus: false
    });

    useEffect(() => {
        if (sysData?.initialCwd && !currentCwd) {
            setCurrentCwd(sysData.initialCwd);
        }
    }, [sysData, currentCwd]);

    // Auto-scroll al final del terminal
    useEffect(() => {
        outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [outputHistory, isExecuting]);

    // Guardar configuración SSH (sin contraseña por seguridad)
    const handleSaveSshConfig = (newConfig) => {
        setSshConfig(newConfig);
        try {
            const { password, ...safeConfig } = newConfig;
            localStorage.setItem('nova_terminal_ssh_config', JSON.stringify(safeConfig));
        } catch {}
    };

    // Probar conexión SSH
    const handleTestSsh = async () => {
        if (!sshConfig.host) {
            toast.error('Ingrese el host o IP del servidor SSH');
            return;
        }
        setIsTestingSsh(true);
        setSshStatus(null);
        try {
            const res = await axios.post('/api/terminal/ssh-test', {
                host: sshConfig.host,
                port: parseInt(sshConfig.port) || 22,
                username: sshConfig.username || 'root',
                password: sshConfig.password || undefined,
                privateKey: sshConfig.privateKey || undefined,
                timeout: 10000
            });

            if (res.data?.success) {
                setSshStatus({ success: true, message: res.data.message, latency: res.data.latencyMs });
                toast.success(`Conexión SSH exitosa (${res.data.latencyMs}ms)`);
            } else {
                setSshStatus({ success: false, message: res.data.message });
                toast.error(`Fallo de conexión SSH: ${res.data.message}`);
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            setSshStatus({ success: false, message: msg });
            toast.error(`Error de prueba SSH: ${msg}`);
        } finally {
            setIsTestingSsh(false);
        }
    };

    // Ejecutar comando
    const handleExecute = async (cmdToRun) => {
        const targetCmd = (cmdToRun !== undefined ? cmdToRun : command).trim();
        if (!targetCmd || isExecuting) return;

        // Comandos internos de la consola
        if (targetCmd.toLowerCase() === 'clear' || targetCmd.toLowerCase() === 'cls') {
            setOutputHistory([]);
            setCommand('');
            return;
        }

        setIsExecuting(true);
        setCommand('');
        setHistoryIndex(-1);

        // Agregar al historial de comandos
        setCommandHistory(prev => {
            const filtered = prev.filter(c => c !== targetCmd);
            return [targetCmd, ...filtered].slice(0, 50);
        });

        const entryId = Date.now().toString();
        const activePrompt = mode === 'local' 
            ? `${sysData?.currentUser || 'root'}@${sysData?.hostname || 'servidor'}:${currentCwd || '~'}$ ` 
            : `${sshConfig.username || 'root'}@${sshConfig.host || 'remote'}:${sshCwd || '~'}# `;

        // Guía si el usuario escribe "ssh ..." dentro de la terminal SSH
        if (mode === 'ssh' && (targetCmd.startsWith('ssh ') || targetCmd === 'ssh')) {
            setIsExecuting(false);
            setOutputHistory(prev => [
                ...prev,
                {
                    id: entryId,
                    type: 'command',
                    prompt: activePrompt,
                    cmd: targetCmd,
                    timestamp: new Date().toLocaleTimeString(),
                    mode: mode
                },
                {
                    id: entryId + '-ssh-hint',
                    type: 'output',
                    text: `💡 Ya estás en la sesión SSH hacia ${sshConfig.username}@${sshConfig.host}.\nNo necesitas escribir "ssh", escribe directamente el comando que deseas ejecutar en el servidor remoto (ejemplos: ls -la, pm2 status, pwd, df -h, etc.).`,
                    exitCode: 0,
                    success: true,
                    timestamp: new Date().toLocaleTimeString()
                }
            ]);
            return;
        }

        // Validación amigable si falta contraseña en modo SSH
        if (mode === 'ssh' && !sshConfig.password && !sshConfig.privateKey) {
            setIsExecuting(false);
            setOutputHistory(prev => [
                ...prev,
                {
                    id: entryId,
                    type: 'command',
                    prompt: activePrompt,
                    cmd: targetCmd,
                    timestamp: new Date().toLocaleTimeString(),
                    mode: mode
                },
                {
                    id: entryId + '-auth-err',
                    type: 'output',
                    text: `⚠️ Falta autenticación SSH:\nPor favor escribe la contraseña en el campo "Contraseña SSH" de la barra superior para conectarte a ${sshConfig.username}@${sshConfig.host}.\n\n💡 Tip: Si solo deseas correr comandos en este servidor sin ingresar contraseña, usa la pestaña "Servidor Local (Host Node.js)".`,
                    exitCode: 1,
                    success: false,
                    timestamp: new Date().toLocaleTimeString()
                }
            ]);
            toast.warning('Ingrese la contraseña SSH en la barra superior');
            return;
        }

        // Registrar comando en pantalla
        setOutputHistory(prev => [
            ...prev,
            {
                id: entryId,
                type: 'command',
                prompt: activePrompt,
                cmd: targetCmd,
                timestamp: new Date().toLocaleTimeString(),
                mode: mode
            }
        ]);

        try {
            let res;
            if (mode === 'local') {
                res = await axios.post('/api/terminal/execute', {
                    command: targetCmd,
                    cwd: currentCwd,
                    timeout: 45000
                });
            } else {
                res = await axios.post('/api/terminal/ssh-execute', {
                    host: sshConfig.host,
                    port: parseInt(sshConfig.port) || 22,
                    username: sshConfig.username || 'root',
                    password: sshConfig.password || undefined,
                    privateKey: sshConfig.privateKey || undefined,
                    command: targetCmd,
                    cwd: sshCwd === '~' ? '' : sshCwd,
                    timeout: 45000
                });
            }

            const data = res.data;
            if (mode === 'local' && data.cwd) {
                setCurrentCwd(data.cwd);
            } else if (mode === 'ssh' && data.cwd) {
                setSshCwd(data.cwd);
            }

            setOutputHistory(prev => [
                ...prev,
                {
                    id: entryId + '-res',
                    type: 'output',
                    text: data.output || data.stdout || data.stderr || '[Comando ejecutado sin salida]',
                    exitCode: data.exitCode ?? 0,
                    success: data.success,
                    executionTimeMs: data.executionTimeMs,
                    timestamp: new Date().toLocaleTimeString()
                }
            ]);
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Error de comunicación con el servidor';
            setOutputHistory(prev => [
                ...prev,
                {
                    id: entryId + '-err',
                    type: 'output',
                    text: `Error de ejecución: ${errorMsg}`,
                    exitCode: 1,
                    success: false,
                    timestamp: new Date().toLocaleTimeString()
                }
            ]);
            toast.error(`Error: ${errorMsg}`);
        } finally {
            setIsExecuting(false);
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    };

    // Navegación con flechas arriba/abajo en historial
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleExecute();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length === 0) return;
            const nextIndex = historyIndex + 1 < commandHistory.length ? historyIndex + 1 : historyIndex;
            setHistoryIndex(nextIndex);
            setCommand(commandHistory[nextIndex] || '');
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const prevIndex = historyIndex - 1;
                setHistoryIndex(prevIndex);
                setCommand(commandHistory[prevIndex] || '');
            } else if (historyIndex === 0) {
                setHistoryIndex(-1);
                setCommand('');
            }
        } else if (e.key === 'l' && e.ctrlKey) {
            e.preventDefault();
            setOutputHistory([]);
        }
    };

    // Copiar todo el log
    const handleCopyLog = () => {
        const text = outputHistory.map(entry => {
            if (entry.type === 'command') return `${entry.prompt}${entry.cmd}`;
            return entry.text;
        }).join('\n');

        navigator.clipboard.writeText(text);
        setIsCopied(true);
        toast.success('Registro de la terminal copiado al portapapeles');
        setTimeout(() => setIsCopied(false), 2000);
    };

    // Descargar log
    const handleDownloadLog = () => {
        const text = outputHistory.map(entry => {
            if (entry.type === 'command') return `[${entry.timestamp}] ${entry.prompt}${entry.cmd}`;
            return `[${entry.timestamp}] ${entry.text}`;
        }).join('\n');

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `terminal-log-${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className={`space-y-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-900 p-4 overflow-y-auto' : 'p-4 md:p-6 max-w-7xl mx-auto'}`}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-900 text-emerald-400 shadow-md">
                        <TerminalIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            Terminal del Servidor
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-300 dark:border-emerald-800">
                                SSH / Host Shell
                            </span>
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Ejecución directa de comandos en el servidor host y conexión SSH remota para mantenimiento y soporte.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => refetchSysInfo()}
                        disabled={isFetchingSys}
                        title="Actualizar estado del servidor"
                        className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition"
                    >
                        <RefreshCw className={`w-4 h-4 ${isFetchingSys ? 'animate-spin text-indigo-600' : ''}`} />
                    </button>
                    <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                        className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition"
                    >
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* System Info Bar */}
            {sysData && sysData.hostname && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                        <Server className="w-5 h-5 text-indigo-500 shrink-0" />
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Host</div>
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate" title={sysData.hostname}>
                                {sysData.hostname}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                        <Cpu className="w-5 h-5 text-blue-500 shrink-0" />
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SO / Plataforma</div>
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                                {sysData.platform} ({sysData.arch})
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                        <HardDrive className="w-5 h-5 text-emerald-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                                <span>RAM Usada</span>
                                <span>{sysData.memoryUsagePct}%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 mt-1 overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${sysData.memoryUsagePct > 85 ? 'bg-red-500' : sysData.memoryUsagePct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(sysData.memoryUsagePct, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                        <Clock className="w-5 h-5 text-amber-500 shrink-0" />
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Uptime</div>
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                                {sysData.uptimeFormatted || '0s'}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                        <Shield className="w-5 h-5 text-purple-500 shrink-0" />
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Usuario / Node</div>
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                                {sysData.currentUser} ({sysData.nodeVersion})
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                        <Wifi className="w-5 h-5 text-teal-500 shrink-0" />
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Módulo SSH</div>
                            <div className="text-xs font-semibold flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                ssh2 Activo
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Mode Selector & SSH Credentials */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Tabs */}
                    <div className="flex rounded-xl bg-slate-100 dark:bg-slate-700/60 p-1 border border-slate-200 dark:border-slate-700">
                        <button
                            onClick={() => setMode('local')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                                mode === 'local'
                                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                        >
                            <Server className="w-3.5 h-3.5" />
                            Servidor Local (Host Node.js)
                        </button>
                        <button
                            onClick={() => setMode('ssh')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                                mode === 'ssh'
                                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                        >
                            <Globe className="w-3.5 h-3.5" />
                            Conexión SSH Remota
                        </button>
                    </div>

                    {/* Mode Hint */}
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Folder className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono text-[11px] truncate max-w-xs md:max-w-md" title={mode === 'local' ? currentCwd : sshCwd}>
                            {mode === 'local' ? (currentCwd || 'process.cwd()') : `${sshConfig.username}@${sshConfig.host}:${sshCwd || '~'}`}
                        </span>
                    </div>
                </div>

                {/* SSH Configuration Drawer */}
                {mode === 'ssh' && (
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-700/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase">Servidor / Host IP</label>
                            <input
                                type="text"
                                value={sshConfig.host}
                                onChange={(e) => handleSaveSshConfig({ ...sshConfig, host: e.target.value })}
                                placeholder="5.252.55.29"
                                className="w-full mt-1 px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase">Puerto</label>
                            <input
                                type="number"
                                value={sshConfig.port}
                                onChange={(e) => handleSaveSshConfig({ ...sshConfig, port: e.target.value })}
                                placeholder="22"
                                className="w-full mt-1 px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase">Usuario</label>
                            <input
                                type="text"
                                value={sshConfig.username}
                                onChange={(e) => handleSaveSshConfig({ ...sshConfig, username: e.target.value })}
                                placeholder="root"
                                className="w-full mt-1 px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase">Contraseña SSH</label>
                            <input
                                type="password"
                                value={sshConfig.password}
                                onChange={(e) => setSshConfig({ ...sshConfig, password: e.target.value })}
                                placeholder="••••••••••••"
                                className="w-full mt-1 px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleTestSsh}
                                disabled={isTestingSsh || !sshConfig.host}
                                className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                            >
                                {isTestingSsh ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Wifi className="w-3.5 h-3.5" />
                                )}
                                Probar Conexión
                            </button>
                        </div>

                        {sshStatus && (
                            <div className={`col-span-full text-xs p-2 rounded-lg flex items-center gap-2 ${
                                sshStatus.success 
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                                    : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                            }`}>
                                {sshStatus.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                                <span>{sshStatus.message}</span>
                                {sshStatus.latency && <span className="font-bold">({sshStatus.latency} ms)</span>}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Quick Commands Bar */}
            <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Play className="w-3 h-3 text-indigo-500" />
                    Comandos Rápidos de Mantenimiento
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {QUICK_COMMANDS.map((item, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleExecute(item.cmd)}
                            disabled={isExecuting}
                            className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/70 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <span className="font-sans text-[9px] font-bold px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 uppercase">
                                {item.group}
                            </span>
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Terminal Window */}
            <div className="bg-slate-950 text-slate-200 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col font-mono">
                {/* Terminal Header Bar */}
                <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs select-none">
                    <div className="flex items-center gap-2">
                        {/* Traffic lights */}
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 cursor-pointer" onClick={() => setOutputHistory([])} title="Limpiar terminal" />
                            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                        </div>
                        <span className="text-slate-400 font-sans text-xs ml-2 font-medium flex items-center gap-1">
                            <TerminalIcon className="w-3.5 h-3.5 text-emerald-400" />
                            {mode === 'local' ? 'Terminal Host Local' : `SSH: ${sshConfig.username}@${sshConfig.host}`}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={handleCopyLog}
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                            title="Copiar salida"
                        >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                            onClick={handleDownloadLog}
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                            title="Descargar log"
                        >
                            <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => setOutputHistory([])}
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                            title="Limpiar pantalla"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Output Screen */}
                <div 
                    onClick={() => inputRef.current?.focus()}
                    className="p-4 overflow-y-auto space-y-2 text-[12.5px] leading-relaxed cursor-text min-h-[360px] max-h-[550px] selection:bg-indigo-500/30 selection:text-white"
                >
                    {outputHistory.map((item) => {
                        if (item.type === 'system') {
                            return (
                                <div key={item.id} className="text-slate-500 text-xs py-1 border-b border-slate-800/80 mb-2">
                                    <pre className="font-mono whitespace-pre-wrap">{item.text}</pre>
                                </div>
                            );
                        }

                        if (item.type === 'command') {
                            return (
                                <div key={item.id} className="flex items-baseline gap-2 pt-2 text-slate-300">
                                    <span className="text-emerald-400 font-semibold select-none">{item.prompt}</span>
                                    <span className="text-white font-medium">{item.cmd}</span>
                                    <span className="text-[10px] text-slate-600 ml-auto select-none">{item.timestamp}</span>
                                </div>
                            );
                        }

                        if (item.type === 'output') {
                            return (
                                <div key={item.id} className="pl-2 border-l-2 border-slate-800">
                                    <pre className={`whitespace-pre-wrap break-all ${
                                        item.exitCode === 0 
                                            ? 'text-slate-300' 
                                            : 'text-red-400'
                                    }`}>
                                        {item.text}
                                    </pre>
                                    {item.executionTimeMs !== undefined && (
                                        <div className="text-[10px] text-slate-600 mt-1 flex items-center gap-2 select-none">
                                            <span>Estado: {item.exitCode === 0 ? '✓ Exitoso' : `✗ Código ${item.exitCode}`}</span>
                                            <span>•</span>
                                            <span>{item.executionTimeMs} ms</span>
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        return null;
                    })}

                    {isExecuting && (
                        <div className="flex items-center gap-2 text-indigo-400 text-xs py-1 animate-pulse">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Ejecutando comando en el servidor...</span>
                        </div>
                    )}

                    <div ref={outputEndRef} />
                </div>

                {/* Command Input Bar */}
                <div className="bg-slate-900 border-t border-slate-800 p-2.5 flex items-center gap-2">
                    <span className="text-emerald-400 font-bold select-none text-xs pl-2">
                        {mode === 'local' ? '$' : '#'}
                    </span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isExecuting}
                        placeholder={
                            isExecuting
                                ? 'Ejecutando comando...'
                                : mode === 'local'
                                ? 'Escriba un comando (ej: pm2 status, git status, df -h, ls -la)...'
                                : `Escriba un comando SSH para ${sshConfig.host}...`
                        }
                        className="flex-1 bg-transparent border-none outline-none text-white text-xs font-mono placeholder:text-slate-600 focus:ring-0"
                        autoFocus
                    />
                    <button
                        onClick={() => handleExecute()}
                        disabled={isExecuting || !command.trim()}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-sans font-semibold flex items-center gap-1.5 transition"
                    >
                        {isExecuting ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                            <CornerDownLeft className="w-3 h-3" />
                        )}
                        Ejecutar
                    </button>
                </div>
            </div>

            {/* Terminal Helper & Shortcuts Guide */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-500 dark:text-slate-400">
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <div className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        Historial de Comandos
                    </div>
                    <p className="text-[11px]">
                        Presione <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600">↑</kbd> y <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600">↓</kbd> para navegar entre comandos previos.
                    </p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <div className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5 text-amber-500" />
                        Limpiar Pantalla
                    </div>
                    <p className="text-[11px]">
                        Escriba <code className="text-indigo-600 dark:text-indigo-400">clear</code> o presione <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600">Ctrl + L</kbd> para limpiar la salida.
                    </p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                    <div className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-purple-500" />
                        Navegación de Carpetas
                    </div>
                    <p className="text-[11px]">
                        Use <code className="text-indigo-600 dark:text-indigo-400">cd &lt;directorio&gt;</code> para cambiar de carpeta de forma persistente en la sesión.
                    </p>
                </div>
            </div>
        </div>
    );
}
