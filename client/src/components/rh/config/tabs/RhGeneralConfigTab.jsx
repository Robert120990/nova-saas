import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Save, Upload, Trash2, Image as ImageIcon, Calculator } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = 'http://localhost:4000';

const RhGeneralConfigTab = () => {
    const queryClient = useQueryClient();
    const [responsable, setResponsable] = useState('');
    const [firmaPreview, setFirmaPreview] = useState(null);
    const [firmaFile, setFirmaFile] = useState(null);
    const [selloPreview, setSelloPreview] = useState(null);
    const [selloFile, setSelloFile] = useState(null);
    const [compressing, setCompressing] = useState(null);
    const [notarioNombre, setNotarioNombre] = useState('');
    const [notarioDomicilio, setNotarioDomicilio] = useState('');
    const [notarioDepartamento, setNotarioDepartamento] = useState('');
    const [calculoRentaModo, setCalculoRentaModo] = useState('segunda_quincena');

    const { data: config, isPending } = useQuery({
        queryKey: ['rh-config'],
        queryFn: async () => (await axios.get('/api/rh/config')).data
    });

    useEffect(() => {
        if (config) {
            setResponsable(config.responsable_nombre || '');
            if (config.firma_url) setFirmaPreview(`${API_BASE}${config.firma_url}`);
            if (config.sello_url) setSelloPreview(`${API_BASE}${config.sello_url}`);
            setNotarioNombre(config.notario_nombre || '');
            setNotarioDomicilio(config.notario_domicilio || '');
            setNotarioDepartamento(config.notario_departamento || '');
            setCalculoRentaModo(config.calculo_renta_modo || 'segunda_quincena');
        }
    }, [config]);

    const mutation = useMutation({
        mutationFn: (formData) => axios.put('/api/rh/config', formData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rh-config'] });
            setFirmaFile(null);
            setSelloFile(null);
            toast.success('Configuración RH guardada exitosamente');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al guardar configuración');
        }
    });

    const processImage = (file, setPreview, type) => {
        setCompressing(type);
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                const MAX = 1024;
                if (w > MAX || h > MAX) {
                    if (w > h) { h *= MAX / w; w = MAX; }
                    else { w *= MAX / h; h = MAX; }
                }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                setPreview(canvas.toDataURL('image/png'));
                setCompressing(null);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const handleFirmaChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setFirmaFile(file);
        processImage(file, setFirmaPreview, 'firma');
    };

    const handleSelloChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setSelloFile(file);
        processImage(file, setSelloPreview, 'sello');
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('responsable_nombre', responsable);
        formData.append('notario_nombre', notarioNombre);
        formData.append('notario_domicilio', notarioDomicilio);
        formData.append('notario_departamento', notarioDepartamento);
        formData.append('calculo_renta_modo', calculoRentaModo);
        if (firmaFile) formData.append('firma', firmaFile);
        if (selloFile) formData.append('sello', selloFile);
        mutation.mutate(formData);
    };

    const cls = "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px] font-medium";
    const lbl = "block text-[11px] font-bold text-slate-500 uppercase mb-1.5 ml-1";

    const UploadBox = ({ label, iconLabel, preview, onRemove, onChange, isProcessing, description }) => (
        <div className="pt-2 border-t border-slate-50">
            <label className={lbl}>{label}</label>
            <p className="text-xs text-slate-400 mb-3">{description}</p>
            <div className="flex flex-col sm:flex-row gap-5 items-start">
                <div className="w-32 h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 group hover:border-indigo-400 transition-colors">
                    {preview ? (
                        <img src={preview} alt={label} className="w-full h-full object-contain p-2" />
                    ) : (
                        <ImageIcon size={28} className="text-slate-300 group-hover:text-indigo-400" />
                    )}
                </div>
                <div className="flex-1 space-y-3">
                    <p className="text-sm text-slate-500 font-medium">PNG o JPG. Tamaño recomendado: 200x200px.</p>
                    <div className="flex flex-wrap gap-2">
                        <label className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-slate-900/10 ${isProcessing ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}>
                            <Upload size={14} className={isProcessing ? 'animate-bounce' : ''} />
                            <span>{isProcessing ? 'Procesando...' : `Subir ${iconLabel}`}</span>
                            <input type="file" className="hidden" accept="image/*" onChange={onChange} disabled={isProcessing} />
                        </label>
                        {preview && (
                            <button type="button" onClick={onRemove} className="bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 active:scale-95">
                                <Trash2 size={14} />
                                <span>Eliminar</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    if (isPending) {
        return (
            <div className="flex flex-col items-center justify-center h-48 space-y-4">
                <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">Cargando...</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 space-y-6">
                <div>
                    <label className={lbl}>Responsable de Recursos Humanos</label>
                    <input
                        type="text"
                        value={responsable}
                        onChange={(e) => setResponsable(e.target.value)}
                        placeholder="Nombre del responsable de RRHH"
                        className={cls}
                    />
                </div>

                {/* Modo de Retención de Renta (ISR) */}
                <div className="pt-2 border-t border-slate-50">
                    <div className="flex items-center gap-2 mb-1">
                        <Calculator size={16} className="text-indigo-600" />
                        <label className={lbl}>Cálculo de Retención de Renta (ISR)</label>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">
                        Configura si el impuesto sobre la renta se descuenta en la segunda quincena de forma acumulada o en cada quincena.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Opción 1: Segunda quincena (Default) */}
                        <div
                            onClick={() => setCalculoRentaModo('segunda_quincena')}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                calculoRentaModo === 'segunda_quincena'
                                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-2 ring-indigo-500/10'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                                    Segunda Quincena
                                    <span className="px-1.5 py-0.5 text-[9px] bg-indigo-100 text-indigo-700 font-extrabold rounded">
                                        Por Defecto
                                    </span>
                                </span>
                                <input
                                    type="radio"
                                    name="calculo_renta_modo"
                                    value="segunda_quincena"
                                    checked={calculoRentaModo === 'segunda_quincena'}
                                    onChange={() => setCalculoRentaModo('segunda_quincena')}
                                    className="accent-indigo-600 h-4 w-4"
                                />
                            </div>
                            <h4 className="text-[13px] font-bold text-slate-900 mb-1">
                                Tabla Mensual Acumulada
                            </h4>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                                En la 1ra quincena no se descuenta renta ($0.00). En la 2da quincena se acumula el ingreso gravado del mes completo y se aplica la tabla mensual del ISR.
                            </p>
                        </div>

                        {/* Opción 2: Cada quincena */}
                        <div
                            onClick={() => setCalculoRentaModo('cada_quincena')}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                calculoRentaModo === 'cada_quincena'
                                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-2 ring-indigo-500/10'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                                    Cada Quincena
                                </span>
                                <input
                                    type="radio"
                                    name="calculo_renta_modo"
                                    value="cada_quincena"
                                    checked={calculoRentaModo === 'cada_quincena'}
                                    onChange={() => setCalculoRentaModo('cada_quincena')}
                                    className="accent-indigo-600 h-4 w-4"
                                />
                            </div>
                            <h4 className="text-[13px] font-bold text-slate-900 mb-1">
                                Tabla Quincenal Regular
                            </h4>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                                En cada quincena (1ra y 2da) se calcula y descuenta la renta de forma independiente aplicando directamente la tabla quincenal del ISR sobre el gravado del período.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="pt-2 border-t border-slate-50">
                    <label className={lbl}>Datos del Notario</label>
                    <p className="text-xs text-slate-400 mb-3">Información del notario para documentos legales (finiquito, acuerdo de pago)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Nombre</label>
                            <input type="text" value={notarioNombre} onChange={(e) => setNotarioNombre(e.target.value)}
                                placeholder="Nombre del notario" className={cls} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Domicilio</label>
                            <input type="text" value={notarioDomicilio} onChange={(e) => setNotarioDomicilio(e.target.value)}
                                placeholder="Ciudad del notario" className={cls} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Departamento</label>
                            <input type="text" value={notarioDepartamento} onChange={(e) => setNotarioDepartamento(e.target.value)}
                                placeholder="Depto. del notario" className={cls} />
                        </div>
                    </div>
                </div>

                <UploadBox
                    label="Firma"
                    iconLabel="Firma"
                    preview={firmaPreview}
                    onRemove={() => { setFirmaPreview(null); setFirmaFile(null); }}
                    onChange={handleFirmaChange}
                    isProcessing={compressing === 'firma'}
                    description="Firma del responsable de RRHH"
                />

                <UploadBox
                    label="Sello"
                    iconLabel="Sello"
                    preview={selloPreview}
                    onRemove={() => { setSelloPreview(null); setSelloFile(null); }}
                    onChange={handleSelloChange}
                    isProcessing={compressing === 'sello'}
                    description="Sello oficial de la empresa"
                />
            </div>

            <div className="bg-slate-50 px-8 py-5 flex justify-end gap-3 border-t border-slate-100">
                <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-7 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
                >
                    <Save size={16} />
                    {mutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
                </button>
            </div>
        </form>
    );
};

export default RhGeneralConfigTab;
