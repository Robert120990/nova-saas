import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Settings, SlidersHorizontal, BookOpen, Database } from 'lucide-react';
import { toast } from 'sonner';
import { OfficeConnectionTab, AccountingGeneralTab, AccountingDefaultAccountsTab } from '../components/accounting';
import { unwrapList } from '../utils/apiUtils';
import { useDirtyTracker } from '../hooks/useDirtyTracker';
const RESERVED_KEYS = ['resultado_ejercicio_id', 'contador_nombre', 'contador_dui', 'auditor_nombre', 'auditor_dui', 'oficina_db_host', 'oficina_db_port', 'oficina_db_user', 'oficina_db_password', 'oficina_db_name'];
const AccountingSettings = () => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('general');
    const generalDirty = useRef(false);
    const defaultsDirty = useRef(false);
    const [dirty, setDirty] = useState(false);
    useDirtyTracker('accounting-settings', dirty);

    const { data: settings, isLoading, isError } = useQuery({
        queryKey: ['accounting-settings'],
        queryFn: async () => (await axios.get('/api/accounting/settings')).data,
    });

    const { data: accounts = [] } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => unwrapList(await axios.get('/api/accounting/accounts')),
    });

    const [form, setFormState] = useState({ resultado_ejercicio_id: '', contador_nombre: '', contador_dui: '', auditor_nombre: '', auditor_dui: '' });
    const [defaultAccounts, setDefaultAccountsState] = useState([]);
    const [initialKeys, setInitialKeys] = useState([]);
    const setForm = (next) => { generalDirty.current = true; setDirty(true); setFormState(next); };
    const setDefaultAccounts = (next) => { defaultsDirty.current = true; setDirty(true); setDefaultAccountsState(next); };

    useEffect(() => {
        if (settings && !generalDirty.current) {
            setFormState({
                resultado_ejercicio_id: settings.resultado_ejercicio_id || '',
                contador_nombre: settings.contador_nombre || '',
                contador_dui: settings.contador_dui || '',
                auditor_nombre: settings.auditor_nombre || '',
                auditor_dui: settings.auditor_dui || '',
            });
        }
    }, [settings]);

    useEffect(() => {
        if (!settings || defaultsDirty.current) return;
        const rows = Object.entries(settings)
            .filter(([k]) => !RESERVED_KEYS.includes(k) && !/^PARTIDA_(VENTAS|COMPRAS|CXC|CXP)_/.test(k))
            .map(([key, value]) => ({ key, account_id: String(value || '') }));
        setDefaultAccountsState(rows);
        setInitialKeys(rows.map(r => r.key));
    }, [settings]);

    const saveMutation = useMutation({
        mutationFn: (data) => axios.post('/api/accounting/settings', { settings: data }),
        onSuccess: async () => {
            generalDirty.current = false;
            setDirty(defaultsDirty.current);
            await queryClient.invalidateQueries({ queryKey: ['accounting-settings'] });
            await queryClient.invalidateQueries({ queryKey: ['accounting-generation-config'] });
            toast.success('Configuración guardada');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error'),
    });

    const saveDefaultsMutation = useMutation({
        mutationFn: (data) => axios.post('/api/accounting/settings', data),
        onSuccess: async () => {
            defaultsDirty.current = false;
            setDirty(generalDirty.current);
            await queryClient.invalidateQueries({ queryKey: ['accounting-settings'] });
            await queryClient.invalidateQueries({ queryKey: ['accounting-generation-config'] });
            toast.success('Cuentas por defecto guardadas');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error'),
    });

    const patrimAccounts = (Array.isArray(accounts) ? accounts : []).filter(a => a.type_name?.toLowerCase().includes('patrimonio'));

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
            if (RESERVED_KEYS.includes(k) || /^PARTIDA_(VENTAS|COMPRAS|CXC|CXP)_/.test(k)) return `La clave ${k} está reservada`;
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
        { id: 'oficina', label: 'Conexión Oficina', icon: Database },
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

            {isError ? <p className="text-rose-600">No se pudo cargar la configuración. Recarga la pantalla antes de editar.</p> : isLoading ? (
                <div className="text-center py-12 text-slate-400">Cargando...</div>
            ) : (
                <>
                    {activeTab === 'general' && <AccountingGeneralTab form={form} setForm={setForm} patrimAccounts={patrimAccounts} saveMutation={saveMutation} />}
{activeTab === 'cuentas' && <AccountingDefaultAccountsTab defaultAccounts={defaultAccounts} setDefaultAccounts={setDefaultAccounts} updateRow={updateRow} removeRow={removeRow} accounts={accounts} addRow={addRow} saveDefaultAccounts={saveDefaultAccounts} saveDefaultsMutation={saveDefaultsMutation} />}
{activeTab === 'oficina' && <OfficeConnectionTab />}
                </>
            )}
        </div>
    );
};

export default AccountingSettings;
