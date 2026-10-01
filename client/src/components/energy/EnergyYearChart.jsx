import { useState } from 'react';
import { CalendarRange, Trophy, Sun, BatteryCharging, Check } from 'lucide-react';
import Money from '../ui/Money';

export default function EnergyYearChart({ yearData, selectedYear, selectedPlantName }) {
    const monthlyPoints = yearData?.monthlyPoints || [];
    const summary = yearData?.summary || {};
    const hasBess = yearData?.hasBatteries || summary?.hasBatteries || monthlyPoints.some(p => (p.batteryMwh || 0) > 0);

    const [hoveredMonth, setHoveredMonth] = useState(null);
    const [showSolar, setShowSolar] = useState(true);
    const [showBattery, setShowBattery] = useState(true);

    const activeMax = monthlyPoints.reduce((acc, p) => {
        let m = acc;
        if (showSolar) m = Math.max(m, p.solarMwh || 0);
        if (showBattery && hasBess) m = Math.max(m, p.batteryMwh || 0);
        return m;
    }, 0);
    const maxMwh = Math.max(activeMax, 1);

    const chartHeight = 220;
    const chartWidth = 900;
    const numMonths = 12;
    const slotWidth = chartWidth / numMonths;

    const bestMonthNum = summary.bestMonth?.month;

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            {/* Header del gráfico */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
                        <CalendarRange className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            Aporte Energético Mensual del Año ({selectedYear})
                        </h3>
                        <p className="text-xs text-slate-500">
                            Planta: <strong>{selectedPlantName || 'Todas'}</strong>
                            {' '}&bull; Total Solar: <strong>{summary.totalSolarMwh?.toFixed(1)} MWh</strong> ({summary.totalSolarKwh?.toLocaleString('en-US')} kWh)
                            {hasBess && summary.totalBatteryMwh > 0 && (
                                <> &bull; Total Baterías: <strong className="text-purple-600 dark:text-purple-400">{summary.totalBatteryMwh.toFixed(1)} MWh</strong></>
                            )}
                        </p>
                    </div>
                </div>

                {/* Filtros Interactivos y Badge Récord */}
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
                            <span>Baterías BESS</span>
                        </button>
                    ) : (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed">
                            <BatteryCharging className="w-3 h-3 text-slate-400" />
                            <span>Sin Baterías (No Aplica)</span>
                        </span>
                    )}

                    {summary.bestMonth && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                            <Trophy className="w-3.5 h-3.5 text-amber-500" />
                            <span>Récord: <strong>{summary.bestMonth.name}</strong></span>
                        </div>
                    )}
                </div>
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
                            <linearGradient id="yearSolarGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.95" />
                                <stop offset="100%" stopColor="#d97706" stopOpacity="0.65" />
                            </linearGradient>
                            <linearGradient id="yearBatteryGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.95" />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.65" />
                            </linearGradient>
                        </defs>

                        {/* Líneas guía horizontales (MWh) */}
                        {[0.25, 0.5, 0.75, 1].map((pct, idx) => {
                            const y = chartHeight - pct * (chartHeight - 40) - 20;
                            const mwhVal = (maxMwh * pct).toFixed(1);
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

                        {/* Barras agrupadas por mes */}
                        {monthlyPoints.map((pt, i) => {
                            const slotX = i * slotWidth;
                            const isDual = hasBess && showSolar && showBattery;
                            const barWidth = isDual ? Math.max((slotWidth - 10) / 2, 14) : Math.max(slotWidth - 16, 26);

                            const solarH = (showSolar && pt.solarMwh > 0) ? (pt.solarMwh / maxMwh) * (chartHeight - 40) : 0;
                            const solarY = chartHeight - solarH - 20;

                            const batteryH = (showBattery && hasBess && pt.batteryMwh > 0) ? (pt.batteryMwh / maxMwh) * (chartHeight - 40) : 0;
                            const batteryY = chartHeight - batteryH - 20;

                            const isHovered = hoveredMonth?.month === pt.month;
                            const isBest = pt.month === bestMonthNum && pt.solarMwh > 0;

                            return (
                                <g key={pt.month} className="cursor-pointer" onMouseEnter={() => setHoveredMonth(pt)}>
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
                                            x={isDual ? (slotX + 4) : (slotX + (slotWidth - barWidth) / 2)} 
                                            y={solarY} 
                                            width={barWidth} 
                                            height={Math.max(solarH, 2)} 
                                            rx="3"
                                            fill="url(#yearSolarGradient)"
                                            opacity={isHovered ? 1 : 0.85}
                                            className="transition-all duration-150"
                                        />
                                    )}

                                    {/* Barra Baterías BESS */}
                                    {showBattery && hasBess && (
                                        <rect 
                                            x={isDual ? (slotX + barWidth + 6) : (slotX + (slotWidth - barWidth) / 2)} 
                                            y={batteryY} 
                                            width={barWidth} 
                                            height={Math.max(batteryH, 2)} 
                                            rx="3"
                                            fill="url(#yearBatteryGradient)"
                                            opacity={isHovered ? 1 : 0.85}
                                            className="transition-all duration-150"
                                        />
                                    )}

                                    {/* Nombre del mes */}
                                    <text 
                                        x={slotX + slotWidth / 2} 
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

                    {/* Tooltip flotante al hacer hover */}
                    {hoveredMonth && (
                        <div className="mt-3 p-3.5 bg-slate-800 text-white rounded-xl shadow-lg border border-slate-700 flex flex-wrap items-center justify-between gap-4 text-xs animate-fade-in">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                                <span>Mes: <strong>{hoveredMonth.name} ({selectedYear})</strong></span>
                            </div>

                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                                    <span>☀️ Inversores: <strong className="text-amber-400 font-bold">{hoveredMonth.solarMwh.toFixed(2)} MWh</strong> ({hoveredMonth.solarKwh.toLocaleString('en-US')} kWh)</span>
                                </div>

                                {hasBess && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-purple-400" />
                                        <span>🔋 Baterías BESS: <strong className="text-purple-400 font-bold">{hoveredMonth.batteryMwh.toFixed(2)} MWh</strong> ({hoveredMonth.batteryKwh.toLocaleString('en-US')} kWh)</span>
                                    </div>
                                )}

                                <div className="flex items-center gap-1.5 pl-3 border-l border-slate-600">
                                    <span>Total:</span>
                                    <strong className="text-emerald-400 font-black">
                                        {(hoveredMonth.solarMwh + (hasBess ? hoveredMonth.batteryMwh : 0)).toFixed(2)} MWh
                                    </strong>
                                </div>

                                <div className="flex items-center gap-1 text-slate-300">
                                    <span>Ahorro Estimado:</span>
                                    <strong className="text-emerald-400 font-bold"><Money amount={hoveredMonth.savingsUsd} /></strong>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
