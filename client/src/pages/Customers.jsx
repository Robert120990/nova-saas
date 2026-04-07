import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import SearchableSelect from '../components/ui/SearchableSelect';
import Pagination from '../components/ui/Pagination';

const Customers = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedMun, setSelectedMun] = useState('');
    const [selectedActivity, setSelectedActivity] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [nitValue, setNitValue] = useState('');

    const formatNIT = (value) => {
        const digits = value.replace(/\D/g, '');
        let formatted = '';
        if (digits.length > 0) formatted += digits.substring(0, 4);
        if (digits.length > 4) formatted += '-' + digits.substring(4, 10);
        if (digits.length > 10) formatted += '-' + digits.substring(10, 13);
        if (digits.length > 13) formatted += '-' + digits.substring(13, 14);
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
        queryKey: ['customers', debouncedSearch, page],
        queryFn: async () => (await axios.get('/api/customers', { params: { search: debouncedSearch, page } })).data
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

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        data.aplica_iva = formData.get('aplica_iva') === 'on';
        data.exento_iva = formData.get('exento_iva') === 'on';
        data.aplica_fovial = formData.get('aplica_fovial') === 'on';
        data.aplica_cotrans = formData.get('aplica_cotrans') === 'on';

        const nitRegex = /^\d{4}-\d{6}-\d{3}-\d{1}$/;
        if (data.nit && !nitRegex.test(data.nit)) {
            toast.error('Formato de NIT inválido (0000-000000-000-0)');
            return;
        }

        mutation.mutate(data);
    };

    const handleEdit = (customer) => {
        setSelectedCustomer(customer);
        setSelectedDept(customer.departamento);
        setSelectedMun(customer.municipio);
        setSelectedActivity(customer.codigo_actividad);
        setNitValue(customer.nit || '');
        setIsModalOpen(true);
    };

    const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm";
    const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Clientes</h2>
                    <p className="text-slate-500 mt-1">Base de datos de contribuyentes y consumidores final</p>
                </div>
                <button 
                    onClick={() => { 
                        setSelectedCustomer(null); 
                        setSelectedDept(''); 
                        setSelectedMun('');
                        setSelectedActivity('');
                        setNitValue('');
                        setIsModalOpen(true); 
                    }} 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-95 font-bold"
                >
                    <Plus size={20}/>
                    <span>Nuevo Cliente</span>
                </button>
            </div>

            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre, NIT o documento..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium shadow-sm"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table 
                    headers={['Nombre / Razón Social', 'Ubicación', 'Tipo Persona / País', 'Documento', 'Condición Fiscal', 'Acciones']}
                    data={customers}
                    isLoading={isLoading}
                    renderRow={(c) => (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                                <div className="text-sm font-bold text-slate-900">{c.nombre}</div>
                                <div className="text-xs text-slate-500 font-medium">{c.nombre_comercial}</div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-xs text-slate-600 font-medium">{c.municipio_nombre || c.municipio}, {c.departamento_nombre || c.departamento}</div>
                                <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{c.direccion}</div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-xs font-bold text-indigo-600 uppercase">
                                    {personTypes.find(t => t.code === c.tipo_persona)?.description || 'Natural'}
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium">
                                    {countries.find(t => t.code === c.pais)?.description || 'El Salvador'}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded inline-block">{c.nit || c.numero_documento}</div>
                                <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold">{c.tipo_documento}</div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase ${
                                    c.condicion_fiscal === 'gran contribuyente' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                    {c.condicion_fiscal}
                                </span>
                                {c.actividad_nombre && (
                                    <div className="text-[10px] text-indigo-600 font-bold mt-1 max-w-[150px] truncate">
                                        {c.actividad_nombre}
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-4 flex gap-2">
                                <button onClick={() => handleEdit(c)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={18}/></button>
                                <button onClick={() => { if(confirm('¿Eliminar cliente?')) deleteMutation.mutate(c.id) }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
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
                itemsOnPage={customers.length}
                isLoading={isLoading}
            />

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={selectedCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
                maxWidth="max-w-lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Tipo de Persona</label>
                            <select name="tipo_persona" defaultValue={selectedCustomer?.tipo_persona || '1'} className={fieldCls} required>
                                {personTypes.map(t => <option key={t.code} value={t.code}>{t.description}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>País</label>
                            <select name="pais" defaultValue={selectedCustomer?.pais || '222'} className={fieldCls} required>
                                {countries.map(t => <option key={t.code} value={t.code}>{t.description}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Tipo Documento</label>
                            <select name="tipo_documento" defaultValue={selectedCustomer?.tipo_documento} className={fieldCls}>
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
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>NIT</label>
                            <input 
                                name="nit" 
                                value={nitValue} 
                                onChange={(e) => setNitValue(formatNIT(e.target.value))}
                                placeholder="0000-000000-000-0" 
                                className={fieldCls} 
                                maxLength={17}
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
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Condición Fiscal</label>
                            <select name="condicion_fiscal" defaultValue={selectedCustomer?.condicion_fiscal} className={fieldCls}>
                                <option value="contribuyente">Contribuyente</option>
                                <option value="gran contribuyente">Gran Contribuyente</option>
                                <option value="exento IVA">Exento IVA</option>
                                <option value="sujeto excluido">Sujeto Excluido</option>
                            </select>
                        </div>
                        
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Teléfono</label>
                            <input name="telefono" defaultValue={selectedCustomer?.telefono} placeholder="2200-0000" className={fieldCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Correo Electrónico</label>
                            <input name="correo" type="email" defaultValue={selectedCustomer?.correo} placeholder="cliente@ejemplo.com" className={fieldCls} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Departamento</label>
                            <select name="departamento" className={fieldCls} value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} required>
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
                    </div>
                    <div>
                        <label className={labelCls}>Dirección Exacta</label>
                        <textarea name="direccion" defaultValue={selectedCustomer?.direccion} required placeholder="Dirección completa..." className={`${fieldCls} h-16 resize-none`} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { id: 'aplica_iva', label: 'Aplica IVA', default: true },
                            { id: 'exento_iva', label: 'Exento de IVA', default: false },
                            { id: 'aplica_fovial', label: 'Aplica FOVIAL', default: true },
                            { id: 'aplica_cotrans', label: 'Aplica COTRANS', default: true }
                        ].map(tax => (
                            <label key={tax.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:border-indigo-200 transition-all text-xs font-semibold text-slate-600">
                                <input type="checkbox" name={tax.id} defaultChecked={selectedCustomer ? selectedCustomer[tax.id] : tax.default} className="accent-indigo-600 w-4 h-4" />
                                {tax.label}
                            </label>
                        ))}
                    </div>
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-semibold hover:text-slate-700 transition-colors text-sm">Cancelar</button>
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold transition-all text-sm active:scale-95">
                            {selectedCustomer ? 'Actualizar' : 'Registrar'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Customers;
