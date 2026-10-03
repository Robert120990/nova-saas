import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../ui/Modal';
import Money, { MoneyInput } from '../ui/Money';
import { getTodayString } from '../../utils/dateUtils';

const AccountingEntryModal = ({ open, onClose, onSubmit, editingEntry, entryTypes, accountSearch, setAccountSearch, selectedAccountId, setSelectedAccountId, accountResults, accounts, lines, setLines, removeLine, balanced, totalDebit, totalCredit, saving }) => {
    if (!open) return null;
    return (
<Modal isOpen={open} onClose={onClose} title={editingEntry ? 'Editar Partida' : 'Nueva Partida Contable'} maxWidth="max-w-3xl">
                <form onSubmit={onSubmit} className="space-y-4 pt-4">
                    <fieldset disabled={saving} className="space-y-4">
                    <div className="space-y-3">
                        {!editingEntry && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Tipo de Partida</label>
                            <select name="entry_type_id" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold">
                                {(Array.isArray(entryTypes) ? entryTypes : []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Fecha</label>
                            <input name="date" type="date" defaultValue={getTodayString()} required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                        </div>
                        </div>
                        )}
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Descripción</label>
                            <input name="description" placeholder="Concepto de la partida" required defaultValue={editingEntry?.description || ''} onChange={(e) => { e.target.value = e.target.value.toUpperCase(); }} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm uppercase" />
                        </div>
                    </div>

                    <div className="border-t pt-4">
                        <span className="text-[10px] font-black uppercase text-slate-400 mb-3 block">Líneas de la Partida</span>
                        
                        {/* Quick-add bar */}
                        <div className="mb-4 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[110px_1fr_110px_110px_auto] gap-2 items-end">
                            <div className="w-full relative">
                                <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1">Cuenta (F3)</label>
                                <input
                                    id="quick-account"
                                    autoComplete="off"
                                    placeholder="Código..."
                                    className="w-full px-2 py-2 bg-white border border-indigo-200 rounded-xl text-[11px] font-bold font-mono outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    onChange={(e) => {
                                        setAccountSearch(e.target.value);
                                        if (!e.target.value) setSelectedAccountId('');
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') { setAccountSearch(''); setSelectedAccountId(''); }
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const first = accountResults[0];
                                            if (first) {
                                                setSelectedAccountId(first.id);
                                                document.getElementById('quick-account').value = first.code;
                                                setAccountSearch('');
                                            }
                                        }
                                    }}
                                />
                                {accountSearch && (
                                    <div className="absolute top-full left-0 z-20 bg-white border border-slate-200 rounded-xl shadow-lg w-80 max-w-[calc(100vw-32px)] max-h-48 overflow-y-auto mt-1">
                                        {accountResults.length === 0 ? (
                                            <div className="px-3 py-2 text-[10px] text-slate-400">Sin resultados</div>
                                        ) : (
                                            (Array.isArray(accountResults) ? accountResults : []).map(a => (
                                                <div key={a.id}
                                                    className="px-3 py-2 text-[10px] font-bold hover:bg-indigo-50 cursor-pointer border-b border-slate-50 flex justify-between"
                                                    onClick={() => {
                                                        setSelectedAccountId(a.id);
                                                        document.getElementById('quick-account').value = a.code;
                                                        setAccountSearch('');
                                                    }}
                                                >
                                                    <span className="font-mono text-indigo-500">{a.code}</span>
                                                    <span className="flex-1 ml-2 truncate">{a.name}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1">Detalle</label>
                                <input id="quick-desc" placeholder="Descripción" onChange={(e) => { e.target.value = e.target.value.toUpperCase(); }} className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-[11px] outline-none uppercase" />
                            </div>
                            <div className="w-full">
                                <label className="text-[8px] font-black text-emerald-500 uppercase ml-1 block mb-1">Débito</label>
                                <MoneyInput id="quick-debit" step="0.01" placeholder="0.00" className="w-full px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] font-bold text-emerald-700 outline-none"
                                    onChange={(e) => { if (e.target.value) document.getElementById('quick-credit').value = ''; }} />
                            </div>
                            <div className="w-full">
                                <label className="text-[8px] font-black text-rose-500 uppercase ml-1 block mb-1">Crédito</label>
                                <MoneyInput id="quick-credit" step="0.01" placeholder="0.00" className="w-full px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-[11px] font-bold text-rose-700 outline-none"
                                    onChange={(e) => { if (e.target.value) document.getElementById('quick-debit').value = ''; }} />
                            </div>
                            <button type="button" onClick={() => {
                                const acct = selectedAccountId;
                                const desc = document.getElementById('quick-desc').value;
                                const debit = document.getElementById('quick-debit')?.value || '';
                                const credit = document.getElementById('quick-credit')?.value || '';
                                if (!acct) return toast.error('Seleccione una cuenta');
                                if ((!debit || isNaN(parseFloat(debit))) && (!credit || isNaN(parseFloat(credit)))) return toast.error('Ingrese débito o crédito');
                                setLines([...lines, { account_id: acct, description: desc, debit: debit || '', credit: credit || '' }]);
                                setSelectedAccountId('');
                                document.getElementById('quick-account').value = '';
                                document.getElementById('quick-desc').value = '';
                                document.getElementById('quick-debit').value = '';
                                document.getElementById('quick-credit').value = '';
                                document.getElementById('quick-account').focus();
                            }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-black text-xs transition-all shrink-0">
                                + Agregar
                            </button>
                            </div>
                            {selectedAccountId && (
                                <div className="text-[10px] font-bold text-indigo-600 bg-white/80 px-3 py-1 rounded-lg">
                                    {accounts.find(a => a.id == selectedAccountId)?.code} — {accounts.find(a => a.id == selectedAccountId)?.name}
                                </div>
                            )}
                        </div>

                        {/* Lines table */}
                        {lines.length === 0 ? (
                            <p className="text-center py-6 text-slate-300 text-xs">Sin líneas. Use la barra superior para agregar.</p>
                        ) : (
                            <div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left border rounded-xl overflow-hidden">
                                <thead>
                                    <tr className="bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        <th className="px-3 py-2 w-8">#</th>
                                        <th className="px-3 py-2">Cuenta</th>
                                        <th className="px-3 py-2">Detalle</th>
                                        <th className="px-3 py-2 text-right w-28">Débito</th>
                                        <th className="px-3 py-2 text-right w-28">Crédito</th>
                                        <th className="px-3 py-2 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(Array.isArray(lines) ? lines : []).map((line, idx) => (
                                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="px-3 py-2 text-[10px] text-slate-400">{idx + 1}</td>
                                            <td className="px-3 py-2 text-[10px] font-bold">
                                                <span className="font-mono text-indigo-500">{accounts.find(a => a.id == line.account_id)?.code || '?'}</span>
                                                <span className="ml-2 text-slate-700">{accounts.find(a => a.id == line.account_id)?.name || '?'}</span>
                                            </td>
                                            <td className="px-3 py-2 text-[10px] text-slate-500">{line.description}</td>
                                            <td className="px-3 py-2 text-[10px] font-bold text-emerald-600 text-right">{line.debit ? <Money value={line.debit} /> : ''}</td>
                                            <td className="px-3 py-2 text-[10px] font-bold text-rose-600 text-right">{line.credit ? <Money value={line.credit} /> : ''}</td>
                                            <td className="px-3 py-2">
                                                <button type="button" onClick={() => removeLine(idx)} className="p-1 text-rose-300 hover:text-rose-600"><Trash2 size={14} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table></div>
                        )}
                        <div className="flex justify-between text-xs font-bold mt-3 pt-3 border-t">
                            <span className={balanced ? 'text-emerald-600' : 'text-rose-600'}>{balanced ? '✓ Cuadra' : '✗ No cuadra'}</span>
                            <span>Débito: <b className="text-emerald-600"><Money value={totalDebit} /></b> | Crédito: <b className="text-rose-600"><Money value={totalCredit} /></b></span>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 py-3 text-xs font-black uppercase text-slate-400">Cancelar</button>
                        <button type="submit" disabled={!balanced || saving} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black uppercase text-xs disabled:opacity-50">
                            {saving ? 'Guardando...' : editingEntry ? 'Actualizar Partida' : 'Registrar Partida'}
                        </button>
                    </div>
                    </fieldset>
                </form>
            </Modal>
    );
};
export default AccountingEntryModal;
