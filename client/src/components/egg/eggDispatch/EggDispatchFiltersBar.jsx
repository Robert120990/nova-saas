import {
    Calendar as CalendarIcon,
    Navigation,
    Phone,
    Wrench
} from 'lucide-react';


export default function EggDispatchFiltersBar({ model }) {
    const { activeTab, setActiveTab, orders, routes, vehicles } = model;

    return (<div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto whitespace-nowrap scrollbar-none">
                <button
                    onClick={() => setActiveTab('calendario')}
                    className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-bold text-xs shrink-0 transition ${
                        activeTab === 'calendario'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    <CalendarIcon className="w-4 h-4 shrink-0" />
                    <span>1. Calendario de Pedidos</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'calendario' ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-700'}`}>
                        {orders.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('rutas')}
                    className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-bold text-xs shrink-0 transition ${
                        activeTab === 'rutas'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    <Navigation className="w-4 h-4 shrink-0" />
                    <span>2. Planificador de Rutas & Mapa</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'rutas' ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-700'}`}>
                        {routes.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('flota')}
                    className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-bold text-xs shrink-0 transition ${
                        activeTab === 'flota'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    <Wrench className="w-4 h-4 shrink-0" />
                    <span>3. Flota y Mantenimiento</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'flota' ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-700'}`}>
                        {vehicles.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('motorista')}
                    className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-bold text-xs shrink-0 transition ${
                        activeTab === 'motorista'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>4. Modo Motorista (Móvil)</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full">
                        Entregas Hoy
                    </span>
                </button>
            </div>);
}
