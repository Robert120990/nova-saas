import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
    X, Bot, Copy, Check, Sparkles, Trash2, CheckCircle2,
    FileCode2, AlertTriangle, Image as ImageIcon, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { unwrapList } from '../../utils/apiUtils';

export default function TicketAiBundleModal({
    open,
    onClose,
    selectedIds = [],
    onSuccess
}) {
    const queryClient = useQueryClient();
    const [items, setItems] = useState([]);
    const [extraContext, setExtraContext] = useState('');
    const [promptPreview, setPromptPreview] = useState('');
    const [copied, setCopied] = useState(false);
    const [batchVersion, setBatchVersion] = useState('');
    const [batchNote, setBatchNote] = useState('');
    const [showResolveConfirm, setShowResolveConfirm] = useState(false);

    const idsParam = Array.isArray(selectedIds) && selectedIds.length > 0 ? selectedIds.join(',') : '';

    const { data: bundleData, isLoading, refetch } = useQuery({
        queryKey: ['tickets-ai-bundle', idsParam, open],
        queryFn: async () => {
            const res = await axios.get('/api/tickets/ai-bundle', {
                params: idsParam ? { ids: idsParam } : {}
            });
            return {
                tickets: unwrapList(res),
                promptMarkdown: res.data?.promptMarkdown || ''
            };
        },
        enabled: Boolean(open)
    });

    useEffect(() => {
        if (bundleData?.tickets) {
            setItems(
                bundleData.tickets.map((t) => ({
                    ...t,
                    ai_notes: t.ai_notes || ''
                }))
            );
            setPromptPreview(bundleData.promptMarkdown || '');
        }
    }, [bundleData]);

    const generateMutation = useMutation({
        mutationFn: async (copyAfter = true) => {
            const payload = {
                extraContext,
                items: items.map((t) => ({
                    id: t.id,
                    include_in_ai_prompt: 1,
                    ai_notes: t.ai_notes || ''
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

            if (copyAfter && md) {
                try {
                    await navigator.clipboard.writeText(md);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 3000);
                    toast.success('Prompt empaquetado copiado al portapapeles y guardado en TICKETS_PARA_IA.md');
                } catch {
                    toast.success('Paquete actualizado en TICKETS_PARA_IA.md');
                }
            } else {
                toast.success('Comentarios técnicos y paquete actualizados');
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
            const ticketIds = items.map((t) => t.id);
            const res = await axios.post('/api/tickets/ai-bundle/resolve-batch', {
                ticketIds, resolution_notes: batchNote, resolved_version: batchVersion || null
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
                {/* Header */}
                <div className="px-5 py-4 bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
                            <Bot size={22} />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-base sm:text-lg font-extrabold tracking-tight">Empaquetador Inteligente de Tickets para IA</h2>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                                    {items.length} ticket(s) en paquete
                                </span>
                            </div>
                            <p className="text-xs text-slate-300">
                                Filtra los tickets que requieren cambios de código, agrega tus instrucciones técnicas y genera un único prompt empaquetado con logs y capturas WebP.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" disabled={autoTriageMutation.isPending} onClick={() => autoTriageMutation.mutate()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/25 hover:bg-indigo-500/40 border border-indigo-400/40 text-indigo-200 text-xs font-extrabold cursor-pointer">
                            <Sparkles size={14} /> <span>{autoTriageMutation.isPending ? 'Analizando...' : 'Auto-Triaje Agente IA'}</span>
                        </button>
                        <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/70">
                    {isLoading ? (
                        <div className="py-12 text-center text-slate-500 text-sm">Armando paquete de tickets para IA...</div>
                    ) : items.length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
                            <Bot size={36} className="mx-auto text-slate-300" />
                            <p className="text-sm font-bold text-slate-700">No hay tickets seleccionados para el paquete de IA</p>
                            <p className="text-xs text-slate-500 max-w-md mx-auto">
                                Marca el botón <strong>&ldquo;🤖 IA&rdquo;</strong> en los tickets que sean errores de código o mejoras, o deja que el <strong>Agente Especialista de Soporte</strong> clasifique automáticamente los tickets abiertos descartando dudas operativas de usuario.
                            </p>
                            <button type="button" disabled={autoTriageMutation.isPending} onClick={() => autoTriageMutation.mutate()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-sm cursor-pointer">
                                <Sparkles size={14} /> <span>{autoTriageMutation.isPending ? 'Analizando tickets...' : 'Ejecutar Auto-Triaje con Agente IA'}</span>
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                            {/* Columna Izquierda: Lista de Tickets Revisados y Comentarios Técnicos */}
                            <div className="lg:col-span-7 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                                        1. Comentarios / Directrices Técnicas por Ticket ({items.length})
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => generateMutation.mutate(false)}
                                        disabled={generateMutation.isPending}
                                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-500"
                                    >
                                        <RefreshCw size={12} /> Actualizar vista previa
                                    </button>
                                </div>

                                <div className="space-y-2.5 max-h-[52vh] overflow-y-auto pr-1">
                                    {(Array.isArray(items) ? items : []).map((t, idx) => (
                                        <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span className="font-mono text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                                            #{t.ticket_code}
                                                        </span>
                                                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                                            {t.type} · {t.priority}
                                                        </span>
                                                        {t.diagnostic_relevance && t.diagnostic_relevance !== 'sin_errores' && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                                                <AlertTriangle size={10} /> Log {t.diagnostic_score || 0}%
                                                            </span>
                                                        )}
                                                        {t.screenshot_url && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                                                <ImageIcon size={10} /> Captura WebP
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-900 mt-1">{t.subject}</p>
                                                    <p className="text-[11px] text-slate-500 line-clamp-2">{t.description}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeTicketFromBundle(t.id)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                                    title="Descartar del lote (ej. si es tema de usuario)"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-extrabold text-indigo-700 uppercase mb-1">
                                                    🎯 Comentario / Instrucción para la IA en este ticket:
                                                </label>
                                                <textarea
                                                    rows={2}
                                                    value={t.ai_notes || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ai_notes: val } : it)));
                                                    }}
                                                    placeholder="Ej. Corregir validación en controlador de ventas / Agregar filtro solicitado por el usuario..."
                                                    className="w-full border border-indigo-200 bg-indigo-50/30 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500 resize-none"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                        Instrucción Global Adicional para el Lote (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={extraContext}
                                        onChange={(e) => setExtraContext(e.target.value)}
                                        placeholder="Ej. Priorizar los errores 500 y verificar build al terminar..."
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Columna Derecha: Prompt Markdown Empaquetado */}
                            <div className="lg:col-span-5 flex flex-col space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                        <FileCode2 size={14} className="text-indigo-600" /> 2. Prompt Empaquetado (`TICKETS_PARA_IA.md`)
                                    </span>
                                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Sincronizado en raíz</span>
                                </div>
                                <textarea readOnly value={promptPreview} className="flex-1 min-h-[280px] w-full bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed p-3.5 rounded-xl border border-slate-800 focus:outline-none resize-none" />
                                <div className="bg-indigo-50 border border-indigo-200/80 rounded-xl p-2.5 text-[11px] text-indigo-900">
                                    <strong className="font-bold">💡 Tip rápido:</strong> Al pulsar <strong>&ldquo;Guardar y Copiar Prompt para IA&rdquo;</strong>, puedes pegarlo en el chat o decirle a la IA: <em>&ldquo;Resuelve los tickets de TICKETS_PARA_IA.md&rdquo;</em>.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Confirmación de Resolución en Lote */}
                    {showResolveConfirm && items.length > 0 && (
                        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-extrabold text-emerald-800 uppercase flex items-center gap-1.5">
                                    <Sparkles size={15} /> Marcar los {items.length} tickets del paquete como RESUELTOS
                                </span>
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

                {/* Footer */}
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
