import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, AlertTriangle, Lock } from 'lucide-react';
import Money from '../../ui/Money';
import { formatDate } from '../../../utils/dateUtils';
import { toast } from 'sonner';
import BankEntryLinesTable from './BankEntryLinesTable';
import BankEntryTaxBar from './BankEntryTaxBar';
import { round2, buildRecalculatedLines, getEntryTypeLabel } from './bankEntryTax.helper';

const BankEntryModal = ({
    open,
    onClose,
    previewData,
    accounts = [],
    onSave,
    isSaving = false
}) => {
    const [detallarIva, setDetallarIva] = useState(true);
    const [taxDetailMode, setTaxDetailMode] = useState('none');
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
        if (previewData) {
            const defaultDesc = (previewData.description || '').toUpperCase();
            const defaultDetallar = previewData.detallar_iva !== undefined
                ? Boolean(previewData.detallar_iva)
                : (previewData.type === 'cheque' && !previewData.is_remesa);
            setDetallarIva(defaultDetallar);
            setTaxDetailMode(previewData.tax_detail_mode || 'none');
            setLines((previewData.lines || []).map((l, idx) => {
                const acc = accountsMap.get(String(l.account_id));
                return {
                    id: idx + 1,
                    account_id: l.account_id ? String(l.account_id) : '',
                    account_name: l.account_name || acc?.name || '',
                    description: (l.description || defaultDesc).toUpperCase(),
                    debit: round2(l.debit || 0),
                    credit: round2(l.credit || 0)
                };
            }));
            setNewLine({ account_id: '', description: defaultDesc, debit: 0, credit: 0 });
        }
    }, [previewData, accountsMap]);

    const handleToggleIva = useCallback((checked) => {
        setDetallarIva(checked);
        const nextMode = checked ? taxDetailMode : 'none';
        if (!checked) setTaxDetailMode('none');
        setLines(prev => buildRecalculatedLines({
            previewData,
            currentLines: prev,
            detallarIva: checked,
            taxDetailMode: nextMode,
            description: previewData?.description,
            accountsMap
        }));
    }, [previewData, taxDetailMode, accountsMap]);

    const handleTaxModeChange = useCallback((mode) => {
        setTaxDetailMode(mode);
        setLines(prev => buildRecalculatedLines({
            previewData,
            currentLines: prev,
            detallarIva,
            taxDetailMode: mode,
            description: previewData?.description,
            accountsMap
        }));
    }, [previewData, detallarIva, accountsMap]);

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
        if (lines.length <= 2) {
            toast.error('Una partida contable debe tener al menos 2 líneas');
            return;
        }
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
        setNewLine({ account_id: '', description: (previewData?.description || '').toUpperCase(), debit: 0, credit: 0 });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!previewData.correlativo_reservado) {
            return toast.error('No se puede generar la partida: Este documento no tiene un correlativo contable reservado.');
        }
        if (!totals.isBalanced) return toast.error(`La partida no está cuadrada. Diferencia: $${totals.diff.toFixed(2)}`);
        if (unassignedCount > 0) return toast.error('Hay líneas sin cuenta contable asignada');

        onSave({
            type: previewData.type,
            id: previewData.id,
            date: previewData.fecha,
            description: (previewData.description || '').toUpperCase(),
            entry_type_code: previewData.entry_type_code || 'DIARIO',
            lines: lines.map(l => ({
                account_id: Number(l.account_id),
                description: l.description,
                debit: round2(l.debit),
                credit: round2(l.credit)
            }))
        });
    };

    if (!open || !previewData) return null;
    const isCheque = previewData.type === 'cheque';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 bg-slate-50/70">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700">
                                {isCheque ? 'Cheque' : 'Movimiento Bancario'}
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-600">
                                #{previewData.documento_numero}
                            </span>
                            {previewData.correlativo_reservado ? (
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono">
                                    Corr: #{previewData.correlativo_reservado}
                                </span>
                            ) : (
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-100 text-rose-700">
                                    Sin Correlativo Reservado
                                </span>
                            )}
                            {previewData.already_generated && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                                    Contabilizado {previewData.existing_entry?.number ? `(#${previewData.existing_entry.number})` : ''}
                                </span>
                            )}
                        </div>
                        <h2 className="text-lg font-black text-slate-800 mt-0.5">
                            Vista Previa de Partida Contable
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Document Metadata Banner */}
                <div className="px-6 py-2.5 bg-slate-100/60 border-b border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Fecha Original</span>
                        <span className="font-semibold text-slate-700">{formatDate(previewData.fecha)}</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Cuenta Bancaria</span>
                        <span className="font-semibold text-slate-700 truncate block" title={previewData.banco_label}>
                            {previewData.banco_label || 'Sin cuenta'}
                        </span>
                    </div>
                    <div className="truncate">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                            {isCheque ? 'Beneficiario' : 'Concepto'}
                        </span>
                        <span className="font-semibold text-slate-700 truncate block" title={previewData.beneficiario || previewData.concepto}>
                            {previewData.beneficiario || previewData.concepto}
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Monto</span>
                        <span className="font-black text-emerald-600 text-sm">
                            <Money value={previewData.monto} />
                        </span>
                    </div>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-3.5">
                    {!previewData.correlativo_reservado && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-800">
                            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                            <div>
                                <span className="font-bold block">No se puede generar la partida: Falta correlativo contable</span>
                                <span className="text-[11px] text-rose-700">Debe asignar o reservar el correlativo en la pestaña &quot;Reserva de Correlativos&quot; antes de contabilizar.</span>
                            </div>
                        </div>
                    )}
                    {/* Cabecera de Partida (Solo Lectura) */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="w-full sm:w-36 shrink-0">
                            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1">
                                <Lock size={10} className="text-slate-400" /> Fecha de Partida
                            </label>
                            <input
                                type="text" readOnly disabled tabIndex={-1}
                                value={formatDate(previewData.fecha)}
                                className="w-full px-3 py-1.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 cursor-not-allowed select-none font-mono outline-none text-center sm:text-left"
                            />
                        </div>
                        <div className="w-full sm:w-52 shrink-0">
                            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1">
                                <Lock size={10} className="text-slate-400" /> Tipo de Partida
                            </label>
                            <input
                                type="text" readOnly disabled tabIndex={-1}
                                value={getEntryTypeLabel(previewData.entry_type_code)}
                                className="w-full px-3 py-1.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 cursor-not-allowed select-none outline-none truncate"
                                title={getEntryTypeLabel(previewData.entry_type_code)}
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1">
                                <Lock size={10} className="text-slate-400" /> Concepto General
                            </label>
                            <input
                                type="text" readOnly disabled tabIndex={-1}
                                value={previewData.description || ''}
                                className="w-full px-3 py-1.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 cursor-not-allowed select-none uppercase truncate outline-none"
                                title={previewData.description || ''}
                            />
                        </div>
                    </div>

                    {/* Tax Detail Bar: IVA Crédito Fiscal & Retención / Percepción */}
                    <BankEntryTaxBar
                        isRemesa={Boolean(previewData.is_remesa)}
                        detallarIva={detallarIva}
                        onToggleIva={handleToggleIva}
                        taxDetailMode={taxDetailMode}
                        onTaxModeChange={handleTaxModeChange}
                    />

                    {/* Partidas de Diario Detail Table (Closeouts pattern) */}
                    <BankEntryLinesTable
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
                        isAlreadyGenerated={Boolean(previewData.already_generated)}
                        hasReservedCorrelative={Boolean(previewData.correlativo_reservado)}
                    />
                </form>
            </div>
        </div>
    );
};

export default BankEntryModal;
