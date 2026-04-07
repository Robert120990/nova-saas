import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { 
    User, Building2, ShieldCheck, GitBranch, Save, 
    Search, Users as UsersIcon, Plus, Edit, Trash2, X 
} from 'lucide-react';
import { toast } from 'sonner';

const UserAccess = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [selectedBranches, setSelectedBranches] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // 1. Fetch access summary
    const { data: accessSummary = [], isLoading: loadingSummary } = useQuery({
        queryKey: ['access-summary'],
        queryFn: async () => (await axios.get('/api/users/access-summary')).data
    });

    // 2. Fetch all users
    const { data: users = [] } = useQuery({
        queryKey: ['all-users'],
        queryFn: async () => (await axios.get('/api/all-users')).data
    });

    // 3. Fetch all companies
    const { data: companies = [] } = useQuery({
        queryKey: ['companies'],
        queryFn: async () => (await axios.get('/api/companies')).data
    });

    // 4. Fetch all roles
    const { data: roles = [] } = useQuery({
        queryKey: ['roles'],
        queryFn: async () => (await axios.get('/api/roles')).data
    });

    // 5. Fetch branches for the selected company in modal
    const { data: branches = [], isLoading: loadingBranches } = useQuery({
        queryKey: ['branches', selectedCompanyId],
        queryFn: async () => (await axios.get(`/api/branches?company_id=${selectedCompanyId}`)).data,
        enabled: !!selectedCompanyId && isModalOpen
    });

    const assignMutation = useMutation({
        mutationFn: (data) => axios.post('/api/users/assign-access', data),
        onSuccess: () => {
            toast.success('Accesos actualizados exitosamente');
            queryClient.invalidateQueries(['access-summary']);
            closeModal();
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al asignar accesos');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: ({ userId, companyId }) => axios.delete(`/api/users/access/${userId}/${companyId}`),
        onSuccess: () => {
            toast.success('Acceso eliminado correctamente');
            queryClient.invalidateQueries(['access-summary']);
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al eliminar acceso');
        }
    });

    const handleSave = () => {
        if (!selectedUserId || !selectedCompanyId || !selectedRoleId) {
            return toast.error('Por favor complete todos los campos obligatorios');
        }
        assignMutation.mutate({
            userId: selectedUserId,
            companyId: selectedCompanyId,
            roleId: selectedRoleId,
            branches: selectedBranches
        });
    };

    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    const handleDelete = (userId, companyId) => {
        const id = `${userId}-${companyId}`;
        if (confirmDeleteId === id) {
            deleteMutation.mutate({ userId, companyId });
            setConfirmDeleteId(null);
        } else {
            setConfirmDeleteId(id);
            // Auto reset after 3 seconds
            setTimeout(() => setConfirmDeleteId(null), 3000);
        }
    };

    const openEditModal = (access) => {
        setSelectedUserId(access.user_id);
        setSelectedCompanyId(access.company_id);
        setSelectedRoleId(access.role_id);
        setSelectedBranches(access.branches.map(b => b.id));
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedUserId('');
        setSelectedCompanyId('');
        setSelectedRoleId('');
        setSelectedBranches([]);
    };

    const toggleBranch = (id) => {
        setSelectedBranches(prev => 
            prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
        );
    };

    const filteredAccess = accessSummary.filter(acc => 
        acc.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.company_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const cardCls = "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md";
    const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2";
    const selectCls = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm font-medium appearance-none cursor-pointer";

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Gestión de Accesos</h2>
                    <p className="text-slate-500 mt-1 font-medium">Control centralizado de permisos multi-empresa y multi-sucursal</p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={20}/>
                    <span>Asignar Acceso</span>
                </button>
            </div>

            {/* Listado Principal */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 w-full max-w-md shadow-sm">
                        <Search size={18} className="text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Buscar por usuario o empresa..." 
                            className="bg-transparent outline-none w-full text-sm font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-100">
                                <th className="px-6 py-4">Usuario</th>
                                <th className="px-6 py-4">Empresa</th>
                                <th className="px-6 py-4">Rol</th>
                                <th className="px-6 py-4">Sucursales</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loadingSummary ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-20 text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                                    </td>
                                </tr>
                            ) : filteredAccess.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-20 text-center text-slate-400 font-medium italic">
                                        No se encontraron registros de acceso
                                    </td>
                                </tr>
                            ) : filteredAccess.map(acc => (
                                <tr key={`${acc.user_id}-${acc.company_id}`} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-xs shadow-sm">
                                                {acc.user_name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-900">{acc.user_name}</div>
                                                <div className="text-xs text-slate-500 font-medium italic">@{acc.username}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                            <Building2 size={16} className="text-slate-400" />
                                            {acc.company_name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-wider border border-indigo-100">
                                            {acc.role_name}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1 max-w-[250px]">
                                            {acc.branches.length > 0 ? (
                                                acc.branches.map(b => (
                                                    <span key={b.id} className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
                                                        {b.nombre}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-[9px] text-slate-400 italic">Sin sucursales</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => openEditModal(acc)}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                title="Editar Acceso"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(acc.user_id, acc.company_id)}
                                                className={`p-2 rounded-lg transition-all ${
                                                    confirmDeleteId === `${acc.user_id}-${acc.company_id}`
                                                    ? 'text-white bg-red-600 shadow-lg shadow-red-600/20'
                                                    : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                                                }`}
                                                title={confirmDeleteId === `${acc.user_id}-${acc.company_id}` ? "Confirmar eliminación" : "Eliminar Acceso"}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Asignación */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeModal} />
                    <div className="relative bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-900">Configurar Acceso</h3>
                                <p className="text-xs text-slate-500 font-medium">Asigne usuario, empresa y sucursales permitidas</p>
                            </div>
                            <button onClick={closeModal} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 max-h-[70vh] overflow-y-auto space-y-8 scroll-modern">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Usuario */}
                                <div>
                                    <label className={labelCls}>
                                        <UsersIcon size={14} className="text-indigo-600" /> 1. Usuario
                                    </label>
                                    <select 
                                        value={selectedUserId} 
                                        onChange={(e) => setSelectedUserId(e.target.value)}
                                        className={selectCls}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>{u.nombre}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Empresa */}
                                <div>
                                    <label className={labelCls}>
                                        <Building2 size={14} className="text-indigo-600" /> 2. Empresa
                                    </label>
                                    <select 
                                        value={selectedCompanyId} 
                                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                                        className={selectCls}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {companies.map(c => (
                                            <option key={c.id} value={c.id}>{c.razon_social}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Rol */}
                                <div>
                                    <label className={labelCls}>
                                        <ShieldCheck size={14} className="text-indigo-600" /> 3. Rol
                                    </label>
                                    <select 
                                        value={selectedRoleId} 
                                        onChange={(e) => setSelectedRoleId(e.target.value)}
                                        className={selectCls}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {roles.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Sucursales */}
                            <div className="space-y-4">
                                <label className={labelCls}>
                                    <GitBranch size={14} className="text-indigo-600" /> 4. Sucursales Autorizadas
                                </label>
                                {!selectedCompanyId ? (
                                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
                                        <p className="text-sm font-bold text-slate-400">Debe seleccionar una empresa primero</p>
                                    </div>
                                ) : loadingBranches ? (
                                    <div className="flex justify-center p-10">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                    </div>
                                ) : branches.length === 0 ? (
                                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
                                        <p className="text-sm font-medium text-slate-400">Esta empresa no posee sucursales</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {branches.map(b => (
                                            <button
                                                key={b.id}
                                                onClick={() => toggleBranch(b.id)}
                                                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                                                    selectedBranches.includes(b.id)
                                                    ? 'bg-indigo-50 border-indigo-400 text-indigo-700 ring-1 ring-indigo-400'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                                                }`}
                                            >
                                                <div className="text-left">
                                                    <div className="text-xs font-black">{b.nombre}</div>
                                                    <div className="text-[9px] opacity-60 font-medium truncate max-w-[120px] uppercase">{b.direccion}</div>
                                                </div>
                                                <div className={`p-1 rounded-full transition-all ${
                                                    selectedBranches.includes(b.id) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-300'
                                                }`}>
                                                    <ShieldCheck size={14} />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button 
                                onClick={closeModal}
                                className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-all"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={assignMutation.isPending}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
                            >
                                <Save size={18}/>
                                <span>{assignMutation.isPending ? 'Guardando...' : 'Aplicar Cambios'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserAccess;
