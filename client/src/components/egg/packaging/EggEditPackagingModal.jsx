import { Pencil } from 'lucide-react';

const EggEditPackagingModal = ({
    isOpen,
    onClose,
    packaging,
    packagingForm,
    setPackagingForm,
    onSubmit,
    isSubmitting
}) => {
    if (!isOpen || !packaging) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-4 text-slate-900">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Pencil className="h-4 w-4 text-indigo-600" />
                    Editar Empaque
                </h3>
                <div className="h-px bg-slate-100" />
                <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Lote</label>
                        <input
                            type="text"
                            value={packaging.lot_code}
                            disabled
                            className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 font-bold"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Unidades</label>
                            <input
                                type="number"
                                value={packagingForm.units_packaged}
                                onChange={(e) => setPackagingForm({ ...packagingForm, units_packaged: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Peso/Unidad (Lbs)</label>
                            <input
                                type="number"
                                value={packagingForm.weight_per_unit_lbs}
                                onChange={(e) => setPackagingForm({ ...packagingForm, weight_per_unit_lbs: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                step="0.01"
                            />
                        </div>
                    </div>
                    {packagingForm.units_packaged && packagingForm.weight_per_unit_lbs && (
                        <div className="bg-teal-50 border border-teal-200 rounded-xl p-2.5 text-center">
                            <span className="text-[10px] font-bold text-teal-700 uppercase block">Total</span>
                            <span className="text-sm font-bold text-teal-800">
                                {(parseFloat(packagingForm.units_packaged || 0) * parseFloat(packagingForm.weight_per_unit_lbs || 0)).toFixed(2)} Lbs
                            </span>
                        </div>
                    )}
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-40"
                        >
                            Guardar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EggEditPackagingModal;
