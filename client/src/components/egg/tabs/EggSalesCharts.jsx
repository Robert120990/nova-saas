import { useState, useMemo } from 'react';
import { BarChart3, LineChart, PieChart, Egg, DollarSign, Scale, Eye, EyeOff, X } from 'lucide-react';
import Money from '../../ui/Money';
import EggLiquidGauge from './EggLiquidGauge';
import EggSalesLineChart from './EggSalesLineChart';

const CHART_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
    '#0ea5e9', '#f97316', '#14b8a6', '#a855f7', '#06b6d4',
    '#e11d48', '#84cc16'
];

export default function EggSalesCharts({ items = [], isProduct = true, summary = {}, onClose }) {
    const [chartType, setChartType] = useState(() => (isProduct ? 'bar' : 'bar'));
    const [metric, setMetric] = useState('amount'); // 'amount' | 'volume'
    const [isOpen, setIsOpen] = useState(true);
    const [hoverIndex, setHoverIndex] = useState(null);

    const dataRows = Array.isArray(items) ? items : [];

    // Preparar dataset clasificado y ordenado
    const chartData = useMemo(() => {
        return dataRows.map((r, idx) => {
            const name = isProduct ? r.product_name : (r.customer_name || 'Cliente');
            const amount = Number(r.total_amount || 0);
            const volume = Number(r.is_shell ? (r.boxes || r.units || 0) : (r.total_lbs || 0));
            const value = metric === 'amount' ? amount : volume;
            const unitLabel = metric === 'amount' ? '$' : (r.is_shell ? 'Unid/Caj' : 'Lb');
            return {
                id: idx,
                name,
                raw: r,
                amount,
                volume,
                value,
                unitLabel,
                color: CHART_COLORS[idx % CHART_COLORS.length]
            };
        }).sort((a, b) => b.value - a.value);
    }, [dataRows, isProduct, metric]);

    const totalMetricValue = useMemo(() => {
        return chartData.reduce((s, d) => s + (d.value > 0 ? d.value : 0), 0);
    }, [chartData]);

    const maxVal = Math.max(...chartData.map(d => d.value), 1);

    if (!dataRows.length) return null;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
            {/* Barra Superior de Control de Gráficos */}
            <div className="p-3 sm:p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-indigo-600 transition-colors"
                        title={isOpen ? 'Ocultar sección de gráficos' : 'Mostrar sección de gráficos'}
                    >
                        {isOpen ? <EyeOff className="w-4 h-4 text-slate-500" /> : <Eye className="w-4 h-4 text-indigo-600" />}
                        <span className="uppercase tracking-wider text-[11px]">
                            {isOpen ? 'Ocultar Gráficos' : 'Mostrar Gráficos'}
                        </span>
                    </button>
                    <span className="hidden sm:inline-block text-slate-300">•</span>
                    <span className="text-xs text-slate-500 hidden sm:inline-block">
                        Visualización gráfica de {isProduct ? 'ovoproductos' : 'clientes'}
                    </span>
                </div>

                {isOpen && (
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        {/* Selector de Tipo de Gráfica */}
                        <div className="flex bg-slate-200/80 p-0.5 rounded-xl text-xs font-bold">
                            <button
                                type="button"
                                onClick={() => setChartType('bar')}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                                    chartType === 'bar' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                                title="Gráfico de Barras"
                            >
                                <BarChart3 className="w-3.5 h-3.5" />
                                <span>Barra</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setChartType('line')}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                                    chartType === 'line' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                                title="Gráfico Lineal de Distribución"
                            >
                                <LineChart className="w-3.5 h-3.5" />
                                <span>Lineal</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setChartType('pie')}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                                    chartType === 'pie' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                                title="Gráfico Circular (Donut)"
                            >
                                <PieChart className="w-3.5 h-3.5" />
                                <span>Circular</span>
                            </button>

                            {/* Opción Exclusiva en Producto: Forma de Huevo Líquido */}
                            {isProduct && (
                                <button
                                    type="button"
                                    onClick={() => setChartType('egg')}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                                        chartType === 'egg'
                                            ? 'bg-amber-600 text-white shadow-2xs'
                                            : 'text-amber-800 hover:text-amber-950 font-bold'
                                    }`}
                                    title="Visualización Temática en Silueta de Huevo con Líquido"
                                >
                                    <Egg className="w-3.5 h-3.5" />
                                    <span>Huevo Líquido</span>
                                </button>
                            )}
                        </div>

                        {/* Selector de Métrica (Monto vs Volumen) */}
                        {chartType !== 'egg' && (
                            <div className="flex bg-slate-200/80 p-0.5 rounded-xl text-xs font-bold ml-auto sm:ml-0">
                                <button
                                    type="button"
                                    onClick={() => setMetric('amount')}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                                        metric === 'amount' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                    title="Medir por Monto Facturado en Dólares"
                                >
                                    <DollarSign className="w-3 h-3 text-emerald-600" />
                                    <span>Monto ($)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMetric('volume')}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                                        metric === 'volume' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                    title="Medir por Volumen en Libras / Unidades"
                                >
                                    <Scale className="w-3 h-3 text-indigo-600" />
                                    <span>Volumen (Lb)</span>
                                </button>
                            </div>
                        )}

                        {onClose && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors ml-auto sm:ml-1"
                                title="Ocultar panel de gráficas"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Contenido Visual del Gráfico */}
            {isOpen && (
                <div className="p-4 sm:p-5">
                    {/* CASO 1: HUEVO LÍQUIDO */}
                    {chartType === 'egg' && isProduct && (
                        <EggLiquidGauge items={dataRows} summary={summary} />
                    )}

                    {/* CASO 2: GRÁFICO DE BARRAS INTERACTIVO */}
                    {chartType === 'bar' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider pb-1 border-b border-slate-100">
                                <span>{isProduct ? 'Producto / Ovoproducto' : 'Cliente'}</span>
                                <div className="flex items-center gap-6">
                                    <span>{metric === 'amount' ? 'Monto Facturado ($)' : 'Volumen'}</span>
                                    <span className="w-12 text-right">% Total</span>
                                </div>
                            </div>
                            <div className="space-y-2.5">
                                {chartData.slice(0, 10).map((item, idx) => {
                                    const pct = totalMetricValue > 0 ? (item.value / totalMetricValue) * 100 : 0;
                                    const barWidth = maxVal > 0 ? Math.max(3, (item.value / maxVal) * 100) : 0;
                                    const isHovered = hoverIndex === idx;

                                    return (
                                        <div
                                            key={item.id}
                                            className={`p-2 rounded-xl transition-all ${
                                                isHovered ? 'bg-indigo-50/50' : 'hover:bg-slate-50'
                                            }`}
                                            onMouseEnter={() => setHoverIndex(idx)}
                                            onMouseLeave={() => setHoverIndex(null)}
                                        >
                                            <div className="flex items-center justify-between text-xs mb-1.5">
                                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                                    <span className="w-5 text-[11px] font-bold text-slate-400">#{idx + 1}</span>
                                                    <span className="font-bold text-slate-800 truncate" title={item.name}>
                                                        {item.name}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-6 shrink-0 tabular-nums">
                                                    <span className="font-bold text-slate-900">
                                                        {metric === 'amount' ? (
                                                            <Money value={item.amount} />
                                                        ) : (
                                                            <>{Number(item.volume).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-[10px] text-slate-400 font-normal">{item.unitLabel}</span></>
                                                        )}
                                                    </span>
                                                    <span className="w-12 text-right text-xs font-semibold text-slate-500">
                                                        {pct.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Barra de progreso con gradiente y animación suave */}
                                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-500"
                                                    style={{
                                                        width: `${barWidth}%`,
                                                        backgroundColor: item.color
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* CASO 3: GRÁFICO LINEAL DE DISTRIBUCIÓN */}
                    {chartType === 'line' && (
                        <EggSalesLineChart
                            chartData={chartData}
                            maxVal={maxVal}
                            metric={metric}
                            hoverIndex={hoverIndex}
                            setHoverIndex={setHoverIndex}
                        />
                    )}

                    {/* CASO 4: GRÁFICO CIRCULAR (DONUT) */}
                    {chartType === 'pie' && (
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                            {/* Donut SVG Central */}
                            <div className="md:col-span-5 flex items-center justify-center relative">
                                <div className="relative w-56 h-56 flex items-center justify-center">
                                    <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                                        {(() => {
                                            const circumference = 2 * Math.PI * 68; // Radio 68
                                            let accumulatedOffset = 0;
                                            return chartData.slice(0, 8).map((d) => {
                                                const pct = totalMetricValue > 0 ? (d.value / totalMetricValue) : 0;
                                                const strokeDash = pct * circumference;
                                                const offset = accumulatedOffset;
                                                accumulatedOffset += strokeDash;

                                                return (
                                                    <circle
                                                        key={d.id}
                                                        cx="100"
                                                        cy="100"
                                                        r="68"
                                                        fill="none"
                                                        stroke={d.color}
                                                        strokeWidth="24"
                                                        strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
                                                        strokeDashoffset={-offset}
                                                        className="transition-all duration-500 hover:opacity-85"
                                                    />
                                                );
                                            });
                                        })()}
                                    </svg>
                                    {/* Centro del Donut */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 pointer-events-none">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            {metric === 'amount' ? 'Total Facturado' : 'Total Volumen'}
                                        </span>
                                        <span className="text-base font-black text-slate-900 tabular-nums">
                                            {metric === 'amount' ? (
                                                <Money value={totalMetricValue} />
                                            ) : (
                                                `${Number(totalMetricValue).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lb`
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Leyenda Detallada */}
                            <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                {chartData.slice(0, 8).map((d) => {
                                    const pct = totalMetricValue > 0 ? (d.value / totalMetricValue) * 100 : 0;
                                    return (
                                        <div
                                            key={d.id}
                                            className="p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 flex items-center justify-between gap-2"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                                                <span className="font-bold text-slate-700 truncate" title={d.name}>
                                                    {d.name}
                                                </span>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="font-black text-slate-900 block tabular-nums">
                                                    {pct.toFixed(1)}%
                                                </span>
                                                <span className="text-[10px] text-slate-400 tabular-nums">
                                                    {metric === 'amount' ? <Money value={d.amount} /> : `${d.volume.toFixed(1)} Lb`}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
