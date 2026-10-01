import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
    Calendar, 
    CalendarDays, 
    CalendarRange, 
    ChevronLeft, 
    ChevronRight, 
    RefreshCw, 
    Layers
} from 'lucide-react';
import { getTodayString, formatDate } from '../../utils/dateUtils';
import EnergyDayChart from './EnergyDayChart';
import EnergyMonthChart from './EnergyMonthChart';
import EnergyYearChart from './EnergyYearChart';
import EnergyAnalyticsDataTable from './EnergyAnalyticsDataTable';
import EnergyAnalyticsCards from './EnergyAnalyticsCards';

export default function EnergyAnalyticsSection({ companyHeaders }) {
    const today = getTodayString();
    const currentMonth = today.slice(0, 7);
    const currentYear = today.slice(0, 4);

    const [period, setPeriod] = useState('day'); // 'day' | 'month' | 'year'
    const [selectedDate, setSelectedDate] = useState(today);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedPlant, setSelectedPlant] = useState('all');

    const [loading, setLoading] = useState(false);
    const [analyticsData, setAnalyticsData] = useState(null);
    const [showTable, setShowTable] = useState(false);

    // Cargar analítica según período seleccionado
    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const params = {
                period,
                plantId: selectedPlant,
                ...(period === 'day' ? { date: selectedDate } : {}),
                ...(period === 'month' ? { month: selectedMonth } : {}),
                ...(period === 'year' ? { year: selectedYear } : {})
            };
            const res = await axios.get('/api/energy/analytics', {
                params,
                headers: companyHeaders
            });
            if (res.data?.data) {
                setAnalyticsData(res.data.data);
            }
        } catch (err) {
            toast.error('Error al cargar analítica: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [period, selectedDate, selectedMonth, selectedYear, selectedPlant, companyHeaders?.['x-company-id']]);

    useEffect(() => {
        setAnalyticsData(null);
        setSelectedPlant('all');
    }, [companyHeaders?.['x-company-id']]);

    // Navegación temporal
    const handlePrev = () => {
        if (period === 'day') {
            const d = new Date(selectedDate + 'T12:00:00');
            d.setDate(d.getDate() - 1);
            setSelectedDate(d.toISOString().slice(0, 10));
        } else if (period === 'month') {
            const [y, m] = selectedMonth.split('-').map(Number);
            const prev = new Date(y, m - 2, 1);
            const py = prev.getFullYear();
            const pm = String(prev.getMonth() + 1).padStart(2, '0');
            setSelectedMonth(`${py}-${pm}`);
        } else if (period === 'year') {
            setSelectedYear(String(parseInt(selectedYear, 10) - 1));
        }
    };

    const handleNext = () => {
        if (period === 'day') {
            if (selectedDate >= today) return;
            const d = new Date(selectedDate + 'T12:00:00');
            d.setDate(d.getDate() + 1);
            setSelectedDate(d.toISOString().slice(0, 10));
        } else if (period === 'month') {
            if (selectedMonth >= currentMonth) return;
            const [y, m] = selectedMonth.split('-').map(Number);
            const next = new Date(y, m, 1);
            const ny = next.getFullYear();
            const nm = String(next.getMonth() + 1).padStart(2, '0');
            setSelectedMonth(`${ny}-${nm}`);
        } else if (period === 'year') {
            if (selectedYear >= currentYear) return;
            setSelectedYear(String(parseInt(selectedYear, 10) + 1));
        }
    };

    const handleResetCurrent = () => {
        if (period === 'day') setSelectedDate(today);
        else if (period === 'month') setSelectedMonth(currentMonth);
        else if (period === 'year') setSelectedYear(currentYear);
    };

    const isCurrent = (period === 'day' && selectedDate === today) ||
                      (period === 'month' && selectedMonth === currentMonth) ||
                      (period === 'year' && selectedYear === currentYear);

    const summary = analyticsData?.summary || {};
    const availablePlants = analyticsData?.availablePlants || [];
    const currentPlantObj = availablePlants.find(p => String(p.id) === String(selectedPlant));
    const plantName = currentPlantObj 
        ? currentPlantObj.name 
        : (availablePlants.length === 1 
            ? availablePlants[0].name 
            : (selectedPlant === 'all' ? 'Todas las Plantas' : `Planta ${selectedPlant}`));

    return (
        <div className="space-y-6">
            {/* Barra de Filtros y Control de Período */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Selector de Modo (Día / Mes / Año) */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button
                        onClick={() => setPeriod('day')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            period === 'day'
                                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                    >
                        <Calendar className="w-3.5 h-3.5" />
                        Día
                    </button>
                    <button
                        onClick={() => setPeriod('month')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            period === 'month'
                                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                    >
                        <CalendarDays className="w-3.5 h-3.5" />
                        Mes
                    </button>
                    <button
                        onClick={() => setPeriod('year')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            period === 'year'
                                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                    >
                        <CalendarRange className="w-3.5 h-3.5" />
                        Año
                    </button>
                </div>

                {/* Navegación de Fecha / Mes / Año */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={handlePrev}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Período anterior"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    {period === 'day' && (
                        <input
                            type="date"
                            value={selectedDate}
                            max={today}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                        />
                    )}

                    {period === 'month' && (
                        <input
                            type="month"
                            value={selectedMonth}
                            max={currentMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                        />
                    )}

                    {period === 'year' && (
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                        >
                            {[2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    )}

                    <button
                        onClick={handleNext}
                        disabled={isCurrent}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Período siguiente"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>

                    {!isCurrent && (
                        <button
                            onClick={handleResetCurrent}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                        >
                            {period === 'day' ? 'Hoy' : (period === 'month' ? 'Mes Actual' : 'Año Actual')}
                        </button>
                    )}
                </div>

                {/* Selector de Planta y Refrescar */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        {availablePlants.length > 1 ? (
                            <select
                                value={selectedPlant}
                                onChange={(e) => setSelectedPlant(e.target.value)}
                                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                            >
                                <option value="all">Todas las Plantas</option>
                                {availablePlants.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        ) : (
                            <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {availablePlants[0]?.name || plantName}
                            </span>
                        )}
                    </div>

                    <button
                        onClick={fetchAnalytics}
                        disabled={loading}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Refrescar datos analíticos"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
                    </button>
                </div>
            </div>

            {loading && !analyticsData ? (
                <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                    <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Cargando analítica energética...
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                        Sincronizando curvas de telemetría de la localidad seleccionada.
                    </p>
                </div>
            ) : (
                <>
                    {/* KPI Cards del Período Seleccionado */}
                    <EnergyAnalyticsCards period={period} summary={summary} />

                    {/* Gráfico Principal del Período */}
                    {period === 'day' && (
                        <EnergyDayChart 
                            curvePoints={analyticsData?.curvePoints}
                            title={`Curva de Generación Solar y Aporte BESS (${formatDate(selectedDate)})`}
                            selectedPlantName={plantName}
                            hasBatteries={analyticsData?.hasBatteries}
                            summary={summary}
                        />
                    )}

                    {period === 'month' && (
                        <EnergyMonthChart 
                            monthData={analyticsData}
                            selectedMonth={selectedMonth}
                            selectedPlantName={plantName}
                        />
                    )}

                    {period === 'year' && (
                        <EnergyYearChart 
                            yearData={analyticsData}
                            selectedYear={selectedYear}
                            selectedPlantName={plantName}
                        />
                    )}

                    {/* Tabla Detallada Plegable */}
                    <EnergyAnalyticsDataTable 
                        period={period}
                        analyticsData={analyticsData}
                        showTable={showTable}
                        onToggleTable={() => setShowTable(!showTable)}
                    />
                </>
            )}
        </div>
    );
}
