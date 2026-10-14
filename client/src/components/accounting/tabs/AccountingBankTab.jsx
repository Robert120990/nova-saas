import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Landmark, CheckSquare, BookmarkCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import { unwrapList } from '../../../utils/apiUtils';
import BankFilterBar from '../BankFilterBar';
import BankChecksTable from '../BankChecksTable';
import BankMovementsTable from '../BankMovementsTable';
import BankEntryModal from '../modals/BankEntryModal';
import BankCorrelativosReservationTab from './BankCorrelativosReservationTab';

const AccountingBankTab = () => {
    const { user } = useAuth();
    const companyId = user?.company_id;
    const headers = { 'x-company-id': companyId };
    const queryClient = useQueryClient();

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const [month, setMonth] = useState(currentMonth);
    const [year, setYear] = useState(currentYear);
    const [queryPeriod, setQueryPeriod] = useState({ month: currentMonth, year: currentYear });
    const [statusFilter, setStatusFilter] = useState('unposted');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeMainTab, setActiveMainTab] = useState('cheques');
    const [activeSubTab, setActiveSubTab] = useState('emitidos');
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [previewData, setPreviewData] = useState(null);

    // 1. Fetch Chart of Accounts
    const { data: accounts = [] } = useQuery({
        queryKey: ['accounts', companyId],
        queryFn: async ({ signal }) => unwrapList(await axios.get('/api/accounting/accounts', { headers, signal })),
        enabled: !!companyId,
    });

    // 1b. Fetch Entry Types
    const { data: entryTypes = [] } = useQuery({
        queryKey: ['entry-types'],
        queryFn: async ({ signal }) => unwrapList(await axios.get('/api/accounting/entry-types', { headers, signal })),
        enabled: !!companyId,
    });

    // 2. Fetch Cheques
    const { data: cheques = [], isLoading: loadingCheques, refetch: refetchCheques } = useQuery({
        queryKey: ['bank-cheques', companyId, queryPeriod.year, queryPeriod.month, statusFilter],
        queryFn: async ({ signal }) => unwrapList(await axios.get('/api/accounting/generation/bank/cheques', {
            headers,
            signal,
            params: {
                month: queryPeriod.month,
                year: queryPeriod.year,
                status: statusFilter
            }
        })),
        enabled: !!companyId,
    });

    // 3. Fetch Movimientos
    const { data: movements = [], isLoading: loadingMovements, refetch: refetchMovements } = useQuery({
        queryKey: ['bank-movements', companyId, queryPeriod.year, queryPeriod.month, statusFilter],
        queryFn: async ({ signal }) => unwrapList(await axios.get('/api/accounting/generation/bank/movements', {
            headers,
            signal,
            params: {
                month: queryPeriod.month,
                year: queryPeriod.year,
                status: statusFilter
            }
        })),
        enabled: !!companyId,
    });

    const handleQuery = () => {
        setQueryPeriod({ month, year });
        setSelectedIds(new Set());
        if (queryPeriod.month === month && queryPeriod.year === year) {
            if (activeMainTab === 'cheques') refetchCheques();
            else refetchMovements();
        }
    };

    // Filter items by status and search text
    const filteredCheques = useMemo(() => {
        let list = Array.isArray(cheques) ? cheques : [];
        if (statusFilter === 'unposted') {
            list = list.filter(c => !c.es_contabilizado);
        } else if (statusFilter === 'posted') {
            list = list.filter(c => Boolean(c.es_contabilizado));
        }
        const q = (searchTerm || '').trim().toLowerCase();
        if (!q) return list;
        return list.filter(c =>
            (c.cheque || '').toLowerCase().includes(q) ||
            (c.beneficiario || '').toLowerCase().includes(q) ||
            (c.concepto || '').toLowerCase().includes(q) ||
            (c.cuenta_label || '').toLowerCase().includes(q) ||
            (c.corr || '').toLowerCase().includes(q)
        );
    }, [cheques, statusFilter, searchTerm]);

    const filteredMovements = useMemo(() => {
        let list = Array.isArray(movements) ? movements : [];
        if (statusFilter === 'unposted') {
            list = list.filter(m => !m.es_contabilizado);
        } else if (statusFilter === 'posted') {
            list = list.filter(m => Boolean(m.es_contabilizado));
        }
        const q = (searchTerm || '').trim().toLowerCase();
        if (!q) return list;
        return list.filter(m =>
            (m.referencia || '').toLowerCase().includes(q) ||
            (m.concepto || '').toLowerCase().includes(q) ||
            (m.tipo_movimiento || '').toLowerCase().includes(q) ||
            (m.cuenta_label || '').toLowerCase().includes(q) ||
            (m.corr || '').toLowerCase().includes(q)
        );
    }, [movements, statusFilter, searchTerm]);

    // Selection handlers
    const handleToggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleToggleSelectAll = (ids, checked) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (checked) ids.forEach(id => next.add(id));
            else ids.forEach(id => next.delete(id));
            return next;
        });
    };

    // Preview mutation (for double click)
    const previewMutation = useMutation({
        mutationFn: (payload) => axios.post('/api/accounting/generation/bank/preview-entry', payload, { headers }),
        onSuccess: ({ data }) => {
            setPreviewData(data);
            setModalOpen(true);
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al obtener vista previa de la partida');
        }
    });

    const handleOpenPreview = (item) => {
        if (previewMutation.isPending) return;
        previewMutation.mutate({
            type: activeMainTab === 'cheques' ? 'cheque' : 'movimiento',
            id: item.id
        });
    };

    // Save individual entry mutation
    const saveEntryMutation = useMutation({
        mutationFn: (payload) => axios.post('/api/accounting/generation/bank/generate-entry', payload, { headers }),
        onSuccess: ({ data }) => {
            toast.success(data.message || `Partida #${data.number} generada exitosamente`);
            setModalOpen(false);
            setPreviewData(null);
            queryClient.invalidateQueries({ queryKey: ['bank-cheques'] });
            queryClient.invalidateQueries({ queryKey: ['bank-movements'] });
            queryClient.invalidateQueries({ queryKey: ['entries'] });
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al asentar partida');
        }
    });

    // Batch generation mutation
    const batchMutation = useMutation({
        mutationFn: (payload) => axios.post('/api/accounting/generation/bank/generate-batch', payload, { headers }),
        onSuccess: ({ data }) => {
            if (data.generated_count > 0) {
                toast.success(`${data.generated_count} partida(s) generadas exitosamente`);
            }
            if (data.skipped_count > 0) {
                toast.warning(`${data.skipped_count} registro(s) omitidos por falta de cuenta o por ya estar contabilizados`);
            }
            setSelectedIds(new Set());
            queryClient.invalidateQueries({ queryKey: ['bank-cheques'] });
            queryClient.invalidateQueries({ queryKey: ['bank-movements'] });
            queryClient.invalidateQueries({ queryKey: ['entries'] });
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al contabilizar registros en lote');
        }
    });

    const handleBatchPost = () => {
        if (selectedIds.size === 0) return;
        batchMutation.mutate({
            type: activeMainTab === 'cheques' ? 'cheque' : 'movimiento',
            ids: Array.from(selectedIds)
        });
    };

    const isCurrentLoading = activeMainTab === 'cheques' ? loadingCheques : loadingMovements;

    const filterSuffix = statusFilter === 'unposted'
        ? ' pendientes'
        : (statusFilter === 'posted' ? ' contabilizados' : '');

    return (
        <div className="space-y-4">
            {/* Main Tabs Navigation */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => { setActiveMainTab('cheques'); setSelectedIds(new Set()); }}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                            activeMainTab === 'cheques'
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <CheckSquare size={16} />
                        Cheques ({cheques.length}{filterSuffix})
                    </button>
                    <button
                        type="button"
                        onClick={() => { setActiveMainTab('movimientos'); setSelectedIds(new Set()); }}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                            activeMainTab === 'movimientos'
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <Landmark size={16} />
                        Movimientos Bancarios ({movements.length}{filterSuffix})
                    </button>
                    <button
                        type="button"
                        onClick={() => { setActiveMainTab('reserva_correlativos'); setSelectedIds(new Set()); }}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                            activeMainTab === 'reserva_correlativos'
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <BookmarkCheck size={16} />
                        Reserva de Correlativos
                    </button>
                </div>

                <div className="text-[11px] font-semibold text-slate-400 hidden sm:block">
                    Contabilización global (sin filtro de sucursal)
                </div>
            </div>

            {activeMainTab === 'reserva_correlativos' ? (
                <BankCorrelativosReservationTab />
            ) : (
                <>
                    {/* Filter Bar */}
                    <BankFilterBar
                        month={month}
                        setMonth={setMonth}
                        year={year}
                        setYear={setYear}
                        statusFilter={statusFilter}
                        setStatusFilter={setStatusFilter}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        onQuery={handleQuery}
                        isLoading={isCurrentLoading}
                        selectedCount={selectedIds.size}
                        onBatchPost={handleBatchPost}
                        isBatchPosting={batchMutation.isPending}
                    />

                    {/* Main Content Table */}
                    {activeMainTab === 'cheques' ? (
                        <BankChecksTable
                            items={filteredCheques}
                            selectedIds={selectedIds}
                            onToggleSelect={handleToggleSelect}
                            onToggleSelectAll={handleToggleSelectAll}
                            onOpenPreview={handleOpenPreview}
                            activeSubTab={activeSubTab}
                            setActiveSubTab={setActiveSubTab}
                            isLoading={loadingCheques}
                            previewingId={previewMutation.isPending ? previewMutation.variables?.id : null}
                        />
                    ) : (
                        <BankMovementsTable
                            items={filteredMovements}
                            selectedIds={selectedIds}
                            onToggleSelect={handleToggleSelect}
                            onToggleSelectAll={handleToggleSelectAll}
                            onOpenPreview={handleOpenPreview}
                            isLoading={loadingMovements}
                            previewingId={previewMutation.isPending ? previewMutation.variables?.id : null}
                        />
                    )}
                </>
            )}

            {/* Modal for Preview & Editing Journal Entry */}
            <BankEntryModal
                open={modalOpen}
                onClose={() => { setModalOpen(false); setPreviewData(null); }}
                previewData={previewData}
                accounts={accounts}
                entryTypes={entryTypes}
                onSave={(payload) => saveEntryMutation.mutate(payload)}
                isSaving={saveEntryMutation.isPending}
            />
        </div>
    );
};

export default AccountingBankTab;
