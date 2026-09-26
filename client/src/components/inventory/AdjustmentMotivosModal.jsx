import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Plus, Save, Edit2, Trash2 } from 'lucide-react';
import { useConfirm } from '../../context/ConfirmContext';

const labelCls = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1";
const inputCls = "w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-[13px] font-medium";

export default function AdjustmentMotivosModal({
    open,
    isOpen,
    onClose,
    tipo = 'ENTRADA',
    motivos = [],
}) {
    const isVisible = open !== undefined ? open : isOpen;
    const queryClient = useQueryClient();
    const confirm = useConfirm();

    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    if (!isVisible) return null;

    const handleCreate = async (e) => {
        e.preventDefault();
        const form = e.target;
        const nombre = form.nombre.value.trim();
        if (!nombre) return;

        try {
            setIsCreating(true);
            await axios.post('/api/inventory/motivos', { nombre, tipo });
            toast.success('Motivo creado');
            queryClient.invalidateQueries({ queryKey: ['inventory-motivos'] });
            form.reset();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al crear motivo');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: '¿Eliminar motivo?',
            message: 'Este motivo será eliminado permanentemente y no podrá ser recuperado.',
            confirmLabel: 'Sí, eliminar',
            variant: 'danger',
        });
        if (!ok) return;

        try {
            await axios.delete(`/api/inventory/motivos/${id}`);
            toast.success('Motivo eliminado');
            queryClient.invalidateQueries({ queryKey: ['inventory-motivos'] });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al eliminar');
        }
    };

    const handleUpdate = async (id) => {
        if (!editValue.trim()) return;
        try {
            await axios.put(`/api/inventory/motivos/${id}`, { nombre: editValue.trim() });
            toast.success('Motivo actualizado');
            setEditingId(null);
            queryClient.invalidateQueries({ queryKey: ['inventory-motivos'] });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al actualizar');
        }
    };

    const filteredMotivos = motivos.filter(m => m.tipo === tipo);

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-900">Gestión de Motivos</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className={labelCls}>Nuevo Motivo ({tipo})</label>
                            <div className="flex gap-2">
                                <input
                                    name="nombre"
                                    required
                                    type="text"
                                    placeholder="Ej: Ajuste por Daño"
                                    className={inputCls}
                                />
                                <button
                                    type="submit"
                                    disabled={isCreating}
                                    className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                                    title="Agregar motivo"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>
                    </form>

                    <div className="space-y-2">
                        <label className={labelCls}>Existentes para {tipo}</label>
                        <div className="space-y-1 max-h-60 overflow-y-auto pr-2">
                            {filteredMotivos.length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-4">
                                    No hay motivos registrados para {tipo}
                                </p>
                            ) : (
                                filteredMotivos.map(m => (
                                    <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                                        {editingId === m.id ? (
                                            <div className="flex-1 flex gap-2">
                                                <input
                                                    autoFocus
                                                    className="flex-1 px-2 py-1 text-sm rounded border border-indigo-200 outline-none focus:ring-1 focus:ring-indigo-500"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                />
                                                <button
                                                    onClick={() => handleUpdate(m.id)}
                                                    className="text-emerald-600 p-1 hover:bg-emerald-50 rounded cursor-pointer"
                                                    title="Guardar"
                                                >
                                                    <Save size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="text-slate-400 p-1 hover:bg-slate-100 rounded cursor-pointer"
                                                    title="Cancelar"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="text-sm font-bold text-slate-700">{m.nombre}</span>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => { setEditingId(m.id); setEditValue(m.nombre); }}
                                                        className="p-1.5 text-amber-600 hover:bg-amber-50 rounded cursor-pointer"
                                                        title="Editar nombre"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(m.id)}
                                                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                                        title="Eliminar motivo"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
