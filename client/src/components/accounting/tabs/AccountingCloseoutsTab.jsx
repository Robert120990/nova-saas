import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { CalendarDays, Wand2, Fuel, AlertTriangle, Store, FileText, Info, Tag, BookmarkCheck } from 'lucide-react';
import { toast } from 'sonner';
import CloseoutsEntriesTable from '../CloseoutsEntriesTable';
import CloseoutCostsModal from '../modals/CloseoutCostsModal';
import CloseoutCostsReportModal from '../modals/CloseoutCostsReportModal';
import { getTodayString } from '../../../utils/dateUtils';
import { unwrapList } from '../../../utils/apiUtils';
import { useAuth } from '../../../context/AuthContext';

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

const AccountingCloseoutsTab = ({ onBusyChange }) => {
    const { user } = useAuth();
    const companyId = user?.company_id;
    const headers = { 'x-company-id': companyId };
    const queryClient = useQueryClient();

    const [branchId, setBranchId] = useState('');
    const [date, setDate] = useState(getTodayString);
    const [entryTypeId, setEntryTypeId] = useState('');
    const [previewData, setPreviewData] = useState(null);
    const [lines, setLines] = useState([]);
    const [costsModalOpen, setCostsModalOpen] = useState(false);
    const [costsReportModal, setCostsReportModal] = useState({ isOpen: false, pdfUrl: null, isLoading: false, error: null });

    const { data: branches = [] } = useQuery({
        queryKey: ['branches', companyId],
        queryFn: async ({ signal }) => unwrapList(await axios.get('/api/branches', { headers, signal })),
        enabled: !!companyId,
    });

    const { data: entryTypes = [] } = useQuery({
        queryKey: ['entry-types'],
        queryFn: async ({ signal }) => unwrapList(await axios.get('/api/accounting/entry-types', { headers, signal })),
        enabled: !!companyId,
    });

    useEffect(() => {
        if (!branchId && branches.length > 0) {
            const defaultBranch = branches.find(b => b.id == user?.branch_id) || branches[0];
            if (defaultBranch) setBranchId(String(defaultBranch.id));
        }
    }, [branches, branchId, user]);

    useEffect(() => {
        if (!entryTypeId && entryTypes.length > 0) {
            const defaultType = entryTypes.find(t => t.code === 'DIARIO') || entryTypes[0];
            if (defaultType) setEntryTypeId(String(defaultType.id));
        }
    }, [entryTypes, entryTypeId]);

    const { data: accounts = [] } = useQuery({
        queryKey: ['accounts', companyId],
        queryFn: async ({ signal }) => unwrapList(await axios.get('/api/accounting/accounts', { headers, signal })),
        enabled: !!companyId,
    });

    const entryAccounts = useMemo(() =>
        accounts.filter(a => (a.allows_entries === 1 || a.allows_entries === true) && a.active !== 0)
            .sort((a, b) => String(a.code).localeCompare(String(b.code))),
    [accounts]);

    const accountsMap = useMemo(() => {
        const m = new Map();
        entryAccounts.forEach(a => m.set(String(a.id), a));
        return m;
    }, [entryAccounts]);

    const previewMutation = useMutation({
        mutationFn: (payload) => axios.post('/api/accounting/generation/closeouts/preview', payload, { headers }),
        onSuccess: ({ data }) => {
            if (!data.closeouts_found) {
                toast.info(data.message || 'No se encontraron cierres de turno para esa fecha');
                setPreviewData(null);
                setLines([]);
                return;
            }
            setPreviewData(data);
            setLines(unwrapList(data.lines).map(l => ({ ...l })));
            if (data.default_entry_type_id) setEntryTypeId(String(data.default_entry_type_id));
            if (data.already_generated) {
                toast.warning(`Ya existe una partida generada para esta fecha${data.existing_entry?.number ? ` (#${data.existing_entry.number})` : ''}.`);
            } else {
                toast.success(`Cierres encontrados (${data.closeouts_count} turnos). Borrador generado.`);
            }
        },
        onError: (err) => toast.error(err?.response?.data?.message || 'Error al calcular borrador de cierres')
    });

    const saveCostsMutation = useMutation({
        mutationFn: (fuels) => axios.post('/api/accounting/generation/closeouts/save-costs', { branch_id: branchId, date, fuels }, { headers }),
        onSuccess: () => {
            toast.success('Costos de combustible guardados');
            setCostsModalOpen(false);
            previewMutation.mutate({ branch_id: branchId, date });
        },
        onError: (err) => toast.error(err?.response?.data?.message || 'Error al guardar costos')
    });

    const generateMutation = useMutation({
        mutationFn: (payload) => axios.post('/api/accounting/generation/closeouts/generate', payload, { headers }),
        onSuccess: ({ data }) => {
            toast.success(`Partida ${data.number} generada exitosamente`);
            queryClient.invalidateQueries({ queryKey: ['entries'] });
            queryClient.invalidateQueries({ queryKey: ['accounting-correlativos'] });
            setPreviewData(prev => prev ? { ...prev, already_generated: true, existing_entry: { id: data.id, number: data.number } } : prev);
        },
        onError: (err) => {
            toast.error(err?.response?.data?.message || 'Error al asentar partida');
            if (err?.response?.status === 409) setPreviewData(prev => prev ? { ...prev, already_generated: true } : prev);
        }
    });

    const totals = useMemo(() => {
        let cargo = 0, abono = 0;
        lines.forEach(l => { cargo += parseFloat(l.debit) || 0; abono += parseFloat(l.credit) || 0; });
        cargo = round2(cargo); abono = round2(abono);
        const diff = round2(cargo - abono);
        return { cargo, abono, diff, balanced: cargo === abono && cargo > 0 };
    }, [lines]);

    const unassignedCount = useMemo(() => lines.filter(l => !l.account_id).length, [lines]);
    const busy = previewMutation.isPending || saveCostsMutation.isPending || generateMutation.isPending;
    useEffect(() => { if (onBusyChange) onBusyChange(busy); }, [busy, onBusyChange]);

    const updateLine = (idx, patch) => {
        setLines(rows => rows.map((r, i) => {
            if (i !== idx) return r;
            const updated = { ...r, ...patch };
            if (patch.account_id) {
                const acc = accountsMap.get(String(patch.account_id));
                if (acc) { updated.account_code = acc.code; updated.account_name = acc.name; }
            }
            return updated;
        }));
    };

    const removeLine = (idx) => setLines(rows => rows.filter((_, i) => i !== idx));

    const handleAddQuickLine = (newLine) => {
        const acc = accountsMap.get(String(newLine.account_id));
        setLines(prev => [...prev, {
            account_id: newLine.account_id,
            account_code: acc?.code || '',
            account_name: acc?.name || '',
            description: newLine.description.toUpperCase(),
            destination: previewData?.branch_label || 'SUCURSAL',
            debit: round2(newLine.debit),
            credit: round2(newLine.credit)
        }]);
    };

    const handleOpenCostsReport = async () => {
        if (!branchId || !date) return toast.error('Selecciona sucursal y fecha para generar el comprobante');
        setCostsReportModal({ isOpen: true, pdfUrl: null, isLoading: true, error: null });
        try {
            const res = await axios.get('/api/accounting/generation/closeouts/costs-report', {
                params: { branch_id: branchId, date, format: 'pdf' },
                headers,
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            setCostsReportModal(prev => ({ ...prev, pdfUrl: url, isLoading: false }));
        } catch (err) {
            setCostsReportModal(prev => ({ ...prev, isLoading: false, error: err?.response?.data?.message || 'Error al generar comprobante' }));
            toast.error(err?.response?.data?.message || 'Error al generar el comprobante de costos');
        }
    };

    const handleCloseCostsReport = () => {
        if (costsReportModal.pdfUrl) window.URL.revokeObjectURL(costsReportModal.pdfUrl);
        setCostsReportModal({ isOpen: false, pdfUrl: null, isLoading: false, error: null });
    };

    const canGenerate = !!previewData && lines.length > 0 && totals.balanced && unassignedCount === 0 && !busy && !previewData.already_generated;

    return (
        <fieldset disabled={busy} className="space-y-3 min-w-0">
            {/* Top Filter Bar */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
                <div className="flex flex-col md:flex-row md:items-end gap-2.5">
                    <div className="flex-1 min-w-[180px]">
                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 flex items-center gap-1">
                            <Store size={11} className="text-indigo-600" /> Sucursal
                        </label>
                        <select
                            value={branchId}
                            onChange={e => { setBranchId(e.target.value); setPreviewData(null); setLines([]); }}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                        >
                            <option value="">Seleccionar sucursal...</option>
                            {(Array.isArray(branches) ? branches : []).map(b => (
                                <option key={b.id} value={b.id}>{b.codigo ? `${b.codigo} - ` : ''}{b.nombre}</option>
                            ))}
                        </select>
                    </div>

                    <div className="w-full md:w-36">
                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 flex items-center gap-1">
                            <CalendarDays size={11} className="text-indigo-600" /> Fecha del Turno
                        </label>
                        <input
                            type="date" value={date}
                            onChange={e => { setDate(e.target.value); setPreviewData(null); setLines([]); }}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                        />
                    </div>

                    <div className="w-full md:w-48">
                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 flex items-center gap-1">
                            <Tag size={11} className="text-indigo-600" /> Tipo de Partida
                        </label>
                        <select
                            value={entryTypeId}
                            onChange={e => setEntryTypeId(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                        >
                            {(Array.isArray(entryTypes) ? entryTypes : []).map(t => (
                                <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <button
                            type="button"
                            onClick={() => previewMutation.mutate({ branch_id: branchId, date })}
                            disabled={!branchId || !date || busy}
                            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg font-bold transition-all text-xs active:scale-95 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                        >
                            <Wand2 size={13} /> {previewMutation.isPending ? 'Calculando...' : 'Calcular Borrador'}
                        </button>
                        {previewData && (
                            <button
                                type="button" onClick={() => setCostsModalOpen(true)}
                                className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-1.5 rounded-lg font-bold transition-all text-xs flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer active:scale-95"
                                title="Ajustar costos unitarios de combustibles"
                            >
                                <Fuel size={13} className="text-amber-500" /> Ajustar Costos
                            </button>
                        )}
                        {previewData && (
                            <button
                                type="button" onClick={handleOpenCostsReport}
                                className="w-full sm:w-auto bg-white hover:bg-indigo-50 text-indigo-700 hover:text-indigo-800 px-3.5 py-1.5 rounded-lg font-bold transition-all text-xs flex items-center justify-center gap-1.5 border border-indigo-200 shadow-xs cursor-pointer active:scale-95"
                                title="Ver comprobante de costos de combustibles y lubricantes"
                            >
                                <FileText size={13} className="text-indigo-600" /> Comprobante de Costos
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Preview Banner Alerts */}
            {previewData?.already_generated && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                    <span>
                        Ya existe una partida de cierre de turno generada para esta sucursal y fecha
                        {previewData.existing_entry?.number ? <b> (Partida #{previewData.existing_entry.number})</b> : ''}. Si deseas regenerarla, anúlala primero en Partidas Contables.
                    </span>
                </div>
            )}

            {previewData?.reserved_entry_number && !previewData?.already_generated && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-800">
                    <BookmarkCheck size={15} className="text-emerald-600 shrink-0" />
                    <span>
                        Correlativo contable reservado para este cierre: <b>#{previewData.reserved_entry_number}</b>. Se asignará automáticamente al asentar la partida.
                    </span>
                </div>
            )}

            {previewData && unassignedCount > 0 && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-xs text-blue-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
                    <span>Hay <b>{unassignedCount}</b> {unassignedCount === 1 ? 'línea' : 'líneas'} sin cuenta contable asignada. Selecciónalas en la grilla antes de asentar la partida.</span>
                </div>
            )}

            {previewData?.trupput?.has_trupput && (
                <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5 text-xs text-indigo-900">
                    <Info size={14} className="text-indigo-600 shrink-0" />
                    <span>
                        Despachos <b>Trupput</b> en este cierre: <b>{Number(previewData.trupput.total_galones).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} galones</b> (${Number(previewData.trupput.total_monto).toFixed(2)}) deducidos de ventas e inventario propio.
                    </span>
                </div>
            )}

            {/* Desktop Style Spreadsheet Table */}
            {previewData && (
                <CloseoutsEntriesTable
                    lines={lines}
                    entryAccounts={entryAccounts}
                    updateLine={updateLine}
                    removeLine={removeLine}
                    onAddQuickLine={handleAddQuickLine}
                    totals={totals}
                    unassignedCount={unassignedCount}
                    canGenerate={canGenerate}
                    isGenerating={generateMutation.isPending}
                    onGenerate={() => {
                        if (previewData?.already_generated) {
                            toast.error(`Ya existe una partida de cierre generada para esta fecha${previewData.existing_entry?.number ? ` (#${previewData.existing_entry.number})` : ''}.`);
                            return;
                        }
                        generateMutation.mutate({ branch_id: branchId, date, entry_type_id: entryTypeId ? Number(entryTypeId) : undefined, lines });
                    }}
                    onClear={() => { setPreviewData(null); setLines([]); }}
                />
            )}

            {/* Modal for Fuel Unit Costs */}
            <CloseoutCostsModal
                open={costsModalOpen} onClose={() => setCostsModalOpen(false)}
                fuels={previewData?.fuels_for_cost || []}
                onSave={(fuels) => saveCostsMutation.mutate(fuels)}
                isSaving={saveCostsMutation.isPending}
            />

            {/* Modal para Visualizar Comprobante de Costos */}
            <CloseoutCostsReportModal
                open={costsReportModal.isOpen} onClose={handleCloseCostsReport}
                title="Comprobante de Costos de Venta"
                pdfUrl={costsReportModal.pdfUrl}
                isLoading={costsReportModal.isLoading}
                error={costsReportModal.error}
                onRetry={handleOpenCostsReport}
            />
        </fieldset>
    );
};

export default AccountingCloseoutsTab;
