import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import Table from '../components/ui/Table';
import SearchableSelect from '../components/ui/SearchableSelect';
import { Truck, Plus, Trash2, Search, Save, X, Loader2, Eye, Edit3 } from 'lucide-react';
import { toast } from 'sonner';
import { useDirtyTracker } from '../hooks/useDirtyTracker';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import Money, { MoneyInput } from '../components/ui/Money';

const today = () => new Date().toISOString().split('T')[0];

const PozoDespachos = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const { user } = useAuth();

    const [listSearch, setListSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [listPage, setListPage] = useState(1);

    const [showFormModal, setShowFormModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [numero, setNumero] = useState('');
    const [fecha, setFecha] = useState(today());
    const [encargado, setEncargado] = useState(user?.nombre || '');
    const [cliente, setCliente] = useState('');
    const [placa, setPlaca] = useState('');
    const [horaEntrada, setHoraEntrada] = useState('');
    const [horaSalida, setHoraSalida] = useState('');
    const [odometroInicial, setOdometroInicial] = useState('');
    const [odometroFinal, setOdometroFinal] = useState('');
    const [servicios, setServicios] = useState([]);

    const [showServicioModal, setShowServicioModal] = useState(false);
    const [servicioEditIndex, setServicioEditIndex] = useState(null);
    const [selectedServicioId, setSelectedServicioId] = useState('');
    const [cantidadServicio, setCantidadServicio] = useState('1');
    const [montoServicio, setMontoServicio] = useState('');

    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedDespachoId, setSelectedDespachoId] = useState(null);

    const isEditing = editId !== null;

    useDirtyTracker('pozo-despachos', servicios.length > 0 || cliente);

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(listSearch);
            setListPage(1);
        }, 500);
        return () => clearTimeout(t);
    }, [listSearch]);

    const { data: listData, isLoading: listLoading } = useQuery({
        queryKey: ['pozo-despachos', debouncedSearch, listPage],
        queryFn: async () => (await axios.get('/api/pozo/despachos', {
            params: { page: listPage, limit: 15, search: debouncedSearch || undefined }
        })).data
    });

    const despachos = listData?.data || [];
    const totalDespachos = listData?.total || 0;
    const totalDespachoPages = listData?.totalPages || 0;

    const { data: serviciosCatalogo = [] } = useQuery({
        queryKey: ['pozo-servicios-all'],
        queryFn: async () => (await axios.get('/api/pozo/servicios', { params: { limit: 5000 } })).data?.data || []
    });

    const { data: editData } = useQuery({
        queryKey: ['pozo-despacho-edit', editId],
        queryFn: async () => (await axios.get(`/api/pozo/despachos/${editId}`)).data,
        enabled: !!editId && showFormModal,
        staleTime: 0,
    });

    useEffect(() => {
        if (editData) {
            setNumero(editData.numero || '');
            setFecha(editData.fecha ? editData.fecha.split('T')[0] : today());
            setEncargado(editData.encargado || '');
            setCliente(editData.cliente || '');
            setPlaca(editData.placa || '');
            setHoraEntrada(editData.hora_entrada || '');
            setHoraSalida(editData.hora_salida || '');
            setOdometroInicial(editData.odometro_inicial != null ? String(editData.odometro_inicial) : '');
            setOdometroFinal(editData.odometro_final != null ? String(editData.odometro_final) : '');
            setServicios((editData.servicios || []).map(s => ({
                servicio_id: s.servicio_id,
                cantidad: String(s.cantidad ?? '1'),
                monto: String(s.monto ?? ''),
                codigo: s.servicio_codigo || '',
                descripcion: s.servicio_descripcion || '',
            })));
        }
    }, [editData]);

    const createMutation = useMutation({
        mutationFn: (data) => axios.post('/api/pozo/despachos', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pozo-despachos'] });
            queryClient.invalidateQueries({ queryKey: ['pozo-corte-consultar'] });
            closeForm();
            toast.success('Despacho registrado exitosamente');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al registrar despacho'),
    });

    const updateMutation = useMutation({
        mutationFn: (data) => axios.put(`/api/pozo/despachos/${editId}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pozo-despachos'] });
            queryClient.invalidateQueries({ queryKey: ['pozo-corte-consultar'] });
            closeForm();
            toast.success('Despacho actualizado exitosamente');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al actualizar despacho'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/pozo/despachos/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pozo-despachos'] });
            queryClient.invalidateQueries({ queryKey: ['pozo-corte-consultar'] });
            toast.success('Despacho eliminado');
            if (showDetailModal) setShowDetailModal(false);
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al eliminar despacho'),
    });

    const { data: despachoDetail } = useQuery({
        queryKey: ['pozo-despacho', selectedDespachoId],
        queryFn: async () => (await axios.get(`/api/pozo/despachos/${selectedDespachoId}`)).data,
        enabled: !!selectedDespachoId,
    });

    const isSaving = createMutation.isPending || updateMutation.isPending;

    const resetForm = () => {
        setNumero('');
        setFecha(today());
        setEncargado(user?.nombre || '');
        setCliente('');
        setPlaca('');
        setHoraEntrada('');
        setHoraSalida('');
        setOdometroInicial('');
        setOdometroFinal('');
        setServicios([]);
    };

    const closeForm = () => {
        setShowFormModal(false);
        setEditId(null);
        resetForm();
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

    const openAddServicio = () => {
        setServicioEditIndex(null);
        setSelectedServicioId('');
        setCantidadServicio('1');
        setMontoServicio('');
        setShowServicioModal(true);
    };

    const openEditServicio = (index) => {
        const s = servicios[index];
        if (!s) return;
        setServicioEditIndex(index);
        setSelectedServicioId(String(s.servicio_id));
        setCantidadServicio(s.cantidad);
        setMontoServicio(s.monto);
        setShowServicioModal(true);
    };

    const confirmServicio = () => {
        if (!selectedServicioId) { toast.error('Debe seleccionar un servicio'); return; }
        const cantidad = parseFloat(cantidadServicio) || 0;
        const monto = parseFloat(montoServicio) || 0;
        if (cantidad <= 0) { toast.error('La cantidad debe ser mayor a 0'); return; }
        if (monto <= 0) { toast.error('El monto debe ser mayor a 0'); return; }

        const found = serviciosCatalogo.find(sc => String(sc.id) === String(selectedServicioId));
        const row = {
            servicio_id: selectedServicioId,
            cantidad: String(cantidad),
            monto: String(monto),
            codigo: found?.codigo || '',
            descripcion: found?.descripcion || '',
        };

        setServicios(prev => {
            if (servicioEditIndex !== null) {
                return prev.map((s, i) => (i === servicioEditIndex ? row : s));
            }
            return [...prev, row];
        });
        setShowServicioModal(false);
    };

    const removeServicioRow = (index) => {
        setServicios(prev => prev.filter((_, i) => i !== index));
    };

    const totalDespacho = useMemo(() =>
        servicios.reduce((sum, s) => sum + ((parseFloat(s.cantidad) || 0) * (parseFloat(s.monto) || 0)), 0),
        [servicios]
    );

    const handleSave = () => {
        if (!numero.trim()) { toast.error('El número es requerido'); return; }
        if (!fecha) { toast.error('La fecha es requerida'); return; }

        const items = servicios
            .map(s => ({ servicio_id: s.servicio_id, cantidad: parseFloat(s.cantidad), monto: parseFloat(s.monto) }))
            .filter(s => s.cantidad > 0 && s.monto > 0);

        if (items.length === 0) {
            toast.error('Debe agregar al menos un servicio con cantidad y monto válidos');
            return;
        }

        const payload = {
            numero: numero.trim(),
            fecha,
            encargado: encargado.trim(),
            cliente: cliente.trim(),
            placa: placa.trim(),
            hora_entrada: horaEntrada || null,
            hora_salida: horaSalida || null,
            odometro_inicial: odometroInicial === '' ? null : odometroInicial,
            odometro_final: odometroFinal === '' ? null : odometroFinal,
            servicios: items,
        };

        if (isEditing) {
            updateMutation.mutate(payload);
        } else {
            createMutation.mutate(payload);
        }
    };

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: '¿Eliminar despacho?',
            message: 'Este despacho será eliminado permanentemente.',
            confirmLabel: 'Sí, eliminar',
            variant: 'danger',
        });
        if (ok) deleteMutation.mutate(id);
    };

    const handleViewDetail = (id) => {
        setSelectedDespachoId(id);
        setShowDetailModal(true);
    };

    const fmtDate = (v) => {
        if (!v) return '—';
        return new Date(v).toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const inputCls = "w-full bg-white border border-slate-200 rounded-xl text-[13px] font-medium py-2 px-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all";
    const labelCls = "text-[11px] font-bold text-slate-500 uppercase";

    return (
        <div className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-xl">
                        <Truck size={22} className="text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Despachos</h2>
                        <p className="text-slate-500 text-[11px] font-medium">Control de Pozo — Despachos</p>
                        {user?.branch_name && <p className="text-[10px] font-bold text-indigo-500 mt-0.5">Sucursal: {user.branch_name}</p>}
                    </div>
                </div>
                <button
                    onClick={openNewForm}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={20} />
                    <span>Nuevo Despacho</span>
                </button>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                    type="text"
                    placeholder="Buscar por número, cliente, placa o encargado..."
                    value={listSearch}
                    onChange={(e) => setListSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-medium shadow-sm"
                />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table
                    headers={['Número', 'Fecha', 'Encargado', 'Cliente', 'Placa', 'Servicios', 'Total', 'Acciones']}
                    data={despachos}
                    isLoading={listLoading}
                    renderRow={(item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-3 py-1">
                                <span className="text-xs font-bold font-mono text-indigo-600">{item.numero || '—'}</span>
                            </td>
                            <td className="px-3 py-1">
                                <span className="text-xs font-medium text-slate-800">{fmtDate(item.fecha)}</span>
                            </td>
                            <td className="px-3 py-1 text-xs text-slate-600">{item.encargado || '—'}</td>
                            <td className="px-3 py-1 text-xs text-slate-600">{item.cliente || '—'}</td>
                            <td className="px-3 py-1 text-xs font-mono text-slate-600">{item.placa || '—'}</td>
                            <td className="px-3 py-1">
                                <span className="text-xs font-bold text-slate-800">{item.total_servicios || 0}</span>
                            </td>
                            <td className="px-3 py-1">
                                <span className="text-xs font-bold font-mono text-emerald-600"><Money value={item.monto_total} /></span>
                            </td>
                            <td className="px-3 py-1 flex gap-1">
                                <button onClick={() => handleViewDetail(item.id)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Ver detalle"><Eye size={15} /></button>
                                <button onClick={() => openEditForm(item.id)} className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Editar"><Edit3 size={15} /></button>
                                <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={15} /></button>
                            </td>
                        </tr>
                    )}
                />
                {totalDespachoPages > 1 && (
                    <div className="px-2">
                        <Pagination
                            currentPage={listPage}
                            totalPages={totalDespachoPages}
                            totalItems={totalDespachos}
                            itemsOnPage={despachos.length}
                            onPageChange={setListPage}
                            limit={15}
                        />
                    </div>
                )}
            </div>

            <Modal
                isOpen={showFormModal}
                onClose={() => { if (!isSaving) closeForm(); }}
                title={isEditing ? 'Editar Despacho' : 'Nuevo Despacho'}
                maxWidth="max-w-4xl"
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                            <label className={`${labelCls} block mb-1`}>Número <span className="text-red-400">*</span></label>
                            <input type="text" value={numero} onChange={(e) => setNumero(e.target.value.toUpperCase())} placeholder="Ej: 001" className={inputCls} />
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Fecha <span className="text-red-400">*</span></label>
                            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Encargado</label>
                            <input type="text" value={encargado} onChange={(e) => setEncargado(e.target.value)} placeholder="Nombre del encargado" className={inputCls} />
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Cliente</label>
                            <input type="text" value={cliente} onChange={(e) => setCliente(e.target.value.toUpperCase())} placeholder="Nombre del cliente" className={inputCls} />
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Placa</label>
                            <input type="text" value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} placeholder="Placa del vehículo" className={inputCls} />
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Hora Entrada</label>
                            <input type="time" value={horaEntrada} onChange={(e) => setHoraEntrada(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Hora Salida</label>
                            <input type="time" value={horaSalida} onChange={(e) => setHoraSalida(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Odómetro Inicial</label>
                            <input
                                type="number"
                                value={odometroInicial}
                                onChange={(e) => setOdometroInicial(e.target.value)}
                                placeholder="0"
                                className={inputCls}
                                onWheel={(e) => { e.preventDefault(); e.currentTarget.blur(); }}
                            />
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Odómetro Final</label>
                            <input
                                type="number"
                                value={odometroFinal}
                                onChange={(e) => setOdometroFinal(e.target.value)}
                                placeholder="0"
                                className={inputCls}
                                onWheel={(e) => { e.preventDefault(); e.currentTarget.blur(); }}
                            />
                        </div>
                    </div>

                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                            <label className={labelCls}>Servicios del Despacho</label>
                            <button
                                onClick={openAddServicio}
                                className="flex items-center justify-center gap-1 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-xs rounded-xl border border-indigo-200 transition-all"
                            >
                                <Plus size={13} /> Agregar Servicio
                            </button>
                        </div>

                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-left border-separate border-spacing-0">
                                <thead>
                                    <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="px-3 py-2 bg-slate-50 border-b border-slate-100 min-w-[180px]">Servicio</th>
                                        <th className="px-3 py-2 bg-slate-50 border-b border-slate-100 w-24">Cantidad</th>
                                        <th className="px-3 py-2 bg-slate-50 border-b border-slate-100 w-28">Monto</th>
                                        <th className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-right w-28">Subtotal</th>
                                        <th className="px-3 py-2 bg-slate-50 border-b border-slate-100 w-20"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {servicios.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-3 py-10 text-center text-xs text-slate-400">
                                                No hay servicios agregados. Use "+ Agregar Servicio".
                                            </td>
                                        </tr>
                                    )}
                                    {servicios.map((s, i) => {
                                        const subtotal = (parseFloat(s.cantidad) || 0) * (parseFloat(s.monto) || 0);
                                        return (
                                            <tr key={i} className="text-[12px] hover:bg-slate-50 transition-colors">
                                                <td className="px-3 py-2">
                                                    <div className="text-[13px] font-semibold text-slate-800">{s.codigo || '—'}</div>
                                                    <div className="text-[11px] text-slate-500">{s.descripcion || ''}</div>
                                                </td>
                                                <td className="px-3 py-2 text-[13px] font-medium">{s.cantidad}</td>
                                                <td className="px-3 py-2"><Money value={parseFloat(s.monto) || 0} /></td>
                                                <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600"><Money value={subtotal} /></td>
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button onClick={() => openEditServicio(i)} className="p-1 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all" title="Editar"><Edit3 size={14} /></button>
                                                        <button onClick={() => removeServicioRow(i)} className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Eliminar"><X size={14} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                {servicios.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-slate-50">
                                            <td colSpan={3} className="px-3 py-2 text-[11px] font-bold text-slate-600 text-right">Total: {servicios.length} servicio(s)</td>
                                            <td className="px-3 py-2 text-right font-mono font-bold text-lg text-indigo-600"><Money value={totalDespacho} /></td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={closeForm} className="px-4 py-2 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm">Cancelar</button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {isSaving ? 'Guardando...' : (isEditing ? 'Actualizar Despacho' : 'Guardar Despacho')}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showServicioModal} onClose={() => setShowServicioModal(false)} title={servicioEditIndex !== null ? 'Editar Servicio' : 'Agregar Servicio'} maxWidth="max-w-2xl">
                <div className="space-y-4">
                    <div>
                        <label className={`${labelCls} block mb-1`}>Servicio</label>
                        <SearchableSelect
                            options={serviciosCatalogo}
                            value={selectedServicioId}
                            onChange={(e, opt) => {
                                setSelectedServicioId(e.target.value);
                                setMontoServicio(opt?.monto != null ? String(opt.monto) : '');
                            }}
                            placeholder="Buscar servicio por código o descripción..."
                            valueKey="id"
                            labelKey="descripcion"
                            codeKey="codigo"
                            codeLabel="CÓDIGO"
                            dropdownWidth={480}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={`${labelCls} block mb-1`}>Cantidad</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={cantidadServicio}
                                onChange={(e) => setCantidadServicio(e.target.value)}
                                className={inputCls}
                                onWheel={(e) => { e.preventDefault(); e.currentTarget.blur(); }}
                            />
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Monto</label>
                            <MoneyInput
                                value={montoServicio}
                                onChange={(e) => setMontoServicio(e.target.value)}
                                placeholder="0.00"
                                className={inputCls}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-1">
                        <button type="button" onClick={() => setShowServicioModal(false)} className="px-4 py-2 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm">Cancelar</button>
                        <button
                            onClick={confirmServicio}
                            disabled={!selectedServicioId || !(parseFloat(cantidadServicio) > 0) || !(parseFloat(montoServicio) > 0)}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                        >
                            {servicioEditIndex !== null ? <Save size={16} /> : <Plus size={16} />}
                            {servicioEditIndex !== null ? 'Actualizar Servicio' : 'Agregar al Despacho'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showDetailModal} onClose={() => { setShowDetailModal(false); setSelectedDespachoId(null); }} title="Detalle de Despacho" maxWidth="max-w-3xl">
                {despachoDetail && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-xl">
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase block">Número</span>
                                <span className="text-[13px] font-medium font-mono text-indigo-600">{despachoDetail.numero || '—'}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase block">Fecha</span>
                                <span className="text-[13px] font-medium">{fmtDate(despachoDetail.fecha)}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase block">Encargado</span>
                                <span className="text-[13px] font-medium">{despachoDetail.encargado || '—'}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase block">Cliente</span>
                                <span className="text-[13px] font-medium">{despachoDetail.cliente || '—'}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase block">Placa</span>
                                <span className="text-[13px] font-medium font-mono">{despachoDetail.placa || '—'}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase block">Hora Entrada</span>
                                <span className="text-[13px] font-medium font-mono">{despachoDetail.hora_entrada || '—'}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase block">Hora Salida</span>
                                <span className="text-[13px] font-medium font-mono">{despachoDetail.hora_salida || '—'}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase block">Odómetro Ini / Fin</span>
                                <span className="text-[13px] font-medium font-mono">
                                    {despachoDetail.odometro_inicial ?? '—'} / {despachoDetail.odometro_final ?? '—'}
                                </span>
                            </div>
                        </div>

                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-left border-separate border-spacing-0">
                                <thead>
                                    <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="px-3 py-2 bg-slate-50 border-b border-slate-100">Código</th>
                                        <th className="px-3 py-2 bg-slate-50 border-b border-slate-100">Servicio</th>
                                        <th className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-right">Cantidad</th>
                                        <th className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-right">Monto</th>
                                        <th className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {despachoDetail.servicios?.map(r => (
                                        <tr key={r.id} className="text-[12px]">
                                            <td className="px-3 py-2 font-mono font-bold text-[11px] text-indigo-600">{r.servicio_codigo || '—'}</td>
                                            <td className="px-3 py-2 font-medium text-slate-800">{r.servicio_descripcion || '—'}</td>
                                            <td className="px-3 py-2 text-right font-mono text-slate-600">{r.cantidad}</td>
                                            <td className="px-3 py-2 text-right font-mono text-slate-600"><Money value={r.monto} /></td>
                                            <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600"><Money value={r.subtotal} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50">
                                        <td colSpan={4} className="px-3 py-2 text-[11px] font-bold text-slate-600 text-right">Total</td>
                                        <td className="px-3 py-2 text-right font-mono font-bold text-lg text-indigo-600"><Money value={despachoDetail.monto_total} /></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default PozoDespachos;
