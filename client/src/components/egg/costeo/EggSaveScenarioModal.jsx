import { X } from 'lucide-react';

export default function EggSaveScenarioModal({
    open,
    scenarioName,
    setScenarioName,
    onClose,
    onSave
}) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h3 className="text-base font-bold text-slate-900 uppercase">Guardar Escenario de Costeo</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">
                        Nombre del Escenario
                    </label>
                    <input
                        type="text"
                        placeholder="Ej: Costeo Base Septiembre 2026 - HE Plus"
                        value={scenarioName}
                        onChange={(e) => setScenarioName(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                    />
                </div>
                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
                    >
                        Confirmar Guardado
                    </button>
                </div>
            </div>
        </div>
    );
}
