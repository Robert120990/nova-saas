import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
    X, Bot, Copy, Check, Sparkles, Trash2, CheckCircle2,
    FileCode2, AlertTriangle, Image as ImageIcon, RefreshCw, Upload, Terminal
} from 'lucide-react';
import { toast } from 'sonner';
import { unwrapList } from '../../utils/apiUtils';
import { AI_EXECUTION_MODES, AGENT_PLATFORMS } from '../aiTasks/aiTaskConstants';

export default function TicketAiBundleModal({ open, onClose, selectedIds = [], onSuccess }) {
    const queryClient = useQueryClient();
    const [items, setItems] = useState([]);
    const [extraContext, setExtraContext] = useState('');
    const [aiMode, setAiMode] = useState('agent_prompt');
    const [agentPlatform, setAgentPlatform] = useState('antigravity');
    const [openLogsTicketId, setOpenLogsTicketId] = useState(null);
    const [promptPreview, setPromptPreview] = useState('');
    const [copied, setCopied] = useState(false);
    const [batchVersion, setBatchVersion] = useState('');
    const [batchNote, setBatchNote] = useState('');
    const [showResolveConfirm, setShowResolveConfirm] = useState(false);

    const idsParam = Array.isArray(selectedIds) && selectedIds.length > 0 ? selectedIds.join(',') : '';

    const { data: bundleData, isLoading } = useQuery({
        queryKey: ['tickets-ai-bundle', idsParam, open, agentPlatform, aiMode],
        queryFn: async () => {
            const res = await axios.get('/api/tickets/ai-bundle', {
                params: { ...(idsParam ? { ids: idsParam } : {}), agent_platform: agentPlatform, ai_mode: aiMode }
            });
            return { tickets: unwrapList(res), promptMarkdown: res.data?.promptMarkdown || '' };
        },
        enabled: Boolean(open)
    });

    useEffect(() => {
        if (bundleData?.tickets) {
            setItems(bundleData.tickets.map((t) => ({ ...t, ai_notes: t.ai_notes || '', custom_logs: t.custom_logs || '' })));
            setPromptPreview(bundleData.promptMarkdown || '');
        }
    }, [bundleData]);

    const handleLogFileForTicket = (idx, file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = String(ev.target?.result || '').slice(0, 15000);
            setItems((prev) => prev.map((it, i) => {
                if (i !== idx) return it;
                const combined = it.custom_logs ? `${it.custom_logs.trim()}\n--- [${file.name}] ---\n${text}` : `--- [${file.name}] ---\n${text}`;
                return { ...it, custom_logs: combined };
            }));
            toast.success(`Log "${file.name}" cargado en el ticket`);
        };
        reader.readAsText(file);
    };

    const generateMutation = useMutation({
        mutationFn: async (copyAfter = true) => {
            const payload = {
                extraContext, ai_mode: aiMode, agent_platform: agentPlatform,
                items: items.map((t) => ({
                    id: t.id, include_in_ai_prompt: 1, ai_notes: t.ai_notes || '',
                    custom_logs: t.custom_logs || '', ai_mode: aiMode, agent_platform: agentPlatform
                }))
            };
            const res = await axios.post('/api/tickets/ai-bundle/generate', payload);
            return { data: res.data, copyAfter };
        },
        onSuccess: async ({ data, copyAfter }) => {
            const md = data?.promptMarkdown || '';
            setPromptPreview(md);
            queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
            queryClient.invalidateQueries({ queryKey: ['support-tickets-stats'] });
            queryClient.invalidateQueries({ queryKey: ['agent-tasks'] });

            if (copyAfter && md) {
                try {
                    await navigator.clipboard.writeText(md);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 3000);
                    toast.success(data?.message || 'Prompt + Logs copiados al portapapeles');
                } catch {
                    toast.success(data?.message || 'Paquete actualizado en TICKETS_PARA_IA.md');
                }
            } else {
                toast.success('Comentarios, logs y modo IA actualizados');
            }
        },
        onError: () => toast.error('No se pudo generar el paquete para IA')
    });

    const removeTicketFromBundle = async (ticketId) => {
        try {
            await axios.put(`/api/tickets/${ticketId}/ai-review`, { include_in_ai_prompt: 0 });
            setItems((prev) => prev.filter((item) => Number(item.id) !== Number(ticketId)));
            queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
            queryClient.invalidateQueries({ queryKey: ['support-tickets-stats'] });
            toast.info('Ticket retirado del lote para IA');
        } catch {
            toast.error('Error al quitar ticket del lote');
        }
    };

    const resolveBatchMutation = useMutation({
        mutationFn: async () => {
            const res = await axios.post('/api/tickets/ai-bundle/resolve-batch', {
                ticketIds: items.map((t) => t.id), resolution_notes: batchNote, resolved_version: batchVersion || null
            });
            return res.data;
        },
        onSuccess: (res) => {
            toast.success(res?.message || 'Lote de tickets resuelto y notificado a los usuarios');
            queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
            queryClient.invalidateQueries({ queryKey: ['support-tickets-stats'] });
            setShowResolveConfirm(false);
            if (onSuccess) onSuccess();
            onClose();
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al resolver el lote de tickets')
    });

    const autoTriageMutation = useMutation({
        mutationFn: async () => (await axios.post('/api/tickets/ai-bundle/auto-triage')).data,
        onSuccess: (res) => {
            toast.success(res?.message || 'Auto-Triaje del Agente IA completado');
            queryClient.invalidateQueries({ queryKey: ['tickets-ai-bundle'] });
            queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
            queryClient.invalidateQueries({ queryKey: ['support-tickets-stats'] });
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al ejecutar Auto-Triaje IA')
    });

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto" onClick={onClose}>
            <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
                <div className="px-5 py-4 bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300"><Bot size={22} /></div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-base sm:text-lg font-extrabold tracking-tight">Empaquetador Inteligente de Tickets & Logs para IA</h2>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">{items.length} ticket(s)</span>
                            </div>
                            <p className="text-xs text-slate-300">Configura <strong>Modo 1 (API Interna)</strong> o <strong>Modo 2 (Prompt + Logs para Antigravity / Cursor / Claude)</strong>.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" disabled={autoTriageMutation.isPending} onClick={() => autoTriageMutation.mutate()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/25 hover:bg-indigo-500/40 border border-indigo-400/40 text-indigo-200 text-xs font-extrabold cursor-pointer">
                            <Sparkles size={14} /> <span>{autoTriageMutation.isPending ? 'Analizando...' : 'Auto-Triaje Agente IA'}</span>
                        </button>
                        <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"><X size={18} /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/70">
                    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {Object.values(AI_EXECUTION_MODES).map((m) => (
                                <button
                                    key={m.id} type="button" onClick={() => setAiMode(m.id)}
                                    className={`text-left p-2.5 rounded-xl border transition-all ${aiMode === m.id ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/15' : 'border-slate-200 bg-slate-50/50 hover:bg-white text-slate-600'}`}
                                >
                                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900"><span>{m.icon}</span><span>{m.label}</span></div>
                                    <p className="text-[10px] text-slate-500 mt-0.5">{m.desc}</p>
                                </button>
                            ))}
                        </div>
                        {aiMode === 'agent_prompt' && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-[10px] font-extrabold text-slate-500 uppercase mr-1">Plataforma de Agente:</span>
                                {Object.values(AGENT_PLATFORMS).map((p) => (
                                    <button
                                        key={p.id} type="button" onClick={() => setAgentPlatform(p.id)}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${agentPlatform === p.id ? 'border-purple-600 bg-purple-50 text-purple-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        <span>{p.icon}</span><span>{p.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="py-12 text-center text-slate-500 text-sm">Armando paquete de tickets para IA...</div>
                    ) : items.length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
                            <Bot size={36} className="mx-auto text-slate-300" />
                            <p className="text-sm font-bold text-slate-700">No hay tickets seleccionados para el paquete de IA</p>
                            <button type="button" disabled={autoTriageMutation.isPending} onClick={() => autoTriageMutation.mutate()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-sm cursor-pointer">
                                <Sparkles size={14} /> <span>{autoTriageMutation.isPending ? 'Analizando tickets...' : 'Ejecutar Auto-Triaje con Agente IA'}</span>
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                            <div className="lg:col-span-7 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">1. Directrices y Logs por Ticket ({items.length})</span>
                                    <button type="button" onClick={() => generateMutation.mutate(false)} disabled={generateMutation.isPending} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-500">
                                        <RefreshCw size={12} /> Actualizar vista previa
                                    </button>
                                </div>

                                <div className="space-y-2.5 max-h-[45vh] overflow-y-auto pr-1">
                                    {(Array.isArray(items) ? items : []).map((t, idx) => (
                                        <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span className="font-mono text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">#{t.ticket_code}</span>
                                                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{t.type} · {t.priority}</span>
                                                        {t.diagnostic_relevance && t.diagnostic_relevance !== 'sin_errores' && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200"><AlertTriangle size={10} /> Log {t.diagnostic_score || 0}%</span>
                                                        )}
                                                        {t.screenshot_url && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"><ImageIcon size={10} /> Captura WebP</span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-900 mt-1">{t.subject}</p>
                                                    <p className="text-[11px] text-slate-500 line-clamp-2">{t.description}</p>
                                                </div>
                                                <button type="button" onClick={() => removeTicketFromBundle(t.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Descartar del lote"><Trash2 size={14} /></button>
                                            </div>

                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="text-[10px] font-extrabold text-indigo-700 uppercase">🎯 Instrucción técnica para la IA:</label>
                                                    <div className="flex items-center gap-1.5">
                                                        <label className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 text-indigo-700 text-[10px] font-bold cursor-pointer">
                                                            <Upload size={10} /><span>Subir .log/.txt</span>
                                                            <input type="file" accept=".log,.txt,.json" className="hidden" onChange={(e) => handleLogFileForTicket(idx, e.target.files?.[0])} />
                                                        </label>
                                                        <button type="button" onClick={() => setOpenLogsTicketId(openLogsTicketId === t.id ? null : t.id)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 text-emerald-300 text-[10px] font-bold">
                                                            <Terminal size={10} /><span>{t.custom_logs ? 'Ver/Editar Logs' : 'Pegar Logs'}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                                <textarea
                                                    rows={2} value={t.ai_notes || ''}
                                                    onChange={(e) => { const val = e.target.value; setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ai_notes: val } : it))); }}
                                                    placeholder="Ej. Corregir validación en controlador / Ajustar vista..."
                                                    className="w-full border border-indigo-200 bg-indigo-50/30 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500 resize-none"
                                                />
                                                {(openLogsTicketId === t.id || t.custom_logs) && (
                                                    <textarea
                                                        rows={3} value={t.custom_logs || ''}
                                                        onChange={(e) => { const val = e.target.value; setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, custom_logs: val } : it))); }}
                                                        placeholder="Pega aquí las trazas de error, logs de consola F12 o logs del servidor para este ticket..."
                                                        className="mt-1.5 w-full bg-slate-900 text-emerald-300 font-mono text-[10px] rounded-xl p-2 border border-slate-700 focus:outline-none resize-y"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Instrucción Global Adicional para el Lote (Opcional)</label>
                                    <input type="text" value={extraContext} onChange={(e) => setExtraContext(e.target.value)} placeholder="Ej. Priorizar los errores 500 y verificar build al terminar..." className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500" />
                                </div>
                            </div>

                            <div className="lg:col-span-5 flex flex-col space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5"><FileCode2 size={14} className="text-indigo-600" /> 2. Prompt + Logs (`TICKETS_PARA_IA.md`)</span>
                                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{AGENT_PLATFORMS[agentPlatform]?.name || 'Antigravity'}</span>
                                </div>
                                <textarea readOnly value={promptPreview} className="flex-1 min-h-[260px] w-full bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed p-3.5 rounded-xl border border-slate-800 focus:outline-none resize-none" />
                                <div className="bg-indigo-50 border border-indigo-200/80 rounded-xl p-2.5 text-[11px] text-indigo-900">
                                    <strong className="font-bold">💡 Flujo:</strong> En <strong>Modo 2</strong> copia el prompt con logs y pégalo en <strong>{AGENT_PLATFORMS[agentPlatform]?.name}</strong>; en <strong>Modo 1</strong> se enviará a ejecución autónoma por API en <code>/ai-tasks</code>.
                                </div>
                            </div>
                        </div>
                    )}

                    {showResolveConfirm && items.length > 0 && (
                        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-extrabold text-emerald-800 uppercase flex items-center gap-1.5"><Sparkles size={15} /> Marcar los {items.length} tickets del paquete como RESUELTOS</span>
                                <button type="button" onClick={() => setShowResolveConfirm(false)} className="text-xs font-bold text-slate-500">Cancelar</button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                                <div className="sm:col-span-3">
                                    <input type="text" value={batchNote} onChange={(e) => setBatchNote(e.target.value)} placeholder="Nota general de solución (si se deja vacío usará la nota individual de cada ticket)..." className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs font-medium" />
                                </div>
                                <div>
                                    <input type="text" value={batchVersion} onChange={(e) => setBatchVersion(e.target.value)} placeholder="Versión (ej. 2.08.20)" className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs font-medium" />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <button type="button" disabled={resolveBatchMutation.isPending} onClick={() => resolveBatchMutation.mutate()} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-sm cursor-pointer">
                                    {resolveBatchMutation.isPending ? 'Resolviendo y notificando...' : `Confirmar y Enviar Pop-up a los ${items.length} Usuarios`}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
                    <div>
                        {items.length > 0 && !showResolveConfirm && (
                            <button type="button" onClick={() => setShowResolveConfirm(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold cursor-pointer">
                                <CheckCircle2 size={14} /> <span>Resolver Lote ({items.length}) y Notificar Usuarios</span>
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer">Cerrar</button>
                        {items.length > 0 && (
                            <button type="button" disabled={generateMutation.isPending} onClick={() => generateMutation.mutate(true)} className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-lg shadow-indigo-600/20 cursor-pointer">
                                {copied ? <Check size={15} /> : <Copy size={15} />}
                                <span>{copied ? '¡Prompt Copiado al Portapapeles!' : 'Guardar Notas y Copiar Prompt para IA'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
