import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { X, Scale, Building2, Calendar } from 'lucide-react';
import Money from '../../../ui/Money';
import { formatDate } from '../../../../utils/dateUtils';

export const AuditEntryDetailModal = ({ open, onClose, entryId }) => {
    const { data: entry, isLoading } = useQuery({
        queryKey: ['audit-entry-detail', entryId],
        queryFn: async () => {
            const res = await axios.get(`/api/accounting/audit/entries/${entryId}`);
            return res.data?.data;
        },
        enabled: open && Boolean(entryId)
    });

    if (!open) return null;

    const totalDebit = Number(entry?.total_debit || 0);
    const totalCredit = Number(entry?.total_credit || 0);
    const diff = Math.abs(totalDebit - totalCredit);
    const isUnbalanced = diff > 0.009;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Modal Header */}
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${isUnbalanced ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'}`}>
                            <Scale className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                Auditoría de Partida #{entry?.number || '---'}
                                {isUnbalanced ? (
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300">
                                        DESCUADRADA (${diff.toFixed(2)})
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
                                        CUADRADA
                                    </span>
                                )}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Inspección contable de partida doble y consistencia de cuentas
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Content */}
                <div className="p-5 overflow-y-auto flex-1 space-y-4">
                    {isLoading ? (
                        <div className="py-16 text-center text-slate-500">
                            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                            Cargando datos de la partida...
                        </div>
                    ) : !entry ? (
                        <div className="py-12 text-center text-slate-500">No se pudo cargar la partida.</div>
                    ) : (
                        <>
                            {/* Metadata Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                                <div>
                                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Fecha</span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                        {formatDate(entry.date)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Tipo</span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-200 block mt-0.5">
                                        {entry.entry_type_name || 'Partida General'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Sucursal</span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                        {entry.branch_name || 'Casa Matriz'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Estado</span>
                                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                                        {entry.status}
                                    </span>
                                </div>
                                <div className="col-span-2 sm:col-span-4 mt-1 pt-2 border-t border-slate-200 dark:border-slate-700">
                                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Concepto / Glosa</span>
                                    <span className="text-slate-700 dark:text-slate-300 font-medium block mt-0.5">
                                        {entry.description || 'Sin concepto especificado'}
                                    </span>
                                </div>
                            </div>

                            {/* Lines Table */}
                            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                                            <tr>
                                                <th className="py-2.5 px-3">Cuenta</th>
                                                <th className="py-2.5 px-3">Nombre</th>
                                                <th className="py-2.5 px-3">Concepto Línea</th>
                                                <th className="py-2.5 px-3 text-right">Debe</th>
                                                <th className="py-2.5 px-3 text-right">Haber</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {(entry.lines || []).map((line, idx) => {
                                                const hasAccountIssue = line.isInvalidAccount;
                                                const hasNegIssue = line.isNegative;
                                                const isIssue = hasAccountIssue || hasNegIssue;

                                                return (
                                                    <tr key={idx} className={isIssue ? 'bg-rose-50/60 dark:bg-rose-950/20' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'}>
                                                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                                                            {line.account_code || '---'}
                                                            {hasAccountIssue && (
                                                                <span className="block text-[10px] text-rose-600 dark:text-rose-400 font-sans font-normal">
                                                                    ⚠️ {line.active === 0 ? 'Inactiva' : 'Cuenta de Mayor'}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium">
                                                            {line.account_name || '---'}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                                                            {line.description || '---'}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right font-medium">
                                                            {Number(line.debit) > 0 ? (
                                                                <Money value={line.debit} />
                                                            ) : line.debit < 0 ? (
                                                                <span className="text-rose-600 font-bold"><Money value={line.debit} /></span>
                                                            ) : (
                                                                <span className="text-slate-300">-</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right font-medium">
                                                            {Number(line.credit) > 0 ? (
                                                                <Money value={line.credit} />
                                                            ) : line.credit < 0 ? (
                                                                <span className="text-rose-600 font-bold"><Money value={line.credit} /></span>
                                                            ) : (
                                                                <span className="text-slate-300">-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-slate-50 dark:bg-slate-800/70 border-t-2 border-slate-200 dark:border-slate-700 font-bold">
                                            <tr>
                                                <td colSpan={3} className="py-3 px-3 text-right text-slate-600 dark:text-slate-300 uppercase text-[11px]">
                                                    Totales de Partida:
                                                </td>
                                                <td className="py-3 px-3 text-right text-indigo-600 dark:text-indigo-400 text-sm">
                                                    <Money value={totalDebit} />
                                                </td>
                                                <td className="py-3 px-3 text-right text-indigo-600 dark:text-indigo-400 text-sm">
                                                    <Money value={totalCredit} />
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-800/40">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
                    >
                        Cerrar Auditoría
                    </button>
                </div>
            </div>
        </div>
    );
};
