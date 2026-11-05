import { Layers, Package, Receipt, TrendingUp } from 'lucide-react';
import Modal from '../ui/Modal';
import Money from '../ui/Money';

const ShiftSalesByCategoryModal = ({ isOpen, open, onClose, shiftSummary }) => {
    const visible = Boolean(isOpen ?? open);
    if (!visible) return null;

    const categories = Array.isArray(shiftSummary?.salesByCategory)
        ? shiftSummary.salesByCategory
        : [];

    const totalCategorySales = categories.reduce(
        (acc, item) => acc + (parseFloat(item.total) || 0),
        0
    );
    const totalUnits = categories.reduce(
        (acc, item) => acc + (parseFloat(item.cantidad) || 0),
        0
    );
    const baseTotal = totalCategorySales > 0
        ? totalCategorySales
        : (parseFloat(shiftSummary?.total_sales) || 0);

    return (
        <Modal
            isOpen={visible}
            onClose={onClose}
            title="Venta por Categoría de Producto"
            maxWidth="max-w-2xl"
        >
            <div className="space-y-5 py-2">
                {/* Cabecera contextual del turno */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                            {shiftSummary?.pos_name || 'Terminal POS'} — {shiftSummary?.branch_name || 'Sucursal'}
                        </p>
                        <p className="text-xs font-bold text-slate-600 mt-0.5">
                            Responsable: <span className="text-slate-900 font-black">{shiftSummary?.seller_name || 'Sin asignar'}</span>
                        </p>
                    </div>
                    <div className="text-left sm:text-right">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                            Total categorizado
                        </span>
                        <span className="text-xl font-black text-emerald-600 tabular-nums">
                            <Money value={totalCategorySales} />
                        </span>
                    </div>
                </div>

                {/* KPIs rápidos */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-white border border-slate-100 rounded-2xl p-3.5 shadow-xs flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <Layers size={18} />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Categorías</span>
                            <span className="text-base font-black text-slate-900 tabular-nums">{categories.length}</span>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl p-3.5 shadow-xs flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                            <Package size={18} />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Unidades</span>
                            <span className="text-base font-black text-slate-900 tabular-nums">
                                {Number.isInteger(totalUnits) ? totalUnits : totalUnits.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    <div className="col-span-2 sm:col-span-1 bg-white border border-slate-100 rounded-2xl p-3.5 shadow-xs flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <TrendingUp size={18} />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Ventas</span>
                            <span className="text-base font-black text-emerald-600 tabular-nums">
                                <Money value={totalCategorySales} />
                            </span>
                        </div>
                    </div>
                </div>

                {/* Tabla de Categorías */}
                {categories.length === 0 ? (
                    <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl py-10 px-4 text-center">
                        <Receipt size={28} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-sm font-bold text-slate-500">
                            No se registran ventas por categoría en este turno.
                        </p>
                    </div>
                ) : (
                    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
                        <div className="overflow-x-auto max-h-[50vh]">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                            Categoría
                                        </th>
                                        <th className="py-3 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">
                                            Unidades
                                        </th>
                                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">
                                            % Part.
                                        </th>
                                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">
                                            Total Venta
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {categories.map((cat, idx) => {
                                        const total = parseFloat(cat.total) || 0;
                                        const qty = parseFloat(cat.cantidad) || 0;
                                        const pct = baseTotal > 0 ? (total / baseTotal) * 100 : 0;

                                        return (
                                            <tr key={`${cat.categoria}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-3 px-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[13px] font-bold text-slate-800">
                                                            {cat.categoria || 'Sin Categoría'}
                                                        </span>
                                                        <div className="w-full max-w-[180px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-indigo-500 rounded-full"
                                                                style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3 text-right text-[13px] font-bold text-slate-600 tabular-nums">
                                                    {qty > 0 ? (Number.isInteger(qty) ? qty : qty.toFixed(2)) : '—'}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 text-[11px] font-black tabular-nums">
                                                        {pct.toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right text-[13px] font-black text-slate-900 tabular-nums">
                                                    <Money value={total} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                    <tr>
                                        <td className="py-3 px-4 text-xs font-black uppercase tracking-wider text-slate-800">
                                            Total General
                                        </td>
                                        <td className="py-3 px-3 text-right text-xs font-black text-slate-700 tabular-nums">
                                            {totalUnits > 0 ? (Number.isInteger(totalUnits) ? totalUnits : totalUnits.toFixed(2)) : '—'}
                                        </td>
                                        <td className="py-3 px-4 text-right text-xs font-black text-indigo-600 tabular-nums">
                                            100.0%
                                        </td>
                                        <td className="py-3 px-4 text-right text-sm font-black text-emerald-600 tabular-nums">
                                            <Money value={totalCategorySales} />
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

                <div className="flex justify-end pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ShiftSalesByCategoryModal;

