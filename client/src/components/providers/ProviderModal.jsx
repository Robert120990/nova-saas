import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Modal from '../ui/Modal';
import SearchableSelect from '../ui/SearchableSelect';
import { toast } from 'sonner';

const ProviderModal = ({ isOpen, onClose, provider = null, onSuccess }) => {
    const queryClient = useQueryClient();
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedMun, setSelectedMun] = useState('');
    const [selectedDistrito, setSelectedDistrito] = useState('');
    const [selectedActivity, setSelectedActivity] = useState('');
    const [selectedPais, setSelectedPais] = useState('9579');
    const [esCredito, setEsCredito] = useState(false);
    const [diasCredito, setDiasCredito] = useState('');
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

    useEffect(() => {
        if (isOpen) {
            if (provider) {
                setSelectedDept(provider.departamento || '');
                setSelectedMun(provider.municipio || '');
                setSelectedDistrito(provider.distrito || '');
                setSelectedActivity(provider.codigo_actividad || '');
                setSelectedPais(provider.pais || '9579');
                setNitValue(provider.nit || '');
                setEsCredito(provider.es_credito === 1 || provider.es_credito === true);
                setDiasCredito(provider.dias_credito != null ? String(provider.dias_credito) : '');
            } else {
                setSelectedDept('');
                setSelectedMun('');
                setSelectedDistrito('');
                setSelectedActivity('');
                setSelectedPais('9579');
                setNitValue('');
                setEsCredito(false);
                setDiasCredito('');
            }
        }
    }, [isOpen, provider]);

    // Catalogs
    const { data: departments = [] } = useQuery({
        queryKey: ['catalogs', 'departments'],
        queryFn: async () => (await axios.get('/api/catalogs/departments')).data,
        enabled: isOpen
    });

    const { data: municipalities = [] } = useQuery({
        queryKey: ['catalogs', 'municipalities', selectedDept],
        queryFn: async () => (await axios.get(`/api/catalogs/municipalities?dep_code=${selectedDept}`)).data,
        enabled: isOpen && !!selectedDept
    });

    const { data: activities = [] } = useQuery({
        queryKey: ['catalogs', 'activities'],
        queryFn: async () => (await axios.get('/api/catalogs/actividades')).data,
        enabled: isOpen
    });

    const { data: distritos = [] } = useQuery({
        queryKey: ['catalogs', 'distritos', selectedDept],
        queryFn: async () => (await axios.get(`/api/catalogs/districts?dep_code=${selectedDept}`)).data,
        enabled: isOpen && !!selectedDept
    });

    const { data: personTypes = [] } = useQuery({
        queryKey: ['catalogs', 'cat_029_tipo_persona'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_029_tipo_persona')).data,
        enabled: isOpen
    });

    const { data: countries = [] } = useQuery({
        queryKey: ['catalogs', 'cat_020_pais'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_020_pais')).data,
        enabled: isOpen
    });

    const mutation = useMutation({
        mutationFn: async (data) => {
            if (provider?.id) {
                const res = await axios.put(`/api/providers/${provider.id}`, data);
                return { ...provider, ...data, id: provider.id, ...res.data };
            }
            const res = await axios.post('/api/providers', data);
            return { ...data, id: res.data?.id, ...res.data };
        },
        onSuccess: (savedData) => {
            queryClient.invalidateQueries(['providers']);
            toast.success(provider ? 'Proveedor actualizado con éxito' : 'Proveedor registrado con éxito');
            if (onSuccess) onSuccess(savedData);
            onClose();
        },
        onError: (error) => {
            toast.error(error?.response?.data?.error || error?.response?.data?.message || 'Error al guardar proveedor');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        data.exento_iva = formData.get('exento_iva') ? 1 : 0;
        data.es_credito = formData.get('es_credito') ? 1 : 0;
        data.dias_credito = data.es_credito ? parseInt(diasCredito, 10) || 0 : 0;
        data.es_gran_contribuyente = data.tipo_contribuyente === 'Gran Contribuyente' ? 1 : 0;

        const nitRegex = /^\d{4}-\d{6}-\d{3}-\d{1}$/;
        if (data.nit && !nitRegex.test(data.nit)) {
            toast.error('Formato de NIT inválido (0000-000000-000-0)');
            return;
        }

        mutation.mutate(data);
    };

    const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm";
    const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={provider ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            maxWidth="max-w-lg"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Tipo de Persona</label>
                        <select name="tipo_persona" defaultValue={provider?.tipo_persona || '1'} className={fieldCls} required>
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

                <div>
                    <label className={labelCls}>Tipo de Contribuyente</label>
                    <select name="tipo_contribuyente" defaultValue={provider?.tipo_contribuyente || 'Otro'} className={fieldCls}>
                        <option value="Otro">Otro (Pequeño/Mediano)</option>
                        <option value="Gran Contribuyente">Gran Contribuyente</option>
                        <option value="No Domiciliado">No Domiciliado</option>
                    </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Tipo Documento</label>
                        <select name="tipo_documento" defaultValue={provider?.tipo_documento || 'NIT'} className={fieldCls}>
                            <option value="NIT">NIT</option>
                            <option value="DUI">DUI</option>
                            <option value="Pasaporte">Pasaporte</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Número Documento</label>
                        <input name="numero_documento" defaultValue={provider?.numero_documento || ''} placeholder="0000-000000-000-0" className={fieldCls} />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        <input name="nrc" defaultValue={provider?.nrc || ''} className={fieldCls} required />
                    </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <input 
                            type="checkbox" 
                            name="exento_iva" 
                            id="modal_exento_iva"
                            defaultChecked={provider?.exento_iva === 1 || provider?.exento_iva === true}
                            value="1"
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 shrink-0"
                        />
                        <label htmlFor="modal_exento_iva" className="text-[11px] font-bold text-slate-700 cursor-pointer">
                            ESTE PROVEEDOR ESTÁ EXENTO DE IVA
                        </label>
                        <p className="text-[9px] text-slate-400 font-medium sm:ml-auto">Aplica IVA 0% en compras</p>
                    </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                        <input 
                            type="checkbox" 
                            name="es_credito"
                            id="modal_es_credito"
                            checked={esCredito}
                            onChange={(e) => { setEsCredito(e.target.checked); if (e.target.checked && !diasCredito) setDiasCredito('30'); }}
                            value="1"
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 shrink-0"
                        />
                        <label htmlFor="modal_es_credito" className="text-[11px] font-bold text-slate-700 cursor-pointer">
                            ES CRÉDITO
                        </label>
                        <p className="text-[9px] text-slate-400 font-medium sm:ml-auto">El proveedor vende a crédito</p>
                    </div>
                    {esCredito && (
                        <div className="pl-6">
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Días de Crédito</label>
                            <input
                                type="number"
                                min="1"
                                value={diasCredito}
                                onChange={(e) => setDiasCredito(e.target.value)}
                                placeholder="30"
                                className="w-32 px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm font-medium"
                            />
                        </div>
                    )}
                </div>

                <div>
                    <label className={labelCls}>Nombre / Razón Social</label>
                    <input name="nombre" defaultValue={provider?.nombre || ''} required className={fieldCls} />
                </div>

                <div>
                    <label className={labelCls}>Nombre Comercial</label>
                    <input name="nombre_comercial" defaultValue={provider?.nombre_comercial || ''} className={fieldCls} />
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Teléfono</label>
                        <input name="telefono" defaultValue={provider?.telefono || ''} placeholder="2200-0000" className={fieldCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Correo Electrónico</label>
                        <input name="correo" type="email" defaultValue={provider?.correo || ''} placeholder="proveedor@empresa.com" className={fieldCls} />
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
                    <div className="sm:col-span-2">
                        <label className={labelCls}>Distrito</label>
                        <select name="distrito" value={selectedDistrito} onChange={(e) => setSelectedDistrito(e.target.value)} className={fieldCls} required>
                            <option value="">Seleccionar</option>
                            {distritos?.map(d => <option key={d.code} value={d.code}>{d.description}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className={labelCls}>Dirección Exacta</label>
                    <textarea name="direccion" defaultValue={provider?.direccion || ''} placeholder="Calle, colonia, edificio..." className={`${fieldCls} h-16 resize-none`} />
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 font-semibold hover:text-slate-700 transition-colors text-sm">Cancelar</button>
                    <button type="submit" disabled={mutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold transition-all text-sm active:scale-95 disabled:opacity-50">
                        {mutation.isPending ? 'Guardando...' : provider ? 'Actualizar' : 'Registrar'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ProviderModal;
