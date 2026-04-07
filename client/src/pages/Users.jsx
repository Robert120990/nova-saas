import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import { Plus, Shield, Edit, GitBranch, User, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/ui/Pagination';

const Users = () => {
    const queryClient = useQueryClient();
    const { user: currentUser } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    
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
        queryKey: ['users', debouncedSearch, page],
        queryFn: async () => {
            const { data } = await axios.get('/api/users', { 
                params: { search: debouncedSearch, page } 
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
            setConfirmDeleteId(null);
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al eliminar usuario');
        }
    });

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

    const handleDelete = (id) => {
        if (confirmDeleteId === id) {
            deleteMutation.mutate(id);
        } else {
            setConfirmDeleteId(id);
            setTimeout(() => setConfirmDeleteId(null), 3000);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Gestión de Usuarios</h2>
                    <p className="text-slate-500 mt-1 font-medium italic">Empresa: {currentUser.company_name}</p>
                </div>
                <button 
                    onClick={() => { setSelectedUser(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={20}/>
                    <span>Nuevo Integrante</span>
                </button>
            </div>

            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre, usuario o correo..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium shadow-sm"
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
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                        <User size={20} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-slate-900">{u.nombre}</div>
                                        <div className="text-xs text-slate-500">@{u.username}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-sm text-slate-600 font-medium">{u.email}</div>
                            </td>
                            <td className="px-6 py-4">
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
                            <td className="px-6 py-4">
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
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => handleEdit(u)} 
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                        title="Editar"
                                    >
                                        <Edit size={18}/>
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(u.id)} 
                                        className={`p-2 rounded-lg transition-all ${
                                            confirmDeleteId === u.id 
                                            ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' 
                                            : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                                        }`}
                                        title={confirmDeleteId === u.id ? "Confirmar eliminación" : "Eliminar"}
                                    >
                                        <Trash2 size={18}/>
                                    </button>
                                </div>
                            </td>
                        </tr>
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
            />

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={selectedUser ? 'Editar Miembro' : 'Nuevo Miembro del Equipo'}
                maxWidth="max-w-2xl"
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
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
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm">Cancelar</button>
                        <button type="submit" disabled={mutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50">
                            {mutation.isPending ? 'Guardando...' : (selectedUser ? 'Guardar Cambios' : 'Registrar Usuario')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
export default Users;
