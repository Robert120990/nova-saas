import {
    TrendingUp,
    Award,
    Target
} from 'lucide-react';
import EggCommissionsSimulator from '../../EggCommissionsSimulator';
import EggSellerGoalsManager from '../../EggSellerGoalsManager';




export default function CosteoPorLibraCommissionsTab({ model }) {
    const { activeTab, commissionsSubTab, setCommissionsSubTab } = model;

    return (<>{activeTab === 'commissions' && (
                <div className="space-y-6">
                    {/* Sub-navegación interna */}
                    <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
                                <Award className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">
                                    Metas Comerciales, Comisiones y Planilla
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Control de vendedores por empleado, metas de volumen y tope reglamentario de $1,000
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto whitespace-nowrap scrollbar-none w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={() => setCommissionsSubTab('manager')}
                                className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                    commissionsSubTab === 'manager'
                                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Target className="w-3.5 h-3.5" />
                                <span>Gestión & Planilla</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setCommissionsSubTab('simulator')}
                                className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                    commissionsSubTab === 'simulator'
                                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <TrendingUp className="w-3.5 h-3.5" />
                                <span>Simulador & Sensibilidad ($1K)</span>
                            </button>
                        </div>
                    </div>

                    {/* Sub-vista activa */}
                    {commissionsSubTab === 'manager' ? (
                        <EggSellerGoalsManager />
                    ) : (
                        <EggCommissionsSimulator />
                    )}
                </div>
            )}</>);
}
