import { useState, useMemo } from 'react';
import { Search, AlertCircle, AlertTriangle, Info, Wrench, CheckCircle2 } from 'lucide-react';

export const CatalogAuditTab = ({ catalogData, isLoading, onFixAccount }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [severityFilter, setSeverityFilter] = useState('all');

    const anomalies = useMemo(() => {
        return catalogData?.anomalies || [];
    }, [catalogData]);

    const filteredAnomalies = useMemo(() => {
        return anomalies.filter(item => {
            const matchesSeverity = severityFilter === 'all' || item.severity === severityFilter;
            const term = searchTerm.toLowerCase().trim();
            const matchesSearch = !term ||
                (item.code && item.code.toLowerCase().includes(term)) ||
                (item.name && item.name.toLowerCase().includes(term)) ||
                (item.category && item.category.toLowerCase().includes(term)) ||
                (item.description && item.description.toLowerCase().includes(term));
            return matchesSeverity && matchesSearch;
        });
    }, [anomalies, severityFilter, searchTerm]);

    const counts = catalogData?.counts || { error: 0, warning: 0, info: 0 };

    return (
        <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por código, nombre o descripción..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                </div>

                {/* Severity Pills */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <button
                        onClick={() => setSeverityFilter('all')}
                        className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                            severityFilter === 'all'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                    >
                        Todas ({anomalies.length})
                    </button>
                    <button
                        onClick={() => setSeverityFilter('error')}
                        className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                            severityFilter === 'error'
                                ? 'bg-rose-600 text-white shadow-sm'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 hover:bg-rose-100'
                        }`}
                    >
                        Errores ({counts.error})
                    </button>
                    <button
                        onClick={() => setSeverityFilter('warning')}
                        className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                            severityFilter === 'warning'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 hover:bg-amber-100'
                        }`}
                    >
                        Advertencias ({counts.warning})
                    </button>
                    <button
                        onClick={() => setSeverityFilter('info')}
                        className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                            severityFilter === 'info'
                                ? 'bg-sky-600 text-white shadow-sm'
                                : 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 hover:bg-sky-100'
                        }`}
                    >
                        Informativas ({counts.info})
                    </button>
                </div>
            </div>

            {/* Table of Anomalies */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="py-16 text-center text-slate-500">
                        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        Auditando catálogo de cuentas...
                    </div>
                ) : filteredAnomalies.length === 0 ? (
                    <div className="py-16 text-center text-slate-500 space-y-2">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                            Catálogo de Cuentas Conforme
                        </h4>
                        <p className="text-xs text-slate-400">
                            No se detectaron anomalías con los filtros seleccionados.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="py-3 px-4">Severidad</th>
                                    <th className="py-3 px-4">Código / Nombre</th>
                                    <th className="py-3 px-4">Categoría</th>
                                    <th className="py-3 px-4">Descripción del Hallazgo</th>
                                    <th className="py-3 px-4">Recomendación</th>
                                    <th className="py-3 px-4 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredAnomalies.map((item) => {
                                    const isError = item.severity === 'error';
                                    const isWarning = item.severity === 'warning';

                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                {isError ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                                        <AlertCircle className="w-3 h-3" /> Error
                                                    </span>
                                                ) : isWarning ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                                        <AlertTriangle className="w-3 h-3" /> Aviso
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
                                                        <Info className="w-3 h-3" /> Info
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="font-mono font-bold text-slate-800 dark:text-slate-100">
                                                    {item.code || '---'}
                                                </div>
                                                <div className="text-slate-600 dark:text-slate-400 font-medium">
                                                    {item.name || '---'}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                                                {item.category}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs">
                                                {item.description}
                                            </td>
                                            <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-xs">
                                                {item.recommendation}
                                            </td>
                                            <td className="py-3 px-4 text-center whitespace-nowrap">
                                                {item.accountId ? (
                                                    <button
                                                        onClick={() => onFixAccount(item)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 transition-colors"
                                                    >
                                                        <Wrench className="w-3.5 h-3.5" /> Corregir
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-400 text-[11px]">Manual</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
