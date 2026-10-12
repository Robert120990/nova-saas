import { useState, useEffect } from 'react';
import Modal from '../../../../components/ui/Modal';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../../../../context/AuthContext';

export default function TableModal({ isOpen, onClose, table, areas = [], onSuccess }) {
    const { user } = useAuth();
    const [tableNumber, setTableNumber] = useState('');
    const [areaId, setAreaId] = useState('');
    const [capacity, setCapacity] = useState(4);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (table) {
            setTableNumber(table.table_number || '');
            setAreaId(table.area_id || '');
            setCapacity(table.capacity || 4);
        } else {
            setTableNumber('');
            setAreaId(areas[0]?.id || '');
            setCapacity(4);
        }
    }, [table, areas, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!tableNumber.trim()) {
            toast.error('El número o nombre de la mesa es requerido');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                branch_id: user?.branch_id || null,
                table_number: tableNumber.trim(),
                area_id: areaId ? Number(areaId) : null,
                capacity: Number(capacity) || 4
            };

            if (table?.id) {
                await axios.put(`/api/restaurant/tables/${table.id}`, payload);
                toast.success('Mesa actualizada con éxito');
            } else {
                await axios.post('/api/restaurant/tables', payload);
                toast.success('Mesa creada con éxito');
            }
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('Error saving table:', err);
            toast.error(err.response?.data?.message || 'Error al guardar mesa');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={table?.id ? 'Editar Mesa' : 'Nueva Mesa de Restaurante'}
            maxWidth="max-w-md"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Identificador de Mesa *
                    </label>
                    <input
                        type="text"
                        required
                        placeholder="ej. Mesa 1, M4, Terraza 2, Barra 1"
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>

                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Área / Zona
                    </label>
                    <select
                        value={areaId}
                        onChange={(e) => setAreaId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                    >
                        <option value="">(Sin área asignada)</option>
                        {(Array.isArray(areas) ? areas : []).map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Capacidad de Comensales
                    </label>
                    <input
                        type="number"
                        min="1"
                        max="50"
                        value={capacity}
                        onChange={(e) => setCapacity(e.target.value)}
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
                        {isSubmitting ? 'Guardando...' : table?.id ? 'Actualizar Mesa' : 'Crear Mesa'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
