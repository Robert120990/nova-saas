import { Sun, BatteryCharging, DollarSign, Activity } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import Money from '../ui/Money';

export default function EnergyAnalyticsCards({ period, summary }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Generación Solar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">
                        {period === 'day' ? 'Generación Solar Día' : (period === 'month' ? 'Solar Mes Acumulado' : 'Solar Año Acumulado')}
                    </span>
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                        <Sun className="w-4 h-4" />
                    </div>
                </div>
                <div className="mt-3">
                    <span className="text-2xl font-black text-slate-800 dark:text-slate-100">
                        {period === 'year' 
                            ? `${(summary.totalSolarMwh || 0).toFixed(1)} MWh`
                            : `${((period === 'day' ? summary.solarGeneratedKwh : summary.totalSolarKwh) || 0).toLocaleString('en-US')} kWh`
                        }
                    </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                    {period === 'day' && `Pico máximo: ${(summary.maxSolarPowerKw || 0).toFixed(1)} kW`}
                    {period === 'month' && `Promedio diario: ${(summary.avgDailySolarKwh || 0).toFixed(1)} kWh/día`}
                    {period === 'year' && `Promedio mensual: ${(summary.avgMonthlySolarKwh ? (summary.avgMonthlySolarKwh / 1000).toFixed(1) : 0)} MWh/mes`}
                </p>
            </div>

            {/* 2. Banco de Baterías */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">
                        Baterías (ANDELSA)
                    </span>
                    <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
                        <BatteryCharging className="w-4 h-4" />
                    </div>
                </div>
                <div className="mt-3">
                    <span className="text-2xl font-black text-slate-800 dark:text-slate-100">
                        {period === 'day' && `${(summary.batteryDischargedKwh || 0).toFixed(1)} kWh`}
                        {period === 'month' && `${((summary.monthDischargedKwh || 0) / 1000).toFixed(2)} MWh`}
                        {period === 'year' && `${((summary.yearDischargedKwh || 0) / 1000).toFixed(2)} MWh`}
                    </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                    {period === 'day' && `Descarga en pico (Carga: ${(summary.batteryChargedKwh || 0).toFixed(1)} kWh)`}
                    {period === 'month' && `Descarga mes (Carga: ${((summary.monthChargedKwh || 0) / 1000).toFixed(2)} MWh)`}
                    {period === 'year' && `Descarga año (Carga: ${((summary.yearChargedKwh || 0) / 1000).toFixed(2)} MWh)`}
                </p>
            </div>

            {/* 3. Ahorro Estimado Total */}
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
                        <Money amount={summary.totalSavingsUsd || 0} />
                    </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>Solar: <Money amount={summary.solarSavingsUsd || 0} /></span>
                    <span>Pico Batería: <Money amount={summary.peakSavingsUsd || 0} /></span>
                </div>
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
                    {period === 'day' && `Potencia instantánea máxima`}
                    {period === 'month' && (summary.bestDay ? `Día récord: ${formatDate(summary.bestDay.date)}` : 'Sin registros')}
                    {period === 'year' && (summary.bestMonth ? `Mes récord: ${(summary.bestMonth.kwh / 1000).toFixed(1)} MWh` : 'Sin registros')}
                </p>
            </div>
        </div>
    );
}
