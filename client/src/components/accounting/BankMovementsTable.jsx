import { useMemo } from 'react';
import Money from '../ui/Money';
import { formatDate } from '../../utils/dateUtils';
import { FileEdit } from 'lucide-react';

const BankMovementsTable = ({
    items = [],
    selectedIds = new Set(),
    onToggleSelect,
    onToggleSelectAll,
    onOpenPreview,
    isLoading = false
}) => {
    const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);

    const selectableItems = useMemo(() =>
        safeItems.filter(item => !item.es_contabilizado),
    [safeItems]);

    const allSelected = selectableItems.length > 0 && selectableItems.every(i => selectedIds.has(i.id));

    const getTipoBadgeClass = (tipo) => {
        const s = (tipo || '').toUpperCase();
        if (s.includes('REMESA') || s.startsWith('01')) {
            return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        }
        if (s.includes('CARGO') || s.startsWith('02')) {
            return 'bg-amber-100 text-amber-800 border-amber-200';
        }
        if (s.includes('ABONO') || s.startsWith('03')) {
            return 'bg-blue-100 text-blue-800 border-blue-200';
        }
        return 'bg-slate-100 text-slate-800 border-slate-200';
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
            {/* Top Info Bar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <span>Total de Movimientos: <strong className="text-slate-700">{safeItems.length}</strong></span>
                {selectedIds.size > 0 && (
                    <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                        {selectedIds.size} seleccionados
                    </span>
                )}
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
                            <th className="py-1.5 px-1.5 w-24">Referencia</th>
                            <th className="py-1.5 px-1.5 w-32">Tipo Movimiento</th>
                            <th className="py-1.5 px-1.5 w-[23%]">Cuenta Bancaria</th>
                            <th className="py-1.5 px-1.5 w-[26%]">Concepto</th>
                            <th className="py-1.5 px-1.5 w-20 text-right">Monto</th>
                            <th className="py-1.5 px-1.5 w-16 text-center">Corr</th>
                            <th className="py-1.5 px-1 w-8 text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                        {isLoading ? (
                            <tr>
                                <td colSpan={9} className="py-12 text-center text-slate-400">
                                    Cargando movimientos bancarios desde la oficina...
                                </td>
                            </tr>
                        ) : safeItems.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="py-12 text-center text-slate-400">
                                    No se encontraron movimientos bancarios para el período seleccionado
                                </td>
                            </tr>
                        ) : (
                            safeItems.map((row) => {
                                const isSelected = selectedIds.has(row.id);
                                return (
                                    <tr
                                        key={row.id}
                                        onDoubleClick={() => onOpenPreview(row)}
                                        className={`transition-colors cursor-pointer select-none leading-tight ${
                                            isSelected ? 'bg-indigo-50/70' : 'hover:bg-slate-50/80'
                                        }`}
                                    >
                                        <td className="py-1 px-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                disabled={row.es_contabilizado}
                                                onChange={() => onToggleSelect(row.id)}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30"
                                            />
                                        </td>
                                        <td className="py-1 px-1.5 whitespace-nowrap text-slate-600 font-mono">
                                            {formatDate(row.fecha)}
                                        </td>
                                        <td className="py-1 px-1.5 whitespace-nowrap font-mono font-bold text-slate-900">
                                            {row.referencia}
                                        </td>
                                        <td className="py-1 px-1.5 whitespace-nowrap">
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${getTipoBadgeClass(row.tipo_movimiento)}`}>
                                                {row.tipo_movimiento}
                                            </span>
                                        </td>
                                        <td className="py-1 px-1.5 truncate text-slate-700" title={row.cuenta_label}>
                                            {row.cuenta_label}
                                        </td>
                                        <td className="py-1 px-1.5 truncate text-slate-600" title={row.concepto}>
                                            {row.concepto || '-'}
                                        </td>
                                        <td className="py-1 px-1.5 text-right whitespace-nowrap font-mono font-bold text-slate-900">
                                            <Money value={row.monto} />
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
                                                onClick={() => onOpenPreview(row)}
                                                className="p-0.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                                title="Ver / Editar partida"
                                            >
                                                <FileEdit size={13} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer with Double-Click Hint & Total Summary */}
            <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-[11px] text-slate-500">
                <span className="text-slate-400">💡 Doble clic en cualquier fila para abrir la vista previa editable de la partida.</span>
                <div className="flex items-center gap-3">
                    <span>Total: <strong className="text-slate-700">{safeItems.length}</strong> movimientos</span>
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

export default BankMovementsTable;
