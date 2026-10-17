import { CheckCircle2, X, ExternalLink, Check, Wrench, Sparkles } from 'lucide-react';
import { formatDateTime } from '../../utils/dateUtils';

const TicketResolvedModal = ({
    open,
    ticket,
    totalPending = 1,
    onAcknowledge,
    onDismissLater,
    onViewDetail,
    isAcknowledging = false
}) => {
    if (!open || !ticket) return null;

    return (
        <div
            className="fixed bottom-5 right-5 z-[9999] w-[calc(100vw-2.5rem)] max-w-[395px] bg-[#14161d] rounded-[22px] border border-emerald-500/40 shadow-[0_24px_54px_rgba(0,0,0,0.65),0_0_28px_rgba(16,185,129,0.18)] text-[#e2e8f0] p-5 font-sans animate-in slide-in-from-bottom-5 fade-in duration-300"
            role="dialog"
            aria-modal="false"
            aria-labelledby="ticket-resolved-title"
        >
            {/* Header Row: Pill + Close */}
            <div className="flex items-center justify-between gap-2 mb-3.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/15">
                    <Sparkles size={13} className="text-emerald-400 shrink-0" />
                    <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">
                        TICKET RESUELTO · {ticket.code}
                    </span>
                </div>

                <div className="flex items-center gap-1.5">
                    {totalPending > 1 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            +{totalPending - 1} más
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => onDismissLater(ticket.id)}
                        className="w-7 h-7 rounded-full bg-[#1f2430] hover:bg-[#2a3040] text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                        aria-label="Cerrar aviso temporalmente"
                        title="Recordar más tarde"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Title */}
            <h3
                id="ticket-resolved-title"
                className="text-[18px] font-extrabold text-white tracking-tight leading-snug mb-1.5 flex items-center gap-2"
            >
                <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                <span>¡Tu ticket ha sido resuelto!</span>
            </h3>

            {/* Subject & Metadata */}
            <div className="bg-[#1b1f2a] border border-slate-800/90 rounded-xl p-3 mb-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                        {ticket.module_name || 'Soporte General'}
                    </span>
                    {ticket.resolved_version && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            v{ticket.resolved_version}
                        </span>
                    )}
                </div>
                <p className="text-[13px] font-bold text-white leading-snug">
                    {ticket.subject}
                </p>
            </div>

            {/* Resolution Notes */}
            <div className="bg-emerald-950/25 border-l-2 border-emerald-500 rounded-r-xl p-3 mb-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                        <Wrench size={11} />
                        Respuesta de {ticket.resolved_by_name || 'Soporte Técnico'}
                    </span>
                    {ticket.resolved_at && (
                        <span className="text-[10px] text-slate-400">
                            {formatDateTime(ticket.resolved_at)}
                        </span>
                    )}
                </div>
                <p className="text-[12.5px] text-slate-200 leading-relaxed whitespace-pre-line max-h-32 overflow-y-auto custom-scrollbar">
                    {ticket.resolution_notes || 'Se aplicaron los ajustes y correcciones correspondientes a tu solicitud.'}
                </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    disabled={isAcknowledging}
                    onClick={() => onAcknowledge(ticket.id)}
                    className="flex-1 py-2.5 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-extrabold text-[12.5px] flex items-center justify-center gap-1.5 shadow-[0_6px_20px_rgba(16,185,129,0.35)] transition-all cursor-pointer disabled:opacity-60"
                >
                    <Check size={15} strokeWidth={2.5} />
                    <span>{isAcknowledging ? 'Confirmando...' : 'Entendido'}</span>
                </button>

                {onViewDetail && (
                    <button
                        type="button"
                        onClick={() => onViewDetail(ticket)}
                        className="py-2.5 px-3 rounded-xl bg-[#1f2430] hover:bg-[#2a3040] border border-white/10 text-slate-200 hover:text-white font-semibold text-[12px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Ver historial del ticket"
                    >
                        <ExternalLink size={13} />
                        <span>Ver</span>
                    </button>
                )}

                <button
                    type="button"
                    onClick={() => onDismissLater(ticket.id)}
                    className="py-2.5 px-3 rounded-xl bg-transparent hover:bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 font-semibold text-[12px] transition-colors cursor-pointer"
                >
                    Más tarde
                </button>
            </div>
        </div>
    );
};

export default TicketResolvedModal;
