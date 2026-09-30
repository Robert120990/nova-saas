import Money from '../ui/Money';
import { Sun, CheckCircle2, Zap } from 'lucide-react';

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
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            Plantas Fotovoltaicas (Inversores Growatt)
                        </h3>
                        <p className="text-xs text-slate-500">
                            Capacidad Total Instalada: <strong>{totalNominal > 0 ? `${totalNominal} kWp` : '—'}</strong>
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
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {plants.map((plant) => (
                        <div 
                            key={plant.id} 
                            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-amber-400/50 transition-all flex flex-col justify-between"
                        >
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                        {plant.name}
                                    </h4>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        {plant.onlineNum} Inversores Activos
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    ID Planta: {plant.id} &bull; {plant.accountName}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 text-center">
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
                    </div>
                ))}
            </div>
            )}
        </div>
    );
}
