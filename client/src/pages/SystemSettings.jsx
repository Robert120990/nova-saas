import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Save, Upload, Trash2, Layout, Image as ImageIcon, Type, Settings, Calculator } from 'lucide-react';
import { toast } from 'sonner';

const SystemSettings = () => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('general');
    
    // Configuración General
    const [systemName, setSystemName] = useState('SAAS SV');
    const [logoUrl, setLogoUrl] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isCompressing, setIsCompressing] = useState(false);

    // Configuración de Impuestos
    const [taxes, setTaxes] = useState({
        iva_rate: 13.00,
        fovial_rate: 0.20,
        cotrans_rate: 0.10,
        retencion_rate: 1.00,
        percepcion_rate: 1.00
    });

    // Fetches
    const { data: settings, isPending: isPendingSettings } = useQuery({
        queryKey: ['system-settings'],
        queryFn: async () => (await axios.get('/api/settings')).data,
    });

    const { data: taxSettings, isPending: isPendingTaxes } = useQuery({
        queryKey: ['tax-settings'],
        queryFn: async () => (await axios.get('/api/taxes')).data,
    });

    useEffect(() => {
        if (settings) {
            setSystemName(settings.system_name || 'SAAS SV');
            setLogoUrl(settings.logo_url);
            setPreviewUrl(settings.logo_url);
        }
    }, [settings]);

    useEffect(() => {
        if (taxSettings) {
            setTaxes({
                iva_rate: taxSettings.iva_rate || 13.00,
                fovial_rate: taxSettings.fovial_rate || 0.20,
                cotrans_rate: taxSettings.cotrans_rate || 0.10,
                retencion_rate: taxSettings.retencion_rate || 1.00,
                percepcion_rate: taxSettings.percepcion_rate || 1.00
            });
        }
    }, [taxSettings]);

    // Mutations
    const settingsMutation = useMutation({
        mutationFn: (data) => axios.put('/api/settings', data),
        onSuccess: () => {
            queryClient.invalidateQueries(['system-settings']);
            queryClient.invalidateQueries(['public-settings']);
            toast.success('Configuración general guardada correctamente');
        },
        onError: () => toast.error('Error al guardar la configuración general')
    });

    const taxMutation = useMutation({
        mutationFn: (data) => axios.put('/api/taxes', data),
        onSuccess: () => {
            queryClient.invalidateQueries(['tax-settings']);
            toast.success('Tasas de impuestos guardadas correctamente');
        },
        onError: () => toast.error('Error al guardar impuestos')
    });

    // Handlers General
    const handleLogoChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsCompressing(true);
        try {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_SIZE = 1024;
                    if (width > MAX_SIZE || height > MAX_SIZE) {
                        if (width > height) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        } else {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const compressedBase64 = canvas.toDataURL('image/webp', 0.85);
                    
                    setLogoUrl(compressedBase64);
                    setPreviewUrl(compressedBase64);
                    setIsCompressing(false);
                    if (file.size > 1024 * 1024) toast.info('Imagen grande optimizada automáticamente para el sistema');
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error compressing image:', error);
            toast.error('Error al procesar la imagen');
            setIsCompressing(false);
        }
    };

    const removeLogo = () => {
        setLogoUrl(null);
        setPreviewUrl(null);
    };

    const handleSettingsSubmit = (e) => {
        e.preventDefault();
        settingsMutation.mutate({ system_name: systemName, logo_url: logoUrl });
    };

    // Handlers Taxes
    const handleTaxChange = (e) => {
        const { name, value } = e.target;
        setTaxes(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    };

    const handleTaxSubmit = (e) => {
        e.preventDefault();
        taxMutation.mutate(taxes);
    };

    // Mostrar un estado de carga menos invasivo si es la carga inicial real
    if (isPendingSettings || isPendingTaxes) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 animate-in fade-in duration-700">
                <div className="relative">
                    <div className="w-12 h-12 border-4 border-indigo-100 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">Cargando Configuración...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Configuración del Sistema</h2>
                <p className="text-slate-500 font-medium font-spanish mt-1 text-lg">Personaliza la plataforma y parámetros fiscales</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                <button 
                    onClick={() => setActiveTab('general')}
                    className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'general' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900 border-b-transparent hover:border-slate-300'}`}
                >
                    <Settings size={18} />
                    Personalización
                </button>
                <button 
                    onClick={() => setActiveTab('taxes')}
                    className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'taxes' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900 border-b-transparent hover:border-slate-300'}`}
                >
                    <Calculator size={18} />
                    Impuestos
                </button>
            </div>

            {activeTab === 'general' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Preview Card */}
                    <div className="md:col-span-1 space-y-6">
                        <div className="bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-800 space-y-6">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Vista Previa (Sidebar)</p>
                            <div className="flex flex-col items-center gap-4">
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Logo Preview" className="h-12 w-auto object-contain" />
                                ) : (
                                    <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-600/20">
                                        {systemName.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <h3 className="text-lg font-bold text-white tracking-widest uppercase truncate w-full text-center">
                                    {systemName || 'SAAS SV'}
                                </h3>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Consejos</p>
                            <ul className="space-y-2">
                                <li className="text-xs text-slate-500 flex gap-2">
                                    <div className="w-1 h-1 bg-indigo-500 rounded-full mt-1.5 shrink-0" />
                                    Usa un logo con fondo transparente (PNG) para mejores resultados.
                                </li>
                                <li className="text-xs text-slate-500 flex gap-2">
                                    <div className="w-1 h-1 bg-indigo-500 rounded-full mt-1.5 shrink-0" />
                                    El nombre del sistema aparecerá en la barra lateral y en la pestaña del navegador.
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Form Card */}
                    <div className="md:col-span-2">
                        <form onSubmit={handleSettingsSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="p-8 space-y-8">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-slate-900 font-bold">
                                        <Type size={18} className="text-indigo-600" />
                                        <span>Identidad Visual</span>
                                    </div>
                                    
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre del Sistema</label>
                                        <input 
                                            type="text" 
                                            value={systemName}
                                            onChange={(e) => setSystemName(e.target.value)}
                                            placeholder="Ej: Mi Impresionante SaaS"
                                            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all outline-none"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-slate-50">
                                    <div className="flex items-center gap-2 text-slate-900 font-bold">
                                        <ImageIcon size={18} className="text-indigo-600" />
                                        <span>Logo Institucional</span>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-6 items-start">
                                        <div className="w-32 h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 group hover:border-indigo-400 transition-colors">
                                            {previewUrl ? (
                                                <img src={previewUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                                            ) : (
                                                <ImageIcon size={32} className="text-slate-300 group-hover:text-indigo-400" />
                                            )}
                                        </div>
                                        
                                        <div className="flex-1 space-y-3">
                                            <p className="text-sm text-slate-500 font-medium">Sube el logotipo de tu empresa. El tamaño recomendado es 200x200px o superior.</p>
                                            <div className="flex flex-wrap gap-2">
                                                <label className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-slate-900/10 ${isCompressing ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}>
                                                    <Upload size={14} className={isCompressing ? 'animate-bounce' : ''} />
                                                    <span>{isCompressing ? 'Procesando...' : 'Subir Foto'}</span>
                                                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoChange} disabled={isCompressing} />
                                                </label>
                                                {previewUrl && (
                                                    <button 
                                                        type="button" 
                                                        onClick={removeLogo}
                                                        className="bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 active:scale-95"
                                                    >
                                                        <Trash2 size={14} />
                                                        <span>Eliminar</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 px-8 py-5 flex justify-end gap-3 border-t border-slate-100">
                                <button 
                                    type="submit" 
                                    disabled={settingsMutation.isPending}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
                                >
                                    <Save size={18} />
                                    {settingsMutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {activeTab === 'taxes' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <form onSubmit={handleTaxSubmit}>
                        <div className="p-8 space-y-8">
                            <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-4">
                                <Calculator size={20} className="text-indigo-600" />
                                <span>Parámetros Fiscales</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* IVA */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">IVA (%)</label>
                                    <div className="relative">
                                        <input 
                                            type="number" step="0.01" min="0" 
                                            name="iva_rate"
                                            value={taxes.iva_rate}
                                            onChange={handleTaxChange}
                                            className="w-full px-5 py-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none"
                                            required
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 font-bold">%</div>
                                    </div>
                                    <p className="text-xs text-slate-400 ml-1">Impuesto al Valor Agregado</p>
                                </div>

                                {/* FOVIAL */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">FOVIAL ($ por Galón)</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 font-bold">$</div>
                                        <input 
                                            type="number" step="0.01" min="0" 
                                            name="fovial_rate"
                                            value={taxes.fovial_rate}
                                            onChange={handleTaxChange}
                                            className="w-full pl-8 pr-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none"
                                            required
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 ml-1">Aplica solo a combustibles marcados</p>
                                </div>

                                {/* COTRANS */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">COTRANS ($ por Galón)</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 font-bold">$</div>
                                        <input 
                                            type="number" step="0.01" min="0" 
                                            name="cotrans_rate"
                                            value={taxes.cotrans_rate}
                                            onChange={handleTaxChange}
                                            className="w-full pl-8 pr-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none"
                                            required
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 ml-1">Aplica solo a combustibles marcados</p>
                                </div>

                                {/* RETENCIÓN */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Tasa de Retención (%)</label>
                                    <div className="relative">
                                        <input 
                                            type="number" step="0.01" min="0" 
                                            name="retencion_rate"
                                            value={taxes.retencion_rate}
                                            onChange={handleTaxChange}
                                            className="w-full px-5 py-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none"
                                            required
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 font-bold">%</div>
                                    </div>
                                    <p className="text-xs text-slate-400 ml-1">Para grandes contribuyentes (habitual: 1%)</p>
                                </div>

                                {/* PERCEPCIÓN */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Tasa de Percepción (%)</label>
                                    <div className="relative">
                                        <input 
                                            type="number" step="0.01" min="0" 
                                            name="percepcion_rate"
                                            value={taxes.percepcion_rate}
                                            onChange={handleTaxChange}
                                            className="w-full px-5 py-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none"
                                            required
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 font-bold">%</div>
                                    </div>
                                    <p className="text-xs text-slate-400 ml-1">Para grandes contribuyentes (habitual: 1%)</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 px-8 py-5 flex justify-end gap-3 border-t border-slate-100">
                            <button 
                                type="submit" 
                                disabled={taxMutation.isPending}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
                            >
                                <Save size={18} />
                                {taxMutation.isPending ? 'Guardando...' : 'Guardar Impuestos'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default SystemSettings;
