import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Settings, SlidersHorizontal, BookOpen, Database } from 'lucide-react';
import { toast } from 'sonner';
import { OfficeConnectionTab, AccountingGeneralTab, AccountingDefaultAccountsTab, AccountingSettingsConflict } from '../components/accounting';
import { unwrapList } from '../utils/apiUtils';
import { useDirtyTracker } from '../hooks/useDirtyTracker';
import { useAuth } from '../context/AuthContext';
const RESERVED_KEYS = ['resultado_ejercicio_id', 'contador_nombre', 'contador_dui', 'auditor_nombre', 'auditor_dui', 'oficina_db_host', 'oficina_db_port', 'oficina_db_user', 'oficina_db_password', 'oficina_db_name'];
const GENERAL_KEYS = RESERVED_KEYS.slice(0, 5);
const AccountingSettings = () => {
    const { user } = useAuth();
    const companyId = user?.company_id;
    const headers = { 'x-company-id': companyId };
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('general');
    const [officeVisited, setOfficeVisited] = useState(false);
    const generalDirty = useRef(false);
    const defaultsDirty = useRef(false);
    const generalSnapshot = useRef({});
    const defaultsSnapshot = useRef({});
    const generalRevision = useRef(0);
    const defaultsRevision = useRef(0);
    const [dirty, setDirty] = useState(false);
    const [settingsConflict, setSettingsConflict] = useState(null);
    useDirtyTracker('accounting-settings', dirty);

    const { data: settings, isLoading, isError } = useQuery({
        queryKey: ['accounting-settings', companyId],
        queryFn: async ({ signal }) => (await axios.get('/api/accounting/settings', { headers, signal })).data,
        enabled: !!companyId,
    });

    const { data: accounts = [] } = useQuery({
        queryKey: ['accounts', companyId],
        queryFn: async ({ signal }) => unwrapList(await axios.get('/api/accounting/accounts', { headers, signal })),
        enabled: !!companyId,
    });

    const [form, setFormState] = useState({ resultado_ejercicio_id: '', contador_nombre: '', contador_dui: '', auditor_nombre: '', auditor_dui: '' });
    const [defaultAccounts, setDefaultAccountsState] = useState([]);
    const [initialKeys, setInitialKeys] = useState([]);
    const setForm = (next) => { generalRevision.current += 1; generalDirty.current = true; setDirty(true); setFormState(next); };
    const setDefaultAccounts = (next) => { defaultsRevision.current += 1; defaultsDirty.current = true; setDirty(true); setDefaultAccountsState(next); };

    useEffect(() => {
        if (settings && !generalDirty.current) {
            generalSnapshot.current = Object.fromEntries(GENERAL_KEYS.map(key => [key, settings[key] ?? null]));
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
            .filter(([k]) => !RESERVED_KEYS.includes(k) && !/^PARTIDA_(VENTAS|COMPRAS|CXC|CXP|CIERRE|APERTURA)_/i.test(k))
            .map(([key, value]) => ({ key, account_id: String(value || '') }));
        setDefaultAccountsState(rows);
        defaultsSnapshot.current = Object.fromEntries(rows.map(row => [row.key, settings[row.key]]));
        setInitialKeys(rows.map(r => r.key));
    }, [settings]);

    const saveMutation = useMutation({
        mutationFn: ({ revision: _revision, ...data }) => axios.post('/api/accounting/settings', data, { headers }),
        onSuccess: async (_response, payload) => {
            generalSnapshot.current = { ...payload.settings };
            generalDirty.current = generalRevision.current !== payload.revision;
            setDirty(generalDirty.current || defaultsDirty.current);
            await queryClient.invalidateQueries({ queryKey: ['accounting-settings'] });
            await queryClient.invalidateQueries({ queryKey: ['accounting-generation-config'] });
            toast.success('Configuración guardada');
        },
        onError: (err) => {
            if (err.response?.status === 409) setSettingsConflict({ scope: 'general', items: unwrapList(err.response.data.conflicts) });
            toast.error(err.response?.data?.message || 'Error');
        },
    });

    const saveDefaultsMutation = useMutation({
        mutationFn: ({ revision: _revision, ...data }) => axios.post('/api/accounting/settings', data, { headers }),
        onSuccess: async (_response, payload) => {
            defaultsSnapshot.current = { ...payload.settings };
            setInitialKeys(Object.keys(payload.settings));
            defaultsDirty.current = defaultsRevision.current !== payload.revision;
            setDirty(generalDirty.current || defaultsDirty.current);
            await queryClient.invalidateQueries({ queryKey: ['accounting-settings'] });
            await queryClient.invalidateQueries({ queryKey: ['accounting-generation-config'] });
            toast.success('Cuentas por defecto guardadas');
        },
        onError: (err) => {
            if (err.response?.status === 409) setSettingsConflict({ scope: 'defaults', items: unwrapList(err.response.data.conflicts) });
            toast.error(err.response?.data?.message || 'Error');
        },
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
            if (RESERVED_KEYS.includes(k) || /^PARTIDA_(VENTAS|COMPRAS|CXC|CXP|CIERRE|APERTURA)_/i.test(k)) return `La clave ${k} está reservada`;
            if (keys.has(k)) return `Clave duplicada: ${k}`;
            keys.add(k);
            if (!row.account_id) return `Debe seleccionar una cuenta para la clave ${k}`;
        }
        return null;
    };

    const saveDefaultAccounts = () => {
        if (settingsConflict?.scope === 'defaults' || saveDefaultsMutation.isPending) return;
        const error = validateRows();
        if (error) { toast.error(error); return; }
        const currentKeys = defaultAccounts.map(r => r.key.trim());
        const settingsObj = {};
        defaultAccounts.forEach(r => { settingsObj[r.key.trim()] = r.account_id; });
        const remove = initialKeys.filter(k => !currentKeys.includes(k));
        const expected = Object.fromEntries([...new Set([...currentKeys, ...remove])].map(key => [key, defaultsSnapshot.current[key] ?? null]));
        saveDefaultsMutation.mutate({ settings: settingsObj, remove, expected_settings: expected, revision: defaultsRevision.current });
    };

    const saveGeneralSettings = () => {
        if (settingsConflict?.scope === 'general' || saveMutation.isPending) return;
        saveMutation.mutate({ settings: { ...form }, expected_settings: { ...generalSnapshot.current }, revision: generalRevision.current });
    };

    const resolveSettingsConflict = (discard) => {
        const general = settingsConflict.scope === 'general';
        const snapshot = general ? generalSnapshot : defaultsSnapshot;
        const latest = { ...snapshot.current };
        settingsConflict.items.forEach(item => {
            if (item.current === null && !general) delete latest[item.key];
            else latest[item.key] = item.current;
        });
        snapshot.current = latest;
        if (discard) {
            if (general) {
                setFormState(Object.fromEntries(GENERAL_KEYS.map(key => [key, latest[key] ?? ''])));
                generalDirty.current = false;
                generalRevision.current += 1;
            } else {
                setDefaultAccountsState(Object.entries(latest).map(([key, value]) => ({ key, account_id: String(value ?? '') })));
                setInitialKeys(Object.keys(latest));
                defaultsDirty.current = false;
                defaultsRevision.current += 1;
            }
            setDirty(generalDirty.current || defaultsDirty.current);
        }
        setSettingsConflict(null);
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
                        onClick={() => { setActiveTab(t.id); if (t.id === 'oficina') setOfficeVisited(true); }}
                        className={`px-6 md:px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                            activeTab === t.id ? 'bg-white text-indigo-600 shadow-xl scale-[1.02]' : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <t.icon size={14} />
                        {t.label}
                    </button>
                ))}
            </div>

            <AccountingSettingsConflict conflict={settingsConflict} accounts={accounts}
                draft={settingsConflict?.scope === 'general' ? form : Object.fromEntries(defaultAccounts.map(row => [row.key.trim(), row.account_id]))}
                onDiscard={() => resolveSettingsConflict(true)} onKeep={() => resolveSettingsConflict(false)} />

            {isError && settings && <p className="text-rose-600">No se pudo actualizar la configuración. Se conservaron tus cambios pendientes.</p>}
            {isError && !settings ? <p className="text-rose-600">No se pudo cargar la configuración. Recarga la pantalla antes de editar.</p> : isLoading ? (
                <div className="text-center py-12 text-slate-400">Cargando...</div>
            ) : (
                <>
                    {activeTab === 'general' && <AccountingGeneralTab form={form} setForm={setForm} patrimAccounts={patrimAccounts} saveMutation={saveMutation} onSave={saveGeneralSettings} />}
{activeTab === 'cuentas' && <AccountingDefaultAccountsTab defaultAccounts={defaultAccounts} setDefaultAccounts={setDefaultAccounts} updateRow={updateRow} removeRow={removeRow} accounts={accounts} addRow={addRow} saveDefaultAccounts={saveDefaultAccounts} saveDefaultsMutation={saveDefaultsMutation} />}
{officeVisited && <div hidden={activeTab !== 'oficina'}><OfficeConnectionTab /></div>}
                </>
            )}
        </div>
    );
};

export default AccountingSettings;
