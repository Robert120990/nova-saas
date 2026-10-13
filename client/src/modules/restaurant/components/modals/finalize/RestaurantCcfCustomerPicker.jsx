import { User, Search } from 'lucide-react';

export default function RestaurantCcfCustomerPicker({
    selectedCustomer,
    onSelectCustomer,
    customerSearch,
    onSearchChange,
    customers = []
}) {
    return (
        <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                    <User size={14} /> Seleccionar Cliente Contribuyente
                </span>
                {selectedCustomer && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                        NRC: {selectedCustomer.nrc || 'N/A'}
                    </span>
                )}
            </div>
            <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Buscar cliente por nombre, NRC o NIT..."
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1">
                {customers.length === 0 ? (
                    <div className="text-center py-2 text-[11px] text-slate-400">No se encontraron clientes</div>
                ) : (
                    customers.map(c => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => onSelectCustomer(c)}
                            className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                                selectedCustomer?.id === c.id
                                    ? 'bg-indigo-600 text-white font-bold'
                                    : 'hover:bg-indigo-100/50 text-slate-700'
                            }`}
                        >
                            <span className="truncate">{c.nombre}</span>
                            <span className="text-[10px] opacity-80 shrink-0 font-mono">NRC: {c.nrc || 'S/N'}</span>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
