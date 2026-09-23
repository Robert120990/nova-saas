import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Copy, Users as UsersIcon, X, Search, Check } from 'lucide-react';
import { toast } from 'sonner';

const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2";
const selectCls = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm font-medium";

export default function UserAccessCloneModal({
    open,
    users = [],
    onClose,
    onSuccess,
}) {
    const queryClient = useQueryClient();

    const [cloneSourceUserId, setCloneSourceUserId] = useState('');
    const [cloneTargetUserIds, setCloneTargetUserIds] = useState([]);
    const [cloneMode, setCloneMode] = useState('merge'); // 'merge' | 'replace'
    const [cloneTargetSearch, setCloneTargetSearch] = useState('');

    useEffect(() => {
        if (open) {
            setCloneSourceUserId('');
            setCloneTargetUserIds([]);
            setCloneMode('merge');
            setCloneTargetSearch('');
        }
    }, [open]);

    const cloneMutation = useMutation({
        mutationFn: (data) => axios.post('/api/users/clone-access', data),
        onSuccess: (res) => {
            toast.success(res.data?.message || 'Accesos clonados exitosamente');
            queryClient.invalidateQueries({ queryKey: ['access-summary'] });
            if (onSuccess) onSuccess(res.data);
            onClose();
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al clonar accesos');
        }
    });

    if (!open) return null;

    const handleExecuteClone = () => {
        if (!cloneSourceUserId) {
            return toast.error('Seleccione el usuario plantilla de origen');
        }
        if (cloneTargetUserIds.length === 0) {
            return toast.error('Seleccione al menos un usuario destino');
        }

        cloneMutation.mutate({
            sourceUserId: parseInt(cloneSourceUserId),
            targetUserIds: cloneTargetUserIds.map(id => parseInt(id)),
            mode: cloneMode
        });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                            <Copy size={18} className="text-indigo-600" />
                            Clonar Accesos de Usuario
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                            Copie exactamente los mismos permisos de un usuario existente a otros usuarios
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-500 transition-colors cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5 flex-1">
                    {/* Usuario Origen */}
                    <div>
                        <label className={labelCls}>
                            <UsersIcon size={14} className="text-indigo-600" /> 1. Usuario Plantilla (Origen)
                        </label>
                        <select
                            value={cloneSourceUserId}
                            onChange={(e) => {
                                setCloneSourceUserId(e.target.value);
                                setCloneTargetUserIds(prev => prev.filter(id => String(id) !== String(e.target.value)));
                            }}
                            className={selectCls}
                        >
                            <option value="">Seleccione el usuario cuyos accesos desea copiar...</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.nombre} (@{u.username})</option>
                            ))}
                        </select>
                    </div>

                    {/* Usuarios Destino */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className={labelCls}>
                                <UsersIcon size={14} className="text-indigo-600" /> 2. Usuarios Destino ({cloneTargetUserIds.length} seleccionados)
                            </label>
                            <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 text-xs">
                                <Search size={12} className="text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Filtrar..."
                                    value={cloneTargetSearch}
                                    onChange={(e) => setCloneTargetSearch(e.target.value)}
                                    className="bg-transparent outline-none text-xs w-28"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 bg-slate-50/50 rounded-2xl border border-slate-200 scroll-modern">
                            {users
                                .filter(u => String(u.id) !== String(cloneSourceUserId))
                                .filter(u => u.nombre.toLowerCase().includes(cloneTargetSearch.toLowerCase()) || u.username.toLowerCase().includes(cloneTargetSearch.toLowerCase()))
                                .map(u => {
                                    const isChecked = cloneTargetUserIds.includes(u.id);
                                    return (
                                        <button
                                            key={u.id}
                                            type="button"
                                            onClick={() => {
                                                setCloneTargetUserIds(prev =>
                                                    prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                                                );
                                            }}
                                            className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                                                isChecked
                                                ? 'bg-indigo-50 border-indigo-400 text-indigo-800'
                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                                            }`}
                                        >
                                            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                                                isChecked ? 'bg-indigo-600 text-white' : 'border border-slate-300'
                                            }`}>
                                                {isChecked && <Check size={10} strokeWidth={3} />}
                                            </div>
                                            <div className="truncate">
                                                <span className="font-bold">{u.nombre}</span>
                                                <span className="text-[10px] text-slate-400 ml-1">@{u.username}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                        </div>
                    </div>

                    {/* Modo de Clonación */}
                    <div className="space-y-1">
                        <label className={labelCls}>Modo de clonación</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setCloneMode('merge')}
                                className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                                    cloneMode === 'merge'
                                    ? 'bg-indigo-50 border-indigo-400 text-indigo-800 font-bold'
                                    : 'bg-white border-slate-200 text-slate-600'
                                }`}
                            >
                                <div>Combinar / Agregar</div>
                                <div className="text-[10px] text-slate-400 font-normal">Conserva otros accesos que ya tenga el destino</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setCloneMode('replace')}
                                className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                                    cloneMode === 'replace'
                                    ? 'bg-red-50 border-red-400 text-red-800 font-bold'
                                    : 'bg-white border-slate-200 text-slate-600'
                                }`}
                            >
                                <div>Reemplazar Todo</div>
                                <div className="text-[10px] text-slate-400 font-normal">Deja al destino exactamente idéntico al origen</div>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                    <button 
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-200 transition-all cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="button"
                        onClick={handleExecuteClone}
                        disabled={cloneMutation.isPending || !cloneSourceUserId || cloneTargetUserIds.length === 0}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold text-xs transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                    >
                        <Copy size={16} />
                        <span>{cloneMutation.isPending ? 'Clonando...' : 'Clonar y Aplicar'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
