import {
    DollarSign,
    Wrench,
    BarChart3,
    RotateCcw
} from 'lucide-react';


export default function CostsMaintenanceFiltersBar({ model }) {
    const { activeTab, setActiveTab } = model;

    return (<div className="bg-slate-100 p-1 sm:p-1.5 rounded-xl border border-slate-200 flex flex-wrap gap-1 sm:gap-1.5 w-full sm:w-fit">
                <button
                    onClick={() => setActiveTab('costs')}
                    className={`flex-1 sm:flex-initial justify-center px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 ${
                        activeTab === 'costs'
                            ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <DollarSign size={14} />
                    Costos por Lote
                </button>
                <button
                    onClick={() => setActiveTab('returnables')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                        activeTab === 'returnables'
                            ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <RotateCcw size={14} />
                    Envases Retornables (Cubetas)
                </button>
                <button
                    onClick={() => setActiveTab('maintenance')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                        activeTab === 'maintenance'
                            ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Wrench size={14} />
                    Mantenimiento de Equipos
                </button>
                <button
                    onClick={() => setActiveTab('forecasting')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                        activeTab === 'forecasting'
                            ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <BarChart3 size={14} />
                    Proyección de Demanda
                </button>
            </div>);
}
