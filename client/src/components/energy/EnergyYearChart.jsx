import { useState } from 'react';
import { CalendarRange, Trophy } from 'lucide-react';
import Money from '../ui/Money';

export default function EnergyYearChart({ yearData, selectedYear, selectedPlantName }) {
    const monthlyPoints = yearData?.monthlyPoints || [];
    const summary = yearData?.summary || {};
    const [hoveredMonth, setHoveredMonth] = useState(null);

    const maxKwh = Math.max(...monthlyPoints.map(p => p.solarKwh), 1000);
    const chartHeight = 220;
    const chartWidth = 900;
    const numMonths = 12;
    const barWidth = 42;
    const gap = (chartWidth - barWidth * numMonths) / (numMonths + 1);

    const bestMonthNum = summary.bestMonth?.month;

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            {/* Header del gráfico */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
                        <CalendarRange className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            Generación Solar Mensual del Año ({selectedYear})
                        </h3>
                        <p className="text-xs text-slate-500">
                            Planta: <strong>{selectedPlantName || 'Todas'}</strong> &bull; Total Anual: <strong>{summary.totalSolarMwh?.toFixed(1)} MWh</strong> ({summary.totalSolarKwh?.toLocaleString('en-US')} kWh)
                        </p>
                    </div>
                </div>

                {/* Badge de mejor mes */}
                {summary.bestMonth && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        <span>Mes Récord: <strong>{summary.bestMonth.name}</strong> ({summary.bestMonth.kwh.toLocaleString('en-US')} kWh)</span>
                    </div>
                )}
            </div>

            {/* Gráfico de Barras SVG Anual */}
            <div className="relative overflow-x-auto">
                <div className="min-w-[700px]">
                    <svg 
                        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                        className="w-full h-60 overflow-visible"
                        onMouseLeave={() => setHoveredMonth(null)}
                    >
                        <defs>
                            <linearGradient id="yearBarGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.9" />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.6" />
                            </linearGradient>
                            <linearGradient id="yearBarBest" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f59e0b" stopOpacity="1" />
                                <stop offset="100%" stopColor="#d97706" stopOpacity="0.8" />
                            </linearGradient>
                            <linearGradient id="yearBarHover" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#a78bfa" stopOpacity="1" />
                                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.9" />
                            </linearGradient>
                        </defs>

                        {/* Líneas guía horizontales (MWh) */}
                        {[0.25, 0.5, 0.75, 1].map((pct, idx) => {
                            const y = chartHeight - pct * (chartHeight - 40) - 20;
                            const mwhVal = ((maxKwh * pct) / 1000).toFixed(1);
                            return (
                                <g key={idx}>
                                    <line 
                                        x1="0" 
                                        y1={y} 
                                        x2={chartWidth} 
                                        y2={y} 
                                        stroke="#cbd5e1" 
                                        strokeDasharray="2 4" 
                                        strokeOpacity="0.4"
                                    />
                                    <text 
                                        x="4" 
                                        y={y - 3} 
                                        fill="#94a3b8" 
                                        fontSize="9" 
                                        fontFamily="sans-serif"
                                    >
                                        {mwhVal} MWh
                                    </text>
                                </g>
                            );
                        })}

                        {/* Barras por mes */}
                        {monthlyPoints.map((pt, i) => {
                            const x = gap + i * (barWidth + gap);
                            const h = pt.solarKwh > 0 ? (pt.solarKwh / maxKwh) * (chartHeight - 40) : 0;
                            const y = chartHeight - h - 20;
                            const isHovered = hoveredMonth?.month === pt.month;
                            const isBest = pt.month === bestMonthNum && pt.solarKwh > 0;

                            return (
                                <g key={pt.month} className="cursor-pointer" onMouseEnter={() => setHoveredMonth(pt)}>
                                    {/* Barra invisible de impacto táctil */}
                                    <rect 
                                        x={x - gap / 2} 
                                        y="0" 
                                        width={barWidth + gap} 
                                        height={chartHeight} 
                                        fill="transparent"
                                    />
                                    {/* Barra visual */}
                                    <rect 
                                        x={x} 
                                        y={y} 
                                        width={barWidth} 
                                        height={Math.max(h, 2)} 
                                        rx="4"
                                        fill={isHovered ? 'url(#yearBarHover)' : (isBest ? 'url(#yearBarBest)' : 'url(#yearBarGradient)')}
                                        className="transition-all duration-150"
                                    />
                                    {/* Indicador de valor sobre la barra */}
                                    {pt.solarKwh > 0 && (
                                        <text 
                                            x={x + barWidth / 2} 
                                            y={Math.max(y - 5, 12)} 
                                            textAnchor="middle" 
                                            fill="#64748b" 
                                            fontSize="9" 
                                            fontWeight="bold"
                                        >
                                            {pt.solarMwh.toFixed(1)} MWh
                                        </text>
                                    )}
                                    {/* Nombre de mes */}
                                    <text 
                                        x={x + barWidth / 2} 
                                        y={chartHeight - 4} 
                                        textAnchor="middle" 
                                        fill={isHovered ? '#8b5cf6' : (isBest ? '#f59e0b' : '#64748b')} 
                                        fontSize="10" 
                                        fontWeight={isHovered || isBest ? 'bold' : 'normal'}
                                    >
                                        {pt.shortName}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>

                    {/* Tooltip flotante */}
                    {hoveredMonth && (
                        <div className="mt-3 p-3 bg-slate-800 text-white rounded-xl shadow-lg border border-slate-700 flex flex-wrap items-center justify-between gap-4 text-xs animate-fade-in">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                                <span>Mes: <strong>{hoveredMonth.name} ({selectedYear})</strong></span>
                            </div>
                            <div>
                                Generación Total: <strong className="text-purple-400 text-sm font-black">{hoveredMonth.solarMwh.toFixed(2)} MWh</strong> <span className="text-slate-400">({hoveredMonth.solarKwh.toLocaleString('en-US')} kWh)</span>
                            </div>
                            <div className="flex items-center gap-1">
                                Ahorro Estimado: <strong className="text-emerald-400 font-bold"><Money amount={hoveredMonth.savingsUsd} /></strong>
                            </div>
                            {hoveredMonth.plantValues && (
                                <div className="text-slate-400 text-[11px] flex gap-3">
                                    {Object.entries(hoveredMonth.plantValues).map(([pid, val]) => (
                                        <span key={pid}>
                                            {pid === '2410077' ? 'Andelsa' : (pid === '2604519' ? 'Puma' : `Planta ${pid}`)}: <strong className="text-slate-200">{(val / 1000).toFixed(2)} MWh</strong>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
