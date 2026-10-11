import { useRef, useEffect } from 'react';
import { Terminal, Trash2, CheckCircle2, XCircle, Clock, AlertTriangle, ArrowDown } from 'lucide-react';
import { formatTime } from '../../utils/dateUtils';

export default function CompanyDteTestConsole({ logs = [], onClear, isRunning }) {
    const consoleEndRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (consoleEndRef.current) {
            consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    return (
        <div className="bg-slate-900 rounded-xl border border-slate-800 flex flex-col h-[320px] overflow-hidden text-xs font-mono shadow-inner">
            {/* Console Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-950/80 border-b border-slate-800 text-slate-400 select-none">
                <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-emerald-400" />
                    <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                        Registro de Emisión en Vivo {isRunning && <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />}
                    </span>
                    <span className="text-[10px] text-slate-500">({logs.length} eventos)</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onClear}
                        disabled={logs.length === 0}
                        title="Limpiar registros"
                        className="p-1 hover:text-slate-200 text-slate-500 hover:bg-slate-800 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                        <Trash2 size={13} />
                    </button>
                    <button
                        onClick={() => consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                        title="Ir al final"
                        className="p-1 hover:text-slate-200 text-slate-500 hover:bg-slate-800 rounded transition-colors"
                    >
                        <ArrowDown size={13} />
                    </button>
                </div>
            </div>

            {/* Logs List */}
            <div ref={containerRef} className="flex-1 p-3 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700">
                {logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-1">
                        <Terminal size={24} className="opacity-40" />
                        <p className="text-[11px]">Consola lista. Inicia una prueba para visualizar los resultados de Hacienda en tiempo real.</p>
                    </div>
                ) : (
                    logs.map((log, idx) => {
                        const isSuccess = log.status === 'ACCEPTED' || log.status === 'PROCESADO' || log.success;
                        const isError = log.status === 'REJECTED' || log.status === 'ERROR' || log.isError;
                        const isPending = log.status === 'SENDING' || log.isPending;

                        return (
                            <div
                                key={idx}
                                className={`flex items-start gap-2 px-2 py-1.5 rounded transition-colors ${
                                    isSuccess ? 'bg-emerald-950/20 text-emerald-300 border-l-2 border-emerald-500' :
                                    isError ? 'bg-red-950/20 text-red-300 border-l-2 border-red-500' :
                                    isPending ? 'bg-indigo-950/20 text-indigo-300 border-l-2 border-indigo-500' :
                                    'bg-slate-800/40 text-slate-300'
                                }`}
                            >
                                <span className="text-[10px] text-slate-500 whitespace-nowrap mt-0.5">
                                    {log.timestamp ? formatTime(log.timestamp) : '--:--:--'}
                                </span>

                                <span className="mt-0.5 flex-shrink-0">
                                    {isSuccess && <CheckCircle2 size={13} className="text-emerald-400" />}
                                    {isError && <XCircle size={13} className="text-rose-400" />}
                                    {isPending && <Clock size={13} className="text-indigo-400 animate-spin" />}
                                    {!isSuccess && !isError && !isPending && <AlertTriangle size={13} className="text-amber-400" />}
                                </span>

                                <div className="flex-1 min-w-0 break-words">
                                    <span className="font-bold text-[11px] mr-1.5">
                                        [{log.testName || log.testType}]
                                    </span>
                                    <span>{log.message}</span>
                                    {log.codigoGeneracion && (
                                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                                            Gen: <span className="text-slate-300">{log.codigoGeneracion}</span>
                                            {log.selloRecepcion && (
                                                <span className="ml-2 text-emerald-400">
                                                    Sello: {log.selloRecepcion.substring(0, 16)}...
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {log.details && (
                                        <div className="text-[9px] text-rose-400/80 mt-0.5 italic">
                                            {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={consoleEndRef} />
            </div>
        </div>
    );
}
