import Modal from '../ui/Modal';
import Money from '../ui/Money';
import { formatDate } from '../../utils/dateUtils';

const AccountingEntryViewModal = ({ open, onClose, entry }) => {
    if (!open) return null;
    return (
<Modal isOpen={open} onClose={onClose} title={`Partida ${entry?.number}`} maxWidth="max-w-2xl">
                {entry && (
                    <div className="space-y-4 pt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                            <div><span className="text-[10px] font-black uppercase text-slate-400">Tipo</span><p className="font-bold">{entry.entry_type_name}</p></div>
                            <div><span className="text-[10px] font-black uppercase text-slate-400">Fecha</span><p className="font-bold">{formatDate(entry.date)}</p></div>
                            <div><span className="text-[10px] font-black uppercase text-slate-400">Estado</span><p className="font-bold">{entry.status === 'posted' ? 'Contabilizado' : entry.status === 'voided' ? 'Anulado' : 'Borrador'}</p></div>
                        </div>
                        <p className="text-sm text-slate-600">{entry.description}</p>
                        <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left border-t">
                            <thead><tr className="border-b"><th className="py-2 text-[10px] uppercase text-slate-400">Cuenta</th><th className="py-2 text-[10px] uppercase text-slate-400">Detalle</th><th className="py-2 text-[10px] uppercase text-slate-400 text-right">Débito</th><th className="py-2 text-[10px] uppercase text-slate-400 text-right">Crédito</th></tr></thead>
                            <tbody>
                                {(Array.isArray(entry.lines) ? entry.lines : []).map((l, i) => (
                                    <tr key={i} className="border-b border-slate-50">
                                        <td className="py-2 text-xs font-bold">{l.account_code} - {l.account_name}</td>
                                        <td className="py-2 text-xs text-slate-500">{l.description}</td>
                                        <td className="py-2 text-xs font-bold text-emerald-600 text-right"><Money value={l.debit} /></td>
                                        <td className="py-2 text-xs font-bold text-rose-600 text-right"><Money value={l.credit} /></td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot><tr className="font-bold text-xs"><td colSpan={2} className="pt-2">Totales</td><td className="pt-2 text-emerald-600 text-right"><Money value={entry.total_debit} /></td><td className="pt-2 text-rose-600 text-right"><Money value={entry.total_credit} /></td></tr></tfoot>
                        </table></div>
                    </div>
                )}
            </Modal>
    );
};
export default AccountingEntryViewModal;
