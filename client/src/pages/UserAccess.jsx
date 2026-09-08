import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { 
    Building2, ShieldCheck, GitBranch, Save, 
    Search, Users as UsersIcon, Plus, Edit, Trash2, X,
    Copy, CheckSquare, Square, Layers, ChevronDown, ChevronRight,
    Sparkles, Filter, Check, RotateCcw, ArrowRight, Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';

const UserAccess = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();

    // Modales principales
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalTab, setModalTab] = useState('masivo'); // 'individual' | 'masivo'
    const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
    const [isBulkRoleModalOpen, setIsBulkRoleModalOpen] = useState(false);
    const [bulkNewRoleId, setBulkNewRoleId] = useState('');

    // Estado del modo Individual (y edición)
    const [isEditing, setIsEditing] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [selectedBranches, setSelectedBranches] = useState([]);

    // Estado del modo Masivo
    const [bulkUserSelectionType, setBulkUserSelectionType] = useState('specific'); // 'specific' | 'all'
    const [bulkSelectedUserIds, setBulkSelectedUserIds] = useState([]);
    const [bulkUserSearch, setBulkUserSearch] = useState('');
    const [bulkRoleId, setBulkRoleId] = useState('');
    const [bulkAssignments, setBulkAssignments] = useState({}); // { [companyId]: { selected: boolean, branches: number[] } }
    const [expandedCompanies, setExpandedCompanies] = useState([]); // Array de companyIds expandidas

    // Estado del Clonador
    const [cloneSourceUserId, setCloneSourceUserId] = useState('');
    const [cloneTargetUserIds, setCloneTargetUserIds] = useState([]);
    const [cloneMode, setCloneMode] = useState('merge'); // 'merge' | 'replace'
    const [cloneTargetSearch, setCloneTargetSearch] = useState('');

    // Filtros y Selección en la Tabla Principal
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCompany, setFilterCompany] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [selectedRowKeys, setSelectedRowKeys] = useState([]); // ['userId-companyId']

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

    // 5. Fetch companies with branches tree
    const { data: companiesTree = [], isLoading: loadingTree } = useQuery({
        queryKey: ['companies-branches-tree'],
        queryFn: async () => (await axios.get('/api/users/companies-branches-tree')).data
    });

    // 6. Fetch branches for individual modal
    const { data: branches = [], isLoading: loadingBranches } = useQuery({
        queryKey: ['branches', selectedCompanyId],
        queryFn: async () => (await axios.get(`/api/branches?company_id=${selectedCompanyId}`)).data,
        enabled: !!selectedCompanyId && isModalOpen && modalTab === 'individual'
    });

    // Mutaciones
    const assignMutation = useMutation({
        mutationFn: (data) => axios.post('/api/users/assign-access', data),
        onSuccess: () => {
            toast.success('Acceso guardado exitosamente');
            queryClient.invalidateQueries(['access-summary']);
            closeModal();
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al asignar acceso');
        }
    });

    const bulkAssignMutation = useMutation({
        mutationFn: (data) => axios.post('/api/users/assign-access-bulk', data),
        onSuccess: (res) => {
            toast.success(res.data?.message || 'Accesos masivos asignados exitosamente');
            queryClient.invalidateQueries(['access-summary']);
            closeModal();
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al procesar asignación masiva');
        }
    });

    const cloneMutation = useMutation({
        mutationFn: (data) => axios.post('/api/users/clone-access', data),
        onSuccess: (res) => {
            toast.success(res.data?.message || 'Accesos clonados exitosamente');
            queryClient.invalidateQueries(['access-summary']);
            setIsCloneModalOpen(false);
            setCloneSourceUserId('');
            setCloneTargetUserIds([]);
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al clonar accesos');
        }
    });

    const bulkUpdateRoleMutation = useMutation({
        mutationFn: (data) => axios.post('/api/users/bulk-update-role', data),
        onSuccess: (res) => {
            toast.success(res.data?.message || 'Roles actualizados');
            queryClient.invalidateQueries(['access-summary']);
            setSelectedRowKeys([]);
            setIsBulkRoleModalOpen(false);
            setBulkNewRoleId('');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al actualizar roles');
        }
    });

    const bulkDeleteMutation = useMutation({
        mutationFn: (items) => axios.post('/api/users/bulk-delete-access', { items }),
        onSuccess: (res) => {
            toast.success(res.data?.message || 'Accesos eliminados correctamente');
            queryClient.invalidateQueries(['access-summary']);
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
            queryClient.invalidateQueries(['access-summary']);
            setSelectedRowKeys(prev => prev.filter(k => !k.startsWith(`${deleteMutation.variables?.userId}-${deleteMutation.variables?.companyId}`)));
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al eliminar acceso');
        }
    });

    // Handlers Modal Individual
    const openAddModal = (defaultTab = 'masivo') => {
        setIsEditing(false);
        setModalTab(defaultTab);
        setSelectedUserId('');
        setSelectedCompanyId('');
        setSelectedRoleId('');
        setSelectedBranches([]);

        // Limpiar estado masivo
        setBulkUserSelectionType('specific');
        setBulkSelectedUserIds([]);
        setBulkRoleId('');
        setBulkAssignments({});
        setExpandedCompanies(companiesTree.map(c => c.id));
        setIsModalOpen(true);
    };

    const openEditModal = (access) => {
        setIsEditing(true);
        setModalTab('individual');
        setSelectedUserId(access.user_id);
        setSelectedCompanyId(access.company_id);
        setSelectedRoleId(access.role_id);
        setSelectedBranches(access.branches.map(b => b.id));
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setIsEditing(false);
        setSelectedUserId('');
        setSelectedCompanyId('');
        setSelectedRoleId('');
        setSelectedBranches([]);
        setBulkSelectedUserIds([]);
        setBulkAssignments({});
    };

    const toggleBranch = (id) => {
        setSelectedBranches(prev => 
            prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
        );
    };

    const handleSaveIndividual = () => {
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

    // Handlers Modo Masivo
    const toggleBulkUser = (userId) => {
        setBulkSelectedUserIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const selectAllBulkUsers = () => {
        const filtered = users.filter(u => 
            u.nombre.toLowerCase().includes(bulkUserSearch.toLowerCase()) || 
            u.username.toLowerCase().includes(bulkUserSearch.toLowerCase())
        );
        setBulkSelectedUserIds(filtered.map(u => u.id));
    };

    const deselectAllBulkUsers = () => {
        setBulkSelectedUserIds([]);
    };

    const toggleCompanyAccordion = (companyId) => {
        setExpandedCompanies(prev =>
            prev.includes(companyId) ? prev.filter(id => id !== companyId) : [...prev, companyId]
        );
    };

    const toggleCompanySelection = (company) => {
        setBulkAssignments(prev => {
            const next = { ...prev };
            const current = next[company.id];
            const isCurrentlySelected = current?.selected;

            if (isCurrentlySelected) {
                delete next[company.id];
            } else {
                // Al marcar empresa, seleccionamos todas sus sucursales por defecto
                next[company.id] = {
                    selected: true,
                    branches: company.branches.map(b => b.id)
                };
            }
            return next;
        });
    };

    const toggleBranchSelectionInBulk = (companyId, branchId) => {
        setBulkAssignments(prev => {
            const next = { ...prev };
            const current = next[companyId] || { selected: true, branches: [] };
            const branchExists = current.branches.includes(branchId);
            const nextBranches = branchExists
                ? current.branches.filter(id => id !== branchId)
                : [...current.branches, branchId];

            next[companyId] = {
                selected: true,
                branches: nextBranches
            };
            return next;
        });
    };

    const toggleAllBranchesForCompany = (company) => {
        setBulkAssignments(prev => {
            const next = { ...prev };
            const current = next[company.id];
            const allBranchIds = company.branches.map(b => b.id);
            const hasAll = current && current.branches.length === allBranchIds.length;

            next[company.id] = {
                selected: true,
                branches: hasAll ? [] : allBranchIds
            };
            return next;
        });
    };

    const selectAllCompaniesAndBranches = () => {
        const next = {};
        companiesTree.forEach(c => {
            next[c.id] = {
                selected: true,
                branches: c.branches.map(b => b.id)
            };
        });
        setBulkAssignments(next);
        setExpandedCompanies(companiesTree.map(c => c.id));
        toast.info('Todas las empresas y sucursales seleccionadas');
    };

    const clearAllCompaniesAndBranches = () => {
        setBulkAssignments({});
    };

    const handleSaveBulk = () => {
        const targetUsers = bulkUserSelectionType === 'all' 
            ? users.map(u => u.id) 
            : bulkSelectedUserIds;

        if (targetUsers.length === 0) {
            return toast.error('Debe seleccionar al menos un usuario');
        }
        if (!bulkRoleId) {
            return toast.error('Debe seleccionar el rol a asignar');
        }

        const selectedCompanyIds = Object.keys(bulkAssignments).filter(cid => bulkAssignments[cid]?.selected);
        if (selectedCompanyIds.length === 0) {
            return toast.error('Debe seleccionar al menos una empresa');
        }

        const assignments = selectedCompanyIds.map(companyId => ({
            companyId: parseInt(companyId),
            roleId: parseInt(bulkRoleId),
            branches: bulkAssignments[companyId]?.branches || []
        }));

        bulkAssignMutation.mutate({
            userIds: targetUsers,
            assignments
        });
    };

    // Handlers Clonador
    const sourceUserAccesses = useMemo(() => {
        if (!cloneSourceUserId) return [];
        return accessSummary.filter(acc => String(acc.user_id) === String(cloneSourceUserId));
    }, [cloneSourceUserId, accessSummary]);

    const handleExecuteClone = async () => {
        if (!cloneSourceUserId) {
            return toast.error('Seleccione el usuario plantilla (origen)');
        }
        if (cloneTargetUserIds.length === 0) {
            return toast.error('Seleccione al menos un usuario destino');
        }
        if (sourceUserAccesses.length === 0) {
            return toast.error('El usuario origen seleccionado no tiene accesos configurados');
        }

        const sourceUser = users.find(u => String(u.id) === String(cloneSourceUserId));
        const ok = await confirm({
            title: '¿Confirmar clonación de accesos?',
            message: `Se copiarán los accesos de "${sourceUser?.nombre}" (${sourceUserAccesses.length} empresas) hacia ${cloneTargetUserIds.length} usuario(s) seleccionado(s). Modo: ${cloneMode === 'replace' ? 'Reemplazar todo' : 'Combinar/Agregar'}.`,
            confirmLabel: 'Sí, clonar accesos',
            cancelLabel: 'Cancelar',
            variant: 'warning'
        });

        if (ok) {
            cloneMutation.mutate({
                sourceUserId: parseInt(cloneSourceUserId),
                targetUserIds: cloneTargetUserIds.map(id => parseInt(id)),
                mode: cloneMode
            });
        }
    };

    // Handlers de la Tabla Principal (Selección Múltiple)
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

    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
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

    const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2";
    const selectCls = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm font-medium";

    // Cálculos resumen para modo masivo
    const bulkSummaryCount = useMemo(() => {
        const totalUsers = bulkUserSelectionType === 'all' ? users.length : bulkSelectedUserIds.length;
        const selectedCompanies = Object.keys(bulkAssignments).filter(cid => bulkAssignments[cid]?.selected);
        let totalBranches = 0;
        selectedCompanies.forEach(cid => {
            totalBranches += (bulkAssignments[cid]?.branches || []).length;
        });
        return { totalUsers, totalCompanies: selectedCompanies.length, totalBranches };
    }, [bulkUserSelectionType, users, bulkSelectedUserIds, bulkAssignments]);

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
                        className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm active:scale-95"
                    >
                        <Copy size={16} className="text-indigo-600" />
                        <span>Clonar Accesos</span>
                    </button>
                    <button 
                        onClick={() => openAddModal('masivo')}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
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
                            <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600">
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
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 px-2 py-1 flex items-center gap-1"
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
                                        className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
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
                                                className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
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
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                    title="Editar Acceso"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteSingle(acc.user_id, acc.company_id)}
                                                    className={`p-1.5 rounded-lg transition-all ${
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
                            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm"
                        >
                            <ShieldCheck size={14} />
                            Cambiar Rol
                        </button>
                        <button
                            onClick={handleExecuteBulkDelete}
                            disabled={bulkDeleteMutation.isPending}
                            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm disabled:opacity-50"
                        >
                            <Trash2 size={14} />
                            Eliminar
                        </button>
                        <button
                            onClick={() => setSelectedRowKeys([])}
                            className="text-slate-400 hover:text-white px-2 py-1.5 font-bold text-xs transition-colors"
                        >
                            Deseleccionar
                        </button>
                    </div>
                </div>
            )}

            {/* Modal de Asignación (Individual vs Masivo) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 md:p-6 overflow-y-auto">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeModal} />
                    <div className="relative bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
                        {/* Header con Pestañas */}
                        <div className="p-5 border-b border-slate-100 bg-slate-50/70 shrink-0">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-2">
                                        <ShieldCheck className="text-indigo-600" size={20} />
                                        {isEditing ? 'Editar Acceso de Usuario' : 'Asignar Accesos al Sistema'}
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Configure empresas, sucursales y roles autorizados
                                    </p>
                                </div>
                                <button onClick={closeModal} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                                    <X size={18} />
                                </button>
                            </div>

                            {!isEditing && (
                                <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl w-fit">
                                    <button
                                        type="button"
                                        onClick={() => setModalTab('masivo')}
                                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                                            modalTab === 'masivo'
                                            ? 'bg-white text-indigo-700 shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <Layers size={14} />
                                        Asignación Masiva / Múltiple
                                        <span className="bg-indigo-100 text-indigo-700 text-[9px] px-1.5 py-0.2 rounded-full font-bold">Recomendado</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setModalTab('individual')}
                                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                                            modalTab === 'individual'
                                            ? 'bg-white text-indigo-700 shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <UsersIcon size={14} />
                                        Asignación Individual
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Cuerpo del Modal */}
                        <div className="p-5 md:p-7 overflow-y-auto space-y-6 flex-1">
                            {modalTab === 'individual' ? (
                                /* ===================== MODO INDIVIDUAL ===================== */
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className={labelCls}>
                                                <UsersIcon size={14} className="text-indigo-600" /> 1. Usuario
                                            </label>
                                            <select 
                                                value={selectedUserId} 
                                                disabled={isEditing}
                                                onChange={(e) => setSelectedUserId(e.target.value)}
                                                className={selectCls}
                                            >
                                                <option value="">Seleccionar usuario...</option>
                                                {users.map(u => (
                                                    <option key={u.id} value={u.id}>{u.nombre} (@{u.username})</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className={labelCls}>
                                                <Building2 size={14} className="text-indigo-600" /> 2. Empresa
                                            </label>
                                            <select 
                                                value={selectedCompanyId} 
                                                disabled={isEditing}
                                                onChange={(e) => {
                                                    setSelectedCompanyId(e.target.value);
                                                    setSelectedBranches([]);
                                                }}
                                                className={selectCls}
                                            >
                                                <option value="">Seleccionar empresa...</option>
                                                {companies.map(c => (
                                                    <option key={c.id} value={c.id}>{c.razon_social}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className={labelCls}>
                                                <ShieldCheck size={14} className="text-indigo-600" /> 3. Rol
                                            </label>
                                            <select 
                                                value={selectedRoleId} 
                                                onChange={(e) => setSelectedRoleId(e.target.value)}
                                                className={selectCls}
                                            >
                                                <option value="">Seleccionar rol...</option>
                                                {roles.map(r => (
                                                    <option key={r.id} value={r.id}>{r.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Sucursales */}
                                    <div className="space-y-3 pt-2">
                                        <div className="flex items-center justify-between">
                                            <label className={labelCls}>
                                                <GitBranch size={14} className="text-indigo-600" /> 4. Sucursales Autorizadas
                                            </label>
                                            {branches.length > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedBranches(branches.map(b => b.id))}
                                                        className="text-[11px] font-bold text-indigo-600 hover:underline"
                                                    >
                                                        Todas
                                                    </button>
                                                    <span className="text-slate-300">|</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedBranches([])}
                                                        className="text-[11px] font-bold text-slate-500 hover:underline"
                                                    >
                                                        Ninguna
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {!selectedCompanyId ? (
                                            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
                                                <p className="text-xs font-bold text-slate-400">Debe seleccionar una empresa primero</p>
                                            </div>
                                        ) : loadingBranches ? (
                                            <div className="flex justify-center p-8">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                            </div>
                                        ) : branches.length === 0 ? (
                                            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
                                                <p className="text-xs font-medium text-slate-400">Esta empresa no posee sucursales registradas</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                                {branches.map(b => {
                                                    const isChecked = selectedBranches.includes(b.id);
                                                    return (
                                                        <button
                                                            key={b.id}
                                                            type="button"
                                                            onClick={() => toggleBranch(b.id)}
                                                            className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                                                                isChecked
                                                                ? 'bg-indigo-50 border-indigo-400 text-indigo-800 ring-1 ring-indigo-400'
                                                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                                            }`}
                                                        >
                                                            <div>
                                                                <div className="text-xs font-bold">{b.nombre}</div>
                                                                <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{b.codigo || b.direccion}</div>
                                                            </div>
                                                            <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                                                                isChecked ? 'bg-indigo-600 text-white' : 'border border-slate-300 bg-white'
                                                            }`}>
                                                                {isChecked && <Check size={12} strokeWidth={3} />}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* ===================== MODO MASIVO / MÚLTIPLE ===================== */
                                <div className="space-y-6">
                                    {/* Paso 1: Selección de Usuarios */}
                                    <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                                <UsersIcon size={16} className="text-indigo-600" />
                                                Paso 1: ¿A quiénes asignar?
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setBulkUserSelectionType('specific')}
                                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                                        bulkUserSelectionType === 'specific'
                                                        ? 'bg-indigo-600 text-white shadow-sm'
                                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    Usuarios Específicos ({bulkSelectedUserIds.length})
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setBulkUserSelectionType('all')}
                                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                                        bulkUserSelectionType === 'all'
                                                        ? 'bg-indigo-600 text-white shadow-sm'
                                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    Todos los Usuarios ({users.length})
                                                </button>
                                            </div>
                                        </div>

                                        {bulkUserSelectionType === 'specific' && (
                                            <div className="space-y-2 pt-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs w-full max-w-xs shadow-sm">
                                                        <Search size={14} className="text-slate-400" />
                                                        <input
                                                            type="text"
                                                            placeholder="Buscar usuarios..."
                                                            value={bulkUserSearch}
                                                            onChange={(e) => setBulkUserSearch(e.target.value)}
                                                            className="bg-transparent outline-none w-full font-medium"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[11px] font-bold">
                                                        <button type="button" onClick={selectAllBulkUsers} className="text-indigo-600 hover:underline">
                                                            Marcar filtrados
                                                        </button>
                                                        <span className="text-slate-300">|</span>
                                                        <button type="button" onClick={deselectAllBulkUsers} className="text-slate-500 hover:underline">
                                                            Desmarcar todos
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1 bg-white rounded-xl border border-slate-200 scroll-modern">
                                                    {users
                                                        .filter(u => u.nombre.toLowerCase().includes(bulkUserSearch.toLowerCase()) || u.username.toLowerCase().includes(bulkUserSearch.toLowerCase()))
                                                        .map(u => {
                                                            const isChecked = bulkSelectedUserIds.includes(u.id);
                                                            return (
                                                                <button
                                                                    key={u.id}
                                                                    type="button"
                                                                    onClick={() => toggleBulkUser(u.id)}
                                                                    className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all ${
                                                                        isChecked
                                                                        ? 'bg-indigo-50 border-indigo-400 text-indigo-800'
                                                                        : 'bg-white border-slate-100 text-slate-700 hover:bg-slate-50'
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
                                        )}
                                    </div>

                                    {/* Paso 2: Selección de Rol */}
                                    <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-2">
                                        <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                            <ShieldCheck size={16} className="text-indigo-600" />
                                            Paso 2: ¿Qué rol tendrán en las empresas seleccionadas?
                                        </label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                            {roles.map(r => {
                                                const isSelected = String(bulkRoleId) === String(r.id);
                                                return (
                                                    <button
                                                        key={r.id}
                                                        type="button"
                                                        onClick={() => setBulkRoleId(r.id)}
                                                        className={`p-2.5 rounded-xl border text-center transition-all text-xs font-bold ${
                                                            isSelected
                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                                                            : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
                                                        }`}
                                                    >
                                                        {r.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Paso 3: Selector en Árbol de Empresas y Sucursales */}
                                    <div className="space-y-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                                <Building2 size={16} className="text-indigo-600" />
                                                Paso 3: ¿En cuáles Empresas y Sucursales?
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={selectAllCompaniesAndBranches}
                                                    className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-xl text-xs font-bold transition-colors"
                                                >
                                                    <Sparkles size={13} />
                                                    Todas las empresas y sucursales
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={clearAllCompaniesAndBranches}
                                                    className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1"
                                                >
                                                    Limpiar
                                                </button>
                                            </div>
                                        </div>

                                        {loadingTree ? (
                                            <div className="text-center p-8 bg-slate-50 rounded-2xl">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                                                <p className="text-xs text-slate-400 font-bold mt-2">Cargando empresas y sucursales...</p>
                                            </div>
                                        ) : companiesTree.length === 0 ? (
                                            <div className="p-8 text-center bg-slate-50 rounded-2xl text-slate-400 font-bold text-xs">
                                                No hay empresas configuradas
                                            </div>
                                        ) : (
                                            <div className="space-y-3 max-h-[38vh] overflow-y-auto pr-1 scroll-modern">
                                                {companiesTree.map(company => {
                                                    const isCompanySelected = bulkAssignments[company.id]?.selected;
                                                    const selectedBranchesCount = (bulkAssignments[company.id]?.branches || []).length;
                                                    const isExpanded = expandedCompanies.includes(company.id);

                                                    return (
                                                        <div 
                                                            key={company.id}
                                                            className={`border rounded-2xl transition-all overflow-hidden ${
                                                                isCompanySelected
                                                                ? 'border-indigo-300 bg-indigo-50/20 shadow-sm'
                                                                : 'border-slate-200 bg-white'
                                                            }`}
                                                        >
                                                            {/* Cabecera de Empresa */}
                                                            <div className="flex items-center justify-between p-3 bg-slate-50/70 border-b border-slate-100">
                                                                <div className="flex items-center gap-3">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleCompanySelection(company)}
                                                                        className="flex items-center gap-2.5 text-left"
                                                                    >
                                                                        <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                                                                            isCompanySelected ? 'bg-indigo-600 text-white' : 'border border-slate-300 bg-white'
                                                                        }`}>
                                                                            {isCompanySelected && <Check size={14} strokeWidth={3} />}
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                                                                <Building2 size={13} className="text-slate-400" />
                                                                                {company.razon_social}
                                                                            </span>
                                                                            <span className="text-[10px] text-slate-400 font-mono">NIT: {company.nit}</span>
                                                                        </div>
                                                                    </button>
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    {isCompanySelected && company.branches.length > 0 && (
                                                                        <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                                                                            {selectedBranchesCount} de {company.branches.length} sucursales
                                                                        </span>
                                                                    )}
                                                                    {company.branches.length > 0 && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => toggleAllBranchesForCompany(company)}
                                                                            className="text-[10px] font-bold text-indigo-600 hover:underline px-1"
                                                                        >
                                                                            {selectedBranchesCount === company.branches.length ? 'Ninguna' : 'Todas'}
                                                                        </button>
                                                                    )}
                                                                    {company.branches.length > 0 && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => toggleCompanyAccordion(company.id)}
                                                                            className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors"
                                                                        >
                                                                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Sucursales desplegables */}
                                                            {isExpanded && company.branches.length > 0 && (
                                                                <div className="p-3 bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                    {company.branches.map(branch => {
                                                                        const isBranchChecked = (bulkAssignments[company.id]?.branches || []).includes(branch.id);
                                                                        return (
                                                                            <button
                                                                                key={branch.id}
                                                                                type="button"
                                                                                onClick={() => toggleBranchSelectionInBulk(company.id, branch.id)}
                                                                                className={`flex items-center justify-between p-2 rounded-xl border text-left transition-all ${
                                                                                    isBranchChecked
                                                                                    ? 'bg-indigo-50/70 border-indigo-400 text-indigo-900 font-bold'
                                                                                    : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                                                                }`}
                                                                            >
                                                                                <div className="truncate pr-2">
                                                                                    <div className="text-xs">{branch.nombre}</div>
                                                                                    <div className="text-[9px] text-slate-400 truncate">{branch.codigo || branch.direccion}</div>
                                                                                </div>
                                                                                <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                                                                                    isBranchChecked ? 'bg-indigo-600 text-white' : 'border border-slate-300 bg-white'
                                                                                }`}>
                                                                                    {isBranchChecked && <Check size={10} strokeWidth={3} />}
                                                                                </div>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Resumen de Asignación */}
                                    <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between text-xs text-indigo-900">
                                        <div className="flex items-center gap-2 font-medium">
                                            <Sparkles size={16} className="text-indigo-600 shrink-0" />
                                            <span>
                                                Resumen: Asignando rol <strong className="font-bold">{roles.find(r => String(r.id) === String(bulkRoleId))?.name || '—'}</strong> a <strong className="font-bold">{bulkSummaryCount.totalUsers}</strong> usuario(s) en <strong className="font-bold">{bulkSummaryCount.totalCompanies}</strong> empresa(s) ({bulkSummaryCount.totalBranches} sucursales en total).
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer del Modal */}
                        <div className="p-4 md:p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                            <button 
                                onClick={closeModal}
                                className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-200 transition-all"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={modalTab === 'individual' ? handleSaveIndividual : handleSaveBulk}
                                disabled={assignMutation.isPending || bulkAssignMutation.isPending}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-7 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
                            >
                                <Save size={16} />
                                <span>
                                    {assignMutation.isPending || bulkAssignMutation.isPending 
                                        ? 'Guardando...' 
                                        : (modalTab === 'individual' ? 'Guardar Acceso' : 'Aplicar Asignación Masiva')}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Clonar Accesos */}
            {isCloneModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCloneModalOpen(false)} />
                    <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
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
                            <button onClick={() => setIsCloneModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
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
                                    onChange={(e) => setCloneSourceUserId(e.target.value)}
                                    className={selectCls}
                                >
                                    <option value="">Seleccionar usuario origen...</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.nombre} (@{u.username})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Vista Previa de Permisos del Origen */}
                            {cloneSourceUserId && (
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                                    <div className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                                        <ShieldCheck size={14} className="text-indigo-600" />
                                        Accesos a clonar ({sourceUserAccesses.length} empresas):
                                    </div>
                                    {sourceUserAccesses.length === 0 ? (
                                        <p className="text-xs text-amber-600 italic">Este usuario no tiene accesos configurados aún.</p>
                                    ) : (
                                        <div className="space-y-1.5 max-h-28 overflow-y-auto">
                                            {sourceUserAccesses.map(acc => (
                                                <div key={acc.company_id} className="text-xs bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                                                    <span className="font-bold text-slate-800">{acc.company_name}</span>
                                                    <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                                                        {acc.role_name} ({acc.branches.length} sucursales)
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Usuarios Destino */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className={labelCls}>
                                        <ArrowRight size={14} className="text-indigo-600" /> 2. Usuarios Destino ({cloneTargetUserIds.length})
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const validUsers = users.filter(u => String(u.id) !== String(cloneSourceUserId));
                                            setCloneTargetUserIds(validUsers.map(u => u.id));
                                        }}
                                        className="text-[11px] font-bold text-indigo-600 hover:underline"
                                    >
                                        Seleccionar todos
                                    </button>
                                </div>

                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-sm">
                                    <Search size={14} className="text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar usuarios destino..."
                                        value={cloneTargetSearch}
                                        onChange={(e) => setCloneTargetSearch(e.target.value)}
                                        className="bg-transparent outline-none w-full font-medium"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200 scroll-modern">
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
                                                    className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all ${
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
                                        className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
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
                                        className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
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
                                onClick={() => setIsCloneModalOpen(false)}
                                className="px-5 py-2 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-200 transition-all"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleExecuteClone}
                                disabled={cloneMutation.isPending || !cloneSourceUserId || cloneTargetUserIds.length === 0}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold text-xs transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                            >
                                <Copy size={16} />
                                <span>{cloneMutation.isPending ? 'Clonando...' : 'Clonar y Aplicar'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mini Modal para Cambio de Rol Masivo */}
            {isBulkRoleModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsBulkRoleModalOpen(false)} />
                    <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
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
                                onClick={() => setIsBulkRoleModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleExecuteBulkRoleChange}
                                disabled={bulkUpdateRoleMutation.isPending || !bulkNewRoleId}
                                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
                            >
                                {bulkUpdateRoleMutation.isPending ? 'Actualizando...' : 'Actualizar Roles'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserAccess;
