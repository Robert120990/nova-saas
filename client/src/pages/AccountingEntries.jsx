import React, { useState, useMemo } from 'react';
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

    const addLine = () => setLines([...lines, { account_id: '', description: '', debit: '', credit: '' }]);
    const removeLine = (idx) => { if (lines.length > 1) setLines(lines.filter((_, i) => i !== idx)); };
    const updateLine = (idx, field, value) => {
        const updated = [...lines];
        updated[idx][field] = value;
        setLines(updated);
    };

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
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] font-black uppercase text-slate-400">Líneas de la Partida</span>
                            <button type="button" onClick={addLine} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">+ Agregar línea</button>
                        </div>
                        {lines.map((line, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-start">
                                <div className="col-span-4">
                                    <select value={line.account_id} onChange={e => updateLine(idx, 'account_id', e.target.value)} required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold">
                                        <option value="">Cuenta...</option>
                                        {Object.entries(accountsByType).map(([type, accs]) => (
                                            <optgroup key={type} label={type}>
                                                {accs.filter(a => a.allows_entries).map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                            </optgroup>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-3">
                                    <input value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} placeholder="Detalle" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px]" />
                                </div>
                                <div className="col-span-2">
                                    <input type="number" step="0.01" value={line.debit} onChange={e => updateLine(idx, 'debit', e.target.value)} placeholder="Débito" className="w-full px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] font-bold text-emerald-700" />
                                </div>
                                <div className="col-span-2">
                                    <input type="number" step="0.01" value={line.credit} onChange={e => updateLine(idx, 'credit', e.target.value)} placeholder="Crédito" className="w-full px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] font-bold text-rose-700" />
                                </div>
                                <div className="col-span-1">
                                    {lines.length > 1 && <button type="button" onClick={() => removeLine(idx)} className="p-2 text-rose-400 hover:text-rose-600"><Trash2 size={14} /></button>}
                                </div>
                            </div>
                        ))}
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
