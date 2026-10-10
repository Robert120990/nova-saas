/**
 * Gráfico Lineal de Distribución de Ventas de Ovoproductos / Clientes
 */
export default function EggSalesLineChart({ chartData = [], maxVal = 1, metric = 'amount', hoverIndex, setHoverIndex }) {
    return (
        <div className="space-y-4">
            <div className="relative w-full overflow-x-auto">
                <div className="min-w-[500px]">
                    <svg viewBox="0 0 600 200" className="w-full h-52 overflow-visible">
                        <defs>
                            <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                            </linearGradient>
                        </defs>

                        {/* Líneas horizontales de guía */}
                        {[0.25, 0.5, 0.75, 1].map((ratio) => {
                            const y = 180 - ratio * 150;
                            return (
                                <g key={ratio}>
                                    <line x1="30" y1={y} x2="580" y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
                                    <text x="5" y={y + 3} fontSize="9" fill="#94a3b8" fontWeight="bold">
                                        {metric === 'amount' ? `$${((maxVal * ratio) / 1000).toFixed(0)}k` : `${(maxVal * ratio).toFixed(0)}`}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Polígono de área bajo la curva */}
                        {chartData.length > 1 && (
                            <polygon
                                points={[
                                    `30,180`,
                                    ...chartData.slice(0, 12).map((d, i) => {
                                        const count = Math.min(chartData.length, 12);
                                        const x = 40 + (i / Math.max(1, count - 1)) * 520;
                                        const y = 180 - (d.value / maxVal) * 150;
                                        return `${x},${y}`;
                                    }),
                                    `${40 + ((Math.min(chartData.length, 12) - 1) / Math.max(1, Math.min(chartData.length, 12) - 1)) * 520},180`
                                ].join(' ')}
                                fill="url(#lineGrad)"
                            />
                        )}

                        {/* Polilínea principal */}
                        {chartData.length > 1 && (
                            <polyline
                                points={chartData.slice(0, 12).map((d, i) => {
                                    const count = Math.min(chartData.length, 12);
                                    const x = 40 + (i / Math.max(1, count - 1)) * 520;
                                    const y = 180 - (d.value / maxVal) * 150;
                                    return `${x},${y}`;
                                }).join(' ')}
                                fill="none"
                                stroke="#4f46e5"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        )}

                        {/* Puntos y etiquetas interactivas */}
                        {chartData.slice(0, 12).map((d, i) => {
                            const count = Math.min(chartData.length, 12);
                            const x = 40 + (i / Math.max(1, count - 1)) * 520;
                            const y = 180 - (d.value / maxVal) * 150;
                            const isHov = hoverIndex === i;

                            return (
                                <g
                                    key={d.id}
                                    className="cursor-pointer"
                                    onMouseEnter={() => setHoverIndex(i)}
                                    onMouseLeave={() => setHoverIndex(null)}
                                >
                                    <circle
                                        cx={x}
                                        cy={y}
                                        r={isHov ? '6.5' : '4.5'}
                                        fill={isHov ? '#4338ca' : '#6366f1'}
                                        stroke="#ffffff"
                                        strokeWidth="2.5"
                                    />
                                    {isHov && (
                                        <g>
                                            <rect
                                                x={Math.max(10, Math.min(500, x - 55))}
                                                y={Math.max(5, y - 42)}
                                                width="110"
                                                height="34"
                                                rx="8"
                                                fill="#1e293b"
                                                className="shadow-lg"
                                            />
                                            <text x={Math.max(10, Math.min(500, x - 55)) + 55} y={Math.max(5, y - 42) + 14} fontSize="9" fill="#94a3b8" textAnchor="middle">
                                                {d.name.slice(0, 16)}
                                            </text>
                                            <text x={Math.max(10, Math.min(500, x - 55)) + 55} y={Math.max(5, y - 42) + 27} fontSize="10" fill="#ffffff" fontWeight="bold" textAnchor="middle">
                                                {metric === 'amount' ? `$${d.amount.toFixed(2)}` : `${d.volume.toFixed(1)} Lb`}
                                            </text>
                                        </g>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                </div>
            </div>
        </div>
    );
}
