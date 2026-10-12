import { useState, useEffect } from 'react';
import Modal from '../../../../components/ui/Modal';
import Money from '../../../../components/ui/Money';
import { toast } from 'sonner';

export default function RestaurantItemModifierModal({
    isOpen,
    onClose,
    product,
    modifierGroups = [],
    onConfirm
}) {
    const [selectedModifiers, setSelectedModifiers] = useState([]);
    const [notes, setNotes] = useState('');
    const [course, setCourse] = useState('fuerte');
    const [seatNumber, setSeatNumber] = useState(1);

    // Filtrar únicamente los grupos de modificadores que aplican a este producto o a su categoría
    const applicableModifierGroups = (Array.isArray(modifierGroups) ? modifierGroups : []).filter(group => {
        const appliesTo = group.applies_to || 'categories';
        if (appliesTo === 'all') return true;
        if (appliesTo === 'categories') {
            const catIds = Array.isArray(group.target_category_ids) ? group.target_category_ids.map(Number) : [];
            if (catIds.length === 0) return false;
            return product?.category_id && catIds.includes(Number(product.category_id));
        }
        if (appliesTo === 'products') {
            const prodIds = Array.isArray(group.target_product_ids) ? group.target_product_ids.map(Number) : [];
            return prodIds.includes(Number(product?.id));
        }
        return false;
    });

    useEffect(() => {
        if (isOpen) {
            setSelectedModifiers([]);
            setNotes('');
            const pName = (product?.nombre || product?.name || '').toLowerCase();
            let initialCourse = 'fuerte';
            if (pName.includes('cafe') || pName.includes('café') || pName.includes('postre') || pName.includes('torta') || pName.includes('cheesecake') || pName.includes('helado')) {
                initialCourse = 'postre';
            } else if (pName.includes('bebida') || pName.includes('soda') || pName.includes('cerveza') || pName.includes('agua') || pName.includes('jugo') || pName.includes('gaseosa')) {
                initialCourse = 'bebida';
            } else if (pName.includes('sopa') || pName.includes('ensalada') || pName.includes('entrada') || pName.includes('nacho') || pName.includes('alitas')) {
                initialCourse = 'entrada';
            }
            setCourse(initialCourse);
            setSeatNumber(1);
        }
    }, [isOpen, product]);

    if (!isOpen || !product) return null;

    const toggleModifier = (opt) => {
        setSelectedModifiers(prev => {
            const exists = prev.some(m => m.name === opt.name);
            if (exists) {
                return prev.filter(m => m.name !== opt.name);
            }
            return [...prev, opt];
        });
    };

    const handleConfirm = () => {
        for (const grp of applicableModifierGroups) {
            if (grp.is_required) {
                const grpOptionNames = new Set((grp.options || []).map(o => o.name));
                const hasSelected = selectedModifiers.some(m => grpOptionNames.has(m.name));
                if (!hasSelected) {
                    toast.error(`Selección obligatoria: ${grp.name}`);
                    return;
                }
            }
        }

        onConfirm({
            product_id: product.id,
            product_name: product.nombre || product.name,
            unit_price: Number(product.precio_unitario || product.price || product.costo || 0),
            quantity: 1,
            course,
            seat_number: Number(seatNumber) || 1,
            notes: notes.trim(),
            selected_modifiers: selectedModifiers
        });
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={product.nombre || product.name}
            maxWidth="max-w-md"
        >
            <div className="space-y-4">
                {/* Tiempo de Comida y Comensal */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Tiempo de Comida
                        </label>
                        <select
                            value={course}
                            onChange={(e) => setCourse(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-800"
                        >
                            <option value="bebida">Bebida</option>
                            <option value="entrada">Entrada</option>
                            <option value="fuerte">Plato Fuerte</option>
                            <option value="postre">Postre / Café</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Comensal / Asiento
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="20"
                            value={seatNumber}
                            onChange={(e) => setSeatNumber(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-800"
                        />
                    </div>
                </div>

                {/* Modificadores y Términos */}
                {applicableModifierGroups.length > 0 && (
                    <div className="space-y-3">
                        {applicableModifierGroups.map(group => (
                            <div key={group.id} className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-tight block">
                                        {group.name} {group.is_required ? <span className="text-rose-500">*</span> : ''}
                                    </span>
                                    {group.is_required ? (
                                        <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                            Requerido
                                        </span>
                                    ) : null}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {(Array.isArray(group.options) ? group.options : []).map(opt => {
                                        const isSelected = selectedModifiers.some(m => m.name === opt.name);
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => toggleModifier(opt)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                                    isSelected
                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                                }`}
                                            >
                                                <span>{opt.name}</span>
                                                {Number(opt.extra_price) > 0 && (
                                                    <span className={`ml-1 text-[10px] ${isSelected ? 'text-indigo-100' : 'text-emerald-600'}`}>
                                                        (+<Money value={opt.extra_price} />)
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Notas Especiales de Cocina */}
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Notas para Cocina
                    </label>
                    <input
                        type="text"
                        placeholder="ej. Sin cebolla, Salsa aparte, Término 3/4"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                    />
                </div>

                {/* Botón de Confirmación */}
                <div className="pt-2">
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-md shadow-indigo-200 active:scale-98 transition-all"
                    >
                        Agregar a la Comanda
                    </button>
                </div>
            </div>
        </Modal>
    );
}
