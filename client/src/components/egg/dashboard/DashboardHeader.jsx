import {
    RefreshCw,
    Cpu,
    Calendar
} from 'lucide-react';


export default function DashboardHeader({ model }) {
    const { navigate, socketConnected, handleResetSimulation } = model;

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
            <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-600 shrink-0">
                    <Cpu className="h-6 w-6 sm:h-7 sm:w-7" />
                </div>
                <div>
                    <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">Monitoreo de Planta y Pasteurización</h1>
                    <p className="text-xs text-slate-500 font-medium">Control en tiempo real de temperaturas de holding, pasteurizador y cadena de frío (HACCP)</p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <div className="flex items-center justify-center gap-2 px-3.5 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                    <span className="text-slate-700">Telemetría: {socketConnected ? 'En Línea' : 'Desconectada'}</span>
                </div>
                <button
                    onClick={() => navigate('/industrial/calendario')}
                    className="w-full sm:w-auto px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                >
                    <Calendar size={14} />
                    Calendario de Producción
                </button>
                <button
                    onClick={handleResetSimulation}
                    className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                >
                    <RefreshCw size={14} />
                    Restablecer Lecturas
                </button>
            </div>
        </div>
    );
}
