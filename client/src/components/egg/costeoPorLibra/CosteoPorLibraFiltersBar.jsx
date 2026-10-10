import { formatDate } from '../../../utils/dateUtils';
import {
    Calendar
} from 'lucide-react';




export default function CosteoPorLibraFiltersBar({ model }) {
    const { dateRange, setDateRange, handlePresetChange, handleCustomDateApply, getPresetLabel } = model;

    return (<div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-900">Período de Análisis & Vigencia</span>
                            <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full text-[10px] font-black uppercase">
                                {getPresetLabel(dateRange.preset)}
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                            {dateRange.startDate && dateRange.endDate
                                ? `Desde ${formatDate(dateRange.startDate + 'T00:00:00')} hasta ${formatDate(dateRange.endDate + 'T00:00:00')}`
                                : 'Mostrando todo el histórico operacional'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
                    {/* Presets Rápidos */}
                    <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex overflow-x-auto whitespace-nowrap scrollbar-none gap-1 w-full sm:w-auto">
                        {(Array.isArray([
                            { id: 'month', label: 'Mes Actual' },
                            { id: '30d', label: '30 Días' },
                            { id: '3m', label: '3 Meses' },
                            { id: 'year', label: 'Año Actual' },
                            { id: 'all', label: 'Todo' }
                        ]) ? [
                            { id: 'month', label: 'Mes Actual' },
                            { id: '30d', label: '30 Días' },
                            { id: '3m', label: '3 Meses' },
                            { id: 'year', label: 'Año Actual' },
                            { id: 'all', label: 'Todo' }
                        ] : []).map((btn) => (
                            <button
                                key={btn.id}
                                type="button"
                                onClick={() => handlePresetChange(btn.id)}
                                className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${dateRange.preset === btn.id
                                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                                    }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    {/* Selector Manual de Fechas */}
                    <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-2 w-full sm:w-auto">
                        <div className="flex items-center gap-1 flex-1 min-w-[125px]">
                            <span className="text-[10px] font-bold uppercase text-slate-400">Desde</span>
                            <input
                                type="date"
                                value={dateRange.startDate}
                                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value, preset: 'custom' }))}
                                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="flex items-center gap-1 flex-1 min-w-[125px]">
                            <span className="text-[10px] font-bold uppercase text-slate-400">Hasta</span>
                            <input
                                type="date"
                                value={dateRange.endDate}
                                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value, preset: 'custom' }))}
                                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleCustomDateApply}
                            className="w-full sm:w-auto justify-center px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold shadow-sm transition-all"
                        >
                            Filtrar
                        </button>
                    </div>
                </div>
            </div>);
}
