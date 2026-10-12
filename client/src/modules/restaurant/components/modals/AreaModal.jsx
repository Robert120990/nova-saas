import { useState, useEffect } from 'react';
import Modal from '../../../../components/ui/Modal';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../../../../context/AuthContext';

export default function AreaModal({ isOpen, onClose, area, onSuccess }) {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [orderIndex, setOrderIndex] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (area) {
            setName(area.name || '');
            setOrderIndex(area.order_index || 0);
        } else {
            setName('');
            setOrderIndex(0);
        }
    }, [area, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('El nombre del área es requerido');
            return;
        }

        setIsSubmitting(true);
        try {
            if (area?.id) {
                await axios.put(`/api/restaurant/areas/${area.id}`, { name: name.trim(), order_index: Number(orderIndex) });
                toast.success('Área actualizada con éxito');
            } else {
                await axios.post('/api/restaurant/areas', {
                    branch_id: user?.branch_id || null,
                    name: name.trim(),
                    order_index: Number(orderIndex)
                });
                toast.success('Área creada con éxito');
            }
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('Error saving area:', err);
            toast.error(err.response?.data?.message || 'Error al guardar área');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={area?.id ? 'Editar Área' : 'Nueva Área de Restaurante'}
            maxWidth="max-w-md"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Nombre del Área *
                    </label>
                    <input
                        type="text"
                        required
                        placeholder="ej. Salón Principal, Terraza, Barra"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>

                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Orden de Visualización
                    </label>
                    <input
                        type="number"
                        min="0"
                        value={orderIndex}
                        onChange={(e) => setOrderIndex(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                    />
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
                        {isSubmitting ? 'Guardando...' : area?.id ? 'Actualizar Área' : 'Crear Área'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
