import { useMemo, useState } from 'react';
import { Layers, Search, Box, Scale, MapPin, ShieldCheck, AlertTriangle } from 'lucide-react';
import { formatDate } from '../../../../utils/dateUtils';

export default function RawMaterialInventoryTab({ model }) {
    const {
        overviewData,
        searchTerm,
        setSearchTerm,
        unitOfMeasure,
        onOpenTarimasModal
    } = model;

    const [eggTypeFilter, setEggTypeFilter] = useState('todos');
    const [onlyWithStock, setOnlyWithStock] = useState(true);

    const rm = overviewData?.raw_materials || { summary: {}, lots: [] };
    const summary = rm.summary || {};
    const lots = Array.isArray(rm.lots) ? rm.lots : [];

    // Tipos de huevo únicos
    const availableEggTypes = useMemo(() => {
        const types = new Set();
        lots.forEach(l => { if (l.egg_type) types.add(l.egg_type); });
        return Array.from(types);
    }, [lots]);

    // Filtrar lotes de MP
    const filteredLots = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return lots.filter(l => {
            const matchesSearch = !term ||
                (l.provider_lot || '').toLowerCase().includes(term) ||
                (l.remission_note || '').toLowerCase().includes(term) ||
                (l.provider_name || '').toLowerCase().includes(term) ||
                (l.farm_name || '').toLowerCase().includes(term) ||
                (l.egg_type || '').toLowerCase().includes(term);

            const matchesType = eggTypeFilter === 'todos' || (l.egg_type || '').toLowerCase() === eggTypeFilter.toLowerCase();
            const matchesStock = !onlyWithStock || parseFloat(l.stock_lbs || 0) > 0;

            return matchesSearch && matchesType && matchesStock;
        });
    }, [lots, searchTerm, eggTypeFilter, onlyWithStock]);

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
                <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider truncate">Lotes Activos</span>
                        <Layers size={15} className="text-amber-600 shrink-0" />
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-slate-900">
                        {summary.active_lots || 0}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 block font-medium mt-0.5 truncate">
                        De {summary.total_lots || 0} recibidos
                    </span>
                </div>

                <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider truncate">Cajas en Stock</span>
                        <Box size={15} className="text-blue-600 shrink-0" />
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-blue-700">
                        {parseInt(summary.total_boxes || 0, 10).toLocaleString()}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 block font-medium mt-0.5 truncate">
                        Cajas disponibles
                    </span>
                </div>

                <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider truncate">Stock (Libras)</span>
                        <Scale size={15} className="text-emerald-600 shrink-0" />
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-emerald-600">
                        {parseFloat(summary.total_stock_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-emerald-700 font-bold block mt-0.5">
                        Lbs Netas
                    </span>
                </div>

                <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider truncate">Stock (Kilos)</span>
                        <Scale size={15} className="text-violet-600 shrink-0" />
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-violet-700">
                        {parseFloat(summary.total_stock_kg || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-violet-700 font-bold block mt-0.5">
                        Kg Netos
                    </span>
                </div>

                <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs col-span-2 lg:col-span-1">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider truncate">Tarimas en Bodega</span>
                        <Layers size={15} className="text-amber-600 shrink-0" />
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-amber-700">
                        {summary.total_tarimas || 0}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 block font-medium mt-0.5">
                        Tarimas físicas activas
                    </span>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                        type="text"
                        placeholder="Buscar por lote, proveedor, granja..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-between md:justify-end">
                    {availableEggTypes.length > 0 && (
                        <select
                            value={eggTypeFilter}
                            onChange={(e) => setEggTypeFilter(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        >
                            <option value="todos">Todos los Tipos ({availableEggTypes.length})</option>
                            {availableEggTypes.map(t => (
                                <option key={t} value={t}>{t.toUpperCase()}</option>
                            ))}
                        </select>
                    )}

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 select-none">
                        <input
                            type="checkbox"
                            checked={onlyWithStock}
                            onChange={(e) => setOnlyWithStock(e.target.checked)}
                            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span>Solo con Stock Disponible</span>
                    </label>
                </div>
            </div>

            {/* Raw Material Lots Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Layers size={17} className="text-amber-600" />
                        Lotes de Materia Prima en Bodega ({filteredLots.length})
                    </h3>
                </div>

                {filteredLots.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 font-medium text-xs flex flex-col items-center gap-2">
                        <Layers size={32} className="text-slate-300" />
                        No se encontraron lotes de materia prima que coincidan con los filtros.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                    <th className="p-3.5">Lote Proveedor / Granja</th>
                                    <th className="p-3.5">Proveedor</th>
                                    <th className="p-3.5">Tipo de Huevo</th>
                                    <th className="p-3.5 text-center">Cajas (Stock / Recib.)</th>
                                    <th className="p-3.5 text-right">
                                        {unitOfMeasure === 'kg' ? 'Stock Actual (Kg)' : unitOfMeasure === 'units' ? 'Cajas Disponibles' : 'Stock Actual (Lbs)'}
                                    </th>
                                    <th className="p-3.5 text-center">Ubicación Bodega</th>
                                    <th className="p-3.5 text-center">Calidad</th>
                                    <th className="p-3.5 text-center">Fecha Recepción</th>
                                    <th className="p-3.5 text-center">Tarimas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                                {(Array.isArray(filteredLots) ? filteredLots : []).map((lot) => {
                                    const _hasStock = lot.stock_lbs > 0;
                                    return (
                                        <tr key={lot.id} className="hover:bg-amber-50/30 transition-colors">
                                            <td className="p-3.5">
                                                <div className="font-bold text-slate-900 font-mono text-sm">
                                                    {lot.provider_lot || 'S/L'}
                                                </div>
                                                <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                                    {lot.farm_name || 'Granja Principal'}
                                                </div>
                                            </td>
                                            <td className="p-3.5">
                                                <div className="font-semibold text-slate-800">
                                                    {lot.provider_name}
                                                </div>
                                                {lot.remission_note && (
                                                    <div className="text-[10px] text-slate-400">
                                                        Rem: {lot.remission_note}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3.5">
                                                <span className="capitalize font-bold text-slate-800 block">
                                                    {lot.egg_type}
                                                </span>
                                                <span className="text-[10px] text-slate-400 block">
                                                    {lot.egg_size || lot.egg_color || 'Estándar'}
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <span className="font-black text-slate-900 text-sm">
                                                    {lot.total_boxes}
                                                </span>
                                                <span className="text-[11px] text-slate-400 font-medium">
                                                    {' '}/ {lot.initial_boxes} cjs
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-right">
                                                <div className="font-black text-amber-800 text-sm">
                                                    {unitOfMeasure === 'kg' && (
                                                        <span>{lot.stock_kg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Kg</span>
                                                    )}
                                                    {unitOfMeasure === 'lbs' && (
                                                        <span>{lot.stock_lbs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lbs</span>
                                                    )}
                                                    {unitOfMeasure === 'units' && (
                                                        <span>{lot.total_boxes.toLocaleString()} Cajas</span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    de {lot.weight_lbs.toLocaleString()} Lbs inic.
                                                </div>
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700 text-xs font-semibold">
                                                    <MapPin size={12} className="text-slate-400" />
                                                    {lot.storage_location}
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-center">
                                                {lot.quality_status === 'aprobado' ? (
                                                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold inline-flex items-center gap-1">
                                                        <ShieldCheck size={12} /> Aprobado
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-bold inline-flex items-center gap-1">
                                                        <AlertTriangle size={12} /> {lot.quality_status || 'Pendiente'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3.5 text-center text-slate-700">
                                                {lot.reception_date ? formatDate(lot.reception_date) : 'N/A'}
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenTarimasModal(lot)}
                                                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                                                >
                                                    <Layers size={13} />
                                                    <span>{lot.tarimas_count} Tarima{lot.tarimas_count !== 1 ? 's' : ''}</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
