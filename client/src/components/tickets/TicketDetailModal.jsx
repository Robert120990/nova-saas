import { useState, useRef, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { X, Ticket, CheckCircle2, Clock, Play, Lock, Send, MessageSquare, Image as ImageIcon, User, Building2, Globe, Sparkles, Paperclip, Bot, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '../../utils/dateUtils';
import { compressTicketImage } from '../../utils/ticketImageCompressor';
import TicketDiagnosticsPanel from './TicketDiagnosticsPanel';
import TicketAgyFlowModal from './TicketAgyFlowModal';

const STATUS_BADGES = { abierto: 'bg-amber-500/15 text-amber-600 border-amber-500/30', en_proceso: 'bg-sky-500/15 text-sky-600 border-sky-500/30', resuelto: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', cerrado: 'bg-slate-500/15 text-slate-600 border-slate-500/30' };
const STATUS_LABELS = { abierto: 'Abierto', en_proceso: 'En Proceso', resuelto: 'Resuelto', cerrado: 'Cerrado' };

const TicketDetailModal = ({ open, ticketId, onClose, onUpdated, canManage = false }) => {
    const queryClient = useQueryClient();
    const [replyText, setReplyText] = useState('');
    const [replyImageBase64, setReplyImageBase64] = useState(null);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [resolvedVersion, setResolvedVersion] = useState('');
    const [showResolveBox, setShowResolveBox] = useState(false);
    const [aiNotes, setAiNotes] = useState('');
    const [previewImageUrl, setPreviewImageUrl] = useState(null);
    const [agyOpen, setAgyOpen] = useState(false);
    const replyFileRef = useRef(null);

    const { data: ticket, isLoading } = useQuery({
        queryKey: ['ticket-detail', ticketId],
        queryFn: async () => {
            const res = await axios.get(`/api/tickets/${ticketId}`);
            return res.data?.data || res.data;
        },
        enabled: Boolean(open && ticketId),
        refetchInterval: open ? 10000 : false
    });

    useEffect(() => {
        if (ticket) setAiNotes(ticket.ai_notes || '');
    }, [ticket?.id, ticket?.ai_notes]);

    const statusMutation = useMutation({
        mutationFn: (payload) => axios.put(`/api/tickets/${ticketId}/status`, payload),
        onSuccess: (res, variables) => {
            queryClient.invalidateQueries({ queryKey: ['ticket-detail', ticketId] });
            queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
            queryClient.invalidateQueries({ queryKey: ['support-tickets-stats'] });
            setShowResolveBox(false);
            toast.success(variables.status === 'resuelto'
                ? 'Ticket RESUELTO. Se activó el pop-up de aviso exclusivamente para el usuario creador.'
                : `Estado actualizado a ${STATUS_LABELS[variables.status] || variables.status}`);
            if (onUpdated) onUpdated(res.data?.data || res.data?.ticket);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar el estado del ticket')
    });

    const aiReviewMutation = useMutation({
        mutationFn: (payload) => axios.put(`/api/tickets/${ticketId}/ai-review`, payload),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['ticket-detail', ticketId] });
            queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
            queryClient.invalidateQueries({ queryKey: ['support-tickets-stats'] });
            const t = res.data?.data || res.data?.ticket;
            toast.success(t?.include_in_ai_prompt ? 'Ticket incluido en el paquete para IA con tu directriz' : 'Revisión para IA actualizada');
        },
        onError: () => toast.error('No se pudo guardar la instrucción para IA')
    });

    const replyMutation = useMutation({
        mutationFn: (payload) => axios.post(`/api/tickets/${ticketId}/messages`, payload),
        onSuccess: () => {
            setReplyText('');
            setReplyImageBase64(null);
            queryClient.invalidateQueries({ queryKey: ['ticket-detail', ticketId] });
            toast.success('Comentario agregado y sincronizado con Telegram');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al enviar comentario')
    });

    const parsedAttachments = useMemo(() => {
        if (!ticket) return [];
        let list = ticket.attachments_json;
        if (typeof list === 'string') { try { list = JSON.parse(list); } catch { list = []; } }
        if (Array.isArray(list) && list.length > 0) return list;
        return ticket.screenshot_url ? [{ url: ticket.screenshot_url, caption: '', annotated: false }] : [];
    }, [ticket]);

    const parsedDiagnostics = useMemo(() => {
        if (!ticket?.diagnostics_json) return null;
        if (typeof ticket.diagnostics_json === 'object') return ticket.diagnostics_json;
        try { return JSON.parse(ticket.diagnostics_json); } catch { return null; }
    }, [ticket]);

    if (!open || !ticketId) return null;

    const handleSendReply = (e) => {
        e.preventDefault();
        if (!replyText.trim() && !replyImageBase64) return;
        replyMutation.mutate({ message: replyText.trim() || 'Adjunto captura en seguimiento', attachment_base64: replyImageBase64 || null });
    };

    const handleConfirmResolve = (e) => {
        e.preventDefault();
        statusMutation.mutate({
            status: 'resuelto',
            resolution_notes: resolutionNotes.trim() || 'Solicitud atendida y resuelta por el equipo técnico.',
            resolved_version: resolvedVersion.trim() || null
        });
    };

    const handleReplyFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        const compressed = await compressTicketImage(file);
        if (compressed) setReplyImageBase64(compressed);
    };

    const messages = Array.isArray(ticket?.messages) ? ticket.messages : [];
    const inAiBundle = Boolean(ticket?.include_in_ai_prompt);

    return (
        <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/65 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto" onClick={onClose}>
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 my-auto flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 bg-[#0f172a] text-white border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                            <Ticket size={20} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    {ticket?.code || ticket?.ticket_code || `#${ticketId}`}
                                </span>
                                {ticket?.status && (
                                    <span className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${STATUS_BADGES[ticket.status] || ''}`}>
                                        {STATUS_LABELS[ticket.status] || ticket.status}
                                    </span>
                                )}
                                <span className="text-[11px] text-slate-400 uppercase font-bold">
                                    {ticket?.type} · Prioridad {ticket?.priority}
                                </span>
                            </div>
                            <h2 className="text-sm sm:text-base font-bold text-white truncate mt-0.5">{ticket?.subject || 'Cargando detalle...'}</h2>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
                        <X size={18} />
                    </button>
                </div>

                {isLoading || !ticket ? (
                    <div className="p-12 text-center text-slate-500 text-sm">Cargando información del ticket...</div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs">
                            <div className="flex items-center gap-2.5">
                                <User size={15} className="text-indigo-500 shrink-0" />
                                <div className="min-w-0">
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Solicitado por</span>
                                    <span className="font-bold text-slate-800 truncate block">{ticket.creator_name || ticket.user_name}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <Building2 size={15} className="text-emerald-500 shrink-0" />
                                <div className="min-w-0">
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Empresa / Módulo</span>
                                    <span className="font-bold text-slate-800 truncate block">{ticket.company_name || 'Global'} · {ticket.module_name || 'General'}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <Clock size={15} className="text-amber-500 shrink-0" />
                                <div className="min-w-0">
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Fecha de Creación</span>
                                    <span className="font-bold text-slate-800">{formatDateTime(ticket.created_at)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                            <div className={`${parsedAttachments.length > 0 ? 'lg:col-span-6' : 'lg:col-span-12'} space-y-3`}>
                                <div className="bg-white border border-slate-200 rounded-xl p-4">
                                    <span className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Descripción y Comentarios</span>
                                    <p className="text-[13px] text-slate-700 whitespace-pre-line leading-relaxed">{ticket.description}</p>
                                    {ticket.page_url && (
                                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                                            <Globe size={12} className="text-slate-400" />
                                            <span>Ruta: {ticket.page_url}</span>
                                        </div>
                                    )}
                                </div>

                                {ticket.status === 'resuelto' && (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <span className="text-[11px] font-extrabold text-emerald-700 uppercase flex items-center gap-1.5">
                                                <CheckCircle2 size={15} /> Resuelto por {ticket.resolved_by_name || 'Soporte Técnico'}
                                            </span>
                                            <span className="text-[11px] text-emerald-600 font-medium">{formatDateTime(ticket.resolved_at)}</span>
                                        </div>
                                        <p className="text-[13px] text-emerald-900 font-medium whitespace-pre-line">{ticket.resolution_notes}</p>
                                        <div className="mt-2 text-[11px] text-emerald-700/80 flex items-center gap-2">
                                            <Sparkles size={12} />
                                            <span>
                                                {ticket.creator_notified_at
                                                    ? `El usuario confirmó de enterado el ${formatDateTime(ticket.creator_notified_at)}`
                                                    : 'Pop-up de aviso activo en la pantalla del usuario creador'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {parsedAttachments.length > 0 && (
                                <div className="lg:col-span-6 bg-slate-900 rounded-xl p-3 border border-slate-800 space-y-2.5">
                                    <span className="font-bold flex items-center gap-1.5 text-[11px] uppercase text-slate-300">
                                        <ImageIcon size={13} className="text-indigo-400" /> Capturas Adjuntas ({parsedAttachments.length})
                                    </span>
                                    <div className={`grid gap-2.5 ${parsedAttachments.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                                        {(Array.isArray(parsedAttachments) ? parsedAttachments : []).map((att, idx) => (
                                            <div key={idx} className="bg-slate-950/90 border border-slate-800 rounded-lg p-2 flex flex-col gap-1.5">
                                                <button type="button" onClick={() => setPreviewImageUrl(att.url)} className="relative flex items-center justify-center bg-black/40 rounded overflow-hidden max-h-44 cursor-zoom-in">
                                                    <img src={att.url} alt={`Captura ${idx + 1}`} className="max-h-44 w-auto object-contain hover:scale-[1.02] transition-transform" />
                                                    {att.annotated && (
                                                        <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-indigo-600/90 text-[10px] font-bold text-white">Con trazos / señalización</span>
                                                    )}
                                                </button>
                                                {att.caption && <p className="text-[11px] text-slate-300 font-medium px-1">&ldquo;{att.caption}&rdquo;</p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {parsedDiagnostics && <TicketDiagnosticsPanel diagnostics={parsedDiagnostics} compact={false} />}

                        {canManage && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Acciones de Técnico y Consola AGY</span>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button type="button" onClick={() => setAgyOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-700 text-xs font-extrabold shadow-sm cursor-pointer">
                                            <Terminal size={13} /> <span>{ticket.agy_plan_version ? `Plan AGY v${ticket.agy_plan_version} (${ticket.agy_status})` : 'Aprobar y Planificar AGY'}</span>
                                        </button>
                                        <button type="button" disabled={aiReviewMutation.isPending} onClick={() => aiReviewMutation.mutate({ include_in_ai_prompt: !inAiBundle, ai_notes: aiNotes })} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${inAiBundle ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'}`}>
                                            <Bot size={14} /> <span>{inAiBundle ? 'En Paquete IA ✓' : 'Paquete IA'}</span>
                                        </button>
                                        {ticket.status !== 'en_proceso' && ticket.status !== 'resuelto' && (
                                            <button type="button" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ status: 'en_proceso' })} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer">
                                                <Play size={13} /> En Proceso
                                            </button>
                                        )}
                                        <button type="button" onClick={() => setShowResolveBox((v) => !v)} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm cursor-pointer">
                                            <CheckCircle2 size={14} /> <span>{ticket.status === 'resuelto' ? 'Actualizar Solución' : 'Marcar Resuelto'}</span>
                                        </button>
                                        {ticket.status !== 'cerrado' && (
                                            <button type="button" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ status: 'cerrado' })} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer">
                                                <Lock size={13} /> Cerrar
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                    <input type="text" value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} placeholder="Comentario / instrucción técnica para que la IA resuelva este ticket (ej. corregir cálculo en SalesTerminal)..." className="flex-1 bg-white border border-indigo-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500" />
                                    <button type="button" disabled={aiReviewMutation.isPending} onClick={() => aiReviewMutation.mutate({ include_in_ai_prompt: 1, ai_notes: aiNotes })} className="px-3.5 py-1.5 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-xs font-bold shrink-0 cursor-pointer">
                                        Guardar Nota para IA
                                    </button>
                                </div>

                                {showResolveBox && (
                                    <form onSubmit={handleConfirmResolve} className="pt-3 border-t border-slate-200 space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                            <div className="sm:col-span-3">
                                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Nota de Solución (la verá el usuario en su pop-up)</label>
                                                <input type="text" required value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} placeholder="Describe qué se corrigió o implementó..." className="w-full border border-slate-300 rounded-xl px-3 py-2 text-[13px] font-medium focus:outline-none focus:border-emerald-500" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Versión (Opcional)</label>
                                                <input type="text" value={resolvedVersion} onChange={(e) => setResolvedVersion(e.target.value)} placeholder="Ej. 2.08.15" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-[13px] font-medium focus:outline-none focus:border-emerald-500" />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button type="button" onClick={() => setShowResolveBox(false)} className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold">Cancelar</button>
                                            <button type="submit" disabled={statusMutation.isPending} className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm">Confirmar y Enviar Pop-up al Creador</button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}

                        <div className="space-y-2.5">
                            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <MessageSquare size={14} className="text-indigo-500" /> Historial de Seguimiento ({messages.length})
                            </h3>
                            <div className="space-y-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                                {messages.map((msg) => (
                                    <div key={msg.id} className={`p-3 rounded-xl border text-xs ${msg.sender_role === 'tech' ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50 border-slate-200/80'}`}>
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-slate-800">{msg.sender_name}</span>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${msg.source === 'telegram' ? 'bg-sky-500/15 text-sky-700' : 'bg-slate-200 text-slate-600'}`}>
                                                    {msg.source === 'telegram' ? 'Telegram' : 'Web'}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-slate-400">{formatDateTime(msg.created_at)}</span>
                                        </div>
                                        <p className="text-[13px] text-slate-700 whitespace-pre-line">{msg.message}</p>
                                        {msg.attachment_url && (
                                            <button type="button" onClick={() => setPreviewImageUrl(msg.attachment_url)} className="mt-2 inline-block cursor-zoom-in">
                                                <img src={msg.attachment_url} alt="Adjunto" className="max-h-32 rounded-lg border border-slate-200" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {replyImageBase64 && (
                                <div className="inline-flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                                    <img src={replyImageBase64} alt="Previsualización" className="h-8 w-auto rounded" />
                                    <span className="font-semibold text-slate-700">Imagen WebP lista</span>
                                    <button type="button" onClick={() => setReplyImageBase64(null)} className="text-rose-600 font-bold">Quitar</button>
                                </div>
                            )}
                            <form onSubmit={handleSendReply} className="flex items-center gap-2 pt-1">
                                <button type="button" onClick={() => replyFileRef.current?.click()} className="p-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100" title="Adjuntar captura al comentario"><Paperclip size={15} /></button>
                                <input ref={replyFileRef} type="file" accept="image/*" className="hidden" onChange={handleReplyFile} />
                                <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Escribe un comentario o adjunta otra captura..." className="flex-1 border border-slate-300 rounded-xl px-3.5 py-2 text-[13px] font-medium focus:outline-none focus:border-indigo-500" />
                                <button type="submit" disabled={replyMutation.isPending || (!replyText.trim() && !replyImageBase64)} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
                                    <Send size={14} /> <span>Enviar</span>
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
            <TicketAgyFlowModal open={agyOpen} ticketId={ticketId} onClose={() => setAgyOpen(false)} />
            {previewImageUrl && (
                <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); setPreviewImageUrl(null); }}>
                    <div className="flex items-center gap-3 mb-3">
                        <a href={previewImageUrl} download onClick={(e) => e.stopPropagation()} className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">Descargar Imagen</a>
                        <button type="button" onClick={() => setPreviewImageUrl(null)} className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold">Cerrar Vista (Esc)</button>
                    </div>
                    <img src={previewImageUrl} alt="Vista ampliada" onClick={(e) => e.stopPropagation()} className="max-w-full max-h-[85vh] object-contain rounded-xl border border-slate-700 shadow-2xl" />
                </div>
            )}
        </div>
    );
};

export default TicketDetailModal;
