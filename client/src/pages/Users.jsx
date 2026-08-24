import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import { IMaskInput } from 'react-imask';
import { Plus, Shield, Edit, User, Trash2, Search, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import Pagination from '../components/ui/Pagination';

const Users = () => {
    const queryClient = useQueryClient();
    const { user: currentUser } = useAuth();
    const confirm = useConfirm();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUnlockOpen, setIsUnlockOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(15);
    
    // Simple debounce logic
    const [debouncedSearch, setDebouncedSearch] = useState('');
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1); // Reset to page 1 on search
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: response = { users: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['users', debouncedSearch, page, limit],
        queryFn: async () => {
            const { data } = await axios.get('/api/users', { 
                params: { search: debouncedSearch, page, limit } 
            });
            return data;
        }
    });

    const users = response.users || [];

    // Eliminamos la consulta de roles y sucursales ya que se manejan en Gestión de Accesos

    const mutation = useMutation({
        mutationFn: (data) => {
            if (selectedUser) return axios.put(`/api/users/${selectedUser.id}`, data);
            return axios.post('/api/users', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['users']);
            setIsModalOpen(false);
            setSelectedUser(null);
            toast.success(selectedUser ? 'Usuario actualizado' : 'Usuario creado');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al guardar usuario');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/users/${id}`),
        onSuccess: () => {
            toast.success('Usuario eliminado del sistema');
            queryClient.invalidateQueries(['users']);
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al eliminar usuario');
        }
    });

    const handleDelete = async (id, nombre) => {
        const ok = await confirm({
            title: '¿Eliminar usuario?',
            message: `El usuario "${nombre}" perderá acceso al sistema permanentemente. Esta acción no se puede deshacer.`,
            confirmLabel: 'Sí, eliminar',
            variant: 'danger',
        });
        if (ok) deleteMutation.mutate(id);
    };

    const toggleStatusMutation = useMutation({
        mutationFn: ({ id, status }) => axios.put(`/api/users/${id}`, { status: status === 'activo' ? 'inactivo' : 'activo' }),
        onSuccess: () => {
            queryClient.invalidateQueries(['users']);
            toast.success('Estado actualizado');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al cambiar estado');
        }
    });


    const unlockMutation = useMutation({
        mutationFn: (data) => axios.post('/api/auth/rate-limit/unlock', data),
        onSuccess: (res) => {
            toast.success(res.data?.message || 'Desbloqueo aplicado');
            setIsUnlockOpen(false);
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al desbloquear');
        }
    });

    const handleUnlock = (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        if (!data.username && !data.ip) {
            toast.error('Indique un usuario y/o una IP a desbloquear');
            return;
        }
        unlockMutation.mutate(data);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        if (data.telefono) {
            const placeholderLimpio = data.telefono.replace(/[_-]/g, '').trim();
            if (placeholderLimpio === '') {
                delete data.telefono;
            } else if (!/^\d{4}-\d{4}$/.test(data.telefono)) {
                toast.error('El teléfono debe tener el formato 0000-0000');
                return;
            }
        }

        mutation.mutate(data);
    };

    const handleEdit = (u) => {
        setSelectedUser(u);
        setIsModalOpen(true);
    };

    // toggleBranch eliminada

    const fieldCls = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm font-medium";
    const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5";

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Gestión de Usuarios</h2>
                    <p className="text-slate-500 mt-1 font-medium italic">Empresa: {currentUser.company_name}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    {currentUser?.role_name === 'SuperAdmin' && (
                        <button
                            onClick={() => setIsUnlockOpen(true)}
                            className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:border-amber-400 hover:text-amber-600 text-slate-600 px-4 py-2 rounded-xl font-bold transition-all text-sm active:scale-95"
                            title="Desbloquear logins bloqueados por intentos fallidos"
                        >
                            <Unlock size={16}/>
                            <span>Desbloquear acceso</span>
                        </button>
                    )}
                    <button
                        onClick={() => { setSelectedUser(null); setIsModalOpen(true); }}
                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                    >
                        <Plus size={20}/>
                        <span>Nuevo Integrante</span>
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre, usuario o correo..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-medium shadow-sm"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table 
                    headers={['Usuario', 'Correo', 'Rol en Empresa', 'Estado', 'Acciones']}
                    data={users}
                    isLoading={isLoading}
                    renderRow={(u) => (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-5 py-2.5">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                        <User size={16} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-slate-900">{u.nombre}</div>
                                        <div className="text-[11px] text-slate-500">@{u.username}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-5 py-2.5">
                                <div className="text-sm text-slate-600 font-medium">{u.email}</div>
                            </td>
                            <td className="px-5 py-2.5">
                                {u.role_name ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider border border-indigo-100">
                                        <Shield size={12} /> {u.role_name}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                                        Sin Acceso
                                    </span>
                                )}
                            </td>
                            <td className="px-5 py-2.5">
                                <button 
                                    onClick={() => toggleStatusMutation.mutate({ id: u.id, status: u.status })}
                                    disabled={toggleStatusMutation.isPending}
                                    className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase transition-all hover:scale-105 active:scale-95 disabled:opacity-50 ${
                                        u.status === 'activo' 
                                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                                    }`}
                                    title="Click para cambiar estado"
                                >
                                    {u.status}
                                </button>
                            </td>
                            <td className="px-5 py-2.5">
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => handleEdit(u)} 
                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                        title="Editar"
                                    >
                                        <Edit size={16}/>
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(u.id, u.nombre)} 
                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    )}
                    renderCard={(u) => (
                        <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                        <User size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-bold text-slate-900 truncate">{u.nombre}</h4>
                                        <p className="text-[11px] text-slate-500">@{u.username}</p>
                                    </div>
                                </div>
                                {u.role_name ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-[9px] font-bold uppercase tracking-wider border border-indigo-100 shrink-0">
                                        <Shield size={10} /> {u.role_name}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-wider border border-slate-200 shrink-0">
                                        Sin Acceso
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-1.5 text-xs pt-1 border-t border-slate-100">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Correo</span>
                                    <span className="text-slate-700 break-all">{u.email}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Estado</span>
                                    <button 
                                        onClick={() => toggleStatusMutation.mutate({ id: u.id, status: u.status })}
                                        disabled={toggleStatusMutation.isPending}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase transition-all hover:scale-105 active:scale-95 disabled:opacity-50 ${
                                            u.status === 'activo' 
                                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                                        }`}
                                        title="Click para cambiar estado"
                                    >
                                        {u.status}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                <button 
                                    onClick={() => handleEdit(u)} 
                                    className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-indigo-100"
                                >
                                    <Edit size={14}/> Editar
                                </button>
                                <button 
                                    onClick={() => handleDelete(u.id, u.nombre)} 
                                    className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-red-100"
                                >
                                    <Trash2 size={14}/> Eliminar
                                </button>
                            </div>
                        </div>
                    )}
                />
            </div>

            <Pagination 
                currentPage={page}
                totalPages={response.totalPages}
                totalItems={response.total}
                onPageChange={setPage}
                itemsOnPage={users.length}
                isLoading={isLoading}
                limit={limit}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
            />

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={selectedUser ? 'Editar Miembro' : 'Nuevo Miembro del Equipo'}
                maxWidth="max-w-2xl"
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Nombre Completo</label>
                            <input name="nombre" defaultValue={selectedUser?.nombre} required placeholder="Juan Pérez" className={fieldCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Nombre de Usuario</label>
                            <input name="username" defaultValue={selectedUser?.username} required placeholder="jperez" className={fieldCls} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Correo Electrónico</label>
                            <input name="email" type="email" defaultValue={selectedUser?.email} required placeholder="juan@ejemplo.com" className={fieldCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Teléfono</label>
                            <IMaskInput
                                mask="0000-0000"
                                name="telefono"
                                defaultValue={selectedUser?.telefono || ''}
                                placeholder="2200-0000"
                                className={fieldCls}
                                lazy={false}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>{selectedUser ? 'Cambiar Contraseña (opcional)' : 'Contraseña'}</label>
                            <input name="password" type="password" required={!selectedUser} className={fieldCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Estado</label>
                            <select name="status" defaultValue={selectedUser?.status || 'activo'} className={fieldCls}>
                                <option value="activo">Activo</option>
                                <option value="inactivo">Inactivo</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>IPs Permitidas <span className="text-[10px] font-normal normal-case text-slate-400">(opcional — una por línea, vacío = cualquier IP)</span></label>
                        <textarea
                            name="allowed_ips"
                            rows={3}
                            placeholder="192.168.1.100&#10;10.0.0.5"
                            className={fieldCls + ' resize-none'}
                            defaultValue={selectedUser?.allowed_ips ? (Array.isArray(selectedUser.allowed_ips) ? selectedUser.allowed_ips : JSON.parse(selectedUser.allowed_ips)).join('\n') : ''}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm">Cancelar</button>
                        <button type="submit" disabled={mutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50">
                            {mutation.isPending ? 'Guardando...' : (selectedUser ? 'Guardar Cambios' : 'Registrar Usuario')}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={isUnlockOpen}
                onClose={() => setIsUnlockOpen(false)}
                title="Desbloquear acceso (login)"
                maxWidth="max-w-md"
            >
                <form onSubmit={handleUnlock} className="space-y-4">
                    <p className="text-xs text-slate-500 font-medium">
                        Elimina los bloqueos por intentos fallidos de inicio de sesión.
                        Indique el usuario, la IP, o ambos.
                    </p>
                    <div>
                        <label className={labelCls}>Usuario</label>
                        <input name="username" placeholder="jperez" autoComplete="off" className={fieldCls} />
                    </div>
                    <div>
                        <label className={labelCls}>IP <span className="normal-case text-[10px] font-normal text-slate-400">(deja vacío para desbloquear toda la IP)</span></label>
                        <input name="ip" placeholder="190.5.20.10" autoComplete="off" className={fieldCls} />
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onClick={() => setIsUnlockOpen(false)} className="px-6 py-2.5 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm">Cancelar</button>
                        <button type="submit" disabled={unlockMutation.isPending} className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50">
                            {unlockMutation.isPending ? 'Desbloqueando...' : 'Desbloquear'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
export default Users;
