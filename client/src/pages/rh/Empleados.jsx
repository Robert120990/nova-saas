import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { useConfirm } from '../../context/ConfirmContext';
import { toast } from 'sonner';
import { IMaskInput } from 'react-imask';
import { MoneyInput } from '../../components/ui/Money';
import {
    Plus, Edit, Trash2, Search,
    UserCircle, Briefcase, Wallet, ScrollText, CalendarX, Loader2
} from 'lucide-react';

const TABS = [
    { id: 'personal', label: 'Información Personal', icon: <UserCircle size={14} /> },
    { id: 'laboral', label: 'Datos Laborales', icon: <Briefcase size={14} /> },
    { id: 'descuentos', label: 'Descuentos Programados', icon: <Wallet size={14} /> },
    { id: 'indemnizaciones', label: 'Indemnizaciones', icon: <ScrollText size={14} /> },
    { id: 'ausencias', label: 'Faltas / Inasistencias', icon: <CalendarX size={14} /> },
];

const fmtDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return String(dateStr);
        const d = date.getUTCDate().toString().padStart(2, '0');
        const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
        const y = date.getUTCFullYear();
        return `${d}/${m}/${y}`;
    } catch (e) { return String(dateStr); }
};

const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm";
const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

const Empleados = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const [nextCode, setNextCode] = useState('');
    const [activeTab, setActiveTab] = useState('personal');
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedMun, setSelectedMun] = useState('');
    const [selectedDistrito, setSelectedDistrito] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [emergencyContacts, setEmergencyContacts] = useState([]);
    const [showEmergencyForm, setShowEmergencyForm] = useState(false);
    const [editEmergency, setEditEmergency] = useState(null);
    const [emergencyForm, setEmergencyForm] = useState({ nombre: '', telefono: '', parentesco: '' });

    useEffect(() => {
        const timer = setTimeout(() => { setDebouncedSearch(searchTerm); setPage(1); }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: response = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['rh-empleados', debouncedSearch, page],
        queryFn: async () => (await axios.get('/api/rh/empleados', { params: { search: debouncedSearch, page } })).data
    });

    const items = response.data || [];

    const { data: cargos = [] } = useQuery({
        queryKey: ['rh-cargos-all'],
        queryFn: async () => (await axios.get('/api/rh/cargos', { params: { limit: 5000 } })).data?.data || []
    });

    const { data: departamentos = [] } = useQuery({
        queryKey: ['rh-departamentos-all'],
        queryFn: async () => (await axios.get('/api/rh/departamentos', { params: { limit: 5000 } })).data?.data || []
    });

    const { data: afps = [] } = useQuery({
        queryKey: ['rh-afps-all'],
        queryFn: async () => (await axios.get('/api/rh/afps', { params: { limit: 5000 } })).data?.data || []
    });

    const { data: tiposContrato = [] } = useQuery({
        queryKey: ['rh-tipos-contrato-all'],
        queryFn: async () => (await axios.get('/api/rh/tipos-contrato', { params: { limit: 5000 } })).data?.data || []
    });

    const { data: descuentosCatalogo = [] } = useQuery({
        queryKey: ['rh-descuentos-programados-all'],
        queryFn: async () => (await axios.get('/api/rh/descuentos-programados', { params: { limit: 5000 } })).data?.data || []
    });

    const { data: departments = [] } = useQuery({
        queryKey: ['catalogs', 'departments'],
        queryFn: async () => (await axios.get('/api/catalogs/departments')).data
    });

    const { data: municipalities = [] } = useQuery({
        queryKey: ['catalogs', 'municipalities', selectedDept],
        queryFn: async () => (await axios.get(`/api/catalogs/municipalities?dep_code=${selectedDept}`)).data,
        enabled: !!selectedDept
    });

    const { data: distritos = [] } = useQuery({
        queryKey: ['catalogs', 'distritos', selectedDept],
        queryFn: async () => (await axios.get(`/api/catalogs/districts?dep_code=${selectedDept}`)).data,
        enabled: !!selectedDept
    });

    // Sub-resources (only when editing)
    const { data: descuentosAsignados = [], refetch: refetchDescuentos } = useQuery({
        queryKey: ['rh-empleado-descuentos', selected?.id],
        queryFn: async () => (await axios.get(`/api/rh/empleados/${selected.id}/descuentos`)).data,
        enabled: !!selected?.id
    });

    const { data: historialIndemnizaciones = [] } = useQuery({
        queryKey: ['rh-empleado-historial-indemnizaciones', selected?.id],
        queryFn: async () => (await axios.get(`/api/rh/empleados/${selected.id}/historial-indemnizaciones`)).data,
        enabled: !!selected?.id
    });

    const { data: ausencias = [], refetch: refetchAusencias } = useQuery({
        queryKey: ['rh-empleado-ausencias', selected?.id],
        queryFn: async () => (await axios.get(`/api/rh/empleados/${selected.id}/ausencias`)).data,
        enabled: !!selected?.id
    });

    const mutation = useMutation({
        mutationFn: (data) => {
            if (selected) return axios.put(`/api/rh/empleados/${selected.id}`, data);
            return axios.post('/api/rh/empleados', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rh-empleados'] });
            setIsModalOpen(false);
            setSelected(null);
            toast.success(selected ? 'Empleado actualizado' : 'Empleado creado');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al guardar empleado');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/rh/empleados/${id}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rh-empleados'] }); toast.success('Empleado eliminado'); },
        onError: (error) => { toast.error(error.response?.data?.message || 'Error al eliminar'); }
    });

    const descuentoMutation = useMutation({
        mutationFn: ({ data, editId }) => {
            if (editId) return axios.put(`/api/rh/empleados/${selected.id}/descuentos/${editId}`, data);
            return axios.post(`/api/rh/empleados/${selected.id}/descuentos`, data);
        },
        onSuccess: () => { refetchDescuentos(); toast.success('Descuento guardado'); },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar descuento')
    });

    const deleteDescuentoMutation = useMutation({
        mutationFn: (did) => axios.delete(`/api/rh/empleados/${selected.id}/descuentos/${did}`),
        onSuccess: () => { refetchDescuentos(); toast.success('Descuento eliminado'); },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al eliminar descuento')
    });

    const ausenciaMutation = useMutation({
        mutationFn: ({ data, editId }) => {
            if (editId) return axios.put(`/api/rh/empleados/${selected.id}/ausencias/${editId}`, data);
            return axios.post(`/api/rh/empleados/${selected.id}/ausencias`, data);
        },
        onSuccess: () => { refetchAusencias(); toast.success('Ausencia registrada'); },
        onError: (error) => { toast.error(error.response?.data?.message || 'Error al guardar ausencia'); }
    });

    const deleteAusenciaMutation = useMutation({
        mutationFn: (aid) => axios.delete(`/api/rh/empleados/${selected.id}/ausencias/${aid}`),
        onSuccess: () => { refetchAusencias(); toast.success('Ausencia eliminada'); },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al eliminar ausencia')
    });

    const handleDelete = async (id) => {
        const ok = await confirm({ title: '¿Eliminar empleado?', message: 'Este empleado será eliminado permanentemente.', confirmLabel: 'Sí, eliminar', variant: 'danger' });
        if (ok) deleteMutation.mutate(id);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        data.sueldo_base = parseFloat(data.sueldo_base) || 0;
        data.bonificacion_fija = parseFloat(data.bonificacion_fija) || 0;
        data.es_activo = data.es_activo === 'on' || data.es_activo === '1' ? 1 : 0;
        data.es_jubilado = data.es_jubilado === 'on' || data.es_jubilado === '1' ? 1 : 0;
        data.en_vacaciones = data.en_vacaciones === 'on' || data.en_vacaciones === '1' ? 1 : 0;
        data.incapacitado = data.incapacitado === 'on' || data.incapacitado === '1' ? 1 : 0;

        ['afp_id', 'cargo_id', 'departamento_personal_id', 'tipo_contrato_id'].forEach(k => {
            if (data[k] === '' || data[k] === 'null') data[k] = null;
        });

        data.emergency_contacts = emergencyContacts;

        mutation.mutate(data);
    };

    const resetEmergencyForm = () => {
        setEmergencyForm({ nombre: '', telefono: '', parentesco: '' });
        setEditEmergency(null);
        setShowEmergencyForm(false);
    };

    const handleEditEmergency = (idx) => {
        const item = emergencyContacts[idx];
        if (!item) return;
        setEditEmergency(idx);
        setEmergencyForm({ nombre: item.nombre, telefono: item.telefono, parentesco: item.parentesco || '' });
        setShowEmergencyForm(true);
    };

    const handleSaveEmergency = () => {
        if (!emergencyForm.nombre || !emergencyForm.telefono) {
            toast.error('Nombre y teléfono son requeridos');
            return;
        }
        if (editEmergency !== null) {
            setEmergencyContacts(prev => prev.map((c, i) =>
                i === editEmergency ? { nombre: emergencyForm.nombre, telefono: emergencyForm.telefono, parentesco: emergencyForm.parentesco } : c
            ));
            toast.success('Contacto actualizado');
        } else {
            setEmergencyContacts(prev => [...prev, { nombre: emergencyForm.nombre, telefono: emergencyForm.telefono, parentesco: emergencyForm.parentesco }]);
            toast.success('Contacto agregado');
        }
        resetEmergencyForm();
    };

    const handleDeleteEmergency = (idx) => {
        setEmergencyContacts(prev => prev.filter((_, i) => i !== idx));
    };

    const parseEmergencyContacts = (raw) => {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
    };

    const handleEdit = (item) => {
        setSelected(item);
        setEmergencyContacts(parseEmergencyContacts(item.emergency_contacts));
        setSelectedDept(item.departamento || '');
        setSelectedMun(item.municipio || '');
        setSelectedDistrito(item.distrito || '');
        setActiveTab('personal');
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-3 text-slate-900">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Empleados</h2>
                    <p className="text-slate-500 text-[11px] font-medium">Gestión de recursos humanos</p>
                </div>
                <button
                    onClick={async () => {
                        setSelected(null);
                        setEmergencyContacts([]);
                        setSelectedDept(''); setSelectedMun(''); setSelectedDistrito('');
                        setActiveTab('personal');
                        try {
                            const res = await axios.get('/api/rh/empleados/next-code');
                            setNextCode(res.data.codigo);
                        } catch { setNextCode(''); }
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={20} /><span>Nuevo Empleado</span>
                </button>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-medium shadow-sm" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table headers={['Código', 'Nombre', 'DUI', 'Cargo', 'Departamento', 'Estado', 'Acciones']} data={items} isLoading={isLoading} renderRow={(item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                        <td className="px-3 py-1">
                            <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{item.codigo}</span>
                        </td>
                        <td className="px-3 py-1">
                            <div className="text-xs font-bold text-slate-900">{item.nombres} {item.apellidos}</div>
                        </td>
                        <td className="px-3 py-1 text-[10px] font-mono text-slate-500">{item.num_dui}</td>
                        <td className="px-3 py-1 text-xs text-slate-600">{item.cargo_nombre || <span className="text-slate-300 italic">Sin cargo</span>}</td>
                        <td className="px-3 py-1 text-xs text-slate-600">{item.departamento_nombre || <span className="text-slate-300 italic">Sin depto.</span>}</td>
                        <td className="px-3 py-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.es_activo ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                {item.es_activo ? 'Activo' : 'Inactivo'}
                            </span>
                        </td>
                        <td className="px-3 py-1 flex gap-1">
                            <button onClick={() => handleEdit(item)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={15} /></button>
                            <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                        </td>
                    </tr>
                )} />
            </div>

            <Pagination currentPage={page} totalPages={response.totalPages} totalItems={response.total} onPageChange={setPage} itemsOnPage={items.length} isLoading={isLoading} />

            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelected(null); setNextCode(''); setEmergencyContacts([]); setSelectedDept(''); setSelectedMun(''); setSelectedDistrito(''); }} title={selected ? 'Editar Empleado' : 'Nuevo Empleado'} maxWidth="max-w-5xl">
                <form onSubmit={handleSubmit} className="space-y-6 pb-4">
                    {selected && (
                        <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 mb-2 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs uppercase">
                                {selected.nombres?.substring(0, 1)}{selected.apellidos?.substring(0, 1)}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Editando Empleado</span>
                                <span className="text-sm font-bold text-slate-700 leading-none">{selected.nombres} {selected.apellidos}</span>
                            </div>
                        </div>
                    )}

                    <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                    activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="min-h-[400px] relative">
                        {/* TAB 1: Información Personal */}
                        <div className={`space-y-4 animate-in fade-in slide-in-from-left-2 duration-200 ${activeTab === 'personal' ? '' : 'hidden'}`}>
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                <UserCircle size={16} className="text-indigo-600" />
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Información Personal</h3>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className={labelCls}>Código</label>
                                    <input name="codigo" defaultValue={selected?.codigo || nextCode} placeholder="0001" className={fieldCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Nombres</label>
                                    <input name="nombres" defaultValue={selected?.nombres} required placeholder="Nombres" className={fieldCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Apellidos</label>
                                    <input name="apellidos" defaultValue={selected?.apellidos} required placeholder="Apellidos" className={fieldCls} />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className={labelCls}>Fecha de Nacimiento</label>
                                    <input name="fecha_nacimiento" type="date" defaultValue={selected?.fecha_nacimiento ? selected.fecha_nacimiento.substring(0, 10) : ''} className={fieldCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>N° DUI</label>
                                    <IMaskInput
                                        mask="00000000-0"
                                        name="num_dui"
                                        defaultValue={selected?.num_dui || ''}
                                        placeholder="00000000-0"
                                        className={fieldCls}
                                        lazy={false}
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>N° NIT</label>
                                    <IMaskInput
                                        mask="0000-000000-000-0"
                                        name="num_nit"
                                        defaultValue={selected?.num_nit || ''}
                                        placeholder="0000-000000-000-0"
                                        className={fieldCls}
                                        lazy={false}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className={labelCls}>AFP</label>
                                    <select name="afp_id" defaultValue={selected?.afp_id || ''} className={fieldCls}>
                                        <option value="">Seleccionar...</option>
                                        {afps.map(a => <option key={a.id} value={a.id}>{a.codigo} - {a.descripcion}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Ocupación</label>
                                    <input name="ocupacion" defaultValue={selected?.ocupacion || ''} placeholder="Ocupación" className={fieldCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Teléfono</label>
                                    <input name="telefono" defaultValue={selected?.telefono || ''} placeholder="Teléfono" className={fieldCls} />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className={labelCls}>Departamento</label>
                                    <select name="departamento" value={selectedDept} onChange={e => { setSelectedDept(e.target.value); setSelectedMun(''); setSelectedDistrito(''); }} className={fieldCls} required>
                                        <option value="">Seleccionar</option>
                                        {departments?.map(d => <option key={d.code} value={d.code}>{d.description}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Municipio</label>
                                    <select name="municipio" value={selectedMun} onChange={e => setSelectedMun(e.target.value)} className={fieldCls} required>
                                        <option value="">Seleccionar</option>
                                        {municipalities?.map(m => <option key={m.code} value={m.code}>{m.description}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Distrito</label>
                                    <select name="distrito" value={selectedDistrito} onChange={e => setSelectedDistrito(e.target.value)} className={fieldCls} required>
                                        <option value="">Seleccionar</option>
                                        {distritos?.map(d => <option key={d.code} value={d.code}>{d.description}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Dirección</label>
                                <textarea name="direccion" defaultValue={selected?.direccion || ''} placeholder="Dirección" className={`${fieldCls} h-16 resize-none`} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Correo Electrónico</label>
                                    <input name="correo" type="email" defaultValue={selected?.correo || ''} placeholder="correo@ejemplo.com" className={fieldCls} />
                                </div>
                            </div>
                            <div className="border-t border-slate-100 pt-4 mt-2">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <UserCircle size={14} className="text-amber-500" />
                                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Contactos de Emergencia</h4>
                                    </div>
                                    {!showEmergencyForm && (
                                        <button type="button" onClick={() => { setEmergencyForm({ nombre: '', telefono: '', parentesco: '' }); setEditEmergency(null); setShowEmergencyForm(true); }} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700">
                                            <Plus size={12} /> Agregar
                                        </button>
                                    )}
                                </div>

                                {showEmergencyForm && (
                                    <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200 space-y-2 mb-3">
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className={labelCls}>Nombre</label>
                                                <input value={emergencyForm.nombre} onChange={e => setEmergencyForm({ ...emergencyForm, nombre: e.target.value })} placeholder="Nombre completo" className={fieldCls} />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Teléfono</label>
                                                <input value={emergencyForm.telefono} onChange={e => setEmergencyForm({ ...emergencyForm, telefono: e.target.value })} placeholder="Teléfono" className={fieldCls} />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Parentesco</label>
                                                <input value={emergencyForm.parentesco} onChange={e => setEmergencyForm({ ...emergencyForm, parentesco: e.target.value })} placeholder="Ej: Esposa, Madre" className={fieldCls} />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button type="button" onClick={resetEmergencyForm} className="px-3 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-700">Cancelar</button>
                                            <button type="button" onClick={handleSaveEmergency} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold">
                                                {editEmergency !== null ? 'Actualizar' : 'Agregar'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {emergencyContacts.length === 0 && !showEmergencyForm && (
                                    <p className="text-[11px] text-slate-400 italic">Sin contactos de emergencia registrados</p>
                                )}

                                {emergencyContacts.length > 0 && (
                                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                        <table className="w-full text-[11px]">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200">
                                                    <th className="text-left px-2 py-1.5 font-bold text-slate-500 uppercase text-[10px]">Nombre</th>
                                                    <th className="text-left px-2 py-1.5 font-bold text-slate-500 uppercase text-[10px]">Teléfono</th>
                                                    <th className="text-left px-2 py-1.5 font-bold text-slate-500 uppercase text-[10px]">Parentesco</th>
                                                    <th className="px-2 py-1.5 font-bold text-slate-500 uppercase text-[10px] w-16">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {emergencyContacts.map((c, idx) => (
                                                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                                        <td className="px-2 py-1.5 font-medium text-slate-700">{c.nombre}</td>
                                                        <td className="px-2 py-1.5 text-slate-600">{c.telefono}</td>
                                                        <td className="px-2 py-1.5 text-slate-500">{c.parentesco || <span className="text-slate-300">-</span>}</td>
                                                        <td className="px-2 py-1.5 flex gap-1">
                                                            <button type="button" onClick={() => handleEditEmergency(idx)} className="p-1 text-slate-400 hover:text-indigo-600 rounded"><Edit size={13} /></button>
                                                            <button type="button" onClick={() => handleDeleteEmergency(idx)} className="p-1 text-slate-400 hover:text-red-600 rounded"><Trash2 size={13} /></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* TAB 2: Datos Laborales */}
                        <div className={`space-y-4 animate-in fade-in slide-in-from-left-2 duration-200 ${activeTab === 'laboral' ? '' : 'hidden'}`}>
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                <Briefcase size={16} className="text-indigo-600" />
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Datos Laborales</h3>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className={labelCls}>Cargo</label>
                                    <select name="cargo_id" defaultValue={selected?.cargo_id || ''} className={fieldCls}>
                                        <option value="">Seleccionar...</option>
                                        {cargos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.descripcion}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Departamento de Personal</label>
                                    <select name="departamento_personal_id" defaultValue={selected?.departamento_personal_id || ''} className={fieldCls}>
                                        <option value="">Seleccionar...</option>
                                        {departamentos.map(d => <option key={d.id} value={d.id}>{d.codigo} - {d.descripcion}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Tipo de Contrato</label>
                                    <select name="tipo_contrato_id" defaultValue={selected?.tipo_contrato_id || ''} className={fieldCls}>
                                        <option value="">Seleccionar...</option>
                                        {tiposContrato.map(tc => <option key={tc.id} value={tc.id}>{tc.codigo} - {tc.descripcion}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className={labelCls}>N° ISSS</label>
                                    <input name="num_isss" defaultValue={selected?.num_isss || ''} placeholder="N° ISSS" className={fieldCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>N° NUP</label>
                                    <input name="num_nup" defaultValue={selected?.num_nup || ''} placeholder="N° NUP" className={fieldCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Fecha de Ingreso</label>
                                    <input name="fecha_ingreso" type="date" defaultValue={selected?.fecha_ingreso ? selected.fecha_ingreso.substring(0, 10) : ''} className={fieldCls} />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className={labelCls}>Sueldo Base</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                                        <input name="sueldo_base" type="number" step="0.01" defaultValue={selected?.sueldo_base || 0} className={`${fieldCls} pl-7`} />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Bonificación Fija</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                                        <input name="bonificacion_fija" type="number" step="0.01" defaultValue={selected?.bonificacion_fija || 0} className={`${fieldCls} pl-7`} />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Cuenta Planillera</label>
                                    <input name="cuenta_planillera" defaultValue={selected?.cuenta_planillera || ''} placeholder="Cuenta bancaria" className={fieldCls} />
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-3">
                                <label className="flex items-center gap-2 p-2.5 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-200 transition-colors">
                                    <input type="checkbox" name="es_activo" defaultChecked={selected ? !!selected.es_activo : true} className="rounded text-indigo-600" />
                                    <span className="text-xs font-bold text-slate-600">Activo</span>
                                </label>
                                <label className="flex items-center gap-2 p-2.5 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-200 transition-colors">
                                    <input type="checkbox" name="es_jubilado" defaultChecked={!!selected?.es_jubilado} className="rounded text-indigo-600" />
                                    <span className="text-xs font-bold text-slate-600">Jubilado</span>
                                </label>
                                <label className="flex items-center gap-2 p-2.5 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-200 transition-colors">
                                    <input type="checkbox" name="en_vacaciones" defaultChecked={!!selected?.en_vacaciones} className="rounded text-indigo-600" />
                                    <span className="text-xs font-bold text-slate-600">En Vacaciones</span>
                                </label>
                                <label className="flex items-center gap-2 p-2.5 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-200 transition-colors">
                                    <input type="checkbox" name="incapacitado" defaultChecked={!!selected?.incapacitado} className="rounded text-indigo-600" />
                                    <span className="text-xs font-bold text-slate-600">Incapacitado</span>
                                </label>
                            </div>
                            <div>
                                <label className={labelCls}>Comentarios</label>
                                <textarea name="comentarios" defaultValue={selected?.comentarios || ''} placeholder="Notas adicionales..." className={`${fieldCls} h-16 resize-none`} />
                            </div>
                        </div>

                        {/* TAB 3: Descuentos Programados */}
                        <DescuentosTab
                            visible={activeTab === 'descuentos'}
                            selected={selected}
                            descuentosAsignados={descuentosAsignados}
                            descuentosCatalogo={descuentosCatalogo}
                            descuentoMutation={descuentoMutation}
                            deleteDescuentoMutation={deleteDescuentoMutation}
                        />

                        {/* TAB 4: Indemnizaciones (solo consulta) */}
                        <IndemnizacionesTab
                            visible={activeTab === 'indemnizaciones'}
                            selected={selected}
                            historial={historialIndemnizaciones}
                        />

                        {/* TAB 5: Ausencias */}
                        <AusenciasTab
                            visible={activeTab === 'ausencias'}
                            selected={selected}
                            ausencias={ausencias}
                            ausenciaMutation={ausenciaMutation}
                            deleteAusenciaMutation={deleteAusenciaMutation}
                            refetch={refetchAusencias}
                        />
                    </div>

                    {/* Only show save button for tabs 1-2 (main form) */}
                    {(activeTab === 'personal' || activeTab === 'laboral') && (
                        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                            <button type="button" onClick={() => { setIsModalOpen(false); setSelected(null); setNextCode(''); setEmergencyContacts([]); resetEmergencyForm(); setSelectedDept(''); setSelectedMun(''); setSelectedDistrito(''); }} className="px-5 py-2.5 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm">Cancelar</button>
                            <button type="submit" disabled={mutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50">
                                {mutation.isPending ? <><Loader2 size={14} className="animate-spin inline mr-1" />Guardando...</> : (selected ? 'Guardar Cambios' : 'Registrar Empleado')}
                            </button>
                        </div>
                    )}
                </form>
            </Modal>
        </div>
    );
};

// --- Sub-component: Descuentos Programados ---
const DescuentosTab = ({ visible, selected, descuentosAsignados, descuentosCatalogo, descuentoMutation, deleteDescuentoMutation }) => {
    const [showForm, setShowForm] = useState(false);
    const [editDescuento, setEditDescuento] = useState(null);
    const [formData, setFormData] = useState({ descuento_id: '', quincena: 'primera', valor: 0, numero_cuotas: 1, cuotas_restantes: 1, numero_credito: '' });

    const resetForm = () => {
        setFormData({ descuento_id: '', quincena: 'primera', valor: 0, numero_cuotas: 1, cuotas_restantes: 1, numero_credito: '' });
        setEditDescuento(null);
        setShowForm(false);
    };

    const handleEdit = (item) => {
        setEditDescuento(item);
        setFormData({
            descuento_id: item.descuento_id,
            quincena: item.quincena,
            valor: item.valor,
            numero_cuotas: item.numero_cuotas,
            cuotas_restantes: item.cuotas_restantes,
            numero_credito: item.numero_credito || ''
        });
        setShowForm(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        descuentoMutation.mutate({ data: formData, editId: editDescuento?.id }, { onSuccess: () => resetForm() });
    };

    const handleDelete = async (item) => {
        const ok = await confirm({ title: '¿Eliminar descuento?', message: 'Se quitará este descuento del empleado.', confirmLabel: 'Sí, eliminar', variant: 'danger' });
        if (ok) deleteDescuentoMutation.mutate(item.id);
    };

    if (!visible) return null;

    if (!selected) {
        return (
            <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                <Wallet size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-400">Guarda el empleado primero para asignar descuentos</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                    <Wallet size={16} className="text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Descuentos Programados</h3>
                </div>
                {!showForm && (
                    <button type="button" onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700">
                        <Plus size={14} /> Agregar Descuento
                    </button>
                )}
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className={labelCls}>Descuento</label>
                            <select value={formData.descuento_id} onChange={e => setFormData({ ...formData, descuento_id: e.target.value })} required className={fieldCls}>
                                <option value="">Seleccionar...</option>
                                {descuentosCatalogo.map(d => <option key={d.id} value={d.id}>{d.codigo} - {d.descripcion}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Quincena</label>
                            <select value={formData.quincena} onChange={e => setFormData({ ...formData, quincena: e.target.value })} className={fieldCls}>
                                <option value="primera">Primera</option>
                                <option value="segunda">Segunda</option>
                                <option value="ambas">Ambas</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Valor</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                                <MoneyInput step="0.01" value={formData.valor} onChange={e => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })} required className={`${fieldCls} pl-7`} />
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className={labelCls}>N° Cuotas</label>
                            <input type="number" value={formData.numero_cuotas} onChange={e => setFormData({ ...formData, numero_cuotas: parseInt(e.target.value) || 1 })} className={fieldCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Cuotas Restantes</label>
                            <input type="number" value={formData.cuotas_restantes} onChange={e => setFormData({ ...formData, cuotas_restantes: parseInt(e.target.value) || 1 })} className={fieldCls} />
                        </div>
                        <div>
                            <label className={labelCls}>N° Crédito</label>
                            <input type="text" value={formData.numero_credito} onChange={e => setFormData({ ...formData, numero_credito: e.target.value })} placeholder="N° crédito" className={fieldCls} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={resetForm} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700">Cancelar</button>
                        <button type="submit" disabled={descuentoMutation.isPending} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold disabled:opacity-50">
                            {descuentoMutation.isPending ? 'Guardando...' : (editDescuento ? 'Actualizar' : 'Agregar')}
                        </button>
                    </div>
                </form>
            )}

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-3 py-2 font-bold text-slate-500 uppercase text-[10px]">Descuento</th>
                            <th className="text-left px-3 py-2 font-bold text-slate-500 uppercase text-[10px]">Quincena</th>
                            <th className="text-right px-3 py-2 font-bold text-slate-500 uppercase text-[10px]">Valor</th>
                            <th className="text-center px-3 py-2 font-bold text-slate-500 uppercase text-[10px]">Cuotas</th>
                            <th className="text-center px-3 py-2 font-bold text-slate-500 uppercase text-[10px]">Restantes</th>
                            <th className="text-left px-3 py-2 font-bold text-slate-500 uppercase text-[10px]">N° Crédito</th>
                            <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px]">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {descuentosAsignados.length === 0 ? (
                            <tr><td colSpan={7} className="text-center py-8 text-slate-400 italic">Sin descuentos asignados</td></tr>
                        ) : descuentosAsignados.map(d => (
                            <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-2 font-bold text-slate-700">{d.descuento_nombre || d.descuento_codigo}</td>
                                <td className="px-3 py-2 text-slate-500 capitalize">{d.quincena}</td>
                                <td className="px-3 py-2 text-right font-bold text-slate-700">${parseFloat(d.valor).toFixed(2)}</td>
                                <td className="px-3 py-2 text-center text-slate-600">{d.numero_cuotas}</td>
                                <td className="px-3 py-2 text-center text-slate-600">{d.cuotas_restantes}</td>
                                <td className="px-3 py-2 text-slate-500">{d.numero_credito || <span className="text-slate-300">-</span>}</td>
                                <td className="px-3 py-2 flex gap-1">
                                    <button type="button" onClick={() => handleEdit(d)} className="p-1 text-slate-400 hover:text-indigo-600 rounded"><Edit size={13} /></button>
                                    <button type="button" onClick={() => handleDelete(d)} className="p-1 text-slate-400 hover:text-red-600 rounded"><Trash2 size={13} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- Sub-component: Indemnizaciones ---
const IndemnizacionesTab = ({ visible, selected, historial }) => {
    if (!visible) return null;

    if (!selected) {
        return (
            <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                <ScrollText size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-400">Guarda el empleado primero para ver indemnizaciones</p>
            </div>
        );
    }

    const meses = [
        '', 'Enero','Febrero','Marzo','Abril','Mayo','Junio',
        'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
    ];

    return (
        <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-200">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <ScrollText size={16} className="text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Historial de Indemnizaciones</h3>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-3 py-2 font-bold text-slate-500 uppercase text-[10px]">Periodo</th>
                            <th className="text-left px-3 py-2 font-bold text-slate-500 uppercase text-[10px]">Rango Fechas</th>
                            <th className="text-right px-3 py-2 font-bold text-slate-500 uppercase text-[10px]">Dias</th>
                            <th className="text-right px-3 py-2 font-bold text-slate-500 uppercase text-[10px]">Indemnizacion</th>
                            <th className="text-right px-3 py-2 font-bold text-slate-500 uppercase text-[10px]">Total Liquid.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(!historial || historial.length === 0) ? (
                            <tr><td colSpan={5} className="text-center py-8 text-slate-400 italic">Sin historial de indemnizaciones</td></tr>
                        ) : historial.map((h, i) => (
                            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-2 text-slate-700 font-medium">{meses[h.periodo_mes]} {h.periodo_año}</td>
                                <td className="px-3 py-2 text-slate-500">
                                    {fmtDate(h.periodo_indemnizacion_desde)} - {fmtDate(h.periodo_indemnizacion_hasta)}
                                </td>
                                <td className="px-3 py-2 text-right text-slate-600">{h.dias_indemnizacion}</td>
                                <td className="px-3 py-2 text-right font-bold text-indigo-600">${parseFloat(h.total_indemnizacion).toFixed(2)}</td>
                                <td className="px-3 py-2 text-right font-bold text-slate-700">${parseFloat(h.total_devengado).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- Sub-component: Ausencias ---
const AusenciasTab = ({ visible, selected, ausencias, ausenciaMutation, deleteAusenciaMutation, refetch }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editAusencia, setEditAusencia] = useState(null);
    const [formData, setFormData] = useState({ tipo: 'falta', fecha_inicio: '', fecha_fin: '', motivo: '', justificada: false });
    const confirm = useConfirm();

    const resetForm = () => {
        setFormData({ tipo: 'falta', fecha_inicio: '', fecha_fin: '', motivo: '', justificada: false });
        setEditAusencia(null);
        setIsModalOpen(false);
    };

    const dateToInput = (d) => {
        if (!d) return '';
        if (d instanceof Date) return d.toISOString().substring(0, 10);
        if (typeof d === 'string') return d.substring(0, 10);
        return '';
    };

    const openModal = (item) => {
        if (item) {
            setEditAusencia(item);
            setFormData({
                tipo: item.tipo,
                fecha_inicio: dateToInput(item.fecha_inicio),
                fecha_fin: dateToInput(item.fecha_fin),
                motivo: item.motivo || '',
                justificada: !!item.justificada
            });
        } else {
            setEditAusencia(null);
            setFormData({ tipo: 'falta', fecha_inicio: '', fecha_fin: '', motivo: '', justificada: false });
        }
        setIsModalOpen(true);
    };

    const handleDelete = async (item) => {
        const ok = await confirm({ title: 'Eliminar ausencia?', message: 'Esta accion no se puede deshacer.', confirmLabel: 'Si, eliminar', variant: 'danger' });
        if (ok) deleteAusenciaMutation.mutate(item.id);
    };

    const handleSubmit = () => {
        ausenciaMutation.mutate(
            { data: formData, editId: editAusencia?.id },
            {
                onSuccess: () => {
                    refetch();
                    toast.success(editAusencia ? 'Ausencia actualizada' : 'Ausencia registrada');
                    resetForm();
                },
                onError: (error) => {
                    toast.error(error.response?.data?.message || 'Error al guardar ausencia');
                }
            }
        );
    };

    if (!visible) return null;

    if (!selected) {
        return (
            <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                <CalendarX size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-400">Guarda el empleado primero para gestionar ausencias</p>
            </div>
        );
    }

    const tipoBadge = (tipo) => {
        const colors = {
            falta: 'bg-orange-50 text-orange-600',
            inasistencia: 'bg-red-50 text-red-600',
            incapacidad: 'bg-blue-50 text-blue-600'
        };
        return colors[tipo] || 'bg-slate-50 text-slate-600';
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                    <CalendarX size={16} className="text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Faltas / Inasistencias / Incapacidades</h3>
                </div>
                <button type="button" onClick={() => openModal(null)} className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700">
                    <Plus size={14} /> Agregar
                </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-3 py-2 font-bold text-slate-500 uppercase text-[10px]">Tipo</th>
                            <th className="text-left px-3 py-2 font-bold text-slate-500 uppercase text-[10px]">Fecha Inicio</th>
                            <th className="text-left px-3 py-2 font-bold text-slate-500 uppercase text-[10px]">Fecha Fin</th>
                            <th className="text-left px-3 py-2 font-bold text-slate-500 uppercase text-[10px]">Motivo</th>
                            <th className="text-center px-3 py-2 font-bold text-slate-500 uppercase text-[10px]">Justificada</th>
                            <th className="px-3 py-2 font-bold text-slate-500 uppercase text-[10px]">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ausencias.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-8 text-slate-400 italic">Sin ausencias registradas</td></tr>
                        ) : ausencias.map(a => (
                            <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-2"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tipoBadge(a.tipo)}`}>{a.tipo}</span></td>
                                <td className="px-3 py-2 text-slate-600">{fmtDate(a.fecha_inicio)}</td>
                                <td className="px-3 py-2 text-slate-600">{fmtDate(a.fecha_fin)}</td>
                                <td className="px-3 py-2 text-slate-700 max-w-[200px] truncate">{a.motivo || '-'}</td>
                                <td className="px-3 py-2 text-center">{a.justificada ? <span className="text-emerald-600 text-[10px] font-bold">Si</span> : <span className="text-slate-300">No</span>}</td>
                                <td className="px-3 py-2 flex gap-1">
                                    <button type="button" onClick={() => openModal(a)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={15} /></button>
                                    <button type="button" onClick={() => handleDelete(a)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            <Modal isOpen={isModalOpen} onClose={resetForm} title={editAusencia ? 'Editar Ausencia' : 'Nueva Ausencia'} maxWidth="max-w-md">
                <div className="space-y-4 pb-2">
                    <div>
                        <label className={labelCls}>Tipo</label>
                        <select value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value })} className={fieldCls}>
                            <option value="falta">Falta</option>
                            <option value="inasistencia">Inasistencia</option>
                            <option value="incapacidad">Incapacidad</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Fecha Inicio</label>
                            <input type="date" value={formData.fecha_inicio} onChange={e => setFormData({ ...formData, fecha_inicio: e.target.value })} required className={fieldCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Fecha Fin</label>
                            <input type="date" value={formData.fecha_fin} onChange={e => setFormData({ ...formData, fecha_fin: e.target.value })} className={fieldCls} />
                        </div>
                    </div>
                    <div>
                        <label className={labelCls}>Motivo</label>
                        <textarea value={formData.motivo} onChange={e => setFormData({ ...formData, motivo: e.target.value })} placeholder="Motivo" className={`${fieldCls} h-16 resize-none`} />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={formData.justificada} onChange={e => setFormData({ ...formData, justificada: e.target.checked })} className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                        <span className="text-xs font-bold text-slate-600">Justificada</span>
                    </label>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onClick={resetForm} className="px-5 py-2.5 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm">Cancelar</button>
                        <button type="button" onClick={handleSubmit} disabled={ausenciaMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50">
                            {ausenciaMutation.isPending ? 'Guardando...' : (editAusencia ? 'Actualizar' : 'Agregar')}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Empleados;
