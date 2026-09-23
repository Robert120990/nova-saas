import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Calculator,
    TrendingUp,
    Target,
    AlertCircle,
    CheckCircle2,
    Lock,
    Sparkles,
    Layers,
    ArrowRight
} from 'lucide-react';
import Money from '../ui/Money';

export default function EggCommissionsSimulator({ defaultPlantCost = 1.05 }) {
    const [volumeLbs, setVolumeLbs] = useState(60000);
    const [salePrice, setSalePrice] = useState(1.30);
    const [plantCost, setPlantCost] = useState(defaultPlantCost);
    const [ratePerLb, setRatePerLb] = useState(0.0150); // 1.5 centavos / lb
    const [capUsd] = useState(1000.00); // TOPE MÁXIMO DE $1,000

    const [_loading, setLoading] = useState(false);
    const [data, setData] = useState(null);

    // Calcular simulación localmente con fallback y sincronización al backend
    useEffect(() => {
        let isMounted = true;
        const fetchSim = async () => {
            setLoading(true);
            try {
                const res = await axios.get('/api/egg-industrial/commissions/simulate', {
                    params: {
                        lbs: volumeLbs,
                        sale_price_per_lb: salePrice,
                        plant_cost_per_lb: plantCost,
                        rate_per_lb: ratePerLb,
                        cap_usd: capUsd
                    }
                });
                if (isMounted) setData(res.data);
            } catch (error) {
                // Cálculo local si no hay red o endpoint en carga
                const vol = parseFloat(volumeLbs) || 0;
                const sp = parseFloat(salePrice) || 0;
                const pc = parseFloat(plantCost) || 0;
                const r = parseFloat(ratePerLb) || 0.015;
                const c = parseFloat(capUsd) || 1000.00;

                const sales = vol * sp;
                const cost = vol * pc;
                const grossMargin = sales - cost;
                const rawComm = vol * r;
                const cappedComm = Math.min(rawComm, c);
                const isCapped = rawComm > c;
                const lbsForCap = r > 0 ? Math.ceil(c / r) : 0;

                if (isMounted) {
                    setData({
                        results: {
                            total_sales_amount: sales,
                            total_cost_amount: cost,
                            company_gross_margin: grossMargin,
                            company_margin_pct: sales > 0 ? (grossMargin / sales) * 100 : 0,
                            raw_commission: rawComm,
                            capped_commission: cappedComm,
                            is_capped: isCapped,
                            excess_commission_retained: Math.max(0, rawComm - cappedComm),
                            company_net_margin: grossMargin - cappedComm,
                            cap_pct_reached: c > 0 ? Math.min(100, (rawComm / c) * 100) : 100,
                            lbs_needed_for_cap: lbsForCap,
                            lbs_remaining_for_cap: Math.max(0, lbsForCap - vol)
                        },
                        sensitivity_table: [20000, 40000, 60000, lbsForCap, 80000, 100000].map(sLbs => {
                            const sSales = sLbs * sp;
                            const sCost = sLbs * pc;
                            const sGross = sSales - sCost;
                            const sRaw = sLbs * r;
                            const sCap = Math.min(sRaw, c);
                            return {
                                lbs: sLbs,
                                sales_amount: sSales,
                                gross_margin: sGross,
                                raw_commission: sRaw,
                                capped_commission: sCap,
                                is_capped: sRaw >= c,
                                net_company_margin: sGross - sCap
                            };
                        })
                    });
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        const timeout = setTimeout(fetchSim, 150);
        return () => {
            isMounted = false;
            clearTimeout(timeout);
        };
    }, [volumeLbs, salePrice, plantCost, ratePerLb, capUsd]);

    const res = data?.results || {};
    const table = data?.sensitivity_table || [];

    const capPct = res.cap_pct_reached || 0;
    const isCapped = res.is_capped || false;

    return (
        <div className="space-y-6">
            {/* Header del Simulador */}
            <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 p-6 rounded-2xl text-white shadow-md border border-indigo-800/40">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-300 text-[11px] font-bold uppercase tracking-wider mb-1">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            <span>Simulador de Ejercicios Comerciales B2B</span>
                        </div>
                        <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2.5">
                            <Calculator className="w-6 h-6 text-indigo-400" />
                            <span>Comisiones con Tope Máximo de $1,000.00</span>
                        </h2>
                        <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                            Herramienta de simulación para proyectar metas en volumen (libras), evaluar la rentabilidad neta para ANDELSA y visualizar el corte estricto en el tope salarial de comisión.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15">
                        <Lock className="w-5 h-5 text-amber-400 shrink-0" />
                        <div>
                            <span className="text-[10px] font-bold text-slate-300 uppercase block">Tope Mensual por Vendedor</span>
                            <span className="text-base font-black text-amber-300 font-mono">$1,000.00 MÁXIMO</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid Principal: Controles vs Resultados */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* PANEL DE CONTROL INTERACTIVO (SLIDERS & INPUTS) */}
                <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-indigo-600" />
                            <span>Variables del Ejercicio</span>
                        </h3>
                        <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                            Interactivo
                        </span>
                    </div>

                    {/* Variable 1: Volumen en Libras */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                            <label className="font-bold text-slate-700 uppercase text-[11px]">
                                Volumen Vendido / Proyectado:
                            </label>
                            <span className="font-mono font-black text-indigo-600 text-sm bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                                {Number(volumeLbs).toLocaleString()} lb
                            </span>
                        </div>
                        <input
                            type="range"
                            min="5000"
                            max="120000"
                            step="1000"
                            value={volumeLbs}
                            onChange={(e) => setVolumeLbs(Number(e.target.value))}
                            className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                        />
                        {/* Botones de Presets Rápidos */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {[20000, 40000, 60000, 66667, 80000, 100000].map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setVolumeLbs(preset)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all border ${
                                        volumeLbs === preset
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {preset === 66667 ? '66.6K (Tope $1K)' : `${preset / 1000}K lb`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Variable 2: Precio de Venta por Libra */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                            <label className="font-bold text-slate-700 uppercase text-[11px]">
                                Precio Promedio de Venta:
                            </label>
                            <span className="font-mono font-bold text-slate-900 text-xs">
                                ${parseFloat(salePrice).toFixed(4)} / lb
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-bold text-xs">$</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0.80"
                                max="2.50"
                                value={salePrice}
                                onChange={(e) => setSalePrice(parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Variable 3: Costo de Producción de Planta */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                            <label className="font-bold text-slate-700 uppercase text-[11px]">
                                Costo Planta (MP + Proceso + Empaque):
                            </label>
                            <span className="font-mono font-bold text-slate-900 text-xs">
                                ${parseFloat(plantCost).toFixed(4)} / lb
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-bold text-xs">$</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0.50"
                                max="2.00"
                                value={plantCost}
                                onChange={(e) => setPlantCost(parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Variable 4: Tarifa de Comisión por Libra */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                            <label className="font-bold text-slate-700 uppercase text-[11px]">
                                Tarifa de Comisión por Libra:
                            </label>
                            <span className="font-mono font-bold text-emerald-700 text-xs">
                                {(parseFloat(ratePerLb) * 100).toFixed(2)} ¢ / lb (${parseFloat(ratePerLb).toFixed(4)})
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { label: '1.0 ¢ / lb', val: 0.0100 },
                                { label: '1.5 ¢ / lb', val: 0.0150 },
                                { label: '2.0 ¢ / lb', val: 0.0200 }
                            ].map((item) => (
                                <button
                                    key={item.val}
                                    type="button"
                                    onClick={() => setRatePerLb(item.val)}
                                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                                        Math.abs(ratePerLb - item.val) < 0.0001
                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-black shadow-2xs'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Variable 5: Candado del Tope */}
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-amber-900 uppercase flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-amber-700" />
                                <span>Tope de Comisión Fijo:</span>
                            </span>
                            <span className="font-mono font-black text-amber-900 text-xs">$1,000.00</span>
                        </div>
                        <p className="text-[10px] text-amber-700">
                            Regla de negocio: la comisión no puede exceder los $1,000.00 independientemente del volumen.
                        </p>
                    </div>
                </div>

                {/* RESULTADOS EN TIEMPO REAL & TERMÓMETRO DEL TOPE */}
                <div className="lg:col-span-7 space-y-5">
                    {/* BARRA / TERMÓMETRO HACIA EL TOPE DE $1,000 */}
                    <div className={`p-5 rounded-2xl border transition-all shadow-sm ${
                        isCapped
                            ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950'
                            : 'bg-white border-slate-200 text-slate-900'
                    }`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                                <Target className={`w-5 h-5 ${isCapped ? 'text-indigo-600' : 'text-slate-500'}`} />
                                <div>
                                    <span className="text-xs font-bold uppercase tracking-wider block">
                                        Termómetro del Tope de Comisión
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                        Meta salarial máxima mensual por vendedor
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className={`text-lg font-black font-mono ${
                                    isCapped ? 'text-indigo-700' : 'text-slate-900'
                                }`}>
                                    <Money value={res.capped_commission} />
                                </span>
                                <span className="text-xs font-bold text-slate-400 font-mono"> / $1,000.00</span>
                            </div>
                        </div>

                        {/* Barra de Progreso */}
                        <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden border border-slate-200 p-0.5">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                    isCapped
                                        ? 'bg-gradient-to-r from-emerald-500 via-indigo-600 to-indigo-700'
                                        : 'bg-gradient-to-r from-amber-400 to-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, capPct)}%` }}
                            />
                        </div>

                        {/* Estado e Insights */}
                        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5 font-bold">
                                {isCapped ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                                        <span className="text-indigo-900">
                                            ¡TOPE DE $1,000.00 ALCANZADO (100%)!
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <AlertCircle className="w-4 h-4 text-amber-600" />
                                        <span className="text-slate-700">
                                            Progreso actual: <strong className="text-amber-700 font-mono">{capPct}%</strong>
                                        </span>
                                    </>
                                )}
                            </div>

                            <div className="text-slate-600 text-[11px] font-medium">
                                {isCapped ? (
                                    <span className="text-emerald-700 font-bold">
                                        Superávit retenido para ANDELSA: +<Money value={res.excess_commission_retained} />
                                    </span>
                                ) : (
                                    <span>
                                        Faltan <strong className="font-mono text-indigo-600">{Number(res.lbs_remaining_for_cap || 0).toLocaleString()} lb</strong> para los $1,000.
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 4 TARJETAS KPI DE IMPACTO FINANCIERO */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {/* Venta Total */}
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                                Venta Bruta
                            </span>
                            <div className="text-sm font-black text-slate-900 font-mono">
                                <Money value={res.total_sales_amount} />
                            </div>
                            <span className="text-[10px] text-slate-400 block font-medium">
                                {Number(volumeLbs).toLocaleString()} lb
                            </span>
                        </div>

                        {/* Costo Planta */}
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                                Costo Planta
                            </span>
                            <div className="text-sm font-black text-rose-700 font-mono">
                                <Money value={res.total_cost_amount} />
                            </div>
                            <span className="text-[10px] text-slate-400 block font-medium">
                                ${(plantCost).toFixed(2)}/lb
                            </span>
                        </div>

                        {/* Margen Bruto Empresa */}
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                                Margen Bruto
                            </span>
                            <div className="text-sm font-black text-indigo-700 font-mono">
                                <Money value={res.company_gross_margin} />
                            </div>
                            <span className="text-[10px] text-indigo-600 block font-bold">
                                {parseFloat(res.company_margin_pct || 0).toFixed(1)}% margen
                            </span>
                        </div>

                        {/* Utilidad Neta Empresa (después de comisión) */}
                        <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 shadow-2xs space-y-1">
                            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide block">
                                Utilidad Neta
                            </span>
                            <div className="text-sm font-black text-emerald-800 font-mono">
                                <Money value={res.company_net_margin} />
                            </div>
                            <span className="text-[10px] text-emerald-700 block font-bold">
                                Post-comisión
                            </span>
                        </div>
                    </div>

                    {/* COMPARATIVA DIRECTA: SIN TOPE vs CON TOPE */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
                                Impacto del Tope Salarial de $1,000:
                            </span>
                            <p className="text-[11px] text-slate-500">
                                Comisión matemática pura vs. Comisión real pagada por nómina.
                            </p>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                            <div>
                                <span className="text-[10px] text-slate-400 block font-bold uppercase">Sin Tope (Pura)</span>
                                <span className={`font-mono font-bold text-xs ${isCapped ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                    <Money value={res.raw_commission} />
                                </span>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-300" />
                            <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                                <span className="text-[10px] text-indigo-700 block font-bold uppercase">Con Tope ($1,000)</span>
                                <span className="font-mono font-black text-sm text-indigo-900">
                                    <Money value={res.capped_commission} />
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* TABLA DE SENSIBILIDAD AUTOMÁTICA */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-indigo-600" />
                            <span>Matriz de Sensibilidad de Volumen & Tope</span>
                        </h3>
                        <p className="text-[11px] text-slate-500">
                            Comportamiento financiero paso a paso según diferentes niveles de libras vendidas.
                        </p>
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
                        Tarifa actual: ${(ratePerLb * 100).toFixed(2)} ¢ / lb
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead>
                            <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase">
                                <th className="p-2.5">Volumen (lb)</th>
                                <th className="p-2.5 text-right">Venta Bruta</th>
                                <th className="p-2.5 text-right">Margen Bruto</th>
                                <th className="p-2.5 text-right">Comisión Pura</th>
                                <th className="p-2.5 text-right bg-indigo-50/50">Comisión Tope ($1K)</th>
                                <th className="p-2.5 text-center">Estado Tope</th>
                                <th className="p-2.5 text-right text-emerald-800">Utilidad ANDELSA</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                            {table.map((row, idx) => {
                                const isCurrent = Math.abs(row.lbs - volumeLbs) < 500;
                                return (
                                    <tr
                                        key={idx}
                                        className={`transition-colors ${
                                            isCurrent
                                                ? 'bg-indigo-50/80 font-bold text-indigo-950'
                                                : row.is_capped
                                                ? 'hover:bg-slate-50/80'
                                                : 'hover:bg-slate-50'
                                        }`}
                                    >
                                        <td className="p-2.5 font-mono">
                                            {Number(row.lbs).toLocaleString()} lb
                                            {row.lbs === res.lbs_needed_for_cap && (
                                                <span className="ml-2 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-black uppercase">
                                                    Punto Tope
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-2.5 text-right font-mono">
                                            <Money value={row.sales_amount} />
                                        </td>
                                        <td className="p-2.5 text-right font-mono text-indigo-700 font-bold">
                                            <Money value={row.gross_margin} />
                                        </td>
                                        <td className="p-2.5 text-right font-mono text-slate-500">
                                            <Money value={row.raw_commission} />
                                        </td>
                                        <td className="p-2.5 text-right font-mono font-black text-indigo-900 bg-indigo-50/50">
                                            <Money value={row.capped_commission} />
                                        </td>
                                        <td className="p-2.5 text-center">
                                            {row.is_capped ? (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                                                    TOPADO ($1,000)
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                    En Progreso
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-2.5 text-right font-mono font-black text-emerald-700">
                                            <Money value={row.net_company_margin} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
