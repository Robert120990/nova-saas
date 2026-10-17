import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import { PosFormModal } from '../components/pos';
import { Plus, Edit, Trash2, Power, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';
import { unwrapList } from '../utils/apiUtils';

const POS = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPos, setSelectedPos] = useState(null);

    const { data: posList = [], isLoading } = useQuery({
        queryKey: ['pos'],
        queryFn: async () => unwrapList(await axios.get('/api/pos'))
    });

    const { data: branches = [] } = useQuery({ 
        queryKey: ['branches'], 
        queryFn: async () => unwrapList(await axios.get('/api/branches'))
    });

    const createMutation = useMutation({
        mutationFn: (newPos) => axios.post('/api/pos', newPos),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pos'] });
            setIsModalOpen(false);
            toast.success('Caja/POS creada');
        },
        onError: (err) => {
            toast.error(err?.response?.data?.message || 'Error al crear punto de venta');
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }) => axios.put(`/api/pos/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pos'] });
            setIsModalOpen(false);
            setSelectedPos(null);
            toast.success('Punto de venta actualizado');
        },
        onError: (err) => {
            toast.error(err?.response?.data?.message || 'Error al actualizar punto de venta');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/pos/${id}`),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['pos'] });
            toast.success(res?.data?.message || 'Punto de venta eliminado');
        },
        onError: (err) => {
            toast.error(err?.response?.data?.message || 'Error al eliminar punto de venta');
        }
    });

    const toggleStatusMutation = useMutation({
        mutationFn: ({ id, status }) => axios.put(`/api/pos/${id}`, { status: status === 'activo' ? 'inactivo' : 'activo' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pos'] });
            toast.success('Punto de venta desactivado');
        },
        onError: (err) => {
            toast.error(err?.response?.data?.message || 'Error al cambiar el estado');
        }
    });

    const handleSave = (data) => {
        if (selectedPos) {
            updateMutation.mutate({ id: selectedPos.id, ...data });
        } else {
            createMutation.mutate(data);
        }
    };

    const handleEdit = (pos) => {
        setSelectedPos(pos);
        setIsModalOpen(true);
    };

    const handleDelete = async (pos) => {
        const hasRecords = Number(pos?.records_count || 0) > 0;
        const ok = await confirm({
            title: hasRecords ? '¿Desactivar punto de venta?' : '¿Eliminar punto de venta?',
            message: hasRecords
                ? 'Esta terminal tiene registros históricos asociados (ventas o turnos), por lo que será desactivada y dejará de aparecer en el sistema.'
                : 'Esta terminal no tiene registros asociados y será eliminada permanentemente del sistema.',
            confirmLabel: hasRecords ? 'Sí, desactivar' : 'Sí, eliminar',
            variant: 'danger',
        });
        if (ok) deleteMutation.mutate(pos.id);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Puntos de Venta (POS)</h2>
                    <p className="text-slate-500 font-medium">Terminales de facturación por sucursal</p>
                </div>
                <button 
                    onClick={() => { setSelectedPos(null); setIsModalOpen(true); }} 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={20}/>
                    <span>Nuevo POS</span>
                </button>
            </div>

            <Table 
                headers={['Sucursal', 'Código', 'Terminal', 'Descuentos', 'Impresora', 'Estado', 'Acciones']}
                data={Array.isArray(posList) ? posList : []}
                isLoading={isLoading}
                renderRow={(pos) => (
                    <tr key={pos.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                        <td className="px-6 py-4">
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-900">{pos.branch_name || 'Desconocida'}</span>
                                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">ID Branch: {pos.branch_id}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold font-mono border border-indigo-100">
                                {pos.codigo}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-700">{pos.nombre}</td>
                        <td className="px-6 py-4">
                            {pos.allow_discounts && Number(pos.allow_discounts) !== 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                    Habilitados
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                    Bloqueados
                                </span>
                            )}
                        </td>
                        <td className="px-6 py-4">
                            {pos.auto_print ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full" title={pos.printer_name}>
                                    <Printer size={10} /> {pos.printer_name || 'Auto'}
                                </span>
                            ) : (
                                <span className="text-[10px] text-slate-400">—</span>
                            )}
                        </td>
                        <td className="px-6 py-4">
                            <button
                                onClick={() => toggleStatusMutation.mutate({ id: pos.id, status: pos.status })}
                                title="Clic para desactivar y ocultar"
                                className={`group flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all border ${
                                    pos.status === 'activo' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100' 
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                <div className={`w-1.5 h-1.5 rounded-full ${pos.status === 'activo' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                                {pos.status === 'activo' ? 'activo' : 'inactivo'}
                                <Power size={12} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                            </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => handleEdit(pos)}
                                    className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    title="Editar"
                                >
                                    <Edit size={18} />
                                </button>
                                <button 
                                    onClick={() => handleDelete(pos)}
                                    className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                    title={Number(pos.records_count || 0) > 0 ? 'Desactivar punto de venta' : 'Eliminar permanentemente'}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </td>
                    </tr>
                )}
            />

            <PosFormModal
                open={isModalOpen}
                onClose={() => { setIsModalOpen(false); setSelectedPos(null); }}
                onSave={handleSave}
                selectedPos={selectedPos}
                branches={branches}
                isSubmitting={createMutation.isPending || updateMutation.isPending}
            />
        </div>
    );
};

export default POS;
