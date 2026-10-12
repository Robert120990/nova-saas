import { useState } from 'react';
import { LayoutGrid, UtensilsCrossed, Sliders, Settings } from 'lucide-react';
import RestaurantTablesTab from '../components/tabs/RestaurantTablesTab';
import RestaurantStationsTab from '../components/tabs/RestaurantStationsTab';
import RestaurantModifiersTab from '../components/tabs/RestaurantModifiersTab';
import RestaurantSettingsTab from '../components/tabs/RestaurantSettingsTab';

export default function RestaurantConfig() {
    const [activeTab, setActiveTab] = useState('tables');

    const tabs = [
        { id: 'tables', label: 'Mesas y Áreas', icon: LayoutGrid, component: RestaurantTablesTab },
        { id: 'stations', label: 'Estaciones de Cocina', icon: UtensilsCrossed, component: RestaurantStationsTab },
        { id: 'modifiers', label: 'Modificadores y Términos', icon: Sliders, component: RestaurantModifiersTab },
        { id: 'settings', label: 'Parámetros y Propinas', icon: Settings, component: RestaurantSettingsTab }
    ];

    const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || RestaurantTablesTab;

    return (
        <div className="space-y-6">
            {/* Header del Módulo */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
                <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">
                        Configuración de Restaurante
                    </h1>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Administra mesas, áreas, estaciones de cocina, modificadores y reglas de propina sugerida.
                    </p>
                </div>
            </div>

            {/* Selector de Pestañas */}
            <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                                isActive
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                            }`}
                        >
                            <Icon size={15} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Contenido de la Pestaña Activa */}
            <ActiveComponent />
        </div>
    );
}
