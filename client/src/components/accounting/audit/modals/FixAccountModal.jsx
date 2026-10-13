import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Wrench, CheckCircle2, AlertCircle, Unlink, Save, Trash2, Edit3, Sliders } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';

export const FixAccountModal = ({ open, onClose, account, accounts = [], onFixed }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('actions');

    const [formData, setFormData] = useState({
        code: '',
        name: '',
        parent_id: '',
        allows_entries: false,
        active: true
    });

    useEffect(() => {
        if (!account) return;
        const accountId = account.accountId || account.id;
        const matched = (Array.isArray(accounts) ? accounts : []).find(a => String(a.id) === String(accountId));

        setFormData({
            code: account.code || matched?.code || '',
            name: account.name || matched?.name || '',
            parent_id: (account.parent_id !== undefined ? account.parent_id : matched?.parent_id) || '',
            allows_entries: account.allows_entries !== undefined ? Boolean(account.allows_entries) : Boolean(matched?.allows_entries),
            active: account.active !== undefined ? Boolean(account.active) : Boolean(matched?.active ?? true)
        });

        const isDirectEdit = account.fixType === 'edit_account' ||
            account.category?.toLowerCase().includes('duplicidad') ||
            account.category?.toLowerCase().includes('sospechosa') ||
            account.category?.toLowerCase().includes('prefijo') ||
            account.category?.toLowerCase().includes('naturaleza');

        setViewMode(isDirectEdit ? 'edit' : 'actions');
    }, [account, accounts]);

    if (!open || !account) return null;

    const accountId = account.accountId || account.id;

    const handleAction = async (action, value) => {
        setLoading(true);
        const toastId = toast.loading('Aplicando regularización...');
        try {
            const headers = user?.company_id ? { 'x-company-id': String(user.company_id) } : {};
            const res = await axios.post(
                '/api/accounting/audit/quick-fix',
                { accountId, action, value },
                { headers }
            );

            if (res.data?.success) {
                toast.success(res.data.message || 'Corrección aplicada con éxito', { id: toastId });
                if (onFixed) onFixed();
                onClose();
            } else {
                toast.error(res.data?.message || 'No se pudo aplicar la corrección', { id: toastId });
            }
        } catch (err) {
            console.error('Error applying quick fix:', err);
            const msg = err.response?.data?.message || err.message || 'Error al aplicar la corrección';
            toast.error(msg, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEdit = (e) => {
        e?.preventDefault();
        if (!formData.code.trim()) {
            toast.error('El código contable es obligatorio');
            return;
        }
        if (!formData.name.trim()) {
            toast.error('El nombre de la cuenta es obligatorio');
            return;
        }
        handleAction('update_account', {
            ...formData,
            parent_id: formData.parent_id ? Number(formData.parent_id) : null
        });
    };

    const handleDelete = () => {
        if (!window.confirm(`¿Confirmas eliminar permanentemente la cuenta "${account.code} - ${account.name}" del catálogo?`)) {
            return;
        }
        handleAction('delete_account');
    };

    const isTerminalBlocked = account.fixType === 'enable_entries' || 
        account.category?.toLowerCase().includes('terminal') || 
        account.category?.toLowerCase().includes('detalle') ||
        account.recommendation?.toLowerCase().includes('permite asientos');

    const isMayorWithEntries = account.fixType === 'disable_entries' || 
        account.category?.toLowerCase().includes('mayor') || 
        account.description?.toLowerCase().includes('subcuentas');

    const isOrphanParent = account.fixType === 'set_parent' || 
        account.category?.toLowerCase().includes('jerarquía') || 
        account.category?.toLowerCase().includes('padre');

    const parentCandidates = (Array.isArray(accounts) ? accounts : []).filter(
        a => String(a.id) !== String(accountId)
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
                {/* Modal Header */}
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                            <Wrench className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-white">
                                Regularización de Cuenta Contable
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                {account.code} - {account.name}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
                    {/* Finding Info Banner */}
                    <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="space-y-1">
                            <span className="font-bold block text-[11px] uppercase tracking-wider">
                                {account.category}
                            </span>
                            <p className="text-xs text-amber-900 dark:text-amber-200">{account.description}</p>
                            <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">
                                Recomendación: {account.recommendation}
                            </p>
                        </div>
                    </div>

                    {/* Mode Navigation Pills */}
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setViewMode('actions')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                viewMode === 'actions'
                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                            }`}
                        >
                            <Sliders className="w-3.5 h-3.5" /> Acciones Rápidas
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('edit')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                viewMode === 'edit'
                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                            }`}
                        >
                            <Edit3 className="w-3.5 h-3.5" /> Editar Cuenta Directamente
                        </button>
                    </div>

                    {/* View 1: Quick Actions */}
                    {viewMode === 'actions' && (
                        <div className="space-y-2 pt-1">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                Acciones Directas Sugeridas:
                            </span>

                            {isTerminalBlocked && (
                                <button
                                    onClick={() => handleAction('toggle_allows_entries', 1)}
                                    disabled={loading}
                                    className="w-full flex items-center justify-between p-3 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/40 dark:bg-indigo-950/20 hover:border-indigo-500 hover:bg-indigo-50 text-left transition-all font-medium text-slate-700 dark:text-slate-200 group"
                                >
                                    <div>
                                        <span className="font-bold block text-indigo-900 dark:text-indigo-200">Habilitar Asientos Directos</span>
                                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">Permite registrar transacciones y partidas operativas en esta cuenta</span>
                                    </div>
                                    <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 ml-2 group-hover:scale-110 transition-transform" />
                                </button>
                            )}

                            {isMayorWithEntries && (
                                <button
                                    onClick={() => handleAction('toggle_allows_entries', 0)}
                                    disabled={loading}
                                    className="w-full flex items-center justify-between p-3 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/40 dark:bg-indigo-950/20 hover:border-indigo-500 hover:bg-indigo-50 text-left transition-all font-medium text-slate-700 dark:text-slate-200 group"
                                >
                                    <div>
                                        <span className="font-bold block text-indigo-900 dark:text-indigo-200">Bloquear Asientos Directos (Mayor)</span>
                                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">Convertir en cuenta de acumulación para sus subcuentas</span>
                                    </div>
                                    <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 ml-2 group-hover:scale-110 transition-transform" />
                                </button>
                            )}

                            {isOrphanParent && (
                                <button
                                    onClick={() => handleAction('set_parent', null)}
                                    disabled={loading}
                                    className="w-full flex items-center justify-between p-3 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50/30 dark:bg-rose-950/20 hover:border-rose-400 hover:bg-rose-50 text-left transition-all font-medium text-slate-700 dark:text-slate-200 group"
                                >
                                    <div>
                                        <span className="font-bold block text-rose-800 dark:text-rose-300">Remover Cuenta Padre Inexistente</span>
                                        <span className="text-slate-500 text-[11px]">Desvincular el ID inexistente para sanear la jerarquía del catálogo</span>
                                    </div>
                                    <Unlink className="w-4 h-4 text-rose-600 shrink-0 ml-2" />
                                </button>
                            )}

                            <button
                                onClick={() => handleAction('toggle_active')}
                                disabled={loading}
                                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors font-medium text-slate-700 dark:text-slate-200"
                            >
                                <div>
                                    <span className="font-bold block text-slate-800 dark:text-white">Alternar Estado (Activa / Inactiva)</span>
                                    <span className="text-slate-500 text-[11px]">Estado actual: {account.active ? 'Activa' : 'Inactiva'}</span>
                                </div>
                                <Wrench className="w-4 h-4 text-slate-500 shrink-0 ml-2" />
                            </button>
                        </div>
                    )}

                    {/* View 2: Direct Edit Form */}
                    {viewMode === 'edit' && (
                        <form onSubmit={handleSaveEdit} className="space-y-3.5 pt-1">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Código Contable</label>
                                    <input
                                        type="text" required value={formData.code}
                                        onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                                        className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Nombre / Denominación</label>
                                    <input
                                        type="text" required value={formData.name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Cuenta Padre (Jerarquía)</label>
                                <select
                                    value={formData.parent_id || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, parent_id: e.target.value }))}
                                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="">-- Sin cuenta padre (Cuenta Principal / Rubro) --</option>
                                    {parentCandidates.map((p) => (
                                        <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-wrap items-center gap-5 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox" checked={formData.allows_entries}
                                        onChange={(e) => setFormData(prev => ({ ...prev, allows_entries: e.target.checked }))}
                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600"
                                    />
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Permite Asientos Directos</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox" checked={formData.active}
                                        onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600"
                                    />
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Cuenta Activa</span>
                                </label>
                            </div>

                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <button
                                    type="button" onClick={handleDelete} disabled={loading}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Eliminar Cuenta
                                </button>
                                <button
                                    type="submit" disabled={loading}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-colors"
                                >
                                    <Save className="w-3.5 h-3.5" /> Guardar Cambios
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-800/40 shrink-0">
                    <button
                        onClick={onClose} disabled={loading}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

