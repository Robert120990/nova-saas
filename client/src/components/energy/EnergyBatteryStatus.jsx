import { BatteryCharging, Cpu, CheckCircle2 } from 'lucide-react';

export default function EnergyBatteryStatus({ gessData }) {
    const nominalCap = gessData?.nominalCap || 513;
    const dayCharged = gessData?.dayChargedKwh || 0;
    const dayDischarged = gessData?.dayDischargedKwh || 0;
    const monthCharged = gessData?.monthChargedKwh || 0;
    const monthDischarged = gessData?.monthDischargedKwh || 0;
    const totalCharged = gessData?.totalChargedKwh || 0;
    const totalDischarged = gessData?.totalDischargedKwh || 0;
    const devices = gessData?.devices || [];

    if (gessData?.enabled === false || gessData?.hasBatteries === false) {
        return (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            <BatteryCharging className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                Banco de Baterías BESS
                            </h3>
                            <p className="text-xs text-slate-500">
                                Estado de almacenamiento energético
                            </p>
                        </div>
                    </div>

                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        Sin Baterías (No Aplica)
                    </span>
                </div>

                <div className="my-6 p-5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-center space-y-3">
                    <div className="inline-flex p-3 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                        <BatteryCharging className="w-8 h-8 opacity-80" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            Generación Fotovoltaica Directa Interconectada a Red
                        </h4>
                        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                            Esta localidad opera con inversores fotovoltaicos solares interconectados directamente al centro de carga. El 100% de la energía solar generada se suministra en tiempo real a las instalaciones, reduciendo de inmediato la factura eléctrica comercial diurna sin requerir banco de baterías.
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/30 px-4 py-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <span>Modalidad de Operación: <strong>Autoconsumo Solar Directo</strong></span>
                    <span className="font-semibold text-emerald-600">Inversores Activos</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                        <BatteryCharging className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            Banco de Baterías y Sistema EMS (GESS SolarWeb)
                        </h3>
                        <p className="text-xs text-slate-500">
                            Planta: <strong>{gessData?.plantName || 'ANDELSA 117kWp 513.638kWh'}</strong>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        Capacidad Nominal: {nominalCap} kW
                    </span>
                </div>
            </div>

            {/* Métricas Acumuladas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-center">
                    <span className="block text-[10px] font-bold uppercase text-slate-400">Cargado Hoy</span>
                    <strong className="text-sm sm:text-base font-black text-blue-600 dark:text-blue-400">
                        {dayCharged.toFixed(1)} kWh
                    </strong>
                </div>

                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 text-center">
                    <span className="block text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400">Suministro Pico Hoy</span>
                    <strong className="text-sm sm:text-base font-black text-purple-700 dark:text-purple-300">
                        {dayDischarged.toFixed(1)} kWh
                    </strong>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-center">
                    <span className="block text-[10px] font-bold uppercase text-slate-400">Cargado Mes</span>
                    <strong className="text-sm sm:text-base font-black text-slate-700 dark:text-slate-200">
                        {(monthCharged / 1000).toFixed(1)} MWh
                    </strong>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-center">
                    <span className="block text-[10px] font-bold uppercase text-slate-400">Descargado Mes</span>
                    <strong className="text-sm sm:text-base font-black text-slate-700 dark:text-slate-200">
                        {(monthDischarged / 1000).toFixed(1)} MWh
                    </strong>
                </div>
            </div>

            {/* Resumen Histórico Total */}
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/20 px-3 py-2 rounded-xl">
                <span>Carga Histórica Total: <strong>{(totalCharged / 1000).toFixed(1)} MWh</strong></span>
                <span>Descarga Histórica Total: <strong>{(totalDischarged / 1000).toFixed(1)} MWh</strong></span>
            </div>

            {/* Dispositivos Físicos del Banco */}
            <div className="mt-5">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-slate-400" />
                    Equipos y Controladores Conectados
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {devices.map((dev) => (
                        <div 
                            key={dev.id} 
                            className="p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs"
                        >
                            <div>
                                <strong className="font-semibold text-slate-800 dark:text-slate-200 block text-[11px]">
                                    {dev.name}
                                </strong>
                                <span className="text-[10px] text-slate-400">
                                    Mod: {dev.model}
                                </span>
                            </div>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="w-3 h-3" />
                                {dev.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
