import { useState } from 'react';
import { Droplets, Sparkles, TrendingUp, Users, DollarSign, Scale } from 'lucide-react';
import Money from '../../ui/Money';

const PALETTES = {
    clara: {
        id: 'clara', bgGradientFrom: '#fef08a', bgGradientTo: '#ca8a04',
        frontGradientFrom: '#facc15', frontGradientTo: '#eab308', backFill: '#fef9c3',
        glow: 'rgba(250, 204, 21, 0.35)', badgeBg: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
        title: 'Clara Líquida Pasteurizada'
    },
    yema: {
        id: 'yema', bgGradientFrom: '#fb923c', bgGradientTo: '#c2410c',
        frontGradientFrom: '#f97316', frontGradientTo: '#ea580c', backFill: '#fed7aa',
        glow: 'rgba(249, 115, 22, 0.35)', badgeBg: 'bg-orange-500/10 text-orange-700 border-orange-500/30',
        title: 'Yema Líquida Pasteurizada'
    },
    rapido: {
        id: 'rapido', bgGradientFrom: '#38bdf8', bgGradientTo: '#0284c7',
        frontGradientFrom: '#0ea5e9', frontGradientTo: '#0369a1', backFill: '#bae6fd',
        glow: 'rgba(14, 165, 233, 0.35)', badgeBg: 'bg-sky-500/10 text-sky-700 border-sky-500/30',
        title: 'Huevo Rápido / Especial'
    },
    entero: {
        id: 'entero', bgGradientFrom: '#f59e0b', bgGradientTo: '#b45309',
        frontGradientFrom: '#fbbf24', frontGradientTo: '#d97706', backFill: '#fde68a',
        glow: 'rgba(245, 158, 11, 0.35)', badgeBg: 'bg-amber-500/10 text-amber-800 border-amber-500/30',
        title: 'Huevo Entero Pasteurizado'
    }
};

const getLiquidPalette = (name = '') => {
    const u = name.toUpperCase();
    if (u.includes('CLARA')) return PALETTES.clara;
    if (u.includes('YEMA')) return PALETTES.yema;
    if (u.includes('RAPIDO') || u.includes('RÁPIDO')) return PALETTES.rapido;
    return PALETTES.entero;
};

/**
 * Visualizador Temático de Ovoproductos en Forma de Huevo con Contenido Líquido Dinámico.
 * Cuenta con silueta SVG paramétrica de huevo, oleaje líquido animado, partículas y selector de ovoproducto.
 */
