import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import { Plus, Edit, Trash2, Phone, Mail, Search } from 'lucide-react';
import { toast } from 'sonner';
import SearchableSelect from '../components/ui/SearchableSelect';
import Pagination from '../components/ui/Pagination';

const Providers = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState(null);
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
        queryKey: ['providers', debouncedSearch, page],
        queryFn: async () => (await axios.get('/api/providers', { params: { search: debouncedSearch, page } })).data
    });

    const providers = response.data || [];

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
        queryKey: ['catalogs', 'activities'],
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
            if (selectedProvider) return axios.put(`/api/providers/${selectedProvider.id}`, data);
            return axios.post('/api/providers', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['providers']);
            setIsModalOpen(false);
            setSelectedProvider(null);
            toast.success(selectedProvider ? 'Proveedor actualizado' : 'Proveedor registrado');
        },
        onError: (error) => {
            toast.error(error?.response?.data?.error || error?.response?.data?.message || 'Error al guardar proveedor');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/providers/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['providers']);
            toast.success('Proveedor eliminado');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        
        // Handle checkboxes (if not present, set to 0)
        data.exento_iva = formData.get('exento_iva') ? 1 : 0;
        data.es_gran_contribuyente = data.tipo_contribuyente === 'Gran Contribuyente' ? 1 : 0;
        
        const nitRegex = /^\d{4}-\d{6}-\d{3}-\d{1}$/;
        if (data.nit && !nitRegex.test(data.nit)) {
            toast.error('Formato de NIT inválido (0000-000000-000-0)');
            return;
        }

        mutation.mutate(data);
    };

    const handleEdit = (provider) => {
        setSelectedProvider(provider);
        setSelectedDept(provider.departamento);
        setSelectedMun(provider.municipio);
        setSelectedActivity(provider.codigo_actividad);
        setNitValue(provider.nit || '');
        setIsModalOpen(true);
    };

    const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm";
    const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Proveedores</h2>
                    <p className="text-slate-500 mt-1 font-medium">Gestión de abastecimiento y servicios externos</p>
                </div>
                <button 
                    onClick={() => { 
                        setSelectedProvider(null); 
                        setSelectedDept(''); 
                        setSelectedMun('');
                        setSelectedActivity('');
                        setNitValue('');
                        setIsModalOpen(true); 
                    }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={20}/>
                    <span>Nuevo Proveedor</span>
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
                    headers={['Nombre / Razón Social', 'Ubicación',  'Documento', 'NRC', 'Contacto', 'Acciones']}
                    data={providers}
                    isLoading={isLoading}
                    renderRow={(p) => (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                                <div className="text-sm font-bold text-slate-900">{p.nombre}</div>
                                <div className="text-xs text-slate-500 font-medium italic">{p.nombre_comercial}</div>
                                {p.es_gran_contribuyente === 1 && (
                                    <div className="mt-1 text-[9px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-tighter w-fit">Gran Contribuyente</div>
                                )}
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-xs text-slate-600 font-medium">{p.municipio_nombre || p.municipio}, {p.departamento_nombre || p.departamento}</div>
                                <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{p.direccion}</div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded inline-block">{p.nit || p.numero_documento}</div>
                                <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold">{p.tipo_documento}</div>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                                <div className="font-mono bg-slate-100 px-2 py-1 rounded inline-block">{p.nrc || 'N/A'}</div>
                                {p.exento_iva === 1 && (
                                    <div className="mt-1 text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-tighter w-fit mx-auto">Exento IVA</div>
                                )}
                            </td>
                            <td className="px-6 py-4">
                                {p.telefono && <div className="text-xs text-slate-600 flex items-center gap-1"><Phone size={12} className="text-slate-400"/> {p.telefono}</div>}
                                {p.correo && <div className="text-xs text-slate-600 flex items-center gap-1"><Mail size={12} className="text-slate-400"/> {p.correo}</div>}
                            </td>
                            <td className="px-6 py-4 flex gap-2">
                                <button onClick={() => handleEdit(p)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={18}/></button>
                                <button onClick={() => { if(confirm('¿Eliminar proveedor?')) deleteMutation.mutate(p.id) }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
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
                itemsOnPage={providers.length}
                isLoading={isLoading}
            />

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={selectedProvider ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                maxWidth="max-w-lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Tipo de Persona</label>
                            <select name="tipo_persona" defaultValue={selectedProvider?.tipo_persona || '1'} className={fieldCls} required>
                                {personTypes.map(t => <option key={t.code} value={t.code}>{t.description}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>País</label>
                            <select name="pais" defaultValue={selectedProvider?.pais || '222'} className={fieldCls} required>
                                {countries.map(t => <option key={t.code} value={t.code}>{t.description}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className={labelCls}>Tipo de Contribuyente</label>
                        <select name="tipo_contribuyente" defaultValue={selectedProvider?.tipo_contribuyente || 'Otro'} className={fieldCls}>
                            <option value="Otro">Otro (Pequeño/Mediano)</option>
                            <option value="Gran Contribuyente">Gran Contribuyente</option>
                            <option value="No Domiciliado">No Domiciliado</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Tipo Documento</label>
                            <select name="tipo_documento" defaultValue={selectedProvider?.tipo_documento} className={fieldCls}>
                                <option value="NIT">NIT</option>
                                <option value="DUI">DUI</option>
                                <option value="Pasaporte">Pasaporte</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Número Documento</label>
                            <input name="numero_documento" defaultValue={selectedProvider?.numero_documento} placeholder="0000-000000-000-0" className={fieldCls} />
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
                            <input name="nrc" defaultValue={selectedProvider?.nrc} className={fieldCls} required />
                        </div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                name="exento_iva" 
                                id="exento_iva"
                                defaultChecked={selectedProvider?.exento_iva === 1}
                                value="1"
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                            />
                            <label htmlFor="exento_iva" className="text-[11px] font-bold text-slate-700 cursor-pointer">
                                ESTE PROVEEDOR ESTÁ EXENTO DE IVA
                            </label>
                            <p className="text-[9px] text-slate-400 font-medium ml-auto">Aplica IVA 0% en compras</p>
                        </div>
                    </div>
                    <div>
                        <label className={labelCls}>Nombre / Razón Social</label>
                        <input name="nombre" defaultValue={selectedProvider?.nombre} required className={fieldCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Nombre Comercial</label>
                        <input name="nombre_comercial" defaultValue={selectedProvider?.nombre_comercial} className={fieldCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Actividad Económica</label>
                        <SearchableSelect 
                            name="codigo_actividad" 
                            options={activities} 
                            value={selectedActivity} 
                            onChange={(e) => setSelectedActivity(e.target.value)}
                            placeholder="Buscar actividad económica..."
                            valueKey="code"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Teléfono</label>
                            <input name="telefono" defaultValue={selectedProvider?.telefono} placeholder="2200-0000" className={fieldCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Correo Electrónico</label>
                            <input name="correo" type="email" defaultValue={selectedProvider?.correo} placeholder="proveedor@empresa.com" className={fieldCls} />
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
                        <textarea name="direccion" defaultValue={selectedProvider?.direccion} placeholder="Calle, colonia, edificio..." className={`${fieldCls} h-16 resize-none`} />
                    </div>
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-semibold hover:text-slate-700 transition-colors text-sm">Cancelar</button>
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold transition-all text-sm active:scale-95">
                            {selectedProvider ? 'Actualizar' : 'Registrar'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Providers;
