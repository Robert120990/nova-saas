import { useState } from 'react';
import { Sun, Moon, BarChart2 } from 'lucide-react';

export default function EnergyDayChart({ growattData, curvePoints, title, subtitle, selectedPlantName }) {
    const andelsa = growattData?.plants?.find(p => p.id === '2410077' || p.name?.toLowerCase().includes('andelsa')) || growattData?.plants?.[0];
    const rawCurve = andelsa?.dayCurve || [];

    const [hoverIndex, setHoverIndex] = useState(null);

    // Si recibimos curvePoints de la analítica, usamos esos puntos directamente
    const points = (curvePoints && curvePoints.length === 288) 
        ? curvePoints.map(p => ({
            ...p,
            hasData: p.kw > 0
        }))
        : Array.from({ length: 288 }, (_, i) => {
            const val = rawCurve[i];
            const numVal = (val !== null && val !== undefined) ? (typeof val === 'number' ? val : parseFloat(val)) : null;
            const totalMinutes = i * 5;
            const h = Math.floor(totalMinutes / 60);
            const m = totalMinutes % 60;
            const timeLabel = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            // Convertir W a kW si viene en W (> 500)
            const kwVal = numVal !== null ? (numVal > 1000 ? numVal / 1000 : numVal) : 0;
            return {
                index: i,
                time: timeLabel,
                kw: kwVal,
                hasData: numVal !== null,
                isPeak: h >= 18 && h < 22
            };
        });

    const maxKw = Math.max(...points.map(p => p.kw), 100);
    const chartHeight = 200;
    const chartWidth = 800;

    // Generar coordenadas SVG
    const svgPoints = points.map((p, i) => {
        const x = (i / (points.length - 1)) * chartWidth;
        const y = chartHeight - (p.kw / maxKw) * (chartHeight - 30) - 10;
        return `${x},${y}`;
    }).join(' ');

    const areaPoints = `0,${chartHeight} ${svgPoints} ${chartWidth},${chartHeight}`;

    // Coordenadas del bloque de hora pico (18:00 a 22:00 -> índice 216 a 264)
    const peakStartX = (216 / 287) * chartWidth;
    const peakWidth = ((264 - 216) / 287) * chartWidth;

    const hoveredPoint = hoverIndex !== null ? points[hoverIndex] : null;

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        <BarChart2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {title || 'Curva de Generación Solar Diaria (5 Minutos) & Ventana Pico'}
                        </h3>
                        <p className="text-xs text-slate-500">
                            {subtitle || (
                                <>Planta: <strong>{selectedPlantName || andelsa?.name || 'Todas'}</strong> &bull; Pico Solar: <strong>{maxKw.toFixed(1)} kW</strong></>
                            )}
                        </p>
                    </div>
                </div>

                {/* Leyenda */}
                <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" />
                        <span className="text-slate-600 dark:text-slate-300 font-medium">Generación Solar (kW)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-purple-500/20 border border-purple-500 inline-block" />
                        <span className="text-purple-600 dark:text-purple-400 font-medium">Hora Pico Baterías (18:00 - 22:00)</span>
                    </div>
                </div>
            </div>

            {/* Gráfico SVG Responsivo */}
            <div className="mt-4 relative">
                <div className="w-full overflow-x-auto">
                    <div className="min-w-[650px] relative">
                        <svg 
                            viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                            className="w-full h-56 overflow-visible"
                            onMouseLeave={() => setHoverIndex(null)}
                        >
                            <defs>
                                <linearGradient id="solarGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                                </linearGradient>
                            </defs>

                            {/* Franja de Hora Pico (18:00 - 22:00) */}
                            <rect 
                                x={peakStartX} 
                                y="0" 
                                width={peakWidth} 
                                height={chartHeight} 
                                fill="#8b5cf6" 
                                fillOpacity="0.12" 
                            />
                            <line 
                                x1={peakStartX} 
                                y1="0" 
                                x2={peakStartX} 
                                y2={chartHeight} 
                                stroke="#8b5cf6" 
                                strokeDasharray="3 3" 
                                strokeWidth="1.5" 
                            />
                            <line 
                                x1={peakStartX + peakWidth} 
                                y1="0" 
                                x2={peakStartX + peakWidth} 
                                y2={chartHeight} 
                                stroke="#8b5cf6" 
                                strokeDasharray="3 3" 
                                strokeWidth="1.5" 
                            />

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

                            {/* Área de Generación Solar */}
                            <polygon points={areaPoints} fill="url(#solarGradient)" />

                            {/* Línea de Generación Solar */}
                            <polyline 
                                points={svgPoints} 
                                fill="none" 
                                stroke="#f59e0b" 
                                strokeWidth="2.5" 
                                strokeLinecap="round" 
                            />

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
                                        stroke="#0f172a" 
                                        strokeWidth="1.5" 
                                        strokeDasharray="2 2" 
                                    />
                                    <circle 
                                        cx={(hoverIndex / 287) * chartWidth} 
                                        cy={chartHeight - (hoveredPoint.kw / maxKw) * (chartHeight - 30) - 10} 
                                        r="4.5" 
                                        fill="#f59e0b" 
                                        stroke="#ffffff" 
                                        strokeWidth="2" 
                                    />
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
                            <span className="text-purple-600 font-bold">18:00 (Pico Nocturno)</span>
                            <span className="text-purple-600 font-bold">21:00</span>
                            <span>23:55</span>
                        </div>
                    </div>
                </div>

                {/* Tooltip flotante al hacer hover */}
                {hoveredPoint && (
                    <div className="mt-3 p-3 rounded-xl bg-slate-800 text-white text-xs flex items-center justify-between shadow-lg">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-400">Hora: {hoveredPoint.time}</span>
                            <span>&bull;</span>
                            <span>Potencia Solar: <strong>{hoveredPoint.kw.toFixed(2)} kW</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px]">
                            {hoveredPoint.isPeak ? (
                                <span className="text-purple-300 font-bold flex items-center gap-1">
                                    <Moon className="w-3.5 h-3.5" /> Ventana Hora Pico (Suministro de Baterías)
                                </span>
                            ) : (
                                <span className="text-slate-300 flex items-center gap-1">
                                    <Sun className="w-3.5 h-3.5 text-amber-400" /> Tarifa Regular / Valle
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
