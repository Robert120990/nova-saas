import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Settings, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { GeneralSettingsTab, TaxSettingsTab } from '../components/settings';

const SystemSettings = () => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('general');
    
    // Configuración General
    const [systemName, setSystemName] = useState('SAAS SV');
    const [logoUrl, setLogoUrl] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isCompressing, setIsCompressing] = useState(false);

    // Configuración de Impuestos y Libros
    const [taxes, setTaxes] = useState({
        iva_rate: 13.00,
        fovial_rate: 0.20,
        cotrans_rate: 0.10,
        retencion_rate: 1.00,
        percepcion_rate: 1.00,
        compras_afectan_libro_compras: false,
        aplica_pago_cuenta: true
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
                iva_rate: taxSettings.iva_rate ?? 13.00,
                fovial_rate: taxSettings.fovial_rate ?? 0.20,
                cotrans_rate: taxSettings.cotrans_rate ?? 0.10,
                retencion_rate: taxSettings.retencion_rate ?? 1.00,
                percepcion_rate: taxSettings.percepcion_rate ?? 1.00,
                compras_afectan_libro_compras: Boolean(taxSettings.compras_afectan_libro_compras),
                aplica_pago_cuenta: taxSettings.aplica_pago_cuenta !== undefined ? Boolean(taxSettings.aplica_pago_cuenta) : true
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
            queryClient.invalidateQueries(['vat-liquidation']);
            toast.success('Parámetros de impuestos y libros guardados correctamente');
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
                    const compressedBase64 = canvas.toDataURL('image/webp', 0.8);
                    setLogoUrl(compressedBase64);
                    setPreviewUrl(compressedBase64);
                    setIsCompressing(false);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error procesando imagen:', error);
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
        const { name, value, type, checked } = e.target;
        setTaxes(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (parseFloat(value) || 0)
        }));
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
                    Impuestos y Libros
                </button>
            </div>

            {/* Contenido de Tabs */}
            {activeTab === 'general' && (
                <GeneralSettingsTab 
                    systemName={systemName}
                    setSystemName={setSystemName}
                    previewUrl={previewUrl}
                    removeLogo={removeLogo}
                    handleLogoChange={handleLogoChange}
                    isCompressing={isCompressing}
                    onSubmit={handleSettingsSubmit}
                    isPending={settingsMutation.isPending}
                />
            )}

            {activeTab === 'taxes' && (
                <TaxSettingsTab 
                    taxes={taxes}
                    onChange={handleTaxChange}
                    onSubmit={handleTaxSubmit}
                    isPending={taxMutation.isPending}
                />
            )}
        </div>
    );
};

export default SystemSettings;
