import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Settings, Save } from 'lucide-react';
import { toast } from 'sonner';

const AccountingSettings = () => {
    const queryClient = useQueryClient();

    const { data: settings = {}, isLoading } = useQuery({
        queryKey: ['accounting-settings'],
        queryFn: async () => (await axios.get('/api/accounting/settings')).data,
    });

    const { data: accounts = [] } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => (await axios.get('/api/accounting/accounts')).data,
    });

    const [form, setForm] = useState({ resultado_ejercicio_id: '' });

    useEffect(() => {
        if (settings && Object.keys(settings).length > 0) {
            setForm({
                resultado_ejercicio_id: settings.resultado_ejercicio_id || '',
                contador_nombre: settings.contador_nombre || '',
                contador_dui: settings.contador_dui || '',
                auditor_nombre: settings.auditor_nombre || '',
                auditor_dui: settings.auditor_dui || '',
            });
        }
    }, [settings]);

    const saveMutation = useMutation({
        mutationFn: (data) => axios.post('/api/accounting/settings', { settings: data }),
        onSuccess: () => { queryClient.invalidateQueries(['accounting-settings']); toast.success('Configuración guardada'); },
        onError: (err) => toast.error(err.response?.data?.message || 'Error'),
    });

    const patrimAccounts = accounts.filter(a => a.type_name?.toLowerCase().includes('patrimonio'));

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in pb-20">
            <div>
                <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3"><Settings size={28} className="text-indigo-600" />Ajustes Contables</h1>
                <p className="text-slate-500 font-medium">Configuración de cuentas por defecto</p>
            </div>

            {isLoading ? (
                <div className="text-center py-12 text-slate-400">Cargando...</div>
            ) : (
                <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-6">
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-2">
                            Cuenta "Resultado del Ejercicio"
                        </label>
                        <p className="text-[11px] text-slate-500 mb-3">
                            Usada por el Cierre Anual para saldar ingresos y gastos. Debe ser tipo <b>Patrimonio</b>.
                        </p>
                        <select
                            value={form.resultado_ejercicio_id}
                            onChange={e => setForm({ ...form, resultado_ejercicio_id: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                        >
                            <option value="">Seleccionar cuenta...</option>
                            {patrimAccounts.map(a => (
                                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                            ))}
                        </select>
                        {form.resultado_ejercicio_id && (
                            <p className="text-[10px] text-emerald-600 mt-1 font-bold">
                                ✓ {patrimAccounts.find(a => a.id == form.resultado_ejercicio_id)?.name || 'Cuenta seleccionada'}
                            </p>
                        )}
                    </div>

                    <div className="border-t pt-4">
                        <span className="text-[10px] font-black uppercase text-slate-400 mb-3 block">Firmantes de Reportes</span>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <label className="text-[9px] font-bold text-slate-500 uppercase">Contador</label>
                                <input value={form.contador_nombre} onChange={e => setForm({...form, contador_nombre: e.target.value})} placeholder="Nombre del contador" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                                <input value={form.contador_dui} onChange={e => setForm({...form, contador_dui: e.target.value})} placeholder="DUI 00000000-0" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[9px] font-bold text-slate-500 uppercase">Auditor</label>
                                <input value={form.auditor_nombre} onChange={e => setForm({...form, auditor_nombre: e.target.value})} placeholder="Nombre del auditor" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                                <input value={form.auditor_dui} onChange={e => setForm({...form, auditor_dui: e.target.value})} placeholder="DUI 00000000-0" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono" />
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => saveMutation.mutate(form)}
                        disabled={saveMutation.isPending}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Save size={18} /> {saveMutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default AccountingSettings;
