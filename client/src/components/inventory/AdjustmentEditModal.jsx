import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { X } from 'lucide-react';

export default function AdjustmentEditModal({
    open,
    adjustment,
    onClose,
    onSaveSuccess,
}) {
    const queryClient = useQueryClient();
    const [form, setForm] = useState({ numero: '', fecha: '', observaciones: '' });

    const isVisible = open !== undefined ? open : !!adjustment;

    useEffect(() => {
        if (adjustment) {
            setForm({
                numero: adjustment.numero || '',
                fecha: adjustment.fecha ? adjustment.fecha.split('T')[0].split(' ')[0] : '',
                observaciones: adjustment.observaciones || '',
            });
        }
    }, [adjustment]);

    const mutation = useMutation({
        mutationFn: (data) => axios.put(`/api/inventory/adjustments/${adjustment?.id}`, data),
        onSuccess: (res) => {
            toast.success('Cambios guardados correctamente');
            queryClient.invalidateQueries({ queryKey: ['inventory-adjustments'] });
            if (onSaveSuccess) onSaveSuccess(res.data);
            onClose();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al actualizar');
        }
    });

    if (!isVisible || !adjustment) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">Editar Movimiento</h3>
                        <p className="text-xs text-slate-500 font-medium">Actualice información informativa del encabezado</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1 mb-1 block">Número de Documento</label>
                        <input
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 text-sm font-bold text-slate-800"
                            value={form.numero}
                            onChange={(e) => setForm(prev => ({ ...prev, numero: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1 mb-1 block">Fecha</label>
                        <input
                            type="date"
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 text-sm font-bold text-slate-800"
                            value={form.fecha}
                            onChange={(e) => setForm(prev => ({ ...prev, fecha: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1 mb-1 block">Observaciones</label>
                        <textarea
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 text-sm font-medium h-24 resize-none text-slate-800"
                            value={form.observaciones}
                            onChange={(e) => setForm(prev => ({ ...prev, observaciones: e.target.value }))}
                        />
                    </div>
                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all text-xs uppercase tracking-wider cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={() => mutation.mutate(form)}
                            disabled={mutation.isPending}
                            className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-50 transition-all cursor-pointer"
                        >
                            {mutation.isPending ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
