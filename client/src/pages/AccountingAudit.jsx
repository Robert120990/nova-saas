import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { Shield, Sparkles, FileSpreadsheet, Scale, Download, RefreshCw } from 'lucide-react';
import {
    AuditSummaryCards,
    SmartDiagnosisTab,
    CatalogAuditTab,
    EntriesAuditTab,
    AuditEntryDetailModal,
    FixAccountModal
} from '../components/accounting/audit';
import { getFirstDayOfMonth, getTodayString } from '../utils/dateUtils';

const AccountingAudit = () => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('smart'); // 'smart' | 'catalog' | 'entries'
    const [exporting, setExporting] = useState(false);

    // Filters for entries
    const [dates, setDates] = useState({
        startDate: getFirstDayOfMonth(),
        endDate: getTodayString()
    });

    // Modals state
    const [selectedEntryId, setSelectedEntryId] = useState(null);
    const [accountToFix, setAccountToFix] = useState(null);

    // 1. Overview Query
    const { data: overviewData, refetch: refetchOverview } = useQuery({
        queryKey: ['accounting-audit-overview'],
        queryFn: async () => {
            const res = await axios.get('/api/accounting/audit/overview');
            return res.data?.data;
        }
    });

    // 2. Catalog Audit Query
    const { data: catalogData, isLoading: isLoadingCatalog, refetch: refetchCatalog } = useQuery({
        queryKey: ['accounting-audit-catalog'],
        queryFn: async () => {
            const res = await axios.get('/api/accounting/audit/catalog');
            return res.data?.data;
        }
    });

    // 3. Entries Audit Query
    const { data: entriesData, isLoading: isLoadingEntries, refetch: refetchEntries } = useQuery({
        queryKey: ['accounting-audit-entries', dates.startDate, dates.endDate],
        queryFn: async () => {
            const params = {};
            if (dates.startDate) params.startDate = dates.startDate;
            if (dates.endDate) params.endDate = dates.endDate;
            const res = await axios.get('/api/accounting/audit/entries', { params });
            return res.data?.data;
        }
    });

    // 4. AI Diagnosis Query & Mutation
    const { data: initialDiagnosis, isLoading: isLoadingDiagnosis, mutate: runAIDiagnosis } = useMutation({
        mutationFn: async () => {
            const res = await axios.post('/api/accounting/audit/ai-diagnosis');
            return res.data?.data;
        },
        onSuccess: (data) => {
            toast.success('Dictamen y análisis de auditoría generados con éxito');
            queryClient.setQueryData(['accounting-audit-diagnosis'], data);
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al generar el diagnóstico de auditoría');
        }
    });

    // Cache or fetched diagnosis
    const cachedDiagnosis = queryClient.getQueryData(['accounting-audit-diagnosis']) || initialDiagnosis;

    const handleDateChange = (field, val) => {
        setDates(prev => ({ ...prev, [field]: val }));
    };

    const handleRefreshAll = () => {
        refetchOverview();
        refetchCatalog();
        refetchEntries();
        toast.info('Actualizando datos de auditoría contable...');
    };

    const handleExportExcel = async () => {
        try {
            setExporting(true);
            const res = await axios.get('/api/accounting/audit/export-excel', {
                responseType: 'blob',
                params: dates
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Auditoria_Contable_${new Date().toISOString().slice(0, 10)}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Informe de auditoría contable descargado');
        } catch (err) {
            console.error('Error exporting excel:', err);
            toast.error('Error al exportar informe a Excel');
        } finally {
            setExporting(false);
        }
    };

    const health = overviewData?.health || cachedDiagnosis || { score: 100, opinion: 'Limpio / Favorable', opinionLevel: 'clean' };

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                        <Shield className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                            Auditoría Contable y Calidad de Información
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                            Inspección integral de catálogo, partida doble y consistencia bajo NIIF / Normativa SV
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRefreshAll}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                        Actualizar
                    </button>
                    <button
                        onClick={handleExportExcel}
                        disabled={exporting}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm disabled:opacity-60"
                    >
                        <Download className="w-3.5 h-3.5" />
                        {exporting ? 'Generando...' : 'Exportar Excel'}
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <AuditSummaryCards
                health={health}
                catalogCounts={overviewData?.catalog?.counts}
                entriesCounts={overviewData?.entries?.counts}
                catalogOverview={overviewData?.catalog?.overview}
                entriesOverview={overviewData?.entries?.overview}
            />

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-1 sm:space-x-3 overflow-x-auto pb-px">
                <button
                    onClick={() => setActiveTab('smart')}
                    className={`inline-flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
                        activeTab === 'smart'
                            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    <Sparkles className="w-4 h-4" />
                    Diagnóstico Inteligente
                </button>
                <button
                    onClick={() => setActiveTab('catalog')}
                    className={`inline-flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
                        activeTab === 'catalog'
                            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    <FileSpreadsheet className="w-4 h-4" />
                    Catálogo de Cuentas
                    {overviewData?.catalog?.counts?.error > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-700 font-bold">
                            {overviewData.catalog.counts.error}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('entries')}
                    className={`inline-flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
                        activeTab === 'entries'
                            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    <Scale className="w-4 h-4" />
                    Partidas Contables
                    {overviewData?.entries?.counts?.error > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-700 font-bold">
                            {overviewData.entries.counts.error}
                        </span>
                    )}
                </button>
            </div>

            {/* Active Tab View */}
            <div>
                {activeTab === 'smart' && (
                    <SmartDiagnosisTab
                        diagnosis={cachedDiagnosis || {
                            healthScore: health.score,
                            opinion: health.opinion,
                            opinionLevel: health.opinionLevel,
                            summary: 'Haga clic en "Ejecutar Dictamen IA" para iniciar el análisis contable exhaustivo con inteligencia artificial.'
                        }}
                        isDiagnosing={isLoadingDiagnosis}
                        onRunDiagnosis={() => runAIDiagnosis()}
                    />
                )}

                {activeTab === 'catalog' && (
                    <CatalogAuditTab
                        catalogData={catalogData}
                        isLoading={isLoadingCatalog}
                        onFixAccount={(item) => setAccountToFix(item)}
                    />
                )}

                {activeTab === 'entries' && (
                    <EntriesAuditTab
                        entriesData={entriesData}
                        isLoading={isLoadingEntries}
                        onViewEntry={(id) => setSelectedEntryId(id)}
                        startDate={dates.startDate}
                        endDate={dates.endDate}
                        onDateChange={handleDateChange}
                    />
                )}
            </div>

            {/* Modals */}
            <AuditEntryDetailModal
                open={Boolean(selectedEntryId)}
                entryId={selectedEntryId}
                onClose={() => setSelectedEntryId(null)}
            />

            <FixAccountModal
                open={Boolean(accountToFix)}
                account={accountToFix}
                onClose={() => setAccountToFix(null)}
                onFixed={() => {
                    refetchCatalog();
                    refetchOverview();
                }}
            />
        </div>
    );
};

export default AccountingAudit;
