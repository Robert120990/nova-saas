import { Sun, BatteryCharging, DollarSign, Activity } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import Money from '../ui/Money';

export default function EnergyAnalyticsCards({ period, summary = {} }) {
    const hasBatteries = !!summary.hasBatteries;
    const totalSolar = period === 'day' ? (summary.solarGeneratedKwh || 0) : (summary.totalSolarKwh || 0);
    const totalSavings = summary.totalSavingsUsd || summary.solarSavingsUsd || 0;
    const solarRate = summary.solarRate || 0.17;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Generación Solar Inversores */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">
                        {period === 'day' ? 'Generación Inversores Día' : (period === 'month' ? 'Generación Solar Mes' : 'Generación Solar Año')}
                    </span>
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                        <Sun className="w-4 h-4" />
                    </div>
                </div>
                <div className="mt-3">
                    <span className="text-2xl font-black text-slate-800 dark:text-slate-100">
                        {period === 'year' 
                            ? `${(summary.totalSolarMwh || 0).toFixed(1)} MWh`
                            : `${totalSolar.toLocaleString('en-US')} kWh`
                        }
                    </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                    {period === 'day' && `Pico solar: ${(summary.maxSolarPowerKw || 0).toFixed(1)} kW`}
                    {period === 'month' && `Promedio: ${(summary.avgDailySolarKwh || 0).toFixed(1)} kWh/día`}
                    {period === 'year' && `Promedio: ${(summary.avgMonthlySolarKwh ? (summary.avgMonthlySolarKwh / 1000).toFixed(1) : 0)} MWh/mes`}
                </p>
            </div>

            {/* 2. Descarga Banco Baterías BESS */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">
                        {period === 'day' ? 'Descarga Baterías BESS' : (period === 'month' ? 'Descarga BESS Mes' : 'Descarga BESS Año')}
                    </span>
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        <BatteryCharging className="w-4 h-4" />
                    </div>
                </div>
                <div className="mt-3">
                    <span className={`text-2xl font-black ${hasBatteries ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 text-lg'}`}>
                        {hasBatteries ? (
                            period === 'year'
                                ? `${(summary.totalBatteryMwh || 0).toFixed(1)} MWh`
                                : `${(period === 'day' ? summary.batteryDischargedKwh : (summary.monthDischargedKwh || summary.totalBatteryKwh || 0))?.toLocaleString('en-US')} kWh`
                        ) : (
                            'No Aplica'
                        )}
                    </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                    {hasBatteries ? (
                        <>
                            {period === 'day' && `Potencia pico: ${(summary.batteryDischargeKw || 0).toFixed(1)} kW (SoC ${summary.socPct || 0}%)`}
                            {period === 'month' && `Promedio: ${(summary.avgDailyBatteryKwh || 0).toFixed(1)} kWh/día en hora pico`}
                            {period === 'year' && `${(summary.yearDischargedKwh || summary.totalBatteryKwh || 0).toLocaleString('en-US')} kWh en hora pico`}
                        </>
                    ) : (
                        'Localidad sin almacenamiento BESS'
                    )}
                </p>
            </div>

            {/* 3. Ahorro Económico Estimado */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">
                        Ahorro Total Estimado
                    </span>
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                        <DollarSign className="w-4 h-4" />
                    </div>
                </div>
                <div className="mt-3">
                    <span className="text-2xl font-black text-slate-800 dark:text-slate-100">
                        <Money amount={totalSavings} />
                    </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                    {hasBatteries ? (
                        <>Solar: <strong className="text-slate-700 dark:text-slate-300"><Money amount={summary.solarSavingsUsd || 0} /></strong> &bull; BESS: <strong className="text-purple-600 dark:text-purple-400"><Money amount={summary.peakSavingsUsd || 0} /></strong></>
                    ) : (
                        `Valorizado a $${solarRate.toFixed(2)} / kWh solar`
                    )}
                </p>
            </div>

            {/* 4. Rendimiento / Récord */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">
                        Rendimiento Destacado
                    </span>
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                        <Activity className="w-4 h-4" />
                    </div>
                </div>
                <div className="mt-3">
                    <span className="text-xl font-bold text-slate-800 dark:text-slate-100">
                        {period === 'day' && `${(summary.maxSolarPowerKw || 0).toFixed(1)} kW`}
                        {period === 'month' && (summary.bestDay ? `${summary.bestDay.kwh.toFixed(0)} kWh` : 'N/D')}
                        {period === 'year' && (summary.bestMonth ? `${summary.bestMonth.name}` : 'N/D')}
                    </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                    {period === 'day' && 'Inyección instantánea máxima solar'}
                    {period === 'month' && (summary.bestDay ? `Día récord: ${formatDate(summary.bestDay.date)}` : 'Sin registros')}
                    {period === 'year' && (summary.bestMonth ? `Mes récord: ${(summary.bestMonth.kwh / 1000).toFixed(1)} MWh` : 'Sin registros')}
                </p>
            </div>
        </div>
    );
}
