import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Calculator, CalendarDays, Wand2, AlertTriangle, CheckCircle2, XCircle, Trash2, Link2, Settings } from 'lucide-react';
import { toast } from 'sonner';
import Money, { MoneyInput } from '../components/ui/Money';
import { useDirtyTracker } from '../hooks/useDirtyTracker';

const today = () => new Date().toISOString().slice(0, 10);

const KEY_LABELS = {
    CUENTA_CAJA: 'Caja General',
    CUENTA_BANCOS: 'Bancos / Tarjetas',
    CUENTA_CLIENTES_CXC: 'Clientes (CxC)',
    CUENTA_VENTAS_GRAVADAS: 'Ventas Gravadas',
    CUENTA_VENTAS_EXENTAS: 'Ventas Exentas',
    CUENTA_VENTAS_NOSUJETAS: 'Ventas No Sujetas',
    CUENTA_IVA_DEBITO: 'IVA Débito Fiscal',
    CUENTA_IVA_PERCIBIDO: 'IVA Percibido',
    CUENTA_FOVIAL_POR_PAGAR: 'FOVIAL por Pagar',
    CUENTA_COTRANS_POR_PAGAR: 'COTRANS por Pagar',
    CUENTA_COMPRAS_GRAVADAS: 'Compras Gravadas',
    CUENTA_COMPRAS_EXENTAS: 'Compras Exentas',
    CUENTA_IVA_CREDITO: 'IVA Crédito Fiscal',
    CUENTA_PROVEEDORES_CXP: 'Proveedores (CxP)',
    CUENTA_IVA_RETENIDO: 'IVA Retenido'
};

const inputCls = "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all";

const AccountPicker = ({ value, onChange, accounts }) => (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={`${inputCls} font-mono text-[12px]`}>
        <option value="">Seleccionar cuenta...</option>
        {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
        ))}
    </select>
);

const KIND_LABELS = { ventas: 'Ventas', compras: 'Compras', cxc: 'CxC', cxp: 'CxP' };

