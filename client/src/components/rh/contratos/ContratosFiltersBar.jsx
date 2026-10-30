import { Search, X } from 'lucide-react';
import { ESTADOS_CONTRATO } from './contratoConstants';

const labelCls = "block text-[11px] font-bold text-slate-500 uppercase mb-1";

const ContratosFiltersBar = ({
    searchTerm,
    onSearchChange,
    filterEstado,
    onEstadoChange,
    filterDesde,
    onDesdeChange,
    filterHasta,
    onHastaChange,
    onClear
}) => {
    const hasFilters = Boolean(searchTerm || filterEstado || filterDesde || filterHasta);

    return (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[220px]">
                <label className={labelCls}>Buscar</label>
                <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Buscar por código, nombre del trabajador, DUI, cargo o lugar..."
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
            </div>

            <div>
                <label className={labelCls}>Estado</label>
                <select
                    value={filterEstado}
                    onChange={(e) => onEstadoChange(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                    <option value="">Todos los estados</option>
                    {ESTADOS_CONTRATO.map((o) => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                </select>
            </div>

            <div>
                <label className={labelCls}>Creación Desde</label>
                <input
                    type="date"
                    value={filterDesde}
                    onChange={(e) => onDesdeChange(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
            </div>

            <div>
                <label className={labelCls}>Creación Hasta</label>
                <input
                    type="date"
                    value={filterHasta}
                    onChange={(e) => onHastaChange(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
            </div>

            {hasFilters && (
                <button
                    type="button"
                    onClick={onClear}
                    className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1"
                >
                    <X size={13} /> Limpiar
                </button>
            )}
        </div>
    );
};

export default ContratosFiltersBar;

