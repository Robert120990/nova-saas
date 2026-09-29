import { FileSpreadsheet } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import Money from '../ui/Money';

export default function EnergyAnalyticsDataTable({ period, analyticsData, showTable, onToggleTable }) {
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <button
                onClick={onToggleTable}
                className="w-full flex items-center justify-between p-4 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
                    <span>Ver Tabla de Datos Desglosados ({period === 'day' ? 'Intervalos del Día' : (period === 'month' ? 'Días del Mes' : 'Meses del Año')})</span>
                </div>
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400">
                    {showTable ? 'Ocultar' : 'Mostrar Detalle'}
                </span>
            </button>

            {showTable && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 overflow-x-auto max-h-96">
                    {period === 'month' && (
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 uppercase">
                                <tr>
                                    <th className="py-2.5 px-3">Día</th>
                                    <th className="py-2.5 px-3">Fecha</th>
                                    <th className="py-2.5 px-3 text-right">Solar (kWh)</th>
                                    <th className="py-2.5 px-3 text-right">Ahorro ($)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {(analyticsData?.dailyPoints || []).map(pt => (
                                    <tr key={pt.day} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                        <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">Día {pt.day}</td>
                                        <td className="py-2 px-3 text-slate-500">{formatDate(pt.date)}</td>
                                        <td className="py-2 px-3 text-right font-bold text-amber-600 dark:text-amber-400">{pt.solarKwh.toFixed(1)}</td>
                                        <td className="py-2 px-3 text-right font-medium text-emerald-600"><Money amount={pt.savingsUsd} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {period === 'year' && (
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 uppercase">
                                <tr>
                                    <th className="py-2.5 px-3">Mes</th>
                                    <th className="py-2.5 px-3">Código</th>
                                    <th className="py-2.5 px-3 text-right">Solar (MWh)</th>
                                    <th className="py-2.5 px-3 text-right">Solar (kWh)</th>
                                    <th className="py-2.5 px-3 text-right">Ahorro ($)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {(analyticsData?.monthlyPoints || []).map(pt => (
                                    <tr key={pt.month} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                        <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">{pt.name}</td>
                                        <td className="py-2 px-3 text-slate-500">{pt.monthCode}</td>
                                        <td className="py-2 px-3 text-right font-bold text-purple-600 dark:text-purple-400">{pt.solarMwh.toFixed(2)}</td>
                                        <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">{pt.solarKwh.toLocaleString('en-US')}</td>
                                        <td className="py-2 px-3 text-right font-medium text-emerald-600"><Money amount={pt.savingsUsd} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {period === 'day' && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs">
                            {(analyticsData?.curvePoints || []).filter(p => p.minute === 0).map(pt => (
                                <div key={pt.time} className={`p-2.5 rounded-xl border ${pt.isPeak ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'}`}>
                                    <div className="text-[10px] text-slate-500 font-bold">{pt.time} {pt.isPeak && '(Pico)'}</div>
                                    <div className="text-sm font-black text-slate-800 dark:text-slate-100 mt-0.5">{pt.kw.toFixed(1)} kW</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
