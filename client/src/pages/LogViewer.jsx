import { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal, Pause, Play, Trash2 } from 'lucide-react';

const SERVICES = [
    { id: 'server', label: 'Servidor' },
    { id: 'dte-api', label: 'DTE API' },
    { id: 'webhook', label: 'Webhook' },
    { id: 'client', label: 'Cliente' },
];

const LogViewer = () => {
    const [activeService, setActiveService] = useState('server');
    const [logs, setLogs] = useState([]);
    const [paused, setPaused] = useState(false);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState(null);
    const containerRef = useRef(null);
    const eventSourceRef = useRef(null);
    const pausedLogsRef = useRef([]);
    const visibleRef = useRef(true);

    const connect = useCallback((service) => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        setLogs([]);
        setError(null);
        setConnected(false);
        pausedLogsRef.current = [];

        const token = localStorage.getItem('token');
        if (!token) {
            setError('No hay sesión activa');
            return;
        }

        const es = new EventSource(`/api/logs/stream/${service}?token=${encodeURIComponent(token)}`);

        es.onopen = () => setConnected(true);

        es.addEventListener('message', (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.type === 'ready') return;

                if (paused) {
                    pausedLogsRef.current.push(data.text);
                } else {
                    setLogs(prev => [...prev, data.text].slice(-500));
                }
            } catch {}
        });

        es.onerror = () => {
            setConnected(false);
        };

        eventSourceRef.current = es;
    }, [paused]);

    useEffect(() => {
        connect(activeService);
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, [activeService, connect]);

    useEffect(() => {
        const handleVisibility = () => {
            if (document.hidden) {
                visibleRef.current = false;
                if (eventSourceRef.current) {
                    eventSourceRef.current.close();
                    eventSourceRef.current = null;
                }
                setConnected(false);
            } else {
                visibleRef.current = true;
                connect(activeService);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [activeService, connect]);

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [logs]);

    const handlePause = () => {
        setPaused(p => !p);
        if (paused && pausedLogsRef.current.length > 0) {
            setLogs(prev => [...prev, ...pausedLogsRef.current].slice(-500));
            pausedLogsRef.current = [];
        }
    };

    const handleClear = () => {
        setLogs([]);
        pausedLogsRef.current = [];
    };

    const colorize = (line) => {
        if (!line) return '';
        const lower = line.toLowerCase();
        if (lower.includes('error') || lower.includes('error:')) return 'text-red-400';
        if (lower.includes('warn') || lower.includes('warning')) return 'text-yellow-400';
        if (lower.includes('info')) return 'text-blue-400';
        if (lower.includes('success') || lower.includes('ok')) return 'text-green-400';
        if (lower.includes('debug')) return 'text-gray-400';
        return 'text-slate-300';
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-indigo-400" />
                    <h1 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Visor de Logs en Tiempo Real</h1>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-[11px] text-slate-400">{connected ? 'Conectado' : 'Desconectado'}</span>
                </div>
            </div>

            <div className="flex gap-1 mb-3">
                {SERVICES.map(s => (
                    <button
                        key={s.id}
                        onClick={() => setActiveService(s.id)}
                        className={`px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
                            activeService === s.id
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-2 mb-2">
                <button
                    onClick={handlePause}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                        paused
                            ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                            : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                >
                    {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                    {paused ? 'Reanudar' : 'Pausar'}
                </button>
                <button
                    onClick={handleClear}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-transparent transition-colors"
                >
                    <Trash2 className="w-3 h-3" />
                    Limpiar
                </button>
            </div>

            {error && (
                <div className="mb-2 px-3 py-2 text-[12px] text-red-400 bg-red-500/10 rounded-lg border border-red-500/20">
                    {error}
                </div>
            )}

            <div
                ref={containerRef}
                className="flex-1 bg-slate-950/80 rounded-xl border border-slate-800/50 p-3 overflow-auto font-mono text-[12px] leading-relaxed"
                style={{ minHeight: 0 }}
            >
                {logs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-500 text-[13px]">
                        Esperando logs...
                    </div>
                ) : (
                    logs.map((line, i) => (
                        <div key={i} className={`${colorize(line)} whitespace-pre-wrap break-all`}>
                            {line}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default LogViewer;
