import Money from '../ui/Money';
import { 
    Sun, 
    Battery, 
    BatteryCharging, 
    Zap, 
    Factory, 
    TrendingUp, 
    DollarSign,
    Moon
} from 'lucide-react';

export default function EnergySummaryCards({ liveData, isPeakHour }) {
    const summary = liveData?.summary || {};
    const solarKw = summary.solarPowerKw || 0;
    const batKw = summary.batteryPowerKw || 0;
    const gridKw = summary.gridPowerKw || 0;
    const loadKw = summary.loadPowerKw || 0;
    const soc = summary.socPct || 0;
    const solarToday = summary.solarTodayKwh || 0;
    const batDischarged = summary.batteryDischargedTodayKwh || 0;
    const savingsUsd = summary.totalEstimatedSavingsUsd || 0;
    const batState = summary.batteryState || 'idle';

    const getSocColor = (val) => {
        if (val >= 80) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
        if (val >= 40) return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
        if (val >= 20) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
        return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Potencia Solar Actual */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Generación Solar
                    </span>
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        <Sun className="w-5 h-5 animate-spin-slow" />
                    </div>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-800 dark:text-slate-100">
                        {solarKw.toFixed(1)}
                    </span>
                    <span className="text-sm font-semibold text-slate-500">kW</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>Hoy: <strong>{solarToday.toFixed(1)} kWh</strong></span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                        <TrendingUp className="w-3.5 h-3.5" /> En Vivo
                    </span>
                </div>
            </div>

            {/* 2. Banco de Baterías (SoC & Flujo) O Aporte Solar Directo si no tiene baterías */}
            {!summary.hasBatteries ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Aporte Solar Histórico
                        </span>
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            <Sun className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-3xl font-black text-slate-800 dark:text-slate-100">
                            {((liveData?.growatt?.totalKwh || 0) / 1000).toFixed(1)}
                        </span>
                        <span className="text-sm font-semibold text-slate-500">MWh</span>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-full ml-auto">
                            Solo Solar (Sin Baterías)
                        </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>Generado Hoy: <strong>{solarToday.toFixed(1)} kWh</strong></span>
                        <span className="font-semibold text-emerald-600">Autoconsumo</span>
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Banco Baterías (SoC)
                        </span>
                        <div className={`p-2 rounded-xl border ${getSocColor(soc)}`}>
                            {batState === 'charging' ? (
                                <BatteryCharging className="w-5 h-5 animate-pulse" />
                            ) : (
                                <Battery className="w-5 h-5" />
                            )}
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-slate-800 dark:text-slate-100">
                            {soc}%
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            batState === 'charging'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                : batState === 'discharging'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                            {batState === 'charging' ? `+${batKw.toFixed(1)} kW Carga` :
                             batState === 'discharging' ? `${batKw.toFixed(1)} kW Descarga` : 'En Espera'}
                        </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>Descarga Pico: <strong>{batDischarged.toFixed(1)} kWh</strong></span>
                        <span className="font-medium text-slate-400">513.6 kWh Cap.</span>
                    </div>
                </div>
            )}

            {/* 3. Red Eléctrica / Poste & Consumo Planta */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        {summary.hasBatteries ? 'Red Eléctrica / Planta' : 'Aporte a Instalación'}
                    </span>
                    <div className={`p-2 rounded-xl border ${
                        gridKw > 0 
                            ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' 
                            : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
                    }`}>
                        <Zap className="w-5 h-5" />
                    </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-800 dark:text-slate-100">
                        {summary.hasBatteries ? Math.abs(gridKw).toFixed(1) : solarKw.toFixed(1)}
                    </span>
                    <span className="text-sm font-semibold text-slate-500">kW</span>
                    <span className="text-xs font-bold text-slate-400">
                        {summary.hasBatteries 
                            ? (gridKw >= 0 ? '(Importando Red)' : '(Inyectando Red)')
                            : '(Inyección Directa)'}
                    </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                        <Factory className="w-3.5 h-3.5 text-slate-400" />
                        {summary.hasBatteries ? (
                            <>Carga Planta: <strong>{loadKw.toFixed(1)} kW</strong></>
                        ) : (
                            <>Aporte Fotovoltaico: <strong>{solarKw.toFixed(1)} kW</strong></>
                        )}
                    </span>
                    {isPeakHour ? (
                        <span className="text-rose-600 font-bold flex items-center gap-0.5">
                            <Moon className="w-3.5 h-3.5" /> Hora Pico
                        </span>
                    ) : (
                        <span className="text-slate-400">Tarifa Normal</span>
                    )}
                </div>
            </div>

            {/* 4. Ahorro Estimado Total */}
            <div className="bg-gradient-to-br from-indigo-500/5 via-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                        Ahorro Estimado Hoy
                    </span>
                    <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                        <DollarSign className="w-5 h-5" />
                    </div>
                </div>
                <div className="mt-3 flex items-baseline gap-1 text-indigo-900 dark:text-indigo-100">
                    <span className="text-3xl font-black">
                        <Money value={savingsUsd} />
                    </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                    {summary.hasBatteries ? (
                        <>
                            <span>Por Batería Pico: <strong><Money value={summary.savingsFromBatteryPeakUsd || 0} /></strong></span>
                            <span>Solar: <strong><Money value={summary.savingsFromSolarUsd || 0} /></strong></span>
                        </>
                    ) : (
                        <>
                            <span>100% Fotovoltaico: <strong><Money value={summary.savingsFromSolarUsd || 0} /></strong></span>
                            <span className="text-slate-400">Sin Baterías</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
