import {
    Calculator,
    Save,
    RefreshCcw,
    Sparkles
} from 'lucide-react';




export default function CosteoPorLibraHeader({ model }) {
    const { calcParams, calculating, setSaveScenarioModal, runCalculation } = model;

    return (<div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4">
                <div>
                    <div className="flex items-center gap-1.5 sm:gap-2 text-indigo-600 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider mb-1">
                        <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span>Planta Industrial ANDELSA • Ovoproductos</span>
                    </div>
                    <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight leading-snug flex items-center gap-2 sm:gap-3">
                        <Calculator className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 shrink-0" />
                        <span>Costeo por Libra & Simulador</span>
                    </h1>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Cálculo del costo actual según entradas, producción y ventas, más simulador comercial.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
                    <button
                        onClick={() => runCalculation(calcParams, true)}
                        disabled={calculating}
                        className="w-full sm:w-auto justify-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
                    >
                        <RefreshCcw className={`w-3.5 h-3.5 ${calculating ? 'animate-spin' : ''}`} />
                        <span>Recalcular</span>
                    </button>
                    <button
                        onClick={() => setSaveScenarioModal(true)}
                        className="w-full sm:w-auto justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all"
                    >
                        <Save className="w-3.5 h-3.5" />
                        <span>Guardar Escenario</span>
                    </button>
                </div>
            </div>);
}
