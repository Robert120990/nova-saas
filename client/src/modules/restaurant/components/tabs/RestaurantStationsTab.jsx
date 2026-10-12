import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Plus, Edit2, Trash2, UtensilsCrossed, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { unwrapList } from '../../../../utils/apiUtils';
import { useAuth } from '../../../../context/AuthContext';
import StationModal from '../modals/StationModal';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';

export default function RestaurantStationsTab() {
    const { user } = useAuth();
    const branchId = user?.branch_id;
    const queryClient = useQueryClient();
    const [modalOpen, setModalOpen] = useState(false);
    const [editingStation, setEditingStation] = useState(null);
    const [stationToDelete, setStationToDelete] = useState(null);

    const { data: stations = [], isLoading } = useQuery({
        queryKey: ['restaurant-stations', branchId],
        queryFn: async () => unwrapList(await axios.get('/api/restaurant/stations', { params: { branch_id: branchId } }))
    });

    const { data: categories = [] } = useQuery({
        queryKey: ['categories-list'],
        queryFn: async () => unwrapList(await axios.get('/api/categories', { params: { limit: 1000 } }))
    });

    const categoryMap = new Map((Array.isArray(categories) ? categories : []).map(c => [Number(c.id), c.name]));

    const deleteMutation = useMutation({
        mutationFn: async (id) => axios.delete(`/api/restaurant/stations/${id}`),
        onSuccess: () => {
            toast.success('Estación eliminada');
            queryClient.invalidateQueries({ queryKey: ['restaurant-stations'] });
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar estación')
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
                <div>
                    <h3 className="text-sm font-bold text-slate-800">Estaciones de Cocina y Despacho</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Define los puntos receptores de comandas (ej. Cocina Caliente, Parrilla, Bar / Bebidas).
                    </p>
                </div>
                <button
                    onClick={() => { setEditingStation(null); setModalOpen(true); }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all shrink-0"
                >
                    <Plus size={14} />
                    <span>Nueva Estación</span>
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-12 text-slate-400 text-xs animate-pulse">Cargando estaciones...</div>
            ) : (Array.isArray(stations) ? stations : []).length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                    <p className="text-sm font-bold text-slate-700">No hay estaciones registradas</p>
                    <p className="text-xs text-slate-400 mt-1">Crea estaciones para canalizar los platillos hacia cocina o barra.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {(Array.isArray(stations) ? stations : []).map(s => (
                        <div
                            key={s.id}
                            className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                                            <UtensilsCrossed size={16} />
                                        </div>
                                        <div>
                                            <h4 className="font-extrabold text-slate-800 text-sm">{s.name}</h4>
                                            <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                                                <Printer size={11} />
                                                <span>{s.printer_ip_or_name || 'Sin impresora asociada'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => { setEditingStation(s); setModalOpen(true); }}
                                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <Edit2 size={13} />
                                        </button>
                                        <button
                                            onClick={() => setStationToDelete(s)}
                                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>

                                {/* Categorías asignadas */}
                                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Prepara:</span>
                                    {Array.isArray(s.category_ids) && s.category_ids.length > 0 ? (
                                        s.category_ids.slice(0, 3).map(catId => (
                                            <span key={catId} className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg border border-indigo-200">
                                                {categoryMap.get(Number(catId)) || `Cat #${catId}`}
                                            </span>
                                        )).concat(s.category_ids.length > 3 ? [
                                            <span key="more" className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-lg">
                                                +{s.category_ids.length - 3} más
                                            </span>
                                        ] : [])
                                    ) : (
                                        <span className="text-[10px] font-semibold text-slate-400 italic">
                                            Sin categorías asignadas
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <StationModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                station={editingStation}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['restaurant-stations'] })}
            />

            <ConfirmDialog
                isOpen={Boolean(stationToDelete)}
                title="Eliminar Estación"
                message={`¿Estás seguro de que deseas eliminar la estación "${stationToDelete?.name}"? Esta acción no se puede deshacer.`}
                confirmLabel="Sí, eliminar"
                cancelLabel="Cancelar"
                variant="danger"
                onConfirm={() => {
                    if (stationToDelete?.id) {
                        deleteMutation.mutate(stationToDelete.id);
                    }
                    setStationToDelete(null);
                }}
                onCancel={() => setStationToDelete(null)}
                onClose={() => setStationToDelete(null)}
            />
        </div>
    );
}
