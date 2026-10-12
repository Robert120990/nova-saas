import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeftRight } from 'lucide-react';
import Modal from '../ui/Modal';
import { formatDate } from '../../utils/dateUtils';

const ShiftChangeModal = ({
    isOpen,
    onClose,
    changeIds = [],
    currentShift,
    onSuccess
}) => {
    const [targetShiftId, setTargetShiftId] = useState('');

    const { data: targetShifts = [], isLoading: isLoadingShifts } = useQuery({
        queryKey: ['shifts', 'candidates', currentShift?.branch_id, currentShift?.id],
        queryFn: async () => {
            if (!currentShift?.branch_id) return [];
            const res = await axios.get('/api/shifts', {
                params: {
                    branch_id: currentShift.branch_id,
                    limit: 50
                }
            });
            const list = Array.isArray(res.data?.data) ? res.data.data : [];
            return list.filter((s) => s.id != currentShift.id);
        },
        enabled: isOpen && !!currentShift?.branch_id
    });

    const changeShiftMutation = useMutation({
        mutationFn: async ({ ids, shift_id }) =>
            (await axios.put('/api/sales/change-shift', { ids, shift_id })).data,
        onSuccess: (data) => {
            toast.success(data.message || 'Ventas cambiadas de turno correctamente');
            setTargetShiftId('');
            onSuccess();
            onClose();
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al cambiar las ventas de turno');
        }
    });

    const handleConfirm = () => {
        if (!targetShiftId || changeIds.length === 0) return;
        changeShiftMutation.mutate({ ids: changeIds, shift_id: targetShiftId });
    };

    const handleClose = () => {
        setTargetShiftId('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Cambiar DTE a otro Turno"
            maxWidth="max-w-xl"
        >
            <div className="space-y-5">
                <div className="flex items-center gap-3 p-4 bg-indigo-50 text-indigo-800 rounded-3xl border border-indigo-100 text-xs">
                    <ArrowLeftRight size={20} className="shrink-0" />
                    <div>
                        <p className="font-black uppercase tracking-widest mb-1">Confirmar Cambio de Turno</p>
                        <p className="font-medium">
                            {changeIds.length} DTE(s) se moverán del turno actual. Los totales de ambos turnos se recalcularán automáticamente.
                        </p>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Turno Destino
                    </label>
                    {isLoadingShifts ? (
                        <div className="p-4 bg-slate-50 rounded-2xl text-center text-xs font-bold text-slate-400">
                            Cargando turnos disponibles...
                        </div>
                    ) : targetShifts.length === 0 ? (
                        <div className="p-4 bg-slate-50 rounded-2xl text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            No hay otros turnos disponibles en esta sucursal
                        </div>
                    ) : (
                        <select
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all cursor-pointer"
                            value={targetShiftId}
                            onChange={(e) => setTargetShiftId(e.target.value)}
                        >
                            <option value="">Seleccione un turno destino...</option>
                            {targetShifts.map((shift) => (
                                <option key={shift.id} value={shift.id}>
                                    Turno #{shift.shift_number || shift.id} — {formatDate(shift.shift_date || shift.start_time)} — {shift.pos_name} — {shift.seller_name} ({shift.status === 'open' ? 'Abierto' : 'Cerrado'})
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-6 py-2.5 text-slate-500 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all"
                        disabled={changeShiftMutation.isPending}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!targetShiftId || changeShiftMutation.isPending}
                        className="px-8 py-2.5 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {changeShiftMutation.isPending ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <ArrowLeftRight size={16} />
                        )}
                        Confirmar Cambio
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ShiftChangeModal;
