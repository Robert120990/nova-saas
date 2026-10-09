import { X, Package, ShieldCheck, AlertTriangle } from 'lucide-react';
import { formatDate } from '../../../utils/dateUtils';

export default function PackagingLotsModal({ open, onClose, presentation, unitOfMeasure = 'lbs' }) {
    if (!open || !presentation) return null;

    const lots = Array.isArray(presentation.lots) ? presentation.lots : [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-100 text-blue-800 rounded-xl">
                            <Package size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-base sm:text-lg font-bold text-slate-900 capitalize">
                                    {presentation.product_type} - {presentation.presentation}
                                </h2>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                                    {presentation.available_units.toLocaleString()} Envases Disponibles
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Peso unitario: <span className="font-semibold text-slate-700">{presentation.unit_weight_lbs} Lbs ({presentation.unit_weight_kg} Kg)</span> &bull; {lots.length} Lote{lots.length !== 1 ? 's' : ''} registrado{lots.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                        title="Cerrar modal"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Sub-header KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border-b border-slate-200/80 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Envases Disponibles</span>
                        <span className="text-sm font-black text-blue-700">{presentation.available_units.toLocaleString()} u.</span>
                        <span className="text-[10px] text-slate-500 block">Envasados: {presentation.total_packaged_units.toLocaleString()}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Existencia en Libras</span>
                        <span className="text-sm font-black text-emerald-700">
                            {presentation.total_stock_lbs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lbs
                        </span>
                        <span className="text-[10px] text-slate-500 block">Neto en producto</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Existencia en Kilos</span>
                        <span className="text-sm font-black text-violet-700">
                            {presentation.total_stock_kg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Kg
                        </span>
                        <span className="text-[10px] text-slate-500 block">Neto equivalente</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Lotes Activos</span>
                        <span className="text-sm font-black text-slate-900">{presentation.active_lots_count || 0}</span>
                        <span className="text-[10px] text-slate-500 block">Con stock disponible</span>
                    </div>
                </div>

                {/* Lots Table */}
                <div className="p-4 sm:p-5 overflow-y-auto flex-1">
                    {lots.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                            <Package size={36} className="text-slate-300" />
                            <p className="text-sm font-semibold text-slate-600">No hay lotes envasados para esta presentación.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                        <th className="p-3">Lote Envasado</th>
                                        <th className="p-3">Lote Producción</th>
                                        <th className="p-3 text-center">Zona / Temp</th>
                                        <th className="p-3 text-center">Calidad</th>
                                        <th className="p-3 text-right">Envases Stock</th>
                                        <th className="p-3 text-right">Existencia (Lbs / Kg)</th>
                                        <th className="p-3 text-center">Vencimiento</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                    {(Array.isArray(lots) ? lots : []).map((lot) => {
                                        const _isAvailable = lot.available_units > 0;
                                        return (
                                            <tr key={lot.id} className="hover:bg-blue-50/40 transition-colors">
                                                <td className="p-3">
                                                    <div className="font-mono font-bold text-slate-900">
                                                        {lot.lot_code || `ENV-${lot.id}`}
                                                    </div>
                                                    {lot.barcode && (
                                                        <div className="font-mono text-[10px] text-slate-400">
                                                            {lot.barcode}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3 font-semibold text-slate-700">
                                                    {lot.batch_code_display || `Lote #${lot.batch_id}`}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                        lot.warehouse_zone === 'BLAST' ? 'bg-cyan-100 text-cyan-800' :
                                                        lot.warehouse_zone === 'COOLER' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-amber-100 text-amber-800'
                                                    }`}>
                                                        {lot.warehouse_zone || 'COOLER'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center">
                                                    {lot.quality_status === 'liberado' ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                                                            <ShieldCheck size={12} /> Liberado
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 inline-flex items-center gap-1">
                                                            <AlertTriangle size={12} /> {lot.quality_status || 'Cuarentena'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <div className="font-black text-slate-900 text-sm">
                                                        {lot.available_units.toLocaleString()} u.
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">
                                                        de {lot.units_packaged.toLocaleString()} prod.
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <div className="font-black text-emerald-700">
                                                        {unitOfMeasure === 'kg'
                                                            ? `${lot.stock_kg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Kg`
                                                            : `${lot.stock_lbs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lbs`
                                                        }
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">
                                                        {unitOfMeasure === 'kg'
                                                            ? `${lot.stock_lbs.toLocaleString()} Lbs`
                                                            : `${lot.stock_kg.toLocaleString()} Kg`
                                                        }
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center font-medium text-slate-700">
                                                    {lot.expiry_date ? formatDate(lot.expiry_date) : 'Sin fecha'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 flex items-center justify-end bg-slate-50/70">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
