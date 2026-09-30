import { 
    Sun, 
    Battery, 
    BatteryCharging, 
    Zap, 
    Factory, 
    ShieldCheck, 
    Clock
} from 'lucide-react';

export default function EnergyFlowDiagram({ liveData, isPeakHour }) {
    const summary = liveData?.summary || {};
    const config = liveData?.config || {};
    const solarKw = summary.solarPowerKw || 0;
    const batKw = summary.batteryPowerKw || 0;
    const gridKw = summary.gridPowerKw || 0;
    const loadKw = summary.loadPowerKw || 0;
    const soc = summary.socPct || 0;
    const batState = summary.batteryState || 'idle';

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            {/* Cabecera del Sinóptico */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        Diagrama de Flujo Energético en Vivo
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Interconexión entre Generación Solar (Growatt), Red / Poste y Banco de Baterías (GESS)
                    </p>
                </div>

                {/* Banner de Estado Tarifario */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                    !summary.hasBatteries
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        : isPeakHour
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 animate-pulse'
                        : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                }`}>
                    {!summary.hasBatteries ? (
                        <>
                            <Sun className="w-4 h-4 text-amber-500" />
                            <span>
                                <strong>GENERACIÓN FOTOVOLTAICA DIRECTA</strong>: Suministro solar continuo a consumo local ({liveData?.company?.plantName || 'Planta Solar'})
                            </span>
                        </>
                    ) : (
                        <>
                            <Clock className="w-4 h-4" />
                            {isPeakHour ? (
                                <span>
                                    <strong>HORA PICO ACTIVA ({config.peakStartTime?.slice(0, 5)} - {config.peakEndTime?.slice(0, 5)})</strong>: Suministro prioritario desde baterías
                                </span>
                            ) : (
                                <span>
                                    <strong>HORA VALLE / REGULAR</strong>: Acumulación de energía y carga de baterías
                                </span>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Diagrama Sinóptico Interactivo */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                
                {/* Columna Izquierda: Fuentes Primarias (Solar + Red) */}
                <div className="flex flex-col gap-6">
                    {/* Nodo 1: Paneles Solares */}
                    <div className="relative p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border-2 border-amber-500/30 hover:border-amber-500 transition-all">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
                                    <Sun className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">Paneles Solares</h4>
                                    <p className="text-[11px] text-slate-500">Inversores Growatt</p>
                                </div>
                            </div>
                            <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                                {solarKw.toFixed(1)} <span className="text-xs font-medium">kW</span>
                            </span>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
                            <span>Hoy: {summary.solarTodayKwh?.toFixed(1) || 0} kWh</span>
                            <span className="text-emerald-600 font-semibold">Generando</span>
                        </div>
                    </div>

                    {/* Nodo 2: Red Eléctrica / Poste */}
                    <div className="relative p-4 rounded-2xl bg-blue-500/5 dark:bg-blue-500/10 border-2 border-blue-500/30 hover:border-blue-500 transition-all">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2.5 rounded-xl bg-blue-500 text-white shadow-md shadow-blue-500/20">
                                    <Zap className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">Red / Poste</h4>
                                    <p className="text-[11px] text-slate-500">Acometida Eléctrica</p>
                                </div>
                            </div>
                            <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                                {summary.hasBatteries ? Math.abs(gridKw).toFixed(1) : (solarKw > 0 ? 'Conectada' : '0.0')} <span className="text-xs font-medium">{summary.hasBatteries ? 'kW' : ''}</span>
                            </span>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
                            <span>Tarifa: ${config.peakRate || 0.22}/kWh pico</span>
                            <span className="font-semibold text-slate-600 dark:text-slate-400">
                                {summary.hasBatteries ? (gridKw >= 0 ? 'Entregando a Planta' : 'Inyección Excedente') : 'Interconexión Activa'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Columna Centro: Banco de Baterías O Inyección Directa */}
                {!summary.hasBatteries ? (
                    <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border-2 border-dashed border-amber-400/40 relative">
                        <div className="w-full flex items-center justify-between mb-3">
                            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-amber-500" />
                                Inyección Fotovoltaica
                            </span>
                            <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                Directo a Red / Carga
                            </span>
                        </div>

                        <div className="my-2 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 shadow-sm w-full text-center">
                            <div className="flex items-center justify-center gap-3">
                                <Sun className="w-10 h-10 text-amber-500" />
                                <div className="text-left">
                                    <span className="text-3xl font-black text-slate-800 dark:text-slate-100">
                                        {solarKw.toFixed(1)} <span className="text-sm font-semibold text-slate-500">kW</span>
                                    </span>
                                    <p className="text-[11px] font-semibold text-slate-500">
                                        Aporte Fotovoltaico
                                    </p>
                                </div>
                            </div>

                            <div className="mt-3 p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 text-xs text-amber-800 dark:text-amber-300 border border-amber-200/50">
                                <strong>Sin Banco de Baterías</strong>: La energía solar se consume directamente en la localidad durante las horas diurnas.
                            </div>
                        </div>

                        <p className="text-[11px] text-slate-500 mt-2 text-center">
                            ☀️ Generación limpia que reduce directamente la facturación diurna.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border-2 border-dashed border-indigo-400/40 relative">
                        <div className="w-full flex items-center justify-between mb-3">
                            <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                                Banco Baterías {liveData?.company?.name || 'ANDELSA'}
                            </span>
                            <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                513.6 kWh
                            </span>
                        </div>

                        <div className="my-2 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 shadow-sm w-full text-center">
                            <div className="flex items-center justify-center gap-3">
                                {batState === 'charging' ? (
                                    <BatteryCharging className="w-10 h-10 text-emerald-500 animate-pulse" />
                                ) : batState === 'discharging' ? (
                                    <Battery className="w-10 h-10 text-purple-600" />
                                ) : (
                                    <Battery className="w-10 h-10 text-blue-600" />
                                )}
                                <div className="text-left">
                                    <span className="text-3xl font-black text-slate-800 dark:text-slate-100">
                                        {soc}%
                                    </span>
                                    <p className="text-[11px] font-semibold text-slate-500">
                                        Capacidad Almacenada (SoC)
                                    </p>
                                </div>
                            </div>

                            {/* Barra de progreso de carga */}
                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full mt-3 overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-500 ${
                                        soc >= 80 ? 'bg-emerald-500' :
                                        soc >= 40 ? 'bg-blue-500' :
                                        soc >= 20 ? 'bg-amber-500' : 'bg-rose-500'
                                    }`} 
                                    style={{ width: `${Math.min(soc, 100)}%` }} 
                                />
                            </div>

                            <div className="mt-3 flex items-center justify-around text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
                                <div>
                                    <span className="block text-[10px] uppercase text-slate-400">Potencia</span>
                                    <strong className={batKw > 0 ? 'text-emerald-600' : batKw < 0 ? 'text-purple-600' : 'text-slate-600'}>
                                        {batKw > 0 ? `+${batKw.toFixed(1)} kW (Cargando)` : batKw < 0 ? `${batKw.toFixed(1)} kW (Descarga)` : '0.0 kW (Reposo)'}
                                    </strong>
                                </div>
                                <div className="border-l border-slate-200 dark:border-slate-700 pl-3">
                                    <span className="block text-[10px] uppercase text-slate-400">Descargado Hoy</span>
                                    <strong className="text-indigo-600 dark:text-indigo-400">
                                        {summary.batteryDischargedTodayKwh?.toFixed(1) || 0} kWh
                                    </strong>
                                </div>
                            </div>
                        </div>

                        <p className="text-[11px] text-slate-500 mt-2 text-center">
                            {isPeakHour 
                                ? '⚡ Entregando energía a la planta para reducir cobro en hora punta.' 
                                : '🔋 Almacenando energía diurna para suministrar en la noche.'}
                        </p>
                    </div>
                )}

                {/* Columna Derecha: Consumo Total de Planta */}
                <div className="flex flex-col gap-6">
                    <div className="relative p-5 rounded-2xl bg-purple-500/5 dark:bg-purple-500/10 border-2 border-purple-500/30 hover:border-purple-500 transition-all">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-md shadow-purple-600/20">
                                    <Factory className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">Carga Planta</h4>
                                    <p className="text-[11px] text-slate-500">Demanda {liveData?.company?.name || 'Localidad'}</p>
                                </div>
                            </div>
                            <span className="text-xl font-black text-purple-700 dark:text-purple-300">
                                {loadKw.toFixed(1)} <span className="text-xs font-medium">kW</span>
                            </span>
                        </div>
                        <div className="mt-3 text-xs text-slate-600 dark:text-slate-400 border-t border-purple-200/40 dark:border-purple-800/40 pt-2 space-y-1">
                            <div className="flex justify-between text-[11px]">
                                <span>Aporte Solar:</span>
                                <strong>{solarKw > 0 ? `${solarKw.toFixed(1)} kW` : '0 kW'}</strong>
                            </div>
                            <div className="flex justify-between text-[11px]">
                                <span>Aporte Batería:</span>
                                <strong>{summary.hasBatteries ? (batKw < 0 ? `${Math.abs(batKw).toFixed(1)} kW` : '0 kW') : '0 kW (Sin Baterías)'}</strong>
                            </div>
                            <div className="flex justify-between text-[11px]">
                                <span>Aporte Red/Poste:</span>
                                <strong>{summary.hasBatteries ? (gridKw > 0 ? `${gridKw.toFixed(1)} kW` : '0 kW') : 'Red de Apoyo'}</strong>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