export default function EggLiquidGauge({ items = [], summary = {} }) {
    const ovoproducts = (Array.isArray(items) ? items : []).filter(p => !p.is_shell && (p.total_lbs > 0 || p.total_amount > 0));
    const [selectedProdName, setSelectedProdName] = useState(() => ovoproducts[0]?.product_name || items[0]?.product_name || '');

    // Si no hay producto seleccionado válido, tomar el primero
    const currentProd = ovoproducts.find(p => p.product_name === selectedProdName) || ovoproducts[0] || items[0] || null;

    const totalLbs = summary?.totalLbs || ovoproducts.reduce((s, p) => s + (p.total_lbs || 0), 0);
    const totalAmount = summary?.totalOvoproductsAmount || summary?.totalAmount || ovoproducts.reduce((s, p) => s + (p.total_amount || 0), 0);

    const prodLbs = currentProd?.total_lbs || 0;
    const prodAmount = currentProd?.total_amount || 0;
    const prodPct = totalLbs > 0 ? Math.min(100, Math.max(0, (prodLbs / totalLbs) * 100)) : 0;
    const pctDisplay = prodPct.toFixed(1);

    // Altura del líquido: de Y=280 (vacío) a Y=20 (100% lleno)
    const eggMinY = 20;
    const eggMaxY = 280;
    const eggHeight = eggMaxY - eggMinY;
    const fillLevel = Math.max(0.04, Math.min(0.96, prodPct / 100)); // Nivel visual mínimo y máximo
    const liquidY = eggMaxY - (fillLevel * eggHeight);

    // Silueta de huevo natural en coordenadas SVG (240 x 300)
    const eggSilhouettePath = "M 120,20 C 60,20 25,100 25,185 C 25,245 65,280 120,280 C 175,280 215,245 215,185 C 215,100 180,20 120,20 Z";

    // Olas de superficie líquida
    const waveAmp1 = 6;
    const waveAmp2 = 4;
    const wavePathFront = `M 0,${liquidY} Q 60,${liquidY - waveAmp1} 120,${liquidY} T 240,${liquidY} V 310 H 0 Z`;
    const wavePathBack = `M 0,${liquidY} Q 60,${liquidY + waveAmp2} 120,${liquidY} T 240,${liquidY} V 310 H 0 Z`;

    const palette = getLiquidPalette(currentProd?.product_name || '');

    return (
        <div className="bg-gradient-to-br from-amber-50/60 via-white to-indigo-50/40 p-4 sm:p-6 rounded-2xl border border-amber-200/60 shadow-sm space-y-5">
            {/* Cabecera y Selector Rápido de Ovoproducto */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-amber-100">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        <Droplets className="w-5 h-5 animate-bounce" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <span>Volumen Líquido y Participación Ovoproductos</span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                                <Sparkles className="w-3 h-3 text-indigo-500" /> Silueta Huevo Industrial
                            </span>
                        </h3>
                        <p className="text-xs text-slate-500">
                            Nivel de llenado proporcional a la cuota de producción y venta de cada ovoproducto en el período.
                        </p>
                    </div>
                </div>

                {/* Chips de Selección de Ovoproductos */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
                    {ovoproducts.map((p) => {
                        const isSelected = p.product_name === selectedProdName;
                        return (
                            <button
                                key={p.product_name}
                                type="button"
                                onClick={() => setSelectedProdName(p.product_name)}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                                    isSelected
                                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm scale-102'
                                        : 'bg-white/80 hover:bg-white text-slate-700 border-slate-200 hover:border-amber-300'
                                }`}
                            >
                                {p.product_name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Contenedor Principal: Huevo Líquido SVG + Tarjetas de Métricas */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* 1. Huevo Líquido Interactivo SVG (Columna izquierda) */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center p-3 sm:p-5 relative">
                    <div className="relative w-64 h-80 sm:w-72 sm:h-92 flex items-center justify-center">
                        <svg
                            viewBox="0 0 240 300"
                            className="w-full h-full drop-shadow-xl overflow-visible select-none"
                            style={{ filter: `drop-shadow(0 15px 25px ${palette.glow})` }}
                        >
                            <defs>
                                <clipPath id="eggClip"><path d={eggSilhouettePath} /></clipPath>
                                <radialGradient id="eggShellBg" cx="35%" cy="30%" r="70%">
                                    <stop offset="0%" stopColor="#ffffff" />
                                    <stop offset="70%" stopColor="#f8fafc" />
                                    <stop offset="100%" stopColor="#e2e8f0" />
                                </radialGradient>
                                <linearGradient id="eggLiquidFront" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={palette.frontGradientFrom} stopOpacity="0.95" />
                                    <stop offset="100%" stopColor={palette.frontGradientTo} stopOpacity="0.98" />
                                </linearGradient>
                                <linearGradient id="eggLiquidBack" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={palette.backFill} stopOpacity="0.6" />
                                    <stop offset="100%" stopColor={palette.bgGradientTo} stopOpacity="0.8" />
                                </linearGradient>
                            </defs>
                            <path d={eggSilhouettePath} fill="url(#eggShellBg)" stroke="#cbd5e1" strokeWidth="2.5" />

                            {/* 2. Contenido Líquido Recortado por el Huevo */}
                            <g clipPath="url(#eggClip)">
                                {/* Capa de oleaje trasero */}
                                <path
                                    d={wavePathBack}
                                    fill="url(#eggLiquidBack)"
                                    className="transition-all duration-700 ease-out"
                                />

                                {/* Capa de oleaje frontal */}
                                <path
                                    d={wavePathFront}
                                    fill="url(#eggLiquidFront)"
                                    className="transition-all duration-700 ease-out"
                                />

                                {/* Línea brillante de tensión superficial */}
                                <line
                                    x1="15"
                                    y1={liquidY}
                                    x2="225"
                                    y2={liquidY}
                                    stroke="#ffffff"
                                    strokeWidth="2.5"
                                    strokeOpacity="0.75"
                                    strokeLinecap="round"
                                />

                                {/* Burbujas de líquido en suspensión */}
                                <circle cx="85" cy={liquidY + 35} r="4.5" fill="#ffffff" fillOpacity="0.35" className="animate-pulse" />
                                <circle cx="150" cy={liquidY + 55} r="6" fill="#ffffff" fillOpacity="0.25" className="animate-pulse" />
                                <circle cx="110" cy={liquidY + 80} r="3.5" fill="#ffffff" fillOpacity="0.3" />
                                <circle cx="70" cy={liquidY + 110} r="5" fill="#ffffff" fillOpacity="0.2" />
                                <circle cx="160" cy={liquidY + 120} r="4" fill="#ffffff" fillOpacity="0.25" />

                                {/* Marcador de graduación porcentual interno */}
                                {[25, 50, 75].map((lvl) => {
                                    const y = eggMaxY - (lvl / 100) * eggHeight;
                                    return (
                                        <g key={lvl} opacity="0.4">
                                            <line x1="30" y1={y} x2="50" y2={y} stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
                                            <line x1="190" y1={y} x2="210" y2={y} stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
                                            <text x="54" y={y + 3} fontSize="8" fill="#475569" fontWeight="bold">
                                                {lvl}%
                                            </text>
                                        </g>
                                    );
                                })}
                            </g>

                            {/* 3. Reflejo especular en el cristal del cascarón (Brillo curva) */}
                            <path
                                d="M 50,55 C 35,95 32,150 42,190"
                                stroke="#ffffff"
                                strokeWidth="7"
                                strokeLinecap="round"
                                fill="none"
                                opacity="0.55"
                            />
                            <circle cx="65" cy="45" r="4" fill="#ffffff" opacity="0.7" />

                            {/* 4. Contorno externo del cascarón */}
                            <path
                                d={eggSilhouettePath}
                                fill="none"
                                stroke="#94a3b8"
                                strokeWidth="2.5"
                                opacity="0.7"
                            />
                        </svg>

                    </div>

                    {/* Resumen al pie del huevo sin recuadros tapando la gráfica */}
                    <div className="mt-3 flex flex-col items-center text-center">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-800 uppercase tracking-wide">
                                {currentProd?.product_name || 'Ovoproducto'}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                                {pctDisplay}% del total
                            </span>
                        </div>
                        <span className="text-xs font-semibold text-slate-600 tabular-nums mt-0.5">
                            {Number(prodLbs).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lb
                        </span>
                    </div>

                    <span className="text-[11px] text-slate-400 font-medium mt-1 flex items-center gap-1">
                        🥚 Silueta a escala volumétrica • Densidad calculada en libras
                    </span>
                </div>

                {/* 2. Tarjetas de Análisis y Rendimiento del Producto (Columna derecha) */}
                <div className="lg:col-span-7 space-y-4">
                    <div className="flex items-center justify-between">
                        <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${palette.badgeBg}`}>
                            {palette.title}
                        </span>
                        <span className="text-xs font-medium text-slate-500">
                            {currentProd?.customers?.length || 0} cliente(s) activo(s)
                        </span>
                    </div>

                    {/* Grilla de Métricas Clave */}
                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-1">
                                <Scale className="w-3.5 h-3.5 text-amber-600" />
                                <span>Volumen en Libras</span>
                            </div>
                            <div className="text-xl font-black text-slate-900 tabular-nums">
                                {Number(prodLbs).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                <span className="text-xs font-semibold text-slate-400 ml-1">Lb</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                                Representa el <strong className="text-amber-700">{pctDisplay}%</strong> de las {Number(totalLbs).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lb totales
                            </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-1">
                                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Total Facturado</span>
                            </div>
                            <div className="text-xl font-black text-emerald-700 tabular-nums">
                                <Money value={prodAmount} />
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                                {totalAmount > 0 ? `${((prodAmount / totalAmount) * 100).toFixed(1)}% de la facturación total` : 'Sin facturación'}
                            </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-1">
                                <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Precio Promedio</span>
                            </div>
                            <div className="text-xl font-black text-indigo-900 tabular-nums">
                                <Money value={currentProd?.avg_price || 0} />
                                <span className="text-xs font-semibold text-slate-400 ml-1">/Lb</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                                Valor ponderado en facturas y créditos
                            </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-1">
                                <Users className="w-3.5 h-3.5 text-violet-600" />
                                <span>Concentración Clientes</span>
                            </div>
                            <div className="text-xl font-black text-slate-800 tabular-nums">
                                {currentProd?.customers?.length || 0}
                                <span className="text-xs font-semibold text-slate-400 ml-1">compradores</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 truncate" title={currentProd?.customers?.[0]?.customer_name || ''}>
                                Líder: <strong>{currentProd?.customers?.[0]?.customer_name || 'N/A'}</strong>
                            </div>
                        </div>
                    </div>

                    {/* Barra de progreso comparativa frente a los demás ovoproductos */}
                    <div className="space-y-1.5 p-3 rounded-xl bg-white/80 border border-slate-200">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                            <span>Distribución del Mix de Ovoproductos</span>
                            <span className="text-slate-500">{ovoproducts.length} productos</span>
                        </div>
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                            {ovoproducts.map((p, idx) => {
                                const share = totalLbs > 0 ? (p.total_lbs / totalLbs) * 100 : 0;
                                const isCurrent = p.product_name === selectedProdName;
                                const colors = ['#f59e0b', '#fb923c', '#0ea5e9', '#6366f1', '#10b981', '#ec4899', '#8b5cf6'];
                                return (
                                    <div
                                        key={p.product_name}
                                        style={{ width: `${share}%`, backgroundColor: colors[idx % colors.length] }}
                                        className={`h-full transition-all cursor-pointer ${isCurrent ? 'ring-2 ring-slate-900 z-10' : 'opacity-80 hover:opacity-100'}`}
                                        title={`${p.product_name}: ${share.toFixed(1)}% (${Number(p.total_lbs).toLocaleString()} Lb)`}
                                        onClick={() => setSelectedProdName(p.product_name)}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
