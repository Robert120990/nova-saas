import { Search, Calendar, RefreshCw, Zap, Loader2 } from 'lucide-react';

const MONTHS = [
    { value: 1, label: '01 - Enero' },
    { value: 2, label: '02 - Febrero' },
    { value: 3, label: '03 - Marzo' },
    { value: 4, label: '04 - Abril' },
    { value: 5, label: '05 - Mayo' },
    { value: 6, label: '06 - Junio' },
    { value: 7, label: '07 - Julio' },
    { value: 8, label: '08 - Agosto' },
    { value: 9, label: '09 - Septiembre' },
    { value: 10, label: '10 - Octubre' },
    { value: 11, label: '11 - Noviembre' },
    { value: 12, label: '12 - Diciembre' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 8 }, (_, i) => currentYear + 1 - i);

const BankFilterBar = ({
    month,
    setMonth,
    year,
    setYear,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    onQuery,
    isLoading,
    selectedCount = 0,
    onBatchPost,
    isBatchPosting = false
}) => {
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            onQuery?.();
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
                {/* Period (Month & Year) & Status Filters */}
                <div className="flex flex-wrap items-end gap-3 flex-1">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1 flex items-center gap-1">
                            <Calendar size={12} className="text-indigo-500" /> Mes del Período
                        </label>
                        <select
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                        >
                            {MONTHS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1 flex items-center gap-1">
                            <Calendar size={12} className="text-indigo-500" /> Año
                        </label>
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value, 10))}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                        >
                            {YEARS.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Estado</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        >
                            <option value="all">Todos los registros</option>
                            <option value="unposted">Pendientes de Contabilizar</option>
                            <option value="posted">Ya Contabilizados</option>
                        </select>
                    </div>

                    <div className="flex-1 min-w-[200px]">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Buscar</label>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por documento, beneficiario, cuenta o concepto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Query & Batch Buttons */}
                <div className="flex items-center gap-2 self-end">
                    <button
                        type="button"
                        onClick={onQuery}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all disabled:opacity-50 cursor-pointer active:scale-95"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                        Consultar
                    </button>

                    {selectedCount > 0 && (
                        <button
                            type="button"
                            onClick={onBatchPost}
                            disabled={isBatchPosting}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 animate-in fade-in cursor-pointer active:scale-95"
                        >
                            {isBatchPosting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                            Contabilizar ({selectedCount})
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BankFilterBar;
