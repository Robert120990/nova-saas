import { Undo2, Link2, ExternalLink } from 'lucide-react';
import Money from '../ui/Money';
import { formatDate } from '../../utils/dateUtils';

const DOC_TYPE_LABELS = {
    '01': 'Factura',
    '03': 'Crédito Fiscal',
    '04': 'Nota de Remisión',
    '05': 'Nota de Crédito',
    '06': 'Nota de Débito',
    '07': 'Comprobante de Retención',
    '11': 'Factura de Exportación'
};

export default function SaleCreditNoteRelationsCard({ saleDetail, onSelectSale }) {
    if (!saleDetail) return null;
    const creditNotes = Array.isArray(saleDetail.credit_notes) ? saleDetail.credit_notes : [];
    const refs = Array.isArray(saleDetail.referenced_documents) ? saleDetail.referenced_documents : [];

    if (creditNotes.length === 0 && refs.length === 0) return null;

    const saleTotal = parseFloat(saleDetail.total_pagar) || 0;
    const ncTotal = parseFloat(saleDetail.credit_note_total) || 0;
    const netAfterNc = Math.max(0, Math.round((saleTotal - ncTotal) * 100) / 100);

    return (
        <div className="space-y-3">
            {creditNotes.length > 0 && (
                <div className="bg-violet-50/70 border border-violet-200 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-violet-800">
                            <Undo2 size={16} className="shrink-0" />
                            <div>
                                <h5 className="text-xs font-black uppercase tracking-wider">
                                    Notas de Crédito Aplicadas ({creditNotes.length})
                                </h5>
                                <p className="text-[11px] font-semibold text-violet-700/80">
                                    {saleDetail.is_fully_credited ? 'Documento acreditado totalmente' : 'Documento acreditado parcialmente'}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                            <div className="px-2.5 py-1 rounded-xl bg-white border border-violet-200">
                                <span className="text-[10px] font-bold text-slate-400 uppercase mr-1.5">Total NC:</span>
                                <span className="font-black text-violet-700">-<Money value={ncTotal} /></span>
                            </div>
                            <div className="px-2.5 py-1 rounded-xl bg-white border border-violet-200">
                                <span className="text-[10px] font-bold text-slate-400 uppercase mr-1.5">Saldo Neto:</span>
                                <span className="font-black text-slate-900"><Money value={netAfterNc} /></span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {creditNotes.map((nc) => (
                            <div
                                key={nc.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-3 rounded-xl border border-violet-200/80 text-xs"
                            >
                                <div className="min-w-0 space-y-0.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono font-black text-violet-700">
                                            {nc.numero_control || `NC #${nc.id}`}
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase">
                                            {nc.dte_status || nc.estado || 'EMITIDO'}
                                        </span>
                                        <span className="text-[11px] font-semibold text-slate-500">
                                            {formatDate(nc.fecha_emision)}
                                        </span>
                                    </div>
                                    {nc.codigo_generacion && (
                                        <div className="font-mono text-[10px] text-slate-400 truncate">
                                            {nc.codigo_generacion}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                    <span className="font-black text-violet-700 text-sm">
                                        -<Money value={nc.total_pagar} />
                                    </span>
                                    {onSelectSale && (
                                        <button
                                            type="button"
                                            onClick={() => onSelectSale(nc.id)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold cursor-pointer"
                                        >
                                            <ExternalLink size={12} />
                                            <span>Ver NC</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {refs.length > 0 && (
                <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-sky-800">
                        <Link2 size={16} className="shrink-0" />
                        <h5 className="text-xs font-black uppercase tracking-wider">
                            Documento(s) Original(es) Relacionado(s) ({refs.length})
                        </h5>
                    </div>
                    <div className="space-y-2">
                        {refs.map((ref, idx) => (
                            <div
                                key={`${ref.doc_number}-${idx}`}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-3 rounded-xl border border-sky-200/80 text-xs"
                            >
                                <div className="min-w-0 space-y-0.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-black uppercase">
                                            {DOC_TYPE_LABELS[ref.original_tipo_documento || ref.doc_type] || `DTE ${ref.doc_type || ''}`}
                                        </span>
                                        <span className="font-mono font-black text-slate-800">
                                            {ref.original_numero_control || ref.doc_number}
                                        </span>
                                        {(ref.original_fecha_emision || ref.emission_date) && (
                                            <span className="text-[11px] font-semibold text-slate-500">
                                                {formatDate(ref.original_fecha_emision || ref.emission_date)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="font-mono text-[10px] text-slate-400 truncate">
                                        Ref. DTE: {ref.original_codigo_generacion || ref.doc_number}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                    {ref.original_total_pagar !== null && (
                                        <span className="font-black text-slate-900 text-sm">
                                            <Money value={ref.original_total_pagar} />
                                        </span>
                                    )}
                                    {ref.original_sale_id && onSelectSale && (
                                        <button
                                            type="button"
                                            onClick={() => onSelectSale(ref.original_sale_id)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold cursor-pointer"
                                        >
                                            <ExternalLink size={12} />
                                            <span>Ver Doc. Original</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
