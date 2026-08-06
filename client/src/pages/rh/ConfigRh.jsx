import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Save, Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = 'http://localhost:4000';

const ConfigRh = () => {
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
        }
    }, [config]);

    const mutation = useMutation({
        mutationFn: (formData) => axios.put('/api/rh/config', formData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rh-config'] });
            setFirmaFile(null);
            setSelloFile(null);
            toast.success('Configuracion RH guardada');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al guardar configuracion');
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
                    <p className="text-sm text-slate-500 font-medium">PNG o JPG. Tamano recomendado: 200x200px.</p>
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
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">Cargando...</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-xl font-bold text-slate-900">Configuracion RH</h2>
                <p className="text-slate-500 text-[11px] font-medium">Responsable, firma y sello para documentos de Recursos Humanos</p>
            </div>

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

                    <div className="pt-2 border-t border-slate-50">
                        <label className={lbl}>Datos del Notario</label>
                        <p className="text-xs text-slate-400 mb-3">Informacion del notario para documentos legales (finiquito, acuerdo de pago)</p>
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
                        {mutation.isPending ? 'Guardando...' : 'Guardar Configuracion'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ConfigRh;
