import { Filter, FileSpreadsheet, FileText, Loader2, Calendar } from 'lucide-react';

export default function EggSalesFiltersBar({
    filters,
    onChangeFilter,
    onChangeFilters,
    onApply,
    onExportExcel,
    onViewPdf,
    customers = [],
    isExporting = false
}) {
    const currentMonth = (() => {
        if (filters.from && filters.to) {
            const fM = String(filters.from).slice(0, 7);
            const tM = String(filters.to).slice(0, 7);
            if (fM === tM) return fM;
        } else if (filters.from) {
            return String(filters.from).slice(0, 7);
        }
        return '';
    })();

    const handleMonthChange = (monthStr, autoApply = true) => {
        if (!monthStr) return;
        const [y, m] = monthStr.split('-').map(Number);
        if (!y || !m) return;
        const fromStr = `${y}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const toStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const updated = { ...filters, from: fromStr, to: toStr };
        if (onChangeFilters) {
            onChangeFilters({ from: fromStr, to: toStr });
        } else {
            onChangeFilter('from', fromStr);
            onChangeFilter('to', toStr);
        }

        if (autoApply && onApply) {
            onApply(updated);
        }
    };

    const handleQuickMonth = (offset = 0) => {
        const now = new Date();
        now.setDate(1);
        if (offset !== 0) {
            now.setMonth(now.getMonth() + offset);
        }
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        handleMonthChange(`${y}-${m}`, true);
    };

    return (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-wrap items-end gap-3 text-xs">
                {/* Selector por Mes */}
                <div className="w-full sm:w-40">
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-indigo-600" />
                            Mes
                        </label>
                        <div className="flex items-center gap-1.5 text-[10px]">
                            <button
                                type="button"
                                onClick={() => handleQuickMonth(0)}
                                className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                                title="Seleccionar el mes en curso"
                            >
                                Actual
                            </button>
                            <span className="text-slate-300">•</span>
                            <button
                                type="button"
                                onClick={() => handleQuickMonth(-1)}
                                className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                                title="Seleccionar el mes anterior"
                            >
                                Anterior
                            </button>
                        </div>
                    </div>
                    <input
                        type="month"
                        className="w-full rounded-xl border border-slate-200 p-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                        value={currentMonth}
                        onChange={(e) => handleMonthChange(e.target.value)}
                        title="Seleccione un mes para ajustar automáticamente Desde y Hasta"
                    />
                </div>

                {/* Rango de fechas */}
                <div className="w-full sm:w-32">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Desde
                    </label>
                    <input
                        type="date"
                        className="w-full rounded-xl border border-slate-200 p-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                        value={filters.from}
                        onChange={(e) => onChangeFilter('from', e.target.value)}
                    />
                </div>

                <div className="w-full sm:w-32">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Hasta
                    </label>
                    <input
                        type="date"
                        className="w-full rounded-xl border border-slate-200 p-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                        value={filters.to}
                        onChange={(e) => onChangeFilter('to', e.target.value)}
                    />
                </div>

                {/* Filtro por Producto */}
                <div className="w-full sm:w-44">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Producto
                    </label>
                    <select
                        className="w-full rounded-xl border border-slate-200 p-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                        value={filters.product_type}
                        onChange={(e) => onChangeFilter('product_type', e.target.value)}
                    >
                        <option value="">Todos los productos</option>
                        <option value="HUEVO ENTERO">HUEVO ENTERO</option>
                        <option value="HUEVO RAPIDO">HUEVO RAPIDO</option>
                        <option value="HUEVO EN CASCARA">HUEVO EN CASCARA</option>
                        <option value="CLARA PASTEURIZADA">CLARA PASTEURIZADA</option>
                        <option value="CLARA PPG">CLARA PPG</option>
                        <option value="HUEVO CON LECHE">HUEVO CON LECHE</option>
                        <option value="YEMA AZUCARADA">YEMA AZUCARADA</option>
                        <option value="TORTITAS DE HUEVO">TORTITAS DE HUEVO</option>
                        <option value="OTROS OVOPRODUCTOS">OTROS OVOPRODUCTOS</option>
                    </select>
                </div>

                {/* Filtro por Cliente */}
                <div className="w-full sm:w-48">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Cliente
                    </label>
                    <select
                        className="w-full rounded-xl border border-slate-200 p-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                        value={filters.customer_id}
                        onChange={(e) => onChangeFilter('customer_id', e.target.value)}
                    >
                        <option value="">Todos los clientes</option>
                        {(Array.isArray(customers) ? customers : []).map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.nombre || c.razon_social}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Criterio de Documentos y Remisiones */}
                <div className="w-full sm:w-56">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1" title="Contemplar remisiones y deduplicar al facturar">
                        Criterio de Documentos
                    </label>
                    <select
                        className="w-full rounded-xl border border-slate-200 p-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                        value={filters.remissionMode || 'facturado_pendiente'}
                        onChange={(e) => onChangeFilter('remissionMode', e.target.value)}
                        title="Evita doble sumatoria de notas de remisión al facturarse a clientes"
                    >
                        <option value="facturado_pendiente">Facturado + Remisiones Pendientes</option>
                        <option value="solo_fiscal">Solo Facturación Fiscal (01, 03, 11)</option>
                        <option value="despachos_fisicos">Despachos Físicos (Remisiones 04)</option>
                    </select>
                </div>

                {/* Botón Aplicar */}
                <div className="flex-1 min-w-[110px]">
                    <button
                        type="button"
                        onClick={onApply}
                        className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm active:scale-95"
                    >
                        <Filter className="w-4 h-4" />
                        Filtrar
                    </button>
                </div>

                {/* Botones de Exportación */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={onExportExcel}
                        disabled={isExporting}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold hover:bg-emerald-100 transition-colors disabled:opacity-50 active:scale-95"
                        title="Descargar libro Excel con 3 hojas"
                    >
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
                        <span>Excel</span>
                    </button>

                    <button
                        type="button"
                        onClick={onViewPdf}
                        disabled={isExporting}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-200 transition-colors disabled:opacity-50 active:scale-95"
                        title="Abrir visor PDF contable"
                    >
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-indigo-600" />}
                        <span>Ver PDF</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
