import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const selectCls = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm font-medium";

export default function UserAccessBulkRoleModal({
    open,
    selectedRowKeys = [],
    roles = [],
    onClose,
    onSuccess,
}) {
    const queryClient = useQueryClient();
    const [bulkNewRoleId, setBulkNewRoleId] = useState('');

    useEffect(() => {
        if (open) {
            setBulkNewRoleId('');
        }
    }, [open]);

    const bulkUpdateRoleMutation = useMutation({
        mutationFn: (data) => axios.post('/api/users/bulk-update-role', data),
        onSuccess: (res) => {
            toast.success(res.data?.message || 'Roles actualizados correctamente');
            queryClient.invalidateQueries({ queryKey: ['access-summary'] });
            if (onSuccess) onSuccess(res.data);
            onClose();
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al actualizar roles');
        }
    });

    if (!open) return null;

    const handleExecuteBulkRoleChange = () => {
        if (selectedRowKeys.length === 0) return;
        if (!bulkNewRoleId) {
            return toast.error('Debe seleccionar el nuevo rol');
        }

        const items = selectedRowKeys.map(k => {
            const [userId, companyId] = k.split('-');
            return { userId: parseInt(userId), companyId: parseInt(companyId) };
        });

        bulkUpdateRoleMutation.mutate({
            items,
            newRoleId: parseInt(bulkNewRoleId)
        });
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
                <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <ShieldCheck size={18} className="text-indigo-600" />
                        Cambiar Rol Masivamente
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Seleccione el nuevo rol para los <strong className="font-bold text-slate-800">{selectedRowKeys.length}</strong> accesos seleccionados:
                    </p>
                </div>

                <select
                    value={bulkNewRoleId}
                    onChange={(e) => setBulkNewRoleId(e.target.value)}
                    className={selectCls}
                >
                    <option value="">-- Seleccionar nuevo rol --</option>
                    {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                </select>

                <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleExecuteBulkRoleChange}
                        disabled={bulkUpdateRoleMutation.isPending || !bulkNewRoleId}
                        className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                    >
                        {bulkUpdateRoleMutation.isPending ? 'Actualizando...' : 'Actualizar Roles'}
                    </button>
                </div>
            </div>
        </div>
    );
}