const AccountingGenerate = ({ kinds = ['ventas', 'compras'] }) => {
    const queryClient = useQueryClient();
    const [kind, setKind] = useState(kinds[0]);
    const [date, setDate] = useState(today());
    const [detailCredit, setDetailCredit] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [lines, setLines] = useState([]);

    useEffect(() => {
        if (!kinds.includes(kind)) {
            setKind(kinds[0]);
            setPreviewData(null);
            setLines([]);
        }
    }, [kinds, kind]);

    useDirtyTracker('generar', lines.length > 0 && previewData);

    const { data: config } = useQuery({
        queryKey: ['accounting-generation-config'],
        queryFn: async () => (await axios.get('/api/accounting/generation/config')).data,
    });

    const { data: accounts = [] } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => (await axios.get('/api/accounting/accounts')).data,
    });
    const entryAccounts = useMemo(() =>
        accounts.filter(a => (a.allows_entries === 1 || a.allows_entries === true) && a.active !== 0)
            .sort((a, b) => String(a.code).localeCompare(String(b.code))),
    [accounts]);

    const previewMutation = useMutation({
        mutationFn: () => axios.post('/api/accounting/generation/preview', { kind, date, detail_credit: detailCredit }),
        onSuccess: ({ data }) => {
            setPreviewData(data);
            setLines(data.lines.map(l => ({ ...l })));
            if (!data.lines.length) toast.info('No hay documentos de ese tipo en la fecha seleccionada');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al calcular'),
    });

    const generateMutation = useMutation({
        mutationFn: () => axios.post('/api/accounting/generation/generate', {
            kind, date, lines: lines.map(l => ({ account_id: Number(l.account_id), description: l.description, debit: l.debit, credit: l.credit }))
        }),
        onSuccess: ({ data }) => {
            toast.success(`Partida ${data.number} generada`);
            queryClient.invalidateQueries({ queryKey: ['entries'] });
            queryClient.invalidateQueries({ queryKey: ['accounting-settings'] });
            setPreviewData(prev => prev ? { ...prev, already_generated: true } : null);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al generar'),
    });

    const totals = useMemo(() => {
        let debit = 0; let credit = 0;
        lines.forEach(l => { debit += parseFloat(l.debit) || 0; credit += parseFloat(l.credit) || 0; });
        debit = Math.round(debit * 100) / 100;
        credit = Math.round(credit * 100) / 100;
        return { debit, credit, balanced: Math.abs(debit - credit) <= 0.01 && debit > 0 };
    }, [lines]);

    const updateLine = (idx, patch) => setLines(rows => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    const removeLine = (idx) => setLines(rows => rows.filter((_, i) => i !== idx));

    const missingForKind = useMemo(() => {
        const mappings = config?.mappings?.[kind];
        if (!mappings) return [];
        return Object.entries(mappings).filter(([, v]) => !v).map(([k]) => k);
    }, [config, kind]);
    const totalForKind = useMemo(() => Object.keys(config?.mappings?.[kind] || {}).length, [config, kind]);
    const entryTypeId = config?.entry_types?.[kind];
    const canGenerate = totals.balanced && !previewData?.already_generated && !!entryTypeId && !generateMutation.isPending;

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in pb-20">
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3"><Calculator size={28} className="text-indigo-600" />Contabilizar</h1>
                <p className="text-slate-500 mt-1 font-medium">
                    Genera partidas automáticas por día — {kinds.map(k => KIND_LABELS[k]).join(' / ')}
                </p>
            </div>

            <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-2xl w-fit max-w-full shadow-inner">
                {kinds.map(k => (
                    <button key={k} type="button"
                        onClick={() => { setKind(k); setPreviewData(null); setLines([]); }}
                        className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            kind === k ? 'bg-white text-indigo-600 shadow-xl scale-[1.02]' : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        {KIND_LABELS[k]}
                    </button>
                ))}
            </div>

            {missingForKind.length > 0 && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-[11px] font-black uppercase text-amber-700">
                                Faltan {missingForKind.length} de {totalForKind} cuentas para {KIND_LABELS[kind]}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                                {totalForKind - missingForKind.length}/{totalForKind} listas
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {missingForKind.map(key => (
                                <span key={key} title={key} className="inline-flex items-center bg-white border border-amber-300 rounded-lg px-2.5 py-1">
                                    <span className="text-[11px] font-bold text-amber-800">{KEY_LABELS[key] || key}</span>
                                    <span className="hidden sm:inline text-[9px] font-mono text-slate-400 ml-1.5">{key}</span>
                                </span>
                            ))}
                        </div>
                        <Link
                            to="/contabilidad/ajustes"
                            className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-[11px] font-black uppercase transition-colors"
                        >
                            <Settings size={13} /> Configurar en Cuentas por Defecto
                        </Link>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-4 sm:items-end">
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5">Fecha del día</label>
                        <div className="relative">
                            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setPreviewData(null); setLines([]); }} className={inputCls} />
                            <CalendarDays size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                    <label className="flex items-center gap-2.5 cursor-pointer select-none pb-1">
                        <input
                            type="checkbox"
                            checked={detailCredit}
                            onChange={(e) => { setDetailCredit(e.target.checked); setPreviewData(null); setLines([]); }}
                            className="sr-only peer"
                        />
                        <div className="relative w-9 h-5 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                        <span className={`text-[11px] font-bold flex items-center gap-1 transition-colors ${detailCredit ? 'text-indigo-600' : 'text-slate-600'}`}>
                            <Link2 size={13} /> Detalle crédito por cuenta auxiliar
                        </span>
                    </label>
                    <button
                        onClick={() => previewMutation.mutate()}
                        disabled={previewMutation.isPending}
                        className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold transition-all text-sm active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Wand2 size={16} /> {previewMutation.isPending ? 'Calculando...' : 'Calcular'}
                    </button>
                </div>
            </div>

            {previewData && (
                <>
                    {previewData.already_generated && (
                        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                            <div className="text-[12px] text-amber-800">
                                Ya existe una partida de {kind} generada para esta fecha. Anúlala desde Partidas Contables si deseas regenerarla.
                            </div>
                        </div>
                    )}
                    {!previewData.already_generated && previewData.unmapped_entities?.length > 0 && (
                        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                            <div className="text-[12px] text-amber-800">
                                Sin cuenta auxiliar (usan cuenta genérica): <b>{previewData.unmapped_entities.join(', ')}</b>. Asígnalas en Ajustes → Cuentas Auxiliares.
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase text-slate-400">Líneas calculadas (editables)</span>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase w-fit ${
                                totals.balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
                            }`}>
                                {totals.balanced ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                                {totals.balanced ? 'Cuadra' : 'No cuadra'}
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px]">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-3 py-2.5 text-left text-[9px] font-black uppercase text-slate-400 w-[26%]">Cuenta</th>
                                        <th className="px-3 py-2.5 text-left text-[9px] font-black uppercase text-slate-400">Descripción</th>
                                        <th className="px-3 py-2.5 text-right text-[9px] font-black uppercase text-slate-400 w-[130px]">Debe</th>
                                        <th className="px-3 py-2.5 text-right text-[9px] font-black uppercase text-slate-400 w-[130px]">Haber</th>
                                        <th className="px-3 py-2.5 w-[40px]"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lines.map((l, idx) => (
                                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                                            <td className="px-3 py-2">
                                                <AccountPicker value={l.account_id} onChange={(v) => updateLine(idx, { account_id: v })} accounts={entryAccounts} />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input value={l.description} onChange={(e) => updateLine(idx, { description: e.target.value.toUpperCase() })} className={inputCls} />
                                            </td>
                                            <td className="px-3 py-2">
                                                <MoneyInput value={l.debit} onChange={(e) => updateLine(idx, { debit: parseFloat(e.target.value) || 0, credit: 0 })} className={inputCls} />
                                            </td>
                                            <td className="px-3 py-2">
                                                <MoneyInput value={l.credit} onChange={(e) => updateLine(idx, { credit: parseFloat(e.target.value) || 0, debit: 0 })} className={inputCls} />
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <button onClick={() => removeLine(idx)} className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {lines.length === 0 && (
                                        <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">Sin líneas para esta fecha.</td></tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50 border-t border-slate-200 font-black text-[12px] text-slate-700">
                                        <td colSpan={2} className="px-3 py-3 text-right uppercase text-[10px] text-slate-400">Totales</td>
                                        <td className="px-3 py-3 text-right"><Money value={totals.debit} /></td>
                                        <td className="px-3 py-3 text-right"><Money value={totals.credit} /></td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-end gap-3">
                        <button
                            onClick={() => { setPreviewData(null); setLines([]); }}
                            className="px-5 py-2.5 text-slate-500 font-semibold hover:text-slate-700 transition-colors text-sm"
                        >
                            Limpiar
                        </button>
                        <button
                            onClick={() => generateMutation.mutate()}
                            disabled={!canGenerate}
                            title={!totals.balanced ? 'El débito y crédito no cuadran' : undefined}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-black uppercase text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Calculator size={16} /> {generateMutation.isPending ? 'Generando...' : `Generar Partida de ${KIND_LABELS[kind]}`}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default AccountingGenerate;
