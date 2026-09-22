import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Modal from '../ui/Modal';
import SearchableSelect from '../ui/SearchableSelect';
import { Building2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { formatDocumentNumber, validateDocumentNumber, formatNRC } from '../../utils/svfeValidators';

const ProviderModal = ({ isOpen, onClose, provider = null, onSuccess }) => {
    const queryClient = useQueryClient();

    // Modal Form States
    const [docType, setDocType] = useState('NIT');
    const [docNumberValue, setDocNumberValue] = useState('');
    const [nrcValue, setNrcValue] = useState('');
    const [condicionFiscal, setCondicionFiscal] = useState('contribuyente');
    const [exentoIva, setExentoIva] = useState(false);
    const [esCredito, setEsCredito] = useState(false);
    const [diasCredito, setDiasCredito] = useState('30');
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedMun, setSelectedMun] = useState('');
    const [selectedDistrito, setSelectedDistrito] = useState('');
    const [selectedActivity, setSelectedActivity] = useState('');
    const [selectedPais, setSelectedPais] = useState('9579');

    useEffect(() => {
        if (isOpen) {
            if (provider) {
                // Inferir tipo de documento
                let initialDocType = provider.tipo_documento;
                if (!initialDocType) {
                    const rawDoc = String(provider.numero_documento || provider.nit || '').replace(/\D/g, '');
                    if (rawDoc.length === 9) initialDocType = 'DUI';
                    else if (rawDoc.length === 14) initialDocType = 'NIT';
                    else initialDocType = 'NIT';
                }
                setDocType(initialDocType);

                const rawDocNumber = provider.numero_documento || provider.nit || '';
                setDocNumberValue(formatDocumentNumber(rawDocNumber, initialDocType));
                setNrcValue(formatNRC(provider.nrc || ''));

                // Condición fiscal
                let cf = provider.condicion_fiscal;
                if (!cf) {
                    if (provider.es_gran_contribuyente === 1 || provider.tipo_contribuyente === 'Gran Contribuyente') cf = 'gran contribuyente';
                    else if (provider.exento_iva === 1) cf = 'exento IVA';
                    else if (provider.nrc && provider.nrc.trim()) cf = 'contribuyente';
                    else cf = 'otro';
                }
                setCondicionFiscal(cf);

                setExentoIva(provider.exento_iva === 1 || provider.exento_iva === true);
                setEsCredito(provider.es_credito === 1 || provider.es_credito === true);
                setDiasCredito(provider.dias_credito != null ? String(provider.dias_credito) : '30');

                setSelectedDept(provider.departamento || '');
                setSelectedMun(provider.municipio || '');
                setSelectedDistrito(provider.distrito || '');
                setSelectedActivity(provider.codigo_actividad || '');
                setSelectedPais(provider.pais || '9579');
            } else {
                setDocType('NIT');
                setDocNumberValue('');
                setNrcValue('');
                setCondicionFiscal('contribuyente');
                setExentoIva(false);
                setEsCredito(false);
                setDiasCredito('30');
                setSelectedDept('');
                setSelectedMun('');
                setSelectedDistrito('');
                setSelectedActivity('');
                setSelectedPais('9579');
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
            toast.error(error?.response?.data?.message || error?.response?.data?.error || 'Error al guardar proveedor');
        }
    });

    const isForeign = docType === 'Pasaporte' || docType === 'Carnet Resident' || docType === 'Otro' || condicionFiscal === 'extranjero';
    const isAddressRequired = (condicionFiscal === 'contribuyente' || condicionFiscal === 'gran contribuyente' || Boolean(nrcValue && nrcValue.trim())) && !isForeign;

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        const isForeignProv = docType === 'Pasaporte' || docType === 'Carnet Resident' || docType === 'Otro' || condicionFiscal === 'extranjero';
        const effectiveDocType = isForeignProv && (docType === 'NIT' || docType === 'DUI') ? 'Otro' : docType;

        data.exento_iva = exentoIva ? 1 : 0;
        data.es_credito = esCredito ? 1 : 0;
        data.dias_credito = esCredito ? (parseInt(diasCredito, 10) || 0) : 0;
        data.codigo_actividad = selectedActivity || null;
        data.tipo_documento = effectiveDocType;
        data.condicion_fiscal = isForeignProv ? 'extranjero' : condicionFiscal;

        const rawDoc = (docNumberValue || '').trim();
        data.numero_documento = rawDoc || null;

        if (isForeignProv) {
            data.nit = null; // Proveedores extranjeros no tienen NIT salvadoreño
            data.nrc = null; // Proveedores extranjeros no tienen NRC salvadoreño
            data.departamento = (data.departamento || selectedDept || '00').trim();
            data.distrito = (data.distrito || selectedDistrito || '00').trim();
            data.municipio = (data.municipio || selectedMun || '00').trim();
        } else {
            // Homologación automática DUI = NIT para salvadoreños
            data.nit = rawDoc || null;
            data.nrc = (nrcValue || '').trim() || null;

            // Normalización de condición fiscal según NRC
            if (!data.nrc && data.condicion_fiscal === 'contribuyente') {
                data.condicion_fiscal = 'otro';
            } else if (data.nrc && data.condicion_fiscal === 'otro') {
                data.condicion_fiscal = 'contribuyente';
            }
        }

        // Inferencia de tipo persona: 2: Jurídica si tiene NIT o NRC, 1: Natural si tiene DUI
        data.tipo_persona = isForeignProv 
            ? (provider?.tipo_persona || '2') 
            : ((docType === 'NIT' || data.nrc) ? '2' : (provider?.tipo_persona || '1'));

        // País
        data.pais = isForeignProv ? (data.pais || selectedPais || null) : (provider?.pais || '9579');
        if (isForeignProv && (!data.pais || data.pais === '9579')) {
            toast.error('Debe seleccionar el país de origen para un proveedor extranjero');
            return;
        }

        // Correo
        const correoTrimmed = (data.correo || '').trim();
        if (correoTrimmed) {
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(correoTrimmed)) {
                toast.error('El correo electrónico no tiene un formato válido (ejemplo: proveedor@dominio.com)');
                return;
            }
            data.correo = correoTrimmed;
        } else {
            data.correo = null;
        }

        // Validación de documento
        if (data.numero_documento) {
            const docCheck = validateDocumentNumber(data.numero_documento, effectiveDocType);
            if (!docCheck.isValid) {
                toast.error(`Documento no válido: ${docCheck.error}`);
                return;
            }
        }

        // Normalización de ubicación (Opción B)
        data.departamento = (data.departamento || selectedDept || '').trim() || null;
        data.distrito = (data.distrito || selectedDistrito || '').trim() || null;
        data.municipio = (data.municipio || selectedMun || '').trim() || null;
        data.direccion = (data.direccion || '').trim() || null;

        if (isAddressRequired && !isForeignProv) {
            if (!data.departamento || !data.distrito || !data.municipio || !data.direccion) {
                toast.error('Departamento, distrito, municipio y dirección son obligatorios para contribuyentes');
                return;
            }
        }

        if (data.distrito && !isForeignProv) {
            const distritoSel = distritos.find(d => d.code === data.distrito);
            if (distritoSel && data.municipio && data.municipio !== distritoSel.muni_code) {
                toast.error('El municipio seleccionado no corresponde al distrito');
                return;
            }
        }

        mutation.mutate(data);
    };

    const fieldCls = "w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-800";
    const labelCls = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Building2 size={20} />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-900">
                            {provider ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                        </h3>
                        <p className="text-xs text-slate-500">
                            {provider ? 'Actualizar información fiscal y comercial' : 'Registro de nuevo proveedor o suplidor'}
                        </p>
                    </div>
                </div>
            }
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="sm:col-span-2">
                        <label className={labelCls}>
                            Nombre / Razón Social <span className="text-rose-500">*</span>
                        </label>
                        <input 
                            name="nombre" 
                            defaultValue={provider?.nombre} 
                            required 
                            placeholder="Ej: Distribuidora El Sol S.A. de C.V."
                            className={fieldCls} 
                        />
                    </div>

                    <div>
                        <label className={labelCls}>Nombre Comercial</label>
                        <input 
                            name="nombre_comercial" 
                            defaultValue={provider?.nombre_comercial} 
                            placeholder="Ej: El Sol Comercial"
                            className={fieldCls} 
                        />
                    </div>

                    <div>
                        <label className={labelCls}>Tipo de Documento</label>
                        <select 
                            name="tipo_documento" 
                            value={docType} 
                            onChange={(e) => {
                                const nextType = e.target.value;
                                setDocType(nextType);
                                if (nextType === 'Pasaporte' || nextType === 'Carnet Resident' || nextType === 'Otro') {
                                    if (condicionFiscal === 'contribuyente' || condicionFiscal === 'gran contribuyente') {
                                        setCondicionFiscal('extranjero');
                                    }
                                    if (!selectedDept || selectedDept === '') {
                                        setSelectedDept('00');
                                        setSelectedMun('00');
                                        setSelectedDistrito('00');
                                    }
                                    if (selectedPais === '9579') {
                                        setSelectedPais('');
                                    }
                                } else if (condicionFiscal === 'extranjero') {
                                    setCondicionFiscal('contribuyente');
                                    if (selectedDept === '00') {
                                        setSelectedDept('');
                                        setSelectedMun('');
                                        setSelectedDistrito('');
                                    }
                                    setSelectedPais('9579');
                                }
                                setDocNumberValue(nextType === 'NIT' || nextType === 'DUI' ? formatDocumentNumber(docNumberValue, nextType) : docNumberValue);
                            }}
                            className={fieldCls}
                        >
                            <option value="NIT">NIT (Empresa / Sociedad)</option>
                            <option value="DUI">DUI (Persona Natural)</option>
                            <option value="Pasaporte">Pasaporte (Extranjero)</option>
                            <option value="Carnet Resident">Carnet de Residente (Extranjero)</option>
                            <option value="Otro">Otro (Identificación Extranjera / Tax ID)</option>
                        </select>
                    </div>

                    <div>
                        <label className={labelCls}>
                            {isForeign ? 'Número de Documento / Tax ID Extranjero' : 'Número de Documento (DUI / NIT)'}
                        </label>
                        <input 
                            name="numero_documento" 
                            value={docNumberValue} 
                            onChange={(e) => setDocNumberValue(isForeign ? e.target.value : formatDocumentNumber(e.target.value, docType))}
                            placeholder={isForeign ? "Ej: Tax ID, Pasaporte, Carnet..." : docType === 'DUI' ? "00000000-0" : docType === 'NIT' ? "0000-000000-000-0" : "Número de documento"} 
                            className={`${fieldCls} font-mono`} 
                            maxLength={docType === 'DUI' ? 10 : docType === 'NIT' ? 17 : 25}
                        />
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">
                            {isForeign 
                                ? 'Documento o identificación tributaria en el país de origen (3 a 20 caracteres).' 
                                : docType === 'DUI' 
                                ? 'Persona Natural: DUI homologado (9 dígitos).' 
                                : 'Empresas / Sociedades (S.A. de C.V.): NIT institucional (14 dígitos).'}
                        </p>
                    </div>

                    <div>
                        <label className={labelCls}>
                            NRC (Registro de Contribuyente) {isForeign && <span className="text-slate-400 font-normal lowercase">(no aplica a extranjeros)</span>}
                        </label>
                        <input 
                            name="nrc" 
                            value={isForeign ? '' : nrcValue} 
                            disabled={isForeign}
                            onChange={(e) => {
                                if (isForeign) return;
                                const formatted = formatNRC(e.target.value);
                                setNrcValue(formatted);
                                const clean = formatted.replace(/\D/g, '');
                                if (clean.length > 0) {
                                    if (condicionFiscal === 'otro') {
                                        setCondicionFiscal('contribuyente');
                                    }
                                } else {
                                    if (condicionFiscal === 'contribuyente') {
                                        setCondicionFiscal('otro');
                                    }
                                }
                            }}
                            placeholder={isForeign ? "No aplica para extranjeros" : "000000-0"} 
                            className={`${fieldCls} font-mono ${isForeign ? 'bg-slate-100/70 text-slate-400 cursor-not-allowed' : ''}`} 
                        />
                    </div>

                    {isForeign && (
                        <div className="sm:col-span-2">
                            <label className={labelCls}>
                                País de Origen <span className="text-rose-500">*</span>
                            </label>
                            <select 
                                name="pais" 
                                value={selectedPais} 
                                onChange={(e) => setSelectedPais(e.target.value)} 
                                className={fieldCls} 
                                required
                            >
                                <option value="">Seleccionar país de origen...</option>
                                {countries.filter(t => t.code !== '9579' && t.code !== 'SV').map(t => (
                                    <option key={t.code} value={t.code}>{t.description}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className={labelCls}>Actividad Económica (Giro - CAT-019)</label>
                        <SearchableSelect 
                            name="codigo_actividad" 
                            options={activities} 
                            value={selectedActivity} 
                            onChange={(e) => setSelectedActivity(e.target.value)}
                            placeholder="Seleccionar actividad económica"
                        />
                    </div>

                    <div>
                        <label className={labelCls}>Condición Fiscal</label>
                        <select 
                            name="condicion_fiscal" 
                            value={condicionFiscal} 
                            onChange={(e) => {
                                const val = e.target.value;
                                setCondicionFiscal(val);
                                if (val === 'exento IVA') setExentoIva(true);
                                if (val === 'extranjero') {
                                    if (docType === 'NIT' || docType === 'DUI') {
                                        setDocType('Otro');
                                    }
                                    setSelectedDept('00');
                                    setSelectedMun('00');
                                    setSelectedDistrito('00');
                                    setNrcValue('');
                                    if (selectedPais === '9579') {
                                        setSelectedPais('');
                                    }
                                } else {
                                    if (docType === 'Otro' || docType === 'Pasaporte' || docType === 'Carnet Resident') {
                                        setDocType('NIT');
                                    }
                                    if (selectedDept === '00') {
                                        setSelectedDept('');
                                        setSelectedMun('');
                                        setSelectedDistrito('');
                                    }
                                    setSelectedPais('9579');
                                }
                            }} 
                            className={fieldCls}
                        >
                            <option value="contribuyente">Contribuyente</option>
                            <option value="gran contribuyente">Gran Contribuyente</option>
                            <option value="exento IVA">Exento IVA</option>
                            <option value="extranjero">Extranjero</option>
                            <option value="otro">Otro (Pequeño / No Contribuyente)</option>
                        </select>
                    </div>

                    <div>
                        <label className={labelCls}>Teléfono</label>
                        <input 
                            name="telefono" 
                            defaultValue={provider?.telefono} 
                            placeholder="2200-0000" 
                            className={fieldCls} 
                        />
                    </div>

                    <div>
                        <label className={labelCls}>Correo Electrónico</label>
                        <input 
                            name="correo" 
                            type="email" 
                            defaultValue={provider?.correo} 
                            placeholder="proveedor@empresa.com" 
                            className={fieldCls} 
                        />
                    </div>
                </div>

                {/* Cuadro explicativo de Percepción y Retención */}
                <div className="w-full flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                    <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
                    <div className="text-[10px] text-slate-500 leading-relaxed">
                        <p><span className="font-bold text-slate-600">Gran Contribuyente</span> = el proveedor es agente de percepción (te percibirá el 1% de IVA en compras si tu empresa no es GC).</p>
                        <p><span className="font-bold text-slate-600">Retención 1%</span> = tu empresa le retendrá el 1% al proveedor si tu empresa está designada como Gran Contribuyente ante Hacienda.</p>
                    </div>
                </div>

                {/* Dirección y Ubicación (Opción B) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label className={labelCls}>
                            Departamento {isAddressRequired && <span className="text-rose-500">*</span>}
                        </label>
                        <select 
                            name="departamento" 
                            className={fieldCls} 
                            value={selectedDept} 
                            onChange={(e) => { setSelectedDept(e.target.value); setSelectedMun(''); setSelectedDistrito(''); }} 
                            required={isAddressRequired}
                        >
                            <option value="">Seleccionar</option>
                            {departments?.map(d => <option key={d.code} value={d.code}>{d.description}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>
                            Distrito {isAddressRequired && <span className="text-rose-500">*</span>}
                        </label>
                        <select 
                            name="distrito" 
                            value={selectedDistrito} 
                            onChange={(e) => { 
                                const sel = distritos.find(d => d.code === e.target.value); 
                                setSelectedDistrito(e.target.value); 
                                setSelectedMun(sel?.muni_code || ''); 
                            }} 
                            className={fieldCls} 
                            required={isAddressRequired}
                        >
                            <option value="">Seleccionar</option>
                            {distritos?.map(d => <option key={d.code} value={d.code}>{d.description}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>
                            Municipio {isAddressRequired && <span className="text-rose-500">*</span>}
                        </label>
                        <select 
                            name="municipio" 
                            value={selectedMun} 
                            onChange={(e) => setSelectedMun(e.target.value)} 
                            className={fieldCls} 
                            required={isAddressRequired}
                        >
                            <option value="">Seleccionar</option>
                            {municipalities?.map(m => <option key={m.code} value={m.code}>{m.description}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className={labelCls}>
                        Dirección Exacta {isAddressRequired && <span className="text-rose-500">*</span>}
                    </label>
                    <textarea 
                        name="direccion" 
                        defaultValue={provider?.direccion} 
                        required={isAddressRequired} 
                        placeholder={isAddressRequired ? "Dirección completa..." : "Dirección completa (opcional)..."} 
                        className={`${fieldCls} h-14 resize-none`} 
                    />
                </div>

                {/* Opciones Tributarias y Comerciales Compactas */}
                <div className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-2.5">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Tributario:</span>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 hover:text-indigo-600 transition-colors select-none">
                            <input 
                                type="checkbox" 
                                name="exento_iva" 
                                checked={exentoIva} 
                                onChange={(e) => setExentoIva(e.target.checked)} 
                                className="accent-indigo-600 rounded w-4 h-4 cursor-pointer" 
                            />
                            Exento de IVA
                        </label>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-x-5 gap-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Comercial:</span>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 hover:text-indigo-600 transition-colors select-none">
                            <input 
                                type="checkbox" 
                                name="es_credito" 
                                checked={esCredito} 
                                onChange={(e) => { 
                                    setEsCredito(e.target.checked); 
                                    if (e.target.checked && !diasCredito) setDiasCredito('30'); 
                                }} 
                                className="accent-indigo-600 rounded w-4 h-4 cursor-pointer" 
                            />
                            Crédito (CxP)
                        </label>
                        {esCredito && (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white border border-indigo-200 rounded-lg shadow-sm">
                                <span className="text-[10px] font-bold text-indigo-700 uppercase">Días:</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={diasCredito}
                                    onChange={(e) => setDiasCredito(e.target.value)}
                                    className="w-14 px-1 py-0.5 text-center text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-5 py-2.5 text-slate-500 font-semibold hover:text-slate-700 transition-colors text-xs"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit" 
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all text-xs shadow-md shadow-indigo-600/20 active:scale-95"
                    >
                        {provider ? 'Actualizar Proveedor' : 'Registrar Proveedor'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ProviderModal;
