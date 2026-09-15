import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Money from '../ui/Money';
import { 
    CheckCircle2, XCircle, Ban, Clock, 
    Calendar, Building2, RefreshCw, FileText, Check, Layers, 
    DollarSign, AlertCircle, FileCheck
} from 'lucide-react';

const formatLocalDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getPresetDates = (preset) => {
    const today = new Date();

    switch (preset) {
        case 'today':
            return { start: formatLocalDate(today), end: formatLocalDate(today) };
        case 'yesterday': {
            const y = new Date(today);
            y.setDate(y.getDate() - 1);
            return { start: formatLocalDate(y), end: formatLocalDate(y) };
        }
        case 'last7': {
            const d = new Date(today);
            d.setDate(d.getDate() - 6);
            return { start: formatLocalDate(d), end: formatLocalDate(today) };
        }
        case 'thisMonth': {
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            return { start: formatLocalDate(firstDay), end: formatLocalDate(today) };
        }
        case 'lastMonth': {
            const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            return { start: formatLocalDate(firstDayLastMonth), end: formatLocalDate(lastDayLastMonth) };
        }
        case 'thisYear': {
            const firstDayYear = new Date(today.getFullYear(), 0, 1);
            return { start: formatLocalDate(firstDayYear), end: formatLocalDate(today) };
        }
        case 'all':
            return { start: '', end: '' };
        default:
            return { start: formatLocalDate(today), end: formatLocalDate(today) };
    }
};

