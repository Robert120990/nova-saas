import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import Money from '../ui/Money';

export default function EnergyMonthChart({ monthData, selectedMonth, selectedPlantName }) {
    const dailyPoints = monthData?.dailyPoints || [];
    const summary = monthData?.summary || {};
    const [hoveredDay, setHoveredDay] = useState(null);

    const maxKwh = Math.max(...dailyPoints.map(p => p.solarKwh), 100);
    const avgKwh = summary.avgDailySolarKwh || 0;
    const chartHeight = 220;
    const chartWidth = 900;
    const numDays = dailyPoints.length || 30;
    const barWidth = Math.max(chartWidth / (numDays * 1.5), 14);
    const gap = (chartWidth - barWidth * numDays) / (numDays + 1);

    // Línea de promedio Y
    const avgY = chartHeight - (avgKwh / maxKwh) * (chartHeight - 40) - 20;

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            {/* Header del gráfico */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        <CalendarDays className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            Generación Solar Diaria del Mes ({selectedMonth})
                        </h3>
                        <p className="text-xs text-slate-500">
                            Planta: <strong>{selectedPlantName || 'Todas'}</strong> &bull; Promedio: <strong>{avgKwh.toFixed(1)} kWh/día</strong> &bull; Total Mes: <strong>{summary.totalSolarKwh?.toLocaleString('en-US')} kWh</strong>
                        </p>
                    </div>
                </div>

                {/* Leyenda */}
                <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-gradient-to-t from-amber-600 to-amber-400 inline-block" />
                        <span className="text-slate-600 dark:text-slate-300 font-medium">Generación Diaria (kWh)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-4 h-0.5 border-t-2 border-dashed border-sky-500 inline-block" />
                        <span className="text-sky-600 dark:text-sky-400 font-medium">Promedio Diario</span>
                    </div>
                </div>
            </div>

            {/* Gráfico de Barras SVG */}
            <div className="relative overflow-x-auto">
                <div className="min-w-[700px]">
                    <svg 
                        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                        className="w-full h-60 overflow-visible"
                        onMouseLeave={() => setHoveredDay(null)}
                    >
                        <defs>
                            <linearGradient id="monthBarGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
                                <stop offset="100%" stopColor="#d97706" stopOpacity="0.6" />
                            </linearGradient>
                            <linearGradient id="monthBarHover" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#fbbf24" stopOpacity="1" />
                                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.9" />
                            </linearGradient>
                        </defs>

                        {/* Líneas guía horizontales */}
                        {[0.25, 0.5, 0.75, 1].map((pct, idx) => {
                            const y = chartHeight - pct * (chartHeight - 40) - 20;
                            const val = (maxKwh * pct).toFixed(0);
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
                                        {val} kWh
                                    </text>
                                </g>
                            );
                        })}

                        {/* Línea de promedio */}
                        {avgKwh > 0 && (
                            <line 
                                x1="0" 
                                y1={avgY} 
                                x2={chartWidth} 
                                y2={avgY} 
                                stroke="#0284c7" 
                                strokeDasharray="4 4" 
                                strokeWidth="1.5"
                            />
                        )}

                        {/* Barras por día */}
                        {dailyPoints.map((pt, i) => {
                            const x = gap + i * (barWidth + gap);
                            const h = pt.solarKwh > 0 ? (pt.solarKwh / maxKwh) * (chartHeight - 40) : 0;
                            const y = chartHeight - h - 20;
                            const isHovered = hoveredDay?.day === pt.day;

                            return (
                                <g key={pt.day} className="cursor-pointer" onMouseEnter={() => setHoveredDay(pt)}>
                                    {/* Barra de impacto interactiva invisible */}
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
                                        rx="3"
                                        fill={isHovered ? 'url(#monthBarHover)' : 'url(#monthBarGradient)'}
                                        className="transition-all duration-150"
                                    />
                                    {/* Etiqueta de día */}
                                    <text 
                                        x={x + barWidth / 2} 
                                        y={chartHeight - 4} 
                                        textAnchor="middle" 
                                        fill={isHovered ? '#f59e0b' : '#64748b'} 
                                        fontSize="9" 
                                        fontWeight={isHovered ? 'bold' : 'normal'}
                                    >
                                        {pt.day}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>

                    {/* Tooltip flotante */}
                    {hoveredDay && (
                        <div className="mt-3 p-3 bg-slate-800 text-white rounded-xl shadow-lg border border-slate-700 flex flex-wrap items-center justify-between gap-4 text-xs animate-fade-in">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                <span>Fecha: <strong>{formatDate(hoveredDay.date)} (Día {hoveredDay.day})</strong></span>
                            </div>
                            <div>
                                Generación Solar: <strong className="text-amber-400 text-sm font-black">{hoveredDay.solarKwh.toFixed(1)} kWh</strong>
                            </div>
                            <div className="flex items-center gap-1">
                                Ahorro Estimado: <strong className="text-emerald-400 font-bold"><Money amount={hoveredDay.savingsUsd} /></strong>
                            </div>
                            {hoveredDay.plantValues && (
                                <div className="text-slate-400 text-[11px] flex gap-3">
                                    {Object.entries(hoveredDay.plantValues).map(([pid, val]) => (
                                        <span key={pid}>
                                            {pid === '2410077' ? 'Andelsa' : (pid === '2604519' ? 'Puma' : `Planta ${pid}`)}: <strong className="text-slate-200">{val} kWh</strong>
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
