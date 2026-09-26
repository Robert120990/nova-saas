import { X } from 'lucide-react';

export default function EggPlantConfigModal({
    open,
    data,
    onClose,
    onSave,
    setConfigModal
}) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <form onSubmit={onSave} className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h3 className="text-base font-bold text-slate-900 uppercase">
                        Parámetros de Caldera, Vapor y GIF de Planta
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Diesel Gal / Batch</label>
                        <input
                            type="number"
                            step="0.01"
                            value={data?.boiler_diesel_gal_batch || 20.84}
                            onChange={(e) => setConfigModal(prev => ({ ...prev, data: { ...prev.data, boiler_diesel_gal_batch: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Precio Diesel ($/Gal)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={data?.boiler_diesel_price_gal || 4.14}
                            onChange={(e) => setConfigModal(prev => ({ ...prev, data: { ...prev.data, boiler_diesel_price_gal: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Electricidad ($/Batch)</label>
                        <input
                            type="number"
                            step="1"
                            value={data?.boiler_kwh_cost_batch || 386}
                            onChange={(e) => setConfigModal(prev => ({ ...prev, data: { ...prev.data, boiler_kwh_cost_batch: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Agua Caldera ($/Batch)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={data?.boiler_water_cost_batch || 17.34}
                            onChange={(e) => setConfigModal(prev => ({ ...prev, data: { ...prev.data, boiler_water_cost_batch: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Mano de Obra MOD ($/Lb)</label>
                        <input
                            type="number"
                            step="0.001"
                            value={data?.mod_cost_per_lb || 0.05}
                            onChange={(e) => setConfigModal(prev => ({ ...prev, data: { ...prev.data, mod_cost_per_lb: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">GIF Mensual Total ($)</label>
                        <input
                            type="number"
                            step="1"
                            value={data?.monthly_gif_total || 24537}
                            onChange={(e) => setConfigModal(prev => ({ ...prev, data: { ...prev.data, monthly_gif_total: parseFloat(e.target.value) || 0 } }))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800"
                        />
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
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20"
                    >
                        Guardar Parámetros
                    </button>
                </div>
            </form>
        </div>
    );
}
