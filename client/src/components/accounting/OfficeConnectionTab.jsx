import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Save, CheckCircle2, XCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const inputCls = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all";
const labelCls = "text-[11px] font-bold text-slate-500 uppercase block mb-2";

const OfficeConnectionTab = () => {
    const queryClient = useQueryClient();
    const [showPassword, setShowPassword] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [form, setForm] = useState({ host: '', port: '3306', user: '', password: '', database: '' });

    const { data: config, isLoading } = useQuery({
        queryKey: ['office-connection'],
        queryFn: async () => (await axios.get('/api/accounting/office/connection')).data,
    });

    useEffect(() => {
        if (config && Object.keys(config).length > 0) {
            setForm({
                host: config.host || '',
                port: String(config.port || '3306'),
                user: config.user || '',
                password: '',
                database: config.database || '',
            });
        }
    }, [config]);

    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    const saveMutation = useMutation({
        mutationFn: (data) => axios.post('/api/accounting/office/connection', data),
        onSuccess: () => {
            queryClient.invalidateQueries(['office-connection']);
            toast.success('Configuración de conexión guardada');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar configuración'),
    });

    const testMutation = useMutation({
        mutationFn: (data) => axios.post('/api/accounting/office/test', data),
        onSuccess: (res) => {
            setTestResult({ success: true, message: res.data.message });
            toast.success(res.data.message);
        },
        onError: (err) => {
            const msg = err.response?.data?.message || 'Error de conexión';
            setTestResult({ success: false, message: msg });
            toast.error(msg, { duration: 5000 });
        },
    });

    const handleSave = () => {
        if (!form.host || !form.user || !form.database) {
            toast.error('Servidor, usuario y nombre de base de datos son obligatorios');
            return;
        }
        saveMutation.mutate(form);
    };

    const handleTest = () => {
        setTestResult(null);
        testMutation.mutate(form);
    };

    return (
        <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-6">
            <div>
                <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Conexión a Oficina</span>
                <p className="text-[11px] text-slate-500">
                    Configura la base de datos MySQL de la oficina. La contraseña se guarda <b>encriptada</b>.
                    Si dejas la contraseña vacía se conservará la guardada anteriormente.
                </p>
            </div>

            {isLoading ? (
                <div className="text-center py-10 text-slate-400">Cargando configuración...</div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className={labelCls}>Servidor (host)</label>
                            <input value={form.host} onChange={set('host')} placeholder="ej: 192.168.1.10" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Puerto</label>
                            <input value={form.port} onChange={set('port')} type="number" placeholder="3306" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Base de Datos</label>
                            <input value={form.database} onChange={set('database')} placeholder="ej: db_oficina" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Usuario</label>
                            <input value={form.user} onChange={set('user')} placeholder="ej: root" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Contraseña</label>
                            <div className="relative">
                                <input
                                    value={form.password}
                                    onChange={set('password')}
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    className={`${inputCls} pr-12`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {testResult && (
                        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] font-medium ${testResult.success ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                            {testResult.success ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <XCircle size={18} className="shrink-0 mt-0.5" />}
                            <span>{testResult.message}</span>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleTest}
                            disabled={testMutation.isPending || saveMutation.isPending}
                            className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all disabled:opacity-50"
                        >
                            {testMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} className="text-emerald-500" />}
                            {testMutation.isPending ? 'Probando...' : 'Probar Conexión'}
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saveMutation.isPending || testMutation.isPending}
                            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all disabled:opacity-50"
                        >
                            {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {saveMutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default OfficeConnectionTab;