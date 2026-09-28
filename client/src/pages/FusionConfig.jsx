import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Cpu, Server, CheckCircle2, AlertCircle, Loader2, Save, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { unwrapList } from '../utils/apiUtils';

export default function FusionConfig() {
    const queryClient = useQueryClient();
    const [stationForm, setStationForm] = useState({});
    const [showPassword, setShowPassword] = useState({});
    const [testingBranchId, setTestingBranchId] = useState(null);
    const [testResults, setTestResults] = useState({});

    const { data: stations = [], isLoading } = useQuery({
        queryKey: ['gas-fusion-configs'],
        queryFn: async () => unwrapList(await axios.get('/api/gas-station/fusion/configs')),
    });

    useEffect(() => {
        if (Array.isArray(stations) && stations.length > 0) {
            setStationForm(prev => {
                const next = { ...prev };
                for (const s of stations) {
                    if (!next[s.branch_id]) {
                        next[s.branch_id] = {
                            fusion_host: s.fusion_host || '',
                            fusion_user: s.fusion_user || '',
                            fusion_password: '',
                        };
                    }
                }
                return next;
            });
        }
    }, [stations]);

    const handleAutofillDefaults = (branchId) => {
        setStationForm(prev => ({
            ...prev,
            [branchId]: {
                fusion_host: '10.19.4.15',
                fusion_user: 'MANAGER',
                fusion_password: 'MANAGER'
            }
        }));
        toast.info('Valores sugeridos asignados (10.19.4.15 / MANAGER). Puede probar la conexión o guardar.');
    };

    const saveMutation = useMutation({
        mutationFn: (payload) => axios.put('/api/gas-station/fusion/configs', payload),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['gas-fusion-configs'] });
            toast.success(`Parámetros guardados para la estación seleccionada`);
            setTestResults(prev => ({ ...prev, [variables.branch_id]: null }));
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al guardar la configuración');
        }
    });

    const handleFieldChange = (branchId, field, val) => {
        setStationForm(prev => ({
            ...prev,
            [branchId]: {
                ...(prev[branchId] || {}),
                [field]: val
            }
        }));
    };

    const handleSaveStation = (branchId) => {
        const formData = stationForm[branchId] || {};
        saveMutation.mutate({
            branch_id: branchId,
            fusion_host: formData.fusion_host || '',
            fusion_user: formData.fusion_user || '',
            fusion_password: formData.fusion_password !== undefined ? formData.fusion_password : ''
        });
    };

    const handleTestConnection = async (branchId) => {
        const formData = stationForm[branchId] || {};
        setTestingBranchId(branchId);
        setTestResults(prev => ({ ...prev, [branchId]: null }));

        try {
            const res = await axios.post('/api/gas-station/fusion/test-connection', {
                branch_id: branchId,
                host: formData.fusion_host,
                username: formData.fusion_user,
                password: formData.fusion_password
            });
            setTestResults(prev => ({
                ...prev,
                [branchId]: { success: true, message: res.data?.message || 'Conexión exitosa' }
            }));
            toast.success('Conexión con Fusion FFC establecida');
        } catch (error) {
            const msg = error.response?.data?.message || error.message || 'Error de conexión con Fusion';
            setTestResults(prev => ({
                ...prev,
                [branchId]: { success: false, message: msg }
            }));
            toast.error(msg);
        } finally {
            setTestingBranchId(null);
        }
    };

    const labelCls = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1";
    const fieldCls = "w-full border border-slate-300 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white";

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Cpu className="text-indigo-600" size={24} />
                        Controladores Fusion FFC
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Parametrización de conexión a Wayne Fusion Forecourt Controller (FFC) por estación de servicio
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['gas-fusion-configs'] })}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                        <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                        Actualizar
                    </button>
                </div>
            </div>

            <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-950 flex items-start gap-3">
                <Server size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="font-semibold text-indigo-900">Integración Directa con Wayne Fusion FFC</p>
                    <p className="text-indigo-700/90 text-[11px] leading-relaxed">
                        Configure la dirección IP, usuario y contraseña de cada estación para que el sistema consulte automáticamente las lecturas de totalizadores (pestaña Others) y el monto total de ventas (pestaña Sales) al momento de realizar los cierres de turno.
                    </p>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
                    <Loader2 size={24} className="animate-spin text-indigo-600" />
                    <span className="ml-3 text-xs font-medium text-slate-500">Cargando estaciones...</span>
                </div>
            ) : stations.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-xs space-y-3">
                    <p>No se encontraron estaciones (sucursales) registradas para esta empresa.</p>
                    <button
                        type="button"
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['gas-fusion-configs'] })}
                        className="px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors inline-flex items-center gap-1.5"
                    >
                        <RefreshCw size={14} />
                        Reintentar carga de estaciones
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-5">
                    {stations.map(st => {
                        const form = stationForm[st.branch_id] || {};
                        const isTesting = testingBranchId === st.branch_id;
                        const isSaving = saveMutation.isPending && saveMutation.variables?.branch_id === st.branch_id;
                        const result = testResults[st.branch_id];
                        const showPass = Boolean(showPassword[st.branch_id]);

                        return (
                            <div key={st.branch_id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-slate-300">
                                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5">
                                        <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 text-[11px] font-black font-mono">
                                            {st.codigo || 'S/C'}
                                        </span>
                                        <h3 className="text-sm font-bold text-slate-800">{st.nombre}</h3>
                                        <button
                                            type="button"
                                            onClick={() => handleAutofillDefaults(st.branch_id)}
                                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-lg transition-colors ml-2"
                                            title="Llenar con 10.19.4.15 / MANAGER / MANAGER"
                                        >
                                            Sugerir 10.19.4.15
                                        </button>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase text-slate-400">
                                        ID Sucursal: #{st.branch_id}
                                    </span>
                                </div>

                                <div className="p-5 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className={labelCls}>Dirección IP / Host</label>
                                            <input
                                                type="text"
                                                placeholder="Ej: 10.19.4.15"
                                                value={form.fusion_host || ''}
                                                onChange={(e) => handleFieldChange(st.branch_id, 'fusion_host', e.target.value)}
                                                className={fieldCls}
                                            />
                                            <span className="text-[10px] text-slate-400 mt-1 block">
                                                IP de la consola (o URL https://IP)
                                            </span>
                                        </div>

                                        <div>
                                            <label className={labelCls}>Usuario Fusion</label>
                                            <input
                                                type="text"
                                                placeholder="Ej: manager"
                                                value={form.fusion_user || ''}
                                                onChange={(e) => handleFieldChange(st.branch_id, 'fusion_user', e.target.value)}
                                                className={fieldCls}
                                            />
                                            <span className="text-[10px] text-slate-400 mt-1 block">
                                                Usuario con acceso a period reports
                                            </span>
                                        </div>

                                        <div>
                                            <label className={labelCls}>Contraseña</label>
                                            <div className="relative">
                                                <input
                                                    type={showPass ? 'text' : 'password'}
                                                    placeholder={st.has_password ? '••••••••' : 'Ingrese contraseña'}
                                                    value={form.fusion_password || ''}
                                                    onChange={(e) => handleFieldChange(st.branch_id, 'fusion_password', e.target.value)}
                                                    className={`${fieldCls} pr-10`}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(p => ({ ...p, [st.branch_id]: !showPass }))}
                                                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                                                    title={showPass ? 'Ocultar' : 'Mostrar'}
                                                >
                                                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                            <span className="text-[10px] text-slate-400 mt-1 block">
                                                {st.has_password ? 'Contraseña configurada (escriba para cambiar)' : 'Sin contraseña'}
                                            </span>
                                        </div>
                                    </div>

                                    {result && (
                                        <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${result.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                                            {result.success ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <AlertCircle size={16} className="text-rose-600 shrink-0" />}
                                            <span className="font-medium">{result.message}</span>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => handleTestConnection(st.branch_id)}
                                            disabled={isTesting || !form.fusion_host || !form.fusion_user}
                                            className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            {isTesting ? <Loader2 size={14} className="animate-spin text-indigo-600" /> : <Server size={14} />}
                                            {isTesting ? 'Probando...' : 'Probar Conexión'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSaveStation(st.branch_id)}
                                            disabled={isSaving}
                                            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-indigo-100"
                                        >
                                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                            {isSaving ? 'Guardando...' : 'Guardar Parámetros'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
