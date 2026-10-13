import { useMemo } from 'react';
import Money from '../ui/Money';
import { formatDate } from '../../utils/dateUtils';
import { FileEdit, Loader2 } from 'lucide-react';

const BankChecksTable = ({
    items = [],
    selectedIds = new Set(),
    onToggleSelect,
    onToggleSelectAll,
    onOpenPreview,
    activeSubTab = 'emitidos',
    setActiveSubTab,
    isLoading = false,
    previewingId = null
}) => {
    const isAnulado = activeSubTab === 'anulados';

    const filteredItems = useMemo(() =>
        (Array.isArray(items) ? items : []).filter(item =>
            isAnulado ? Boolean(item.cheque_anulado) : !item.cheque_anulado
        ),
    [items, isAnulado]);

    const selectableItems = useMemo(() =>
        filteredItems.filter(item => !item.es_contabilizado && Boolean(item.corr)),
    [filteredItems]);

    const allSelected = selectableItems.length > 0 && selectableItems.every(i => selectedIds.has(i.id));

    return (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
            {/* Sub-tabs: Cheques Emitidos / Cheques Anulados */}
            <div className="flex items-center justify-between px-3 pt-2 border-b border-slate-100 bg-slate-50/70">
                <div className="flex gap-1.5">
                    <button
                        type="button"
                        onClick={() => setActiveSubTab('emitidos')}
                        className={`px-3 py-1.5 rounded-t-lg text-xs font-bold transition-all border-b-2 cursor-pointer ${
                            !isAnulado
                                ? 'bg-white text-indigo-600 border-indigo-600 shadow-xs'
                                : 'text-slate-500 hover:text-slate-700 border-transparent'
                        }`}
                    >
                        Cheques Emitidos
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSubTab('anulados')}
                        className={`px-3 py-1.5 rounded-t-lg text-xs font-bold transition-all border-b-2 cursor-pointer ${
                            isAnulado
                                ? 'bg-white text-rose-600 border-rose-600 shadow-xs'
                                : 'text-slate-500 hover:text-slate-700 border-transparent'
                        }`}
                    >
                        Cheques Anulados
                    </button>
                </div>
                <div className="text-[11px] font-semibold text-slate-400 pb-1 flex items-center gap-3">
                    {previewingId && (
                        <span className="inline-flex items-center gap-1.5 text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full animate-pulse">
                            <Loader2 size={12} className="animate-spin" />
                            Preparando partida...
                        </span>
                    )}
                    <span>{filteredItems.length} {isAnulado ? 'anulados' : 'emitidos'}</span>
                    {selectedIds.size > 0 && (
                        <span className="text-indigo-600 font-bold">({selectedIds.size} seleccionados)</span>
                    )}
                </div>
            </div>

            {/* Contained Table with Fixed Height (~40 records), Sticky Header & Custom Scrollbar */}
            <div className="overflow-x-hidden overflow-y-auto h-[620px] max-h-[calc(100vh-270px)] custom-scrollbar">
                <table className="table-fixed w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 select-none z-10 shadow-xs">
                        <tr>
                            <th className="py-1.5 px-1.5 w-8 text-center">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    disabled={selectableItems.length === 0}
                                    onChange={(e) => onToggleSelectAll(selectableItems.map(i => i.id), e.target.checked)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30"
                                    title="Seleccionar todos los pendientes"
                                />
                            </th>
                            <th className="py-1.5 px-1.5 w-20">Fecha</th>
                            <th className="py-1.5 px-1.5 w-20">Cheque</th>
                            <th className="py-1.5 px-1.5 w-[20%]">Cuenta Bancaria</th>
                            <th className="py-1.5 px-1.5 w-[20%]">Beneficiario</th>
                            <th className="py-1.5 px-1.5 w-20 text-right">Monto</th>
                            <th className="py-1.5 px-1.5 w-[23%]">Concepto</th>
                            <th className="py-1.5 px-1.5 w-18 text-center">Condición</th>
                            <th className="py-1.5 px-1.5 w-16 text-center">Corr</th>
                            <th className="py-1.5 px-1 w-8 text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                        {isLoading ? (
                            <tr>
                                <td colSpan={10} className="py-12 text-center text-slate-400">
                                    Cargando cheques desde la oficina...
                                </td>
                            </tr>
                        ) : filteredItems.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="py-12 text-center text-slate-400">
                                    No se encontraron cheques para el período seleccionado
                                </td>
                            </tr>
                        ) : (
                            filteredItems.map((row) => {
                                const isSelected = selectedIds.has(row.id);
                                const isPreviewing = previewingId === row.id;
                                return (
                                    <tr
                                        key={row.id}
                                        onDoubleClick={() => !previewingId && onOpenPreview(row)}
                                        className={`transition-colors cursor-pointer select-none leading-tight ${
                                            isSelected
                                                ? 'bg-indigo-50/70'
                                                : isPreviewing
                                                    ? 'bg-indigo-100/60 ring-1 ring-inset ring-indigo-400 cursor-wait'
                                                    : 'hover:bg-slate-50/80'
                                        }`}
                                    >
                                        <td className="py-1 px-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                disabled={row.es_contabilizado || !row.corr || Boolean(previewingId)}
                                                title={
                                                    row.es_contabilizado
                                                        ? 'Ya contabilizado'
                                                        : !row.corr
                                                            ? 'Sin correlativo asignado. Debe reservarlo en Reserva de Correlativos.'
                                                            : 'Seleccionar para contabilizar'
                                                }
                                                onChange={() => onToggleSelect(row.id)}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30"
                                            />
                                        </td>
                                        <td className="py-1 px-1.5 whitespace-nowrap text-slate-600 font-mono">
                                            {formatDate(row.fecha)}
                                        </td>
                                        <td className="py-1 px-1.5 whitespace-nowrap font-mono font-bold text-slate-900">
                                            {row.cheque}
                                        </td>
                                        <td className="py-1 px-1.5 truncate text-slate-700" title={row.cuenta_label}>
                                            {row.cuenta_label}
                                        </td>
                                        <td className="py-1 px-1.5 truncate font-bold text-slate-800" title={row.beneficiario}>
                                            {row.beneficiario || '-'}
                                        </td>
                                        <td className="py-1 px-1.5 text-right whitespace-nowrap font-mono font-bold text-slate-900">
                                            <Money value={row.monto} />
                                        </td>
                                        <td className="py-1 px-1.5 truncate text-slate-600" title={row.concepto}>
                                            {row.concepto || '-'}
                                        </td>
                                        <td className="py-1 px-1.5 text-center whitespace-nowrap">
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                                row.condicion === 'CONTADO' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                                            }`}>
                                                {row.condicion}
                                            </span>
                                        </td>
                                        <td className="py-1 px-1.5 text-center whitespace-nowrap font-mono">
                                            {row.corr ? (
                                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                                    #{row.corr}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 text-[10px]">-</span>
                                            )}
                                        </td>
                                        <td className="py-1 px-1 text-center" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                disabled={Boolean(previewingId)}
                                                onClick={() => onOpenPreview(row)}
                                                className={`p-0.5 rounded transition-colors cursor-pointer ${
                                                    isPreviewing
                                                        ? 'text-indigo-600 bg-indigo-100 cursor-wait'
                                                        : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                                                }`}
                                                title={isPreviewing ? 'Cargando partida...' : 'Ver / Editar partida'}
                                            >
                                                {isPreviewing ? <Loader2 size={13} className="animate-spin" /> : <FileEdit size={13} />}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer with Double-Click Hint & Selection Summary */}
            <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-[11px] text-slate-500">
                <span className="text-slate-400">💡 Doble clic en cualquier fila para abrir la vista previa editable de la partida.</span>
                <div className="flex items-center gap-3">
                    <span>Total: <strong className="text-slate-700">{filteredItems.length}</strong> {isAnulado ? 'anulados' : 'emitidos'}</span>
                    {selectedIds.size > 0 && (
                        <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            {selectedIds.size} seleccionados
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BankChecksTable;
