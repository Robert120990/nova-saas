import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useConfirm } from '../context/ConfirmContext';
import { Users, LogOut, Circle } from 'lucide-react';
import { toast } from 'sonner';
import Table from '../components/ui/Table';
import { formatDateTime } from '../utils/dateUtils';

const ConnectedUsers = () => {
    const confirm = useConfirm();
    const queryClient = useQueryClient();
    const [now, setNow] = useState(Date.now());
    const timerRef = useRef(null);

    useEffect(() => {
        timerRef.current = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timerRef.current);
    }, []);

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['users-connected'],
        queryFn: async () => (await axios.get('/api/users/connected')).data,
        refetchInterval: 10000,
    });

    console.log('[ConnectedUsers]', { data, isLoading, isError, error: error?.message });

    const terminateMutation = useMutation({
        mutationFn: async (sessionId) => {
            await axios.post(`/api/users/sessions/${sessionId}/terminate`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users-connected'] });
            toast.success('Sesión finalizada');
        },
        onError: () => {
            toast.error('Error al finalizar la sesión');
        },
    });

    const handleTerminate = async (session) => {
        const ok = await confirm({
            title: '¿Finalizar sesión?',
            message: `Se cerrará la sesión de ${session.nombre || session.username}`,
            confirmLabel: 'Sí, finalizar',
            cancelLabel: 'Cancelar',
            variant: 'danger',
        });
        if (ok) {
            terminateMutation.mutate(session.id);
        }
    };

    const getElapsedText = (seconds) => {
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        if (mins < 60) return `${mins}m ${seconds % 60}s`;
        const hrs = Math.floor(mins / 60);
        return `${hrs}h ${mins % 60}m`;
    };

    const calcElapsed = (loggedInAt) => {
        if (!loggedInAt) return 0;
        return Math.floor((now - new Date(loggedInAt).getTime()) / 1000);
    };

    const sessions = data?.sessions || [];

    const enrichedSessions = useMemo(() => {
        return sessions.map((session) => {
            const elapsed = calcElapsed(session.logged_in_at);
            return {
                ...session,
                elapsed,
                estado_indicador: elapsed < 30 ? 1 : 0
            };
        });
    }, [sessions, now]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <Users size={24} className="text-indigo-600" />
                        Usuarios Conectados
                    </h2>
                    <p className="text-slate-500 font-medium">
                        {sessions.length} sesión(es) activa(s) en los últimos 2 minutos
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <Table
                    headers={[
                        { label: 'Estado', className: 'text-left px-6 py-4', sortKey: 'estado_indicador' },
                        { label: 'Usuario', className: 'text-left px-6 py-4' },
                        { label: 'Nombre', className: 'text-left px-6 py-4' },
                        { label: 'Sucursal', className: 'text-left px-6 py-4' },
                        { label: 'IP', className: 'text-left px-6 py-4' },
                        { label: 'Conectado desde', className: 'text-left px-6 py-4' },
                        { label: 'Tiempo', className: 'text-left px-6 py-4', sortKey: 'elapsed', sortType: 'number' },
                        { label: 'Acción', className: 'text-left px-6 py-4', sortable: false }
                    ]}
                    data={enrichedSessions}
                    isLoading={isLoading}
                    emptyMessage={isError ? `Error al cargar: ${error?.message || 'Error desconocido'}` : 'No hay usuarios conectados'}
                    renderRow={(session) => {
                        const elapsed = session.elapsed;
                        return (
                            <tr key={session.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <Circle
                                        size={10}
                                        className={elapsed < 30 ? 'text-emerald-500 fill-emerald-500' : 'text-amber-400 fill-amber-400'}
                                    />
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-[13px] font-medium text-slate-900">{session.username}</span>
                                    {session.is_own_session && (
                                        <span className="ml-2 text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">Tú</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-[13px] font-medium text-slate-700">{session.nombre || '-'}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-[13px] font-medium text-slate-700">{session.branch_name || '-'}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-[13px] font-mono text-slate-500">{session.ip_address || '-'}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-[13px] font-medium text-slate-700">{formatDateTime(session.logged_in_at)}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-[13px] font-medium text-slate-500">{getElapsedText(elapsed)}</span>
                                </td>
                                <td className="px-6 py-4">
                                    {!session.is_own_session && (
                                        <button
                                            type="button"
                                            onClick={() => handleTerminate(session)}
                                            disabled={terminateMutation.isPending}
                                            className="flex items-center gap-1.5 text-[12px] font-bold text-rose-500 hover:text-rose-700 disabled:opacity-50 transition-colors cursor-pointer"
                                        >
                                            <LogOut size={14} />
                                            Cerrar
                                        </button>
                                    )}
                                </td>
                            </tr>
                        );
                    }}
                />
            </div>
        </div>
    );
};

export default ConnectedUsers;
