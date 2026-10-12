import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Plus, Edit2, Trash2, Sliders } from 'lucide-react';
import { toast } from 'sonner';
import { unwrapList } from '../../../../utils/apiUtils';
import Money from '../../../../components/ui/Money';
import ModifierGroupModal from '../modals/ModifierGroupModal';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';

export default function RestaurantModifiersTab() {
    const queryClient = useQueryClient();
    const [modalOpen, setModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [groupToDelete, setGroupToDelete] = useState(null);

    const { data: groups = [], isLoading } = useQuery({
        queryKey: ['restaurant-modifiers-groups'],
        queryFn: async () => unwrapList(await axios.get('/api/restaurant/modifiers/groups'))
    });

    const { data: categories = [] } = useQuery({
        queryKey: ['categories-list'],
        queryFn: async () => unwrapList(await axios.get('/api/categories', { params: { limit: 1000 } }))
    });

    const categoryMap = new Map((Array.isArray(categories) ? categories : []).map(c => [c.id, c.name]));

    const deleteMutation = useMutation({
        mutationFn: async (id) => axios.delete(`/api/restaurant/modifiers/groups/${id}`),
        onSuccess: () => {
            toast.success('Grupo de modificadores eliminado');
            queryClient.invalidateQueries({ queryKey: ['restaurant-modifiers-groups'] });
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar grupo')
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
                <div>
                    <h3 className="text-sm font-bold text-slate-800">Grupos de Modificadores y Términos</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Configura términos de cocción, exclusión de ingredientes y adicionales con costo extra.
                    </p>
                </div>
                <button
                    onClick={() => { setEditingGroup(null); setModalOpen(true); }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all shrink-0"
                >
                    <Plus size={14} />
                    <span>Nuevo Grupo</span>
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-12 text-slate-400 text-xs animate-pulse">Cargando modificadores...</div>
            ) : (Array.isArray(groups) ? groups : []).length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                    <p className="text-sm font-bold text-slate-700">No hay modificadores registrados</p>
                    <p className="text-xs text-slate-400 mt-1">Crea grupos de opciones como términos de carne o salsas para tus platillos.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(Array.isArray(groups) ? groups : []).map(g => (
                        <div
                            key={g.id}
                            className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                        >
                            <div className="space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                                            <Sliders size={15} />
                                        </div>
                                        <div>
                                            <h4 className="font-extrabold text-slate-800 text-sm">{g.name}</h4>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold mt-0.5">
                                                {g.is_required ? (
                                                    <span className="text-amber-600 font-bold">Obligatorio</span>
                                                ) : (
                                                    <span>Opcional</span>
                                                )}
                                                <span>•</span>
                                                <span>Mín: {g.min_options} / Máx: {g.max_options}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => { setEditingGroup(g); setModalOpen(true); }}
                                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <Edit2 size={13} />
                                        </button>
                                        <button
                                            onClick={() => setGroupToDelete(g)}
                                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>

                                {/* Categorías asignadas */}
                                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Aplica:</span>
                                    {g.applies_to === 'all' ? (
                                        <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200">
                                            Todos los productos
                                        </span>
                                    ) : (Array.isArray(g.target_category_ids) && g.target_category_ids.length > 0) ? (
                                        g.target_category_ids.slice(0, 3).map(catId => (
                                            <span key={catId} className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg border border-indigo-200">
                                                {categoryMap.get(Number(catId)) || `Cat #${catId}`}
                                            </span>
                                        )).concat(g.target_category_ids.length > 3 ? [
                                            <span key="more" className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-lg">
                                                +{g.target_category_ids.length - 3} más
                                            </span>
                                        ] : [])
                                    ) : (
                                        <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg border border-amber-200">
                                            Sin categorías (no visible)
                                        </span>
                                    )}
                                </div>

                                {/* Lista de Opciones */}
                                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                                    {(Array.isArray(g.options) ? g.options : []).map(opt => (
                                        <div
                                            key={opt.id}
                                            className="flex items-center justify-between text-xs bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100"
                                        >
                                            <span className="font-medium text-slate-700">{opt.name}</span>
                                            {Number(opt.extra_price) > 0 ? (
                                                <span className="text-[11px] font-bold text-emerald-600">
                                                    +<Money value={opt.extra_price} />
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 font-semibold">Sin costo</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ModifierGroupModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                group={editingGroup}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['restaurant-modifiers-groups'] })}
            />

            <ConfirmDialog
                isOpen={Boolean(groupToDelete)}
                title="Eliminar Grupo de Modificadores"
                message={`¿Estás seguro de que deseas eliminar el grupo "${groupToDelete?.name}"? Esta acción no se puede deshacer.`}
                confirmLabel="Sí, eliminar"
                cancelLabel="Cancelar"
                variant="danger"
                onConfirm={() => {
                    if (groupToDelete?.id) {
                        deleteMutation.mutate(groupToDelete.id);
                    }
                    setGroupToDelete(null);
                }}
                onCancel={() => setGroupToDelete(null)}
                onClose={() => setGroupToDelete(null)}
            />
        </div>
    );
}
