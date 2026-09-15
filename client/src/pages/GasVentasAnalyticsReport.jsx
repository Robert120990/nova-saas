import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
    GitBranch, 
    Calendar, 
    TrendingUp, 
    TrendingDown,
    Fuel, 
    DollarSign, 
    BarChart3, 
    PieChart, 
    Clock, 
    Target,
    ArrowUpRight,
    ArrowDownRight,
    Award,
    Sparkles,
    CalendarDays,
    FileText,
    Download,
    RefreshCw,
    Loader2,
    Info
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import Money from '../components/ui/Money';
import PdfViewerModal from '../components/ui/PdfViewerModal';
import { getTodayString, getFirstDayOfMonth } from '../utils/dateUtils';

const FUEL_COLORS = [
    { fill: '#6366f1', stroke: '#4f46e5', bg: 'bg-indigo-500', text: 'text-indigo-600', light: 'bg-indigo-50' }, // Indigo
    { fill: '#10b981', stroke: '#059669', bg: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-50' }, // Emerald
    { fill: '#f59e0b', stroke: '#d97706', bg: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-50' }, // Amber
    { fill: '#06b6d4', stroke: '#0891b2', bg: 'bg-cyan-500', text: 'text-cyan-600', light: 'bg-cyan-50' }, // Cyan
    { fill: '#ec4899', stroke: '#db2777', bg: 'bg-pink-500', text: 'text-pink-600', light: 'bg-pink-50' }, // Pink
    { fill: '#8b5cf6', stroke: '#7c3aed', bg: 'bg-violet-500', text: 'text-violet-600', light: 'bg-violet-50' }, // Violet
    { fill: '#3b82f6', stroke: '#2563eb', bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50' } // Blue
];

export default function GasVentasAnalyticsReport() {
    const { user } = useAuth();

    const today = getTodayString();
    const firstDayOfMonth = getFirstDayOfMonth();

    const [filters, setFilters] = useState({
        start_date: firstDayOfMonth,
        end_date: today,
        branch_id: user?.branch_id || 'all',
        compare_mode: 'prev_period'
    });

    // Dynamic display mode: 'volume' (Gallons) vs 'amount' (Dollars $)
    const [metricMode, setMetricMode] = useState('volume');
    const [activeTab, setActiveTab] = useState('combustibles'); // 'combustibles' | 'diario' | 'semanal'
    const [hoveredDayIndex, setHoveredDayIndex] = useState(null);

    // Modal state for PDF preview
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const [isExportingExcel, setIsExportingExcel] = useState(false);

    // Branches query
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    // Main Analytics Data Query
    const {
        data: reportData,
        isLoading,
        isFetching,
        refetch
    } = useQuery({
        queryKey: ['gas-ventas-analytics', filters.start_date, filters.end_date, filters.branch_id, filters.compare_mode],
        queryFn: async () => {
            const res = await axios.get('/api/gas-station/reports/ventas-analytics/data', {
                params: {
                    start_date: filters.start_date,
                    end_date: filters.end_date,
                    branch_id: filters.branch_id,
                    compare_mode: filters.compare_mode
                }
            });
            return res.data?.data || null;
        }
    });

    // Revoke old blob url on unmount
    useEffect(() => {
        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        };
    }, [pdfUrl]);

    const handleFilterChange = (name, value) => {
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleQuickRange = (preset) => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        if (preset === 'current_month') {
            const start = new Date(Date.UTC(year, month, 1)).toISOString().split('T')[0];
            setFilters(prev => ({ ...prev, start_date: start, end_date: today }));
        } else if (preset === 'prev_month') {
            const start = new Date(Date.UTC(year, month - 1, 1)).toISOString().split('T')[0];
            const end = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];
            setFilters(prev => ({ ...prev, start_date: start, end_date: end }));
        } else if (preset === 'last_30') {
            const start = new Date(now.getTime() - 29 * 24 * 3600 * 1000).toISOString().split('T')[0];
            setFilters(prev => ({ ...prev, start_date: start, end_date: today }));
        } else if (preset === 'last_15') {
            const start = new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString().split('T')[0];
            setFilters(prev => ({ ...prev, start_date: start, end_date: today }));
        }
    };

    // Open PDF Report in interactive modal
    const handleOpenPdfModal = async () => {
        setIsPdfModalOpen(true);
        setIsPdfLoading(true);
        try {
            const res = await axios.get('/api/gas-station/reports/ventas-analytics/pdf', {
                params: {
                    start_date: filters.start_date,
                    end_date: filters.end_date,
                    branch_id: filters.branch_id,
                    compare_mode: filters.compare_mode
                },
                responseType: 'blob'
            });

            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
        } catch (err) {
            console.error('Error generating PDF:', err);
            toast.error('Error al generar el reporte en PDF');
        } finally {
            setIsPdfLoading(false);
        }
    };

    // Export to Excel directly
    const handleExportExcel = async () => {
        setIsExportingExcel(true);
        try {
            const res = await axios.get('/api/gas-station/reports/ventas-analytics/pdf', {
                params: {
                    start_date: filters.start_date,
                    end_date: filters.end_date,
                    branch_id: filters.branch_id,
                    compare_mode: filters.compare_mode,
                    format: 'excel'
                },
                responseType: 'blob'
            });
            const blob = new Blob([res.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Ventas_Analiticas_Lecturas_${filters.start_date}_al_${filters.end_date}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast.success('Reporte exportado a Excel exitosamente');
        } catch (err) {
            console.error('Error exporting Excel:', err);
            toast.error('Error al exportar el archivo Excel');
        } finally {
            setIsExportingExcel(false);
        }
    };

    // Derived values
    const summary = reportData?.summary;
    const projection = reportData?.projection;
    const fuelComparison = reportData?.fuel_comparison || [];
    const dailySeries = reportData?.daily_series || [];
    const weeklyPatterns = reportData?.weekly_patterns || [];
    const selectedBranchName = reportData?.branch_name || 'Todas las Sucursales';

    const isVolume = metricMode === 'volume';

    // Daily Trend Chart calculation
    const chartData = useMemo(() => {
        if (!dailySeries.length) return null;

        const values = dailySeries.map(d => isVolume ? d.total_galones : d.total_monto);
        const maxVal = Math.max(...values, 10);
        const minVal = 0;
        const avgVal = values.reduce((a, b) => a + b, 0) / values.length;

        const width = 960;
        const height = 260;
        const padX = 55;
        const padY = 30;
        const plotW = width - padX * 2;
        const plotH = height - padY * 2;

        const points = dailySeries.map((d, i) => {
            const val = isVolume ? d.total_galones : d.total_monto;
            const x = padX + (i / Math.max(dailySeries.length - 1, 1)) * plotW;
            const y = padY + plotH - ((val - minVal) / (maxVal - minVal)) * plotH;
            return { x, y, val, date: d.fecha, day: d.dia_semana, raw: d };
        });

        const pathLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        const pathArea = `${pathLine} L ${points[points.length - 1].x} ${padY + plotH} L ${points[0].x} ${padY + plotH} Z`;
        const avgY = padY + plotH - ((avgVal - minVal) / (maxVal - minVal)) * plotH;

        return {
            width,
            height,
            padX,
            padY,
            plotW,
            plotH,
            maxVal,
            avgVal,
            avgY,
            points,
            pathLine,
            pathArea
        };
    }, [dailySeries, isVolume]);

    // Donut Chart calculation
    const donutData = useMemo(() => {
        if (!fuelComparison.length) return [];
        const total = fuelComparison.reduce((sum, f) => sum + (isVolume ? f.current_galones : f.current_monto), 0);
        if (total <= 0) return [];

        let currentAngle = -90;
        const radius = 64;
        const cx = 85;
        const cy = 85;

        return fuelComparison.map((f, i) => {
            const val = isVolume ? f.current_galones : f.current_monto;
            const pct = (val / total) * 100;
            const angle = (pct / 100) * 360;
            const startRad = (currentAngle * Math.PI) / 180;
            const endRad = ((currentAngle + angle) * Math.PI) / 180;

            const x1 = cx + radius * Math.cos(startRad);
            const y1 = cy + radius * Math.sin(startRad);
            const x2 = cx + radius * Math.cos(endRad);
            const y2 = cy + radius * Math.sin(endRad);

            const largeArc = angle > 180 ? 1 : 0;
            const d = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

            currentAngle += angle;

            const colorObj = FUEL_COLORS[i % FUEL_COLORS.length];
            return {
                producto: f.producto,
                val,
                pct: Number(pct.toFixed(1)),
                d,
                color: colorObj
            };
        });
    }, [fuelComparison, isVolume]);

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8">
            <div className="max-w-[1600px] mx-auto space-y-6">

                {/* ========================================================= */}
                {/* 1. ENCABEZADO PRINCIPAL DE LA PANTALLA                    */}
                {/* ========================================================= */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-start sm:items-center gap-3.5">
                        <div className="p-3 bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-2xl shadow-md shadow-indigo-100 flex-shrink-0">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                                    Ventas Analíticas y Proyección
                                </h1>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                                    Lecturas Físicas
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Inteligencia de ventas, proyecciones a fin de mes y análisis comparativo según lecturas de pistolas
                            </p>
                        </div>
                    </div>

                    {/* Acciones principales: Modal PDF, Excel, Refrescar */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Botón Ver Reporte en Modal */}
                        <button
                            type="button"
                            onClick={handleOpenPdfModal}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm hover:shadow transition-all"
                        >
                            <FileText className="w-4 h-4" />
                            Ver Reporte PDF
                        </button>

                        {/* Botón Exportar Excel */}
                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={isExportingExcel}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            {isExportingExcel ? 'Exportando...' : 'Excel'}
                        </button>

                        {/* Botón Refrescar */}
                        <button
                            type="button"
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
                            title="Recargar datos"
                        >
                            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* ========================================================= */}
                {/* 2. BARRA DE CONTROL Y FILTROS HORIZONTAL                  */}
                {/* ========================================================= */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                        {/* Filtros principales */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
                            {/* Sucursal */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                                    <GitBranch className="w-3.5 h-3.5 text-indigo-500" />
                                    Sucursal
                                </label>
                                <select
                                    value={filters.branch_id}
                                    onChange={(e) => handleFilterChange('branch_id', e.target.value)}
                                    className="w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 hover:bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                                >
                                    <option value="all">Todas las Sucursales</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Fecha Desde */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                    Desde
                                </label>
                                <input
                                    type="date"
                                    value={filters.start_date}
                                    onChange={(e) => handleFilterChange('start_date', e.target.value)}
                                    className="w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 hover:bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                                />
                            </div>

                            {/* Fecha Hasta */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                    Hasta
                                </label>
                                <input
                                    type="date"
                                    value={filters.end_date}
                                    onChange={(e) => handleFilterChange('end_date', e.target.value)}
                                    className="w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 hover:bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                                />
                            </div>

                            {/* Modo Comparativo */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                    Comparar Contra
                                </label>
                                <select
                                    value={filters.compare_mode}
                                    onChange={(e) => handleFilterChange('compare_mode', e.target.value)}
                                    className="w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 hover:bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                                >
                                    <option value="prev_period">Período Inmediato Anterior</option>
                                    <option value="prev_month">Mismo período mes anterior</option>
                                </select>
                            </div>
                        </div>

                        {/* Conmutador Dinámico Global [ Galones | Monto ($) ] */}
                        <div className="flex flex-col items-start xl:items-end justify-center pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-indigo-500" />
                                Modo Dinámico
                            </span>
                            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setMetricMode('volume')}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase transition-all duration-200 ${
                                        isVolume 
                                            ? 'bg-indigo-600 text-white shadow-sm' 
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <Fuel className="w-3.5 h-3.5" />
                                    Galones (Volumen)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMetricMode('amount')}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase transition-all duration-200 ${
                                        !isVolume 
                                            ? 'bg-emerald-600 text-white shadow-sm' 
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <DollarSign className="w-3.5 h-3.5" />
                                    Monto ($ Dólares)
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Chips de Selección Rápida de Fecha */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 overflow-x-auto text-xs">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0">
                            Rangos Rápidos:
                        </span>
                        <button
                            type="button"
                            onClick={() => handleQuickRange('current_month')}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 font-medium transition-colors whitespace-nowrap"
                        >
                            Mes Actual
                        </button>
                        <button
                            type="button"
                            onClick={() => handleQuickRange('prev_month')}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 font-medium transition-colors whitespace-nowrap"
                        >
                            Mes Anterior
                        </button>
                        <button
                            type="button"
                            onClick={() => handleQuickRange('last_15')}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 font-medium transition-colors whitespace-nowrap"
                        >
                            Últimos 15 Días
                        </button>
                        <button
                            type="button"
                            onClick={() => handleQuickRange('last_30')}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 font-medium transition-colors whitespace-nowrap"
                        >
                            Últimos 30 Días
                        </button>
                    </div>
                </div>

                {/* ========================================================= */}
                {/* 3. ESTADO DE CARGA / CONTENIDO PRINCIPAL                   */}
                {/* ========================================================= */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200">
                        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
                        <span className="text-sm font-bold text-slate-700">Cargando datos analíticos de lecturas...</span>
                        <span className="text-xs text-slate-400 mt-1">Calculando proyecciones y comparativos</span>
                    </div>
                ) : reportData && summary ? (
                    <>
                        {/* ========================================================= */}
                        {/* TARJETAS KPI ANALÍTICAS DINÁMICAS                        */}
                        {/* ========================================================= */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                            {/* KPI 1: Ventas / Despacho Total */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-indigo-300 transition-colors">
                                <div className="flex items-center justify-between text-slate-500 mb-2">
                                    <span className="text-[11px] font-bold uppercase tracking-wider">
                                        {isVolume ? 'Galones Despachados' : 'Venta Total Registrada'}
                                    </span>
                                    <div className={`p-2.5 rounded-xl ${isVolume ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {isVolume ? <Fuel className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}
                                    </div>
                                </div>
                                <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                                    {isVolume ? (
                                        `${summary.current_totals.galones.toLocaleString('en-US', { minimumFractionDigits: 2 })} gln`
                                    ) : (
                                        <Money value={summary.current_totals.monto} />
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-2.5 text-xs">
                                    {summary.variations.diff_galones >= 0 ? (
                                        <span className="inline-flex items-center text-emerald-600 font-bold">
                                            <ArrowUpRight className="w-4 h-4" />
                                            +{isVolume ? summary.variations.pct_galones : summary.variations.pct_monto}%
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center text-rose-600 font-bold">
                                            <ArrowDownRight className="w-4 h-4" />
                                            {isVolume ? summary.variations.pct_galones : summary.variations.pct_monto}%
                                        </span>
                                    )}
                                    <span className="text-slate-400">
                                        vs período anterior ({isVolume ? `${summary.prev_totals.galones.toLocaleString('en-US', { minimumFractionDigits: 2 })} gln` : `$${summary.prev_totals.monto.toLocaleString('en-US', { minimumFractionDigits: 2 })}`})
                                    </span>
                                </div>
                            </div>

                            {/* KPI 2: Ritmo Promedio Diario */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-indigo-300 transition-colors">
                                <div className="flex items-center justify-between text-slate-500 mb-2">
                                    <span className="text-[11px] font-bold uppercase tracking-wider">
                                        {isVolume ? 'Ritmo Diario Promedio' : 'Venta Diaria Promedio'}
                                    </span>
                                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                </div>
                                <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                                    {isVolume ? (
                                        `${summary.current_totals.prom_diario_galones.toLocaleString('en-US', { minimumFractionDigits: 2 })} gln/día`
                                    ) : (
                                        <Money value={summary.current_totals.prom_diario_monto} />
                                    )}
                                </div>
                                <p className="text-xs text-slate-400 mt-2.5">
                                    Calculado sobre {summary.period.active_days} días de despacho activo
                                </p>
                            </div>

                            {/* KPI 3: Proyección Cierre de Mes */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-indigo-300 transition-colors">
                                <div className="flex items-center justify-between text-slate-500 mb-2">
                                    <span className="text-[11px] font-bold uppercase tracking-wider">
                                        {isVolume ? 'Proyección Cierre (Galones)' : 'Proyección Cierre ($)'}
                                    </span>
                                    <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                                        <Target className="w-5 h-5" />
                                    </div>
                                </div>
                                <div className="text-2xl sm:text-3xl font-black text-indigo-700 tracking-tight">
                                    {isVolume ? (
                                        `${projection.projected_galones.toLocaleString('en-US', { minimumFractionDigits: 2 })} gln`
                                    ) : (
                                        <Money value={projection.projected_monto} />
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-2.5 text-xs text-slate-500">
                                    <span className="font-bold text-slate-700">{projection.days_remaining} días restantes</span>
                                    <span>({projection.progress_pct}% mes transcurrido)</span>
                                </div>
                            </div>

                            {/* KPI 4: Precio Promedio Ponderado */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-indigo-300 transition-colors">
                                <div className="flex items-center justify-between text-slate-500 mb-2">
                                    <span className="text-[11px] font-bold uppercase tracking-wider">
                                        Precio Prom. Ponderado
                                    </span>
                                    <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                                        <Award className="w-5 h-5" />
                                    </div>
                                </div>
                                <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                                    <Money value={summary.current_totals.precio_promedio} />
                                    <span className="text-xs font-semibold text-slate-400 ml-1">/gln</span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-2.5 text-xs">
                                    {summary.variations.diff_precio >= 0 ? (
                                        <span className="inline-flex items-center text-amber-600 font-bold">
                                            <TrendingUp className="w-4 h-4 mr-0.5" />
                                            +${summary.variations.diff_precio.toFixed(4)}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center text-blue-600 font-bold">
                                            <TrendingDown className="w-4 h-4 mr-0.5" />
                                            -${Math.abs(summary.variations.diff_precio).toFixed(4)}
                                        </span>
                                    )}
                                    <span className="text-slate-400">vs período anterior (${summary.prev_totals.precio_promedio.toFixed(4)})</span>
                                </div>
                            </div>
                        </div>

                        {/* ========================================================= */}
                        {/* GRÁFICO 1: TENDENCIA DIARIA DE VENTAS (LINE/AREA SVG)     */}
                        {/* ========================================================= */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-indigo-600" />
                                        Tendencia Diaria de {isVolume ? 'Volumen Despachado (Galones)' : 'Venta Monetaria ($ Dólares)'}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Comportamiento diario según lecturas físicas de pistolas. Pasa el cursor sobre la gráfica para ver el desglose.
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <span className={`w-3 h-3 rounded-full ${isVolume ? 'bg-indigo-600' : 'bg-emerald-600'}`} />
                                        <span className="text-slate-700 font-bold">
                                            {isVolume ? 'Galones / Día' : 'Venta $ / Día'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-4 h-0.5 bg-amber-500 border-b border-dashed border-amber-500" />
                                        <span className="text-slate-700 font-bold">
                                            Promedio ({isVolume ? `${Math.round(chartData?.avgVal || 0)} gln` : `$${Math.round(chartData?.avgVal || 0)}`})
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {chartData && (
                                <div className="relative w-full overflow-x-auto">
                                    <svg
                                        viewBox={`0 0 ${chartData.width} ${chartData.height}`}
                                        className="w-full h-auto min-w-[720px]"
                                        style={{ maxHeight: '300px' }}
                                    >
                                        <defs>
                                            <linearGradient id="chartGradientScreen" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={isVolume ? '#6366f1' : '#10b981'} stopOpacity="0.28" />
                                                <stop offset="100%" stopColor={isVolume ? '#6366f1' : '#10b981'} stopOpacity="0.0" />
                                            </linearGradient>
                                        </defs>

                                        {/* Grid Lines */}
                                        <line x1={chartData.padX} y1={chartData.padY} x2={chartData.width - chartData.padX} y2={chartData.padY} stroke="#f1f5f9" strokeWidth="1" />
                                        <line x1={chartData.padX} y1={chartData.padY + chartData.plotH * 0.5} x2={chartData.width - chartData.padX} y2={chartData.padY + chartData.plotH * 0.5} stroke="#f1f5f9" strokeWidth="1" />
                                        <line x1={chartData.padX} y1={chartData.padY + chartData.plotH} x2={chartData.width - chartData.padX} y2={chartData.padY + chartData.plotH} stroke="#e2e8f0" strokeWidth="1" />

                                        {/* Average Dotted Line */}
                                        <line
                                            x1={chartData.padX}
                                            y1={chartData.avgY}
                                            x2={chartData.width - chartData.padX}
                                            y2={chartData.avgY}
                                            stroke="#f59e0b"
                                            strokeWidth="1.5"
                                            strokeDasharray="5 4"
                                        />

                                        {/* Area Fill */}
                                        <path d={chartData.pathArea} fill="url(#chartGradientScreen)" />

                                        {/* Line Curve */}
                                        <path
                                            d={chartData.pathLine}
                                            fill="none"
                                            stroke={isVolume ? '#4f46e5' : '#059669'}
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />

                                        {/* Interactive Hover Indicators & Points */}
                                        {chartData.points.map((p, i) => (
                                            <g
                                                key={i}
                                                onMouseEnter={() => setHoveredDayIndex(i)}
                                                onMouseLeave={() => setHoveredDayIndex(null)}
                                                className="cursor-pointer"
                                            >
                                                <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
                                                <circle
                                                    cx={p.x}
                                                    cy={p.y}
                                                    r={hoveredDayIndex === i ? '6.5' : '4'}
                                                    fill={hoveredDayIndex === i ? (isVolume ? '#4338ca' : '#047857') : '#ffffff'}
                                                    stroke={isVolume ? '#4f46e5' : '#059669'}
                                                    strokeWidth={hoveredDayIndex === i ? '3.5' : '2.5'}
                                                    className="transition-all duration-150"
                                                />
                                            </g>
                                        ))}

                                        {/* Hover vertical line */}
                                        {hoveredDayIndex !== null && chartData.points[hoveredDayIndex] && (
                                            <line
                                                x1={chartData.points[hoveredDayIndex].x}
                                                y1={chartData.padY}
                                                x2={chartData.points[hoveredDayIndex].x}
                                                y2={chartData.padY + chartData.plotH}
                                                stroke="#94a3b8"
                                                strokeWidth="1"
                                                strokeDasharray="3 3"
                                            />
                                        )}

                                        {/* X Axis Labels */}
                                        {chartData.points.filter((_, idx) => idx % Math.ceil(chartData.points.length / 10) === 0 || idx === chartData.points.length - 1).map((p, i) => (
                                            <text
                                                key={i}
                                                x={p.x}
                                                y={chartData.padY + chartData.plotH + 18}
                                                textAnchor="middle"
                                                fontSize="10"
                                                fill="#64748b"
                                                fontWeight="600"
                                            >
                                                {p.date.split('-')[2]}/{p.date.split('-')[1]}
                                            </text>
                                        ))}

                                        {/* Y Axis Labels */}
                                        <text x={chartData.padX - 8} y={chartData.padY + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontWeight="600">
                                            {isVolume ? `${Math.round(chartData.maxVal)}` : `$${Math.round(chartData.maxVal)}`}
                                        </text>
                                        <text x={chartData.padX - 8} y={chartData.padY + chartData.plotH} textAnchor="end" fontSize="10" fill="#94a3b8" fontWeight="600">
                                            0
                                        </text>
                                    </svg>

                                    {/* Floating Rich Tooltip */}
                                    {hoveredDayIndex !== null && chartData.points[hoveredDayIndex] && (
                                        <div 
                                            className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white rounded-2xl px-5 py-3 shadow-2xl border border-slate-700 pointer-events-none text-xs z-10 min-w-[280px]"
                                        >
                                            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                                                <span className="font-bold text-indigo-300 text-sm">
                                                    {chartData.points[hoveredDayIndex].day}, {chartData.points[hoveredDayIndex].date}
                                                </span>
                                                <span className="text-[11px] text-slate-400">
                                                    Precio Prom: ${chartData.points[hoveredDayIndex].raw.precio_promedio.toFixed(4)}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 text-xs mb-2">
                                                <div>
                                                    <span className="text-slate-400 block text-[11px]">Total Despachado:</span>
                                                    <span className="font-bold text-white text-sm">
                                                        {chartData.points[hoveredDayIndex].raw.total_galones.toLocaleString('en-US', { minimumFractionDigits: 2 })} gln
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 block text-[11px]">Venta Total:</span>
                                                    <span className="font-bold text-emerald-400 text-sm">
                                                        <Money value={chartData.points[hoveredDayIndex].raw.total_monto} />
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-1.5 text-[10px]">
                                                {Object.entries(chartData.points[hoveredDayIndex].raw.fuels || {}).map(([pName, pInfo]) => (
                                                    <span key={pName} className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60">
                                                        {pName}: <strong className="text-white">{pInfo.galones} gln</strong>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ========================================================= */}
                        {/* SECCIÓN 2: COMPARATIVO COMBUSTIBLE & DONUT CHART          */}
                        {/* ========================================================= */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Comparativo de Barras (7 cols) */}
                            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-5">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                            <Fuel className="w-5 h-5 text-indigo-600" />
                                            Comparativa por Combustible ({isVolume ? 'Galones' : 'Monto $'})
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Comparación visual del período actual vs el período previo
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-3.5 h-3.5 rounded ${isVolume ? 'bg-indigo-600' : 'bg-emerald-600'}`} />
                                            <span className="text-slate-700 font-bold">Actual</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-3.5 h-3.5 rounded bg-slate-300" />
                                            <span className="text-slate-700 font-bold">Anterior</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {fuelComparison.map((f, idx) => {
                                        const maxVal = Math.max(...fuelComparison.map(x => Math.max(isVolume ? x.current_galones : x.current_monto, isVolume ? x.prev_galones : x.prev_monto)), 1);
                                        const curVal = isVolume ? f.current_galones : f.current_monto;
                                        const prevVal = isVolume ? f.prev_galones : f.prev_monto;
                                        const curW = Math.max((curVal / maxVal) * 100, 2);
                                        const prevW = Math.max((prevVal / maxVal) * 100, 2);
                                        const pctDiff = isVolume ? f.pct_galones : f.pct_monto;

                                        return (
                                            <div key={idx} className="space-y-1.5">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-bold text-slate-800 text-[13px]">{f.producto}</span>
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="font-bold text-slate-900 text-[13px]">
                                                            {isVolume ? `${curVal.toLocaleString('en-US', { minimumFractionDigits: 2 })} gln` : <Money value={curVal} />}
                                                        </span>
                                                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                                            pctDiff >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                                                        }`}>
                                                            {pctDiff >= 0 ? `+${pctDiff}%` : `${pctDiff}%`}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-500 ${isVolume ? 'bg-indigo-600' : 'bg-emerald-600'}`}
                                                            style={{ width: `${curW}%` }}
                                                        />
                                                    </div>
                                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                        <div 
                                                            className="h-full rounded-full bg-slate-300 transition-all duration-500"
                                                            style={{ width: `${prevW}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Donut Chart: Participación (5 cols) */}
                            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2 mb-1">
                                        <PieChart className="w-5 h-5 text-indigo-600" />
                                        Participación de {isVolume ? 'Volumen' : 'Ventas'}
                                    </h3>
                                    <p className="text-xs text-slate-500 mb-4">
                                        Distribución porcentual por combustible despachado
                                    </p>
                                </div>

                                <div className="flex-1 flex flex-col items-center justify-center my-3">
                                    <div className="relative">
                                        <svg viewBox="0 0 170 170" className="w-48 h-48">
                                            {donutData.map((slice, i) => (
                                                <path
                                                    key={i}
                                                    d={slice.d}
                                                    fill={slice.color.fill}
                                                    stroke="#ffffff"
                                                    strokeWidth="2.5"
                                                    className="hover:opacity-85 transition-opacity cursor-pointer"
                                                >
                                                    <title>{`${slice.producto}: ${slice.pct}%`}</title>
                                                </path>
                                            ))}
                                            <circle cx="85" cy="85" r="46" fill="#ffffff" />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                                            <span className="text-[10px] uppercase font-bold text-slate-400">Total</span>
                                            <span className="text-sm font-black text-slate-900 leading-tight">
                                                {isVolume 
                                                    ? `${Math.round(summary.current_totals.galones).toLocaleString('en-US')} gln`
                                                    : `$${Math.round(summary.current_totals.monto).toLocaleString('en-US')}`
                                                }
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-100 text-xs">
                                    {donutData.map((slice, i) => (
                                        <div key={i} className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-50">
                                            <span className={`w-3 h-3 rounded-full ${slice.color.bg} flex-shrink-0`} />
                                            <span className="text-slate-700 truncate font-medium text-xs">{slice.producto}</span>
                                            <span className="font-bold text-slate-900 ml-auto text-xs">{slice.pct}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ========================================================= */}
                        {/* SECCIÓN 3: PATRÓN DE DEMANDA SEMANAL & PROYECCIÓN FIN MES */}
                        {/* ========================================================= */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Gráfico Patrón Semanal (7 cols) */}
                            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-5">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                            <CalendarDays className="w-5 h-5 text-amber-600" />
                                            Patrón de Demanda Semanal (Lunes a Domingo)
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Promedio diario vendido por día para optimizar la asignación de turnos e inventarios
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-7 gap-2.5 pt-3">
                                    {weeklyPatterns.map((w, idx) => {
                                        const maxW = Math.max(...weeklyPatterns.map(x => isVolume ? x.galones_promedio : x.monto_promedio), 1);
                                        const val = isVolume ? w.galones_promedio : w.monto_promedio;
                                        const barH = Math.max((val / maxW) * 140, 12);
                                        const isPeak = isVolume ? w.is_peak_galones : w.is_peak_monto;

                                        return (
                                            <div key={idx} className="flex flex-col items-center gap-2">
                                                <div className="h-5 flex items-center">
                                                    {isPeak && (
                                                        <span className="text-[9px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-sm animate-pulse">
                                                            Pico
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="w-full max-w-[56px] bg-slate-100 rounded-2xl h-36 flex flex-col justify-end p-1.5">
                                                    <div 
                                                        className={`w-full rounded-xl transition-all duration-500 ${
                                                            isPeak 
                                                                ? 'bg-gradient-to-t from-amber-600 to-amber-400 shadow-md shadow-amber-200' 
                                                                : (isVolume ? 'bg-indigo-500' : 'bg-emerald-500')
                                                        }`}
                                                        style={{ height: `${barH}px` }}
                                                    />
                                                </div>

                                                <span className="text-xs font-bold text-slate-800 text-center leading-tight">
                                                    {isVolume ? `${Math.round(val)}` : `$${Math.round(val)}`}
                                                </span>

                                                <span className="text-xs font-semibold text-slate-500 truncate w-full text-center">
                                                    {w.name.slice(0, 3)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Tarjeta de Proyección y Run-Rate (5 cols) */}
                            <div className="lg:col-span-5 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2.5 bg-indigo-500/30 rounded-2xl border border-indigo-400/40">
                                            <Target className="w-5 h-5 text-indigo-300" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold uppercase tracking-wider text-indigo-200">
                                                Proyección al Cierre de Mes
                                            </h4>
                                            <span className="text-xs text-slate-400 capitalize">
                                                Mes de {projection.month_name}
                                            </span>
                                        </div>
                                    </div>

                                    <p className="text-xs text-slate-300 leading-relaxed mb-4">
                                        Al ritmo promedio de <strong className="text-white">{isVolume ? `${projection.daily_rate_galones} gln/día` : `$${projection.daily_rate_monto}/día`}</strong>, la estación alcanzará:
                                    </p>

                                    <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10 mb-5">
                                        <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-300 block">
                                            Meta Proyectada al Fin de Mes
                                        </span>
                                        <div className="text-2xl sm:text-3xl font-black text-white mt-1">
                                            {isVolume ? (
                                                `${projection.projected_galones.toLocaleString('en-US', { minimumFractionDigits: 2 })} gln`
                                            ) : (
                                                <Money value={projection.projected_monto} />
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
                                            <span>Día {projection.days_elapsed} de {projection.month_days}</span>
                                            <span>{projection.progress_pct}% transcurrido</span>
                                        </div>
                                        <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden">
                                            <div 
                                                className="bg-indigo-400 h-full rounded-full transition-all duration-500" 
                                                style={{ width: `${projection.progress_pct}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/10 mt-5 text-xs text-slate-400 flex items-center justify-between">
                                    <span>Días restantes: <strong className="text-white">{projection.days_remaining} días</strong></span>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('proyeccion')}
                                        className="px-2.5 py-1 rounded-lg bg-indigo-500/40 hover:bg-indigo-500 text-indigo-100 hover:text-white font-semibold text-[11px] transition-colors flex items-center gap-1.5 border border-indigo-400/30"
                                    >
                                        <span>Ver Detalle por Combustible</span>
                                        <ArrowUpRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ========================================================= */}
                        {/* 4. TABS CON TABLAS DETALLADAS                             */}
                        {/* ========================================================= */}
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            <div className="flex border-b border-slate-200 bg-slate-50/70 px-6 pt-4 gap-3 overflow-x-auto">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('combustibles')}
                                    className={`px-4 py-2.5 text-xs font-bold uppercase rounded-t-xl transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                                        activeTab === 'combustibles'
                                            ? 'bg-white text-indigo-600 border-indigo-600 shadow-sm'
                                            : 'text-slate-500 border-transparent hover:text-slate-800'
                                    }`}
                                >
                                    <Fuel className="w-4 h-4" />
                                    Comparativa por Combustible
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('proyeccion')}
                                    className={`px-4 py-2.5 text-xs font-bold uppercase rounded-t-xl transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                                        activeTab === 'proyeccion'
                                            ? 'bg-white text-indigo-600 border-indigo-600 shadow-sm'
                                            : 'text-slate-500 border-transparent hover:text-slate-800'
                                    }`}
                                >
                                    <Target className="w-4 h-4" />
                                    Proyección por Combustible
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('diario')}
                                    className={`px-4 py-2.5 text-xs font-bold uppercase rounded-t-xl transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                                        activeTab === 'diario'
                                            ? 'bg-white text-indigo-600 border-indigo-600 shadow-sm'
                                            : 'text-slate-500 border-transparent hover:text-slate-800'
                                    }`}
                                >
                                    <Clock className="w-4 h-4" />
                                    Desglose Diario de Ventas
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('semanal')}
                                    className={`px-4 py-2.5 text-xs font-bold uppercase rounded-t-xl transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                                        activeTab === 'semanal'
                                            ? 'bg-white text-indigo-600 border-indigo-600 shadow-sm'
                                            : 'text-slate-500 border-transparent hover:text-slate-800'
                                    }`}
                                >
                                    <CalendarDays className="w-4 h-4" />
                                    Demanda por Día de la Semana
                                </button>
                            </div>

                            {/* Tab 1: Combustibles */}
                            {activeTab === 'combustibles' && (
                                <div>
                                    {/* Barra de contexto explicativo sobre el Período Anterior */}
                                    <div className="p-3.5 bg-slate-50/80 border-b border-slate-200 text-xs">
                                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200/60">
                                                    <span className="font-bold text-indigo-950 text-[11px] uppercase">Período Actual:</span>
                                                    <span className="font-extrabold text-indigo-700 text-xs">
                                                        {summary.period.start_date} al {summary.period.end_date}
                                                    </span>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-200/60 font-semibold text-indigo-900">
                                                        {summary.period.active_days} días
                                                    </span>
                                                </div>

                                                <span className="text-slate-400 font-bold text-xs uppercase">vs</span>

                                                <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200/60">
                                                    <span className="font-bold text-amber-950 text-[11px] uppercase">Período Anterior (Comparativa):</span>
                                                    <span className="font-extrabold text-amber-700 text-xs">
                                                        {summary.prev_period.start_date} al {summary.prev_period.end_date}
                                                    </span>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200/60 font-semibold text-amber-900">
                                                        {summary.prev_period.active_days} días
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="text-[11px] text-slate-600 flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                                                <Info className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                                <span>
                                                    <strong>Aclaración:</strong> &quot;Período Anterior&quot; representa el <u>volumen y ventas del ciclo previo comparable</u> para evaluar crecimiento comercial. <em>(No corresponde a las lecturas iniciales de los contadores).</em>
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wide border-b border-slate-200">
                                                {/* Fila 1: Grupos Principales */}
                                                <tr className="border-b border-slate-200/80">
                                                    <th rowSpan={2} className="px-3 py-2 text-left text-slate-800 bg-slate-100/70 border-r border-slate-200 font-black align-middle">
                                                        Combustible
                                                    </th>
                                                    <th colSpan={4} className="py-1 px-2 text-center bg-indigo-50/90 text-indigo-900 border-r border-slate-200 font-black">
                                                        Volumen (Galones)
                                                    </th>
                                                    <th colSpan={4} className="py-1 px-2 text-center bg-emerald-50/90 text-emerald-900 border-r border-slate-200 font-black">
                                                        Ventas ($ Dólares)
                                                    </th>
                                                    <th colSpan={2} className="py-1 px-2 text-center bg-amber-50/90 text-amber-900 border-r border-slate-200 font-black">
                                                        Precio Promedio
                                                    </th>
                                                    <th rowSpan={2} className="px-2.5 py-2 text-right text-indigo-900 bg-slate-100/70 font-black align-middle">
                                                        % Part.
                                                    </th>
                                                </tr>
                                                {/* Fila 2: Sub-columnas Compactas */}
                                                <tr className="text-[10px] bg-slate-50 border-b border-slate-200">
                                                    <th className="px-2 py-1.5 text-right text-indigo-950 font-bold whitespace-nowrap">Actual</th>
                                                    <th className="px-2 py-1.5 text-right text-slate-600 font-semibold whitespace-nowrap">Anterior</th>
                                                    <th className="px-2 py-1.5 text-right text-slate-600 font-semibold whitespace-nowrap">Dif.</th>
                                                    <th className="px-2 py-1.5 text-right text-slate-600 font-semibold border-r border-slate-200 whitespace-nowrap">% Dif.</th>
                                                    <th className="px-2 py-1.5 text-right text-emerald-950 font-bold whitespace-nowrap">Actual ($)</th>
                                                    <th className="px-2 py-1.5 text-right text-slate-600 font-semibold whitespace-nowrap">Anterior ($)</th>
                                                    <th className="px-2 py-1.5 text-right text-slate-600 font-semibold whitespace-nowrap">Dif. ($)</th>
                                                    <th className="px-2 py-1.5 text-right text-slate-600 font-semibold border-r border-slate-200 whitespace-nowrap">% Dif.</th>
                                                    <th className="px-2 py-1.5 text-right text-amber-950 font-bold whitespace-nowrap">Actual</th>
                                                    <th className="px-2 py-1.5 text-right text-slate-600 font-semibold border-r border-slate-200 whitespace-nowrap">Anterior</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {fuelComparison.map((f, i) => (
                                                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="px-3 py-2 font-bold text-slate-800 flex items-center gap-2 border-r border-slate-100 whitespace-nowrap">
                                                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${FUEL_COLORS[i % FUEL_COLORS.length].bg}`} />
                                                            {f.producto}
                                                        </td>
                                                        <td className="px-2 py-2 text-right font-bold text-slate-900">
                                                            {f.current_galones.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-2 py-2 text-right font-medium text-slate-600">
                                                            {f.prev_galones.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className={`px-2 py-2 text-right font-bold ${f.diff_galones >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {f.diff_galones >= 0 ? `+${f.diff_galones.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : f.diff_galones.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className={`px-2 py-2 text-right font-bold border-r border-slate-100 ${f.pct_galones >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {f.pct_galones >= 0 ? `+${f.pct_galones}%` : `${f.pct_galones}%`}
                                                        </td>
                                                        <td className="px-2 py-2 text-right font-bold text-slate-900">
                                                            <Money value={f.current_monto} />
                                                        </td>
                                                        <td className="px-2 py-2 text-right font-medium text-slate-600">
                                                            <Money value={f.prev_monto} />
                                                        </td>
                                                        <td className={`px-2 py-2 text-right font-bold ${f.diff_monto >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            <Money value={f.diff_monto} />
                                                        </td>
                                                        <td className={`px-2 py-2 text-right font-bold border-r border-slate-100 ${f.pct_monto >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {f.pct_monto >= 0 ? `+${f.pct_monto}%` : `${f.pct_monto}%`}
                                                        </td>
                                                        <td className="px-2 py-2 text-right font-medium text-slate-600">
                                                            <Money value={f.current_precio_prom} />
                                                        </td>
                                                        <td className="px-2 py-2 text-right font-medium text-slate-500 border-r border-slate-100">
                                                            <Money value={f.prev_precio_prom} />
                                                        </td>
                                                        <td className="px-2.5 py-2 text-right font-bold text-indigo-600">
                                                            {isVolume ? `${f.share_volume_pct}%` : `${f.share_monto_pct}%`}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200">
                                                <tr>
                                                    <td className="px-3 py-2.5 uppercase text-slate-900 border-r border-slate-200">Total Consolidado</td>
                                                    <td className="px-2 py-2.5 text-right text-slate-900 font-black">
                                                        {summary.current_totals.galones.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-2 py-2.5 text-right text-slate-600">
                                                        {summary.prev_totals.galones.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className={`px-2 py-2.5 text-right ${summary.variations.diff_galones >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {summary.variations.diff_galones >= 0 ? `+${summary.variations.diff_galones.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : summary.variations.diff_galones.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className={`px-2 py-2.5 text-right border-r border-slate-200 ${summary.variations.pct_galones >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {summary.variations.pct_galones >= 0 ? `+${summary.variations.pct_galones}%` : `${summary.variations.pct_galones}%`}
                                                    </td>
                                                    <td className="px-2 py-2.5 text-right text-slate-900 font-black">
                                                        <Money value={summary.current_totals.monto} />
                                                    </td>
                                                    <td className="px-2 py-2.5 text-right text-slate-600">
                                                        <Money value={summary.prev_totals.monto} />
                                                    </td>
                                                    <td className={`px-2 py-2.5 text-right ${summary.variations.diff_monto >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        <Money value={summary.variations.diff_monto} />
                                                    </td>
                                                    <td className={`px-2 py-2.5 text-right border-r border-slate-200 ${summary.variations.pct_monto >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {summary.variations.pct_monto >= 0 ? `+${summary.variations.pct_monto}%` : `${summary.variations.pct_monto}%`}
                                                    </td>
                                                    <td className="px-2 py-2.5 text-right text-slate-900">
                                                        <Money value={summary.current_totals.precio_promedio} />
                                                    </td>
                                                    <td className="px-2 py-2.5 text-right text-slate-600 border-r border-slate-200">
                                                        <Money value={summary.prev_totals.precio_promedio} />
                                                    </td>
                                                    <td className="px-2.5 py-2.5 text-right text-indigo-600 font-black">100.0%</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Tab Proyección: Proyección por Combustible */}
                            {activeTab === 'proyeccion' && (
                                <div>
                                    {/* Barra de contexto explicativo sobre la proyección */}
                                    <div className="p-3.5 bg-slate-50/80 border-b border-slate-200 text-xs">
                                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200/60">
                                                    <span className="font-bold text-indigo-950 text-[11px] uppercase">Mes Proyectado:</span>
                                                    <span className="font-extrabold text-indigo-700 text-xs capitalize">
                                                        {projection.month_name}
                                                    </span>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-200/60 font-semibold text-indigo-900">
                                                        Día {projection.days_elapsed} de {projection.month_days} ({projection.progress_pct}%)
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/60">
                                                    <span className="font-bold text-emerald-950 text-[11px] uppercase">Días Restantes a Proyectar:</span>
                                                    <span className="font-extrabold text-emerald-700 text-xs">
                                                        {projection.days_remaining} días
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200/60">
                                                    <span className="font-bold text-purple-950 text-[11px] uppercase">Base de Cálculo:</span>
                                                    <span className="font-extrabold text-purple-700 text-xs">
                                                        {summary.period.active_days} días con ventas registradas
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="text-[11px] text-slate-600 flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                                                <Info className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                                <span>
                                                    <strong>Fórmula:</strong> Proyección = Real acumulado + (Ritmo diario &times; {projection.days_remaining} días restantes)
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wide border-b border-slate-200">
                                                <tr className="border-b border-slate-200/80">
                                                    <th rowSpan={2} className="px-3 py-2 text-left text-slate-800 bg-slate-100/70 border-r border-slate-200 font-black align-middle">
                                                        Combustible
                                                    </th>
                                                    <th colSpan={3} className="py-1 px-2 text-center bg-indigo-50/90 text-indigo-900 border-r border-slate-200 font-black">
                                                        Volumen de Galones
                                                    </th>
                                                    <th colSpan={3} className="py-1 px-2 text-center bg-emerald-50/90 text-emerald-900 border-r border-slate-200 font-black">
                                                        Ventas en Dólares ($)
                                                    </th>
                                                    <th rowSpan={2} className="px-3 py-2 text-right text-indigo-900 bg-slate-100/70 font-black align-middle">
                                                        % Cuota Est.
                                                    </th>
                                                </tr>
                                                <tr className="text-[10px] bg-slate-50 border-b border-slate-200">
                                                    <th className="px-3 py-1.5 text-right text-slate-700 font-semibold whitespace-nowrap">Actual Acumulado</th>
                                                    <th className="px-3 py-1.5 text-right text-slate-600 font-semibold whitespace-nowrap">Ritmo Diario</th>
                                                    <th className="px-3 py-1.5 text-right text-indigo-950 font-black border-r border-slate-200 whitespace-nowrap bg-indigo-50/40">Proyectado Cierre</th>
                                                    <th className="px-3 py-1.5 text-right text-slate-700 font-semibold whitespace-nowrap">Actual Acumulado ($)</th>
                                                    <th className="px-3 py-1.5 text-right text-slate-600 font-semibold whitespace-nowrap">Ritmo Diario ($)</th>
                                                    <th className="px-3 py-1.5 text-right text-emerald-950 font-black border-r border-slate-200 whitespace-nowrap bg-emerald-50/40">Proyectado Cierre ($)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {(projection.by_product || []).map((p, i) => {
                                                    const shareGalones = projection.projected_galones > 0
                                                        ? ((p.projected_galones / projection.projected_galones) * 100).toFixed(1)
                                                        : '0.0';
                                                    return (
                                                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                                                            <td className="px-3 py-2.5 font-bold text-slate-800 flex items-center gap-2 border-r border-slate-100 whitespace-nowrap">
                                                                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${FUEL_COLORS[i % FUEL_COLORS.length].bg}`} />
                                                                {p.producto}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right font-medium text-slate-800">
                                                                {p.current_galones.toLocaleString('en-US', { minimumFractionDigits: 2 })} gln
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right text-slate-500 font-medium">
                                                                {p.daily_rate_galones.toLocaleString('en-US', { minimumFractionDigits: 2 })} gln/día
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right font-black text-indigo-700 bg-indigo-50/30 border-r border-slate-100">
                                                                {p.projected_galones.toLocaleString('en-US', { minimumFractionDigits: 2 })} gln
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right font-medium text-slate-800">
                                                                <Money value={p.current_monto} />
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right text-slate-500 font-medium">
                                                                <Money value={p.daily_rate_monto} />
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right font-black text-emerald-700 bg-emerald-50/30 border-r border-slate-100">
                                                                <Money value={p.projected_monto} />
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right font-bold text-indigo-600">
                                                                {shareGalones}%
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200">
                                                <tr>
                                                    <td className="px-3 py-2.5 uppercase text-slate-900 border-r border-slate-200">Total Proyectado</td>
                                                    <td className="px-3 py-2.5 text-right text-slate-900 font-bold">
                                                        {projection.current_galones.toLocaleString('en-US', { minimumFractionDigits: 2 })} gln
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right text-slate-600 font-bold">
                                                        {projection.daily_rate_galones.toLocaleString('en-US', { minimumFractionDigits: 2 })} gln/día
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right text-indigo-900 font-black bg-indigo-50/50 border-r border-slate-200">
                                                        {projection.projected_galones.toLocaleString('en-US', { minimumFractionDigits: 2 })} gln
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right text-slate-900 font-bold">
                                                        <Money value={projection.current_monto} />
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right text-slate-600 font-bold">
                                                        <Money value={projection.daily_rate_monto} />
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right text-emerald-900 font-black bg-emerald-50/50 border-r border-slate-200">
                                                        <Money value={projection.projected_monto} />
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right text-indigo-600 font-black">100.0%</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Tab 2: Desglose Diario */}
                            {activeTab === 'diario' && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                                            <tr>
                                                <th className="px-5 py-3.5">Fecha</th>
                                                <th className="px-4 py-3.5">Día</th>
                                                <th className="px-4 py-3.5 text-right">Galones Despachados</th>
                                                <th className="px-4 py-3.5 text-right">Venta Total ($)</th>
                                                <th className="px-4 py-3.5 text-right">Precio Prom. ($/gln)</th>
                                                <th className="px-5 py-3.5">Desglose por Combustible</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {dailySeries.map((d, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="px-5 py-3 font-bold text-slate-800">{d.fecha}</td>
                                                    <td className="px-4 py-3 text-slate-600 font-medium">{d.dia_semana}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                                                        {d.total_galones.toLocaleString('en-US', { minimumFractionDigits: 2 })} gln
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-emerald-600">
                                                        <Money value={d.total_monto} />
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-medium text-slate-600">
                                                        <Money value={d.precio_promedio} />
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {Object.entries(d.fuels || {}).map(([pName, pInfo]) => (
                                                                <span key={pName} className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] border border-slate-200/60">
                                                                    {pName}: <strong className="text-slate-800">{pInfo.galones} gln</strong>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Tab 3: Demanda Semanal */}
                            {activeTab === 'semanal' && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                                            <tr>
                                                <th className="px-5 py-3.5">Día de la Semana</th>
                                                <th className="px-4 py-3.5 text-center">Días Registrados</th>
                                                <th className="px-4 py-3.5 text-right">Galones Totales</th>
                                                <th className="px-4 py-3.5 text-right">Promedio Diario Galones</th>
                                                <th className="px-4 py-3.5 text-right">Ventas Totales ($)</th>
                                                <th className="px-4 py-3.5 text-right">Promedio Diario Ventas ($)</th>
                                                <th className="px-5 py-3.5 text-center">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {weeklyPatterns.map((w, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="px-5 py-3 font-bold text-slate-800">{w.name}</td>
                                                    <td className="px-4 py-3 text-center text-slate-600 font-medium">{w.dias_ocurrencia}</td>
                                                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                                                        {w.galones_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-indigo-700">
                                                        {w.galones_promedio.toLocaleString('en-US', { minimumFractionDigits: 2 })} gln
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                                                        <Money value={w.monto_total} />
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-emerald-700">
                                                        <Money value={w.monto_promedio} />
                                                    </td>
                                                    <td className="px-5 py-3 text-center">
                                                        {w.is_peak_galones || w.is_peak_monto ? (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                                ★ DÍA PICO
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs">Normal</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
                        <Fuel className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-slate-800 mb-1">Sin datos para el período seleccionado</h3>
                        <p className="text-xs text-slate-400">Intenta cambiar el rango de fechas o seleccionar otra sucursal.</p>
                    </div>
                )}
            </div>

            {/* ========================================================= */}
            {/* MODAL INTERACTIVO PARA VISUALIZAR REPORTE EN PDF         */}
            {/* ========================================================= */}
            <PdfViewerModal
                isOpen={isPdfModalOpen}
                onClose={() => setIsPdfModalOpen(false)}
                title="Análisis de Ventas, Proyección y Comparativo"
                subtitle={`Período: ${filters.start_date} al ${filters.end_date} • ${selectedBranchName}`}
                badge="Lecturas Oficiales"
                pdfUrl={pdfUrl}
                isLoading={isPdfLoading}
                loadingText="Generando reporte en formato contable oficial..."
                fileName={`Ventas_Analiticas_Lecturas_${filters.start_date}_al_${filters.end_date}.pdf`}
                footerNote="Formato contable estándar oficial • Presentación Carta Horizontal sin firmas"
            />
        </div>
    );
}
