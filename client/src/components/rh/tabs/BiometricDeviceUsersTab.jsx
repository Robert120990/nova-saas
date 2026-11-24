import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, Link2, CheckCircle2, AlertTriangle, RefreshCw, Fingerprint } from 'lucide-react';
import { formatDateTime } from '../../../utils/dateUtils';

const BiometricDeviceUsersTab = () => {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [onlyActiveOrUnlinked, setOnlyActiveOrUnlinked] = useState(false);

    const { data, isLoading, isFetching, refetch } = useQuery({
        queryKey: ['rh-biometric-clock-users'],
        queryFn: async () => (await axios.get('/api/rh/biometric/clock-users')).data || {}
    });

    const linkMutation = useMutation({
        mutationFn: async (payload) => (await axios.post('/api/rh/biometric/clock-users/link', payload)).data,
        onSuccess: (res) => {
            toast.success(res?.message || 'Usuario biométrico vinculado.');
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-clock-users'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-attendance'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-cortes-summary'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-cortes-daily-overtime'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-daily-radar'] });
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al vincular usuario')
    });

    const clockUsers = Array.isArray(data?.clockUsers) ? data.clockUsers : [];
    const employees = Array.isArray(data?.employees) ? data.employees : [];
    const summary = data?.summary || {
        total_clock_users: 0,
        linked_count: 0,
        unlinked_active_punches: 0,
        employees_without_bio: 0
    };

    const filtered = clockUsers.filter(u => {
        if (onlyActiveOrUnlinked && u.empleado_id && u.punches_90d === 0) return false;
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return String(u.device_uid).includes(q)
            || (u.clock_name || '').toLowerCase().includes(q)
            || (u.empleado_nombre || '').toLowerCase().includes(q);
    });

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">En Reloj ZKTeco</span>
                    <span className="text-lg font-black text-slate-800">{summary.total_clock_users}</span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase block">Vinculados</span>
                    <span className="text-lg font-black text-emerald-700">{summary.linked_count}</span>
                </div>
                <div className={`p-3 rounded-xl border ${summary.unlinked_active_punches > 0 ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] font-bold text-amber-700 uppercase block">Marcando Sin Vincular</span>
                    <span className="text-lg font-black text-amber-800">{summary.unlinked_active_punches}</span>
                </div>
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase block">Activos Sin Huella/ID</span>
                    <span className="text-lg font-black text-indigo-700">{summary.employees_without_bio}</span>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder="Buscar por ID del reloj, nombre en reloj o empleado..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full text-xs font-medium border border-slate-200 rounded-xl pl-8 pr-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={onlyActiveOrUnlinked}
                            onChange={(e) => setOnlyActiveOrUnlinked(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600"
                        />
                        Solo activos / sin vincular
                    </label>
                    <button
                        type="button"
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="p-2 text-slate-500 hover:text-indigo-700 bg-slate-50 border border-slate-200 rounded-xl"
                        title="Recargar catálogo"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                            <th className="py-2.5 px-3">ID Reloj</th>
                            <th className="py-2.5 px-3">Nombre en Reloj</th>
                            <th className="py-2.5 px-3 text-center">Marcas (90d)</th>
                            <th className="py-2.5 px-3">Última Marca</th>
                            <th className="py-2.5 px-3">Empleado Vinculado en NovaSaaS</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoading ? (
                            <tr>
                                <td colSpan="5" className="py-8 text-center text-slate-400">Cargando catálogo del reloj ZKTeco...</td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="py-8 text-center text-slate-400">
                                    <Fingerprint className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                                    Sin usuarios reportados aún por el reloj.
                                </td>
                            </tr>
                        ) : filtered.map((u) => {
                            const isUnlinkedActive = !u.empleado_id && u.punches_90d > 0;
                            return (
                                <tr key={u.device_uid} className={isUnlinkedActive ? 'bg-amber-50/40' : 'hover:bg-slate-50'}>
                                    <td className="py-2 px-3 font-mono font-black text-indigo-700">#{u.device_uid}</td>
                                    <td className="py-2 px-3 font-semibold text-slate-800">
                                        {u.clock_name || <span className="text-slate-400 italic">Sin nombre</span>}
                                        {u.role === 14 && (
                                            <span className="ml-1.5 text-[9px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">ADMIN</span>
                                        )}
                                    </td>
                                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-700">{u.punches_90d}</td>
                                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                        {u.last_punch ? formatDateTime(u.last_punch) : '—'}
                                    </td>
                                    <td className="py-2 px-3">
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={u.empleado_id || ''}
                                                disabled={linkMutation.isPending}
                                                onChange={(e) => {
                                                    const empId = e.target.value ? Number(e.target.value) : null;
                                                    if (empId) {
                                                        linkMutation.mutate({
                                                            empleado_id: empId,
                                                            codigo_biometrico: u.device_uid,
                                                            reattribute_logs: true
                                                        });
                                                    } else if (u.empleado_id) {
                                                        linkMutation.mutate({
                                                            empleado_id: u.empleado_id,
                                                            codigo_biometrico: '',
                                                            reattribute_logs: false
                                                        });
                                                    }
                                                }}
                                                className={`w-full text-xs rounded-lg border px-2 py-1.5 font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                                                    u.empleado_id
                                                        ? 'border-emerald-300 bg-emerald-50/30 text-slate-800'
                                                        : isUnlinkedActive
                                                            ? 'border-amber-400 bg-amber-50 text-amber-900'
                                                            : 'border-slate-200 bg-white text-slate-600'
                                                }`}
                                            >
                                                <option value="">-- Sin vincular --</option>
                                                {employees.map((e) => (
                                                    <option key={e.id} value={e.id}>
                                                        {e.nombre_completo} [{e.codigo}]{!e.es_activo ? ' (Inactivo)' : ''}{e.codigo_biometrico && String(e.codigo_biometrico) !== String(u.device_uid) ? ` · Bio #${e.codigo_biometrico}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            {u.empleado_id ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" title="Vinculado" />
                                            ) : isUnlinkedActive ? (
                                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" title="Marcando sin empleado vinculado" />
                                            ) : (
                                                <Link2 className="w-4 h-4 text-slate-300 shrink-0" />
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BiometricDeviceUsersTab;
