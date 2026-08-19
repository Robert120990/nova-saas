import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Settings, Save, Plus, Trash2, SlidersHorizontal, BookOpen, Search } from 'lucide-react';
import { toast } from 'sonner';

const RESERVED_KEYS = ['resultado_ejercicio_id', 'contador_nombre', 'contador_dui', 'auditor_nombre', 'auditor_dui'];

const normalizeKey = (val) => val.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 50);

const inputCls = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all";
const labelCls = "text-[10px] font-black uppercase text-slate-400 block mb-2";

const AccountSelect = ({ value, onChange, accounts, placeholder = 'Seleccionar cuenta...' }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = accounts.filter(a =>
        !query || `${a.code} ${a.name} ${a.type_name || ''}`.toLowerCase().includes(query.toLowerCase())
    );
    const selected = accounts.find(a => a.id == value);

    return (
        <div ref={ref} className="relative">
            <div className="relative">
                <input
                    value={open ? query : (selected ? `${selected.code} - ${selected.name}` : '')}
                    onChange={e => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder={placeholder}
                    className={`${inputCls} pr-10`}
                />
                <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            {open && (
                <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl">
                    {filtered.length === 0 && (
                        <div className="px-4 py-4 text-xs text-slate-400 font-medium">Sin resultados</div>
                    )}
                    {filtered.map(a => (
                        <button
                            key={a.id}
                            type="button"
                            onClick={() => { onChange(String(a.id)); setOpen(false); setQuery(''); }}
                            className={`w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-indigo-50 transition-colors ${a.id == value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}
                        >
                            <span className="font-mono text-[11px] font-bold shrink-0">{a.code}</span>
                            <span className="flex-1 truncate text-[13px] font-medium">{a.name}</span>
                            {a.type_name && <span className="text-[10px] text-slate-400 shrink-0">{a.type_name}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const AccountingSettings = () => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('general');

    const { data: settings = {}, isLoading } = useQuery({
        queryKey: ['accounting-settings'],
        queryFn: async () => (await axios.get('/api/accounting/settings')).data,
    });

    const { data: accounts = [] } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => (await axios.get('/api/accounting/accounts')).data,
    });

    const [form, setForm] = useState({ resultado_ejercicio_id: '' });
    const [defaultAccounts, setDefaultAccounts] = useState([]);
    const [initialKeys, setInitialKeys] = useState([]);

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

    useEffect(() => {
        if (!settings) return;
        const rows = Object.entries(settings)
            .filter(([k]) => !RESERVED_KEYS.includes(k))
            .map(([key, value]) => ({ key, account_id: String(value || '') }));
        setDefaultAccounts(rows);
        setInitialKeys(rows.map(r => r.key));
    }, [settings]);

    const saveMutation = useMutation({
        mutationFn: (data) => axios.post('/api/accounting/settings', { settings: data }),
        onSuccess: () => { queryClient.invalidateQueries(['accounting-settings']); toast.success('Configuración guardada'); },
        onError: (err) => toast.error(err.response?.data?.message || 'Error'),
    });

    const saveDefaultsMutation = useMutation({
        mutationFn: (data) => axios.post('/api/accounting/settings', data),
        onSuccess: () => { queryClient.invalidateQueries(['accounting-settings']); toast.success('Cuentas por defecto guardadas'); },
        onError: (err) => toast.error(err.response?.data?.message || 'Error'),
    });

    const patrimAccounts = accounts.filter(a => a.type_name?.toLowerCase().includes('patrimonio'));

    const updateRow = (index, patch) => {
        setDefaultAccounts(rows => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    };

    const addRow = () => {
        setDefaultAccounts(rows => [...rows, { key: '', account_id: '' }]);
    };

    const removeRow = (index) => {
        setDefaultAccounts(rows => rows.filter((_, i) => i !== index));
    };

    const validateRows = () => {
        const keys = new Set();
        for (const row of defaultAccounts) {
            const k = row.key.trim();
            if (!k) return 'La clave no puede estar vacía';
            if (keys.has(k)) return `Clave duplicada: ${k}`;
            keys.add(k);
            if (!row.account_id) return `Debe seleccionar una cuenta para la clave ${k}`;
        }
        return null;
    };

    const saveDefaultAccounts = () => {
        const error = validateRows();
        if (error) { toast.error(error); return; }
        const currentKeys = defaultAccounts.map(r => r.key.trim());
        const settingsObj = {};
        defaultAccounts.forEach(r => { settingsObj[r.key.trim()] = r.account_id; });
        const remove = initialKeys.filter(k => !currentKeys.includes(k));
        saveDefaultsMutation.mutate({ settings: settingsObj, remove });
    };

    const tabs = [
        { id: 'general', label: 'General', icon: SlidersHorizontal },
        { id: 'cuentas', label: 'Cuentas por Defecto', icon: BookOpen },
    ];

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in pb-20">
            <div>
                <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3"><Settings size={28} className="text-indigo-600" />Ajustes Contables</h1>
                <p className="text-slate-500 font-medium">Configuración de cuentas por defecto</p>
            </div>

            <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-2xl w-fit max-w-full shadow-inner">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveTab(t.id)}
                        className={`px-6 md:px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                            activeTab === t.id ? 'bg-white text-indigo-600 shadow-xl scale-[1.02]' : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <t.icon size={14} />
                        {t.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="text-center py-12 text-slate-400">Cargando...</div>
            ) : (
                <>
                    {activeTab === 'general' && (
                        <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-6">
                            <div>
                                <label className={labelCls}>
                                    Cuenta "Resultado del Ejercicio"
                                </label>
                                <p className="text-[11px] text-slate-500 mb-3">
                                    Usada por el Cierre Anual para saldar ingresos y gastos. Debe ser tipo <b>Patrimonio</b>.
                                </p>
                                <AccountSelect
                                    value={form.resultado_ejercicio_id}
                                    onChange={v => setForm({ ...form, resultado_ejercicio_id: v })}
                                    accounts={patrimAccounts}
                                    placeholder="Buscar cuenta de patrimonio..."
                                />
                                {form.resultado_ejercicio_id && (
                                    <p className="text-[10px] text-emerald-600 mt-1 font-bold">
                                        ✓ {patrimAccounts.find(a => a.id == form.resultado_ejercicio_id)?.name || 'Cuenta seleccionada'}
                                    </p>
                                )}
                            </div>

                            <div className="border-t pt-4">
                                <span className="text-[10px] font-black uppercase text-slate-400 mb-3 block">Firmantes de Reportes</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase">Contador</label>
                                        <input value={form.contador_nombre} onChange={e => setForm({...form, contador_nombre: e.target.value})} placeholder="Nombre del contador" className={inputCls} />
                                        <input value={form.contador_dui} onChange={e => setForm({...form, contador_dui: e.target.value})} placeholder="DUI 00000000-0" className={`${inputCls} font-mono`} />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase">Auditor</label>
                                        <input value={form.auditor_nombre} onChange={e => setForm({...form, auditor_nombre: e.target.value})} placeholder="Nombre del auditor" className={inputCls} />
                                        <input value={form.auditor_dui} onChange={e => setForm({...form, auditor_dui: e.target.value})} placeholder="DUI 00000000-0" className={`${inputCls} font-mono`} />
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

                    {activeTab === 'cuentas' && (
                        <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-5">
                            <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Cuentas por Defecto</span>
                                <p className="text-[11px] text-slate-500">
                                    Define cuentas del catálogo bajo una clave personalizada (ej: CUENTA_IVA, CUENTA_CLIENTE, CUENTA_PROVEEDOR).
                                    La clave solo acepta <b>mayúsculas, números y guion bajo</b>.
                                </p>
                            </div>

                            {defaultAccounts.length === 0 && (
                                <p className="text-[11px] text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl px-4 py-6 text-center">
                                    Aún no hay cuentas por defecto configuradas. Presiona "Agregar" para crear la primera.
                                </p>
                            )}

                            <div className="space-y-4">
                                {defaultAccounts.map((row, index) => (
                                    <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1.6fr_auto] gap-3 md:items-end bg-slate-50/50 border border-slate-100 rounded-xl p-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 block">Clave</label>
                                            <input
                                                value={row.key}
                                                onChange={e => updateRow(index, { key: normalizeKey(e.target.value) })}
                                                placeholder="CUENTA_IVA"
                                                maxLength={50}
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 block">Cuenta</label>
                                            <AccountSelect
                                                value={row.account_id}
                                                onChange={v => updateRow(index, { account_id: v })}
                                                accounts={accounts}
                                                placeholder="Buscar cuenta..."
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeRow(index)}
                                            title="Eliminar"
                                            className="flex md:flex-none items-center justify-center gap-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 md:border-0 rounded-xl px-4 py-3 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                            <span className="md:hidden text-[10px] font-black uppercase">Eliminar</span>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={addRow}
                                className="w-full border-2 border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-indigo-600 py-3.5 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 transition-all"
                            >
                                <Plus size={16} /> Agregar Cuenta por Defecto
                            </button>

                            <button
                                onClick={saveDefaultAccounts}
                                disabled={saveDefaultsMutation.isPending}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Save size={18} /> {saveDefaultsMutation.isPending ? 'Guardando...' : 'Guardar Cuentas por Defecto'}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default AccountingSettings;