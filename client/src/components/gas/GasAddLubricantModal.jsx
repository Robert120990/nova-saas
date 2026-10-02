import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Search, Plus, Droplets, Loader2, X, AlertCircle } from 'lucide-react';
import Money from '../ui/Money';

const GasAddLubricantModal = ({
    isOpen,
    onClose,
    onSelect,
    existingProductIds = [],
    branchId,
    closeoutId
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const { data: products = [], isLoading } = useQuery({
        queryKey: ['products-lubricants-catalog', branchId, closeoutId],
        queryFn: async () => {
            const res = await axios.get('/api/products/lubricants', {
                params: {
                    branch_id: branchId || undefined,
                    closeout_id: closeoutId || undefined
                }
            });
            return Array.isArray(res.data) ? res.data : [];
        },
        enabled: isOpen
    });

    const availableProducts = useMemo(() => {
        const existingSet = new Set((existingProductIds || []).map(id => Number(id)));
        let list = products.filter(p => !existingSet.has(Number(p.id)));
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            list = list.filter(p =>
                (p.codigo || '').toLowerCase().includes(term) ||
                (p.descripcion || '').toLowerCase().includes(term)
            );
        }
        return list;
    }, [products, existingProductIds, searchTerm]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="fixed inset-0" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                            <Droplets size={16} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">Agregar Lubricante al Turno</h3>
                            <p className="text-[11px] text-slate-500">Seleccione un producto del catálogo que no tenía existencia previa</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-200/60 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-3.5 border-b border-slate-100 bg-white">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar por código o descripción de lubricante..."
                            autoFocus
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="overflow-y-auto flex-1 p-3">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                            <Loader2 size={18} className="animate-spin text-indigo-500" />
                            <span className="text-xs font-medium">Cargando catálogo de lubricantes...</span>
                        </div>
                    ) : availableProducts.length === 0 ? (
                        <div className="text-center py-12 px-4">
                            <AlertCircle size={28} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                {searchTerm ? 'No se encontraron lubricantes que coincidan' : 'No hay más lubricantes disponibles'}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1">
                                {searchTerm ? 'Intente con otro término de búsqueda.' : 'Todos los lubricantes activos ya están en la lista del turno.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {availableProducts.map(p => (
                                <div
                                    key={p.id}
                                    className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-indigo-50/50 border border-slate-100 hover:border-indigo-200 rounded-xl transition-all group"
                                >
                                    <div className="min-w-0 pr-3">
                                        <div className="flex items-center gap-2">
                                            <span className="px-1.5 py-0.5 font-mono text-[10px] font-bold bg-white border border-slate-200 text-slate-700 rounded">
                                                {p.codigo}
                                            </span>
                                            <span className="text-xs font-bold text-slate-800 truncate">
                                                {p.descripcion}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 mt-0.5">
                                            Precio Venta: <strong className="font-mono text-slate-700"><Money value={p.precio_unitario} /></strong>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onSelect(p);
                                            onClose();
                                        }}
                                        className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-600/20 transition-all active:scale-95"
                                    >
                                        <Plus size={13} />
                                        Agregar
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{availableProducts.length} productos disponibles para agregar</span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-bold transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GasAddLubricantModal;
