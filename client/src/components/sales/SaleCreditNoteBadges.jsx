import { Undo2, Link2 } from 'lucide-react';
import Money from '../ui/Money';
import { formatDate } from '../../utils/dateUtils';

const DOC_TYPE_SHORT = {
    '01': 'Factura',
    '03': 'CCF',
    '04': 'NR',
    '05': 'NC',
    '06': 'ND',
    '07': 'Retención',
    '11': 'FEX'
};

export function SaleCreditNoteDocIndicator({ sale, onViewSale }) {
    const creditNotes = Array.isArray(sale?.credit_notes) ? sale.credit_notes : [];
    const refs = Array.isArray(sale?.referenced_documents) ? sale.referenced_documents : [];

    if (sale?.has_credit_note && creditNotes.length > 0) {
        const firstNc = creditNotes[0];
        const labelPrefix = sale.is_fully_credited ? 'NC Total' : 'NC Parcial';
        const controlText = creditNotes.length === 1
            ? (firstNc.numero_control || firstNc.codigo_generacion || `NC #${firstNc.id}`)
            : `${creditNotes.length} NCs`;
        const tooltip = creditNotes
            .map(nc => `${nc.numero_control || nc.codigo_generacion || `NC #${nc.id}`} (${formatDate(nc.fecha_emision)}) - $${(parseFloat(nc.total_pagar) || 0).toFixed(2)}`)
            .join('\n');

        return (
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onViewSale?.(creditNotes.length === 1 ? firstNc.id : sale.id);
                }}
                title={`${tooltip}\nClic para ver ${creditNotes.length === 1 ? 'la Nota de Crédito' : 'el detalle y sus Notas de Crédito'}`}
                className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200/80 text-[8.5px] font-bold max-w-[320px] truncate cursor-pointer transition-colors"
            >
                <Undo2 size={9} className="shrink-0 text-violet-600" />
                <span className="font-black uppercase tracking-tight shrink-0">{labelPrefix}:</span>
                <span className="font-mono truncate">{controlText}</span>
                <span className="shrink-0 font-black">
                    (-<Money value={sale.credit_note_total} />)
                </span>
            </button>
        );
    }

    if (['05', '06', '07'].includes(String(sale?.tipo_documento || '')) && refs.length > 0) {
        const firstRef = refs[0];
        const targetLabel = firstRef.original_numero_control || firstRef.doc_number;
        const typeLabel = DOC_TYPE_SHORT[firstRef.original_tipo_documento || firstRef.doc_type] || 'Doc';
        const extraSuffix = refs.length > 1 ? ` (+${refs.length - 1})` : '';
        const clickable = Boolean(firstRef.original_sale_id && onViewSale);

        return (
            <button
                type="button"
                disabled={!clickable}
                onClick={(e) => {
                    e.stopPropagation();
                    if (clickable) onViewSale(firstRef.original_sale_id);
                }}
                title={clickable ? `Aplica a ${typeLabel} ${targetLabel}. Clic para abrir documento original.` : `Referencia: ${targetLabel}`}
                className={`mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[8.5px] font-bold max-w-[320px] truncate ${
                    clickable
                        ? 'bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200/80 cursor-pointer transition-colors'
                        : 'bg-slate-50 text-slate-500 border-slate-200 cursor-default'
                }`}
            >
                <Link2 size={9} className="shrink-0" />
                <span className="shrink-0">Aplica a {typeLabel}:</span>
                <span className="font-mono truncate">{targetLabel}{extraSuffix}</span>
            </button>
        );
    }

    return null;
}

export function SaleCreditNoteStatusTag({ sale, onViewSale }) {
    if (!sale?.has_credit_note) return null;
    const creditNotes = Array.isArray(sale?.credit_notes) ? sale.credit_notes : [];
    const targetId = creditNotes.length === 1 ? creditNotes[0].id : sale.id;

    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onViewSale?.(targetId);
            }}
            title={sale.is_fully_credited ? 'Documento acreditado totalmente con Nota de Crédito' : 'Documento con Nota de Crédito parcial aplicada'}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-violet-100 hover:bg-violet-200/80 text-violet-800 border border-violet-200 text-[8.5px] font-black uppercase tracking-tight cursor-pointer shrink-0 transition-colors"
        >
            <Undo2 size={9} />
            <span>{sale.credit_note_count > 1 ? `${sale.credit_note_count} NC` : 'Con NC'}</span>
        </button>
    );
}
