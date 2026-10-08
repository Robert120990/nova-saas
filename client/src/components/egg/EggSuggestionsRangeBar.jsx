import { Calendar, RefreshCw, Users, ChevronDown, ChevronUp } from 'lucide-react';

export const EggSuggestionsRangeBar = ({
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    preventPast,
    setPreventPast,
    onCalculate,
    loading,
    availableCustomersCount = 0,
    activeCustomersCount = 0,
    separationBatchLbs = 6000,
    isConfigOpen = false,
    onToggleConfig
}) => {
    return (
        <div className="bg-gradient-to-r from-slate-50 to-indigo-50/40 p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                        <Calendar className="w-4 h-4" />
                    </span>
                    <div>
                        <h4 className="text-xs font-bold text-slate-800">
                            Rango de Fechas & Configuración de Proyección IA
                        </h4>
                        <p className="text-[10px] text-slate-500 font-medium">
                            Define el horizonte de fechas, activa los clientes a contemplar y calibra el lote de separación.
                        </p>
                    </div>
                </div>

                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer select-none bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs hover:bg-slate-50 transition">
                    <input
                        type="checkbox"
                        checked={preventPast}
                        onChange={(e) => setPreventPast(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span>Evitar Fechas Pasadas</span>
                </label>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Desde:</span>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
                    />
                </div>

                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Hasta:</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
                    />
                </div>

                {onToggleConfig && (
                    <button
                        type="button"
                        onClick={onToggleConfig}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border shadow-2xs ${
                            isConfigOpen
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
                        }`}
                        title="Configurar clientes contemplados y lote de separación"
                    >
                        <Users className="w-3.5 h-3.5" />
                        <span>
                            Clientes: {activeCustomersCount} de {availableCustomersCount}
                        </span>
                        <span className="text-[10px] opacity-75 font-normal">|</span>
                        <span className="text-[11px] font-semibold">
                            Separación: {separationBatchLbs.toLocaleString()} Lb
                        </span>
                        {isConfigOpen ? (
                            <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
                        ) : (
                            <ChevronDown className="w-3.5 h-3.5 ml-0.5 text-indigo-500" />
                        )}
                    </button>
                )}

                <button
                    type="button"
                    onClick={onCalculate}
                    disabled={loading}
                    className="ml-auto px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-indigo-200 transition-all disabled:opacity-50"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>{loading ? 'Calculando...' : 'Generar Sugerencias'}</span>
                </button>
            </div>
        </div>
    );
};

export default EggSuggestionsRangeBar;
