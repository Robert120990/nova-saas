import { useState, useMemo } from 'react';
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
    Undo2
} from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import Money from '../components/ui/Money';

const today = () => new Date().toISOString().split('T')[0];
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
                <button
                    onClick={openNewForm}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={20} />
                    <span>Agregar</span>
                </button>
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
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
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
                    renderRow={(c) => (
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
                                    {c.status === 'SOLICITADO' ? (rrsNumChequeMap[c.id] || c.rrs_num_cheque || '—') : '—'}
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
                                                className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                title="Editar"
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleRequest(c.id)}
                                                disabled={requestMutation.isPending}
                                                className="p-1.5 text-slate-300 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all disabled:opacity-40"
                                                title="Solicitar a RRS"
                                            >
                                                <Send size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(c.id)}
                                                className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
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
                                                className="p-1.5 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                                title="Entregar"
                                            >
                                                <Handshake size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleRevert(c.id)}
                                                disabled={revertMutation.isPending}
                                                className="p-1.5 text-slate-300 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all disabled:opacity-40"
                                                title="Revertir"
                                            >
                                                <Undo2 size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </td>
                        </tr>
                    )}
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
        </div>
    );
};

export default PurchaseChecks;
