import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Plus, Eye, Ban, Edit, FileText, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';
import Table from '../components/ui/Table';
import { AccountingEntryModal, AccountingEntryViewModal, AccountingAccountSearchModal } from '../components/accounting';
import { unwrapList } from '../utils/apiUtils';
import { formatDate } from '../utils/dateUtils';
import Pagination from '../components/ui/Pagination';
import Money from '../components/ui/Money';
import { matchesQuery, matchScore } from '../utils/fuzzySearch';
import { useDirtyTracker } from '../hooks/useDirtyTracker';
import { useAuth } from '../context/AuthContext';

const AccountingEntries = () => {
    const { user } = useAuth();
    const companyId = user?.company_id;
    const headers = { 'x-company-id': companyId };
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const [page, setPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewEntry, setViewEntry] = useState(null);
    const [editingEntry, setEditingEntry] = useState(null);
    const [search, setSearch] = useState('');
    const [accountSearch, setAccountSearch] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [accountModalSearch, setAccountModalSearch] = useState('');
    const [lines, setLines] = useState([]);
    const editRequest = useRef(0);
    const viewRequest = useRef(0);
    useEffect(() => () => { editRequest.current += 1; viewRequest.current += 1; }, []);

    useDirtyTracker('partidas', lines.length > 0);

    const { data: entriesData, isLoading } = useQuery({
        queryKey: ['entries', companyId, page],
        queryFn: async ({ signal }) => (await axios.get(`/api/accounting/entries?page=${page}&limit=15`, { headers, signal })).data,
        enabled: !!companyId,
    });

    const entries = unwrapList(entriesData);
    const filteredEntries = useMemo(() => {
        if (!search) return entries;
        const q = search.toLowerCase();
        return entries.filter(e => 
            e.number?.toLowerCase().includes(q) || 
            e.description?.toLowerCase().includes(q) ||
            e.entry_type_name?.toLowerCase().includes(q)
        );
    }, [entries, search]);

    const { data: entryTypes = [] } = useQuery({
        queryKey: ['entryTypes', companyId], queryFn: async ({ signal }) => unwrapList(await axios.get('/api/accounting/entry-types', { headers, signal })), enabled: !!companyId,
    });
    const { data: accounts = [] } = useQuery({
        queryKey: ['accounts', companyId], queryFn: async ({ signal }) => unwrapList(await axios.get('/api/accounting/accounts', { headers, signal })), enabled: !!companyId,
    });

    const createMutation = useMutation({
        mutationFn: (data) => axios.post('/api/accounting/entries', data, { headers }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['entries'] }); setIsModalOpen(false); resetForm(); toast.success('Partida registrada'); },
        onError: (err) => toast.error(err.response?.data?.message || 'Error'),
    });

    const voidMutation = useMutation({
        mutationFn: (id) => axios.put(`/api/accounting/entries/${id}/void`, {}, { headers }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['entries'] }); toast.success('Partida anulada'); },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }) => axios.put(`/api/accounting/entries/${id}`, data, { headers }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['entries'] }); setIsModalOpen(false); setEditingEntry(null); resetForm(); toast.success('Partida actualizada'); },
        onError: (err) => toast.error(err.response?.data?.message || 'Error'),
    });

    const resetForm = () => {
        editRequest.current += 1;
        setLines([]);
        setAccountSearch('');
        setSelectedAccountId('');
        setIsAccountModalOpen(false);
        setAccountModalSearch('');
    };

    const handleEdit = async (entry) => {
        if (createMutation.isPending || updateMutation.isPending) return;
        const request = ++editRequest.current;
        try {
            const { data } = await axios.get(`/api/accounting/entries/${entry.id}`, { headers });
            if (request !== editRequest.current) return;
            setAccountSearch('');
            setSelectedAccountId('');
            setEditingEntry(data);
            setLines(unwrapList(data.lines).map(l => ({
                account_id: l.account_id,
                description: l.description || '',
                debit: l.debit ? parseFloat(l.debit).toFixed(2) : '',
                credit: l.credit ? parseFloat(l.credit).toFixed(2) : '',
            })));
            setIsModalOpen(true);
        } catch (e) {
            if (request === editRequest.current) toast.error('Error al cargar partida');
        }
    };

    const removeLine = (idx) => setLines(rows => rows.filter((_, i) => i !== idx));

    const handleView = async (entry) => {
        const request = ++viewRequest.current;
        try {
            const { data } = await axios.get(`/api/accounting/entries/${entry.id}`, { headers });
            if (request === viewRequest.current) setViewEntry(data);
        } catch {
            if (request === viewRequest.current) toast.error('Error al cargar partida');
        }
    };

    const totalDebit = lines.reduce((s, l) => s + parseFloat(l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + parseFloat(l.credit || 0), 0);
    const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && (Math.abs(totalDebit) > 0 || Math.abs(totalCredit) > 0);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (createMutation.isPending || updateMutation.isPending) return;
        const fd = new FormData(e.target);
        if (!balanced) return toast.error('El débito y crédito no cuadran');
        const entryData = {
            lines: lines.map(l => ({
                account_id: l.account_id,
                description: l.description,
                debit: parseFloat(l.debit || 0),
                credit: parseFloat(l.credit || 0),
            })),
        };
        if (editingEntry) {
            entryData.description = fd.get('description') || editingEntry.description;
            entryData.expected_version = editingEntry.version;
            updateMutation.mutate({ id: editingEntry.id, ...entryData });
        } else {
            entryData.entry_type_id = fd.get('entry_type_id');
            entryData.date = fd.get('date');
            entryData.description = fd.get('description');
            createMutation.mutate(entryData);
        }
    };

    const accountsByType = {};
    accounts.forEach(a => {
        const typeName = a.type_name || 'Otros';
        if (!accountsByType[typeName]) accountsByType[typeName] = [];
        accountsByType[typeName].push(a);
    });

    const accountResults = useMemo(() => {
        if (!accountSearch) return [];
        return accounts
            .filter(a => a.allows_entries && matchesQuery(`${a.code} ${a.name}`, accountSearch))
            .map(a => ({ a, score: matchScore(`${a.code} ${a.name}`, accountSearch) }))
            .sort((x, y) => x.score - y.score)
            .slice(0, 10)
            .map(x => x.a);
    }, [accounts, accountSearch]);

    const accountModalResults = useMemo(() => {
        if (!accountModalSearch) return accounts;
        return accounts
            .filter(a => matchesQuery(`${a.code} ${a.name}`, accountModalSearch))
            .map(a => ({ a, score: matchScore(`${a.code} ${a.name}`, accountModalSearch) }))
            .sort((x, y) => x.score - y.score)
            .map(x => x.a);
    }, [accounts, accountModalSearch]);

    // F3: abrir modal de búsqueda de cuenta
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'F3' && isModalOpen) {
                e.preventDefault();
                setIsAccountModalOpen(true);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isModalOpen]);

    const handleSelectAccountModal = (account) => {
        setSelectedAccountId(account.id);
        const quickAccount = document.getElementById('quick-account');
        if (quickAccount) quickAccount.value = account.code;
        setAccountSearch('');
        setIsAccountModalOpen(false);
        setAccountModalSearch('');
        document.getElementById('quick-desc')?.focus();
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3"><FileText size={28} className="text-indigo-600 shrink-0" />Partidas Contables</h1>
                    <p className="text-slate-500 font-medium">Registro de asientos contables</p>
                </div>
                <button onClick={() => { setEditingEntry(null); resetForm(); setIsModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-black uppercase text-xs flex items-center gap-2">
                    <Plus size={16} /> Nueva Partida
                </button>
            </div>

            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por número, descripción o tipo..." className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold w-full md:w-80 outline-none" />
            </div>

            <Table headers={['Número', 'Fecha', 'Tipo', 'Descripción', 'Débito', 'Crédito', 'Estado']} data={filteredEntries} isLoading={isLoading}
                renderRow={(e) => (
                    <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-6 py-1.5 font-mono font-bold text-xs">{e.number}</td>
                        <td className="px-6 py-1.5 text-xs">{formatDate(e.date)}</td>
                        <td className="px-6 py-1.5 text-xs">{e.entry_type_name}</td>
                        <td className="px-6 py-1.5 text-xs text-slate-600 max-w-xs truncate">{e.description}</td>
                        <td className="px-6 py-1.5 font-bold text-xs text-emerald-600"><Money value={e.total_debit} /></td>
                        <td className="px-6 py-1.5 font-bold text-xs text-rose-600"><Money value={e.total_credit} /></td>
                        <td className="px-6 py-1.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${e.status === 'posted' ? 'bg-emerald-50 text-emerald-600' : e.status === 'voided' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>{e.status === 'posted' ? 'Contabilizado' : e.status === 'voided' ? 'Anulado' : 'Borrador'}</span></td>
                        <td className="px-6 py-1.5">
                            <div className="flex gap-2">
                                <button aria-label="Ver partida" onClick={() => handleView(e)} className="p-1.5 text-slate-600 hover:text-indigo-600"><Eye size={14} /></button>
                                <button aria-label="Editar partida" onClick={() => handleEdit(e)} className="p-1.5 text-slate-600 hover:text-amber-600"><Edit size={14} /></button>
                                {e.status === 'posted' && <button onClick={async () => { const ok = await confirm({ title: 'Anular Partida', message: '¿Anular esta partida contable?', confirmLabel: 'Anular' }); if (ok) voidMutation.mutate(e.id); }} className="p-1.5 text-slate-600 hover:text-rose-600"><Ban size={14} /></button>}
                            </div>
                        </td>
                    </tr>
                )}
            />

            {entriesData && <Pagination page={page} totalPages={entriesData.totalPages || 1} onPageChange={setPage} />}

            <AccountingEntryModal open={isModalOpen} onClose={() => { if (createMutation.isPending || updateMutation.isPending) return; setIsModalOpen(false); setEditingEntry(null); resetForm(); }} onSubmit={handleSubmit} editingEntry={editingEntry} entryTypes={entryTypes} accountSearch={accountSearch} setAccountSearch={setAccountSearch} selectedAccountId={selectedAccountId} setSelectedAccountId={setSelectedAccountId} accountResults={accountResults} accounts={accounts} lines={lines} setLines={setLines} removeLine={removeLine} balanced={balanced} totalDebit={totalDebit} totalCredit={totalCredit} saving={createMutation.isPending || updateMutation.isPending} />
            <AccountingEntryViewModal open={!!viewEntry} onClose={() => { viewRequest.current += 1; setViewEntry(null); }} entry={viewEntry} />
            <AccountingAccountSearchModal open={isAccountModalOpen} onClose={() => { setIsAccountModalOpen(false); setAccountModalSearch(''); }} accountModalSearch={accountModalSearch} setAccountModalSearch={setAccountModalSearch} accountModalResults={accountModalResults} onSelect={handleSelectAccountModal} />
        </div>
    );
};

export default AccountingEntries;
