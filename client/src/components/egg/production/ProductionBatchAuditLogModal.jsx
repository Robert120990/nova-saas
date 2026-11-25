import { useEffect, useState } from 'react';
import axios from 'axios';
import { History, XCircle, ShieldAlert, ArrowRight, User, Clock } from 'lucide-react';
import { formatDateTime } from '../../../utils/dateUtils';
import { unwrapList } from '../../../utils/apiUtils';

export default function ProductionBatchAuditLogModal({ open, onClose, batch }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !batch?.id) return;
        let active = true;
        setLoading(true);
        axios.get(`/api/egg-industrial/batches/${batch.id}/modification-logs`)
            .then((res) => {
                if (active) setLogs(unwrapList(res));
            })
            .catch(() => {
                if (active) setLogs([]);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [open, batch?.id]);

    if (!open) return null;

    const formatVal = (val) => {
        if (val === null || val === undefined || val === '') return '—';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-2 sm:p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-900">
                <div className="px-4 sm:px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300 shrink-0">
                            <History size={18} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm font-black uppercase tracking-tight truncate">
                                Bitácora de Modificaciones del Lote
                            </h3>
                            <p className="text-[11px] text-slate-300 truncate">
                                Lote: <strong>{batch?.batch_code_display || batch?.batch_uuid || `#${batch?.id}`}</strong>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <XCircle size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/70">
                    {loading ? (
                        <div className="py-12 text-center text-xs font-semibold text-slate-500 animate-pulse">
                            Cargando historial de modificaciones...
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="py-12 text-center bg-white border border-slate-200 rounded-xl p-6 space-y-1.5">
                            <History size={28} className="mx-auto text-slate-300" />
                            <p className="text-xs font-bold text-slate-600 uppercase">Sin modificaciones auditadas</p>
                            <p className="text-[11px] text-slate-400">
                                Aún no se han registrado ediciones posteriores sobre este lote.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {(Array.isArray(logs) ? logs : []).map((log) => {
                                const changes = Array.isArray(log.changes) ? log.changes : [];
                                const remImpacts = Array.isArray(log.impacts?.remanentes) ? log.impacts.remanentes : [];
                                return (
                                    <div key={log.id} className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                                                    log.was_closed
                                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                }`}>
                                                    {log.was_closed ? 'Lote Cerrado' : 'En Proceso'}
                                                </span>
                                                <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                                                    <User size={12} className="text-slate-400" />
                                                    {log.edited_by_name}
                                                    {log.edited_by_role ? <span className="text-[10px] text-slate-400 font-medium">({log.edited_by_role})</span> : null}
                                                </span>
                                            </div>
                                            <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                                                <Clock size={12} className="text-slate-400" />
                                                {formatDateTime(log.created_at)}
                                            </span>
                                        </div>

                                        <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg px-3 py-2 text-xs text-amber-950 flex items-start gap-2">
                                            <ShieldAlert size={14} className="text-amber-600 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-black uppercase text-[10px] text-amber-800 block">Motivo registrado</span>
                                                <p className="font-medium">{log.reason}</p>
                                            </div>
                                        </div>

                                        {changes.length > 0 && (
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black uppercase text-slate-500">Campos modificados</p>
                                                <div className="space-y-1">
                                                    {changes.map((c, ci) => (
                                                        <div key={ci} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-slate-50 px-2.5 py-1.5 rounded-lg text-[11px] border border-slate-100">
                                                            <span className="font-bold text-slate-700">{c.label || c.field}</span>
                                                            <span className="font-mono flex items-center gap-1.5 flex-wrap">
                                                                <span className="text-slate-500 line-through">{formatVal(c.before)}</span>
                                                                <ArrowRight size={12} className="text-indigo-500 shrink-0" />
                                                                <strong className="text-indigo-700">{formatVal(c.after)}</strong>
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {remImpacts.length > 0 && (
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black uppercase text-teal-700">Afectaciones en remanentes</p>
                                                <div className="space-y-1">
                                                    {remImpacts.map((ri, rIdx) => (
                                                        <div key={rIdx} className="text-[11px] bg-teal-50/60 border border-teal-100 rounded-lg px-2.5 py-1.5 text-teal-900">
                                                            <strong className="font-mono">{ri.code}</strong> ({ri.action}): {ri.before_lbs} → <strong>{ri.after_lbs} Lbs</strong> — {ri.residual_effect}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="px-4 sm:px-6 py-3 bg-white border-t border-slate-200 flex justify-end shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
