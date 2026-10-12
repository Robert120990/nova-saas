import { useState, useEffect, useMemo } from 'react';
import { X, Fuel, Save, Info } from 'lucide-react';
import Money, { MoneyInput } from '../../ui/Money';

const CloseoutCostsModal = ({ open, onClose, fuels = [], onSave, isSaving = false }) => {
    const [localFuels, setLocalFuels] = useState([]);

    useEffect(() => {
        if (open) {
            setLocalFuels(fuels.map(f => ({ ...f, costo_unitario: f.costo_unitario || 0 })));
        }
    }, [open, fuels]);

    const updateCost = (fuelKey, val) => {
        const num = parseFloat(val) || 0;
        setLocalFuels(prev => prev.map(f => {
            const match = f.key ? f.key === fuelKey : f.product_id === fuelKey;
            if (match) {
                const subtotal = Math.round((f.galones * num) * 100) / 100;
                return { ...f, costo_unitario: num, subtotal };
            }
            return f;
        }));
    };

    const hasTrupput = useMemo(() => localFuels.some(f => (parseFloat(f.galones_trupput) || 0) > 0), [localFuels]);
    const totalTrupputGalones = useMemo(() => localFuels.reduce((s, f) => s + (parseFloat(f.galones_trupput) || 0), 0), [localFuels]);

    const totalCosto = useMemo(() => {
        return localFuels.reduce((sum, f) => sum + (parseFloat(f.subtotal) || 0), 0);
    }, [localFuels]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`bg-white rounded-3xl shadow-2xl border border-slate-200 w-full ${hasTrupput ? 'max-w-3xl' : 'max-w-2xl'} overflow-hidden flex flex-col max-h-[90vh]`}>
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-indigo-50/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-200">
                            <Fuel size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-slate-800">Costos de Combustible del Día</h2>
                            <p className="text-xs font-medium text-slate-400">Verifica o ingresa el costo por galón para asentar la partida</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body Table */}
                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                    <div className="text-xs bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 flex items-start gap-2">
                        <span className="font-bold">Nota:</span>
                        <span>Estos costos se aplicarán a las líneas de <b>Costo de Mercadería</b> e <b>Inventario de Combustibles</b>, y quedarán registrados en el historial de costos para futuras consultas. Los lubricantes toman su costo directamente del catálogo.</span>
                    </div>

                    {hasTrupput && (
                        <div className="text-xs bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-indigo-900 flex items-start gap-2.5">
                            <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                            <div>
                                <span className="font-bold">Despachos Trupput detectados: </span>
                                <span>
                                    Se identificaron <b>{Number(totalTrupputGalones).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} galones</b> despachados bajo modalidad Trupput. Este galonaje fue descontado de los medidores de bomba ya que corresponde a un tercero y no constituye venta propia ni salida de inventario de la estación. El costo se calculará exclusivamente sobre los <b>galones netos</b>.
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3">Combustible</th>
                                    {hasTrupput ? (
                                        <>
                                            <th className="px-3 py-3 text-right">Gal. Bomba</th>
                                            <th className="px-3 py-3 text-right">Trupput (-)</th>
                                            <th className="px-3 py-3 text-right">Gal. Netos</th>
                                        </>
                                    ) : (
                                        <th className="px-3 py-3 text-right">Galones</th>
                                    )}
                                    <th className="px-3 py-3 text-right w-32">Costo / Galón ($)</th>
                                    <th className="px-4 py-3 text-right">Subtotal Costo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(Array.isArray(localFuels) ? localFuels : []).map(f => (
                                    <tr key={f.key || f.product_id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className="font-bold text-slate-800 block text-xs">{f.nombre}</span>
                                        </td>
                                        {hasTrupput ? (
                                            <>
                                                <td className="px-3 py-3 text-right font-mono font-medium text-slate-600">
                                                    {Number(f.galones_bomba != null ? f.galones_bomba : f.galones || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono">
                                                    {f.galones_trupput > 0 ? (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[11px]">
                                                            - {Number(f.galones_trupput).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300">-</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono font-bold text-indigo-700">
                                                    {Number(f.galones || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                                                </td>
                                            </>
                                        ) : (
                                            <td className="px-3 py-3 text-right font-mono font-bold text-slate-600">
                                                {Number(f.galones || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                                            </td>
                                        )}
                                        <td className="px-3 py-3 text-right">
                                            <MoneyInput
                                                value={f.costo_unitario}
                                                onChange={e => updateCost(f.key || f.product_id, e.target.value)}
                                                className="w-full text-right font-mono font-bold text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                                            <Money value={f.subtotal} />
                                        </td>
                                    </tr>
                                ))}
                                {localFuels.length === 0 && (
                                    <tr>
                                        <td colSpan={hasTrupput ? 6 : 4} className="px-4 py-6 text-center text-slate-400 font-medium">
                                            No se encontraron ventas de combustible en este turno.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t border-slate-200 font-black text-xs text-slate-800">
                                <tr>
                                    <td colSpan={hasTrupput ? 5 : 3} className="px-4 py-3 text-right uppercase text-[10px] text-slate-500">Total Costo Combustibles</td>
                                    <td className="px-4 py-3 text-right font-mono text-indigo-700">
                                        <Money value={totalCosto} />
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={() => onSave(localFuels)}
                        disabled={isSaving || localFuels.length === 0}
                        className="px-6 py-2.5 rounded-xl font-black uppercase text-xs text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-md shadow-indigo-100 active:scale-95 cursor-pointer"
                    >
                        {isSaving ? (
                            <>Guardando...</>
                        ) : (
                            <>
                                <Save size={15} /> Aplicar y Guardar Costos
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CloseoutCostsModal;
