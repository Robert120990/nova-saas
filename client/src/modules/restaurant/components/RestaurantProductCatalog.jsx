import { useState, useMemo } from 'react';
import { Search, Ban, UtensilsCrossed } from 'lucide-react';
import Money from '../../../components/ui/Money';

export default function RestaurantProductCatalog({
    products = [],
    categories = [],
    unavailableProductIds = new Set(),
    hasConfiguredCategories = true,
    onSelectProduct
}) {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [search, setSearch] = useState('');

    const productCountsByCategory = useMemo(() => {
        const counts = {};
        for (const p of (Array.isArray(products) ? products : [])) {
            const catId = String(p.category_id);
            counts[catId] = (counts[catId] || 0) + 1;
        }
        return counts;
    }, [products]);

    const totalProductsCount = Array.isArray(products) ? products.length : 0;

    if (hasConfiguredCategories === false) {
        return (
            <div className="py-12 px-6 text-center bg-amber-50/70 rounded-3xl border border-amber-200/80">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3 font-bold">
                    <UtensilsCrossed size={20} />
                </div>
                <h4 className="text-sm font-extrabold text-amber-900">Menú no configurado para esta sucursal</h4>
                <p className="text-xs text-amber-700/90 max-w-md mx-auto mt-1 leading-relaxed">
                    Esta sucursal aún no tiene categorías de comanda asignadas. Dirígete a <strong>Configuración de Restaurante &gt; Parámetros y Propinas</strong> para seleccionar las categorías de alimentos y bebidas, evitando que se muestren productos de otros giros de negocio.
                </p>
            </div>
        );
    }

    const filteredProducts = (Array.isArray(products) ? products : []).filter(p => {
        const pName = p.nombre || p.name || '';
        const pSku = p.codigo || p.sku || '';
        const matchesCategory = selectedCategory === 'all' || String(p.category_id) === String(selectedCategory);
        const matchesSearch = !search.trim() ||
            pName.toLowerCase().includes(search.toLowerCase()) ||
            pSku.toLowerCase().includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="space-y-3">
            {/* Buscador de Producto */}
            <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar platillo o bebida..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
            </div>

            {/* Categorías (Píldoras horizontales con contador de productos) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                        selectedCategory === 'all'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    <span>Todos</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                        selectedCategory === 'all'
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-200 text-slate-600'
                    }`}>
                        {totalProductsCount}
                    </span>
                </button>
                {(Array.isArray(categories) ? categories : []).map(cat => {
                    const count = productCountsByCategory[String(cat.id)] || 0;
                    return (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSelectedCategory(String(cat.id))}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                                selectedCategory === String(cat.id)
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            <span>{cat.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                                selectedCategory === String(cat.id)
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-200 text-slate-600'
                            }`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Grilla de Platillos (Grandes y táctiles para terminal móvil 360px) */}
            {(Array.isArray(filteredProducts) ? filteredProducts : []).length === 0 ? (
                <div className="py-10 text-center bg-slate-50 rounded-2xl border border-slate-200 p-4">
                    <p className="text-xs font-bold text-slate-600">No se encontraron productos disponibles</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                        Verifica el filtro de categorías en la configuración del restaurante o el término de búsqueda.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
                    {(Array.isArray(filteredProducts) ? filteredProducts : []).map(p => {
                        const is86 = unavailableProductIds.has(p.id);

                        return (
                            <button
                                key={p.id}
                                type="button"
                                disabled={is86}
                                onClick={() => onSelectProduct(p)}
                                className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all active:scale-95 min-h-[75px] ${
                                    is86
                                        ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                                        : 'bg-white border-slate-200 hover:border-indigo-300 shadow-2xs hover:shadow-xs'
                                }`}
                            >
                                <div>
                                    <h4 className="text-xs font-extrabold text-slate-900 line-clamp-2 leading-tight">
                                        {p.nombre || p.name}
                                    </h4>
                                </div>

                                <div className="mt-2 flex items-center justify-between">
                                    <span className="text-xs font-black text-indigo-700">
                                        <Money value={p.precio_unitario || p.price || p.costo || 0} />
                                    </span>
                                    {is86 && (
                                        <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1 py-0.5 rounded border border-rose-200 flex items-center gap-0.5">
                                            <Ban size={9} />
                                            <span>AGOTADO</span>
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
