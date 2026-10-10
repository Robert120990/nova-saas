import { useState, useMemo } from 'react';
import { Package, Search, Layers, Box, AlertTriangle, ShieldCheck, ExternalLink, Eye } from 'lucide-react';
import { formatDate } from '../../../../utils/dateUtils';
import InventorySection5 from '../InventorySection5';
import InventoryFiltersBar from '../InventoryFiltersBar';

export default function FinishedProductTab({ model }) {
    const {
        overviewData,
        searchTerm,
        setSearchTerm,
        selectedType,
        setSelectedType,
        unitOfMeasure,
        onOpenLotsModal
    } = model;

    const [subView, setSubView] = useState('presentation'); // 'presentation' | 'lots' | 'mapping'

    const finished = overviewData?.finished_products || { summary: {}, by_presentation: [], lots: [] };
    const summary = finished.summary || {};
    const presentations = Array.isArray(finished.by_presentation) ? finished.by_presentation : [];
    const lots = Array.isArray(finished.lots) ? finished.lots : [];

    // Tipos de producto únicos
    const availableTypes = useMemo(() => {
        const types = new Set();
        presentations.forEach(p => { if (p.product_type) types.add(p.product_type); });
        return Array.from(types);
    }, [presentations]);

    // Filtrar presentaciones
    const filteredPresentations = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return presentations.filter(p => {
            const matchesSearch = !term ||
                (p.product_type || '').toLowerCase().includes(term) ||
                (p.presentation || '').toLowerCase().includes(term);
            const matchesType = selectedType === 'todos' || (p.product_type || '').toLowerCase() === selectedType.toLowerCase();
            return matchesSearch && matchesType;
        });
    }, [presentations, searchTerm, selectedType]);

    // Filtrar lotes individuales
    const filteredLots = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return lots.filter(l => {
            const matchesSearch = !term ||
                (l.lot_code || '').toLowerCase().includes(term) ||
                (l.batch_code_display || '').toLowerCase().includes(term) ||
                (l.product_type || '').toLowerCase().includes(term) ||
                (l.presentation || '').toLowerCase().includes(term);
            const matchesType = selectedType === 'todos' || (l.product_type || '').toLowerCase() === selectedType.toLowerCase();
            return matchesSearch && matchesType;
        });
    }, [lots, searchTerm, selectedType]);

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider truncate">Presentaciones</span>
                        <Package size={15} className="text-blue-600 shrink-0" />
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-slate-900">
                        {summary.total_presentations || 0}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 block font-medium mt-0.5 truncate">
                        Envases y pesos
                    </span>
                </div>

                <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider truncate">Stock Envases</span>
                        <Box size={15} className="text-indigo-600 shrink-0" />
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-indigo-700">
                        {parseInt(summary.total_units || 0, 10).toLocaleString()}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 block font-medium mt-0.5 truncate">
                        Listas para despacho
                    </span>
                </div>

                <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider truncate">Stock (Libras)</span>
                        <Package size={15} className="text-emerald-600 shrink-0" />
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
                        <Package size={15} className="text-violet-600 shrink-0" />
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-violet-700">
                        {parseFloat(summary.total_stock_kg || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-violet-700 font-bold block mt-0.5">
                        Kg Netos
                    </span>
                </div>
            </div>

            {/* Sub-view Navigation & Filters Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
                {/* Selector de Sub-vistas */}
                <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 text-xs font-bold w-full md:w-auto">
                    <button
                        type="button"
                        onClick={() => setSubView('presentation')}
                        className={`flex-1 md:flex-initial px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                            subView === 'presentation'
                                ? 'bg-white text-blue-700 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Package size={14} />
                        <span>Por Presentación</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setSubView('lots')}
                        className={`flex-1 md:flex-initial px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                            subView === 'lots'
                                ? 'bg-white text-blue-700 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Layers size={14} />
                        <span>Por Lote Envasado</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setSubView('mapping')}
                        className={`flex-1 md:flex-initial px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                            subView === 'mapping'
                                ? 'bg-white text-blue-700 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <ExternalLink size={14} />
                        <span>Catálogo Traducido</span>
                    </button>
                </div>

                {/* Buscador y filtro por tipo */}
                <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input
                            type="text"
                            placeholder="Buscar presentación, lote..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>

                    {availableTypes.length > 0 && subView !== 'mapping' && (
                        <select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                            <option value="todos">Todos los Tipos ({availableTypes.length})</option>
                            {availableTypes.map(t => (
                                <option key={t} value={t}>{t.toUpperCase()}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Sub-view Content */}
            {subView === 'presentation' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <Package size={17} className="text-blue-600" />
                            Existencias por Presentación Física ({filteredPresentations.length})
                        </h3>
                    </div>

                    {filteredPresentations.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 font-medium text-xs flex flex-col items-center gap-2">
                            <Package size={32} className="text-slate-300" />
                            No se encontraron presentaciones con existencias registradas.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[650px] text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                        <th className="p-3.5">Producto & Presentación</th>
                                        <th className="p-3.5 text-center">Peso Unitario</th>
                                        <th className="p-3.5 text-right">Stock Físico (Envases)</th>
                                        <th className="p-3.5 text-right">
                                            {unitOfMeasure === 'kg' ? 'Existencia Total (Kg)' : unitOfMeasure === 'units' ? 'Existencia (Envases)' : 'Existencia Total (Lbs)'}
                                        </th>
                                        <th className="p-3.5 text-center">Lotes Activos</th>
                                        <th className="p-3.5 text-center">Estado</th>
                                        <th className="p-3.5 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(Array.isArray(filteredPresentations) ? filteredPresentations : []).map((p) => {
                                        const _isAvailable = p.available_units > 0;
                                        return (
                                            <tr key={p.id} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="p-3.5">
                                                    <div className="font-bold text-slate-900 text-sm capitalize">
                                                        {p.product_type}
                                                    </div>
                                                    <div className="text-xs font-medium text-slate-500 capitalize">
                                                        {p.presentation}
                                                    </div>
                                                </td>
                                                <td className="p-3.5 text-center font-medium text-slate-600">
                                                    {p.unit_weight_lbs} Lbs ({p.unit_weight_kg} Kg)
                                                </td>
                                                <td className="p-3.5 text-right font-black text-slate-900 text-sm">
                                                    {p.available_units.toLocaleString()} u.
                                                </td>
                                                <td className="p-3.5 text-right font-black text-emerald-700 text-sm">
                                                    {unitOfMeasure === 'kg' && (
                                                        <span>{p.total_stock_kg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Kg</span>
                                                    )}
                                                    {unitOfMeasure === 'lbs' && (
                                                        <span>{p.total_stock_lbs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lbs</span>
                                                    )}
                                                    {unitOfMeasure === 'units' && (
                                                        <span>{p.available_units.toLocaleString()} Envases</span>
                                                    )}
                                                </td>
                                                <td className="p-3.5 text-center font-bold text-slate-800">
                                                    <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700">
                                                        {p.active_lots_count || 0} lote{p.active_lots_count !== 1 ? 's' : ''}
                                                    </span>
                                                </td>
                                                <td className="p-3.5 text-center">
                                                    {p.available_units > 50 ? (
                                                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold">
                                                            En Stock
                                                        </span>
                                                    ) : p.available_units > 0 ? (
                                                        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-bold">
                                                            Stock Bajo
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg text-[10px] font-bold">
                                                            Agotado
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3.5 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpenLotsModal(p)}
                                                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                                                    >
                                                        <Eye size={13} />
                                                        Ver Lotes
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
            )}

            {subView === 'lots' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <Layers size={17} className="text-indigo-600" />
                            Detalle de Lotes Envasados Individuales ({filteredLots.length})
                        </h3>
                    </div>

                    {filteredLots.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 font-medium text-xs flex flex-col items-center gap-2">
                            <Layers size={32} className="text-slate-300" />
                            No se encontraron lotes envasados que coincidan con la búsqueda.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[700px] text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                        <th className="p-3">Lote Envasado</th>
                                        <th className="p-3">Lote Producción</th>
                                        <th className="p-3">Producto & Presentación</th>
                                        <th className="p-3 text-center">Zona</th>
                                        <th className="p-3 text-center">Calidad</th>
                                        <th className="p-3 text-right">Stock Envases</th>
                                        <th className="p-3 text-right">Existencia (Lbs / Kg)</th>
                                        <th className="p-3 text-center">Vencimiento</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(Array.isArray(filteredLots) ? filteredLots : []).map((lot) => (
                                        <tr key={lot.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3">
                                                <div className="font-mono font-bold text-slate-900">
                                                    {lot.lot_code || `ENV-${lot.id}`}
                                                </div>
                                                {lot.barcode && (
                                                    <div className="font-mono text-[10px] text-slate-400">{lot.barcode}</div>
                                                )}
                                            </td>
                                            <td className="p-3 font-semibold text-slate-700">
                                                {lot.batch_code_display || `Lote #${lot.batch_id}`}
                                            </td>
                                            <td className="p-3 capitalize font-medium text-slate-800">
                                                {lot.product_type} - {lot.presentation}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                                                    {lot.warehouse_zone || 'COOLER'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                {lot.quality_status === 'liberado' ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                                                        <ShieldCheck size={11} /> Liberado
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 inline-flex items-center gap-1">
                                                        <AlertTriangle size={11} /> {lot.quality_status || 'Cuarentena'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-right font-black text-slate-900">
                                                {lot.available_units.toLocaleString()} u.
                                            </td>
                                            <td className="p-3 text-right font-black text-emerald-700">
                                                {unitOfMeasure === 'kg'
                                                    ? `${lot.stock_kg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Kg`
                                                    : `${lot.stock_lbs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lbs`
                                                }
                                            </td>
                                            <td className="p-3 text-center text-slate-600">
                                                {lot.expiry_date ? formatDate(lot.expiry_date) : 'N/A'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {subView === 'mapping' && (
                <div className="space-y-4">
                    <InventoryFiltersBar model={model} />
                    <InventorySection5 model={model} />
                </div>
            )}
        </div>
    );
}
