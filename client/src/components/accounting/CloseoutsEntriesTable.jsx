import { useState, useMemo } from 'react';
import { Calculator, CheckCircle2, XCircle, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import Money, { MoneyInput } from '../ui/Money';
import AccountSelect from './AccountSelect';

const compactInputCls = "w-full px-2 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 uppercase transition-all";

const CloseoutsEntriesTable = ({
    lines = [],
    entryAccounts = [],
    updateLine,
    removeLine,
    onAddQuickLine,
    totals,
    unassignedCount = 0,
    canGenerate = false,
    isGenerating = false,
    onGenerate,
    onClear
}) => {
    const [newLine, setNewLine] = useState({ account_id: '', description: '', debit: 0, credit: 0 });

    const selectedNewAccount = useMemo(() =>
        (Array.isArray(entryAccounts) ? entryAccounts : []).find(a => String(a.id) === String(newLine.account_id)),
    [entryAccounts, newLine.account_id]);

    const handleQuickAdd = () => {
        if (!newLine.account_id) {
            toast.error('Selecciona una cuenta contable');
            return;
        }
        if (!newLine.description?.trim()) {
            toast.error('Ingresa un concepto');
            return;
        }
        const deb = parseFloat(newLine.debit) || 0;
        const crd = parseFloat(newLine.credit) || 0;
        if (deb <= 0 && crd <= 0) {
            toast.error('Ingresa un valor en Cargo o Abono');
            return;
        }
        onAddQuickLine(newLine);
        setNewLine({ account_id: '', description: '', debit: 0, credit: 0 });
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            {/* Top Quick Entry Bar */}
            <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 flex flex-wrap md:flex-nowrap items-center gap-1.5 text-xs">
                <div className="w-full md:w-28 shrink-0">
                    <AccountSelect
                        value={newLine.account_id}
                        onChange={v => setNewLine(p => ({ ...p, account_id: v }))}
                        accounts={entryAccounts}
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
                    onClick={handleQuickAdd}
                    title="Agregar línea a la partida"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-1 rounded transition-colors flex items-center justify-center shrink-0 shadow-sm"
                >
                    <Plus size={14} />
                </button>
            </div>

            {/* Table Viewport */}
            <div className="overflow-x-auto overscroll-y-auto">
                <table className="w-full min-w-[900px] border-collapse text-[11px]">
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
                        {(Array.isArray(lines) ? lines : []).map((l, idx) => {
                            return (
                                <tr
                                    key={idx}
                                    className={`transition-colors hover:bg-indigo-50/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                                >
                                    {/* Cuenta Selector Compact */}
                                    <td className="px-1.5 py-0.5">
                                        <div className="w-28">
                                            <AccountSelect
                                                value={l.account_id}
                                                onChange={v => updateLine(idx, { account_id: v })}
                                                accounts={entryAccounts}
                                                placeholder="Asignar..."
                                                compact
                                                showCodeOnly
                                            />
                                        </div>
                                    </td>

                                    {/* Nombre Cuenta */}
                                    <td className="px-3 py-1 text-slate-700 w-72 max-w-[290px] truncate" title={l.account_name}>
                                        {l.account_name ? (
                                            <span className="font-bold text-[11px] uppercase text-slate-800 leading-snug">{l.account_name}</span>
                                        ) : (
                                            <span className="text-[10px] font-bold text-slate-400 italic">Cuenta requerida</span>
                                        )}
                                    </td>

                                    {/* Concepto (Read-Only) */}
                                    <td className="px-3 py-1">
                                        <div className="text-[11px] font-semibold text-slate-800 uppercase select-text leading-snug truncate max-w-md" title={l.description}>
                                            {l.description}
                                        </div>
                                    </td>

                                    {/* Cargo (Debe) */}
                                    <td className="px-1 py-0.5 text-right font-mono">
                                        <MoneyInput
                                            value={l.debit}
                                            onChange={e => updateLine(idx, { debit: parseFloat(e.target.value) || 0, credit: 0 })}
                                            className="w-full text-right px-1.5 py-0.5 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded font-mono text-[11px] font-bold text-slate-900 outline-none"
                                        />
                                    </td>

                                    {/* Abono (Haber) */}
                                    <td className="px-1 py-0.5 text-right font-mono">
                                        <MoneyInput
                                            value={l.credit}
                                            onChange={e => updateLine(idx, { credit: parseFloat(e.target.value) || 0, debit: 0 })}
                                            className="w-full text-right px-1.5 py-0.5 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded font-mono text-[11px] font-bold text-slate-900 outline-none"
                                        />
                                    </td>

                                    {/* Acciones */}
                                    <td className="px-1 py-0.5 text-center">
                                        <button
                                            type="button"
                                            onClick={() => removeLine(idx)}
                                            title="Eliminar fila"
                                            className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>

                    {/* Totales & Cuadre exacto como la imagen de referencia */}
                    <tfoot className="sticky bottom-0 z-10 bg-slate-100 border-t-2 border-slate-300 font-mono text-xs font-black">
                        <tr>
                            <td colSpan={3} className="px-3 py-1.5 text-right">
                                <div className="flex items-center justify-end gap-2.5">
                                    <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider">TOTALES</span>
                                    <div className={`px-2 py-0.5 rounded border font-mono text-[10px] font-black inline-flex items-center gap-1 shadow-sm ${
                                        totals?.balanced
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                            : 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                                    }`}>
                                        {totals?.balanced ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                                        <Money value={totals?.diff || 0} />
                                    </div>
                                </div>
                            </td>
                            {/* Total Cargo */}
                            <td className="px-2 py-1.5 text-right text-indigo-900 text-xs">
                                <Money value={totals?.cargo || 0} />
                            </td>
                            {/* Total Abono */}
                            <td className="px-2 py-1.5 text-right text-indigo-900 text-xs">
                                <Money value={totals?.abono || 0} />
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Bottom Action Bar */}
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
                        onClick={onClear}
                        className="px-3 py-1 text-slate-500 font-bold hover:text-slate-700 text-xs transition-colors"
                    >
                        Limpiar
                    </button>

                    <button
                        type="button"
                        onClick={onGenerate}
                        disabled={!canGenerate}
                        title={!totals?.balanced ? 'La partida no cuadra' : unassignedCount > 0 ? 'Faltan cuentas contables por asignar' : undefined}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-1.5 rounded-lg font-black uppercase text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                    >
                        <Calculator size={14} />
                        {isGenerating ? 'Asentando...' : 'Generar Partida de Cierre de Turno'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CloseoutsEntriesTable;
