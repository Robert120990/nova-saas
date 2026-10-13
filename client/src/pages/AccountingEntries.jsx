import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Plus, Eye, Ban, Edit, FileText, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';
import Table from '../components/ui/Table';
import { AccountingEntryModal, AccountingEntryViewModal } from '../components/accounting';
import { unwrapList } from '../utils/apiUtils';
import { formatDate } from '../utils/dateUtils';
import Pagination from '../components/ui/Pagination';
import Money from '../components/ui/Money';
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
    const editRequest = useRef(0);
    const viewRequest = useRef(0);
    useEffect(() => () => { editRequest.current += 1; viewRequest.current += 1; }, []);

    useDirtyTracker('partidas', isModalOpen);

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
        onError: (err) => {
            toast.error(err?.response?.status === 404 ? 'La partida seleccionada ya no existe o fue eliminada' : (err?.response?.data?.message || 'Error al anular partida'));
            if (err?.response?.status === 404) queryClient.invalidateQueries({ queryKey: ['entries'] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }) => axios.put(`/api/accounting/entries/${id}`, data, { headers }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['entries'] }); setIsModalOpen(false); setEditingEntry(null); resetForm(); toast.success('Partida actualizada'); },
        onError: (err) => {
            if (err?.response?.status === 404) {
                toast.error('La partida ya no existe o fue eliminada en el servidor');
                setIsModalOpen(false); setEditingEntry(null); resetForm();
                queryClient.invalidateQueries({ queryKey: ['entries'] });
            } else {
                toast.error(err?.response?.data?.message || 'Error al actualizar partida');
            }
        },
    });

    const resetForm = () => {
        editRequest.current += 1;
        setEditingEntry(null);
    };

    const handleEdit = async (entry) => {
        if (createMutation.isPending || updateMutation.isPending) return;
        const request = ++editRequest.current;
        try {
            const { data } = await axios.get(`/api/accounting/entries/${entry.id}`, { headers });
            if (request !== editRequest.current) return;
            setEditingEntry(data);
            setIsModalOpen(true);
        } catch (e) {
            if (request === editRequest.current) {
                if (e?.response?.status === 404) {
                    toast.error('La partida seleccionada ya no existe o fue eliminada');
                    queryClient.invalidateQueries({ queryKey: ['entries'] });
                } else {
                    toast.error('Error al cargar partida');
                }
            }
        }
    };

    const handleView = async (entry) => {
        const request = ++viewRequest.current;
        try {
            const { data } = await axios.get(`/api/accounting/entries/${entry.id}`, { headers });
            if (request === viewRequest.current) setViewEntry(data);
        } catch (e) {
            if (request === viewRequest.current) {
                if (e?.response?.status === 404) {
                    toast.error('La partida seleccionada ya no existe o fue eliminada');
                    queryClient.invalidateQueries({ queryKey: ['entries'] });
                } else {
                    toast.error('Error al cargar partida');
                }
            }
        }
    };

    const handleSaveEntry = (formData) => {
        if (createMutation.isPending || updateMutation.isPending) return;
        if (editingEntry) {
            updateMutation.mutate({
                id: editingEntry.id,
                description: formData.description,
                expected_version: editingEntry.version,
                lines: formData.lines
            });
        } else {
            createMutation.mutate(formData);
        }
    };

    const tableHeaders = [
        { label: 'Número', className: 'w-28 px-3' },
        { label: 'Fecha', className: 'w-24 px-2' },
        { label: 'Tipo', className: 'w-32 px-2' },
        { label: 'Descripción', className: 'px-2' },
        { label: 'Débito', className: 'w-28 px-2 text-right' },
        { label: 'Crédito', className: 'w-28 px-2 text-right' },
        { label: 'Estado', className: 'w-24 px-2 text-center' },
        { label: '', className: 'w-20 px-2 text-right' },
    ];

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4 animate-in fade-in pb-20">
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

            <Table
                headers={tableHeaders}
                data={filteredEntries}
                isLoading={isLoading}
                compact
                noHorizontalScroll
                tableClassName="table-fixed w-full"
                renderCard={(e) => (
                    <div className="flex flex-col gap-1.5 text-xs">
                        <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-slate-900">{e.number}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${e.status === 'posted' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : e.status === 'voided' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                                {e.status === 'posted' ? 'Contabilizado' : e.status === 'voided' ? 'Anulado' : 'Borrador'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>{formatDate(e.date)}</span>
                            <span className="font-medium text-slate-700">{e.entry_type_name}</span>
                        </div>
                        {e.description && (
                            <p className="text-slate-600 text-[11px] line-clamp-2" title={e.description}>{e.description}</p>
                        )}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 font-mono text-[11px]">
                            <span className="text-emerald-600 font-bold">Débito: <Money value={e.total_debit} /></span>
                            <span className="text-rose-600 font-bold">Crédito: <Money value={e.total_credit} /></span>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                            <button onClick={() => handleView(e)} className="p-1 text-slate-500 hover:text-indigo-600 text-[11px] flex items-center gap-1 font-semibold"><Eye size={13} /> Ver</button>
                            <button onClick={() => handleEdit(e)} className="p-1 text-slate-500 hover:text-amber-600 text-[11px] flex items-center gap-1 font-semibold"><Edit size={13} /> Editar</button>
                            {e.status === 'posted' && (
                                <button
                                    onClick={async () => {
                                        const ok = await confirm({ title: 'Anular Partida', message: '¿Anular esta partida contable?', confirmLabel: 'Anular' });
                                        if (ok) voidMutation.mutate(e.id);
                                    }}
                                    className="p-1 text-slate-500 hover:text-rose-600 text-[11px] flex items-center gap-1 font-semibold"
                                >
                                    <Ban size={13} /> Anular
                                </button>
                            )}
                        </div>
                    </div>
                )}
                renderRow={(e) => (
                    <tr key={e.id} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="px-3 py-1 font-mono font-bold text-[11px] text-slate-900 truncate" title={e.number}>{e.number}</td>
                        <td className="px-2 py-1 text-[11px] text-slate-600 whitespace-nowrap">{formatDate(e.date)}</td>
                        <td className="px-2 py-1 text-[11px] font-semibold text-slate-700 truncate" title={e.entry_type_name}>{e.entry_type_name}</td>
                        <td className="px-2 py-1 text-[11px] text-slate-600 truncate" title={e.description}>{e.description}</td>
                        <td className="px-2 py-1 font-bold text-[11px] text-emerald-600 font-mono text-right whitespace-nowrap"><Money value={e.total_debit} /></td>
                        <td className="px-2 py-1 font-bold text-[11px] text-rose-600 font-mono text-right whitespace-nowrap"><Money value={e.total_credit} /></td>
                        <td className="px-2 py-1 text-center whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${e.status === 'posted' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : e.status === 'voided' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                                {e.status === 'posted' ? 'Contabilizado' : e.status === 'voided' ? 'Anulado' : 'Borrador'}
                            </span>
                        </td>
                        <td className="px-2 py-1 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-0.5">
                                <button aria-label="Ver partida" onClick={() => handleView(e)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Ver partida"><Eye size={13} /></button>
                                <button aria-label="Editar partida" onClick={() => handleEdit(e)} className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Editar partida"><Edit size={13} /></button>
                                {e.status === 'posted' && (
                                    <button
                                        onClick={async () => {
                                            const ok = await confirm({ title: 'Anular Partida', message: '¿Anular esta partida contable?', confirmLabel: 'Anular' });
                                            if (ok) voidMutation.mutate(e.id);
                                        }}
                                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                        title="Anular partida"
                                    >
                                        <Ban size={13} />
                                    </button>
                                )}
                            </div>
                        </td>
                    </tr>
                )}
            />

            {entriesData && <Pagination page={page} totalPages={entriesData.totalPages || 1} onPageChange={setPage} />}

            <AccountingEntryModal
                open={isModalOpen}
                onClose={() => {
                    if (createMutation.isPending || updateMutation.isPending) return;
                    setIsModalOpen(false);
                    resetForm();
                }}
                onSubmit={handleSaveEntry}
                editingEntry={editingEntry}
                entryTypes={entryTypes}
                accounts={accounts}
                isSaving={createMutation.isPending || updateMutation.isPending}
            />
            <AccountingEntryViewModal
                open={!!viewEntry}
                onClose={() => { viewRequest.current += 1; setViewEntry(null); }}
                entry={viewEntry}
            />
        </div>
    );
};

export default AccountingEntries;
