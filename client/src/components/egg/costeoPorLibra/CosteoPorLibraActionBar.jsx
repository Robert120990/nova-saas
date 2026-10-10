import {
    Calculator,
    TrendingUp,
    Users,
    Settings2,
    History,
    Award
} from 'lucide-react';




export default function CosteoPorLibraActionBar({ model }) {
    const { activeTab, setActiveTab, agreements, scenarios } = model;

    return (<div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200 flex overflow-x-auto whitespace-nowrap scrollbar-none gap-1.5 max-w-full w-full sm:w-auto">
                {(Array.isArray([
                    { id: 'calculator', label: 'Calculadora de Costeo', icon: Calculator },
                    { id: 'simulator', label: 'Simulador de Margen Libre', icon: TrendingUp },
                    { id: 'commissions', label: 'Metas & Comisiones ($1K)', icon: Award },
                    { id: 'clients', label: 'Acuerdos con Clientes', icon: Users, badge: agreements.length },
                    { id: 'catalog', label: 'Insumos, Empaques y CIP', icon: Settings2 },
                    { id: 'history', label: 'Escenarios Guardados', icon: History, badge: scenarios.length }
                ]) ? [
                    { id: 'calculator', label: 'Calculadora de Costeo', icon: Calculator },
                    { id: 'simulator', label: 'Simulador de Margen Libre', icon: TrendingUp },
                    { id: 'commissions', label: 'Metas & Comisiones ($1K)', icon: Award },
                    { id: 'clients', label: 'Acuerdos con Clientes', icon: Users, badge: agreements.length },
                    { id: 'catalog', label: 'Insumos, Empaques y CIP', icon: Settings2 },
                    { id: 'history', label: 'Escenarios Guardados', icon: History, badge: scenarios.length }
                ] : []).map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`shrink-0 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${isActive
                                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            <span>{tab.label}</span>
                            {tab.badge !== undefined && (
                                <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-black ${isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-700'
                                    }`}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>);
}
