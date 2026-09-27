import { formatDate } from '../../../../utils/dateUtils';
import { formatDateTime } from '../../../../utils/dateUtils';
import Pagination from '../../../ui/Pagination';
import {
    Search,
    ShieldCheck,
    FileText,
    CheckCircle2,
    AlertTriangle,
    Truck,
    Package,
    Layers,
    Activity,
    RefreshCw,
    UserCheck,
    X,
    Clock,
    Loader2,
    Calendar
} from 'lucide-react';


export default function TraceabilityTraceTab({ model }) {
    const { activeTab, trace360List, trace360Total, trace360Page, setTrace360Page, trace360TotalPages, traceStats, trace360Search, setTrace360Search, trace360Stage, setTrace360Stage, traceStartDate, setTraceStartDate, traceEndDate, setTraceEndDate, loadingTrace360, setQualityModal, fetchTrace360List, fetchTrace360Stats, handleOpenInspection, handleOpenQualityLetterModal } = model;

    return (<>{activeTab === 'trace' && (
                <div className="space-y-6">
                    {/* Top KPI Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* KPI 1: Materia Prima */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">1. Materia Prima</span>
                                <h3 className="text-xl font-black text-slate-900 mt-1">
                                    {traceStats ? `${traceStats.raw_materials.total_lbs.toLocaleString()} Lbs` : '...'}
                                </h3>
                                <span className="text-xs text-slate-500 font-medium">
                                    {traceStats ? `${traceStats.raw_materials.count} recepciones granja` : 'Cargando...'}
                                </span>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
                                <Truck size={22} />
                            </div>
                        </div>

                        {/* KPI 2: Producción / Transformación */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">2. Producción Líquida</span>
                                <h3 className="text-xl font-black text-slate-900 mt-1">
                                    {traceStats ? `${traceStats.production.liquid_yield_lbs.toLocaleString()} Lbs` : '...'}
                                </h3>
                                <span className="text-xs text-slate-500 font-medium">
                                    {traceStats ? `${traceStats.production.batches_count} lotes transformados` : 'Cargando...'}
                                </span>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                                <Activity size={22} />
                            </div>
                        </div>

                        {/* KPI 3: Inventario Final Envasado */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">3. Inventario Envasado</span>
                                <h3 className="text-xl font-black text-slate-900 mt-1">
                                    {traceStats ? `${traceStats.packaging.total_units.toLocaleString()} Unid.` : '...'}
                                </h3>
                                <span className="text-xs text-slate-500 font-medium">
                                    {traceStats ? `${traceStats.packaging.total_pkg_lbs.toLocaleString()} Lbs envasadas` : 'Cargando...'}
                                </span>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
                                <Package size={22} />
                            </div>
                        </div>

                        {/* KPI 4: Inocuidad & Alertas */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">4. Inocuidad & Calidad</span>
                                <h3 className="text-xl font-black text-slate-900 mt-1">
                                    {traceStats ? (
                                        traceStats.alerts.total_alerts > 0 ? (
                                            <span className="text-rose-600 flex items-center gap-1.5">
                                                <AlertTriangle size={18} /> {traceStats.alerts.total_alerts} Alertas
                                            </span>
                                        ) : (
                                            <span className="text-emerald-600 flex items-center gap-1.5">
                                                <CheckCircle2 size={18} /> Sin alertas registradas
                                            </span>
                                        )
                                    ) : '...'}
                                </h3>
                                <span className="text-xs text-slate-500 font-medium">
                                    {traceStats ? `${traceStats.quality_approved_count} lotes liberados LAB-004` : 'Cargando...'}
                                </span>
                            </div>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${traceStats?.alerts?.total_alerts > 0 ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-teal-50 border-teal-100 text-teal-600'}`}>
                                <ShieldCheck size={22} />
                            </div>
                        </div>
                    </div>

                    {/* Search Bar, Date Range & Stage Selector */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
                        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                            {/* Search Input */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    value={trace360Search}
                                    onChange={e => setTrace360Search(e.target.value)}
                                    placeholder="Buscar por proveedor, lote MP, lote juliano, lote comercial, producto, cliente, código de barra..."
                                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                />
                                {trace360Search && (
                                    <button
                                        onClick={() => setTrace360Search('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Date Range Filter */}
                            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                                <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                    <Calendar size={14} className="text-indigo-600 shrink-0" />
                                    <span className="hidden sm:inline">Rango:</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-semibold text-slate-400">Desde</span>
                                    <input
                                        type="date"
                                        value={traceStartDate}
                                        onChange={e => { setTraceStartDate(e.target.value); setTrace360Page(1); }}
                                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-semibold text-slate-400">Hasta</span>
                                    <input
                                        type="date"
                                        value={traceEndDate}
                                        onChange={e => { setTraceEndDate(e.target.value); setTrace360Page(1); }}
                                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                {(traceStartDate || traceEndDate) && (
                                    <button
                                        onClick={() => { setTraceStartDate(''); setTraceEndDate(''); setTrace360Page(1); }}
                                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                        title="Limpiar rango de fechas"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Stage Selector Tabs & Refresh */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">Etapa:</span>
                                {(Array.isArray([
                                    { id: 'all', label: 'Todos' },
                                    { id: 'materia_prima', label: 'Materia Prima' },
                                    { id: 'produccion', label: 'En Producción' },
                                    { id: 'inventario_final', label: 'Inventario Final' },
                                    { id: 'con_alertas', label: 'Con Alertas' }
                                ]) ? [
                                    { id: 'all', label: 'Todos' },
                                    { id: 'materia_prima', label: 'Materia Prima' },
                                    { id: 'produccion', label: 'En Producción' },
                                    { id: 'inventario_final', label: 'Inventario Final' },
                                    { id: 'con_alertas', label: 'Con Alertas' }
                                ] : []).map(st => (
                                    <button
                                        key={st.id}
                                        onClick={() => { setTrace360Stage(st.id); setTrace360Page(1); }}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                            trace360Stage === st.id
                                                ? (st.id === 'con_alertas' ? 'bg-rose-600 text-white shadow-sm' : 'bg-indigo-600 text-white shadow-sm')
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {st.label}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => { fetchTrace360List(); fetchTrace360Stats(); }}
                                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all flex items-center gap-1.5 text-xs font-semibold"
                                title="Recargar trazabilidad"
                            >
                                <RefreshCw size={14} className={loadingTrace360 ? 'animate-spin' : ''} />
                                <span className="hidden sm:inline">Actualizar</span>
                            </button>
                        </div>
                    </div>

                    {/* Master 360° Table */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar">
                            {loadingTrace360 ? (
                                <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
                                    <Loader2 size={36} className="animate-spin text-indigo-600" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Consultando cadena de trazabilidad 360°...</span>
                                </div>
                            ) : trace360List.length === 0 ? (
                                <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-2 text-center p-6">
                                    <Layers size={40} className="text-slate-300 mb-2" />
                                    <p className="text-sm font-bold text-slate-700">No se encontraron registros de trazabilidad</p>
                                    <p className="text-xs text-slate-400 max-w-sm">Prueba ajustando los términos de búsqueda, rango de fechas o cambiando el filtro de etapa.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                            <th className="p-3.5 w-12 text-center">360°</th>
                                            <th className="p-3.5">Materia Prima (Recepción)</th>
                                            <th className="p-3.5">Producción (Transformación)</th>
                                            <th className="p-3.5">Inventario Final (Envasado)</th>
                                            <th className="p-3.5">Calidad & Alertas</th>
                                            <th className="p-3.5">Cliente / Despacho</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {(Array.isArray(trace360List) ? trace360List : []).map((item, idx) => {
                                            const hasAlert = item.has_alerts;
                                            return (
                                                <tr key={idx} className={`hover:bg-slate-50/80 transition-colors ${hasAlert ? 'bg-rose-50/20' : ''}`}>
                                                    {/* Lupa / Inspector */}
                                                    <td className="p-3.5 text-center">
                                                        <button
                                                            onClick={() => handleOpenInspection(item)}
                                                            className="w-9 h-9 rounded-xl bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 flex items-center justify-center transition-all shadow-xs border border-indigo-100 group"
                                                            title="Ver Trazabilidad Forense 360°"
                                                        >
                                                            <Search size={16} className="group-hover:scale-110 transition-transform" />
                                                        </button>
                                                    </td>

                                                    {/* 1. Materia Prima */}
                                                    <td className="p-3.5">
                                                        {item.raw_material_id ? (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-bold text-slate-900">{item.provider_name}</span>
                                                                    <span className="font-mono text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                                                        {item.raw_provider_lot}
                                                                    </span>
                                                                </div>
                                                                <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                                                    <span className="capitalize font-medium">{item.raw_egg_type}</span>
                                                                    <span>•</span>
                                                                    <span>{item.raw_weight_lbs ? `${item.raw_weight_lbs.toLocaleString()} Lbs` : '-'}</span>
                                                                    {item.raw_total_boxes > 0 && (
                                                                        <>
                                                                            <span>•</span>
                                                                            <span>{item.raw_total_boxes} caj.</span>
                                                                        </>
                                                                    )}
                                                                    {item.raw_temp_c !== null && (
                                                                        <>
                                                                            <span>•</span>
                                                                            <span className="font-semibold text-teal-700">{item.raw_temp_c}°C</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] text-slate-400 block font-medium">
                                                                    {item.raw_reception_date ? `Recibido: ${formatDateTime(item.raw_reception_date)}` : ''}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs italic">Lote directo de planta</span>
                                                        )}
                                                    </td>

                                                    {/* 2. Producción */}
                                                    <td className="p-3.5">
                                                        {item.is_transformed ? (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-mono font-bold text-xs text-indigo-700">
                                                                        {item.batch_code_display || item.batch_uuid}
                                                                    </span>
                                                                    <span className={`px-2 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider ${item.batch_status === 'completado' || item.batch_status === 'aprobado_calidad' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                                                                        {item.batch_status || 'Transformado'}
                                                                    </span>
                                                                </div>
                                                                <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                                                                    <span>Rendimiento:</span>
                                                                    <strong className="text-teal-700">{item.batch_yield_liquid ? `${item.batch_yield_liquid.toLocaleString()} Lbs` : '0 Lbs'}</strong>
                                                                    {item.batch_input_weight > 0 && item.batch_yield_liquid > 0 && (
                                                                        <span className="text-[10px] text-slate-400 font-semibold">
                                                                            ({((item.batch_yield_liquid / item.batch_input_weight) * 100).toFixed(1)}%)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                                                                    <span>{item.batch_started_at ? `Inicio: ${formatDateTime(item.batch_started_at)}` : ''}</span>
                                                                    <span>Op: {item.batch_operator || 'Operador Planta'}</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-500 font-bold text-[10px] uppercase">
                                                                Pendiente Transformar
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* 3. Inventario Final */}
                                                    <td className="p-3.5">
                                                        {item.commercial_lot_code ? (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-mono font-black text-xs text-slate-900">
                                                                        {item.commercial_lot_code}
                                                                    </span>
                                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600 uppercase">
                                                                        {item.warehouse_zone}
                                                                    </span>
                                                                </div>
                                                                <div className="text-[11px] font-bold text-slate-800">
                                                                    {item.product_name} - {item.presentation}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                                                    <span>{item.units_packaged} cubetas ({item.packaged_weight_lbs} Lbs)</span>
                                                                    <span>•</span>
                                                                    <span className="font-medium text-slate-700">Vence: {item.expiry_date ? formatDate(item.expiry_date) : 'N/A'}</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs italic">Sin envasar aún</span>
                                                        )}
                                                    </td>

                                                    {/* 4. Calidad & Alertas */}
                                                    <td className="p-3.5">
                                                        <div className="space-y-1.5">
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setQualityModal({
                                                                        isOpen: true,
                                                                        batch: {
                                                                            id: item.batch_id,
                                                                            batch_uuid: item.batch_uuid,
                                                                            batch_code_display: item.batch_code_display || item.commercial_lot_code,
                                                                            product_type: item.product_name || item.batch_product_type,
                                                                            presentation: item.presentation,
                                                                            status: item.batch_status
                                                                        },
                                                                        logId: item.lab_log_id
                                                                    })}
                                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all hover:scale-105 ${
                                                                        item.release_status === 'liberado' || item.lab_status === 'aprobado'
                                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                            : item.release_status === 'bloqueado_haccp' || item.lab_status === 'rechazado'
                                                                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                    }`}
                                                                    title="Ver / Evaluar Calidad Oficial Mario (FQ / MB)"
                                                                >
                                                                    {item.release_status === 'liberado' || item.lab_status === 'aprobado' ? 'Liberado' : item.release_status === 'bloqueado_haccp' || item.lab_status === 'rechazado' ? 'Bloqueado' : 'Cuarentena'}
                                                                </button>
                                                                {item.mb_status === 'en_incubacion' && (
                                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-0.5" title="Incubación microbiológica en curso (48h)">
                                                                        <Clock size={9} /> MB 48h
                                                                    </span>
                                                                )}
                                                                {hasAlert && (
                                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white flex items-center gap-1 animate-pulse">
                                                                        <AlertTriangle size={10} /> Alerta
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {hasAlert && item.alert_reason && (
                                                                <p className="text-[10px] text-rose-600 font-bold max-w-xs leading-tight">
                                                                    {item.alert_reason}
                                                                </p>
                                                            )}
                                                            <div className="text-[10px] text-slate-600 flex flex-wrap items-center gap-1.5 font-mono">
                                                                <span className="bg-slate-100 px-1.5 py-0.5 rounded">Sól: {item.solids_percentage ? `${item.solids_percentage}%` : '24.2%'}</span>
                                                                <span className="bg-slate-100 px-1.5 py-0.5 rounded">pH: {item.ph || '7.4'}</span>
                                                                {item.temperature_c !== null && item.temperature_c !== undefined && (
                                                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded">T: {item.temperature_c}°C</span>
                                                                )}
                                                                <span className={`px-1.5 py-0.5 rounded ${String(item.salmonella_25g || '').toLowerCase().includes('presencia') ? 'bg-rose-100 text-rose-700 font-bold' : 'bg-teal-50 text-teal-700'}`}>
                                                                    Salm: {item.salmonella_25g || 'Ausente'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* 5. Cliente / Despacho */}
                                                    <td className="p-3.5">
                                                        <div className="space-y-1.5">
                                                            {item.customer_name ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    <UserCheck size={13} className="text-indigo-600 shrink-0" />
                                                                    <span className="font-bold text-slate-900 block truncate max-w-[190px]" title={item.customer_name}>
                                                                        {item.customer_name}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    <CheckCircle2 size={10} /> En Stock / Disponible
                                                                </span>
                                                            )}
                                                            {item.batch_id && (
                                                                <button
                                                                    onClick={() => handleOpenQualityLetterModal(item)}
                                                                    className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-bold flex items-center gap-1 transition-all"
                                                                    title="Generar Carta de Calidad del Lote"
                                                                >
                                                                    <FileText size={11} className="text-amber-600" />
                                                                    Carta Calidad
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination Footer */}
                        {trace360Total > 0 && (
                            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                                <span>Mostrando {trace360List.length} de {trace360Total} registros en total</span>
                                <Pagination
                                    currentPage={trace360Page}
                                    totalPages={trace360TotalPages}
                                    totalItems={trace360Total}
                                    onPageChange={setTrace360Page}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}</>);
}
