import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import Modal from '../ui/Modal';
import { getTodayString, formatDate } from '../../utils/dateUtils';
import AccountingEntryLinesTable from './modals/AccountingEntryLinesTable';

const round2 = (num) => Math.round((parseFloat(num) || 0) * 100) / 100;

const AccountingEntryModal = ({
    open,
    onClose,
    onSubmit,
    editingEntry,
    entryTypes = [],
    accounts = [],
    isSaving = false,
}) => {
    const [entryTypeId, setEntryTypeId] = useState('');
    const [date, setDate] = useState(getTodayString());
    const [description, setDescription] = useState('');
    const [lines, setLines] = useState([]);
    const [newLine, setNewLine] = useState({ account_id: '', description: '', debit: 0, credit: 0 });

    const selectableAccounts = useMemo(() =>
        (Array.isArray(accounts) ? accounts : [])
            .filter(a => (a.allows_entries === 1 || a.allows_entries === true) && a.active !== 0)
            .sort((a, b) => String(a.code).localeCompare(String(b.code))),
    [accounts]);

    const accountsMap = useMemo(() => {
        const map = new Map();
        selectableAccounts.forEach(a => map.set(String(a.id), a));
        return map;
    }, [selectableAccounts]);

    useEffect(() => {
        if (open) {
            if (editingEntry) {
                setEntryTypeId(editingEntry.entry_type_id ? String(editingEntry.entry_type_id) : (entryTypes[0]?.id ? String(entryTypes[0].id) : ''));
                setDate(editingEntry.date ? editingEntry.date.slice(0, 10) : getTodayString());
                const desc = (editingEntry.description || '').toUpperCase();
                setDescription(desc);
                setLines((editingEntry.lines || []).map((l, idx) => {
                    const acc = accountsMap.get(String(l.account_id));
                    return {
                        id: l.id || idx + 1,
                        account_id: l.account_id ? String(l.account_id) : '',
                        account_name: l.account_name || acc?.name || '',
                        description: (l.description || desc).toUpperCase(),
                        debit: round2(l.debit || 0),
                        credit: round2(l.credit || 0)
                    };
                }));
                setNewLine({ account_id: '', description: desc, debit: 0, credit: 0 });
            } else {
                setEntryTypeId(entryTypes[0]?.id ? String(entryTypes[0].id) : '');
                setDate(getTodayString());
                setDescription('');
                setLines([]);
                setNewLine({ account_id: '', description: '', debit: 0, credit: 0 });
            }
        }
    }, [open, editingEntry, entryTypes, accountsMap]);

    const selectedNewAccount = useMemo(() =>
        accountsMap.get(String(newLine.account_id)),
    [accountsMap, newLine.account_id]);

    const totals = useMemo(() => {
        let debit = 0, credit = 0;
        lines.forEach(l => {
            debit += parseFloat(l.debit) || 0;
            credit += parseFloat(l.credit) || 0;
        });
        const roundedDeb = round2(debit);
        const roundedCrd = round2(credit);
        const diff = round2(Math.abs(roundedDeb - roundedCrd));
        return { debit: roundedDeb, credit: roundedCrd, diff, isBalanced: diff === 0 && roundedDeb > 0 };
    }, [lines]);

    const unassignedCount = useMemo(() => lines.filter(l => !l.account_id).length, [lines]);

    const handleAccountChange = (idx, accountId) => {
        const acc = accountsMap.get(String(accountId));
        setLines(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], account_id: accountId ? String(accountId) : '', account_name: acc?.name || '' };
            return next;
        });
    };

    const handleFieldChange = (idx, field, value) => {
        setLines(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    const handleDebitChange = (idx, val) => {
        setLines(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], debit: round2(parseFloat(val) || 0), credit: 0 };
            return next;
        });
    };

    const handleCreditChange = (idx, val) => {
        setLines(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], credit: round2(parseFloat(val) || 0), debit: 0 };
            return next;
        });
    };

    const handleRemoveLine = (index) => {
        setLines(prev => prev.filter((_, i) => i !== index));
    };

    const handleQuickAdd = () => {
        if (!newLine.account_id) return toast.error('Selecciona una cuenta contable');
        if (!newLine.description?.trim()) return toast.error('Ingresa un concepto');
        const deb = parseFloat(newLine.debit) || 0;
        const crd = parseFloat(newLine.credit) || 0;
        if (deb <= 0 && crd <= 0) return toast.error('Ingresa un valor en Cargo o Abono');
        const acc = accountsMap.get(String(newLine.account_id));
        setLines(prev => [
            ...prev,
            {
                id: Date.now(),
                account_id: String(newLine.account_id),
                account_name: acc?.name || '',
                description: newLine.description.toUpperCase(),
                debit: round2(deb),
                credit: round2(crd)
            }
        ]);
        setNewLine({ account_id: '', description: (description || '').toUpperCase(), debit: 0, credit: 0 });
    };

    const handleDescriptionChange = (e) => {
        const val = e.target.value.toUpperCase();
        setDescription(val);
        setNewLine(prev => {
            if (!prev.description || prev.description === description) {
                return { ...prev, description: val };
            }
            return prev;
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!description?.trim()) return toast.error('Ingresa un concepto para la partida');
        if (lines.length < 2) return toast.error('Una partida contable debe tener al menos 2 líneas');
        if (!totals.isBalanced) return toast.error(`La partida no está cuadrada. Diferencia: $${totals.diff.toFixed(2)}`);
        if (unassignedCount > 0) return toast.error('Hay líneas sin cuenta contable asignada');

        onSubmit({
            entry_type_id: Number(entryTypeId) || 1,
            date,
            description: description.trim().toUpperCase(),
            lines: lines.map(l => ({
                account_id: Number(l.account_id),
                description: l.description,
                debit: round2(l.debit),
                credit: round2(l.credit)
            }))
        });
    };

    if (!open) return null;

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={editingEntry ? (
                <div className="flex items-center gap-2.5 flex-wrap">
                    <span>Editar Partida Contable</span>
                    <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 border border-indigo-200">
                        #{editingEntry.number || ''}
                    </span>
                </div>
            ) : 'Nueva Partida Contable'}
            maxWidth="max-w-5xl"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Header Metadata */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {editingEntry ? (
                            <>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Correlativo</span>
                                    <span className="text-xs font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 rounded-lg inline-block">
                                        #{editingEntry.number || '—'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Tipo de Partida</span>
                                    <span className="text-xs font-bold text-slate-800 block mt-1">{editingEntry.entry_type_name || 'DIARIO'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Fecha Contable</span>
                                    <span className="text-xs font-bold text-slate-800 block mt-1">{formatDate(editingEntry.date)}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Estado</span>
                                    <div className="mt-0.5">
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${editingEntry.status === 'posted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : editingEntry.status === 'voided' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                            {editingEntry.status === 'posted' ? 'Contabilizado' : editingEntry.status === 'voided' ? 'Anulado' : 'Borrador'}
                                        </span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Tipo de Partida</label>
                                    <select
                                        value={entryTypeId}
                                        onChange={e => setEntryTypeId(e.target.value)}
                                        required
                                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                                    >
                                        {(Array.isArray(entryTypes) ? entryTypes : []).map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Fecha</label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                        required
                                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Correlativo</label>
                                    <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl block truncate">
                                        Autogenerado al registrar según tipo y período
                                    </span>
                                </div>
                            </>
                        )}
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Concepto General de la Partida</label>
                        <input
                            placeholder="CONCEPTO O DESCRIPCIÓN GENERAL DE LA PARTIDA..."
                            value={description}
                            onChange={handleDescriptionChange}
                            required
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase text-slate-800 outline-none focus:border-indigo-500"
                        />
                    </div>
                </div>

                {/* Lines Detail Table - Identical to Bank Entry */}
                <div>
                    <AccountingEntryLinesTable
                        lines={lines}
                        selectableAccounts={selectableAccounts}
                        accountsMap={accountsMap}
                        newLine={newLine}
                        setNewLine={setNewLine}
                        selectedNewAccount={selectedNewAccount}
                        onQuickAdd={handleQuickAdd}
                        onAccountChange={handleAccountChange}
                        onFieldChange={handleFieldChange}
                        onDebitChange={handleDebitChange}
                        onCreditChange={handleCreditChange}
                        onRemoveLine={handleRemoveLine}
                        totals={totals}
                        unassignedCount={unassignedCount}
                        onClose={onClose}
                        isSaving={isSaving}
                        editingEntry={editingEntry}
                    />
                </div>
            </form>
        </Modal>
    );
};

export default AccountingEntryModal;
