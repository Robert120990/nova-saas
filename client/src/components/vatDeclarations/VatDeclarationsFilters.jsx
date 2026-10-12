import { Calendar, Search, Building2, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';

const MONTHS = [
    { value: '1', label: 'Enero' },
    { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' },
    { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' }
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

const VatDeclarationsFilters = ({
    year,
    setYear,
    month,
    setMonth,
    branchId,
    setBranchId,
    branches = [],
    searchTerm,
    setSearchTerm,
    onExportPdf,
    onExportExcel,
    isExporting
}) => {
    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-2 sm:p-2.5 shadow-sm">
            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                {/* Año Fiscal */}
                <label className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200/90 rounded-xl px-2.5 h-9 shrink-0 transition-colors cursor-pointer">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">Año:</span>
                    <select
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="bg-transparent text-[12px] font-semibold text-slate-700 focus:outline-none cursor-pointer pr-1"
                        title="Año Fiscal"
                    >
                        {YEARS.map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </label>

                {/* Mes Fiscal */}
                <label className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200/90 rounded-xl px-2.5 h-9 shrink-0 transition-colors cursor-pointer">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">Mes:</span>
                    <select
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="bg-transparent text-[12px] font-semibold text-slate-700 focus:outline-none cursor-pointer pr-1"
                        title="Mes Fiscal"
                    >
                        {MONTHS.map((m) => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                </label>

                {/* Sucursal / Ámbito */}
                <label className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200/90 rounded-xl px-2.5 h-9 shrink-0 transition-colors cursor-pointer min-w-[190px] max-w-[270px]">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 hidden xl:inline">Sucursal:</span>
                    <select
                        value={branchId}
                        onChange={(e) => setBranchId(e.target.value)}
                        className="w-full bg-transparent text-[12px] font-semibold text-slate-700 focus:outline-none cursor-pointer truncate"
                        title="Sucursal / Ámbito"
                    >
                        <option value="all">Todas (Consolidado)</option>
                        {(Array.isArray(branches) ? branches : []).map((b) => (
                            <option key={b.id} value={b.id}>{b.nombre}</option>
                        ))}
                    </select>
                </label>

                {/* Barra de Búsqueda */}
                <div className="relative flex-1 min-w-[180px] h-9">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por proveedor, cliente, doc, NIT..."
                        className="w-full h-full pl-8 pr-3 text-[12px] font-medium bg-slate-50 hover:bg-slate-100/50 border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 placeholder:text-slate-400"
                    />
                </div>

                {/* Botones de Exportación */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        type="button"
                        onClick={onExportPdf}
                        disabled={Boolean(isExporting)}
                        className="inline-flex items-center gap-1.5 h-9 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl text-[12px] font-bold transition-all shadow-xs disabled:opacity-50 whitespace-nowrap active:scale-95 cursor-pointer"
                        title="Exportar anexo activo a PDF oficial"
                    >
                        {isExporting === 'pdf' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <FileText className="w-3.5 h-3.5 text-rose-600" />
                        )}
                        <span>Exportar PDF</span>
                    </button>

                    <button
                        type="button"
                        onClick={onExportExcel}
                        disabled={Boolean(isExporting)}
                        className="inline-flex items-center gap-1.5 h-9 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 rounded-xl text-[12px] font-bold transition-all shadow-xs disabled:opacity-50 whitespace-nowrap active:scale-95 cursor-pointer"
                        title="Exportar anexo activo a Excel (.xlsx)"
                    >
                        {isExporting === 'excel' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span>Exportar Excel</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VatDeclarationsFilters;
