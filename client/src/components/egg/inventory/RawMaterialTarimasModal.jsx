import { X, Layers, MapPin, AlertTriangle, ShieldCheck } from 'lucide-react';
import { formatDate } from '../../../utils/dateUtils';

export default function RawMaterialTarimasModal({ open, onClose, lot }) {
    if (!open || !lot) return null;

    const tarimas = Array.isArray(lot.tarimas) ? lot.tarimas : [];
    const totalTarimaBoxes = tarimas.reduce((acc, t) => acc + (parseInt(t.boxes_count || 0, 10)), 0);
    const totalTarimaNetLbs = tarimas.reduce((acc, t) => acc + (parseFloat(t.net_weight_lbs || 0)), 0);
    const totalTarimaGrossLbs = tarimas.reduce((acc, t) => acc + (parseFloat(t.gross_weight_lbs || 0)), 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-3.5 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="p-2 sm:p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0">
                            <Layers size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                                    Tarimas de Materia Prima
                                </h2>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                                    Lote: {lot.provider_lot || 'S/L'}
                                </span>
                                {lot.quality_status === 'aprobado' ? (
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                        <ShieldCheck size={13} /> Aprobado
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                                        <AlertTriangle size={13} /> {lot.quality_status || 'Pendiente'}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                {lot.provider_name} &bull; {lot.farm_name || 'Granja Principal'} &bull; Tipo: <span className="font-semibold text-slate-700 capitalize">{lot.egg_type}</span>
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

                {/* Sub-header info badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 p-3 sm:p-4 bg-slate-50 border-b border-slate-200/80 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Cajas en Stock</span>
                        <span className="text-sm font-black text-slate-900">{lot.total_boxes} cjs</span>
                        <span className="text-[10px] text-slate-500 block">Inicial: {lot.initial_boxes} cjs</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Existencia en Lbs</span>
                        <span className="text-sm font-black text-amber-700">{lot.stock_lbs.toLocaleString()} Lbs</span>
                        <span className="text-[10px] text-slate-500 block">Recibido: {lot.weight_lbs.toLocaleString()} Lbs</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Ubicación Bodega</span>
                        <span className="text-sm font-bold text-slate-800 flex items-center gap-1">
                            <MapPin size={13} className="text-slate-400" />
                            {lot.storage_location || 'Principal'}
                        </span>
                        <span className="text-[10px] text-slate-500 block">Temp: {lot.temperature_c ?? 'N/A'} °C</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Recepción / Venc.</span>
                        <span className="text-xs font-semibold text-slate-800">
                            {formatDate(lot.reception_date)}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                            Vence: {lot.expiration_date ? formatDate(lot.expiration_date) : 'N/A'}
                        </span>
                    </div>
                </div>

                {/* Content: Tarimas Table */}
                <div className="p-3 sm:p-5 overflow-y-auto flex-1">
                    {tarimas.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                            <Layers size={36} className="text-slate-300" />
                            <p className="text-sm font-semibold text-slate-600">No hay tarimas desglosadas en este lote.</p>
                            <p className="text-xs text-slate-400">El lote fue ingresado con pesaje global consolidado.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full min-w-[620px] text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                        <th className="p-3"># Tarima</th>
                                        <th className="p-3 text-center">Cajas</th>
                                        <th className="p-3 text-right">Peso Bruto (Lbs)</th>
                                        <th className="p-3 text-right">Tara Total (Lbs)</th>
                                        <th className="p-3 text-right">Peso Neto (Lbs)</th>
                                        <th className="p-3 text-right">Equivalente (Kg)</th>
                                        <th className="p-3 text-center">Ubicación</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                    {(Array.isArray(tarimas) ? tarimas : []).map((t, idx) => {
                                        const netLbs = parseFloat(t.net_weight_lbs || 0);
                                        const grossLbs = parseFloat(t.gross_weight_lbs || 0);
                                        const tareLbs = parseFloat(t.tare_weight_lbs || 0);
                                        const netKg = Math.round(netLbs * 0.453592 * 100) / 100;

                                        return (
                                            <tr key={t.id || idx} className="hover:bg-amber-50/40 transition-colors">
                                                <td className="p-3">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg font-bold text-xs">
                                                        <Layers size={13} />
                                                        Tarima #{t.tarima_number || idx + 1}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center font-bold text-slate-800">
                                                    {t.boxes_count || 0} cjs
                                                </td>
                                                <td className="p-3 text-right text-slate-600">
                                                    {grossLbs > 0 ? grossLbs.toLocaleString() : '-'}
                                                </td>
                                                <td className="p-3 text-right text-slate-400">
                                                    {tareLbs > 0 ? tareLbs.toLocaleString() : '-'}
                                                </td>
                                                <td className="p-3 text-right font-black text-amber-700">
                                                    {netLbs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lbs
                                                </td>
                                                <td className="p-3 text-right font-semibold text-slate-700">
                                                    {netKg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Kg
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                                                        {t.storage_location || lot.storage_location || 'Estándar'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-200 text-xs">
                                        <td className="p-3">Total {tarimas.length} Tarimas</td>
                                        <td className="p-3 text-center">{totalTarimaBoxes} cjs</td>
                                        <td className="p-3 text-right">{totalTarimaGrossLbs.toLocaleString()} Lbs</td>
                                        <td className="p-3 text-right text-slate-500">
                                            {(totalTarimaGrossLbs - totalTarimaNetLbs).toLocaleString()} Lbs
                                        </td>
                                        <td className="p-3 text-right text-amber-800 font-black text-sm">
                                            {totalTarimaNetLbs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lbs
                                        </td>
                                        <td className="p-3 text-right font-bold text-slate-700">
                                            {(Math.round(totalTarimaNetLbs * 0.453592 * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Kg
                                        </td>
                                        <td className="p-3"></td>
                                    </tr>
                                </tfoot>
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
