import { useState } from 'react';
import { Sun, Moon, BarChart2, BatteryCharging, Check } from 'lucide-react';

export default function EnergyDayChart({ 
    growattData, 
    curvePoints, 
    title, 
    subtitle, 
    selectedPlantName,
    hasBatteries = false,
    summary = {}
}) {
    const andelsa = growattData?.plants?.find(p => p.id === '2410077' || p.name?.toLowerCase().includes('andelsa')) || growattData?.plants?.[0];
    const rawCurve = andelsa?.dayCurve || [];

    const [hoverIndex, setHoverIndex] = useState(null);
    const [showSolar, setShowSolar] = useState(true);
    const [showBattery, setShowBattery] = useState(true);

    const hasBess = hasBatteries || summary?.hasBatteries || curvePoints?.some(p => (p.batteryKw || 0) > 0);

    // Mapear los 288 intervalos de 5 minutos
    const points = (curvePoints && curvePoints.length === 288) 
        ? curvePoints.map(p => ({
            ...p,
            solarKw: p.solarKw ?? p.kw ?? 0,
            batteryKw: p.batteryKw ?? 0,
            totalKw: p.totalKw ?? ((p.solarKw ?? p.kw ?? 0) + (p.batteryKw ?? 0)),
            hasData: ((p.solarKw || 0) > 0 || (p.batteryKw || 0) > 0)
        }))
        : Array.from({ length: 288 }, (_, i) => {
            const val = rawCurve[i];
            const numVal = (val !== null && val !== undefined) ? (typeof val === 'number' ? val : parseFloat(val)) : null;
            const totalMinutes = i * 5;
            const h = Math.floor(totalMinutes / 60);
            const m = totalMinutes % 60;
            const timeLabel = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            const kwVal = numVal !== null ? (numVal > 0 ? numVal / 1000 : 0) : 0;
            return {
                index: i,
                time: timeLabel,
                hour: h,
                minute: m,
                isPeak: h >= 18 && h < 22,
                solarKw: kwVal,
                batteryKw: 0,
                totalKw: kwVal,
                kw: kwVal,
                hasData: numVal !== null
            };
        });

    const activeMax = points.reduce((acc, p) => {
        let m = acc;
        if (showSolar) m = Math.max(m, p.solarKw || 0);
        if (showBattery && hasBess) m = Math.max(m, p.batteryKw || 0);
        return m;
    }, 0);
    const maxKw = Math.max(activeMax, 50);

    const chartHeight = 210;
    const chartWidth = 800;

    // Coordenadas SVG para curva Solar (Inversores)
    const solarSvgPoints = points.map((p, i) => {
        const x = (i / (points.length - 1)) * chartWidth;
        const kw = showSolar ? (p.solarKw || 0) : 0;
        const y = chartHeight - (kw / maxKw) * (chartHeight - 30) - 10;
        return `${x},${y}`;
    }).join(' ');
    const solarAreaPoints = `0,${chartHeight} ${solarSvgPoints} ${chartWidth},${chartHeight}`;

    // Coordenadas SVG para curva Baterías BESS (Descarga pico)
    const batterySvgPoints = points.map((p, i) => {
        const x = (i / (points.length - 1)) * chartWidth;
        const kw = (showBattery && hasBess) ? (p.batteryKw || 0) : 0;
        const y = chartHeight - (kw / maxKw) * (chartHeight - 30) - 10;
        return `${x},${y}`;
    }).join(' ');
    const batteryAreaPoints = `0,${chartHeight} ${batterySvgPoints} ${chartWidth},${chartHeight}`;

    const hoveredPoint = hoverIndex !== null ? points[hoverIndex] : null;

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            {/* Header del Gráfico */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        <BarChart2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {title || 'Curva de Generación Solar y Aporte BESS'}
                        </h3>
                        <p className="text-xs text-slate-500">
                            {subtitle || (
                                <>
                                    Planta: <strong>{selectedPlantName || andelsa?.name || 'Todas'}</strong>
                                    {' '}&bull; Escala: <strong>{maxKw.toFixed(1)} kW</strong>
                                    {hasBess && summary?.batteryDischargeKw > 0 && (
                                        <> &bull; Descarga BESS: <strong className="text-purple-600 dark:text-purple-400">{summary.batteryDischargeKw} kW</strong></>
                                    )}
                                </>
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
                        title="Ocultar o mostrar curva de inversores solares"
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
                            title="Ocultar o mostrar aporte del banco de baterías BESS"
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
                </div>
            </div>

            {/* Gráfico SVG Responsivo */}
            <div className="relative">
                <div className="w-full overflow-x-auto">
                    <div className="min-w-[650px] relative">
                        <svg 
                            viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                            className="w-full h-56 overflow-visible"
                            onMouseLeave={() => setHoverIndex(null)}
                        >
                            <defs>
                                <linearGradient id="solarGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.45" />
                                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
                                </linearGradient>
                                <linearGradient id="batteryGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.5" />
                                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
                                </linearGradient>
                            </defs>

                            {/* Franja sombreada de Hora Pico (18:00 a 22:00 = intervalos 216 a 264) */}
                            {hasBess && (
                                <rect 
                                    x={(216 / 287) * chartWidth} 
                                    y="0" 
                                    width={((264 - 216) / 287) * chartWidth} 
                                    height={chartHeight} 
                                    fill="#8b5cf6" 
                                    fillOpacity="0.06" 
                                />
                            )}

                            {/* Líneas Guía Horizontales */}
                            {[0.25, 0.5, 0.75, 1].map((ratio) => {
                                const y = chartHeight - ratio * (chartHeight - 30) - 10;
                                return (
                                    <g key={ratio}>
                                        <line 
                                            x1="0" 
                                            y1={y} 
                                            x2={chartWidth} 
                                            y2={y} 
                                            stroke="currentColor" 
                                            strokeOpacity="0.08" 
                                            strokeDasharray="2 2" 
                                        />
                                        <text 
                                            x="5" 
                                            y={y - 4} 
                                            className="text-[9px] fill-slate-400 font-semibold"
                                        >
                                            {(maxKw * ratio).toFixed(0)} kW
                                        </text>
                                    </g>
                                );
                            })}

                            {/* Área y Curva de Generación Solar */}
                            {showSolar && (
                                <>
                                    <polygon points={solarAreaPoints} fill="url(#solarGradient)" />
                                    <polyline 
                                        points={solarSvgPoints} 
                                        fill="none" 
                                        stroke="#f59e0b" 
                                        strokeWidth="2.5" 
                                        strokeLinecap="round" 
                                    />
                                </>
                            )}

                            {/* Área y Curva de Baterías BESS */}
                            {showBattery && hasBess && (
                                <>
                                    <polygon points={batteryAreaPoints} fill="url(#batteryGradient)" />
                                    <polyline 
                                        points={batterySvgPoints} 
                                        fill="none" 
                                        stroke="#8b5cf6" 
                                        strokeWidth="2.5" 
                                        strokeLinecap="round" 
                                        strokeDasharray="4 2"
                                    />
                                </>
                            )}

                            {/* Detección de Hover en Puntos */}
                            {points.map((p, idx) => {
                                const x = (idx / (points.length - 1)) * chartWidth;
                                return (
                                    <rect 
                                        key={idx}
                                        x={x - 2}
                                        y="0"
                                        width="4"
                                        height={chartHeight}
                                        fill="transparent"
                                        onMouseEnter={() => setHoverIndex(idx)}
                                        className="cursor-pointer"
                                    />
                                );
                            })}

                            {/* Indicador de Hover Activo */}
                            {hoverIndex !== null && hoveredPoint && (
                                <g>
                                    <line 
                                        x1={(hoverIndex / 287) * chartWidth} 
                                        y1="0" 
                                        x2={(hoverIndex / 287) * chartWidth} 
                                        y2={chartHeight} 
                                        stroke="#475569" 
                                        strokeWidth="1.5" 
                                        strokeDasharray="2 2" 
                                    />
                                    {showSolar && (hoveredPoint.solarKw > 0) && (
                                        <circle 
                                            cx={(hoverIndex / 287) * chartWidth} 
                                            cy={chartHeight - ((hoveredPoint.solarKw || 0) / maxKw) * (chartHeight - 30) - 10} 
                                            r="4.5" 
                                            fill="#f59e0b" 
                                            stroke="#ffffff" 
                                            strokeWidth="2" 
                                        />
                                    )}
                                    {showBattery && hasBess && (hoveredPoint.batteryKw > 0) && (
                                        <circle 
                                            cx={(hoverIndex / 287) * chartWidth} 
                                            cy={chartHeight - ((hoveredPoint.batteryKw || 0) / maxKw) * (chartHeight - 30) - 10} 
                                            r="4.5" 
                                            fill="#8b5cf6" 
                                            stroke="#ffffff" 
                                            strokeWidth="2" 
                                        />
                                    )}
                                </g>
                            )}
                        </svg>

                        {/* Etiquetas Horarias en el Eje X */}
                        <div className="flex justify-between text-[10px] text-slate-400 font-semibold mt-1 px-1">
                            <span>00:00</span>
                            <span>03:00</span>
                            <span>06:00 (Amanecer)</span>
                            <span>09:00</span>
                            <span>12:00 (Cenit Solar)</span>
                            <span>15:00</span>
                            <span className={hasBess ? "text-purple-600 dark:text-purple-400 font-bold" : ""}>18:00 (Pico Nocturno)</span>
                            <span className={hasBess ? "text-purple-600 dark:text-purple-400 font-bold" : ""}>21:00</span>
                            <span>23:55</span>
                        </div>
                    </div>
                </div>

                {/* Tooltip de Datos al Hacer Hover */}
                {hoveredPoint && (
                    <div className="mt-3 p-3.5 rounded-xl bg-slate-800 text-white text-xs flex flex-wrap items-center justify-between gap-3 shadow-lg border border-slate-700 animate-fade-in">
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-200">Hora: <strong className="text-white text-sm">{hoveredPoint.time}</strong></span>
                            {hoveredPoint.isPeak ? (
                                <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold flex items-center gap-1">
                                    <Moon className="w-3 h-3 text-purple-400" /> Tarifa Pico (BESS)
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1">
                                    <Sun className="w-3 h-3 text-amber-400" /> Tarifa Valle / Solar
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                <span className="text-slate-300">☀️ Inversores: <strong className="text-amber-400 font-black">{hoveredPoint.solarKw.toFixed(1)} kW</strong></span>
                            </div>

                            {hasBess && (
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                                    <span className="text-slate-300">🔋 Baterías BESS: <strong className="text-purple-400 font-black">{hoveredPoint.batteryKw.toFixed(1)} kW</strong></span>
                                </div>
                            )}

                            <div className="flex items-center gap-1.5 pl-3 border-l border-slate-600">
                                <span className="text-slate-400 font-medium">Aporte Total:</span>
                                <strong className="text-emerald-400 font-black text-sm">{hoveredPoint.totalKw.toFixed(1)} kW</strong>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
