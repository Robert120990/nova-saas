import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { 
    ShieldCheck, Building2, GitBranch, Save, Search, 
    Users as UsersIcon, X, Layers, ChevronDown, ChevronRight, 
    Sparkles, Check 
} from 'lucide-react';
import { toast } from 'sonner';

const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2";
const selectCls = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm font-medium";

export default function UserAccessAssignModal({
    open,
    editingAccess = null,
    defaultTab = 'masivo',
    users = [],
    companies = [],
    roles = [],
    companiesTree = [],
    loadingTree = false,
    onClose,
    onSuccess,
}) {
    const queryClient = useQueryClient();
    const isEditing = !!editingAccess;

    const [modalTab, setModalTab] = useState(defaultTab); // 'individual' | 'masivo'

    // Individual state
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [selectedBranches, setSelectedBranches] = useState([]);

    // Bulk state
    const [bulkUserSelectionType, setBulkUserSelectionType] = useState('specific'); // 'specific' | 'all'
    const [bulkSelectedUserIds, setBulkSelectedUserIds] = useState([]);
    const [bulkUserSearch, setBulkUserSearch] = useState('');
    const [bulkRoleId, setBulkRoleId] = useState('');
    const [bulkAssignments, setBulkAssignments] = useState({}); // { [companyId]: { selected: boolean, branches: number[] } }
    const [expandedCompanies, setExpandedCompanies] = useState([]);

    // Fetch branches for individual modal
    const { data: branches = [], isLoading: loadingBranches } = useQuery({
        queryKey: ['branches', selectedCompanyId],
        queryFn: async () => (await axios.get(`/api/branches?company_id=${selectedCompanyId}`)).data,
        enabled: !!selectedCompanyId && open && modalTab === 'individual'
    });

    // Reset or populate on open
    useEffect(() => {
        if (!open) return;

        if (editingAccess) {
            setModalTab('individual');
            setSelectedUserId(editingAccess.user_id);
            setSelectedCompanyId(editingAccess.company_id);
            setSelectedRoleId(editingAccess.role_id);
            setSelectedBranches((editingAccess.branches || []).map(b => b.id));
        } else {
            setModalTab(defaultTab);
            setSelectedUserId('');
            setSelectedCompanyId('');
            setSelectedRoleId('');
            setSelectedBranches([]);
            setBulkUserSelectionType('specific');
            setBulkSelectedUserIds([]);
            setBulkUserSearch('');
            setBulkRoleId('');
            setBulkAssignments({});
            setExpandedCompanies(companiesTree.map(c => c.id));
        }
    }, [open, editingAccess, defaultTab, companiesTree]);

    // Mutations
    const assignMutation = useMutation({
        mutationFn: (data) => axios.post('/api/users/assign-access', data),
        onSuccess: () => {
            toast.success('Acceso guardado exitosamente');
            queryClient.invalidateQueries({ queryKey: ['access-summary'] });
            if (onSuccess) onSuccess();
            onClose();
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al asignar acceso');
        }
    });

    const bulkAssignMutation = useMutation({
        mutationFn: (data) => axios.post('/api/users/assign-access-bulk', data),
        onSuccess: (res) => {
            toast.success(res.data?.message || 'Accesos masivos asignados exitosamente');
            queryClient.invalidateQueries({ queryKey: ['access-summary'] });
            if (onSuccess) onSuccess(res.data);
            onClose();
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al procesar asignación masiva');
        }
    });

    if (!open) return null;

    // Handlers individual
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

    // Handlers bulk
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
            const current = next[companyId] || { selected: false, branches: [] };
            const isChecked = current.branches.includes(branchId);
            const newBranches = isChecked
                ? current.branches.filter(id => id !== branchId)
                : [...current.branches, branchId];

            next[companyId] = {
                selected: newBranches.length > 0 ? true : current.selected,
                branches: newBranches
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

        const selectedCompaniesList = Object.keys(bulkAssignments)
            .filter(cid => bulkAssignments[cid]?.selected)
            .map(cid => ({
                companyId: parseInt(cid),
                branches: bulkAssignments[cid]?.branches || []
            }));

        if (selectedCompaniesList.length === 0) {
            return toast.error('Debe seleccionar al menos una empresa');
        }

        bulkAssignMutation.mutate({
            userIds: targetUsers,
            roleId: parseInt(bulkRoleId),
            assignments: selectedCompaniesList
        });
    };

    const bulkSummaryCount = {
        totalUsers: bulkUserSelectionType === 'all' ? users.length : bulkSelectedUserIds.length,
        totalCompanies: Object.keys(bulkAssignments).filter(cid => bulkAssignments[cid]?.selected).length,
        totalBranches: Object.keys(bulkAssignments)
            .filter(cid => bulkAssignments[cid]?.selected)
            .reduce((acc, cid) => acc + (bulkAssignments[cid]?.branches || []).length, 0)
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
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
                        <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors text-slate-500 cursor-pointer">
                            <X size={18} />
                        </button>
                    </div>

                    {!isEditing && (
                        <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl w-fit">
                            <button
                                type="button"
                                onClick={() => setModalTab('masivo')}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
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
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
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
                                                className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                                            >
                                                Todas
                                            </button>
                                            <span className="text-slate-300">|</span>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedBranches([])}
                                                className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
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
                                                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
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
                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
                                                <button type="button" onClick={selectAllBulkUsers} className="text-indigo-600 hover:underline cursor-pointer">
                                                    Marcar filtrados
                                                </button>
                                                <span className="text-slate-300">|</span>
                                                <button type="button" onClick={deselectAllBulkUsers} className="text-slate-500 hover:underline cursor-pointer">
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
                                                            className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
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
                                                className={`p-2.5 rounded-xl border text-center transition-all text-xs font-bold cursor-pointer ${
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
                                            className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                        >
                                            <Sparkles size={13} />
                                            Todas las empresas y sucursales
                                        </button>
                                        <button
                                            type="button"
                                            onClick={clearAllCompaniesAndBranches}
                                            className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1 cursor-pointer"
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
                                                                className="flex items-center gap-2.5 text-left cursor-pointer"
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
                                                                    className="text-[10px] font-bold text-indigo-600 hover:underline px-1 cursor-pointer"
                                                                >
                                                                    {selectedBranchesCount === company.branches.length ? 'Ninguna' : 'Todas'}
                                                                </button>
                                                            )}
                                                            {company.branches.length > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleCompanyAccordion(company.id)}
                                                                    className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors cursor-pointer"
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
                                                                        className={`flex items-center justify-between p-2 rounded-xl border text-left transition-all cursor-pointer ${
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
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-200 transition-all cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="button"
                        onClick={modalTab === 'individual' ? handleSaveIndividual : handleSaveBulk}
                        disabled={assignMutation.isPending || bulkAssignMutation.isPending}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-7 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50 cursor-pointer"
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
    );
}
