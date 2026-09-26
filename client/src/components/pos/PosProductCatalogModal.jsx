import { useEffect } from 'react';
import { 
    Package, 
    X, 
    Search, 
    ChevronDown, 
    LayoutGrid, 
    List, 
    Zap, 
    Plus, 
    Loader2, 
    Handshake 
} from 'lucide-react';
import Money from '../ui/Money';
import Pagination from '../ui/Pagination';

/**
 * PosProductCatalogModal Component
 * Interactive product catalog modal (F3 shortcut) with category filtering,
 * combo support, grid/list view toggles, pagination, and quick add-to-cart.
 */
const PosProductCatalogModal = ({
    isOpen,
    onClose,
    productSearch,
    setProductSearch,
    selectedCategoryFilter,
    setSelectedCategoryFilter,
    setModalPage,
    categoriesList = [],
    combos = [],
    productViewMode,
    setProductViewMode,
    isLoadingModalProducts,
    modalProductsData = {},
    filteredCombos = [],
    filteredProducts = [],
    addToCart,
    getCustomerAgreedPrice,
    modalPage
}) => {
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose?.();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[100] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose?.();
            }}
        >
            <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] sm:max-h-[88vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200">
                {/* Header Compacto */}
                <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0">
                            <Package size={15} />
                        </div>
                        <div className="flex items-center gap-2 truncate">
                            <h3 className="text-sm font-black text-white tracking-tight">Catálogo de Productos</h3>
                            <kbd className="px-1.5 py-0.5 bg-white/10 text-indigo-200 rounded text-[10px] font-mono font-bold border border-white/15">F3</kbd>
                            {selectedCategoryFilter && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/20 truncate max-w-[140px]">
                                    {selectedCategoryFilter === 'combos' 
                                        ? '⚡ Combos' 
                                        : (categoriesList.find(c => String(c.id) === String(selectedCategoryFilter))?.name || 'Categoría')}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {!isLoadingModalProducts && modalProductsData?.total !== undefined && (
                            <span className="text-[11px] text-slate-400 hidden sm:inline-block font-medium">
                                {modalProductsData.total} {modalProductsData.total === 1 ? 'producto' : 'productos'}
                            </span>
                        )}
                        <button 
                            onClick={onClose} 
                            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
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
                                autoFocus
                                type="text"
                                placeholder="Buscar por nombre, código o código de barras... (ESC para salir)"
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onClose?.();
                                    }
                                }}
                                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
                            />
                            {productSearch && (
                                <button 
                                    onClick={() => setProductSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
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
                                {combos.length > 0 && (
                                    <option value="combos">⚡ Combos y Promociones ({combos.length})</option>
                                )}
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
                                onClick={() => setProductViewMode('grid')}
                                className={`p-1 rounded-md transition-all ${productViewMode === 'grid' ? 'bg-white text-indigo-600 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                                title="Vista Cuadrícula Compacta"
                            >
                                <LayoutGrid size={14} />
                            </button>
                            <button 
                                type="button"
                                onClick={() => setProductViewMode('list')}
                                className={`p-1 rounded-md transition-all ${productViewMode === 'list' ? 'bg-white text-indigo-600 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
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
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 transition-all ${
                                selectedCategoryFilter === ''
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100 hover:border-slate-300'
                            }`}
                        >
                            Todos
                        </button>

                        {combos.length > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedCategoryFilter(selectedCategoryFilter === 'combos' ? '' : 'combos');
                                    setModalPage(1);
                                }}
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 transition-all flex items-center gap-1 ${
                                    selectedCategoryFilter === 'combos'
                                        ? 'bg-amber-600 text-white shadow-xs'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                                }`}
                            >
                                <Zap size={11} /> Combos ({combos.length})
                            </button>
                        )}

                        {categoriesList.slice(0, 20).map(cat => {
                            const isSelected = String(selectedCategoryFilter) === String(cat.id);
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedCategoryFilter(isSelected ? '' : String(cat.id));
                                        setModalPage(1);
                                    }}
                                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 transition-all ${
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

                {/* Listado de Productos / Combos */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-slate-100/60 custom-scrollbar min-h-[300px]">
                    {isLoadingModalProducts ? (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
                            <Loader2 size={24} className="animate-spin text-indigo-500" />
                            <span className="text-xs font-medium">Buscando en el catálogo...</span>
                        </div>
                    ) : filteredProducts.length === 0 && filteredCombos.length === 0 ? (
                        <div className="text-center py-16 opacity-40">
                            <Search size={40} className="mx-auto mb-2 text-slate-400" />
                            <p className="font-black uppercase tracking-wider text-xs text-slate-600">No se encontraron productos</p>
                            <p className="text-[11px] font-semibold text-slate-500 mt-1">Prueba con otra palabra o selecciona otra categoría</p>
                        </div>
                    ) : productViewMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {/* Combos en Cuadrícula */}
                            {filteredCombos.map(c => (
                                <button 
                                    key={`combo-${c.id}`} 
                                    onClick={() => addToCart(c, true)} 
                                    className="p-2.5 rounded-xl border border-amber-200/90 bg-amber-50/30 hover:border-amber-400 hover:bg-amber-100/40 hover:shadow-sm transition-all text-left flex items-center justify-between gap-2 group cursor-pointer"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1 mb-0.5">
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100/80 px-1 py-0.2 rounded flex items-center gap-0.5">
                                                <Zap size={9} /> Combo
                                            </span>
                                            {c.barcode && <span className="text-[9px] font-mono text-slate-400 truncate">{c.barcode}</span>}
                                        </div>
                                        <div className="font-bold text-slate-900 text-xs truncate leading-tight group-hover:text-amber-800" title={c.name}>
                                            {c.name}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 flex flex-col items-end">
                                        <div className="font-black text-amber-700 text-xs">
                                            <Money value={c.price || 0} />
                                        </div>
                                        <div className="w-5 h-5 mt-1 rounded bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white flex items-center justify-center transition-colors">
                                            <Plus size={11} />
                                        </div>
                                    </div>
                                </button>
                            ))}

                            {/* Productos en Cuadrícula */}
                            {filteredProducts.map(p => {
                                const agreed = getCustomerAgreedPrice(p);
                                const isFuel = p.tipo_combustible > 0;
                                return (
                                    <button 
                                        key={p.id} 
                                        onClick={() => addToCart(p)} 
                                        className={`p-2.5 rounded-xl border transition-all text-left flex items-center justify-between gap-2 group cursor-pointer ${
                                            agreed 
                                                ? 'border-indigo-300 bg-indigo-50/30 hover:border-indigo-500 hover:bg-indigo-50/60 hover:shadow-sm' 
                                                : 'border-slate-200/90 bg-white hover:border-indigo-400 hover:bg-indigo-50/30 hover:shadow-sm'
                                        }`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                                                <span className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-100/60 truncate max-w-[80px]">
                                                    {p.codigo}
                                                </span>
                                                {p.category_name && (
                                                    <span className="text-[9px] font-semibold text-slate-400 truncate max-w-[75px]" title={p.category_name}>
                                                        {p.category_name}
                                                    </span>
                                                )}
                                                {agreed && (
                                                    <span className="text-[8px] font-bold text-amber-700 bg-amber-100/80 px-1 rounded flex items-center gap-0.5">
                                                        <Handshake size={8} /> Pactado
                                                    </span>
                                                )}
                                                {isFuel && (
                                                    <span className="text-[8px] font-bold text-cyan-700 bg-cyan-100/80 px-1 rounded">
                                                        Combustible
                                                    </span>
                                                )}
                                            </div>
                                            <div className="font-bold text-slate-800 text-xs truncate leading-tight group-hover:text-indigo-600 transition-colors" title={p.nombre}>
                                                {p.nombre}
                                            </div>
                                            {p.codigo_barra && (
                                                <div className="text-[9px] font-mono text-slate-400 truncate mt-0.5">
                                                    {p.codigo_barra}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0 flex flex-col items-end">
                                            {agreed ? (
                                                <>
                                                    <div className="font-black text-indigo-700 text-xs">
                                                        <Money value={agreed.agreedUnitPrice} />
                                                    </div>
                                                    <div className="text-[9px] text-slate-400 line-through">
                                                        <Money value={p.precio_unitario || 0} />
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="font-black text-slate-800 text-xs group-hover:text-indigo-700">
                                                    <Money value={p.precio_unitario || 0} />
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
                                            <th className="py-2 px-3 text-right">Precio</th>
                                            <th className="py-2 px-3 text-center w-12">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs">
                                        {/* Combos en Lista */}
                                        {filteredCombos.map(c => (
                                            <tr 
                                                key={`combo-${c.id}`}
                                                onClick={() => addToCart(c, true)}
                                                className="hover:bg-amber-50/50 cursor-pointer transition-colors group"
                                            >
                                                <td className="py-1.5 px-3">
                                                    <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                                        COMBO
                                                    </span>
                                                </td>
                                                <td className="py-1.5 px-3 font-bold text-slate-900 group-hover:text-amber-800">
                                                    <div className="flex items-center gap-1.5">
                                                        <Zap size={12} className="text-amber-500 shrink-0" />
                                                        <span className="truncate">{c.name}</span>
                                                    </div>
                                                </td>
                                                <td className="py-1.5 px-3">
                                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100/60 px-1.5 py-0.5 rounded-full">
                                                        Combos
                                                    </span>
                                                </td>
                                                <td className="py-1.5 px-3 font-mono text-[10px] text-slate-400 hidden sm:table-cell">
                                                    {c.barcode || '—'}
                                                </td>
                                                <td className="py-1.5 px-3 text-right font-black text-amber-700">
                                                    <Money value={c.price || 0} />
                                                </td>
                                                <td className="py-1.5 px-3 text-center">
                                                    <div className="w-5 h-5 mx-auto rounded bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white flex items-center justify-center transition-colors">
                                                        <Plus size={11} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}

                                        {/* Productos en Lista */}
                                        {filteredProducts.map(p => {
                                            const agreed = getCustomerAgreedPrice(p);
                                            const isFuel = p.tipo_combustible > 0;
                                            return (
                                                <tr 
                                                    key={p.id}
                                                    onClick={() => addToCart(p)}
                                                    className={`hover:bg-indigo-50/50 cursor-pointer transition-colors group ${agreed ? 'bg-indigo-50/20' : ''}`}
                                                >
                                                    <td className="py-1.5 px-3">
                                                        <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                                            {p.codigo}
                                                        </span>
                                                    </td>
                                                    <td className="py-1.5 px-3 font-bold text-slate-800 group-hover:text-indigo-600">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="truncate">{p.nombre}</span>
                                                            {agreed && (
                                                                <span className="text-[8px] font-bold text-amber-700 bg-amber-100 px-1 rounded flex items-center gap-0.5 shrink-0">
                                                                    <Handshake size={8} /> Pactado
                                                                </span>
                                                            )}
                                                            {isFuel && (
                                                                <span className="text-[8px] font-bold text-cyan-700 bg-cyan-100 px-1 rounded shrink-0">
                                                                    Combustible
                                                                </span>
                                                            )}
                                                        </div>
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
                                                    <td className="py-1.5 px-3 text-right">
                                                        {agreed ? (
                                                            <div className="flex flex-col items-end">
                                                                <span className="font-black text-indigo-700"><Money value={agreed.agreedUnitPrice} /></span>
                                                                <span className="text-[9px] text-slate-400 line-through"><Money value={p.precio_unitario || 0} /></span>
                                                            </div>
                                                        ) : (
                                                            <span className="font-black text-slate-800 group-hover:text-indigo-700"><Money value={p.precio_unitario || 0} /></span>
                                                        )}
                                                    </td>
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
                        <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-[10px] text-slate-700 shadow-xs">Clic</kbd> Agregar al carrito</span>
                    </div>
                    {modalProductsData.totalPages > 1 && (
                        <div className="scale-90 origin-right">
                            <Pagination
                                currentPage={modalPage}
                                totalPages={modalProductsData.totalPages}
                                totalItems={modalProductsData.total}
                                onPageChange={setModalPage}
                                itemsOnPage={filteredProducts.length}
                                isLoading={isLoadingModalProducts}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PosProductCatalogModal;
