import { useState } from 'react';
import { Users, Search, CheckSquare, Square, Layers, Info } from 'lucide-react';

const SEPARATION_PRESETS = [
    { value: 4000, label: '4,000 Lbs (~111 cajas)' },
    { value: 5000, label: '5,000 Lbs (~138 cajas)' },
    { value: 6000, label: '6,000 Lbs (Recomendado)', recommended: true },
    { value: 8000, label: '8,000 Lbs (~221 cajas)' },
    { value: 12000, label: '12,000 Lbs (Lote Grande)' }
];

export default function EggSuggestionsClientsPanel({
    availableCustomers = [],
    selectedCustomerIds = [],
    onToggleCustomer,
    onSelectAllCustomers,
    onDeselectAllCustomers,
    separationBatchLbs = 6000,
    onSeparationBatchChange
}) {
    const [clientSearch, setClientSearch] = useState('');

    const effectiveSelectedIds = selectedCustomerIds !== null
        ? selectedCustomerIds
        : availableCustomers.map(c => c.id);

    const filteredList = availableCustomers.filter(c => {
        const query = clientSearch.toLowerCase();
        return (c.customer_name || '').toLowerCase().includes(query) || String(c.id).includes(query);
    });

    const activeCount = effectiveSelectedIds.length;
    const totalCount = availableCustomers.length;

    return (
        <div className="p-3.5 bg-white rounded-2xl border border-indigo-200/80 shadow-xs space-y-4 animate-in fade-in duration-200">
            {/* Sección 1: Configuración de Lote de Separación */}
            <div className="space-y-2 border-b border-slate-100 pb-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                        <span className="p-1 rounded-lg bg-teal-100 text-teal-800">
                            <Layers className="w-3.5 h-3.5" />
                        </span>
                        <div>
                            <h5 className="text-xs font-bold text-slate-800">
                                Tamaño de Lote para Separación de Clara / Yema
                            </h5>
                            <p className="text-[10px] text-slate-500 font-medium">
                                Limita el volumen por corrida de separación para evitar saturar la maquinaria y desbordar tanques fríos.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Personalizado:</span>
                        <input
                            type="number"
                            step="500"
                            min="2000"
                            max="15000"
                            value={separationBatchLbs}
                            onChange={(e) => onSeparationBatchChange(Math.max(1000, parseFloat(e.target.value) || 6000))}
                            className="w-20 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs font-bold text-slate-800 text-right outline-none focus:ring-1 focus:ring-teal-500"
                        />
                        <span className="text-[10px] font-bold text-slate-500">Lbs</span>
                    </div>
                </div>

                {/* Botones Presets de Lote */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {SEPARATION_PRESETS.map((p) => {
                        const isSelected = separationBatchLbs === p.value;
                        return (
                            <button
                                key={p.value}
                                type="button"
                                onClick={() => onSeparationBatchChange(p.value)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                                    isSelected
                                        ? 'bg-teal-600 text-white shadow-xs'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                            >
                                <span>{p.label}</span>
                                {p.recommended && (
                                    <span className={`text-[9px] font-black px-1 rounded ${
                                        isSelected ? 'bg-teal-800 text-teal-100' : 'bg-teal-100 text-teal-800'
                                    }`}>
                                        ⭐
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="p-2 rounded-xl bg-teal-50/70 border border-teal-200/80 flex items-start gap-2 text-[11px] text-teal-900 leading-snug">
                    <Info className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
                    <span>
                        <strong>Recomendación operativa:</strong> Lotes de <strong>4,000 a 6,000 Lbs</strong> (~110-166 cajas) permiten que la centrífuga opere a régimen térmico seguro y generan el volumen ideal de yema coproducto para formular sin saturar el cuarto frío.
                    </span>
                </div>
            </div>

            {/* Sección 2: Clientes Contemplados */}
            <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="p-1 rounded-lg bg-indigo-100 text-indigo-800">
                            <Users className="w-3.5 h-3.5" />
                        </span>
                        <div>
                            <h5 className="text-xs font-bold text-slate-800">
                                Clientes Contemplados en la Demanda
                            </h5>
                            <p className="text-[10px] text-slate-500 font-medium">
                                Activa o desactiva clientes para afinar la proyección y programar lotes exactos.
                            </p>
                        </div>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 ml-1">
                            {activeCount} de {totalCount} activos
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onSelectAllCustomers}
                            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors"
                        >
                            <CheckSquare className="w-3 h-3 text-indigo-600" />
                            <span>Seleccionar Todos</span>
                        </button>
                        <button
                            type="button"
                            onClick={onDeselectAllCustomers}
                            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors"
                        >
                            <Square className="w-3 h-3 text-slate-500" />
                            <span>Deseleccionar Todos</span>
                        </button>
                    </div>
                </div>

                {/* Barra de búsqueda de clientes */}
                <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                        type="text"
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        placeholder="Buscar cliente por nombre o código..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition"
                    />
                </div>

                {/* Grid / Lista de Clientes */}
                {availableCustomers.length === 0 ? (
                    <div className="py-4 text-center text-slate-400 text-xs italic">
                        No hay clientes con pedidos o acuerdos comerciales registrados en el período.
                    </div>
                ) : filteredList.length === 0 ? (
                    <div className="py-4 text-center text-slate-400 text-xs italic">
                        No se encontraron clientes que coincidan con la búsqueda.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                        {filteredList.map((client) => {
                            const isChecked = effectiveSelectedIds.includes(client.id);
                            return (
                                <div
                                    key={client.id}
                                    onClick={() => onToggleCustomer(client.id)}
                                    className={`p-2.5 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-2.5 ${
                                        isChecked
                                            ? 'bg-indigo-50/50 border-indigo-300 shadow-2xs hover:bg-indigo-50'
                                            : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/80 opacity-60'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}} // Manejado por onClick del contenedor
                                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer pointer-events-none"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-slate-900 truncate" title={client.customer_name}>
                                            {client.customer_name}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[10px] text-slate-600">
                                            {client.orders_count > 0 && (
                                                <span>
                                                    📦 {client.orders_count} ped. ({Math.round(client.orders_volume_lbs).toLocaleString()} Lbs)
                                                </span>
                                            )}
                                            {client.agreements_count > 0 && (
                                                <span className="text-indigo-700 font-medium">
                                                    📋 {Math.round(client.agreements_volume_lbs).toLocaleString()} Lbs/mes
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[10px] font-black text-slate-800 mt-1">
                                            Total Demanda: {Math.round(client.total_demand_lbs).toLocaleString()} Lbs
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
