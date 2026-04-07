import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import { Plus, Edit, Trash2, Building2, Globe, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import SearchableSelect from '../components/ui/SearchableSelect';

const Companies = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedMun, setSelectedMun] = useState('');
    const [selectedActivity, setSelectedActivity] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [selectedContribuyente, setSelectedContribuyente] = useState('');
    const [selectedEnv, setSelectedEnv] = useState('');
    const [previewUrl, setPreviewUrl] = useState(null);
    const [activeTab, setActiveTab] = useState('general');
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

    const { data: companies = [], isLoading } = useQuery({
        queryKey: ['companies'],
        queryFn: async () => (await axios.get('/api/companies')).data
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

    const { data: activities = [] } = useQuery({
        queryKey: ['catalogs', 'actividades'],
        queryFn: async () => (await axios.get('/api/catalogs/actividades')).data
    });

    const { data: personTypes = [] } = useQuery({
        queryKey: ['catalogs', 'person-types'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_029_tipo_persona')).data
    });

    const { data: environments = [] } = useQuery({
        queryKey: ['catalogs', 'environments'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_001_ambiente')).data
    });

    useEffect(() => {
        if (selectedCompany) {
            setSelectedDept(selectedCompany.departamento);
            setSelectedMun(selectedCompany.municipio);
            setSelectedActivity(selectedCompany.codigo_actividad);
            setSelectedType(selectedCompany.tipo_persona);
            setSelectedContribuyente(selectedCompany.tipo_contribuyente);
            setSelectedEnv(selectedCompany.ambiente);
            setPreviewUrl(null);
            setNitValue(selectedCompany.nit || '');
        }
    }, [selectedCompany]);

    const mutation = useMutation({
        mutationFn: (data) => {
            if (selectedCompany) return axios.put(`/api/companies/${selectedCompany.id}`, data);
            return axios.post('/api/companies', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['companies']);
            setIsModalOpen(false);
            setSelectedCompany(null);
            toast.success(selectedCompany ? 'Empresa actualizada' : 'Empresa creada');
        },
        onError: (error) => {
            const msg = error.response?.data?.message || 'Error al procesar la solicitud';
            toast.error(msg);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/companies/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['companies']);
            toast.success('Empresa eliminada');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const nitRegex = /^\d{4}-\d{6}-\d{3}-\d{1}$/;
        if (!nitRegex.test(formData.get('nit'))) {
            toast.error('Formato de NIT inválido (0000-000000-000-0)');
            return;
        }

        // Handle dte_active toggle
        if (!formData.has('dte_active')) {
            formData.append('dte_active', '0');
        } else {
            formData.set('dte_active', '1');
        }

        mutation.mutate(formData);
    };

    const handleEdit = (company) => {
        setSelectedCompany(company);
        setActiveTab('general');
        setIsModalOpen(true);
    };

    const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm";
    const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Gestión de Empresas</h2>
                    <p className="text-slate-500 mt-1 font-medium">Administra las identidades legales en tu plataforma</p>
                </div>
                <button 
                    onClick={() => { 
                        setSelectedCompany(null); 
                        setSelectedDept(''); 
                        setSelectedMun('');
                        setSelectedActivity('');
                        setSelectedType('');
                        setSelectedContribuyente('');
                        setSelectedEnv('');
                        setPreviewUrl(null);
                        setActiveTab('general');
                        setNitValue('');
                        setIsModalOpen(true); 
                    }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={20} />
                    <span>Nueva Empresa</span>
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table 
                    headers={['Empresa', 'NIT / NRC', 'Ubicación', 'Ambiente / Tipo Persona', 'Acciones']}
                    data={companies}
                    renderRow={(company) => (
                        <tr key={company.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex-shrink-0 overflow-hidden border border-slate-200">
                                        {company.logo_url ? (
                                            <img src={company.logo_url} alt="Logo" className="w-full h-full object-contain" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                <Building2 size={20} />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-slate-900">{company.razon_social}</div>
                                        <div className="text-xs text-slate-500 font-medium italic">{company.nombre_comercial}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-sm font-bold text-slate-900">{company.nit}</div>
                                <div className="text-[10px] font-mono text-slate-500 mt-1 bg-slate-100 px-1.5 py-0.5 rounded inline-block">{company.nrc}</div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-xs text-slate-600 font-medium">{company.municipio_nombre || company.municipio}, {company.departamento_nombre || company.departamento}</div>
                                <div className="text-[10px] text-indigo-600 font-bold max-w-[150px] truncate">{company.actividad_nombre}</div>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase border ${
                                    company.ambiente === '2' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                    : 'bg-amber-50 text-amber-700 border-amber-100'
                                }`}>
                                    {company.ambiente_nombre || company.ambiente}
                                </span>
                                <div className="text-[9px] text-indigo-600 mt-1 uppercase font-black tracking-wider">
                                    { company.tipo_persona_nombre}
                                </div>
                            </td>
                            <td className="px-6 py-4 flex gap-2">
                                <button onClick={() => handleEdit(company)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={18}/></button>
                                <button onClick={() => { if(confirm('¿Eliminar empresa?')) deleteMutation.mutate(company.id) }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                            </td>
                        </tr>
                    )}
                />
            </div>

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={selectedCompany ? 'Editar Empresa' : 'Nueva Empresa'}
                maxWidth="max-w-lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex border-b border-slate-100 mb-4 bg-slate-50/50 p-1 rounded-lg">
                        <button 
                            type="button"
                            onClick={() => setActiveTab('general')}
                            className={`flex-1 px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-md ${activeTab === 'general' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Información General
                        </button>
                        <button 
                            type="button"
                            onClick={() => setActiveTab('dte')}
                            className={`flex-1 px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-md ${activeTab === 'dte' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Configuración DTE
                        </button>
                    </div>

                    <div className={activeTab === 'general' ? 'space-y-4' : 'hidden'}>
                        <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>NIT</label>
                            <input 
                                name="nit" 
                                value={nitValue} 
                                onChange={(e) => setNitValue(formatNIT(e.target.value))}
                                required 
                                placeholder="0000-000000-000-0" 
                                className={fieldCls} 
                                maxLength={17}
                            />
                        </div>
                        <div>
                            <label className={labelCls}>NRC</label>
                            <input name="nrc" defaultValue={selectedCompany?.nrc} required placeholder="000000-0" className={fieldCls} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className={labelCls}>Razón Social</label>
                            <input name="razon_social" defaultValue={selectedCompany?.razon_social} required className={fieldCls} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className={labelCls}>Nombre Comercial</label>
                            <input name="nombre_comercial" defaultValue={selectedCompany?.nombre_comercial} className={fieldCls} />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className={labelCls}>Actividad Económica</label>
                            <SearchableSelect 
                                name="codigo_actividad" 
                                options={activities} 
                                value={selectedActivity} 
                                onChange={(e) => setSelectedActivity(e.target.value)}
                                placeholder="Seleccionar actividad"
                            />
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
                        <label className={labelCls}>Dirección</label>
                        <textarea name="direccion" defaultValue={selectedCompany?.direccion} className={`${fieldCls} h-16 resize-none`} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Tipo de Persona</label>
                            <select name="tipo_persona" value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className={fieldCls} required>
                                <option value="">Seleccionar</option>
                                {personTypes?.map(t => <option key={t.code} value={t.code}>{t.description}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Tipo de Contribuyente</label>
                            <select name="tipo_contribuyente" value={selectedContribuyente} onChange={(e) => setSelectedContribuyente(e.target.value)} className={fieldCls}>
                                <option value="">Seleccionar</option>
                                <option value="Otros">Otros</option>
                                <option value="Mediano">Mediano</option>
                                <option value="Grande">Grande</option>
                            </select>
                        </div>
                    </div>
                        <div>
                        <label className={labelCls}>Logo de la Empresa</label>
                        <div className="flex gap-4 items-center p-3 bg-slate-50 border border-slate-200 border-dashed rounded-xl">
                            <div className="flex-1">
                                <input 
                                    name="logo" 
                                    type="file" 
                                    accept="image/*" 
                                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all cursor-pointer"
                                    onChange={(e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            setPreviewUrl(URL.createObjectURL(file));
                                        }
                                    }}
                                />
                                <p className="mt-1 text-[10px] text-slate-400">Logotipo oficial. Se recomienda fondo transparente.</p>
                            </div>
                            {(previewUrl || selectedCompany?.logo_url) && (
                                <div className="w-16 h-16 bg-white border border-slate-200 rounded-lg overflow-hidden flex-shrink-0 shadow-sm relative group">
                                    <img 
                                        src={previewUrl || selectedCompany.logo_url} 
                                        alt="Vista previa" 
                                        className="w-full h-full object-contain" 
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                        <span className="text-[8px] text-white font-bold uppercase">Previsualizar</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    </div>

                    <div className={activeTab === 'dte' ? 'space-y-4' : 'hidden'}>
                        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between mb-2">
                            <div>
                                <h4 className="text-xs font-black text-indigo-700 uppercase tracking-widest">Facturación Electrónica</h4>
                                <p className="text-[10px] text-indigo-600/70 font-medium">Habilitar emisión de Documentos Tributarios Electrónicos</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    name="dte_active" 
                                    defaultChecked={selectedCompany?.dte_active === 1}
                                    className="sr-only peer" 
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 border-dashed space-y-3">
                            <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest">Ambiente de Trabajo</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Ambiente de Facturación</label>
                                    <select name="ambiente" value={selectedEnv} onChange={(e) => setSelectedEnv(e.target.value)} className={fieldCls} required>
                                        <option value="">Seleccionar</option>
                                        {environments?.map(env => <option key={env.code} value={env.code}>{env.description}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 border-dashed space-y-3">
                        <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest">Certificado .p12 / .pfx</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Archivo de Certificado (.p12 / .pfx)</label>
                                <input 
                                    name="certificate" 
                                    type="file" 
                                    accept=".p12,.pfx" 
                                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all cursor-pointer"
                                />
                                {selectedCompany?.certificate_path && (
                                    <p className="mt-1 text-[9px] text-amber-600 font-medium truncate italic" title={selectedCompany.certificate_path}>
                                        Guardado: ...{selectedCompany.certificate_path.split('\\').pop().split('/').pop()}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className={labelCls}>Contraseña del Certificado</label>
                                <input name="certificate_password" type="password" defaultValue={selectedCompany?.certificate_password} className={fieldCls} />
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 border-dashed space-y-3">
                        <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest">Certificado CRT</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Archivo de Certificado (.crt / .pem)</label>
                                <input 
                                    name="certificate_crt" 
                                    type="file" 
                                    accept=".crt,.pem" 
                                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all cursor-pointer"
                                />
                                {selectedCompany?.certificate_crt_path && (
                                    <p className="mt-1 text-[9px] text-amber-600 font-medium truncate italic" title={selectedCompany.certificate_crt_path}>
                                        Guardado: ...{selectedCompany.certificate_crt_path.split('\\').pop().split('/').pop()}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className={labelCls}>API User</label>
                                <input name="api_user" defaultValue={selectedCompany?.api_user} className={fieldCls} />
                            </div>
                            <div>
                                <label className={labelCls}>API Password</label>
                                <input name="api_password" type="password" defaultValue={selectedCompany?.api_password} className={fieldCls} />
                            </div>
                        </div>
                        <div>
                            <label className={labelCls}>Clave Privada (.key / PEM)</label>
                            <textarea name="clave_privada" defaultValue={selectedCompany?.clave_privada} placeholder="---BEGIN PRIVATE KEY---" className={`${fieldCls} h-16 font-mono text-[10px] resize-none bg-slate-800 text-emerald-400 border-slate-700`} />
                        </div>
                    </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-semibold hover:text-slate-700 transition-colors text-sm">Cancelar</button>
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold transition-all text-sm active:scale-95">
                            {selectedCompany ? 'Actualizar' : 'Registrar'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Companies;
