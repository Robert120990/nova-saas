import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Plus, Eye, Ban, Edit, FileText, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';

const AccountingEntries = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const [page, setPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewEntry, setViewEntry] = useState(null);
    const [editingEntry, setEditingEntry] = useState(null);
    const [search, setSearch] = useState('');
    const [accountSearch, setAccountSearch] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [lines, setLines] = useState([{ account_id: '', description: '', debit: '', credit: '' }]);

    const { data: entriesData, isLoading } = useQuery({
        queryKey: ['entries', page],
        queryFn: async () => (await axios.get(`/api/accounting/entries?page=${page}&limit=15`)).data,
    });

    const entries = entriesData?.data || [];
    const filteredEntries = useMemo(() => {
        if (!search) return entries;
        const q = search.toLowerCase();
        return entries.filter(e => 
            e.number?.toLowerCase().includes(q) || 
            e.description?.toLowerCase().includes(q) ||
            e.entry_type_name?.toLowerCase().includes(q)
        );
    }, [entries, search]);

    const { data: accountTypes = [] } = useQuery({
        queryKey: ['accountTypes'], queryFn: async () => (await axios.get('/api/accounting/account-types')).data,
    });
    const { data: entryTypes = [] } = useQuery({
        queryKey: ['entryTypes'], queryFn: async () => (await axios.get('/api/accounting/entry-types')).data,
    });
    const { data: accounts = [] } = useQuery({
        queryKey: ['accounts'], queryFn: async () => (await axios.get('/api/accounting/accounts')).data,
    });

    const createMutation = useMutation({
        mutationFn: (data) => axios.post('/api/accounting/entries', data),
        onSuccess: () => { queryClient.invalidateQueries(['entries']); setIsModalOpen(false); resetForm(); toast.success('Partida registrada'); },
        onError: (err) => toast.error(err.response?.data?.message || 'Error'),
    });

    const voidMutation = useMutation({
        mutationFn: (id) => axios.put(`/api/accounting/entries/${id}/void`),
        onSuccess: () => { queryClient.invalidateQueries(['entries']); toast.success('Partida anulada'); },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }) => axios.put(`/api/accounting/entries/${id}`, data),
        onSuccess: () => { queryClient.invalidateQueries(['entries']); setIsModalOpen(false); setEditingEntry(null); resetForm(); toast.success('Partida actualizada'); },
        onError: (err) => toast.error(err.response?.data?.message || 'Error'),
    });

    const resetForm = () => setLines([{ account_id: '', description: '', debit: '', credit: '' }]);

    const handleEdit = async (entry) => {
        try {
            const { data } = await axios.get(`/api/accounting/entries/${entry.id}`);
            setEditingEntry(entry);
            setLines(data.lines.map(l => ({
                account_id: l.account_id,
                description: l.description || '',
                debit: l.debit ? parseFloat(l.debit).toFixed(2) : '',
                credit: l.credit ? parseFloat(l.credit).toFixed(2) : '',
            })));
            setIsModalOpen(true);
        } catch (e) {
            toast.error('Error al cargar partida');
        }
    };

    const removeLine = (idx) => { if (lines.length > 1) setLines(lines.filter((_, i) => i !== idx)); };

    const totalDebit = lines.reduce((s, l) => s + parseFloat(l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + parseFloat(l.credit || 0), 0);
    const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && (totalDebit > 0 || totalCredit > 0);

    const handleSubmit = (e) => {
        e.preventDefault();
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
        const q = accountSearch.toLowerCase();
        return accounts.filter(a => a.allows_entries && (a.code?.toLowerCase().includes(q) || a.name?.toLowerCase().includes(q))).slice(0, 10);
    }, [accounts, accountSearch]);

    // F3: enfocar búsqueda de cuenta
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'F3' && isModalOpen) {
                e.preventDefault();
                document.getElementById('quick-account')?.focus();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isModalOpen]);

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3"><FileText size={28} className="text-indigo-600" />Partidas Contables</h1>
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
                        <td className="px-6 py-3 font-mono font-bold text-xs">{e.number}</td>
                        <td className="px-6 py-3 text-xs">{new Date(e.date).toLocaleDateString('es-SV')}</td>
                        <td className="px-6 py-3 text-xs">{e.entry_type_name}</td>
                        <td className="px-6 py-3 text-xs text-slate-600 max-w-xs truncate">{e.description}</td>
                        <td className="px-6 py-3 font-bold text-xs text-emerald-600">${parseFloat(e.total_debit).toFixed(2)}</td>
                        <td className="px-6 py-3 font-bold text-xs text-rose-600">${parseFloat(e.total_credit).toFixed(2)}</td>
                        <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${e.status === 'posted' ? 'bg-emerald-50 text-emerald-600' : e.status === 'voided' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>{e.status === 'posted' ? 'Contabilizado' : e.status === 'voided' ? 'Anulado' : 'Borrador'}</span></td>
                        <td className="px-6 py-3">
                            <div className="flex gap-2">
                                <button onClick={async () => { const { data } = await axios.get(`/api/accounting/entries/${e.id}`); setViewEntry(data); }} className="p-1.5 text-slate-400 hover:text-indigo-600"><Eye size={14} /></button>
                                <button onClick={() => handleEdit(e)} className="p-1.5 text-slate-400 hover:text-amber-600"><Edit size={14} /></button>
                                {e.status === 'posted' && <button onClick={async () => { const ok = await confirm({ title: 'Anular Partida', message: '¿Anular esta partida contable?', confirmLabel: 'Anular' }); if (ok) voidMutation.mutate(e.id); }} className="p-1.5 text-slate-400 hover:text-rose-600"><Ban size={14} /></button>}
                            </div>
                        </td>
                    </tr>
                )}
            />

            {entriesData && <Pagination page={page} totalPages={entriesData.totalPages || 1} onPageChange={setPage} />}

            {/* New Entry Modal */}
            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingEntry(null); }} title={editingEntry ? 'Editar Partida' : 'Nueva Partida Contable'} maxWidth="max-w-3xl">
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="grid grid-cols-3 gap-4">
                        {!editingEntry && (
                        <>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Tipo de Partida</label>
                            <select name="entry_type_id" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold">
                                {entryTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Fecha</label>
                            <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                        </div>
                        </>
                        )}
                        <div className={editingEntry ? 'col-span-3' : ''}>
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 block mb-1">Descripción</label>
                            <input name="description" placeholder="Concepto de la partida" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                        </div>
                    </div>

                    <div className="border-t pt-4">
                        <span className="text-[10px] font-black uppercase text-slate-400 mb-3 block">Líneas de la Partida</span>
                        
                        {/* Quick-add bar */}
                        <div className="flex gap-2 items-end mb-4 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100">
                            <div className="flex-1 relative">
                                <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1">Cuenta (F3 buscar)</label>
                                <div className="relative">
                                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                                    <input
                                        id="quick-account"
                                        autoComplete="off"
                                        placeholder="Código o nombre de cuenta..."
                                        className="w-full pl-8 pr-3 py-2 bg-white border border-indigo-200 rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        onFocus={(e) => { setAccountSearch(e.target.value); }}
                                        onChange={(e) => setAccountSearch(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Escape') { setAccountSearch(''); setSelectedAccountId(''); }
                                            if (e.key === 'Enter') {
                                                const first = accountResults[0];
                                                if (first) { setSelectedAccountId(first.id); document.getElementById('quick-account').value = first.code + ' - ' + first.name; setAccountSearch(''); }
                                            }
                                        }}
                                    />
                                    {accountSearch && (
                                        <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto mt-1">
                                            {accountResults.length === 0 ? (
                                                <div className="px-3 py-2 text-[10px] text-slate-400">Sin resultados</div>
                                            ) : (
                                                accountResults.map(a => (
                                                    <div key={a.id}
                                                        className="px-3 py-2 text-[10px] font-bold hover:bg-indigo-50 cursor-pointer border-b border-slate-50 flex justify-between"
                                                        onClick={() => {
                                                            setSelectedAccountId(a.id);
                                                            document.getElementById('quick-account').value = a.code + ' - ' + a.name;
                                                            setAccountSearch('');
                                                        }}
                                                    >
                                                        <span className="font-mono text-indigo-500">{a.code}</span>
                                                        <span className="flex-1 ml-2 truncate">{a.name}</span>
                                                        <span className="text-slate-400 text-[9px]">{a.type_name}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="w-32">
                                <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1">Detalle</label>
                                <input id="quick-desc" placeholder="Descripción" className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-[11px] outline-none" />
                            </div>
                            <div className="w-28">
                                <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1">Monto</label>
                                <input id="quick-amount" type="number" step="0.01" placeholder="0.00" className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-[11px] font-bold outline-none" />
                            </div>
                            <div className="w-20">
                                <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1">Tipo</label>
                                <select id="quick-type" className="w-full px-2 py-2 bg-white border border-indigo-200 rounded-xl text-[10px] font-bold">
                                    <option value="debit">Débito</option>
                                    <option value="credit">Crédito</option>
                                </select>
                            </div>
                            <button type="button" onClick={() => {
                                const acct = selectedAccountId;
                                const desc = document.getElementById('quick-desc').value;
                                const amt = document.getElementById('quick-amount').value;
                                const type = document.getElementById('quick-type').value;
                                if (!acct) return toast.error('Seleccione una cuenta');
                                if (!amt || parseFloat(amt) <= 0) return toast.error('Ingrese un monto');
                                setLines([...lines, { account_id: acct, description: desc, debit: type === 'debit' ? amt : '', credit: type === 'credit' ? amt : '' }]);
                                setSelectedAccountId('');
                                document.getElementById('quick-account').value = '';
                                document.getElementById('quick-desc').value = '';
                                document.getElementById('quick-amount').value = '';
                                document.getElementById('quick-account').focus();
                            }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-black text-xs transition-all shrink-0">
                                + Agregar
                            </button>
                        </div>

                        {/* Lines list */}
                        {lines.length === 0 ? (
                            <p className="text-center py-4 text-slate-300 text-xs">Sin líneas. Use la barra superior para agregar.</p>
                        ) : (
                            <div className="space-y-1 max-h-64 overflow-y-auto">
                                {lines.map((line, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100 group hover:bg-white transition-colors">
                                        <span className="font-mono text-[10px] font-bold text-slate-400 w-6 text-right">{idx + 1}</span>
                                        <span className="flex-1 text-xs font-bold truncate">
                                            {accounts.find(a => a.id == line.account_id)?.code || '?'} - {accounts.find(a => a.id == line.account_id)?.name?.substring(0, 30) || '?'}
                                        </span>
                                        <span className="text-[10px] text-slate-400 w-24 truncate">{line.description}</span>
                                        {parseFloat(line.debit) > 0 && <span className="text-xs font-bold text-emerald-600 w-24 text-right">${parseFloat(line.debit).toFixed(2)} D</span>}
                                        {parseFloat(line.credit) > 0 && <span className="text-xs font-bold text-rose-600 w-24 text-right">${parseFloat(line.credit).toFixed(2)} C</span>}
                                        <button type="button" onClick={() => removeLine(idx)} className="p-1 text-rose-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex justify-between text-xs font-bold mt-3 pt-3 border-t">
                            <span className={balanced ? 'text-emerald-600' : 'text-rose-600'}>{balanced ? '✓ Cuadra' : '✗ No cuadra'}</span>
                            <span>Débito: <b className="text-emerald-600">${totalDebit.toFixed(2)}</b> | Crédito: <b className="text-rose-600">${totalCredit.toFixed(2)}</b></span>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={() => { setIsModalOpen(false); setEditingEntry(null); }} className="flex-1 py-3 text-xs font-black uppercase text-slate-400">Cancelar</button>
                        <button type="submit" disabled={!balanced || createMutation.isPending || updateMutation.isPending} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black uppercase text-xs disabled:opacity-50">
                            {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : editingEntry ? 'Actualizar Partida' : 'Registrar Partida'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* View Entry Modal */}
            <Modal isOpen={!!viewEntry} onClose={() => setViewEntry(null)} title={`Partida ${viewEntry?.number}`} maxWidth="max-w-2xl">
                {viewEntry && (
                    <div className="space-y-4 pt-4">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div><span className="text-[10px] font-black uppercase text-slate-400">Tipo</span><p className="font-bold">{viewEntry.entry_type_name}</p></div>
                            <div><span className="text-[10px] font-black uppercase text-slate-400">Fecha</span><p className="font-bold">{new Date(viewEntry.date).toLocaleDateString('es-SV')}</p></div>
                            <div><span className="text-[10px] font-black uppercase text-slate-400">Estado</span><p className="font-bold">{viewEntry.status === 'posted' ? 'Contabilizado' : viewEntry.status === 'voided' ? 'Anulado' : 'Borrador'}</p></div>
                        </div>
                        <p className="text-sm text-slate-600">{viewEntry.description}</p>
                        <table className="w-full text-left border-t">
                            <thead><tr className="border-b"><th className="py-2 text-[10px] uppercase text-slate-400">Cuenta</th><th className="py-2 text-[10px] uppercase text-slate-400">Detalle</th><th className="py-2 text-[10px] uppercase text-slate-400 text-right">Débito</th><th className="py-2 text-[10px] uppercase text-slate-400 text-right">Crédito</th></tr></thead>
                            <tbody>
                                {viewEntry.lines?.map((l, i) => (
                                    <tr key={i} className="border-b border-slate-50">
                                        <td className="py-2 text-xs font-bold">{l.account_code} - {l.account_name}</td>
                                        <td className="py-2 text-xs text-slate-500">{l.description}</td>
                                        <td className="py-2 text-xs font-bold text-emerald-600 text-right">${parseFloat(l.debit).toFixed(2)}</td>
                                        <td className="py-2 text-xs font-bold text-rose-600 text-right">${parseFloat(l.credit).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot><tr className="font-bold text-xs"><td colSpan={2} className="pt-2">Totales</td><td className="pt-2 text-emerald-600 text-right">${parseFloat(viewEntry.total_debit).toFixed(2)}</td><td className="pt-2 text-rose-600 text-right">${parseFloat(viewEntry.total_credit).toFixed(2)}</td></tr></tfoot>
                        </table>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default AccountingEntries;
