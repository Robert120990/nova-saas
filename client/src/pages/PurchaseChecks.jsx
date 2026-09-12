import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Plus,
    Trash2,
    Search,
    Edit,
    CheckCircle,
    Loader2,
    Save,
    Handshake,
    Send,
    Settings,
    RefreshCw,
    Undo2,
    Users,
    CheckCircle2,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    CheckSquare,
    Square,
    FileText
} from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import Money from '../components/ui/Money';
import { getTodayString } from '../utils/dateUtils';

const today = () => getTodayString();
const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
        const [year, month, day] = dateStr.split('T')[0].split('-');
        return `${day}/${month}/${year}`;
    } catch (e) {
        return dateStr;
    }
};

const PurchaseChecks = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const navigate = useNavigate();

    const [listSearch, setListSearch] = useState('');
    const [listPage, setListPage] = useState(1);

    const [showFormModal, setShowFormModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formBranchId, setFormBranchId] = useState(user?.branch_id || '');
    const [formFecha, setFormFecha] = useState(today());
    const [formProviderId, setFormProviderId] = useState('');
    const [formProviderNombre, setFormProviderNombre] = useState('');
    const [formMonto, setFormMonto] = useState('');
    const [formDestino, setFormDestino] = useState('P');

    const [showDeliverModal, setShowDeliverModal] = useState(false);
    const [deliverId, setDeliverId] = useState(null);
    const [deliverFecha, setDeliverFecha] = useState(today());
    const [deliverDocumento, setDeliverDocumento] = useState('');

    const [branchFilter, setBranchFilter] = useState(user?.branch_id || '');

    const [showConfigModal, setShowConfigModal] = useState(false);
    const [configBranchId, setConfigBranchId] = useState(user?.branch_id || '');
    const [configRrsId, setConfigRrsId] = useState('');
    const [configCodDestino, setConfigCodDestino] = useState('');

    const [showProvidersModal, setShowProvidersModal] = useState(false);
    const [providerBranchId, setProviderBranchId] = useState(user?.branch_id || '');
    const [providerSearch, setProviderSearch] = useState('');
    const [providerFilterTab, setProviderFilterTab] = useState('all');
    const [selectedProviderIds, setSelectedProviderIds] = useState([]);
    const [providersPage, setProvidersPage] = useState(1);
    const [singleSyncingId, setSingleSyncingId] = useState(null);

    const isEditing = editId !== null;

    const { data: listData, isLoading: listLoading } = useQuery({
        queryKey: ['purchase-checks', listSearch, listPage, branchFilter],
        queryFn: async () => (await axios.get('/api/purchases/checks', {
            params: { search: listSearch || undefined, page: listPage, limit: 15, branch_id: branchFilter || undefined }
        })).data
    });

    const loadProvidersOptions = async (search, page) => {
        const { data } = await axios.get('/api/providers', {
            params: { search: search || undefined, page, limit: 50 }
        });
        return data;
    };

    const { data: branches = [] } = useQuery({
        queryKey: ['branches', user?.company_id],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const { data: editData } = useQuery({
        queryKey: ['purchase-check-edit', editId],
        queryFn: async () => (await axios.get(`/api/purchases/checks/${editId}`)).data,
        enabled: !!editId && showFormModal,
    });

    useMemo(() => {
        if (editData) {
            setFormBranchId(editData.branch_id || user?.branch_id || '');
            setFormFecha(editData.fecha ? editData.fecha.split('T')[0] : today());
            setFormProviderId(String(editData.provider_id || ''));
            setFormProviderNombre(editData.provider_nombre || '');
            setFormMonto(String(editData.monto || ''));
            setFormDestino(editData.destino || 'P');
        }
    }, [editData, user?.branch_id]);

    const createMutation = useMutation({
        mutationFn: (data) => axios.post('/api/purchases/checks', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-checks'] });
            toast.success('Cheque registrado con éxito');
            closeForm();
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al registrar cheque'),
    });

    const updateMutation = useMutation({
        mutationFn: (data) => axios.put(`/api/purchases/checks/${editId}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-checks'] });
            toast.success('Cheque actualizado con éxito');
            closeForm();
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al actualizar cheque'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/purchases/checks/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-checks'] });
            toast.success('Cheque eliminado');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al eliminar cheque'),
    });

    const deliverMutation = useMutation({
        mutationFn: ({ id, data }) => axios.post(`/api/purchases/checks/${id}/deliver`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-checks'] });
            toast.success('Cheque marcado como entregado');
            setShowDeliverModal(false);
            setDeliverId(null);
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al entregar cheque'),
    });

    const requestMutation = useMutation({
        mutationFn: (id) => axios.post(`/api/purchases/checks/${id}/request`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-checks'] });
            toast.success('Solicitud enviada a RRS con éxito');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al solicitar cheque'),
    });

    const { data: configData } = useQuery({
        queryKey: ['chq-config', configBranchId],
        queryFn: async () => (await axios.get(`/api/purchases/checks/config/${configBranchId}`)).data,
        enabled: showConfigModal && !!configBranchId,
    });

    const saveConfigMutation = useMutation({
        mutationFn: (data) => axios.post('/api/purchases/checks/config', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chq-config', configBranchId] });
            toast.success('Configuración guardada con éxito');
            setShowConfigModal(false);
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar configuración'),
    });

    const checks = listData?.data || [];
    const total = listData?.total || 0;
    const totalPages = listData?.totalPages || 0;

    const { data: rrsNumChequeMap = {} } = useQuery({
        queryKey: ['purchase-checks-rrs-num', checks.map(c => c.id)],
        queryFn: async () => {
            const ids = checks.filter(c => c.status === 'SOLICITADO').map(c => c.id);
            if (ids.length === 0) return {};
            const res = await axios.post('/api/purchases/checks/rrs-num-cheque', { ids });
            return res.data;
        },
        enabled: checks.length > 0 && checks.some(c => c.status === 'SOLICITADO'),
        refetchInterval: 30000,
    });

    const revertMutation = useMutation({
        mutationFn: (id) => axios.post(`/api/purchases/checks/${id}/revert`),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['purchase-checks'] });
            toast.success(res.data.message);
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al revertir cheque'),
    });

    const syncMutation = useMutation({
        mutationFn: (branchId) => axios.post('/api/purchases/checks/sync-providers', { branch_id: branchId }),
        onSuccess: (res) => {
            toast.success(res.data.message);
            queryClient.invalidateQueries({ queryKey: ['purchase-checks'] });
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al sincronizar proveedores'),
    });

    const { data: providerBranchConfig } = useQuery({
        queryKey: ['chq-config-providers-modal', providerBranchId],
        queryFn: async () => (await axios.get(`/api/purchases/checks/config/${providerBranchId}`)).data,
        enabled: showProvidersModal && !!providerBranchId,
    });

    const { data: fallbackProviders = [], isLoading: fallbackProvidersLoading } = useQuery({
        queryKey: ['providers-modal-fallback', user?.company_id],
        queryFn: async () => {
            const res = await axios.get('/api/providers', { params: { limit: 2000 } });
            return res.data?.data || [];
        },
        enabled: showProvidersModal,
    });

    const {
        data: rrsVerifyData,
        isFetching: rrsVerifyFetching,
        refetch: runRrsVerify
    } = useQuery({
        queryKey: ['rrs-providers-verify', providerBranchId],
        queryFn: async () => {
            const res = await axios.get('/api/purchases/checks/verify-rrs-providers', {
                params: { branch_id: providerBranchId }
            });
            return res.data;
        },
        enabled: false,
    });

    useEffect(() => {
        if (!providerBranchId && branches.length > 0) {
            setProviderBranchId(branchFilter || user?.branch_id || String(branches[0].id));
        }
    }, [branches, branchFilter, user?.branch_id, providerBranchId]);

    const syncProvidersMutation = useMutation({
        mutationFn: async ({ branchId, providerIds }) => {
            const res = await axios.post('/api/purchases/checks/sync-providers', {
                branch_id: branchId,
                provider_ids: providerIds
            });
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data?.message || 'Operación completada');
            setSelectedProviderIds([]);
            setSingleSyncingId(null);
            if (isVerified) {
                runRrsVerify();
            }
        },
        onError: (err) => {
            setSingleSyncingId(null);
            toast.error(err.response?.data?.message || 'Error al enviar proveedores a RRS');
        }
    });

    const handleVerifyRrs = async () => {
        if (!providerBranchId) {
            toast.error('Seleccione una sucursal para verificar');
            return;
        }
        try {
            const result = await runRrsVerify();
            if (result.data) {
                toast.success(`Verificación completa: ${result.data.matched} existen en RRS, ${result.data.not_matched} no existen en RRS`);
            } else if (result.error) {
                toast.error(result.error.response?.data?.message || 'Error al verificar con RRS');
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'Error al conectar con RRS');
        }
    };

    const handleSendOne = (providerId) => {
        if (!providerBranchId) { toast.error('Seleccione una sucursal'); return; }
        setSingleSyncingId(providerId);
        syncProvidersMutation.mutate({ branchId: providerBranchId, providerIds: [providerId] });
    };

    const handleSendSelected = () => {
        if (selectedProviderIds.length === 0) return;
        if (!providerBranchId) { toast.error('Seleccione una sucursal'); return; }
        syncProvidersMutation.mutate({ branchId: providerBranchId, providerIds: selectedProviderIds });
    };

    const handleSendMissing = () => {
        if (!isVerified || !rrsVerifyData?.providers) return;
        if (!providerBranchId) { toast.error('Seleccione una sucursal'); return; }
        const missingIds = rrsVerifyData.providers.filter(p => !p.exists_in_rrs).map(p => p.id);
        if (missingIds.length === 0) {
            toast.info('No hay proveedores faltantes en RRS');
            return;
        }
        syncProvidersMutation.mutate({ branchId: providerBranchId, providerIds: missingIds });
    };

    const handleSendAll = () => {
        if (!providerBranchId) { toast.error('Seleccione una sucursal'); return; }
        syncProvidersMutation.mutate({ branchId: providerBranchId, providerIds: undefined });
    };

    const isVerified = Boolean(rrsVerifyData && rrsVerifyData.configured);
    const rawProvidersList = isVerified ? (rrsVerifyData.providers || []) : fallbackProviders;

    const filteredProvidersList = useMemo(() => {
        let list = rawProvidersList;
        if (providerSearch.trim()) {
            const term = providerSearch.toLowerCase().trim();
            list = list.filter(p =>
                (p.nombre || '').toLowerCase().includes(term) ||
                (p.nombre_comercial || '').toLowerCase().includes(term) ||
                (p.nit || '').toLowerCase().includes(term) ||
                (p.nrc || '').toLowerCase().includes(term)
            );
        }
        if (isVerified) {
            if (providerFilterTab === 'not_in_rrs') {
                list = list.filter(p => !p.exists_in_rrs);
            } else if (providerFilterTab === 'in_rrs') {
                list = list.filter(p => p.exists_in_rrs);
            }
        }
        return list;
    }, [rawProvidersList, providerSearch, providerFilterTab, isVerified]);

    const modalPageSize = 10;
    const modalTotalPages = Math.ceil(filteredProvidersList.length / modalPageSize) || 1;
    const paginatedProviders = useMemo(() => {
        const start = (providersPage - 1) * modalPageSize;
        return filteredProvidersList.slice(start, start + modalPageSize);
    }, [filteredProvidersList, providersPage]);

    const toggleSelectProvider = (id) => {
        setSelectedProviderIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const toggleSelectAllVisible = () => {
        const currentIds = paginatedProviders.map(p => p.id);
        const allSelected = currentIds.length > 0 && currentIds.every(id => selectedProviderIds.includes(id));
        if (allSelected) {
            setSelectedProviderIds(prev => prev.filter(id => !currentIds.includes(id)));
        } else {
            setSelectedProviderIds(prev => [...new Set([...prev, ...currentIds])]);
        }
    };

    useMemo(() => {
        if (configData) {
            if (configData.config) {
                setConfigRrsId(configData.config.rrs_id_empresa || '');
                setConfigCodDestino(configData.config.cod_destino || '');
            }
        }
    }, [configData]);

    const isSaving = createMutation.isPending || updateMutation.isPending;

    const handleRevert = async (id) => {
        const ok = await confirm({
            title: '¿Revertir solicitud?',
            message: 'Se eliminará el registro de RRS y el cheque volverá a estado PENDIENTE.',
            confirmLabel: 'Sí, revertir',
            variant: 'warning',
        });
        if (ok) revertMutation.mutate(id);
    };

    const handleRequest = async (id) => {
        const ok = await confirm({
            title: '¿Enviar solicitud a RRS?',
            message: 'Se registrará la solicitud en el sistema RRS y el cheque pasará a estado SOLICITADO.',
            confirmLabel: 'Sí, solicitar',
            variant: 'info',
        });
        if (ok) requestMutation.mutate(id);
    };

    const closeForm = () => {
        setShowFormModal(false);
        setEditId(null);
        resetForm();
    };

    const resetForm = () => {
        setFormBranchId(user?.branch_id || '');
        setFormFecha(today());
        setFormProviderId('');
        setFormProviderNombre('');
        setFormMonto('');
        setFormDestino('P');
    };

    const openNewForm = () => {
        setEditId(null);
        resetForm();
        setShowFormModal(true);
    };

    const openEditForm = (id) => {
        setEditId(id);
        setShowFormModal(true);
    };

    const openDeliverModal = (id) => {
        setDeliverId(id);
        setDeliverFecha(today());
        setDeliverDocumento('');
        setShowDeliverModal(true);
    };

    const handleSave = () => {
        if (!formFecha) { toast.error('La fecha es requerida'); return; }
        if (!formProviderId) { toast.error('El proveedor es requerido'); return; }
        if (!formMonto || parseFloat(formMonto) <= 0) { toast.error('El monto debe ser mayor a 0'); return; }

        const payload = {
            branch_id: formBranchId,
            fecha: formFecha,
            provider_id: formProviderId,
            monto: parseFloat(formMonto),
            destino: formDestino,
        };

        if (isEditing) {
            updateMutation.mutate(payload);
        } else {
            createMutation.mutate(payload);
        }
    };

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: '¿Eliminar cheque?',
            message: 'Esta acción no se puede deshacer.',
            confirmLabel: 'Sí, eliminar',
            variant: 'danger',
        });
        if (ok) deleteMutation.mutate(id);
    };

    const handleDeliver = () => {
        if (!deliverFecha) { toast.error('La fecha de entrega es requerida'); return; }
        deliverMutation.mutate({ id: deliverId, data: { fecha_entrega: deliverFecha, documento: deliverDocumento || null } });
    };

    const inputCls = "w-full bg-white border border-slate-200 rounded-xl text-[13px] font-medium py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all";
    const labelCls = "text-[11px] font-bold text-slate-500 uppercase";

    return (
        <div className="max-w-7xl mx-auto pb-20 space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black tracking-tighter text-slate-900 uppercase leading-none">Chq Contado</h2>
                    <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-widest leading-none">
                            Cheques de Contado
                        </span>
                        {user?.branch_name && (
                            <span className="text-[8px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-widest leading-none">
                                {user.branch_name}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/compras/reportes/chq-contado')}
                        className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-1.5 rounded-xl font-bold text-sm transition-all shadow-sm active:scale-95"
                        title="Ver reporte de cheques de contado"
                    >
                        <FileText size={17} className="text-indigo-600" />
                        <span>Reporte</span>
                    </button>
                    <button
                        onClick={() => {
                            setProviderBranchId(branchFilter || user?.branch_id || (branches[0]?.id ? String(branches[0].id) : ''));
                            setShowProvidersModal(true);
                        }}
                        className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-1.5 rounded-xl font-bold text-sm transition-all shadow-sm active:scale-95"
                        title="Ver proveedores y verificar en RRS"
                    >
                        <Users size={17} className="text-indigo-600" />
                        <span>Proveedores</span>
                    </button>
                    <button
                        onClick={openNewForm}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                    >
                        <Plus size={20} />
                        <span>Agregar</span>
                    </button>
                </div>
            </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input
                            type="text"
                            placeholder="Buscar por proveedor o documento..."
                            value={listSearch}
                            onChange={(e) => { setListSearch(e.target.value); setListPage(1); }}
                            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-[11px] font-bold uppercase tracking-tight shadow-sm"
                        />
                    </div>
                    <div className="w-48">
                        <select
                            value={branchFilter}
                            onChange={(e) => { setBranchFilter(e.target.value); setListPage(1); }}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-[11px] font-bold uppercase tracking-tight"
                        >
                            <option value="">Todas las Sucursales</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.nombre}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => { setConfigBranchId(branchFilter || user?.branch_id || ''); setShowConfigModal(true); }}
                        className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="Configuración RRS"
                    >
                        <Settings size={18} />
                    </button>
                </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table
                    headers={['Fecha', 'Proveedor', 'Monto', 'Destino', 'Estado', 'N. Cheque', 'F. Entrega', 'Documento', 'Acciones']}
                    data={checks}
                    isLoading={listLoading}
                    renderRow={(c) => {
                        const hasNumCheque = Boolean(rrsNumChequeMap[c.id] || c.rrs_num_cheque);
                        return (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                            <td className="px-5 py-3 text-[9px] font-bold text-slate-400">
                                {formatDate(c.fecha)}
                            </td>
                            <td className="px-5 py-3 text-[10px] font-bold text-slate-600 uppercase max-w-[200px] truncate">
                                {c.provider_nombre}
                            </td>
                            <td className="px-5 py-3 font-black text-slate-900 text-[10px]">
                                <Money value={c.monto} />
                            </td>
                            <td className="px-5 py-3">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${c.destino === 'P' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                    {c.destino === 'P' ? 'PISTA' : 'TIENDA'}
                                </span>
                            </td>
                            <td className="px-5 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${c.status === 'ENTREGADO' ? 'bg-emerald-50 text-emerald-600' : c.status === 'SOLICITADO' ? 'bg-violet-50 text-violet-600' : 'bg-amber-50 text-amber-600'}`}>
                                    {c.status}
                                </span>
                            </td>
                            <td className="px-5 py-3">
                                <span className="text-[9px] font-black text-indigo-600 font-mono tracking-tight">
                                    {rrsNumChequeMap[c.id] || c.rrs_num_cheque || '—'}
                                </span>
                            </td>
                            <td className="px-5 py-3 text-[9px] font-bold text-slate-400">
                                {formatDate(c.fecha_entrega)}
                            </td>
                            <td className="px-5 py-3 text-[9px] font-bold text-slate-500 max-w-[120px] truncate">
                                {c.documento || '—'}
                            </td>
                            <td className="px-5 py-3">
                                <div className="flex justify-end gap-1">
                                    {c.status === 'PENDIENTE' && (
                                        <>
                                            <button
                                                onClick={() => openEditForm(c.id)}
                                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                title="Editar"
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleRequest(c.id)}
                                                disabled={requestMutation.isPending}
                                                className="p-1.5 text-slate-600 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all disabled:opacity-40"
                                                title="Solicitar a RRS"
                                            >
                                                <Send size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(c.id)}
                                                className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </>
                                    )}
                                    {c.status === 'SOLICITADO' && (
                                        <>
                                            <button
                                                onClick={() => openDeliverModal(c.id)}
                                                disabled={!hasNumCheque}
                                                className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                                title={hasNumCheque ? 'Entregar' : 'Esperando generación de cheque en RRS'}
                                            >
                                                <Handshake size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleRevert(c.id)}
                                                disabled={revertMutation.isPending}
                                                className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all disabled:opacity-40"
                                                title="Revertir"
                                            >
                                                <Undo2 size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </td>
                        </tr>
                        );
                    }}
                />
                {totalPages > 1 && (
                    <div className="px-2">
                        <Pagination
                            currentPage={listPage}
                            totalPages={totalPages}
                            totalItems={total}
                            itemsOnPage={checks.length}
                            onPageChange={setListPage}
                            limit={15}
                            compact={true}
                        />
                    </div>
                )}
            </div>

            <Modal
                isOpen={showFormModal}
                onClose={() => { if (!isSaving) closeForm(); }}
                title={isEditing ? 'Editar Chq Contado' : 'Nuevo Chq Contado'}
                maxWidth="max-w-2xl"
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className={`${labelCls} block mb-1`}>Sucursal</label>
                            <select value={formBranchId} onChange={(e) => setFormBranchId(e.target.value)} className={inputCls}>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.nombre.toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Fecha</label>
                            <input type="date" value={formFecha} onChange={(e) => setFormFecha(e.target.value)} className={inputCls} />
                        </div>
                    </div>
                    <div>
                        <label className={`${labelCls} block mb-1`}>Proveedor</label>
                        <SearchableSelect
                            loadOptions={loadProvidersOptions}
                            value={formProviderId}
                            onChange={(e) => setFormProviderId(e.target.value)}
                            valueKey="id"
                            labelKey="nombre"
                            placeholder="BUSCAR PROVEEDOR..."
                            codeKey="nrc"
                            codeLabel="NRC"
                            selectedLabel={formProviderNombre}
                            dropdownWidth={420}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className={`${labelCls} block mb-1.5`}>Monto ($)</label>
                            <input type="number" step="0.01" min="0" value={formMonto}
                                onChange={(e) => setFormMonto(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                placeholder="0.00"
                                className={inputCls} />
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Destino</label>
                            <select value={formDestino} onChange={(e) => setFormDestino(e.target.value)} className={inputCls}>
                                <option value="P">PISTA</option>
                                <option value="T">TIENDA</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={closeForm} className="px-4 py-2 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm">
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {isSaving ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Guardar')}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={showDeliverModal}
                onClose={() => { setShowDeliverModal(false); setDeliverId(null); }}
                title="Entregar Chq Contado"
                maxWidth="max-w-md"
            >
                <div className="space-y-5">
                    {deliverId && (() => {
                        const targetCheck = checks.find(c => c.id === deliverId);
                        const numChq = rrsNumChequeMap[deliverId] || targetCheck?.rrs_num_cheque;
                        return (
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Proveedor</span>
                                    <span className="text-xs font-bold text-slate-800 uppercase truncate max-w-[200px] block">
                                        {targetCheck?.provider_nombre || '—'}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block">N. Cheque</span>
                                    <span className="text-xs font-black text-indigo-600 font-mono">
                                        {numChq || '—'}
                                    </span>
                                </div>
                            </div>
                        );
                    })()}
                    <div>
                        <label className={`${labelCls} block mb-1`}>Fecha de Entrega</label>
                        <input type="date" value={deliverFecha} onChange={(e) => setDeliverFecha(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                        <label className={`${labelCls} block mb-1`}>Documento</label>
                        <input type="text" value={deliverDocumento} onChange={(e) => setDeliverDocumento(e.target.value)}
                            placeholder="No. de documento o referencia" className={inputCls} />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => { setShowDeliverModal(false); setDeliverId(null); }}
                            className="px-4 py-2 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm">
                            Cancelar
                        </button>
                        <button
                            onClick={handleDeliver}
                            disabled={deliverMutation.isPending}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                        >
                            {deliverMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                            {deliverMutation.isPending ? 'Procesando...' : 'Entregar'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={showConfigModal}
                onClose={() => setShowConfigModal(false)}
                title="Configuración RRS — Chq Contado"
                maxWidth="max-w-xl"
            >
                <div className="space-y-5">
                    <div>
                        <label className={`${labelCls} block mb-1`}>Sucursal</label>
                        <select value={configBranchId} onChange={(e) => setConfigBranchId(e.target.value)} className={inputCls}>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.nombre.toUpperCase()}</option>)}
                        </select>
                    </div>
                    {configData && (
                        <>
                            <div>
                                <label className={`${labelCls} block mb-1`}>ID Empresa RRS</label>
                                <input type="text" value={configRrsId} onChange={(e) => setConfigRrsId(e.target.value)}
                                    placeholder="Ej: 014" className={inputCls} />
                            </div>
                            <div>
                                <label className={`${labelCls} block mb-1`}>Código Destino</label>
                                <input type="text" value={configCodDestino} onChange={(e) => setConfigCodDestino(e.target.value)}
                                    placeholder="Ej: 01" className={inputCls} />
                            </div>
                            {configData.config && (
                                <>
                                    <hr className="border-slate-200" />
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-500 mb-2">Sincronizar Proveedores</p>
                                        <p className="text-[10px] text-slate-400 mb-3">
                                            Sincroniza todos los proveedores del sistema con RRS (db_system_rrs).
                                            El match se hace por NIT, NRC o código generado.
                                        </p>
                                        <button
                                            onClick={() => syncMutation.mutate(configBranchId)}
                                            disabled={syncMutation.isPending}
                                            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                                        >
                                            {syncMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                            {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar Proveedores'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => setShowConfigModal(false)}
                            className="px-4 py-2 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm">
                            Cerrar
                        </button>
                        <button
                            onClick={() => {
                                if (!configRrsId) { toast.error('ID Empresa RRS es requerido'); return; }
                                if (!configCodDestino) { toast.error('Código destino es requerido'); return; }
                                saveConfigMutation.mutate({
                                    branch_id: configBranchId,
                                    rrs_id_empresa: configRrsId,
                                    cod_destino: configCodDestino
                                });
                            }}
                            disabled={saveConfigMutation.isPending}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                        >
                            {saveConfigMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {saveConfigMutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Modal de Proveedores y Verificación RRS */}
            <Modal
                isOpen={showProvidersModal}
                onClose={() => {
                    setShowProvidersModal(false);
                    setSelectedProviderIds([]);
                }}
                title="Proveedores — Cheques de Contado"
                maxWidth="max-w-5xl"
            >
                <div className="space-y-4">
                    {/* Barra superior de sucursal y botón de verificación */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">Sucursal:</span>
                            <select
                                value={providerBranchId}
                                onChange={(e) => {
                                    setProviderBranchId(e.target.value);
                                    setSelectedProviderIds([]);
                                    setProvidersPage(1);
                                }}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-tight outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.nombre}</option>
                                ))}
                            </select>
                            {providerBranchConfig?.config?.rrs_id_empresa ? (
                                <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100 uppercase tracking-tight">
                                    ID Empresa RRS: {providerBranchConfig.config.rrs_id_empresa}
                                </span>
                            ) : (
                                <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-200">
                                    Sin configurar en RRS
                                </span>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={handleVerifyRrs}
                            disabled={rrsVerifyFetching || !providerBranchConfig?.config?.rrs_id_empresa}
                            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20 active:scale-95"
                            title="Verificar cuáles proveedores existen y cuáles faltan en el sistema RRS"
                        >
                            {rrsVerifyFetching ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <RefreshCw size={15} />
                            )}
                            <span>{rrsVerifyFetching ? 'Verificando en RRS...' : 'Verificar en RRS'}</span>
                        </button>
                    </div>

                    {/* Aviso de falta de configuración en RRS */}
                    {!providerBranchConfig?.config?.rrs_id_empresa && (
                        <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium">
                            <AlertCircle size={17} className="shrink-0 text-amber-600 mt-0.5" />
                            <div>
                                <p className="font-bold">Sucursal sin ID Empresa RRS configurado</p>
                                <p className="text-[11px] text-amber-700">Para contrastar y sincronizar con RRS, abre la opción de <strong>Configuración RRS</strong> (ícono de engranaje) y asigna el ID Empresa de esta sucursal.</p>
                            </div>
                        </div>
                    )}

                    {/* Tarjetas de Métricas tras verificar */}
                    {isVerified && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Proveedores</p>
                                    <p className="text-xl font-black text-slate-800">{rrsVerifyData.total}</p>
                                </div>
                                <Users size={22} className="text-slate-400" />
                            </div>
                            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Existen en RRS</p>
                                    <p className="text-xl font-black text-emerald-700">{rrsVerifyData.matched}</p>
                                </div>
                                <CheckCircle2 size={22} className="text-emerald-500" />
                            </div>
                            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">No existen en RRS</p>
                                    <p className="text-xl font-black text-rose-700">{rrsVerifyData.not_matched}</p>
                                </div>
                                <AlertCircle size={22} className="text-rose-500" />
                            </div>
                        </div>
                    )}

                    {/* Filtros, buscador y botones de acción para enviar uno o todos */}
                    <div className="space-y-2.5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                            {/* Tabs de filtro */}
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 overflow-x-auto">
                                <button
                                    type="button"
                                    onClick={() => { setProviderFilterTab('all'); setProvidersPage(1); }}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${providerFilterTab === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    Todos ({rawProvidersList.length})
                                </button>
                                {isVerified && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => { setProviderFilterTab('not_in_rrs'); setProvidersPage(1); }}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${providerFilterTab === 'not_in_rrs' ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-600 hover:bg-rose-50'}`}
                                        >
                                            <span>Faltan en RRS</span>
                                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${providerFilterTab === 'not_in_rrs' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-700'}`}>
                                                {rrsVerifyData.not_matched}
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setProviderFilterTab('in_rrs'); setProvidersPage(1); }}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${providerFilterTab === 'in_rrs' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-600 hover:bg-emerald-50'}`}
                                        >
                                            <span>En RRS</span>
                                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${providerFilterTab === 'in_rrs' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {rrsVerifyData.matched}
                                            </span>
                                        </button>
                                    </>
                                )}
                            </div>

                            {/* Botones de envío masivo (Enviar Seleccionados, Faltantes, Todos) */}
                            <div className="flex flex-wrap items-center gap-2">
                                {selectedProviderIds.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleSendSelected}
                                        disabled={syncProvidersMutation.isPending || !providerBranchConfig?.config?.rrs_id_empresa}
                                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                        title="Enviar proveedores seleccionados a RRS"
                                    >
                                        {syncProvidersMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                        <span>Enviar seleccionados ({selectedProviderIds.length})</span>
                                    </button>
                                )}

                                {isVerified && rrsVerifyData.not_matched > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleSendMissing}
                                        disabled={syncProvidersMutation.isPending || !providerBranchConfig?.config?.rrs_id_empresa}
                                        className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                        title="Enviar únicamente los proveedores que no existen en RRS"
                                    >
                                        {syncProvidersMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                        <span>Enviar Faltantes ({rrsVerifyData.not_matched})</span>
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={handleSendAll}
                                    disabled={syncProvidersMutation.isPending || !providerBranchConfig?.config?.rrs_id_empresa}
                                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                    title="Sincronizar todos los proveedores a RRS"
                                >
                                    {syncProvidersMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                                    <span>Enviar Todos a RRS</span>
                                </button>
                            </div>
                        </div>

                        {/* Buscador de proveedores */}
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input
                                type="text"
                                placeholder="Buscar proveedor por nombre, comercial, NIT o NRC..."
                                value={providerSearch}
                                onChange={(e) => { setProviderSearch(e.target.value); setProvidersPage(1); }}
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Tabla de proveedores */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                                        <th className="w-10 px-4 py-2.5 text-center">
                                            <button
                                                type="button"
                                                onClick={toggleSelectAllVisible}
                                                className="text-slate-400 hover:text-indigo-600 transition-colors"
                                                title="Seleccionar / Deseleccionar visibles"
                                            >
                                                {paginatedProviders.length > 0 && paginatedProviders.every(p => selectedProviderIds.includes(p.id)) ? (
                                                    <CheckSquare size={16} className="text-indigo-600" />
                                                ) : (
                                                    <Square size={16} />
                                                )}
                                            </button>
                                        </th>
                                        <th className="px-4 py-2.5">Proveedor</th>
                                        <th className="px-4 py-2.5">NRC / NIT</th>
                                        <th className="px-4 py-2.5">Contacto</th>
                                        <th className="px-4 py-2.5">Estado en RRS</th>
                                        <th className="px-4 py-2.5 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-[12px]">
                                    {fallbackProvidersLoading && !isVerified ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                                                <Loader2 size={20} className="animate-spin mx-auto mb-2 text-indigo-500" />
                                                Cargando proveedores...
                                            </td>
                                        </tr>
                                    ) : paginatedProviders.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                                                No se encontraron proveedores coincidentes.
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedProviders.map((p) => {
                                            const isSelected = selectedProviderIds.includes(p.id);
                                            const isThisSyncing = singleSyncingId === p.id;
                                            return (
                                                <tr
                                                    key={p.id}
                                                    className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}
                                                >
                                                    <td className="px-4 py-2.5 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSelectProvider(p.id)}
                                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2.5 max-w-[240px]">
                                                        <div className="font-bold text-slate-800 text-[11px] uppercase truncate" title={p.nombre}>
                                                            {p.nombre}
                                                        </div>
                                                        {p.nombre_comercial && p.nombre_comercial !== p.nombre && (
                                                            <div className="text-[10px] text-slate-400 uppercase truncate" title={p.nombre_comercial}>
                                                                {p.nombre_comercial}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2.5 whitespace-nowrap">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-[10px] font-mono text-slate-600 font-bold">
                                                                NRC: {p.nrc || '—'}
                                                            </span>
                                                            <span className="text-[9px] font-mono text-slate-400">
                                                                NIT: {p.nit || '—'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-[10px] text-slate-500 whitespace-nowrap">
                                                        <div>{p.telefono || '—'}</div>
                                                        {p.correo && <div className="text-slate-400 truncate max-w-[140px]" title={p.correo}>{p.correo}</div>}
                                                    </td>
                                                    <td className="px-4 py-2.5 whitespace-nowrap">
                                                        {!isVerified ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500">
                                                                Sin verificar
                                                            </span>
                                                        ) : p.exists_in_rrs ? (
                                                            <div className="flex flex-col">
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    <CheckCircle2 size={11} /> Existe en RRS
                                                                </span>
                                                                {p.rrs_codigo && (
                                                                    <span className="text-[8px] font-mono text-slate-400 mt-0.5">
                                                                        Cód: {p.rrs_codigo}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                                <AlertCircle size={11} /> No existe en RRS
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSendOne(p.id)}
                                                            disabled={syncProvidersMutation.isPending || !providerBranchConfig?.config?.rrs_id_empresa}
                                                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40 ${
                                                                isVerified && !p.exists_in_rrs
                                                                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                                                                    : 'bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200'
                                                            }`}
                                                            title={isVerified && !p.exists_in_rrs ? 'Crear este proveedor en RRS' : 'Enviar / actualizar proveedor en RRS'}
                                                        >
                                                            {isThisSyncing ? (
                                                                <Loader2 size={12} className="animate-spin" />
                                                            ) : (
                                                                <Send size={11} />
                                                            )}
                                                            <span>
                                                                {isThisSyncing
                                                                    ? 'Enviando...'
                                                                    : (isVerified && !p.exists_in_rrs ? 'Enviar a RRS' : 'Enviar')}
                                                            </span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginación de la tabla de proveedores */}
                        {filteredProvidersList.length > modalPageSize && (
                            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 text-[11px] text-slate-500 font-medium">
                                <span>
                                    Mostrando {((providersPage - 1) * modalPageSize) + 1} a {Math.min(providersPage * modalPageSize, filteredProvidersList.length)} de {filteredProvidersList.length} proveedores
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setProvidersPage(p => Math.max(p - 1, 1))}
                                        disabled={providersPage <= 1}
                                        className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="px-2 font-bold text-slate-700">
                                        {providersPage} / {modalTotalPages}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setProvidersPage(p => Math.min(p + 1, modalTotalPages))}
                                        disabled={providersPage >= modalTotalPages}
                                        className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Pie del modal */}
                    <div className="flex justify-end pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                setShowProvidersModal(false);
                                setSelectedProviderIds([]);
                            }}
                            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-xs uppercase tracking-wider"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PurchaseChecks;
