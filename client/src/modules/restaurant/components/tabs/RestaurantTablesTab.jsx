import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Plus, Edit2, Trash2, Layers, Users } from 'lucide-react';
import { toast } from 'sonner';
import { unwrapList } from '../../../../utils/apiUtils';
import { useAuth } from '../../../../context/AuthContext';
import TableModal from '../modals/TableModal';
import AreaModal from '../modals/AreaModal';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';

export default function RestaurantTablesTab() {
    const { user } = useAuth();
    const branchId = user?.branch_id;
    const queryClient = useQueryClient();
    const [selectedAreaId, setSelectedAreaId] = useState('all');
    const [tableModalOpen, setTableModalOpen] = useState(false);
    const [areaModalOpen, setAreaModalOpen] = useState(false);
    const [editingTable, setEditingTable] = useState(null);
    const [editingArea, setEditingArea] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        content: '',
        onConfirm: () => {}
    });

    const { data: areas = [], isLoading: loadingAreas } = useQuery({
        queryKey: ['restaurant-areas', branchId],
        queryFn: async () => unwrapList(await axios.get('/api/restaurant/areas', { params: { branch_id: branchId } }))
    });

    const { data: tables = [], isLoading: loadingTables } = useQuery({
        queryKey: ['restaurant-tables', selectedAreaId, branchId],
        queryFn: async () => {
            const url = selectedAreaId !== 'all'
                ? `/api/restaurant/tables?area_id=${selectedAreaId}`
                : '/api/restaurant/tables';
            return unwrapList(await axios.get(url, { params: { branch_id: branchId } }));
        }
    });

    const deleteTableMutation = useMutation({
        mutationFn: async (id) => axios.delete(`/api/restaurant/tables/${id}`),
        onSuccess: () => {
            toast.success('Mesa eliminada');
            queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] });
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar mesa')
    });

    const deleteAreaMutation = useMutation({
        mutationFn: async (id) => axios.delete(`/api/restaurant/areas/${id}`),
        onSuccess: () => {
            toast.success('Área eliminada');
            queryClient.invalidateQueries({ queryKey: ['restaurant-areas'] });
            queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] });
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar área')
    });

    return (
        <div className="space-y-6">
            {/* Header de Áreas y Botones de Creación */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                    <button
                        onClick={() => setSelectedAreaId('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                            selectedAreaId === 'all'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        Todas las Mesas ({(Array.isArray(tables) ? tables : []).length})
                    </button>
                    {(Array.isArray(areas) ? areas : []).map(a => (
                        <div key={a.id} className="flex items-center gap-1 shrink-0">
                            <button
                                onClick={() => setSelectedAreaId(String(a.id))}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    selectedAreaId === String(a.id)
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {a.name}
                            </button>
                            <button
                                onClick={() => { setEditingArea(a); setAreaModalOpen(true); }}
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                                title="Editar área"
                            >
                                <Edit2 size={12} />
                            </button>
                            <button
                                onClick={() => {
                                    setConfirmDialog({
                                        isOpen: true,
                                        title: 'Eliminar Área',
                                        content: `¿Estás seguro de que deseas eliminar el área "${a.name}"? Esta acción no se puede deshacer.`,
                                        onConfirm: () => deleteAreaMutation.mutate(a.id)
                                    });
                                }}
                                className="p-1 text-slate-400 hover:text-red-500 rounded"
                                title="Eliminar área"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => { setEditingArea(null); setAreaModalOpen(true); }}
                        className="flex-1 sm:flex-initial px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                        <Layers size={14} />
                        <span>Nueva Área</span>
                    </button>
                    <button
                        onClick={() => { setEditingTable(null); setTableModalOpen(true); }}
                        className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                        <Plus size={14} />
                        <span>Nueva Mesa</span>
                    </button>
                </div>
            </div>

            {/* Grilla de Mesas */}
            {loadingTables || loadingAreas ? (
                <div className="text-center py-12 text-slate-400 text-xs animate-pulse">Cargando mesas...</div>
            ) : (Array.isArray(tables) ? tables : []).length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                    <p className="text-sm font-bold text-slate-700">No hay mesas registradas</p>
                    <p className="text-xs text-slate-400 mt-1">Crea una nueva mesa o área para comenzar a tomar comandas.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                    {(Array.isArray(tables) ? tables : []).map(t => {
                        const statusColors = {
                            disponible: 'border-emerald-200 bg-emerald-50/40 text-emerald-700',
                            ocupada: 'border-rose-200 bg-rose-50/40 text-rose-700',
                            cuenta_pedida: 'border-amber-200 bg-amber-50/40 text-amber-700',
                            reservada: 'border-purple-200 bg-purple-50/40 text-purple-700'
                        };

                        return (
                            <div
                                key={t.id}
                                className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${statusColors[t.status] || 'border-slate-200 text-slate-600'}`}>
                                            {t.status.toUpperCase()}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => { setEditingTable(t); setTableModalOpen(true); }}
                                                className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                                            >
                                                <Edit2 size={13} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setConfirmDialog({
                                                        isOpen: true,
                                                        title: 'Eliminar Mesa',
                                                        content: `¿Estás seguro de que deseas eliminar la mesa "${t.table_number}"? Esta acción no se puede deshacer.`,
                                                        onConfirm: () => deleteTableMutation.mutate(t.id)
                                                    });
                                                }}
                                                className="p-1 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-extrabold text-slate-900 text-base">{t.table_number}</h4>
                                        <p className="text-[11px] text-slate-500 font-medium">{t.area_name || 'Sin Área'}</p>
                                    </div>
                                </div>

                                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                    <span className="flex items-center gap-1 font-semibold">
                                        <Users size={12} className="text-slate-400" />
                                        <span>{t.capacity} pers.</span>
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modales */}
            <AreaModal
                isOpen={areaModalOpen}
                onClose={() => setAreaModalOpen(false)}
                area={editingArea}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['restaurant-areas'] });
                    queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] });
                }}
            />

            <TableModal
                isOpen={tableModalOpen}
                onClose={() => setTableModalOpen(false)}
                table={editingTable}
                areas={areas}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] })}
            />

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.content}
                confirmLabel="Sí, eliminar"
                cancelLabel="Cancelar"
                variant="danger"
                onConfirm={() => {
                    confirmDialog.onConfirm();
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                }}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}
