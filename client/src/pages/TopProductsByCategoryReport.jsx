import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
    GitBranch,
    Calendar,
    FolderTree,
    TrendingUp,
    ListOrdered,
    Search,
    CheckCircle2,
    X,
    Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import ReportLayout from '../components/ui/ReportLayout';
import { getTodayString, getFirstDayOfMonth } from '../utils/dateUtils';
import { unwrapList } from '../utils/apiUtils';

const TOP_LIMIT_OPTIONS = [
    { value: '5', label: 'Top 5' },
    { value: '10', label: 'Top 10' },
    { value: '15', label: 'Top 15' },
    { value: '20', label: 'Top 20' },
    { value: '50', label: 'Top 50' },
    { value: 'all', label: 'Todos los Productos' }
];

const ORDER_BY_OPTIONS = [
    { value: 'cantidad', label: 'Mayor Volumen (Unidades)' },
    { value: 'venta_neta', label: 'Mayor Facturación Neta ($)' },
    { value: 'utilidad', label: 'Mayor Utilidad Bruta ($)' }
];

const TopProductsByCategoryReport = () => {
    const { user } = useAuth();

    const today = getTodayString();
    const firstDayOfMonth = getFirstDayOfMonth();

    const [filters, setFilters] = useState({
        start_date: firstDayOfMonth,
        end_date: today,
        branch_id: user?.branch_id || 'all',
        limit: '10',
        order_by: 'cantidad'
    });

    // Categorías seleccionadas (vacío = Todas las categorías)
    const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
    const [categorySearch, setCategorySearch] = useState('');

    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    // 1. Cargar Sucursales
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => unwrapList(await axios.get('/api/branches'))
    });

    // 2. Cargar Categorías de Producto
    const { data: rawCategories = [] } = useQuery({
        queryKey: ['categories-all'],
        queryFn: async () => unwrapList(await axios.get('/api/categories', { params: { limit: 1000 } }))
    });

    const categories = useMemo(() => {
        return (Array.isArray(rawCategories) ? rawCategories : []).sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' })
        );
    }, [rawCategories]);

    // Filtrar categorías en tiempo real por búsqueda
    const filteredCategories = useMemo(() => {
        if (!categorySearch.trim()) return categories;
        const q = categorySearch.toLowerCase().trim();
        return categories.filter(c => (c.name || '').toLowerCase().includes(q));
    }, [categories, categorySearch]);

    // Indica si el modo actual es "Todas las categorías"
    const isAllCategories = selectedCategoryIds.length === 0 || selectedCategoryIds.length === categories.length;

    const handleToggleCategory = (catId) => {
        setSelectedCategoryIds(prev => {
            // Si estaba en modo "Todas", al dar clic a una se selecciona solo esa
            if (prev.length === 0) {
                return [catId];
            }
            if (prev.includes(catId)) {
                const next = prev.filter(id => id !== catId);
                return next; // si queda vacío, representa "Todas"
            }
            const next = [...prev, catId];
            if (next.length === categories.length) {
                return []; // si seleccionó todas, normalizar a vacío
            }
            return next;
        });
    };

    const handleSelectAllCategories = () => {
        setSelectedCategoryIds([]);
    };

    const handleClearCategories = () => {
        setSelectedCategoryIds([]);
    };

    const handleRemoveCategoryChip = (catId) => {
        setSelectedCategoryIds(prev => prev.filter(id => id !== catId));
    };

    const handleFilterChange = (name, value) => {
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleGenerateReport = async () => {
        if (!filters.start_date || !filters.end_date) {
            toast.error('Debe seleccionar un rango de fechas');
            return;
        }

        setIsGenerating(true);
        try {
            const params = {
                start_date: filters.start_date,
                end_date: filters.end_date,
                branch_id: filters.branch_id,
                limit: filters.limit,
                order_by: filters.order_by
            };

            if (selectedCategoryIds.length > 0) {
                params.category_ids = selectedCategoryIds.join(',');
            }

            const response = await axios.get('/api/sales/reports/top-products-by-category/pdf', {
                params,
                responseType: 'blob'
            });

            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            toast.success('Reporte generado exitosamente');
        } catch (error) {
            console.error('Error generating top products report:', error);
            toast.error('Error al generar el reporte de top productos');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', `Top_Productos_Categoria_${filters.start_date}_al_${filters.end_date}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleExportExcel = async () => {
        if (!filters.start_date || !filters.end_date) {
            toast.error('Debe seleccionar un rango de fechas');
            return;
        }

        try {
            const params = {
                start_date: filters.start_date,
                end_date: filters.end_date,
                branch_id: filters.branch_id,
                limit: filters.limit,
                order_by: filters.order_by,
                format: 'excel'
            };

            if (selectedCategoryIds.length > 0) {
                params.category_ids = selectedCategoryIds.join(',');
            }

            const response = await axios.get('/api/sales/reports/top-products-by-category/pdf', {
                params,
                responseType: 'blob'
            });

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Top_Productos_Categoria_${filters.start_date}_al_${filters.end_date}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            toast.success('Excel exportado exitosamente');
        } catch (error) {
            console.error('Error exporting top products to Excel:', error);
            toast.error('Error al exportar a Excel');
        }
    };

    // Obtener nombres de las categorías seleccionadas para los chips
    const selectedCategoryObjects = useMemo(() => {
        if (selectedCategoryIds.length === 0) return [];
        return categories.filter(c => selectedCategoryIds.includes(c.id));
    }, [categories, selectedCategoryIds]);

    return (
        <ReportLayout
            title="Top Productos por Categoría"
            subtitle="Ranking de los productos líderes por categoría con análisis de volumen, precios promedio, costos, venta neta, utilidad y márgenes."
            category="Ventas"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            onExportExcel={handleExportExcel}
            canGenerate={Boolean(filters.start_date && filters.end_date)}
            fileName={`Top_Productos_Categoria_${filters.start_date}_al_${filters.end_date}.pdf`}
        >
            {/* Filtro: Rango de Fechas */}
            <div className="space-y-3">
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        Fecha Desde
                    </label>
                    <input
                        type="date"
                        value={filters.start_date}
                        onChange={(e) => handleFilterChange('start_date', e.target.value)}
                        className="w-full px-3 py-2 text-[13px] font-medium border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                    />
                </div>
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        Fecha Hasta
                    </label>
                    <input
                        type="date"
                        value={filters.end_date}
                        onChange={(e) => handleFilterChange('end_date', e.target.value)}
                        className="w-full px-3 py-2 text-[13px] font-medium border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                    />
                </div>
            </div>

            {/* Filtro: Sucursal */}
            <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
                    <GitBranch className="w-3.5 h-3.5 text-indigo-500" />
                    Sucursal
                </label>
                <select
                    value={filters.branch_id}
                    onChange={(e) => handleFilterChange('branch_id', e.target.value)}
                    className="w-full px-3 py-2 text-[13px] font-medium border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                >
                    <option value="all">Todas las sucursales</option>
                    {(Array.isArray(branches) ? branches : []).map(b => (
                        <option key={b.id} value={b.id}>
                            {b.nombre}
                        </option>
                    ))}
                </select>
            </div>

            {/* Filtro Avanzado e Intuitivo: Categorías */}
            <div className="space-y-2 bg-slate-50/60 p-2.5 rounded-2xl border border-slate-200/80">
                <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
                        <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
                        Categorías
                    </label>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 shadow-2xs">
                        {isAllCategories ? `Todas (${categories.length})` : `${selectedCategoryIds.length} selec.`}
                    </span>
                </div>

                {/* Acciones Rápidas: Todas / Limpiar */}
                <div className="flex items-center justify-between text-[11px] px-0.5">
                    <button
                        type="button"
                        onClick={handleSelectAllCategories}
                        className={`font-semibold cursor-pointer transition-colors ${
                            isAllCategories
                                ? 'text-indigo-600 font-bold underline'
                                : 'text-slate-500 hover:text-indigo-600'
                        }`}
                    >
                        Seleccionar todas
                    </button>
                    {!isAllCategories && (
                        <button
                            type="button"
                            onClick={handleClearCategories}
                            className="text-slate-500 hover:text-rose-600 font-medium cursor-pointer transition-colors"
                        >
                            Limpiar filtro
                        </button>
                    )}
                </div>

                {/* Buscador en Vivo de Categorías */}
                <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        placeholder="Buscar categoría rápida..."
                        className="w-full pl-8 pr-7 py-1.5 text-[12px] bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                    />
                    {categorySearch && (
                        <button
                            type="button"
                            onClick={() => setCategorySearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Lista Interactiva de Categorías */}
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {/* Opción 'Todas las categorías' si no hay búsqueda activa */}
                    {!categorySearch && (
                        <button
                            type="button"
                            onClick={handleSelectAllCategories}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[12px] font-semibold transition-all text-left cursor-pointer border ${
                                isAllCategories
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200/60'
                            }`}
                        >
                            <span className="truncate flex items-center gap-1.5">
                                <Filter className="w-3 h-3 text-indigo-500" />
                                Todas las categorías ({categories.length})
                            </span>
                            {isAllCategories && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                        </button>
                    )}

                    {filteredCategories.length === 0 ? (
                        <div className="py-3 text-center text-[11px] text-slate-400 italic">
                            No se encontraron categorías
                        </div>
                    ) : (
                        filteredCategories.map(cat => {
                            const isSelected = !isAllCategories && selectedCategoryIds.includes(cat.id);
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => handleToggleCategory(cat.id)}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[12px] transition-all text-left cursor-pointer border ${
                                        isSelected
                                            ? 'bg-indigo-50 text-indigo-700 font-bold border-indigo-200 shadow-2xs'
                                            : 'bg-white text-slate-600 hover:bg-slate-100 font-medium border-slate-200/60'
                                    }`}
                                >
                                    <span className="truncate pr-1">{cat.name}</span>
                                    {isSelected ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    ) : (
                                        <div className="w-3.5 h-3.5 rounded-md border border-slate-300 shrink-0" />
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Chips de Categorías Seleccionadas */}
                {!isAllCategories && selectedCategoryObjects.length > 0 && (
                    <div className="pt-1.5 border-t border-slate-200/80">
                        <div className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                            <span>Seleccionadas ({selectedCategoryObjects.length}):</span>
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1 custom-scrollbar">
                            {selectedCategoryObjects.map(cat => (
                                <span
                                    key={cat.id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-100/70 text-indigo-800 text-[11px] font-semibold"
                                >
                                    <span className="truncate max-w-[130px]">{cat.name}</span>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveCategoryChip(cat.id);
                                        }}
                                        className="text-indigo-600 hover:text-indigo-900 cursor-pointer rounded-full hover:bg-indigo-200/50 p-0.5"
                                        title="Quitar categoría"
                                    >
                                        <X className="w-2.5 h-2.5" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Filtro: Límite Top N */}
            <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
                    <ListOrdered className="w-3.5 h-3.5 text-indigo-500" />
                    Top Límite (N)
                </label>
                <select
                    value={filters.limit}
                    onChange={(e) => handleFilterChange('limit', e.target.value)}
                    className="w-full px-3 py-2 text-[13px] font-medium border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                >
                    {TOP_LIMIT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Filtro: Criterio de Ordenamiento */}
            <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                    Criterio de Ranking
                </label>
                <select
                    value={filters.order_by}
                    onChange={(e) => handleFilterChange('order_by', e.target.value)}
                    className="w-full px-3 py-2 text-[13px] font-medium border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                >
                    {ORDER_BY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>
        </ReportLayout>
    );
};

export default TopProductsByCategoryReport;
