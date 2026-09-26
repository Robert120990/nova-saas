import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { 
    Building2, ShieldCheck, Search, Plus, Edit, Trash2, X,
    Copy, CheckSquare, Square, Filter, RotateCcw, Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';
import {
    UserAccessAssignModal,
    UserAccessCloneModal,
    UserAccessBulkRoleModal,
} from '../components/users';

const UserAccess = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();

    // Modales
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [editingAccess, setEditingAccess] = useState(null);
    const [assignModalDefaultTab, setAssignModalDefaultTab] = useState('masivo');
    const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
    const [isBulkRoleModalOpen, setIsBulkRoleModalOpen] = useState(false);

    // Filtros y Selección en la Tabla Principal
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCompany, setFilterCompany] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [selectedRowKeys, setSelectedRowKeys] = useState([]); // ['userId-companyId']
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    // 1. Fetch access summary
    const { data: accessSummary = [], isLoading: loadingSummary } = useQuery({
        queryKey: ['access-summary'],
        queryFn: async () => (await axios.get('/api/users/access-summary')).data
    });

    // 2. Fetch all users (global identities per AGENTS.md multi-tenant architecture)
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

    // 5. Fetch companies with branches tree
    const { data: companiesTree = [], isLoading: loadingTree } = useQuery({
        queryKey: ['companies-branches-tree'],
        queryFn: async () => (await axios.get('/api/users/companies-branches-tree')).data
    });

    // Mutaciones de Eliminación
    const bulkDeleteMutation = useMutation({
        mutationFn: (items) => axios.post('/api/users/bulk-delete-access', { items }),
        onSuccess: (res) => {
            toast.success(res.data?.message || 'Accesos eliminados correctamente');
            queryClient.invalidateQueries({ queryKey: ['access-summary'] });
            setSelectedRowKeys([]);
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al eliminar accesos');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: ({ userId, companyId }) => axios.delete(`/api/users/access/${userId}/${companyId}`),
        onSuccess: () => {
            toast.success('Acceso eliminado correctamente');
            queryClient.invalidateQueries({ queryKey: ['access-summary'] });
            setSelectedRowKeys(prev => prev.filter(k => !k.startsWith(`${deleteMutation.variables?.userId}-${deleteMutation.variables?.companyId}`)));
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al eliminar acceso');
        }
    });

    // Handlers para abrir modales
    const openAddModal = (defaultTab = 'masivo') => {
        setEditingAccess(null);
        setAssignModalDefaultTab(defaultTab);
        setIsAssignModalOpen(true);
    };

    const openEditModal = (access) => {
        setEditingAccess(access);
        setAssignModalDefaultTab('individual');
        setIsAssignModalOpen(true);
    };

    // Filtros de la Tabla
    const filteredAccess = useMemo(() => {
        return accessSummary.filter(acc => {
            const matchesSearch = 
                acc.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                acc.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                acc.company_name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCompany = !filterCompany || String(acc.company_id) === String(filterCompany);
            const matchesRole = !filterRole || String(acc.role_id) === String(filterRole);
            return matchesSearch && matchesCompany && matchesRole;
        });
    }, [accessSummary, searchTerm, filterCompany, filterRole]);

    const isAllFilteredSelected = filteredAccess.length > 0 && filteredAccess.every(acc => 
        selectedRowKeys.includes(`${acc.user_id}-${acc.company_id}`)
    );

    const toggleSelectAllFilteredRows = () => {
        if (isAllFilteredSelected) {
            const filteredKeys = new Set(filteredAccess.map(acc => `${acc.user_id}-${acc.company_id}`));
            setSelectedRowKeys(prev => prev.filter(k => !filteredKeys.has(k)));
        } else {
            const newKeys = filteredAccess.map(acc => `${acc.user_id}-${acc.company_id}`);
            setSelectedRowKeys(prev => Array.from(new Set([...prev, ...newKeys])));
        }
    };

    const toggleRowSelection = (userId, companyId) => {
        const key = `${userId}-${companyId}`;
        setSelectedRowKeys(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const handleExecuteBulkDelete = async () => {
        if (selectedRowKeys.length === 0) return;
        const ok = await confirm({
            title: `¿Eliminar ${selectedRowKeys.length} acceso(s) seleccionados?`,
            message: 'Los usuarios perderán acceso a las empresas y sucursales seleccionadas. Esta acción es inmediata.',
            confirmLabel: `Sí, eliminar ${selectedRowKeys.length} accesos`,
            cancelLabel: 'Cancelar',
            variant: 'danger'
        });
        if (ok) {
            const items = selectedRowKeys.map(k => {
                const [userId, companyId] = k.split('-');
                return { userId: parseInt(userId), companyId: parseInt(companyId) };
            });
            bulkDeleteMutation.mutate(items);
        }
    };

    const handleDeleteSingle = (userId, companyId) => {
        const id = `${userId}-${companyId}`;
        if (confirmDeleteId === id) {
            deleteMutation.mutate({ userId, companyId });
            setConfirmDeleteId(null);
        } else {
            setConfirmDeleteId(id);
            setTimeout(() => setConfirmDeleteId(null), 3000);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-28">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Shield className="text-indigo-600" size={28} />
                        Gestión de Accesos
                    </h2>
                    <p className="text-slate-500 text-sm mt-1 font-medium">
                        Control centralizado de permisos multi-empresa y multi-sucursal con asignación masiva
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <button 
                        onClick={() => setIsCloneModalOpen(true)}
                        className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                        <Copy size={16} className="text-indigo-600" />
                        <span>Clonar Accesos</span>
                    </button>
                    <button 
                        onClick={() => openAddModal('masivo')}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95 cursor-pointer"
                    >
                        <Plus size={18} />
                        <span>Asignar Acceso</span>
                    </button>
                </div>
            </div>

            {/* Listado Principal con Filtros */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 w-full md:max-w-md shadow-sm">
                        <Search size={18} className="text-slate-400 shrink-0" />
                        <input 
                            type="text" 
                            placeholder="Buscar por usuario, @username o empresa..." 
                            className="bg-transparent outline-none w-full text-sm font-medium text-slate-700"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm text-xs font-medium">
                            <Filter size={14} className="text-slate-400" />
                            <select 
                                value={filterCompany} 
                                onChange={(e) => setFilterCompany(e.target.value)}
                                className="bg-transparent outline-none font-bold text-slate-700 cursor-pointer text-xs"
                            >
                                <option value="">Todas las empresas</option>
                                {companies.map(c => (
                                    <option key={c.id} value={c.id}>{c.razon_social}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm text-xs font-medium">
                            <ShieldCheck size={14} className="text-slate-400" />
                            <select 
                                value={filterRole} 
                                onChange={(e) => setFilterRole(e.target.value)}
                                className="bg-transparent outline-none font-bold text-slate-700 cursor-pointer text-xs"
                            >
                                <option value="">Todos los roles</option>
                                {roles.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        </div>

                        {(searchTerm || filterCompany || filterRole) && (
                            <button
                                onClick={() => { setSearchTerm(''); setFilterCompany(''); setFilterRole(''); }}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 px-2 py-1 flex items-center gap-1 cursor-pointer"
                            >
                                <RotateCcw size={12} /> Limpiar
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-100">
                                <th className="px-4 py-3.5 w-10 text-center">
                                    <button 
                                        type="button"
                                        onClick={toggleSelectAllFilteredRows}
                                        className="text-slate-400 hover:text-indigo-600 transition-colors p-1 cursor-pointer"
                                        title={isAllFilteredSelected ? "Deseleccionar todos" : "Seleccionar todos"}
                                    >
                                        {isAllFilteredSelected ? (
                                            <CheckSquare size={18} className="text-indigo-600" />
                                        ) : (
                                            <Square size={18} />
                                        )}
                                    </button>
                                </th>
                                <th className="px-4 py-3.5">Usuario</th>
                                <th className="px-4 py-3.5">Empresa</th>
                                <th className="px-4 py-3.5">Rol</th>
                                <th className="px-4 py-3.5">Sucursales</th>
                                <th className="px-4 py-3.5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loadingSummary ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                                        <p className="text-xs text-slate-400 font-bold mt-2">Cargando matriz de accesos...</p>
                                    </td>
                                </tr>
                            ) : filteredAccess.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center text-slate-400 font-medium italic">
                                        No se encontraron registros de acceso con los filtros aplicados
                                    </td>
                                </tr>
                            ) : filteredAccess.map(acc => {
                                const rowKey = `${acc.user_id}-${acc.company_id}`;
                                const isSelected = selectedRowKeys.includes(rowKey);
                                return (
                                    <tr 
                                        key={rowKey} 
                                        className={`transition-colors ${isSelected ? 'bg-indigo-50/60' : 'hover:bg-slate-50/50'}`}
                                    >
                                        <td className="px-4 py-3.5 text-center">
                                            <button 
                                                type="button"
                                                onClick={() => toggleRowSelection(acc.user_id, acc.company_id)}
                                                className="text-slate-400 hover:text-indigo-600 transition-colors p-1 cursor-pointer"
                                            >
                                                {isSelected ? (
                                                    <CheckSquare size={18} className="text-indigo-600" />
                                                ) : (
                                                    <Square size={18} />
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                                                    {acc.user_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-slate-900">{acc.user_name}</div>
                                                    <div className="text-[11px] text-slate-400 font-medium italic">@{acc.username}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                                <Building2 size={14} className="text-slate-400 shrink-0" />
                                                {acc.company_name}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-black uppercase tracking-wider border border-indigo-100">
                                                {acc.role_name}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex flex-wrap gap-1 max-w-[280px]">
                                                {acc.branches.length > 0 ? (
                                                    acc.branches.map(b => (
                                                        <span key={b.id} className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold border border-slate-200">
                                                            {b.nombre}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 italic">Sin sucursales</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button 
                                                    onClick={() => openEditModal(acc)}
                                                    className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                                                    title="Editar Acceso"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteSingle(acc.user_id, acc.company_id)}
                                                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                                        confirmDeleteId === rowKey
                                                        ? 'text-white bg-red-600 shadow-md shadow-red-600/20'
                                                        : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                                                    }`}
                                                    title={confirmDeleteId === rowKey ? "Confirmar eliminación" : "Eliminar Acceso"}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Barra Flotante de Acciones Masivas */}
            {selectedRowKeys.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-white px-6 py-3.5 rounded-2xl shadow-2xl backdrop-blur-md border border-slate-700 flex flex-wrap items-center gap-4 animate-in fade-in slide-in-from-bottom-5 duration-200 max-w-[95vw]">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-500 text-white font-bold text-xs flex items-center justify-center">
                            {selectedRowKeys.length}
                        </span>
                        <span className="text-xs font-bold text-slate-200">accesos seleccionados</span>
                    </div>

                    <div className="h-4 w-px bg-slate-700 hidden sm:block" />

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsBulkRoleModalOpen(true)}
                            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer"
                        >
                            <ShieldCheck size={14} />
                            Cambiar Rol
                        </button>
                        <button
                            onClick={handleExecuteBulkDelete}
                            disabled={bulkDeleteMutation.isPending}
                            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                            <Trash2 size={14} />
                            Eliminar
                        </button>
                        <button
                            onClick={() => setSelectedRowKeys([])}
                            className="text-slate-400 hover:text-white px-2 py-1.5 font-bold text-xs transition-colors cursor-pointer"
                        >
                            Deseleccionar
                        </button>
                    </div>
                </div>
            )}

            {/* Modal de Asignación (Individual vs Masivo) */}
            <UserAccessAssignModal
                open={isAssignModalOpen}
                editingAccess={editingAccess}
                defaultTab={assignModalDefaultTab}
                users={users}
                companies={companies}
                roles={roles}
                companiesTree={companiesTree}
                loadingTree={loadingTree}
                onClose={() => {
                    setIsAssignModalOpen(false);
                    setEditingAccess(null);
                }}
            />

            {/* Modal de Clonar Accesos */}
            <UserAccessCloneModal
                open={isCloneModalOpen}
                users={users}
                onClose={() => setIsCloneModalOpen(false)}
            />

            {/* Mini Modal para Cambio de Rol Masivo */}
            <UserAccessBulkRoleModal
                open={isBulkRoleModalOpen}
                selectedRowKeys={selectedRowKeys}
                roles={roles}
                onClose={() => setIsBulkRoleModalOpen(false)}
                onSuccess={() => setSelectedRowKeys([])}
            />
        </div>
    );
};

export default UserAccess;
