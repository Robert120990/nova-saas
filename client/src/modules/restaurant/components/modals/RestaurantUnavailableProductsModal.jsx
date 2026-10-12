import { useState, useMemo } from 'react';
import { Ban, Search, CheckCircle2 } from 'lucide-react';
import Modal from '../../../../components/ui/Modal';

export default function RestaurantUnavailableProductsModal({
    isOpen,
    onClose,
    catalogProducts = [],
    categories = [],
    unavailableProductIds = new Set(),
    onToggleUnavailable,
    isLoading = false
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    const { productCountsByCategory, unavailableCount } = useMemo(() => {
        const counts = {};
        let unavail = 0;
        for (const p of (Array.isArray(catalogProducts) ? catalogProducts : [])) {
            const catId = String(p.category_id);
            counts[catId] = (counts[catId] || 0) + 1;
            if (unavailableProductIds.has(p.id)) {
                unavail++;
            }
        }
        return { productCountsByCategory: counts, unavailableCount: unavail };
    }, [catalogProducts, unavailableProductIds]);

    const filteredCatalog = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        let list = Array.isArray(catalogProducts) ? catalogProducts : [];

        if (selectedCategory === 'only_unavailable') {
            list = list.filter(p => unavailableProductIds.has(p.id));
        } else if (selectedCategory !== 'all') {
            list = list.filter(p => String(p.category_id) === String(selectedCategory));
        }

        if (query) {
            list = list.filter(p => {
                const pName = (p.nombre || p.name || '').toLowerCase();
                const pSku = (p.codigo || p.sku || '').toLowerCase();
                return pName.includes(query) || pSku.includes(query);
            });
        }

        return list;
    }, [catalogProducts, searchQuery, selectedCategory, unavailableProductIds]);

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Platillos Agotados en Cocina"
            maxWidth="max-w-2xl"
        >
            <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 flex items-start gap-2">
                    <Ban size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <p>
                        Los platillos marcados como <strong>Agotado</strong> se inhabilitan en tiempo real para todos los meseros, impidiendo que los agreguen a nuevas comandas.
                    </p>
                </div>

                {/* Buscador de Platillos */}
                <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar platillo por nombre o código..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                </div>

                {/* Filtro por Categorías */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide text-xs">
                    <button
                        type="button"
                        onClick={() => setSelectedCategory('all')}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                            selectedCategory === 'all'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <span>Todos</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                            selectedCategory === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                            {catalogProducts.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setSelectedCategory('only_unavailable')}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                            selectedCategory === 'only_unavailable'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
                        }`}
                    >
                        <Ban size={12} />
                        <span>Agotados</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                            selectedCategory === 'only_unavailable' ? 'bg-white/20 text-white' : 'bg-rose-200 text-rose-800'
                        }`}>
                            {unavailableCount}
                        </span>
                    </button>

                    {(Array.isArray(categories) ? categories : []).map(cat => {
                        const count = productCountsByCategory[String(cat.id)] || 0;
                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setSelectedCategory(String(cat.id))}
                                className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                                    selectedCategory === String(cat.id)
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                <span>{cat.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                                    selectedCategory === String(cat.id) ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                                }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Lista de Platillos */}
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {filteredCatalog.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-400">
                            No se encontraron platillos en esta categoría
                        </div>
                    ) : (
                        filteredCatalog.map(p => {
                            const isUnavailable = unavailableProductIds.has(p.id);
                            return (
                                <div
                                    key={p.id}
                                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                                        isUnavailable
                                            ? 'bg-rose-50/70 border-rose-200'
                                            : 'bg-white border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="min-w-0 pr-3">
                                        <div className="flex items-center gap-1.5">
                                            <p className={`text-xs font-bold truncate ${isUnavailable ? 'text-rose-950 font-black' : 'text-slate-900'}`}>
                                                {p.nombre || p.name}
                                            </p>
                                            {isUnavailable && (
                                                <span className="px-1.5 py-0.2 rounded bg-rose-200 text-rose-800 text-[10px] font-black shrink-0">
                                                    AGOTADO
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                            SKU: {p.codigo || p.sku || 'S/C'}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={isLoading}
                                        onClick={() => onToggleUnavailable({ productId: p.id, isUnavailable: !isUnavailable })}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                                            isUnavailable
                                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                                                : 'bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700'
                                        }`}
                                    >
                                        {isUnavailable ? (
                                            <>
                                                <CheckCircle2 size={13} />
                                                <span>Reactivar</span>
                                            </>
                                        ) : (
                                            <>
                                                <Ban size={13} />
                                                <span>Marcar Agotado</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </Modal>
    );
}
