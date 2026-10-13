import { Plus, Trash2, CheckCircle2, XCircle, Loader2, Save } from 'lucide-react';
import Money, { MoneyInput } from '../../ui/Money';
import AccountSelect from '../AccountSelect';

const compactInputCls = "w-full px-2 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 uppercase transition-all";

const AccountingEntryLinesTable = ({
    lines = [],
    selectableAccounts = [],
    accountsMap,
    newLine,
    setNewLine,
    selectedNewAccount,
    onQuickAdd,
    onAccountChange,
    onFieldChange,
    onDebitChange,
    onCreditChange,
    onRemoveLine,
    totals,
    unassignedCount = 0,
    onClose,
    isSaving = false,
    editingEntry = null,
}) => {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            {/* Top Quick Entry Bar */}
            <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 flex flex-wrap md:flex-nowrap items-center gap-1.5 text-xs">
                <div className="w-full md:w-28 shrink-0">
                    <AccountSelect
                        value={newLine.account_id}
                        onChange={v => setNewLine(p => ({ ...p, account_id: v }))}
                        accounts={selectableAccounts}
                        placeholder="+ Cuenta..."
                        compact
                        showCodeOnly
                    />
                </div>
                <div className="w-full md:w-72 shrink-0">
                    <div
                        className="w-full px-2 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-bold uppercase truncate text-slate-800 leading-snug h-[26px] flex items-center"
                        title={selectedNewAccount?.name || ''}
                    >
                        {selectedNewAccount?.name ? (
                            <span className="truncate">{selectedNewAccount.name}</span>
                        ) : (
                            <span className="text-slate-400 font-medium italic text-[10px]">Nombre de la cuenta...</span>
                        )}
                    </div>
                </div>
                <div className="flex-1 min-w-[140px]">
                    <input
                        placeholder="CONCEPTO..."
                        value={newLine.description}
                        onChange={e => setNewLine(p => ({ ...p, description: e.target.value.toUpperCase() }))}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                onQuickAdd();
                            }
                        }}
                        className={compactInputCls}
                    />
                </div>
                <div className="w-24 shrink-0">
                    <MoneyInput
                        placeholder="Cargo"
                        value={newLine.debit}
                        onChange={e => setNewLine(p => ({ ...p, debit: e.target.value, credit: 0 }))}
                        className={`${compactInputCls} text-right font-mono`}
                    />
                </div>
                <div className="w-24 shrink-0">
                    <MoneyInput
                        placeholder="Abono"
                        value={newLine.credit}
                        onChange={e => setNewLine(p => ({ ...p, credit: e.target.value, debit: 0 }))}
                        className={`${compactInputCls} text-right font-mono`}
                    />
                </div>
                <button
                    type="button"
                    onClick={onQuickAdd}
                    title="Agregar línea a la partida"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-1 rounded transition-colors flex items-center justify-center shrink-0 shadow-sm"
                >
                    <Plus size={14} />
                </button>
            </div>

            {/* Table Viewport */}
            <div className="overflow-x-auto max-h-[340px]">
                <table className="w-full min-w-[850px] border-collapse text-[11px]">
                    <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-300 text-[10px] font-bold uppercase text-slate-600 tracking-wider">
                        <tr>
                            <th className="px-2 py-1.5 text-left w-28 shrink-0">Cuenta</th>
                            <th className="px-3 py-1.5 text-left w-72">Nombre Cuenta</th>
                            <th className="px-3 py-1.5 text-left">Concepto</th>
                            <th className="px-2 py-1.5 text-right w-24">Cargo</th>
                            <th className="px-2 py-1.5 text-right w-24">Abono</th>
                            <th className="px-1 py-1.5 w-7 text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                        {lines.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-8 text-slate-400 text-xs italic">
                                    Sin líneas registradas. Usa la barra superior para agregar cargos y abonos.
                                </td>
                            </tr>
                        ) : (
                            lines.map((l, idx) => {
                                const acc = accountsMap.get(String(l.account_id));
                                const accountName = l.account_name || acc?.name || '';
                                return (
                                    <tr
                                        key={l.id || idx}
                                        className={`transition-colors hover:bg-indigo-50/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                                    >
                                        {/* Cuenta Selector Compact */}
                                        <td className="px-1.5 py-0.5">
                                            <div className="w-28">
                                                <AccountSelect
                                                    value={l.account_id}
                                                    onChange={v => onAccountChange(idx, v)}
                                                    accounts={selectableAccounts}
                                                    placeholder="Asignar..."
                                                    compact
                                                    showCodeOnly
                                                />
                                            </div>
                                        </td>

                                        {/* Nombre Cuenta */}
                                        <td className="px-3 py-1 text-slate-700 w-72 max-w-[290px] truncate" title={accountName}>
                                            {accountName ? (
                                                <span className="font-bold text-[11px] uppercase text-slate-800 leading-snug">{accountName}</span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-rose-500 italic">Cuenta requerida</span>
                                            )}
                                        </td>

                                        {/* Concepto Editable */}
                                        <td className="px-2 py-0.5">
                                            <input
                                                type="text"
                                                value={l.description}
                                                onChange={e => onFieldChange(idx, 'description', e.target.value.toUpperCase())}
                                                className={compactInputCls}
                                                placeholder="CONCEPTO..."
                                            />
                                        </td>

                                        {/* Cargo (Debe) */}
                                        <td className="px-1 py-0.5 text-right font-mono">
                                            <MoneyInput
                                                value={l.debit}
                                                onChange={e => onDebitChange(idx, e.target.value)}
                                                className="w-full text-right px-1.5 py-0.5 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded font-mono text-[11px] font-bold text-slate-900 outline-none"
                                            />
                                        </td>

                                        {/* Abono (Haber) */}
                                        <td className="px-1 py-0.5 text-right font-mono">
                                            <MoneyInput
                                                value={l.credit}
                                                onChange={e => onCreditChange(idx, e.target.value)}
                                                className="w-full text-right px-1.5 py-0.5 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded font-mono text-[11px] font-bold text-slate-900 outline-none"
                                            />
                                        </td>

                                        {/* Acciones */}
                                        <td className="px-1 py-0.5 text-center">
                                            <button
                                                type="button"
                                                onClick={() => onRemoveLine(idx)}
                                                title="Eliminar fila"
                                                className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>

                    {/* Totales & Cuadre exacto como en Partida de Cheques */}
                    <tfoot className="sticky bottom-0 z-10 bg-slate-100 border-t-2 border-slate-300 font-mono text-xs font-black">
                        <tr>
                            <td colSpan={3} className="px-3 py-1.5 text-right">
                                <div className="flex items-center justify-end gap-2.5">
                                    <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider">TOTALES</span>
                                    <div className={`px-2 py-0.5 rounded border font-mono text-[10px] font-black inline-flex items-center gap-1 shadow-sm ${
                                        totals.isBalanced
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                            : 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                                    }`}>
                                        {totals.isBalanced ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                                        <Money value={totals.diff} />
                                    </div>
                                </div>
                            </td>
                            <td className="px-2 py-1.5 text-right text-indigo-900 text-xs">
                                <Money value={totals.debit} />
                            </td>
                            <td className="px-2 py-1.5 text-right text-indigo-900 text-xs">
                                <Money value={totals.credit} />
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Bottom Summary & Actions */}
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="text-xs text-slate-500 font-medium">
                    <span>Líneas en partida: <b>{lines.length}</b></span>
                    {unassignedCount > 0 && (
                        <span className="ml-2.5 text-amber-600 font-bold">({unassignedCount} sin cuenta)</span>
                    )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={!totals.isBalanced || unassignedCount > 0 || isSaving || lines.length < 2}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg font-black uppercase text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                    >
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {editingEntry ? 'Actualizar Partida' : 'Registrar Partida'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AccountingEntryLinesTable;