export default function DashboardDte() {
    const [selectedPreset, setSelectedPreset] = useState('thisMonth');
    const initialDates = getPresetDates('thisMonth');
    const [startDate, setStartDate] = useState(initialDates.start);
    const [endDate, setEndDate] = useState(initialDates.end);
    const [branchId, setBranchId] = useState('all');

    // Fetch branches for filter
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    // Fetch DTE statistics
    const { data: statsData, isLoading, isError, error, refetch, isFetching } = useQuery({
        queryKey: ['dashboard-dte-stats', startDate, endDate, branchId],
        queryFn: async () => {
            const params = {};
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;
            if (branchId && branchId !== 'all') params.branch_id = branchId;

            const res = await axios.get('/api/sales/dte-stats', { params });
            return res.data;
        },
        retry: 1
    });

    const handleApplyPreset = (presetKey) => {
        setSelectedPreset(presetKey);
        const dates = getPresetDates(presetKey);
        setStartDate(dates.start);
        setEndDate(dates.end);
    };

    const handleDateChange = (type, value) => {
        setSelectedPreset('custom');
        if (type === 'start') setStartDate(value);
        if (type === 'end') setEndDate(value);
    };

    const summary = statsData?.summary || {
        total_ventas: 0,
        total_dtes_emitidos: 0,
        total_aceptados: 0,
        porcentaje_aceptados: '0.0',
        total_rechazados: 0,
        porcentaje_rechazados: '0.0',
        total_invalidados: 0,
        porcentaje_invalidados: '0.0',
        total_contingencia: 0,
        total_pendientes: 0,
        total_monto_ventas: 0,
        total_monto_dtes: 0
    };

    const byType = statsData?.by_type || [];
    const dailyBreakdown = statsData?.daily_breakdown || [];

    const presets = [
        { id: 'today', label: 'Hoy' },
        { id: 'yesterday', label: 'Ayer' },
        { id: 'last7', label: 'Últimos 7 días' },
        { id: 'thisMonth', label: 'Este Mes' },
        { id: 'lastMonth', label: 'Mes Anterior' },
        { id: 'thisYear', label: 'Este Año' },
        { id: 'all', label: 'Histórico Completo' }
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header Title Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <FileCheck className="text-indigo-600" size={24} />
                        <span>Estadísticas de DTEs Emitidos</span>
                    </h3>
                    <p className="text-slate-500 text-xs font-medium mt-0.5">
                        Métricas de facturación electrónica, validación y recepción oficial por el Ministerio de Hacienda
                    </p>
                </div>
            </div>

            {/* Filters Section */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                {/* Presets Row */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mr-1 shrink-0">
                        Período:
                    </span>
                    {presets.map((preset) => (
                        <button
                            key={preset.id}
                            type="button"
                            onClick={() => handleApplyPreset(preset.id)}
                            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all text-xs ${
                                selectedPreset === preset.id
                                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                            }`}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>

                {/* Inputs Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-200/60">
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                            Fecha Desde
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => handleDateChange('start', e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                            Fecha Hasta
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => handleDateChange('end', e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                            Sucursal
                        </label>
                        <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <select
                                value={branchId}
                                onChange={(e) => setBranchId(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            >
                                <option value="all">Todas las sucursales</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-end">
                        <button
                            type="button"
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-60"
                        >
                            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
                            <span>Actualizar</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Error Banner */}
            {isError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-700 font-medium">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-rose-600 shrink-0" />
                        <span>{error?.response?.data?.message || 'Error al cargar las estadísticas de DTE. Por favor intente nuevamente.'}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => refetch()}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold uppercase text-[10px] tracking-wider transition-all"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {/* KPI Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Total DTEs */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-all">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">DTEs Emitidos</span>
                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                            <FileText size={14} />
                        </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        {summary.total_dtes_emitidos}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium mt-1 truncate">
                        de {summary.total_ventas} ventas registradas
                    </div>
                </div>

                {/* Tasa de Aceptación */}
                <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/80 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-all">
                    <div className="flex items-center justify-between text-emerald-700 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Aceptación MH</span>
                        <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                            <CheckCircle2 size={14} />
                        </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-800 tracking-tight">
                        {summary.porcentaje_aceptados}%
                    </div>
                    <div className="text-[10px] text-emerald-700 font-semibold mt-1 truncate">
                        {summary.total_aceptados} comprobantes recibidos
                    </div>
                </div>

                {/* Rechazados */}
                <div className="bg-rose-50/40 p-3.5 rounded-2xl border border-rose-200/80 shadow-sm relative overflow-hidden group hover:border-rose-300 transition-all">
                    <div className="flex items-center justify-between text-rose-600 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Rechazados</span>
                        <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg">
                            <XCircle size={14} />
                        </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-rose-700 tracking-tight">
                        {summary.total_rechazados}
                    </div>
                    <div className="text-[10px] text-rose-600 font-semibold mt-1">
                        {summary.porcentaje_rechazados}% tasa de rechazo
                    </div>
                </div>

                {/* Invalidados */}
                <div className="bg-amber-50/40 p-3.5 rounded-2xl border border-amber-200/80 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-all">
                    <div className="flex items-center justify-between text-amber-700 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Invalidados</span>
                        <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                            <Ban size={14} />
                        </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-amber-800 tracking-tight">
                        {summary.total_invalidados}
                    </div>
                    <div className="text-[10px] text-amber-700 font-semibold mt-1">
                        {summary.porcentaje_invalidados}% del total
                    </div>
                </div>

                {/* Contingencia / Pendientes */}
                <div className="bg-sky-50/40 p-3.5 rounded-2xl border border-sky-200/80 shadow-sm relative overflow-hidden group hover:border-sky-300 transition-all">
                    <div className="flex items-center justify-between text-sky-700 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Contingencia</span>
                        <div className="p-1.5 bg-sky-100 text-sky-700 rounded-lg">
                            <Clock size={14} />
                        </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-sky-800 tracking-tight">
                        {summary.total_contingencia + summary.total_pendientes}
                    </div>
                    <div className="text-[10px] text-sky-700 font-semibold mt-1 truncate">
                        {summary.total_pendientes} pendientes transmisión
                    </div>
                </div>

                {/* Total Monto Facturado en DTE */}
                <div className="bg-indigo-50/40 p-3.5 rounded-2xl border border-indigo-200/80 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-all">
                    <div className="flex items-center justify-between text-indigo-700 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Monto DTEs</span>
                        <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                            <DollarSign size={14} />
                        </div>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-indigo-900 tracking-tight">
                        <Money value={summary.total_monto_dtes} />
                    </div>
                    <div className="text-[10px] text-indigo-600 font-medium mt-1 truncate">
                        Total Ventas: <Money value={summary.total_monto_ventas} />
                    </div>
                </div>
            </div>

            {/* Breakdown by DTE Type */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Layers size={16} className="text-indigo-600" />
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Emisión por Tipo de Documento Tributario
                        </h4>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500">
                        {byType.length} {byType.length === 1 ? 'tipo emitido' : 'tipos emitidos'}
                    </span>
                </div>

                {isLoading ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                        <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-indigo-500" />
                        Cargando métricas de comprobantes...
                    </div>
                ) : byType.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs font-medium">
                        No se encontraron DTEs emitidos en el período seleccionado.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="bg-slate-50/50 text-slate-500 border-b border-slate-200/60 font-bold uppercase text-[10px] tracking-wider">
                                    <th className="py-2.5 px-4">Código / Documento</th>
                                    <th className="py-2.5 px-4 text-center">Cantidad</th>
                                    <th className="py-2.5 px-4 text-center">% del Total</th>
                                    <th className="py-2.5 px-4 text-center">Estado MH</th>
                                    <th className="py-2.5 px-4 text-right">Monto Total</th>
                                    <th className="py-2.5 px-4 text-right">% Facturación</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {byType.map((item) => {
                                    const cantNum = item.cantidad || 0;
                                    const pctNum = parseFloat(item.porcentaje_cantidad) || 0;
                                    return (
                                        <tr key={item.tipo_documento} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-2.5 px-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono font-bold text-[11px] border border-indigo-100">
                                                        {item.tipo_documento}
                                                    </span>
                                                    <div>
                                                        <div className="font-bold text-slate-900 text-xs">
                                                            {item.nombre}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="py-2.5 px-4 text-center font-black text-slate-900 text-sm">
                                                {cantNum}
                                            </td>

                                            <td className="py-2.5 px-4 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="font-bold text-slate-700 text-[11px] mb-1">
                                                        {item.porcentaje_cantidad}%
                                                    </span>
                                                    <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                        <div 
                                                            className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                                                            style={{ width: `${Math.min(pctNum, 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="py-2.5 px-4">
                                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                    <span 
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px]"
                                                        title="Aceptados por Ministerio de Hacienda"
                                                    >
                                                        <Check size={11} /> {item.aceptados}
                                                    </span>
                                                    {item.rechazados > 0 && (
                                                        <span 
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-bold text-[10px]"
                                                            title="Rechazados"
                                                        >
                                                            <XCircle size={11} /> {item.rechazados}
                                                        </span>
                                                    )}
                                                    {item.invalidados > 0 && (
                                                        <span 
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold text-[10px]"
                                                            title="Invalidados / Anulados"
                                                        >
                                                            <Ban size={11} /> {item.invalidados}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="py-2.5 px-4 text-right font-black text-slate-900 text-xs">
                                                <Money value={item.monto} />
                                            </td>

                                            <td className="py-2.5 px-4 text-right">
                                                <span className="font-bold text-indigo-700 text-xs">
                                                    {item.porcentaje_monto}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Daily Breakdown */}
            {dailyBreakdown.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-slate-600" />
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                Desglose Diario de Emisiones (Últimos días con actividad)
                            </h4>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500">
                            {dailyBreakdown.length} días
                        </span>
                    </div>

                    <div className="overflow-x-auto max-h-96">
                        <table className="w-full text-left text-xs">
                            <thead className="sticky top-0 bg-slate-50 text-slate-500 border-b border-slate-200/60 font-bold uppercase text-[10px] tracking-wider z-10">
                                <tr>
                                    <th className="py-2 px-4">Fecha</th>
                                    <th className="py-2 px-4 text-center">Total DTEs</th>
                                    <th className="py-2 px-4 text-center">Aceptados</th>
                                    <th className="py-2 px-4 text-center">Rech./Inv.</th>
                                    <th className="py-2 px-4 text-center">Facturas (01)</th>
                                    <th className="py-2 px-4 text-center">Créd. Fiscal (03)</th>
                                    <th className="py-2 px-4 text-center">Otros</th>
                                    <th className="py-2 px-4 text-right">Monto Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {dailyBreakdown.map((day) => (
                                    <tr key={day.fecha} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-2 px-4 font-bold text-slate-800">
                                            {day.fecha}
                                        </td>
                                        <td className="py-2 px-4 text-center font-black text-slate-900">
                                            {day.total_dtes}
                                        </td>
                                        <td className="py-2 px-4 text-center">
                                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                                                {day.aceptados}
                                            </span>
                                        </td>
                                        <td className="py-2 px-4 text-center">
                                            {day.rechazados > 0 || day.invalidados > 0 ? (
                                                <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-bold text-[10px]">
                                                    {day.rechazados + day.invalidados}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="py-2 px-4 text-center font-medium text-slate-700">
                                            {day.facturas}
                                        </td>
                                        <td className="py-2 px-4 text-center font-medium text-slate-700">
                                            {day.creditos_fiscales}
                                        </td>
                                        <td className="py-2 px-4 text-center font-medium text-slate-500">
                                            {day.otros_dtes || 0}
                                        </td>
                                        <td className="py-2 px-4 text-right font-black text-slate-900">
                                            <Money value={day.total_monto} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
