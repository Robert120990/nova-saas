import { X } from 'lucide-react';

export default function EggCipModal({
    open,
    data,
    productsLookup = [],
    onClose,
    onSave,
    setCipModal,
    onSelectProduct
}) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <form onSubmit={onSave} className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h3 className="text-base font-bold text-slate-900 uppercase">
                        {data?.id ? 'Editar Químico CIP' : 'Nuevo Químico de Lavado CIP'}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                            Vincular con Producto del Inventario / Compras
                        </label>
                        <select
                            value={data?.product_id || ''}
                            onChange={(e) => onSelectProduct(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-cyan-500/20 shadow-sm"
                        >
                            <option value="">-- Sin Vincular / Ingreso Manual --</option>
                            {productsLookup.map(prod => (
                                <option key={prod.id} value={prod.id}>
                                    [{prod.codigo}] {prod.nombre} {prod.latest_purchase_cost ? `(Fac #${prod.latest_invoice_number}: ${parseFloat(prod.latest_purchase_cost).toFixed(2)})` : `(Costo: ${parseFloat(prod.costo || 0).toFixed(2)})`}
                                </option>
                            ))}
                        </select>
                        {data?.product_id && (
                            <div className="mt-1.5 p-2 rounded-lg bg-cyan-50 border border-cyan-200 text-[11px] text-cyan-950">
                                {(() => {
                                    const prod = productsLookup.find(p => p.id === parseInt(data?.product_id));
                                    if (!prod) return null;
                                    return prod.latest_invoice_number ? (
                                        <div>
                                            <span className="font-bold">Factura de Compra Reciente:</span> #{prod.latest_invoice_number} ({prod.latest_purchase_date ? new Date(prod.latest_purchase_date).toLocaleDateString() : 'S/F'}) a <strong className="text-emerald-700 font-bold">${parseFloat(prod.latest_purchase_cost).toFixed(2)}</strong> / ud {prod.latest_provider_name ? `(${prod.latest_provider_name})` : ''}
                                        </div>
                                    ) : (
                                        <span className="text-slate-600 italic">Producto sin facturas ingresadas aún (Costo catálogo: ${parseFloat(prod.costo || 0).toFixed(2)})</span>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Nombre del Químico</label>
                        <input
                            type="text"
                            required
                            placeholder="Ej: Soda Cáustica / Ácido Nítrico"
                            value={data?.item_name || ''}
                            onChange={(e) => setCipModal(prev => ({ ...prev, data: { ...prev.data, item_name: e.target.value } }))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Cant. Presentación</label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                placeholder="250"
                                value={data?.presentation_qty || ''}
                                onChange={(e) => setCipModal(prev => ({ ...prev, data: { ...prev.data, presentation_qty: parseFloat(e.target.value) || 0 } }))}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Unidad Presentación</label>
                            <input
                                type="text"
                                placeholder="kg, gal, L"
                                value={data?.presentation_unit || 'kg'}
                                onChange={(e) => setCipModal(prev => ({ ...prev, data: { ...prev.data, presentation_unit: e.target.value } }))}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Costo Presentación ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                placeholder="262.50"
                                value={data?.presentation_cost || ''}
                                onChange={(e) => setCipModal(prev => ({ ...prev, data: { ...prev.data, presentation_cost: parseFloat(e.target.value) || 0 } }))}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Dosis por Batch</label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                placeholder="15"
                                value={data?.dose_per_batch || ''}
                                onChange={(e) => setCipModal(prev => ({ ...prev, data: { ...prev.data, dose_per_batch: parseFloat(e.target.value) || 0 } }))}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20"
                    >
                        Guardar Químico
                    </button>
                </div>
            </form>
        </div>
    );
}
