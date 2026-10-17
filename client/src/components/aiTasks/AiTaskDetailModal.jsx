import { useState, useEffect, useRef } from 'react';
import Modal from '../ui/Modal';
import axios from 'axios';
import { toast } from 'sonner';
import { formatDateTime } from '../../utils/dateUtils';
import {
    Terminal, FileText, Clock, Copy, Check, RotateCcw, XCircle,
    Loader2, CheckCircle2, AlertOctagon, Sparkles, Brain, Wrench,
    ArrowRight, Pencil, ExternalLink
} from 'lucide-react';
import AiTaskMarkdownRenderer from './AiTaskMarkdownRenderer';
import { getTaskActivityMeta } from './aiTaskConstants';

const AGENT_MAP = {
    supervisor: { name: 'Supervisor', icon: '👑', color: 'text-amber-700 bg-amber-50 border-amber-200' },
    dte: { name: 'Fiscal & DTE', icon: '⚡', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
    accounting: { name: 'Contador CPA', icon: '⚖️', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    inventory: { name: 'Inventario', icon: '📦', color: 'text-sky-700 bg-sky-50 border-sky-200' },
    gas: { name: 'Combustibles', icon: '⛽', color: 'text-orange-700 bg-orange-50 border-orange-200' },
    sales: { name: 'Ventas', icon: '📈', color: 'text-purple-700 bg-purple-50 border-purple-200' },
    tech: { name: 'SysAdmin', icon: '🛠️', color: 'text-slate-700 bg-slate-100 border-slate-300' },
    support: { name: 'Soporte & Tickets', icon: '🎫', color: 'text-cyan-700 bg-cyan-50 border-cyan-200' }
};

const LOG_TYPE_STYLES = {
    thinking: { label: 'Pensamiento', icon: Brain, badge: 'text-purple-400 bg-purple-950/60 border-purple-800' },
    delegation: { label: 'Delegación', icon: ArrowRight, badge: 'text-amber-400 bg-amber-950/60 border-amber-800' },
    tool_call: { label: 'Herramienta', icon: Wrench, badge: 'text-cyan-400 bg-cyan-950/60 border-cyan-800' },
    tool_result: { label: 'Resultado', icon: CheckCircle2, badge: 'text-emerald-400 bg-emerald-950/60 border-emerald-800' },
    warning: { label: 'Aviso', icon: AlertOctagon, badge: 'text-yellow-400 bg-yellow-950/60 border-yellow-800' },
    error: { label: 'Error', icon: XCircle, badge: 'text-rose-400 bg-rose-950/60 border-rose-800' },
    info: { label: 'Info', icon: Terminal, badge: 'text-slate-400 bg-slate-800 border-slate-700' }
};

const AiTaskDetailModal = ({ isOpen, onClose, taskId, initialTab = 'logs', onTaskUpdated, onEdit, onOpenPdf }) => {
    const [task, setTask] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState(initialTab || 'logs');
    const [copied, setCopied] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
    const logContainerRef = useRef(null);

    useEffect(() => {
        if (!isOpen || !taskId) return;
        let isMounted = true;
        setLoading(true);

        axios.get(`/api/agent-tasks/${taskId}`)
            .then((res) => {
                if (!isMounted) return;
                const normalizedTask = res.data ? {
                    ...res.data,
                    output_file_url: typeof res.data.output_file_url === 'string' && res.data.output_file_url.startsWith('/uploads/')
                        ? `/api${res.data.output_file_url}`
                        : res.data.output_file_url
                } : null;
                setTask(normalizedTask);
                setLogs(res.data?.logs || []);
                if (initialTab === 'result' || res.data.result || res.data.output_file_url) {
                    setActiveTab('result');
                } else {
                    setActiveTab(initialTab || 'logs');
                }
            })
            .catch(() => toast.error('Error al cargar detalle de la tarea'))
            .finally(() => { if (isMounted) setLoading(false); });

        return () => { isMounted = false; };
    }, [isOpen, taskId, initialTab]);

    useEffect(() => {
        if (!isOpen || !taskId) return;
        let eventSource = null;
        try {
            eventSource = new EventSource(`/api/agent-tasks/${taskId}/stream`);
            eventSource.addEventListener('task_log', (e) => {
                try {
                    const newLog = JSON.parse(e.data);
                    setLogs((prev) => (prev.some((l) => l.id === newLog.id) ? prev : [...prev, newLog]));
                } catch { /* ignore */ }
            });
            eventSource.addEventListener('task_progress', (e) => {
                try {
                    const updates = JSON.parse(e.data);
                    setTask((prev) => (prev ? { ...prev, ...updates } : prev));
                    if (updates.status === 'completada' && updates.result) setActiveTab('result');
                    if (onTaskUpdated) onTaskUpdated();
                } catch { /* ignore */ }
            });
        } catch (err) {
            console.error('SSE Error:', err);
        }
        return () => { if (eventSource) eventSource.close(); };
    }, [isOpen, taskId, onTaskUpdated]);

    useEffect(() => {
        if (activeTab === 'logs' && logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs, activeTab]);

    if (!isOpen) return null;

    const handleCopyResult = () => {
        if (!task?.result) return;
        navigator.clipboard.writeText(task.result);
        setCopied(true);
        toast.success('Informe / Prompt copiado al portapapeles');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCancel = async () => {
        setIsCancelling(true);
        try {
            await axios.put(`/api/agent-tasks/${taskId}/cancel`);
            toast.success('Tarea cancelada');
            setTask((prev) => ({ ...prev, status: 'cancelada' }));
            if (onTaskUpdated) onTaskUpdated();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al cancelar la tarea');
        } finally {
            setIsCancelling(false);
        }
    };

    const handleRetry = async () => {
        setIsRetrying(true);
        try {
            await axios.post(`/api/agent-tasks/${taskId}/retry`);
            toast.success('Tarea actualizada / reencolada exitosamente');
            const res = await axios.get(`/api/agent-tasks/${taskId}`);
            if (res.data) {
                setTask(res.data);
                setLogs(res.data.logs || []);
            }
            if (onTaskUpdated) onTaskUpdated();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al reintentar la tarea');
        } finally {
            setIsRetrying(false);
        }
    };

    const agentInfo = AGENT_MAP[task?.assigned_agent_code] || AGENT_MAP.supervisor;
    const activityMeta = task ? getTaskActivityMeta(task) : null;
    const isRunning = task && ['analizando', 'en_proceso', 'pendiente'].includes(task.status) && activityMeta?.execMode !== 'agent_prompt';
    const canRetry = task && !isRunning;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={task ? `Tarea #${task.id}: ${task.title}` : 'Detalle de Tarea Agéntica'} maxWidth="max-w-4xl">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                    <Loader2 size={32} className="animate-spin text-indigo-600" />
                    <span className="text-xs font-semibold">Cargando bitácora de ejecución...</span>
                </div>
            ) : task ? (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wider ${
                                task.priority === 'alta' ? 'bg-rose-100 text-rose-700' :
                                task.priority === 'media' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                                Prioridad {task.priority}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${activityMeta.statusBadge.cls}`}>
                                {isRunning && <Loader2 size={12} className="animate-spin" />}
                                <span>{activityMeta.statusBadge.icon}</span>
                                <span>{activityMeta.statusBadge.label}</span>
                            </span>
                            {activityMeta.modeBadge && (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${activityMeta.modeBadge.cls}`}>
                                    <span>{activityMeta.modeBadge.icon}</span>
                                    <span>{activityMeta.modeBadge.label}</span>
                                </span>
                            )}
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${agentInfo.color}`}>
                                <span>{agentInfo.icon}</span>
                                <span>Agente: {agentInfo.name}</span>
                            </div>
                        </div>
                        <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                            <Clock size={13} />
                            <span>Iniciada: {formatDateTime(task.started_at || task.created_at)}</span>
                        </div>
                    </div>

                    <div className="space-y-2 bg-white p-3 rounded-2xl border border-slate-100 shadow-xs">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                            <span className="flex items-center gap-1.5 text-indigo-600 truncate max-w-[80%]">
                                {isRunning && <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>}
                                {task.current_step || 'En espera...'}
                            </span>
                            <span className="font-mono text-sm">{activityMeta.progress}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                    task.status === 'completada' ? 'bg-emerald-500' :
                                    task.status === 'fallida' ? 'bg-rose-500' : 'bg-indigo-600'
                                }`}
                                style={{ width: `${activityMeta.progress}%` }}
                            />
                        </div>
                        <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border ${activityMeta.humanCls}`}>
                            <span>{activityMeta.humanBadge}</span>
                            <span className="text-[11px] font-medium">{activityMeta.humanDetail}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 border-b border-slate-200">
                        <button type="button" onClick={() => setActiveTab('logs')} className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'logs' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                            <Terminal size={14} /><span>Bitácora en Vivo ({logs.length})</span>
                        </button>
                        <button type="button" onClick={() => setActiveTab('result')} className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'result' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                            <FileText size={14} /><span>{activityMeta.execMode === 'agent_prompt' ? `Paquete Prompt (${activityMeta.platform?.name})` : 'Informe Final'}</span>
                            {task.result && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                        </button>
                        <button type="button" onClick={() => setActiveTab('prompt')} className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold border-b-2 transition-all ${activeTab === 'prompt' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                            <Sparkles size={14} /><span>Prompt & Logs Cargados</span>
                        </button>
                    </div>

                    {activeTab === 'logs' && (
                        <div ref={logContainerRef} className="bg-slate-950 text-slate-200 p-3.5 rounded-2xl font-mono text-[11.5px] h-72 overflow-y-auto space-y-2 border border-slate-800 shadow-inner">
                            {logs.length === 0 ? (
                                <div className="text-slate-500 py-10 text-center flex flex-col items-center gap-2">
                                    <Terminal size={24} className="opacity-50" />
                                    <span>Esperando primeros eventos de ejecución...</span>
                                </div>
                            ) : (
                                logs.map((log) => {
                                    const meta = LOG_TYPE_STYLES[log.log_type] || LOG_TYPE_STYLES.info;
                                    const Icon = meta.icon;
                                    return (
                                        <div key={log.id} className="flex items-start gap-2 leading-relaxed hover:bg-slate-900/60 p-1 rounded-lg">
                                            <span className="text-[10px] text-slate-500 shrink-0 select-none pt-0.5">{formatDateTime(log.created_at).split(' ')[1] || '00:00:00'}</span>
                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold border shrink-0 ${meta.badge}`}>
                                                <Icon size={10} /><span>{log.agent_code}</span>
                                            </span>
                                            <span className="text-slate-300 break-words flex-1">{log.message}</span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {activeTab === 'result' && (
                        <div className="space-y-3">
                            {task.output_file_url && (
                                <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{task.output_type === 'pdf' ? '📄' : task.output_type === 'excel' ? '📊' : '🖼️'}</span>
                                        <div>
                                            <span className="text-xs font-bold text-slate-900 block">
                                                {task.output_type === 'pdf' ? 'Reporte Oficial en PDF Generado' : task.output_type === 'excel' ? 'Hoja de Cálculo Excel (.xlsx) Generada' : 'Gráfico / Infografía Visual Generada'}
                                            </span>
                                            <span className="text-[10px] text-slate-500">Compilado automáticamente con los estándares del sistema.</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {task.output_type === 'pdf' && (
                                            <button type="button" onClick={() => (onOpenPdf ? onOpenPdf(task.output_file_url) : window.open(task.output_file_url, '_blank'))} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all shadow-xs">
                                                <span>Ver PDF Oficial</span>
                                            </button>
                                        )}
                                        {task.output_type === 'excel' && (
                                            <a href={task.output_file_url} download target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xs">
                                                <span>Descargar Excel</span>
                                            </a>
                                        )}
                                        {(task.output_type === 'imagen' || /\.(svg|png|webp|jpe?g|gif)$/i.test(task.output_file_url)) && (
                                            <a href={task.output_file_url} download className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition-all shadow-xs">
                                                <span>Descargar Imagen</span>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            {task.output_file_url && (task.output_type === 'imagen' || /\.(svg|png|webp|jpe?g|gif)$/i.test(task.output_file_url)) && (
                                <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 p-2 shadow-inner">
                                    <div className="flex justify-end p-1">
                                        <a href={task.output_file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300">
                                            <ExternalLink size={12} /><span>Abrir Cuadro Completo en Nueva Pestaña</span>
                                        </a>
                                    </div>
                                    <div className="max-h-96 overflow-y-auto">
                                        <img src={task.output_file_url} alt="Cuadro generado" className="w-full object-contain rounded-xl mx-auto" />
                                    </div>
                                </div>
                            )}

                            {task.result ? (
                                <>
                                    <div className="flex justify-end">
                                        <button type="button" onClick={handleCopyResult} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all border border-slate-200 active:scale-95">
                                            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                            <span>{copied ? 'Copiado' : activityMeta.execMode === 'agent_prompt' ? `Copiar Prompt + Logs (${activityMeta.platform?.name})` : 'Copiar Informe'}</span>
                                        </button>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-800 leading-relaxed font-sans max-h-96 overflow-y-auto selection:bg-indigo-100">
                                        <AiTaskMarkdownRenderer content={task.result} />
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <FileText size={28} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-xs font-semibold">El informe aún no ha sido completado por los agentes.</p>
                                    <p className="text-[11px] text-slate-400">Revisa la pestaña "Bitácora en Vivo" para monitorear el progreso.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'prompt' && (
                        <div className="space-y-3">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-700 leading-relaxed max-h-56 overflow-y-auto">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="font-bold text-slate-900">Instrucción solicitada:</p>
                                    {onEdit && !isRunning && (
                                        <button type="button" onClick={() => onEdit(task)} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 transition-all">
                                            <Pencil size={12} /><span>Configurar Modo IA / Logs</span>
                                        </button>
                                    )}
                                </div>
                                <div className="whitespace-pre-wrap">{task.prompt}</div>
                            </div>
                            {task.custom_logs && (
                                <div className="bg-slate-950 text-emerald-300 p-3.5 rounded-2xl border border-slate-800 font-mono text-[11px] max-h-48 overflow-y-auto">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">📄 Logs Adjuntados por el Usuario:</p>
                                    <pre className="whitespace-pre-wrap break-words">{task.custom_logs}</pre>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                            {isRunning && (
                                <button type="button" onClick={handleCancel} disabled={isCancelling} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-rose-200 active:scale-95 disabled:opacity-50">
                                    {isCancelling ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}<span>Cancelar Tarea</span>
                                </button>
                            )}
                            {canRetry && (
                                <button type="button" onClick={handleRetry} disabled={isRetrying} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-indigo-200 active:scale-95 disabled:opacity-50">
                                    {isRetrying ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                                    <span>{activityMeta.execMode === 'agent_prompt' ? 'Regenerar Prompt + Logs' : task.status === 'completada' ? 'Volver a Ejecutar' : 'Reintentar Tarea'}</span>
                                </button>
                            )}
                            {onEdit && !isRunning && (
                                <button type="button" onClick={() => onEdit(task)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-50 rounded-xl transition-all border border-amber-200 active:scale-95">
                                    <Pencil size={13} /><span>Configurar Modo IA / Logs</span>
                                </button>
                            )}
                        </div>
                        <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">Cerrar</button>
                    </div>
                </div>
            ) : null}
        </Modal>
    );
};

export default AiTaskDetailModal;
