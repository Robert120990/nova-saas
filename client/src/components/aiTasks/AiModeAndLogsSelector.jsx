import { useRef } from 'react';
import { Upload, Terminal, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AI_EXECUTION_MODES, AGENT_PLATFORMS } from './aiTaskConstants';
import { analyzeDiagnosticRelevance } from '../../utils/ticketDiagnostics';

const AiModeAndLogsSelector = ({
    executionMode = 'api',
    onExecutionModeChange,
    agentPlatform = 'antigravity',
    onAgentPlatformChange,
    customLogs = '',
    onCustomLogsChange
}) => {
    const fileInputRef = useRef(null);

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            toast.error('El archivo de log supera el límite de 2 MB');
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const content = String(ev.target?.result || '').slice(0, 20000);
            const nextLogs = customLogs
                ? `${customLogs.trim()}\n\n--- [Archivo: ${file.name}] ---\n${content}`
                : `--- [Archivo: ${file.name}] ---\n${content}`;
            onCustomLogsChange(nextLogs);
            toast.success(`Log "${file.name}" cargado (${content.split('\n').length} líneas)`);
        };
        reader.onerror = () => toast.error('No se pudo leer el archivo de log');
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleCaptureBrowserLogs = () => {
        try {
            const diag = analyzeDiagnosticRelevance({
                currentRoute: window.location.pathname,
                subject: '',
                description: ''
            });
            const lines = [];
            lines.push(`--- [Telemetría Navegador ${new Date().toLocaleString('es-SV')}] ---`);
            if (Array.isArray(diag?.networkFailures) && diag.networkFailures.length > 0) {
                lines.push('>> Operaciones HTTP/API Fallidas:');
                diag.networkFailures.forEach((n) => {
                    lines.push(`[HTTP ${n.status || 'ERR'}] ${n.method} ${n.url} -> ${n.backendMessage || 'Sin detalle'} (Ruta: ${n.route || '/'})`);
                });
            }
            if (Array.isArray(diag?.consoleErrors) && diag.consoleErrors.length > 0) {
                lines.push('>> Errores en Consola JS / Runtime:');
                diag.consoleErrors.forEach((c) => {
                    lines.push(`[${c.kind}] ${c.message} (Ruta: ${c.route || '/'})`);
                });
            }
            if (lines.length === 1) {
                lines.push('Sin errores recientes en el buffer del explorador en esta sesión.');
            }
            const next = customLogs ? `${customLogs.trim()}\n\n${lines.join('\n')}` : lines.join('\n');
            onCustomLogsChange(next);
            toast.success('Logs recientes del explorador agregados');
        } catch {
            toast.error('No se pudieron capturar los logs del explorador');
        }
    };

    return (
        <div className="space-y-3 p-3 bg-slate-50/90 rounded-2xl border border-slate-200">
            {/* 1. Selector de los 2 Modos de IA */}
            <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">
                    Modo de Resolución IA (2 Modos Configurables)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.values(AI_EXECUTION_MODES).map((m) => {
                        const active = executionMode === m.id;
                        return (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => onExecutionModeChange(m.id)}
                                className={`text-left p-2.5 rounded-xl border transition-all ${
                                    active
                                        ? 'border-indigo-600 bg-white ring-2 ring-indigo-500/15 shadow-xs'
                                        : 'border-slate-200 bg-white/70 hover:bg-white text-slate-600'
                                }`}
                            >
                                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                                    <span>{m.icon}</span>
                                    <span>{m.label}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{m.desc}</p>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 2. Selector de Plataforma de Agente Externo (cuando está en Modo 2) */}
            {executionMode === 'agent_prompt' && (
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1.5">
                        <Sparkles size={12} className="text-purple-600" />
                        <span>Plataforma de Agente Destino para el Prompt</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {Object.values(AGENT_PLATFORMS).map((plat) => (
                            <button
                                key={plat.id}
                                type="button"
                                onClick={() => onAgentPlatformChange(plat.id)}
                                className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                                    agentPlatform === plat.id
                                        ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-xs'
                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <span>{plat.icon}</span>
                                <span className="truncate">{plat.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 3. Cargador y Editor de Logs del Usuario */}
            <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                        <Terminal size={13} className="text-indigo-600" />
                        <span>Cargar Logs para Diagnóstico / Prompt (.log, .txt, Consola o Servidor)</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".log,.txt,.json,.md,.csv"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold transition-all"
                        >
                            <Upload size={12} />
                            <span>Subir archivo .log / .txt</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleCaptureBrowserLogs}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold transition-all"
                        >
                            <Terminal size={12} />
                            <span>Capturar Logs Explorador</span>
                        </button>
                        {customLogs && (
                            <button
                                type="button"
                                onClick={() => onCustomLogsChange('')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-[11px] font-bold"
                                title="Limpiar logs"
                            >
                                <Trash2 size={11} />
                            </button>
                        )}
                    </div>
                </div>
                <textarea
                    rows={3}
                    value={customLogs}
                    onChange={(e) => onCustomLogsChange(e.target.value)}
                    placeholder="Pega aquí líneas de error de consola (F12), respuestas HTTP 500, trazas de servidor o sube un archivo .log/.txt para empaquetarlo en el prompt del agente..."
                    className="w-full bg-slate-900 text-emerald-300 font-mono text-[11px] rounded-xl p-2.5 border border-slate-700 focus:outline-none focus:border-indigo-500 resize-y"
                />
            </div>
        </div>
    );
};

export default AiModeAndLogsSelector;
