import { CheckCircle2, XCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import Money from '../ui/Money';
import { formatDate } from '../../utils/dateUtils';

const round2 = (num) => Math.round((parseFloat(num) || 0) * 100) / 100;

const AccountingEntryViewModal = ({ open, onClose, entry }) => {
    if (!open) return null;

    const lines = Array.isArray(entry?.lines) ? entry.lines : [];
    const totalDebit = round2(entry?.total_debit || lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0));
    const totalCredit = round2(entry?.total_credit || lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0));
    const diff = round2(Math.abs(totalDebit - totalCredit));
    const isBalanced = diff === 0 && totalDebit > 0;

    return (
        <Modal isOpen={open} onClose={onClose} title={`Partida Contable #${entry?.number || ''}`} maxWidth="max-w-5xl">
            {entry && (
                <div className="space-y-4 pt-1">
                    {/* Header Metadata */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Tipo de Partida</span>
                                <span className="text-xs font-bold text-slate-800">{entry.entry_type_name || 'DIARIO'}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Fecha Contable</span>
                                <span className="text-xs font-bold text-slate-800">{formatDate(entry.date)}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Número</span>
                                <span className="text-xs font-mono font-bold text-indigo-700">#{entry.number}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Estado</span>
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${entry.status === 'posted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : entry.status === 'voided' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                    {entry.status === 'posted' ? 'Contabilizado' : entry.status === 'voided' ? 'Anulado' : 'Borrador'}
                                </span>
                            </div>
                        </div>

                        <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Concepto General</span>
                            <p className="text-xs font-bold uppercase text-slate-800 bg-white px-3 py-2 rounded-xl border border-slate-200">
                                {entry.description || 'SIN CONCEPTO'}
                            </p>
                        </div>
                    </div>

                    {/* Lines Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="overflow-x-auto max-h-[380px]">
                            <table className="w-full min-w-[850px] border-collapse text-[11px]">
                                <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-300 text-[10px] font-bold uppercase text-slate-600 tracking-wider">
                                    <tr>
                                        <th className="px-3 py-2 text-left w-28 shrink-0">Cuenta</th>
                                        <th className="px-3 py-2 text-left w-72">Nombre Cuenta</th>
                                        <th className="px-3 py-2 text-left">Concepto</th>
                                        <th className="px-3 py-2 text-right w-24">Cargo</th>
                                        <th className="px-3 py-2 text-right w-24">Abono</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                    {lines.map((l, idx) => (
                                        <tr
                                            key={l.id || idx}
                                            className={`transition-colors hover:bg-indigo-50/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                                        >
                                            <td className="px-3 py-1.5 font-mono font-bold text-indigo-600">
                                                {l.account_code || '—'}
                                            </td>
                                            <td className="px-3 py-1.5 text-slate-800 font-bold uppercase truncate max-w-[290px]" title={l.account_name}>
                                                {l.account_name || '—'}
                                            </td>
                                            <td className="px-3 py-1.5 text-slate-700 uppercase font-medium">
                                                {l.description || entry.description}
                                            </td>
                                            <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-900">
                                                {parseFloat(l.debit) > 0 ? <Money value={l.debit} /> : ''}
                                            </td>
                                            <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-900">
                                                {parseFloat(l.credit) > 0 ? <Money value={l.credit} /> : ''}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="sticky bottom-0 z-10 bg-slate-100 border-t-2 border-slate-300 font-mono text-xs font-black">
                                    <tr>
                                        <td colSpan={3} className="px-3 py-2 text-right">
                                            <div className="flex items-center justify-end gap-2.5">
                                                <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider">TOTALES</span>
                                                <div className={`px-2 py-0.5 rounded border font-mono text-[10px] font-black inline-flex items-center gap-1 shadow-sm ${
                                                    isBalanced
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                                        : 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                                                }`}>
                                                    {isBalanced ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                                                    <Money value={diff} />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-right text-indigo-900 text-xs font-bold">
                                            <Money value={totalDebit} />
                                        </td>
                                        <td className="px-3 py-2 text-right text-indigo-900 text-xs font-bold">
                                            <Money value={totalCredit} />
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                            <span className="text-xs text-slate-500 font-medium">
                                Total de líneas: <b>{lines.length}</b>
                            </span>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold uppercase transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default AccountingEntryViewModal;
