import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import { Plus, Edit, Trash2, Search, Building2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/ui/SearchableSelect';
import Pagination from '../components/ui/Pagination';

const Customers = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const { user } = useAuth();

    const userPermissions = user?.permissions || [];
    const isSuperAdmin = user?.role === 'SuperAdmin';
    const canBatchDelete = isSuperAdmin || userPermissions.includes('manage_customers_batch_delete');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedMun, setSelectedMun] = useState('');
    const [selectedDistrito, setSelectedDistrito] = useState('');
    const [selectedActivity, setSelectedActivity] = useState('');
    const [condicionFiscal, setCondicionFiscal] = useState('contribuyente');
    const [exentoIva, setExentoIva] = useState(false);
    const [esCredito, setEsCredito] = useState(false);
    const [diasCredito, setDiasCredito] = useState('15');
    const [esAnticipado, setEsAnticipado] = useState(false);
    const [esTrupput, setEsTrupput] = useState(false);

    // Sucursales
    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
    const [branchCustomer, setBranchCustomer] = useState(null);
    const [editingBranch, setEditingBranch] = useState(null);
    const [branchDept, setBranchDept] = useState('');
    const [branchMun, setBranchMun] = useState('');
    const [branchDistrito, setBranchDistrito] = useState('');
    const [branchTab, setBranchTab] = useState('form');
    const [branchSearch, setBranchSearch] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(15);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedPais, setSelectedPais] = useState('9579');
    const [nitValue, setNitValue] = useState('');
    const [docType, setDocType] = useState('DUI');

    const formatNIT = (value, type = 'DUI') => {
        const digits = value.replace(/\D/g, '');
        let formatted = '';
        
        if (type === 'DUI') {
            // Formato DUI: 00000000-0
            if (digits.length > 0) formatted += digits.substring(0, 8);
            if (digits.length > 8) formatted += '-' + digits.substring(8, 9);
        } else {
            // Formato NIT: 0000-000000-000-0
            if (digits.length > 0) formatted += digits.substring(0, 4);
            if (digits.length > 4) formatted += '-' + digits.substring(4, 10);
            if (digits.length > 10) formatted += '-' + digits.substring(10, 13);
            if (digits.length > 13) formatted += '-' + digits.substring(13, 14);
        }
        return formatted;
    };

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: response = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['customers', debouncedSearch, page, limit],
        queryFn: async () => (await axios.get('/api/customers', { params: { search: debouncedSearch, page, limit } })).data
    });

    const customers = response.data || [];

    const { data: departments = [] } = useQuery({
        queryKey: ['catalogs', 'departments'],
        queryFn: async () => (await axios.get('/api/catalogs/departments')).data
    });

    const { data: municipalities = [] } = useQuery({
        queryKey: ['catalogs', 'municipalities', selectedDept],
        queryFn: async () => (await axios.get(`/api/catalogs/municipalities?dep_code=${selectedDept}`)).data,
        enabled: !!selectedDept
    });

    const { data: activities = [] } = useQuery({
        queryKey: ['catalogs', 'actividades'],
        queryFn: async () => (await axios.get('/api/catalogs/actividades')).data
    });

    const { data: distritos = [] } = useQuery({
        queryKey: ['catalogs', 'distritos', selectedDept],
        queryFn: async () => (await axios.get(`/api/catalogs/districts?dep_code=${selectedDept}`)).data,
        enabled: !!selectedDept
    });

    const { data: personTypes = [] } = useQuery({
        queryKey: ['catalogs', 'cat_029_tipo_persona'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_029_tipo_persona')).data
    });

    const { data: countries = [] } = useQuery({
        queryKey: ['catalogs', 'cat_020_pais'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_020_pais')).data
    });

    const mutation = useMutation({
        mutationFn: (data) => {
            if (selectedCustomer) return axios.put(`/api/customers/${selectedCustomer.id}`, data);
            return axios.post('/api/customers', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['customers']);
            setIsModalOpen(false);
            setSelectedCustomer(null);
            toast.success(selectedCustomer ? 'Cliente actualizado' : 'Cliente registrado');
        },
        onError: (error) => {
            const msg = error.response?.data?.message || 'Error al procesar la solicitud';
            toast.error(msg);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/customers/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['customers']);
            toast.success('Cliente eliminado');
        }
    });

    const [selectedIds, setSelectedIds] = useState(new Set());
    const selectAllRef = useRef(null);

    const allPageSelected = customers.length > 0 && customers.every(c => selectedIds.has(c.id));
    const somePageSelected = customers.some(c => selectedIds.has(c.id));

    useEffect(() => {
        if (selectAllRef.current) {
            selectAllRef.current.indeterminate = somePageSelected && !allPageSelected;
        }
    }, [somePageSelected, allPageSelected]);

    const handleSelectAll = () => {
        if (allPageSelected) {
            const next = new Set(selectedIds);
            customers.forEach(c => next.delete(c.id));
            setSelectedIds(next);
        } else {
            const next = new Set(selectedIds);
            customers.forEach(c => next.add(c.id));
            setSelectedIds(next);
        }
    };

    const handleSelectOne = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const deleteBatchMutation = useMutation({
        mutationFn: (ids) => axios.delete('/api/customers/batch', { data: { ids } }),
        onSuccess: (res) => {
            queryClient.invalidateQueries(['customers']);
            setSelectedIds(new Set());
            toast.success(res.data.message || 'Clientes eliminados');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al eliminar clientes');
        }
    });

    const handleDeleteSelected = async () => {
        const ok = await confirm({
            title: '¿Eliminar clientes seleccionados?',
            message: `${selectedIds.size} cliente(s) serán eliminados permanentemente. Esta acción no se puede deshacer.`,
            confirmLabel: 'Sí, eliminar todos',
            variant: 'danger',
        });
        if (ok) deleteBatchMutation.mutate([...selectedIds]);
    };

    const handleSelectAllResults = useCallback(async () => {
        try {
            const params = { ids_only: '1' };
            if (debouncedSearch) params.search = debouncedSearch;
            const ids = await axios.get('/api/customers', { params }).then(r => r.data);
            setSelectedIds(new Set(ids));
            toast.success(`${ids.length} cliente(s) seleccionados`);
        } catch {
            toast.error('Error al seleccionar todos los clientes');
        }
    }, [debouncedSearch]);

    // Sucursales queries & mutations
    const { data: branches = [], isLoading: branchesLoading } = useQuery({
        queryKey: ['customer-branches', branchCustomer?.id],
        queryFn: async () => (await axios.get('/api/customer-branches', { params: { customer_id: branchCustomer?.id } })).data,
        enabled: !!branchCustomer?.id
    });

    const filteredBranches = useMemo(() => {
        const q = branchSearch.trim().toLowerCase();
        if (!q) return branches;
        return branches.filter(b => [
            b.nombre,
            b.direccion,
            b.telefono,
            b.departamento_nombre || b.departamento,
            b.municipio_nombre || b.municipio,
            b.distrito_nombre || b.distrito
        ].some(v => (v || '').toString().toLowerCase().includes(q)));
    }, [branches, branchSearch]);

    const branchMutations = {
        save: useMutation({
            mutationFn: (data) => {
                if (editingBranch) return axios.put(`/api/customer-branches/${editingBranch.id}`, data);
                return axios.post('/api/customer-branches', data);
            },
            onSuccess: () => {
                queryClient.invalidateQueries(['customer-branches', branchCustomer?.id]);
                setEditingBranch(null);
                setBranchDept('');
                setBranchMun('');
                toast.success(editingBranch ? 'Sucursal actualizada' : 'Sucursal agregada');
            },
            onError: (error) => {
                toast.error(error.response?.data?.message || 'Error al guardar sucursal');
            }
        }),
        delete: useMutation({
            mutationFn: (id) => axios.delete(`/api/customer-branches/${id}`),
            onSuccess: () => {
                queryClient.invalidateQueries(['customer-branches', branchCustomer?.id]);
                toast.success('Sucursal eliminada');
            }
        })
    };

    const { data: branchMunicipalities = [] } = useQuery({
        queryKey: ['catalogs', 'municipalities', branchDept],
        queryFn: async () => (await axios.get(`/api/catalogs/municipalities?dep_code=${branchDept}`)).data,
        enabled: !!branchDept
    });

    const { data: branchDistritos = [] } = useQuery({
        queryKey: ['catalogs', 'distritos', branchDept],
        queryFn: async () => (await axios.get(`/api/catalogs/districts?dep_code=${branchDept}`)).data,
        enabled: !!branchDept
    });

    const handleOpenBranches = (customer) => {
        setBranchCustomer(customer);
        setEditingBranch(null);
        setBranchDept('');
        setBranchMun('');
        setBranchDistrito('');
        setBranchTab('form');
        setBranchSearch('');
        setIsBranchModalOpen(true);
    };

    const handleEditBranch = (branch) => {
        setEditingBranch(branch);
        setBranchDept(branch.departamento || '');
        setBranchMun(branch.municipio || '');
        setBranchDistrito(branch.distrito || '');
        setBranchTab('form');
    };

    const handleBranchSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        data.customer_id = branchCustomer.id;
        branchMutations.save.mutate(data);
    };

    const handleDeleteBranch = async (id) => {
        const ok = await confirm({
            title: '¿Eliminar sucursal?',
            message: 'Esta sucursal será eliminada permanentemente.',
            confirmLabel: 'Sí, eliminar',
            variant: 'danger',
        });
        if (ok) branchMutations.delete.mutate(id);
    };

    const handleDeleteCustomer = async (id) => {
        const ok = await confirm({
            title: '¿Eliminar cliente?',
            message: 'El cliente y su historial asociado serán eliminados permanentemente. Esta acción no se puede deshacer.',
            confirmLabel: 'Sí, eliminar',
            variant: 'danger',
        });
        if (ok) deleteMutation.mutate(id);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        data.exento_iva = formData.get('exento_iva') === 'on';
        data.aplica_fovial = formData.get('aplica_fovial') === 'on';
        data.aplica_cotrans = formData.get('aplica_cotrans') === 'on';
        data.es_credito = formData.get('es_credito') === 'on';
        data.es_anticipado = formData.get('es_anticipado') === 'on';
        data.es_trupput = formData.get('es_trupput') === 'on';
        data.dias_credito = data.es_credito ? parseInt(diasCredito) || 15 : 15;

        const nitRegex = /^\d{4}-\d{6}-\d{3}-\d{1}$/;
        const duiRegex = /^\d{8}-\d{1}$/;
        
        if (data.nit && !nitRegex.test(data.nit) && !duiRegex.test(data.nit)) {
            toast.error('Formato de NIT o DUI inválido');
            return;
        }

        mutation.mutate(data);
    };

    const handleEdit = (customer) => {
        setSelectedCustomer(customer);
        setSelectedDept(customer.departamento);
        setSelectedMun(customer.municipio);
        setSelectedDistrito(customer.distrito);
        setSelectedActivity(customer.codigo_actividad);
        setCondicionFiscal(customer.condicion_fiscal || 'contribuyente');
        setExentoIva(customer.exento_iva || false);
        setEsCredito(customer.es_credito || false);
        setDiasCredito(customer.dias_credito != null ? String(customer.dias_credito) : '15');
        setEsAnticipado(customer.es_anticipado || false);
        setEsTrupput(customer.es_trupput || false);
        setDocType(customer.tipo_documento || 'DUI');
        setNitValue(customer.nit || '');
        setSelectedPais(customer.pais || '9579');
        setIsModalOpen(true);
    };

    const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm";
    const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

    return (
        <div className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">Clientes</h2>
                    <p className="text-slate-500 text-[11px] font-medium">Base de datos de contribuyentes y consumidores final</p>
                </div>
                <button 
                    onClick={() => { 
                        setSelectedCustomer(null); 
                        setSelectedDept(''); 
                        setSelectedMun('');
                        setSelectedDistrito('');
                        setSelectedActivity('');
                        setCondicionFiscal('contribuyente');
                        setExentoIva(false);
                        setEsCredito(false);
                        setDiasCredito('15');
                        setEsAnticipado(false);
                        setEsTrupput(false);
                        setDocType('DUI');
                        setNitValue('');
                        setSelectedPais('9579');
                        setIsModalOpen(true); 
                    }} 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-95 font-bold text-sm"
                >
                    <Plus size={20}/>
                    <span>Nuevo Cliente</span>
                </button>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input 
                    type="text" 
                    placeholder="Buscar..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-medium shadow-sm"
                />
            </div>

            {canBatchDelete && selectedIds.size > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl shadow-sm">
                    <span className="text-xs font-bold text-indigo-700">{selectedIds.size} cliente(s) seleccionados</span>
                    <button
                        onClick={() => setSelectedIds(new Set())}
                        className="text-[10px] font-bold text-slate-500 hover:text-slate-700 uppercase transition-colors"
                    >
                        Deseleccionar todo
                    </button>
                    {selectedIds.size < response.total && (
                        <button
                            onClick={handleSelectAllResults}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase transition-colors"
                        >
                            Seleccionar todos los {response.total} resultados
                        </button>
                    )}
                    <button
                        onClick={handleDeleteSelected}
                        disabled={deleteBatchMutation.isPending}
                        className="ml-auto px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-[10px] font-bold uppercase rounded-lg transition-all active:scale-95"
                    >
                        {deleteBatchMutation.isPending ? 'Eliminando...' : `Eliminar ${selectedIds.size}`}
                    </button>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table 
                    headers={[
                        ...(canBatchDelete ? [<input
                            key="select-all"
                            type="checkbox"
                            ref={selectAllRef}
                            checked={allPageSelected}
                            onChange={handleSelectAll}
                            className="accent-indigo-600 w-4 h-4 cursor-pointer"
                        />] : []),
                        'Nombre / Razón Social', 'Ubicación', 'Tipo Persona / País', 'Documento', 'Condición Fiscal', 'Acciones'
                    ]}
                    data={customers}
                    isLoading={isLoading}
                    renderRow={(c) => (
                        <tr key={c.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(c.id) ? 'bg-indigo-50/50' : ''}`}>
                            {canBatchDelete && (
                                <td className="px-3 py-1">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(c.id)}
                                        onChange={() => handleSelectOne(c.id)}
                                        className="accent-indigo-600 w-4 h-4 cursor-pointer"
                                    />
                                </td>
                            )}
                            <td className="px-3 py-1">
                                <div className="text-xs font-bold text-slate-900">{c.nombre}</div>
                                <div className="text-[10px] text-slate-500 font-medium">{c.nombre_comercial}</div>
                            </td>
                            <td className="px-3 py-1">
                                <div className="text-[10px] text-slate-600 font-medium">Dist. {c.distrito_nombre || c.distrito || '01'}, {c.municipio_nombre || c.municipio}, {c.departamento_nombre || c.departamento}</div>
                                <div className="text-[9px] text-slate-400 truncate max-w-[150px]">{c.direccion}</div>
                            </td>
                            <td className="px-3 py-1">
                                <div className="text-[10px] font-bold text-indigo-600 uppercase">
                                    {personTypes.find(t => t.code === c.tipo_persona)?.description || 'Natural'}
                                </div>
                                <div className="text-[9px] text-slate-500 font-medium">
                                    {countries.find(t => t.code === c.pais)?.description || 'El Salvador'}
                                </div>
                            </td>
                            <td className="px-3 py-1 min-w-[160px]">
                                <div className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded inline-block">{c.nit || c.numero_documento}</div>
                                <div className="text-[9px] text-slate-400 uppercase font-bold">{c.tipo_documento}</div>
                            </td>
                            <td className="px-3 py-1">
                                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full uppercase ${
                                    c.condicion_fiscal === 'gran contribuyente' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                    {c.condicion_fiscal}
                                </span>
                                {c.actividad_nombre && (
                                    <div className="text-[9px] text-indigo-600 font-bold max-w-[150px] truncate">
                                        {c.actividad_nombre}
                                    </div>
                                )}
                            </td>
                            <td className="px-3 py-1 flex gap-1">
                                <button onClick={() => handleEdit(c)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={15}/></button>
                                <button onClick={() => handleOpenBranches(c)} className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Sucursales"><Building2 size={15}/></button>
                                <button onClick={() => handleDeleteCustomer(c.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15}/></button>
                            </td>
                        </tr>
                    )}
                    renderCard={(c) => (
                        <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <h4 className="text-sm font-bold text-slate-900 truncate">{c.nombre}</h4>
                                    {c.nombre_comercial && <p className="text-xs text-slate-500 truncate">{c.nombre_comercial}</p>}
                                </div>
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase shrink-0 ${
                                    c.condicion_fiscal === 'gran contribuyente' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                    {c.condicion_fiscal}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Documento</span>
                                    <span className="font-mono text-slate-700 font-semibold">{c.nit || c.numero_documento}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Ubicación</span>
                                    <span className="text-slate-600 truncate block">{c.municipio_nombre || c.municipio || 'N/A'}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button 
                                    onClick={() => handleEdit(c)} 
                                    className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-indigo-100"
                                >
                                    <Edit size={14}/> Editar
                                </button>
                                <button 
                                    onClick={() => handleOpenBranches(c)} 
                                    className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-100"
                                >
                                    <Building2 size={14}/> Sucursales
                                </button>
                                <button 
                                    onClick={() => handleDeleteCustomer(c.id)} 
                                    className="px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100"
                                >
                                    <Trash2 size={14}/>
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
                itemsOnPage={customers.length}
                isLoading={isLoading}
                limit={limit}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
            />

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={selectedCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
                maxWidth="max-w-lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Tipo de Persona</label>
                            <select name="tipo_persona" defaultValue={selectedCustomer?.tipo_persona || '1'} className={fieldCls} required>
                                {personTypes.map(t => <option key={t.code} value={t.code}>{t.description}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>País</label>
                            <select name="pais" value={selectedPais} onChange={(e) => setSelectedPais(e.target.value)} className={fieldCls} required>
                                {countries.map(t => <option key={t.code} value={t.code}>{t.description}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Tipo Documento</label>
                            <select 
                                name="tipo_documento" 
                                value={docType} 
                                onChange={(e) => setDocType(e.target.value)}
                                className={fieldCls}
                            >
                                <option value="DUI">DUI</option>
                                <option value="NIT">NIT</option>
                                <option value="Pasaporte">Pasaporte</option>
                                <option value="Carnet Resident">Carnet Residente</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Número Documento</label>
                            <input name="numero_documento" defaultValue={selectedCustomer?.numero_documento} placeholder="00000000-0" className={fieldCls} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>NIT</label>
                            <input 
                                name="nit" 
                                value={nitValue} 
                                onChange={(e) => setNitValue(formatNIT(e.target.value, docType))}
                                placeholder={docType === 'DUI' ? "00000000-0" : "0000-000000-000-0"} 
                                className={fieldCls} 
                                maxLength={docType === 'DUI' ? 10 : 17}
                            />
                        </div>
                        <div>
                            <label className={labelCls}>NRC</label>
                            <input name="nrc" defaultValue={selectedCustomer?.nrc} placeholder="000000-0" className={fieldCls} />
                        </div>
                    </div>
                    <div>
                        <label className={labelCls}>Nombre / Razón Social</label>
                        <input name="nombre" defaultValue={selectedCustomer?.nombre} required className={fieldCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Nombre Comercial</label>
                        <input name="nombre_comercial" defaultValue={selectedCustomer?.nombre_comercial} className={fieldCls} />
                    </div>
                    <div >
                            <label className={labelCls}>Actividad Económica</label>
                            <SearchableSelect 
                                name="codigo_actividad" 
                                options={activities} 
                                value={selectedActivity} 
                                onChange={(e) => setSelectedActivity(e.target.value)}
                                placeholder="Seleccionar actividad"
                            />
                        </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Condición Fiscal</label>
                            <select name="condicion_fiscal" value={condicionFiscal} onChange={(e) => {
                                const val = e.target.value;
                                setCondicionFiscal(val);
                                if (val === 'exento IVA') setExentoIva(true);
                            }} className={fieldCls}>
                                <option value="contribuyente">Contribuyente</option>
                                <option value="gran contribuyente">Gran Contribuyente</option>
                                <option value="exento IVA">Exento IVA</option>
                                <option value="extranjero">Extranjero</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>

                    </div>
                    <div className="w-full flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                        <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
                        <div className="text-[10px] text-slate-500 leading-relaxed">
                            <p><span className="font-bold text-slate-600">Percepción</span> = tú eres el agente de percepción (GC cobrándole a uno pequeño).</p>
                            <p><span className="font-bold text-slate-600">Retención</span> = el cliente es el agente (GC grande reteniéndote a ti).</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Teléfono</label>
                            <input name="telefono" defaultValue={selectedCustomer?.telefono} placeholder="2200-0000" className={fieldCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Correo Electrónico</label>
                            <input name="correo" type="email" defaultValue={selectedCustomer?.correo} placeholder="cliente@ejemplo.com" className={fieldCls} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Departamento</label>
                            <select name="departamento" className={fieldCls} value={selectedDept} onChange={(e) => { setSelectedDept(e.target.value); setSelectedMun(''); setSelectedDistrito(''); }} required>
                                <option value="">Seleccionar</option>
                                {departments?.map(d => <option key={d.code} value={d.code}>{d.description}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Municipio</label>
                            <select name="municipio" value={selectedMun} onChange={(e) => setSelectedMun(e.target.value)} className={fieldCls} required>
                                <option value="">Seleccionar</option>
                                {municipalities?.map(m => <option key={m.code} value={m.code}>{m.description}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Distrito</label>
                            <select name="distrito" value={selectedDistrito} onChange={(e) => setSelectedDistrito(e.target.value)} className={fieldCls} required>
                                <option value="">Seleccionar</option>
                                {distritos?.map(d => <option key={d.code} value={d.code}>{d.description}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className={labelCls}>Dirección Exacta</label>
                        <textarea name="direccion" defaultValue={selectedCustomer?.direccion} required placeholder="Dirección completa..." className={`${fieldCls} h-16 resize-none`} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                            { id: 'exento_iva', label: 'Exento de IVA', checked: exentoIva, onChange: (e) => setExentoIva(e.target.checked) },
                            { id: 'aplica_fovial', label: 'Aplica FOVIAL', default: true },
                            { id: 'aplica_cotrans', label: 'Aplica COTRANS', default: true }
                        ].map(tax => (
                            <label key={tax.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:border-indigo-200 transition-all text-xs font-semibold text-slate-600">
                                <input 
                                    type="checkbox" 
                                    name={tax.id} 
                                    {...(tax.checked !== undefined 
                                        ? { checked: tax.checked, onChange: tax.onChange } 
                                        : { defaultChecked: selectedCustomer ? selectedCustomer[tax.id] : tax.default }
                                    )}
                                    className="accent-indigo-600 w-4 h-4" 
                                />
                                {tax.label}
                            </label>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-200">
                        <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:border-indigo-200 transition-all text-[11px] font-semibold text-slate-600">
                            <input type="checkbox" name="es_credito" checked={esCredito} onChange={e => setEsCredito(e.target.checked)} className="accent-indigo-600 w-4 h-4" />
                            Cliente Crédito (CxC)
                        </label>
                        {esCredito && (
                            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-indigo-100">
                                <label className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">Días de Crédito</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={diasCredito}
                                    onChange={(e) => setDiasCredito(e.target.value)}
                                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm font-semibold"
                                />
                            </div>
                        )}
                        <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:border-indigo-200 transition-all text-[11px] font-semibold text-slate-600">
                            <input type="checkbox" name="es_anticipado" checked={esAnticipado} onChange={e => setEsAnticipado(e.target.checked)} className="accent-indigo-600 w-4 h-4" />
                            Cliente Anticipado (Gasolinera)
                        </label>
                        <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:border-indigo-200 transition-all text-[11px] font-semibold text-slate-600">
                            <input type="checkbox" name="es_trupput" checked={esTrupput} onChange={e => setEsTrupput(e.target.checked)} className="accent-indigo-600 w-4 h-4" />
                            Cliente Trupput (Gasolinera)
                        </label>
                    </div>
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-semibold hover:text-slate-700 transition-colors text-sm">Cancelar</button>
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold transition-all text-sm active:scale-95">
                            {selectedCustomer ? 'Actualizar' : 'Registrar'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Sucursales Modal */}
            <Modal 
                isOpen={isBranchModalOpen} 
                onClose={() => { setIsBranchModalOpen(false); setEditingBranch(null); }}
                title={
                    <span className="flex items-center gap-2 min-w-0">
                        <span className="truncate">Sucursales de {branchCustomer?.nombre || ''}</span>
                        <span className="shrink-0 px-2 py-0.5 text-[10px] font-black uppercase bg-indigo-100 text-indigo-700 rounded-full">{branches.length} sucursal(es)</span>
                    </span>
                }
                maxWidth="max-w-lg"
            >
                <div className="space-y-4">
                    <div className="flex bg-slate-50/50 border border-slate-100 p-1 rounded-lg">
                        <button 
                            type="button"
                            onClick={() => setBranchTab('form')}
                            className={`flex-1 px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-md flex items-center justify-center gap-1.5 ${branchTab === 'form' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Plus size={13}/> Agregar / Editar
                        </button>
                        <button 
                            type="button"
                            onClick={() => setBranchTab('lista')}
                            className={`flex-1 px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-md flex items-center justify-center gap-1.5 ${branchTab === 'lista' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Building2 size={13}/> Listado ({branches.length})
                        </button>
                    </div>

                    <div className="grid">
                        <form onSubmit={handleBranchSubmit} className={`[grid-area:1/1] min-w-0 space-y-3 ${branchTab === 'form' ? '' : 'invisible pointer-events-none'}`}>
                            <h4 className="text-xs font-bold text-slate-500 uppercase">
                                {editingBranch ? 'Editar Sucursal' : 'Nueva Sucursal'}
                            </h4>
                            <div>
                                <label className={labelCls}>Nombre</label>
                                <input name="nombre" defaultValue={editingBranch?.nombre} required placeholder="Nombre de la sucursal" className={fieldCls} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className={labelCls}>Departamento</label>
                                    <select name="departamento" className={fieldCls} value={branchDept} onChange={(e) => { setBranchDept(e.target.value); setBranchMun(''); setBranchDistrito(''); }} required>
                                        <option value="">Seleccionar</option>
                                        {departments?.map(d => <option key={d.code} value={d.code}>{d.description}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Municipio</label>
                                    <select name="municipio" value={branchMun} onChange={(e) => setBranchMun(e.target.value)} className={fieldCls} required>
                                        <option value="">Seleccionar</option>
                                        {branchMunicipalities?.map(m => <option key={m.code} value={m.code}>{m.description}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Distrito</label>
                                    <select name="distrito" value={branchDistrito} onChange={(e) => setBranchDistrito(e.target.value)} className={fieldCls} required>
                                        <option value="">Seleccionar</option>
                                        {branchDistritos?.map(d => <option key={d.code} value={d.code}>{d.description}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Dirección</label>
                                <input name="direccion" defaultValue={editingBranch?.direccion} placeholder="Dirección exacta" className={fieldCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Teléfono</label>
                                <input name="telefono" defaultValue={editingBranch?.telefono} placeholder="2200-0000" className={fieldCls} />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                {editingBranch && (
                                    <button type="button" onClick={() => { setEditingBranch(null); setBranchDept(''); setBranchMun(''); setBranchDistrito(''); }} className="px-3 py-1.5 text-slate-500 font-semibold hover:text-slate-700 transition-colors text-xs">
                                        Cancelar edición
                                    </button>
                                )}
                                <button type="submit" disabled={branchMutations.save.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-bold transition-all text-sm active:scale-95 disabled:opacity-50">
                                    {editingBranch ? 'Actualizar' : 'Agregar'}
                                </button>
                            </div>
                        </form>

                        <div className={`[grid-area:1/1] min-w-0 space-y-3 ${branchTab === 'lista' ? '' : 'invisible pointer-events-none'}`}>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input 
                                    type="text" 
                                    placeholder="Buscar sucursal..." 
                                    value={branchSearch}
                                    onChange={(e) => setBranchSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-medium shadow-sm"
                                />
                            </div>

                            {!branchesLoading && branches.length > 0 && (
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    {filteredBranches.length} de {branches.length} sucursal(es)
                                </p>
                            )}

                            <div className="space-y-2 max-h-72 overflow-y-auto overflow-x-hidden pr-0.5">
                                {filteredBranches.map(b => (
                                    <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 border-slate-100">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-slate-800">{b.nombre}</div>
                                            <div className="text-xs text-slate-500">
                                                Dist. {b.distrito_nombre || b.distrito || '01'}, {b.municipio_nombre || b.municipio}, {b.departamento_nombre || b.departamento}
                                                {b.direccion && ` — ${b.direccion}`}
                                            </div>
                                            {b.telefono && <div className="text-xs text-slate-400">{b.telefono}</div>}
                                        </div>
                                        <div className="flex gap-1 ml-2 shrink-0">
                                            <button type="button" onClick={() => handleEditBranch(b)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={14}/></button>
                                            <button type="button" onClick={() => handleDeleteBranch(b.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                ))}

                                {!branchesLoading && branches.length === 0 && (
                                    <p className="text-center text-slate-400 text-sm py-6">No hay sucursales registradas</p>
                                )}

                                {!branchesLoading && branches.length > 0 && filteredBranches.length === 0 && (
                                    <p className="text-center text-slate-400 text-sm py-6">Sin resultados para "{branchSearch}"</p>
                                )}

                                {branchesLoading && branches.length === 0 && (
                                    <p className="text-center text-slate-400 text-sm py-6">Cargando...</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Customers;
