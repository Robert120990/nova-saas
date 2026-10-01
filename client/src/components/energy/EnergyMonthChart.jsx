import { useState } from 'react';
import { CalendarDays, Sun, BatteryCharging, Check } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import Money from '../ui/Money';

export default function EnergyMonthChart({ monthData, selectedMonth, selectedPlantName }) {
    const dailyPoints = monthData?.dailyPoints || [];
    const summary = monthData?.summary || {};
    const hasBess = monthData?.hasBatteries || summary?.hasBatteries || dailyPoints.some(p => (p.batteryKwh || 0) > 0);

    const [hoveredDay, setHoveredDay] = useState(null);
    const [showSolar, setShowSolar] = useState(true);
    const [showBattery, setShowBattery] = useState(true);

    const activeMax = dailyPoints.reduce((acc, p) => {
        let m = acc;
        if (showSolar) m = Math.max(m, p.solarKwh || 0);
        if (showBattery && hasBess) m = Math.max(m, p.batteryKwh || 0);
        return m;
    }, 0);
    const maxKwh = Math.max(activeMax, 100);

    const avgKwh = summary.avgDailySolarKwh || 0;
    const chartHeight = 220;
    const chartWidth = 900;
    const numDays = dailyPoints.length || 30;
    const slotWidth = chartWidth / numDays;

    // Línea de promedio Y
    const avgY = chartHeight - (avgKwh / maxKwh) * (chartHeight - 40) - 20;

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            {/* Header del gráfico */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        <CalendarDays className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            Aporte Energético Diario del Mes ({selectedMonth})
                        </h3>
                        <p className="text-xs text-slate-500">
                            Planta: <strong>{selectedPlantName || 'Todas'}</strong>
                            {' '}&bull; Promedio Solar: <strong>{avgKwh.toFixed(1)} kWh/día</strong>
                            {' '}&bull; Total Solar: <strong>{summary.totalSolarKwh?.toLocaleString('en-US')} kWh</strong>
                            {hasBess && summary.monthDischargedKwh > 0 && (
                                <> &bull; Total Baterías: <strong className="text-purple-600 dark:text-purple-400">{summary.monthDischargedKwh.toLocaleString('en-US')} kWh</strong></>
                            )}
                        </p>
                    </div>
                </div>

                {/* Filtros Interactivos de Series */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Toggle Inversores Solar */}
                    <button
                        type="button"
                        onClick={() => setShowSolar(!showSolar)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                            showSolar 
                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-400 shadow-sm' 
                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 line-through opacity-60'
                        }`}
                        title="Ocultar o mostrar barras de inversores solares"
                    >
                        <span className={`w-3 h-3 rounded-sm flex items-center justify-center ${showSolar ? 'bg-amber-500 text-white' : 'bg-slate-300'}`}>
                            {showSolar && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </span>
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                        <span>Inversores Solar</span>
                    </button>

                    {/* Toggle Baterías BESS */}
                    {hasBess ? (
                        <button
                            type="button"
                            onClick={() => setShowBattery(!showBattery)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                showBattery 
                                    ? 'bg-purple-500/10 border-purple-500/40 text-purple-700 dark:text-purple-400 shadow-sm' 
                                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 line-through opacity-60'
                            }`}
                            title="Ocultar o mostrar barras de descarga de baterías"
                        >
                            <span className={`w-3 h-3 rounded-sm flex items-center justify-center ${showBattery ? 'bg-purple-600 text-white' : 'bg-slate-300'}`}>
                                {showBattery && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </span>
                            <BatteryCharging className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            <span>Baterías BESS (Pico)</span>
                        </button>
                    ) : (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed">
                            <BatteryCharging className="w-3 h-3 text-slate-400" />
                            <span>Sin Baterías (No Aplica)</span>
                        </span>
                    )}

                    {showSolar && avgKwh > 0 && (
                        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-700 text-xs">
                            <span className="w-3.5 h-0.5 border-t-2 border-dashed border-sky-500 inline-block" />
                            <span className="text-sky-600 dark:text-sky-400 font-medium text-[11px]">Promedio Solar</span>
                        </div>
                    )}
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
                            <linearGradient id="monthSolarGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.95" />
                                <stop offset="100%" stopColor="#d97706" stopOpacity="0.65" />
                            </linearGradient>
                            <linearGradient id="monthBatteryGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.95" />
                                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.65" />
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

                        {/* Línea de promedio solar */}
                        {showSolar && avgKwh > 0 && (
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

                        {/* Barras agrupadas por día */}
                        {dailyPoints.map((pt, i) => {
                            const slotX = i * slotWidth;
                            const isDual = hasBess && showSolar && showBattery;
                            const barWidth = isDual 
                                ? Math.max((slotWidth - 4) / 2, 7) 
                                : Math.max(slotWidth - 6, 12);

                            const solarH = (showSolar && pt.solarKwh > 0) ? (pt.solarKwh / maxKwh) * (chartHeight - 40) : 0;
                            const solarY = chartHeight - solarH - 20;

                            const batteryH = (showBattery && hasBess && pt.batteryKwh > 0) ? (pt.batteryKwh / maxKwh) * (chartHeight - 40) : 0;
                            const batteryY = chartHeight - batteryH - 20;

                            const isHovered = hoveredDay?.day === pt.day;

                            return (
                                <g key={pt.day} className="cursor-pointer" onMouseEnter={() => setHoveredDay(pt)}>
                                    {/* Barra de impacto táctil invisible */}
                                    <rect 
                                        x={slotX} 
                                        y="0" 
                                        width={slotWidth} 
                                        height={chartHeight} 
                                        fill="transparent"
                                    />

                                    {/* Barra Solar */}
                                    {showSolar && (
                                        <rect 
                                            x={isDual ? (slotX + 1) : (slotX + (slotWidth - barWidth) / 2)} 
                                            y={solarY} 
                                            width={barWidth} 
                                            height={Math.max(solarH, 2)} 
                                            rx="2.5"
                                            fill="url(#monthSolarGradient)"
                                            opacity={isHovered ? 1 : 0.85}
                                            className="transition-all duration-150"
                                        />
                                    )}

                                    {/* Barra Baterías BESS */}
                                    {showBattery && hasBess && (
                                        <rect 
                                            x={isDual ? (slotX + barWidth + 2) : (slotX + (slotWidth - barWidth) / 2)} 
                                            y={batteryY} 
                                            width={barWidth} 
                                            height={Math.max(batteryH, 2)} 
                                            rx="2.5"
                                            fill="url(#monthBatteryGradient)"
                                            opacity={isHovered ? 1 : 0.85}
                                            className="transition-all duration-150"
                                        />
                                    )}

                                    {/* Etiqueta del día */}
                                    <text 
                                        x={slotX + slotWidth / 2} 
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

                    {/* Tooltip flotante al hacer hover */}
                    {hoveredDay && (
                        <div className="mt-3 p-3.5 bg-slate-800 text-white rounded-xl shadow-lg border border-slate-700 flex flex-wrap items-center justify-between gap-4 text-xs animate-fade-in">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                <span>Fecha: <strong>{formatDate(hoveredDay.date)} (Día {hoveredDay.day})</strong></span>
                            </div>

                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                                    <span>☀️ Inversores: <strong className="text-amber-400 font-bold">{hoveredDay.solarKwh.toFixed(1)} kWh</strong></span>
                                </div>

                                {hasBess && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-purple-400" />
                                        <span>🔋 Baterías BESS: <strong className="text-purple-400 font-bold">{hoveredDay.batteryKwh.toFixed(1)} kWh</strong></span>
                                    </div>
                                )}

                                <div className="flex items-center gap-1.5 pl-3 border-l border-slate-600">
                                    <span>Aporte Total:</span>
                                    <strong className="text-emerald-400 font-black">{hoveredDay.totalKwh.toFixed(1)} kWh</strong>
                                </div>

                                <div className="flex items-center gap-1 text-slate-300">
                                    <span>Ahorro Estimado:</span>
                                    <strong className="text-emerald-400 font-bold"><Money amount={hoveredDay.savingsUsd} /></strong>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
