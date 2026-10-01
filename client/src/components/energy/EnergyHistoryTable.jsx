import Money from '../ui/Money';
import { formatDateTime } from '../../utils/dateUtils';
import { History, Calendar, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

export default function EnergyHistoryTable({ 
    readings, 
    total, 
    page, 
    totalPages, 
    onPageChange, 
    startDate, 
    endDate, 
    onStartDateChange, 
    onEndDateChange,
    isLoading 
}) {
    const list = Array.isArray(readings) ? readings : [];

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                        <History className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            Historial de Evaluaciones y Lecturas Energéticas
                        </h3>
                        <p className="text-xs text-slate-500">
                            Registros automáticos cada 4 horas y lecturas manuales en vivo
                        </p>
                    </div>
                </div>

                {/* Filtros de Fecha */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-xl text-xs">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-500 font-medium">Desde:</span>
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => onStartDateChange(e.target.value)}
                            className="bg-transparent border-none text-xs font-semibold focus:outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-xl text-xs">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-500 font-medium">Hasta:</span>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={(e) => onEndDateChange(e.target.value)}
                            className="bg-transparent border-none text-xs font-semibold focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Tabla con scroll defensivo */}
            <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                            <th className="py-2.5 px-3">Fecha y Hora</th>
                            <th className="py-2.5 px-3">Origen</th>
                            <th className="py-2.5 px-3 text-right">Potencia Solar</th>
                            <th className="py-2.5 px-3 text-right">Solar Hoy</th>
                            <th className="py-2.5 px-3 text-center">Batería SoC</th>
                            <th className="py-2.5 px-3 text-right">Potencia Batería</th>
                            <th className="py-2.5 px-3 text-right">Descarga Pico</th>
                            <th className="py-2.5 px-3 text-right">Carga Planta</th>
                            <th className="py-2.5 px-3 text-right">Ahorro Estimado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {isLoading ? (
                            <tr>
                                <td colSpan="9" className="py-8 text-center text-slate-400">
                                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                                    Cargando historial de lecturas...
                                </td>
                            </tr>
                        ) : list.length === 0 ? (
                            <tr>
                                <td colSpan="9" className="py-8 text-center text-slate-400">
                                    No se encontraron lecturas registradas para los filtros seleccionados.
                                </td>
                            </tr>
                        ) : (
                            list.map((r) => {
                                const isPeak = r.is_peak_hour === 1;
                                const batPow = parseFloat(r.gess_battery_power_kw) || 0;
                                return (
                                    <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                            {formatDateTime(r.reading_time)}
                                        </td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                r.source === 'auto'
                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                                    : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                                            }`}>
                                                {r.source === 'auto' ? 'Auto (4h)' : 'Manual'}
                                            </span>
                                            {isPeak && (
                                                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                                    PICO
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-black text-amber-600 dark:text-amber-400 whitespace-nowrap">
                                            {parseFloat(r.growatt_pac_kw || 0).toFixed(1)} kW
                                        </td>
                                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                            {parseFloat(r.growatt_today_kwh || 0).toFixed(1)} kWh
                                        </td>
                                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                            <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                                                {parseFloat(r.gess_soc_pct || 0).toFixed(0)}%
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                            <span className={batPow > 0 ? 'text-emerald-600 font-bold' : batPow < 0 ? 'text-purple-600 font-bold' : 'text-slate-400'}>
                                                {batPow > 0 ? `+${batPow.toFixed(1)} kW` : batPow < 0 ? `${batPow.toFixed(1)} kW` : '0.0 kW'}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-bold text-purple-700 dark:text-purple-300 whitespace-nowrap">
                                            {parseFloat(r.gess_day_discharged_kwh || 0).toFixed(1)} kWh
                                        </td>
                                        <td className="py-2.5 px-3 text-right whitespace-nowrap text-slate-700 dark:text-slate-300">
                                            {parseFloat(r.gess_load_power_kw || 0).toFixed(1)} kW
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-black text-indigo-700 dark:text-indigo-400 whitespace-nowrap">
                                            <Money value={r.estimated_savings_today_usd || 0} />
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                    <span>Total registros: <strong>{total}</strong></span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onPageChange(page - 1)}
                            disabled={page <= 1}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span>Página <strong>{page}</strong> de {totalPages}</span>
                        <button
                            onClick={() => onPageChange(page + 1)}
                            disabled={page >= totalPages}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
