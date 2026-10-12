import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Modal from '../../../../components/ui/Modal';
import { Plus, Trash2 } from 'lucide-react';
import { MoneyInput } from '../../../../components/ui/Money';
import axios from 'axios';
import { toast } from 'sonner';
import { unwrapList } from '../../../../utils/apiUtils';

export default function ModifierGroupModal({ isOpen, onClose, group, onSuccess }) {
    const [name, setName] = useState('');
    const [isRequired, setIsRequired] = useState(false);
    const [minOptions, setMinOptions] = useState(0);
    const [maxOptions, setMaxOptions] = useState(1);
    const [appliesTo, setAppliesTo] = useState('categories');
    const [targetCategoryIds, setTargetCategoryIds] = useState([]);
    const [options, setOptions] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: categories = [] } = useQuery({
        queryKey: ['categories-list'],
        queryFn: async () => unwrapList(await axios.get('/api/categories', { params: { limit: 1000 } }))
    });

    const { data: restaurantConfig } = useQuery({
        queryKey: ['restaurant-config'],
        queryFn: async () => (await axios.get('/api/restaurant/config')).data?.data || {}
    });

    const allowedCategoryIds = Array.isArray(restaurantConfig?.allowed_categories) && restaurantConfig.allowed_categories.length > 0
        ? new Set(restaurantConfig.allowed_categories.map(Number))
        : null;

    const availableCategories = allowedCategoryIds
        ? (Array.isArray(categories) ? categories : []).filter(c => allowedCategoryIds.has(Number(c.id)))
        : categories;

    useEffect(() => {
        if (group) {
            setName(group.name || '');
            setIsRequired(Boolean(group.is_required));
            setMinOptions(group.min_options || 0);
            setMaxOptions(group.max_options || 1);
            setAppliesTo(group.applies_to || 'categories');
            setTargetCategoryIds(Array.isArray(group.target_category_ids) ? group.target_category_ids : []);
            setOptions(Array.isArray(group.options) ? group.options.map(o => ({ ...o })) : []);
        } else {
            setName('');
            setIsRequired(false);
            setMinOptions(0);
            setMaxOptions(1);
            setAppliesTo('categories');
            setTargetCategoryIds([]);
            setOptions([{ name: '', extra_price: 0 }]);
        }
    }, [group, isOpen]);

    if (!isOpen) return null;

    const handleAddOption = () => {
        setOptions(prev => [...prev, { name: '', extra_price: 0 }]);
    };

    const handleRemoveOption = (idx) => {
        setOptions(prev => prev.filter((_, i) => i !== idx));
    };

    const handleOptionChange = (idx, field, val) => {
        setOptions(prev => prev.map((opt, i) => i === idx ? { ...opt, [field]: val } : opt));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('El nombre del grupo es obligatorio');
            return;
        }

        const validOptions = options.filter(o => o.name && o.name.trim());
        if (validOptions.length === 0) {
            toast.error('Debe agregar al menos una opción o modificador');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                name: name.trim(),
                applies_to: appliesTo,
                target_category_ids: appliesTo === 'categories' ? targetCategoryIds : [],
                is_required: isRequired ? 1 : 0,
                min_options: Number(minOptions),
                max_options: Number(maxOptions),
                options: validOptions.map(o => ({
                    name: o.name.trim(),
                    extra_price: Number(o.extra_price) || 0
                }))
            };

            if (group?.id) {
                await axios.put(`/api/restaurant/modifiers/groups/${group.id}`, payload);
                toast.success('Grupo de modificadores actualizado');
            } else {
                await axios.post('/api/restaurant/modifiers/groups', payload);
                toast.success('Grupo de modificadores creado');
            }
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('Error saving modifier group:', err);
            toast.error(err.response?.data?.message || 'Error al guardar grupo');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={group?.id ? 'Editar Grupo de Modificadores' : 'Nuevo Grupo de Modificadores'}
            maxWidth="max-w-lg"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Nombre del Grupo *
                    </label>
                    <input
                        type="text"
                        required
                        placeholder="ej. Término de Carne, Salsa, Extras"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                    />
                </div>

                {/* ¿A qué productos aplica? */}
                <div className="space-y-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700 uppercase">
                            ¿A qué productos aplica este grupo?
                        </label>
                        <span className="text-[10px] text-slate-400">Control de menú</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setAppliesTo('categories')}
                            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                                appliesTo === 'categories'
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            Por Categorías
                        </button>
                        <button
                            type="button"
                            onClick={() => setAppliesTo('all')}
                            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                                appliesTo === 'all'
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            Todos los Productos
                        </button>
                    </div>

                    {appliesTo === 'categories' && (
                        <div className="pt-1 space-y-2">
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-500 font-medium">
                                    {allowedCategoryIds ? `Categorías de restaurante (${availableCategories.length}):` : 'Categorías disponibles:'}
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setTargetCategoryIds((Array.isArray(availableCategories) ? availableCategories : []).map(c => c.id))}
                                        className="text-indigo-600 font-bold hover:underline"
                                    >
                                        Todas
                                    </button>
                                    <span className="text-slate-300">|</span>
                                    <button
                                        type="button"
                                        onClick={() => setTargetCategoryIds([])}
                                        className="text-slate-500 font-bold hover:underline"
                                    >
                                        Ninguna
                                    </button>
                                </div>
                            </div>

                            {availableCategories.length === 0 ? (
                                <p className="text-[11px] text-amber-600 p-2 bg-amber-50 rounded-lg">
                                    No hay categorías de menú configuradas. Visita la pestaña de Parámetros para habilitar categorías gastronómicas.
                                </p>
                            ) : (
                                <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                                    {availableCategories.map(cat => {
                                        const isChecked = targetCategoryIds.includes(cat.id);
                                        return (
                                            <label
                                                key={cat.id}
                                                className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                                                    isChecked
                                                        ? 'bg-white border-indigo-400 text-indigo-900 font-bold shadow-2xs'
                                                        : 'bg-slate-100/60 border-slate-200 text-slate-600 hover:bg-white'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => {
                                                        setTargetCategoryIds(prev =>
                                                            prev.includes(cat.id)
                                                                ? prev.filter(id => id !== cat.id)
                                                                : [...prev, cat.id]
                                                        );
                                                    }}
                                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                                                />
                                                <span className="truncate">{cat.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Mín. Selecciones
                        </label>
                        <input
                            type="number"
                            min="0"
                            value={minOptions}
                            onChange={(e) => setMinOptions(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Máx. Selecciones
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={maxOptions}
                            onChange={(e) => setMaxOptions(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                        />
                    </div>
                    <div className="col-span-2 flex items-center gap-2 pt-1">
                        <input
                            type="checkbox"
                            id="is_req"
                            checked={isRequired}
                            onChange={(e) => setIsRequired(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="is_req" className="text-xs font-medium text-slate-700">
                            Selección Obligatoria en la comanda
                        </label>
                    </div>
                </div>

                {/* Opciones */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">
                            Opciones del Grupo
                        </label>
                        <button
                            type="button"
                            onClick={handleAddOption}
                            className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1"
                        >
                            <Plus size={14} />
                            <span>Agregar Opción</span>
                        </button>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {options.map((opt, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                                <input
                                    type="text"
                                    placeholder="Nombre (ej. Bien Cocido, Extra Queso)"
                                    value={opt.name}
                                    onChange={(e) => handleOptionChange(idx, 'name', e.target.value)}
                                    className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                                />
                                <div className="w-28">
                                    <MoneyInput
                                        placeholder="+$0.00"
                                        value={opt.extra_price}
                                        onChange={(val) => handleOptionChange(idx, 'extra_price', val)}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveOption(idx)}
                                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
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
                        {isSubmitting ? 'Guardando...' : group?.id ? 'Actualizar Grupo' : 'Crear Grupo'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
