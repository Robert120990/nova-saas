import { useState, useEffect } from 'react';
import Modal from '../../../../components/ui/Modal';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../../../../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { unwrapList } from '../../../../utils/apiUtils';
import { Check, Search } from 'lucide-react';

export default function StationModal({ isOpen, onClose, station, onSuccess }) {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [printer, setPrinter] = useState('');
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [categorySearch, setCategorySearch] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: categories = [] } = useQuery({
        queryKey: ['categories-list'],
        queryFn: async () => unwrapList(await axios.get('/api/categories', { params: { limit: 1000 } })),
        enabled: isOpen
    });

    const { data: restaurantConfig } = useQuery({
        queryKey: ['restaurant-config', user?.branch_id],
        queryFn: async () => (await axios.get('/api/restaurant/config', { params: { branch_id: user?.branch_id } })).data?.data || {},
        enabled: isOpen
    });

    const hasConfiguredCategories = Array.isArray(restaurantConfig?.allowed_categories) && restaurantConfig.allowed_categories.length > 0;
    const allowedCategoryIds = hasConfiguredCategories
        ? new Set(restaurantConfig.allowed_categories.map(Number))
        : null;

    const availableCategories = hasConfiguredCategories
        ? (Array.isArray(categories) ? categories : []).filter(c => allowedCategoryIds.has(Number(c.id)))
        : (Array.isArray(categories) ? categories : []);

    useEffect(() => {
        if (station) {
            setName(station.name || '');
            setPrinter(station.printer_ip_or_name || '');
            setSelectedCategories(Array.isArray(station.category_ids) ? station.category_ids.map(Number) : []);
        } else {
            setName('');
            setPrinter('');
            setSelectedCategories([]);
        }
        setCategorySearch('');
    }, [station, isOpen]);

    if (!isOpen) return null;

    const toggleCategory = (id) => {
        const numId = Number(id);
        setSelectedCategories(prev =>
            prev.includes(numId) ? prev.filter(c => c !== numId) : [...prev, numId]
        );
    };

    const handleSelectAll = () => {
        const allIds = availableCategories.map(c => Number(c.id));
        setSelectedCategories(allIds);
    };

    const handleClearAll = () => {
        setSelectedCategories([]);
    };

    const filteredCategories = availableCategories.filter(c =>
        (c.name || '').toLowerCase().includes(categorySearch.toLowerCase())
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('El nombre de la estación es requerido');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                branch_id: user?.branch_id || null,
                name: name.trim(),
                printer_ip_or_name: printer.trim() || null,
                category_ids: selectedCategories
            };

            if (station?.id) {
                await axios.put(`/api/restaurant/stations/${station.id}`, payload);
                toast.success('Estación actualizada con éxito');
            } else {
                await axios.post('/api/restaurant/stations', payload);
                toast.success('Estación creada con éxito');
            }
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('Error saving station:', err);
            toast.error(err.response?.data?.message || 'Error al guardar estación');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={station?.id ? 'Editar Estación' : 'Nueva Estación de Cocina'}
            maxWidth="max-w-lg"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Nombre de Estación *
                    </label>
                    <input
                        type="text"
                        required
                        placeholder="ej. Cocina Caliente, Bar / Bebidas, Parrilla, Postres"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>

                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Impresora de Comanda Asociada (Opcional)
                    </label>
                    <input
                        type="text"
                        placeholder="ej. 192.168.1.150 o ImpresoraCocina"
                        value={printer}
                        onChange={(e) => setPrinter(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                    />
                </div>

                {/* Categorías asignadas a la estación */}
                <div className="space-y-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-[11px] font-bold text-slate-700 uppercase block">
                                Categorías que prepara esta estación
                            </label>
                            <p className="text-[10px] text-slate-400">
                                Los platillos de estas categorías aparecerán exclusivamente en esta pantalla de KDS.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold">
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="text-indigo-600 hover:text-indigo-800"
                            >
                                Todas
                            </button>
                            <span className="text-slate-300">•</span>
                            <button
                                type="button"
                                onClick={handleClearAll}
                                className="text-slate-500 hover:text-slate-700"
                            >
                                Limpiar
                            </button>
                        </div>
                    </div>

                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar categoría..."
                            value={categorySearch}
                            onChange={(e) => setCategorySearch(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-700"
                        />
                    </div>

                    <div className="max-h-40 overflow-y-auto pr-1 flex flex-wrap gap-1.5 p-1 bg-slate-50/50 rounded-xl border border-slate-100">
                        {filteredCategories.length === 0 ? (
                            <p className="text-[11px] text-slate-400 p-2">
                                {hasConfiguredCategories
                                    ? 'No hay categorías habilitadas para restaurante que coincidan con la búsqueda.'
                                    : 'No hay categorías encontradas.'}
                            </p>
                        ) : (
                            filteredCategories.map(cat => {
                                const isSelected = selectedCategories.includes(Number(cat.id));
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => toggleCategory(cat.id)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                            isSelected
                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 ${
                                            isSelected ? 'bg-white/20 text-white' : 'border border-slate-300'
                                        }`}>
                                            {isSelected && <Check size={11} />}
                                        </div>
                                        <span>{cat.name}</span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                    <p className="text-[10px] text-indigo-600 font-bold">
                        {selectedCategories.length} categoría(s) seleccionada(s)
                    </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 transition-all disabled:opacity-50"
                    >
                        {isSubmitting ? 'Guardando...' : station?.id ? 'Actualizar Estación' : 'Crear Estación'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
