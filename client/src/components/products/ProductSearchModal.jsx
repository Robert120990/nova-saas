import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
    Package, 
    Search, 
    X, 
    ChevronDown, 
    LayoutGrid, 
    List, 
    Plus, 
    Loader2, 
    Fuel
} from 'lucide-react';
import Money from '../ui/Money';
import Pagination from '../ui/Pagination';

/**
 * Standardized Product Search Modal (F3)
 * Provides the same ergonomic, modern POS Terminal search experience across all modules.
 * 
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Callback to close the modal
 * @param {function} onSelectProduct - Callback with the selected product
 * @param {string|number} [branchId] - Optional branch ID to filter products and stock
 * @param {'purchase'|'transfer'|'inventory'|'kardex'|'sale'} [mode='sale'] - Target context
 * @param {string} [title] - Custom modal title
 * @param {string} [subtitle] - Custom modal subtitle
 */
const ProductSearchModal = ({
    isOpen,
    onClose,
    onSelectProduct,
    branchId,
    mode = 'sale',
    title,
    subtitle
}) => {
    const [productSearch, setProductSearch] = useState('');
    const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
    const [modalPage, setModalPage] = useState(1);
    const [productViewMode, setProductViewMode] = useState(() => {
        try {
            return localStorage.getItem('nova_product_view_mode') || 'grid';
        } catch {
            return 'grid';
        }
    });

    const searchInputRef = useRef(null);

    // Save view mode preference
    const handleSetViewMode = (viewMode) => {
        setProductViewMode(viewMode);
        try {
            localStorage.setItem('nova_product_view_mode', viewMode);
        } catch {
            // LocalStorage not accessible
        }
    };

    // Reset page and debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedProductSearch(productSearch);
            setModalPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [productSearch]);

    // Keyboard ESC listener & autofocus
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        const focusTimer = setTimeout(() => searchInputRef.current?.focus(), 80);

        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            clearTimeout(focusTimer);
        };
    }, [isOpen, onClose]);

    // Reset search on modal close
    useEffect(() => {
        if (!isOpen) {
            setProductSearch('');
            setDebouncedProductSearch('');
            setSelectedCategoryFilter('');
            setModalPage(1);
        }
    }, [isOpen]);

    // Fetch categories for filter dropdown and quick chips
    const { data: categoriesData } = useQuery({
        queryKey: ['categories-catalog-modal'],
        queryFn: async () => (await axios.get('/api/categories', { params: { limit: 1000 } })).data,
        enabled: isOpen,
        staleTime: 1000 * 60 * 5
    });

    const categoriesList = useMemo(() => {
        if (!categoriesData) return [];
        const raw = Array.isArray(categoriesData.data) 
            ? categoriesData.data 
            : (Array.isArray(categoriesData) ? categoriesData : []);
        return raw.map(c => ({
            id: c.id,
            name: c.name || c.nombre || 'Categoría'
        }));
    }, [categoriesData]);

    // Fetch products
    const { data: modalProductsData = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['products-catalog-modal', debouncedProductSearch, selectedCategoryFilter, modalPage, branchId, mode],
        queryFn: async () => (await axios.get('/api/products', {
            params: {
                search: debouncedProductSearch || undefined,
                category_id: selectedCategoryFilter || undefined,
                branch_id: branchId || undefined,
                limit: 24,
                page: modalPage
            }
        })).data,
        enabled: isOpen
    });

    const products = useMemo(() => {
        let list = (modalProductsData?.data || []).filter(p => p.status === 'activo');
        if (branchId) {
            const bIdNum = parseInt(branchId, 10);
            if (!isNaN(bIdNum)) {
                list = list.filter(p => !p.branches || p.branches.length === 0 || p.branches.includes(bIdNum));
            }
        }
        return list;
    }, [modalProductsData, branchId]);

    if (!isOpen) return null;

    // Default title by mode
    const defaultTitles = {
        purchase: 'Catálogo de Productos (Compras)',
        transfer: 'Catálogo de Productos (Traslados)',
        inventory: 'Catálogo de Productos (Inventario)',
        kardex: 'Catálogo de Productos (Kárdex)',
        sale: 'Catálogo de Productos'
    };

    const modalTitle = title || defaultTitles[mode] || 'Catálogo de Productos';

    const handleSelect = (product) => {
        if (onSelectProduct) {
            onSelectProduct(product);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[100] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] sm:max-h-[88vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200">
                {/* Header Compacto Estilo POS Terminal */}
                <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0">
                            <Package size={15} />
                        </div>
                        <div className="flex items-center gap-2 truncate">
                            <h3 className="text-sm font-black text-white tracking-tight">{modalTitle}</h3>
                            <kbd className="px-1.5 py-0.5 bg-white/10 text-indigo-200 rounded text-[10px] font-mono font-bold border border-white/15">F3</kbd>
                            {selectedCategoryFilter && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/20 truncate max-w-[140px]">
                                    {categoriesList.find(c => String(c.id) === String(selectedCategoryFilter))?.name || 'Categoría'}
                                </span>
                            )}
                            {subtitle && (
                                <span className="text-[11px] text-slate-400 hidden md:inline truncate">
                                    • {subtitle}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {!isLoading && modalProductsData?.total !== undefined && (
                            <span className="text-[11px] text-slate-400 hidden sm:inline-block font-medium">
                                {modalProductsData.total} {modalProductsData.total === 1 ? 'producto' : 'productos'}
                            </span>
                        )}
                        <button 
                            type="button"
                            onClick={onClose} 
                            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Cerrar (ESC)"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Barra de Búsqueda y Filtros Compacta */}
                <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-col gap-2 shrink-0">
                    {/* Fila 1: Input de búsqueda + Dropdown de Categoría + Toggle de Vista */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 min-w-0">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input 
                                ref={searchInputRef}
                                type="text"
                                placeholder="Buscar por nombre, código o código de barras... (ESC para salir)"
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
                            />
                            {productSearch && (
                                <button 
                                    type="button"
                                    onClick={() => setProductSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
                                    title="Limpiar búsqueda"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>

                        <div className="w-40 sm:w-52 shrink-0 relative">
                            <select 
                                value={selectedCategoryFilter}
                                onChange={(e) => {
                                    setSelectedCategoryFilter(e.target.value);
                                    setModalPage(1);
                                }}
                                className="w-full py-1.5 pl-2.5 pr-7 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer truncate shadow-xs"
                            >
                                <option value="">📁 Todas las categorías</option>
                                {categoriesList.map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>

                        <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg shrink-0">
                            <button 
                                type="button"
                                onClick={() => handleSetViewMode('grid')}
                                className={`p-1 rounded-md transition-all cursor-pointer ${productViewMode === 'grid' ? 'bg-white text-indigo-600 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                                title="Vista Cuadrícula Compacta"
                            >
                                <LayoutGrid size={14} />
                            </button>
                            <button 
                                type="button"
                                onClick={() => handleSetViewMode('list')}
                                className={`p-1 rounded-md transition-all cursor-pointer ${productViewMode === 'list' ? 'bg-white text-indigo-600 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                                title="Vista Lista Detallada"
                            >
                                <List size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Fila 2: Chips rápidos de categoría */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedCategoryFilter('');
                                setModalPage(1);
                            }}
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                                selectedCategoryFilter === ''
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100 hover:border-slate-300'
                            }`}
                        >
                            Todos
                        </button>

                        {categoriesList.slice(0, 25).map(cat => {
                            const isSelected = String(selectedCategoryFilter) === String(cat.id);
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedCategoryFilter(isSelected ? '' : String(cat.id));
                                        setModalPage(1);
                                    }}
                                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                                        isSelected
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100 hover:border-slate-300'
                                    }`}
                                >
                                    {cat.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Listado de Productos */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-slate-100/60 custom-scrollbar min-h-[300px]">
                    {isLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
                            <Loader2 size={24} className="animate-spin text-indigo-500" />
                            <span className="text-xs font-medium">Buscando en el catálogo...</span>
                        </div>
                    ) : products.length === 0 ? (
                        <div className="text-center py-16 opacity-40">
                            <Search size={40} className="mx-auto mb-2 text-slate-400" />
                            <p className="font-black uppercase tracking-wider text-xs text-slate-600">No se encontraron productos</p>
                            <p className="text-[11px] font-semibold text-slate-500 mt-1">Prueba con otra palabra o selecciona otra categoría</p>
                        </div>
                    ) : productViewMode === 'grid' ? (
                        /* Vista Cuadrícula */
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {products.map(p => {
                                const isFuel = p.tipo_combustible > 0;
                                return (
                                    <button 
                                        key={p.id} 
                                        type="button"
                                        onClick={() => handleSelect(p)} 
                                        className="p-2.5 rounded-xl border border-slate-200/90 bg-white hover:border-indigo-400 hover:bg-indigo-50/30 hover:shadow-sm transition-all text-left flex items-center justify-between gap-2 group cursor-pointer"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                                                <span className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-100/60 truncate max-w-[85px]">
                                                    {p.codigo}
                                                </span>
                                                {p.category_name && (
                                                    <span className="text-[9px] font-semibold text-slate-400 truncate max-w-[80px]" title={p.category_name}>
                                                        {p.category_name}
                                                    </span>
                                                )}
                                                {isFuel && (
                                                    <span className="text-[8px] font-bold text-cyan-700 bg-cyan-100/80 px-1 rounded flex items-center gap-0.5">
                                                        <Fuel size={8} /> Combustible
                                                    </span>
                                                )}
                                            </div>
                                            <div className="font-bold text-slate-800 text-xs truncate leading-tight group-hover:text-indigo-600 transition-colors" title={p.nombre}>
                                                {p.nombre}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5 text-[9px]">
                                                {p.codigo_barra && (
                                                    <span className="font-mono text-slate-400 truncate max-w-[100px]" title={p.codigo_barra}>
                                                        {p.codigo_barra}
                                                    </span>
                                                )}
                                                <span className="text-slate-500 font-bold ml-auto shrink-0">
                                                    Stock: <span className={Number(p.stock) > 0 ? 'text-slate-800' : 'text-rose-500'}>{p.stock ?? 0}</span>
                                                </span>
                                            </div>
                                            {mode === 'purchase' && p.provider_name && (
                                                <div className="text-[9px] text-slate-400 font-medium truncate mt-0.5">
                                                    Prov: <span className="text-slate-600 font-semibold">{p.provider_name}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0 flex flex-col items-end">
                                            {mode === 'purchase' ? (
                                                <div className="flex flex-col items-end leading-none">
                                                    <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Costo</span>
                                                    <span className="font-black text-slate-800 text-xs group-hover:text-indigo-700 mt-0.5">
                                                        <Money value={p.costo || 0} />
                                                    </span>
                                                </div>
                                            ) : mode === 'transfer' || mode === 'kardex' ? (
                                                <div className="flex flex-col items-end leading-none">
                                                    <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Precio</span>
                                                    <span className="font-black text-slate-800 text-xs group-hover:text-indigo-700 mt-0.5">
                                                        <Money value={p.precio_unitario || 0} />
                                                    </span>
                                                    {p.costo !== undefined && (
                                                        <span className="text-[9px] text-slate-400 font-medium mt-0.5">
                                                            C: <Money value={p.costo || 0} />
                                                        </span>
                                                    )}
                                                </div>
                                            ) : mode === 'inventory' ? (
                                                <div className="flex flex-col items-end leading-none">
                                                    <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Costo</span>
                                                    <span className="font-black text-slate-800 text-xs group-hover:text-indigo-700 mt-0.5">
                                                        <Money value={p.costo || 0} />
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-end leading-none">
                                                    <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Precio</span>
                                                    <span className="font-black text-slate-800 text-xs group-hover:text-indigo-700 mt-0.5">
                                                        <Money value={p.precio_unitario || 0} />
                                                    </span>
                                                </div>
                                            )}
                                            <div className="w-5 h-5 mt-1 rounded bg-slate-100 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-colors">
                                                <Plus size={11} />
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        /* Vista de Lista / Tabla Compacta */
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                                            <th className="py-2 px-3">Código</th>
                                            <th className="py-2 px-3">Nombre / Descripción</th>
                                            <th className="py-2 px-3">Categoría</th>
                                            <th className="py-2 px-3 hidden sm:table-cell">Código Barra</th>
                                            <th className="py-2 px-3 text-center">Stock</th>
                                            {mode === 'purchase' || mode === 'inventory' ? (
                                                <th className="py-2 px-3 text-right">Costo Unit.</th>
                                            ) : mode === 'transfer' || mode === 'kardex' ? (
                                                <>
                                                    <th className="py-2 px-3 text-right">Precio</th>
                                                    <th className="py-2 px-3 text-right hidden sm:table-cell">Costo</th>
                                                </>
                                            ) : (
                                                <th className="py-2 px-3 text-right">Precio</th>
                                            )}
                                            <th className="py-2 px-3 text-center w-12">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs">
                                        {products.map(p => {
                                            const isFuel = p.tipo_combustible > 0;
                                            return (
                                                <tr 
                                                    key={p.id}
                                                    onClick={() => handleSelect(p)}
                                                    className="hover:bg-indigo-50/50 cursor-pointer transition-colors group"
                                                >
                                                    <td className="py-1.5 px-3">
                                                        <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                                            {p.codigo}
                                                        </span>
                                                    </td>
                                                    <td className="py-1.5 px-3 font-bold text-slate-800 group-hover:text-indigo-600">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="truncate">{p.nombre}</span>
                                                            {isFuel && (
                                                                <span className="text-[8px] font-bold text-cyan-700 bg-cyan-100 px-1 rounded shrink-0 flex items-center gap-0.5">
                                                                    <Fuel size={8} /> Combustible
                                                                </span>
                                                            )}
                                                        </div>
                                                        {mode === 'purchase' && p.provider_name && (
                                                            <div className="text-[9px] text-slate-400 font-normal">
                                                                Prov: {p.provider_name}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-1.5 px-3">
                                                        {p.category_name ? (
                                                            <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">
                                                                {p.category_name}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 text-[10px]">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-1.5 px-3 font-mono text-[10px] text-slate-400 hidden sm:table-cell">
                                                        {p.codigo_barra || '—'}
                                                    </td>
                                                    <td className="py-1.5 px-3 text-center">
                                                        <span className={`font-mono font-bold text-[11px] ${Number(p.stock) > 0 ? 'text-slate-700' : 'text-rose-500'}`}>
                                                            {p.stock ?? 0}
                                                        </span>
                                                    </td>
                                                    {mode === 'purchase' || mode === 'inventory' ? (
                                                        <td className="py-1.5 px-3 text-right font-black text-slate-800 group-hover:text-indigo-700">
                                                            <Money value={p.costo || 0} />
                                                        </td>
                                                    ) : mode === 'transfer' || mode === 'kardex' ? (
                                                        <>
                                                            <td className="py-1.5 px-3 text-right font-black text-slate-800 group-hover:text-indigo-700">
                                                                <Money value={p.precio_unitario || 0} />
                                                            </td>
                                                            <td className="py-1.5 px-3 text-right font-medium text-slate-400 hidden sm:table-cell">
                                                                <Money value={p.costo || 0} />
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <td className="py-1.5 px-3 text-right font-black text-slate-800 group-hover:text-indigo-700">
                                                            <Money value={p.precio_unitario || 0} />
                                                        </td>
                                                    )}
                                                    <td className="py-1.5 px-3 text-center">
                                                        <div className="w-5 h-5 mx-auto rounded bg-slate-100 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-colors">
                                                            <Plus size={11} />
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Compacto */}
                <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                        <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-[10px] text-slate-700 shadow-xs">ESC</kbd> Cerrar</span>
                        <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-[10px] text-slate-700 shadow-xs">Clic</kbd> Seleccionar</span>
                    </div>
                    {modalProductsData.totalPages > 1 && (
                        <div className="scale-90 origin-right">
                            <Pagination
                                currentPage={modalPage}
                                totalPages={modalProductsData.totalPages}
                                totalItems={modalProductsData.total}
                                onPageChange={setModalPage}
                                itemsOnPage={products.length}
                                isLoading={isLoading}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductSearchModal;
