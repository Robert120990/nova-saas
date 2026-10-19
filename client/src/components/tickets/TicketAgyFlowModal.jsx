import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { X, Terminal, Sparkles, Play, XCircle, RefreshCw, Send, Settings2, Server, Cpu, MessageSquarePlus } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '../../utils/dateUtils';

const AGY_STATUS_META = {
    idle: { label: 'Listo para Planificar', cls: 'bg-slate-500/20 text-slate-300 border-slate-600' },
    planificando: { label: 'Planificando en 5.252.55.29...', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse' },
    esperando_aprobacion: { label: 'Plan Enviado a Telegram (Esperando Aprobación)', cls: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
    ejecutando: { label: 'Ejecutando Plan en 5.252.55.29...', cls: 'bg-sky-500/20 text-sky-300 border-sky-500/40 animate-pulse' },
    completado: { label: 'Plan Ejecutado en 5.252.55.29', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    denegado: { label: 'Plan Denegado', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
    error: { label: 'Error de Consola', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40' }
};

const DEFAULT_MODELS = [
    { id: 'gemini-4-argon-high', label: 'gemini-4-argon-high (Máxima Velocidad e Inteligencia)' },
    { id: 'gemini-3.1-pro', label: 'gemini-3.1-pro (Razonamiento Profundo)' },
    { id: 'gemini-3-flash', label: 'gemini-3-flash (Ultra Rápido)' }
];

const TicketAgyFlowModal = ({ open, ticketId, onClose }) => {
    const queryClient = useQueryClient();
    const [selectedModel, setSelectedModel] = useState('gemini-4-argon-high');
    const [customModel, setCustomModel] = useState('');
    const [aiNotes, setAiNotes] = useState('');
    const [feedbackComment, setFeedbackComment] = useState('');
    const [activeView, setActiveView] = useState('plan');
    const [showConfig, setShowConfig] = useState(false);
    const [cfgForm, setCfgForm] = useState({
        ssh_host: '5.252.55.29', ssh_port: 22, ssh_user: 'root', ssh_password: '',
        project_path: '/var/www/SIPEWEBgas', agy_command: 'agy', default_model: 'gemini-4-argon-high', execution_mode: 'auto'
    });

    const { data: ticket, isLoading } = useQuery({
        queryKey: ['ticket-detail', ticketId],
        queryFn: async () => (await axios.get(`/api/tickets/${ticketId}`)).data?.data,
        enabled: Boolean(open && ticketId),
        refetchInterval: open ? 4000 : false
    });

    const { data: agyConfig } = useQuery({
        queryKey: ['tickets-agy-settings'],
        queryFn: async () => (await axios.get('/api/tickets/agy-settings')).data?.data || {},
        enabled: Boolean(open)
    });

    useEffect(() => {
        if (ticket) {
            setAiNotes(ticket.ai_notes || '');
            if (ticket.agy_model) setSelectedModel(ticket.agy_model);
        }
    }, [ticket?.id]);

    useEffect(() => {
        if (agyConfig?.ssh_host) {
            setCfgForm((prev) => ({
                ...prev,
                ssh_host: agyConfig.ssh_host || '5.252.55.29',
                ssh_port: agyConfig.ssh_port || 22,
                ssh_user: agyConfig.ssh_user || 'root',
                ssh_password: agyConfig.ssh_password || '',
                project_path: agyConfig.project_path || '/var/www/SIPEWEBgas',
                agy_command: agyConfig.agy_command || 'agy',
                default_model: agyConfig.default_model || 'gemini-4-argon-high',
                execution_mode: agyConfig.execution_mode || 'auto'
            }));
        }
    }, [agyConfig]);

    const refreshAll = () => {
        queryClient.invalidateQueries({ queryKey: ['ticket-detail', ticketId] });
        queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    };

    const planMutation = useMutation({
        mutationFn: (payload) => axios.post(`/api/tickets/${ticketId}/agy/plan`, payload),
        onSuccess: (res) => { refreshAll(); setFeedbackComment(''); toast.success(res.data?.message || 'Planificación AGY iniciada en 5.252.55.29'); },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al iniciar planificación AGY')
    });

    const executeMutation = useMutation({
        mutationFn: () => axios.post(`/api/tickets/${ticketId}/agy/execute`),
        onSuccess: (res) => { refreshAll(); toast.success(res.data?.message || 'Ejecución del plan iniciada en 5.252.55.29'); },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al ejecutar plan AGY')
    });

    const rejectMutation = useMutation({
        mutationFn: () => axios.post(`/api/tickets/${ticketId}/agy/reject`, { reason: feedbackComment || 'Denegado por administrador' }),
        onSuccess: (res) => { refreshAll(); toast.info(res.data?.message || 'Plan AGY denegado'); },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al denegar plan')
    });

    const resendTelegramMutation = useMutation({
        mutationFn: () => axios.post(`/api/tickets/${ticketId}/agy/resend-telegram`),
        onSuccess: (res) => toast.success(res.data?.message || 'Plan enviado a Telegram'),
        onError: (err) => toast.error(err.response?.data?.message || 'No se pudo enviar el plan a Telegram')
    });

    const saveConfigMutation = useMutation({
        mutationFn: (payload) => axios.put('/api/tickets/agy-settings', payload),
        onSuccess: (res) => { queryClient.invalidateQueries({ queryKey: ['tickets-agy-settings'] }); setShowConfig(false); toast.success(res.data?.message || 'Configuración guardada'); },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar configuración')
    });

    if (!open || !ticketId) return null;

    const effectiveModel = selectedModel === '__custom__' ? (customModel.trim() || 'gemini-4-argon-high') : selectedModel;
    const agyStatus = ticket?.agy_status || 'idle';
    const statusBadge = AGY_STATUS_META[agyStatus] || AGY_STATUS_META.idle;
    const isBusy = agyStatus === 'planificando' || agyStatus === 'ejecutando' || planMutation.isPending || executeMutation.isPending;
    const hasPlan = Boolean(ticket?.agy_plan_markdown);
    const modelsList = Array.isArray(agyConfig?.available_models) && agyConfig.available_models.length > 0 ? agyConfig.available_models : DEFAULT_MODELS;
    const detectedOptions = (() => {
        const raw = String(ticket?.agy_plan_markdown || '');
        const opts = [];
        const regex = /\[OPCI[OÓ]N[_\s-]*(\d+)\]\s*:\s*([^\n\r]+)/gi;
        let m;
        while ((m = regex.exec(raw)) !== null) {
            const label = String(m[2] || '').trim();
            if (label && opts.length < 4) opts.push({ index: Number(m[1]), label });
        }
        return opts;
    })();

    return (
        <div className="fixed inset-0 z-[9995] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto" onClick={onClose}>
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-[#0f172a] text-white border-b border-slate-800">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                            <Terminal size={20} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    {ticket?.code || ticket?.ticket_code || `#${ticketId}`}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                                    <Server size={11} /> {cfgForm.ssh_host} (`agy`)
                                </span>
                                <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${statusBadge.cls}`}>
                                    {statusBadge.label}
                                </span>
                            </div>
                            <h2 className="text-sm sm:text-base font-bold text-white truncate mt-0.5">
                                Flujo Consola AGY &amp; Aprobación por Telegram — {ticket?.subject || ''}
                            </h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowConfig((v) => !v)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer"
                        >
                            <Settings2 size={14} /> <span>Consola {cfgForm.ssh_host}</span>
                        </button>
                        <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {isLoading || !ticket ? (
                    <div className="p-10 text-center text-slate-500 text-sm">Cargando flujo AGY del ticket...</div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
                        {/* Panel de configuración de consola 5.252.55.29 */}
                        {showConfig && (
                            <div className="bg-slate-900 text-slate-100 rounded-xl p-4 border border-slate-700 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                                        Parámetros de Conexión a Consola 5.252.55.29 (`agy`)
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                        {agyConfig?.is_running_on_target_server ? '🟢 Corriendo localmente en 5.252.55.29' : '🌐 Modo conexión SSH / Auto'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Host Servidor</label>
                                        <input type="text" value={cfgForm.ssh_host} onChange={(e) => setCfgForm({ ...cfgForm, ssh_host: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Usuario SSH</label>
                                        <input type="text" value={cfgForm.ssh_user} onChange={(e) => setCfgForm({ ...cfgForm, ssh_user: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Clave SSH (Opcional)</label>
                                        <input type="password" value={cfgForm.ssh_password} onChange={(e) => setCfgForm({ ...cfgForm, ssh_password: e.target.value })} placeholder="Clave o llave ~/.ssh" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Ruta Proyecto en Servidor</label>
                                        <input type="text" value={cfgForm.project_path} onChange={(e) => setCfgForm({ ...cfgForm, project_path: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono" />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button type="button" onClick={() => setShowConfig(false)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold">Cerrar</button>
                                    <button type="button" disabled={saveConfigMutation.isPending} onClick={() => saveConfigMutation.mutate(cfgForm)} className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer">
                                        Guardar Conexión
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Selección de Modelo e Instrucciones para AGY */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                <div className="md:col-span-5">
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                                        <Cpu size={13} className="text-indigo-600" /> Modelo IA en Consola `agy`
                                    </label>
                                    <select
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                                    >
                                        {(Array.isArray(modelsList) ? modelsList : []).map((m) => (
                                            <option key={m.id} value={m.id}>{m.label}</option>
                                        ))}
                                        <option value="__custom__">Otro modelo personalizado...</option>
                                    </select>
                                    {selectedModel === '__custom__' && (
                                        <input
                                            type="text"
                                            value={customModel}
                                            onChange={(e) => setCustomModel(e.target.value)}
                                            placeholder="Ej. gemini-4-argon-high"
                                            className="mt-2 w-full bg-white border border-indigo-300 rounded-xl px-3 py-1.5 text-xs font-mono"
                                        />
                                    )}
                                </div>

                                <div className="md:col-span-7">
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                        Directriz Técnica / Contexto para el Plan (`ai_notes`)
                                    </label>
                                    <input
                                        type="text"
                                        value={aiNotes}
                                        onChange={(e) => setAiNotes(e.target.value)}
                                        placeholder="Instrucción técnica opcional para orientar el plan de ejecución en 5.252.55.29..."
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            {hasPlan && (
                                <div className="space-y-2">
                                    {detectedOptions.length > 0 && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 space-y-1.5">
                                            <span className="block text-[11px] font-bold text-amber-800 uppercase">
                                                ❓ AGY requiere seleccionar una opción antes de ejecutar (clic para elegir y replanificar):
                                            </span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {detectedOptions.map((opt) => (
                                                    <button
                                                        key={opt.index}
                                                        type="button"
                                                        disabled={isBusy}
                                                        onClick={() => planMutation.mutate({
                                                            model: effectiveModel,
                                                            ai_notes: aiNotes,
                                                            feedback_comment: `DECISIÓN DEL ADMINISTRADOR: Selecciono la [OPCION_${opt.index}]: ${opt.label}. Procede a estructurar el plan definitivo con esta opción.`
                                                        })}
                                                        className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                                                    >
                                                        Elegir Opción {opt.index}: {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <label className="block text-[11px] font-bold text-indigo-600 uppercase mb-1 flex items-center gap-1">
                                        <MessageSquarePlus size={13} /> Responder Duda o Ampliar en Comentarios para Re-planificar (Plan v{(ticket.agy_plan_version || 1) + 1})
                                    </label>
                                    <input type="text" value={feedbackComment} onChange={(e) => setFeedbackComment(e.target.value)} placeholder="Responde aquí cualquier duda de AGY o escribe observaciones adicionales para re-planificar..." className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-800 focus:outline-none focus:border-indigo-500" />
                                </div>
                            )}

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <span className="text-[11px] text-slate-500">
                                    {ticket.agy_updated_at
                                        ? `Última actividad AGY: ${formatDateTime(ticket.agy_updated_at)} ${ticket.agy_approved_by ? `por ${ticket.agy_approved_by}` : ''}`
                                        : 'Al aprobar, AGY generará el plan en 5.252.55.29 y lo enviará a Telegram con botones de decisión.'}
                                </span>
                                <button type="button" disabled={isBusy} onClick={() => planMutation.mutate({ model: effectiveModel, ai_notes: aiNotes, feedback_comment: feedbackComment })} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer">
                                    {isBusy ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    <span>{hasPlan ? `Volver a Planificar en 5.252.55.29 (Plan v${(ticket.agy_plan_version || 1) + 1})` : 'Aprobar Ticket y Solicitar Plan a AGY (5.252.55.29)'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-100 border-b border-slate-200">
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => setActiveView('plan')} className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${activeView === 'plan' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}>
                                        📋 Plan de Ejecución {ticket.agy_plan_version ? `(v${ticket.agy_plan_version})` : ''}
                                    </button>
                                    <button type="button" onClick={() => setActiveView('console')} className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${activeView === 'console' ? 'bg-slate-900 text-emerald-400' : 'text-slate-600 hover:bg-slate-200'}`}>
                                        💻 Salida Consola 5.252.55.29
                                    </button>
                                </div>

                                {hasPlan && (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <button type="button" disabled={resendTelegramMutation.isPending} onClick={() => resendTelegramMutation.mutate()} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-[11px] font-bold cursor-pointer">
                                            <Send size={12} /> <span>Reenviar a Telegram</span>
                                        </button>
                                        <button type="button" disabled={isBusy} onClick={() => executeMutation.mutate()} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-sm cursor-pointer">
                                            <Play size={12} /> <span>Aprobar y Ejecutar Plan</span>
                                        </button>
                                        <button type="button" disabled={isBusy} onClick={() => rejectMutation.mutate()} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold cursor-pointer">
                                            <XCircle size={12} /> <span>Denegar</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {activeView === 'plan' ? (
                                <div className="p-4 bg-white max-h-80 overflow-y-auto">
                                    {ticket.agy_plan_markdown ? (
                                        <pre className="text-xs sm:text-[13px] text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">{ticket.agy_plan_markdown}</pre>
                                    ) : (
                                        <div className="py-10 text-center text-slate-400 text-xs">
                                            {agyStatus === 'planificando'
                                                ? 'Conectando con 5.252.55.29 y generando Plan de Ejecución con AGY...'
                                                : 'Aún no se ha generado un plan. Presiona "Aprobar Ticket y Solicitar Plan a AGY" para iniciar.'}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-4 bg-slate-950 text-emerald-400 font-mono text-xs max-h-80 overflow-y-auto">
                                    <pre className="whitespace-pre-wrap">{ticket.agy_execution_log || 'Sin registros de consola todavía.'}</pre>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TicketAgyFlowModal;
