import Money from '../ui/Money';
import { Sun, CheckCircle2, XCircle, Zap } from 'lucide-react';

export default function EnergyInvertersTable({ growattData }) {
    const plants = growattData?.plants || [];
    const totalNominal = growattData?.totalNominalKw ?? (plants.length > 0 ? plants.reduce((sum, p) => sum + (p.nominalPower || 0), 0) : 0);
    const totalPac = growattData?.totalPacKw || 0;
    const totalToday = growattData?.totalTodayKwh || 0;
    const totalRevenue = growattData?.totalRevenueUsd || 0;

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        <Sun className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                Plantas Fotovoltaicas (Inversores Growatt)
                            </h3>
                            {growattData?.isFallback && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                    Telemetría Sincronizada
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500">
                            Capacidad Total Instalada: <strong>{totalNominal > 0 ? `${totalNominal} kWp` : '—'}</strong>
                            {growattData?.fallbackNotice && (
                                <span className="ml-2 text-slate-400 font-normal hidden sm:inline">&bull; {growattData.fallbackNotice}</span>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1">
                        <Zap className="w-4 h-4 text-amber-500" />
                        Potencia Total: <strong>{totalPac.toFixed(1)} kW</strong>
                    </span>
                    <span className="hidden sm:inline">|</span>
                    <span>
                        Hoy: <strong>{totalToday.toFixed(1)} kWh</strong>
                    </span>
                    <span className="hidden sm:inline">|</span>
                    <span>
                        Ingresos Acumulados: <strong><Money value={totalRevenue} /></strong>
                    </span>
                </div>
            </div>

            {plants.length === 0 ? (
                <div className="mt-4 p-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                    <Sun className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        {growattData?.error ? `Error: ${growattData.error}` : 'No se encontraron plantas fotovoltaicas para esta localidad.'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                        Verifique que la planta esté asignada correctamente en la configuración o use el botón Sincronizar Ahora.
                    </p>
                </div>
            ) : (
                <div className="mt-4 space-y-4">
                    <div className={`grid grid-cols-1 ${plants.length > 1 ? 'md:grid-cols-2' : ''} gap-4`}>
                        {plants.map((plant) => {
                            const inverters = Array.isArray(plant.inverters) ? [...plant.inverters] : [];
                            inverters.sort((a, b) => {
                                if (a.status !== b.status) return a.status === 'online' ? -1 : 1;
                                return String(b.lastUpdateTime || '').localeCompare(String(a.lastUpdateTime || ''));
                            });
                            const totalInvCount = plant.totalInverters ?? inverters.length;

                            return (
                                <div
                                    key={plant.id}
                                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-amber-400/50 transition-all flex flex-col justify-between gap-4"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                                    {plant.name}
                                                </h4>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    {totalInvCount > 0
                                                        ? `${plant.onlineNum} / ${totalInvCount} Inversores Activos`
                                                        : `${plant.onlineNum} Inversores Activos`}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                ID Planta: {plant.id} &bull; {plant.accountName}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 text-center">
                                        <div>
                                            <span className="block text-[10px] font-bold uppercase text-slate-400">Potencia Actual</span>
                                            <strong className="text-base font-black text-amber-600 dark:text-amber-400">
                                                {plant.currentPacKw?.toFixed(1) || 0} kW
                                            </strong>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-bold uppercase text-slate-400">Generación Hoy</span>
                                            <strong className="text-base font-black text-slate-700 dark:text-slate-200">
                                                {plant.eTodayKwh?.toFixed(1) || 0} kWh
                                            </strong>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-bold uppercase text-slate-400">Total Histórico</span>
                                            <strong className="text-base font-black text-slate-600 dark:text-slate-300">
                                                {((plant.eTotalKwh || 0) / 1000).toFixed(1)} MWh
                                            </strong>
                                        </div>
                                    </div>

                                    {inverters.length > 0 && (
                                        <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 overflow-x-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead>
                                                    <tr className="text-[10px] font-bold uppercase text-slate-400 border-b border-slate-200/70 dark:border-slate-700/70">
                                                        <th className="py-1.5 pr-3">Inversor / Serie</th>
                                                        <th className="py-1.5 px-2">Modelo</th>
                                                        <th className="py-1.5 px-2">Estado</th>
                                                        <th className="py-1.5 px-2 text-right">Potencia</th>
                                                        <th className="py-1.5 px-2 text-right">Hoy</th>
                                                        <th className="py-1.5 pl-2 text-right">Última Lectura</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200/50 dark:divide-slate-700/50">
                                                    {inverters.map((inv) => {
                                                        const isOnline = inv.status === 'online';
                                                        return (
                                                            <tr key={inv.sn || inv.alias} className="hover:bg-white/60 dark:hover:bg-slate-800/60">
                                                                <td className="py-2 pr-3">
                                                                    <div className="font-bold text-slate-800 dark:text-slate-100">{inv.alias}</div>
                                                                    <div className="text-[10px] font-mono text-slate-400">{inv.sn}</div>
                                                                </td>
                                                                <td className="py-2 px-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                                    {inv.model}
                                                                </td>
                                                                <td className="py-2 px-2 whitespace-nowrap">
                                                                    {isOnline ? (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                                                            <CheckCircle2 className="w-3 h-3" />
                                                                            En línea
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                                                            <XCircle className="w-3 h-3" />
                                                                            Desconectado
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="py-2 px-2 text-right font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                                                                    {Number(inv.pacKw || 0).toFixed(2)} kW
                                                                </td>
                                                                <td className="py-2 px-2 text-right font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                                                    {Number(inv.eTodayKwh || 0).toFixed(1)} kWh
                                                                </td>
                                                                <td className="py-2 pl-2 text-right text-[11px] text-slate-500 whitespace-nowrap">
                                                                    {inv.lastUpdateTime || '—'}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
