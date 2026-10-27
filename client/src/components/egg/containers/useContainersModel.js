import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { unwrapList } from '../../../utils/apiUtils';
import { formatDate } from '../../../utils/dateUtils';
import { useConfirm } from '../../../context/ConfirmContext';

export default function useContainersModel() {
    const queryClient = useQueryClient();
    const confirm = useConfirm();

    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'available' | 'active'
    const [searchTerm, setSearchTerm] = useState('');
    const [activeSectionTab, setActiveSectionTab] = useState('cutoffs'); // 'cutoffs' | 'table' | 'logs'
    const [selectedLedgerView, setSelectedLedgerView] = useState('active'); // 'active' | cutoff.id

    // Period cutoff state (parte automáticamente desde el último corte realizado)
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().split('T')[0]);
    const [lockToLastCutoff, setLockToLastCutoff] = useState(true);
    const [customerName, setCustomerName] = useState('');

    // Modals state
    const [modalState, setModalState] = useState({ open: false, mode: 'add', container: null });
    const [cutoffModalOpen, setCutoffModalOpen] = useState(false);
    const [dailyModalState, setDailyModalState] = useState({ open: false, row: null });

    // PDF Viewer Modal state for Estado de Cuenta
    const [pdfViewer, setPdfViewer] = useState({
        isOpen: false,
        pdfUrl: null,
        isLoading: false,
        error: null,
        title: 'Estado de Cuenta - Contenedores de Frío',
        subtitle: '',
        fileName: 'estado_cuenta_contenedores.pdf'
    });

    // Local draft state for inline days editing per container id
    const [daysDrafts, setDaysDrafts] = useState({});

    const { data: overviewData, isLoading } = useQuery({
        queryKey: ['egg-containers-overview'],
        queryFn: async () => {
            const res = await axios.get('/api/egg-industrial/containers');
            const payload = res.data || {};
            return {
                containers: unwrapList({ data: payload.containers || [] }),
                daily_ledger: payload.daily_ledger || {
                    opening_lbs_balance: 0,
                    rows: [],
                    totals: {
                        opening_lbs_balance: 0,
                        total_lbs_in: 0,
                        total_lbs_out: 0,
                        closing_lbs_balance: 0,
                        total_days_logged: 0,
                        total_container_days: 0,
                        storage_subtotal: 0,
                        loading_unloading_total: 0,
                        concepts_total: 0,
                        iva_amount: 0,
                        total_with_iva: 0
                    }
                },
                summary: payload.summary || {
                    total_containers: 0,
                    available_count: 0,
                    active_count: 0,
                    total_days_on: 0,
                    opening_lbs_balance: 0,
                    current_lbs_balance: 0,
                    default_daily_rate: 195,
                    default_daily_iva: 25.35,
                    default_daily_with_iva: 220.35,
                    iva_rate_percent: 13,
                    storage_subtotal: 0,
                    loading_unloading_total: 0,
                    total_subtotal: 0,
                    total_iva: 0,
                    total_with_iva: 0
                },
                cutoff_chain: payload.cutoff_chain || {
                    has_previous_cutoff: false,
                    last_cutoff_id: null,
                    last_cutoff_code: null,
                    last_cutoff_date: null,
                    last_cutoff_lbs_balance: 0,
                    next_period_start: new Date().toISOString().split('T')[0],
                    suggested_period_end: new Date().toISOString().split('T')[0],
                    total_cutoffs_count: 0
                },
                cutoffs: unwrapList({ data: payload.cutoffs || [] }),
                logs: unwrapList({ data: payload.logs || [] })
            };
        }
    });

    const containers = useMemo(
        () => (Array.isArray(overviewData?.containers) ? overviewData.containers : []),
        [overviewData]
    );
    const dailyLedger = overviewData?.daily_ledger || {
        opening_lbs_balance: 0,
        rows: [],
        totals: {
            opening_lbs_balance: 0,
            total_lbs_in: 0,
            total_lbs_out: 0,
            closing_lbs_balance: 0,
            total_days_logged: 0,
            total_container_days: 0,
            storage_subtotal: 0,
            loading_unloading_total: 0,
            concepts_total: 0,
            iva_amount: 0,
            total_with_iva: 0
        }
    };
    const summary = overviewData?.summary || {
        total_containers: containers.length,
        available_count: 0,
        active_count: 0,
        total_days_on: 0,
        opening_lbs_balance: 0,
        current_lbs_balance: 0,
        default_daily_rate: 195,
        default_daily_iva: 25.35,
        default_daily_with_iva: 220.35,
        iva_rate_percent: 13,
        storage_subtotal: 0,
        loading_unloading_total: 0,
        total_subtotal: 0,
        total_iva: 0,
        total_with_iva: 0
    };
    const cutoffChain = overviewData?.cutoff_chain || {
        has_previous_cutoff: false,
        last_cutoff_id: null,
        last_cutoff_code: null,
        last_cutoff_date: null,
        last_cutoff_lbs_balance: 0,
        next_period_start: new Date().toISOString().split('T')[0],
        suggested_period_end: new Date().toISOString().split('T')[0],
        total_cutoffs_count: 0
    };
    const cutoffs = useMemo(
        () => (Array.isArray(overviewData?.cutoffs) ? overviewData.cutoffs : []),
        [overviewData]
    );
    const logs = useMemo(
        () => (Array.isArray(overviewData?.logs) ? overviewData.logs : []),
        [overviewData]
    );

    useEffect(() => {
        if (cutoffChain.next_period_start) {
            if (!periodStart || (cutoffChain.has_previous_cutoff && lockToLastCutoff)) {
                setPeriodStart(cutoffChain.next_period_start);
            }
            if (cutoffChain.suggested_period_end) {
                setPeriodEnd(cutoffChain.suggested_period_end);
            }
        }
        if (cutoffChain.last_customer_name && !customerName) {
            setCustomerName(cutoffChain.last_customer_name);
        }
    }, [cutoffChain.next_period_start, cutoffChain.has_previous_cutoff, cutoffChain.suggested_period_end, cutoffChain.last_customer_name, lockToLastCutoff]);

    const periodSpanDays = useMemo(() => {
        if (!periodStart || !periodEnd) return 0;
        const s = new Date(`${periodStart}T00:00:00`).getTime();
        const e = new Date(`${periodEnd}T00:00:00`).getTime();
        if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
        return Math.max(1, Math.round((e - s) / 86400000) + 1);
    }, [periodStart, periodEnd]);

    const filteredContainers = useMemo(() => {
        return containers.filter(c => {
            if (statusFilter === 'available' && c.is_active_power) return false;
            if (statusFilter === 'active' && !c.is_active_power) return false;
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase();
                const matchName = String(c.name || '').toLowerCase().includes(q);
                const matchCode = String(c.code || '').toLowerCase().includes(q);
                const matchNotes = String(c.notes || '').toLowerCase().includes(q);
                if (!matchName && !matchCode && !matchNotes) return false;
            }
            return true;
        });
    }, [containers, statusFilter, searchTerm]);

    const invalidateAndSync = (newData) => {
        if (newData && Array.isArray(newData.containers)) {
            queryClient.setQueryData(['egg-containers-overview'], {
                containers: unwrapList({ data: newData.containers }),
                daily_ledger: newData.daily_ledger,
                summary: newData.summary,
                cutoff_chain: newData.cutoff_chain,
                cutoffs: unwrapList({ data: newData.cutoffs || [] }),
                logs: unwrapList({ data: newData.logs || [] })
            });
        } else {
            queryClient.invalidateQueries({ queryKey: ['egg-containers-overview'] });
        }
    };

    const togglePowerMutation = useMutation({
        mutationFn: async ({ id, is_active_power, days_on, notes }) => {
            const res = await axios.post(`/api/egg-industrial/containers/${id}/toggle-power`, { is_active_power, days_on, notes });
            return res.data;
        },
        onSuccess: (data, variables) => {
            invalidateAndSync(data);
            toast.success(variables.is_active_power ? 'Contenedor encendido (En almacenamiento)' : 'Contenedor apagado (Disponible)');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al cambiar estado del contenedor')
    });

    const updateContainerMutation = useMutation({
        mutationFn: async ({ id, ...payload }) => {
            const res = await axios.put(`/api/egg-industrial/containers/${id}`, payload);
            return res.data;
        },
        onSuccess: (data) => invalidateAndSync(data),
        onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar contenedor')
    });

    const addContainerMutation = useMutation({
        mutationFn: async (payload) => {
            const res = await axios.post('/api/egg-industrial/containers', payload);
            return res.data;
        },
        onSuccess: (data) => {
            invalidateAndSync(data);
            setModalState({ open: false, mode: 'add', container: null });
            toast.success('Contenedor(es) adicionado(s) correctamente');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al adicionar contenedor')
    });

    const updateDailyRateMutation = useMutation({
        mutationFn: async (daily_rate) => {
            const res = await axios.put('/api/egg-industrial/containers/daily-rate', { daily_rate });
            return res.data;
        },
        onSuccess: (data) => {
            invalidateAndSync(data);
            setModalState({ open: false, mode: 'add', container: null });
            toast.success('Tarifa diaria actualizada en todos los contenedores');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar tarifa diaria')
    });

    const resetCycleMutation = useMutation({
        mutationFn: async ({ id, notes }) => {
            const res = await axios.post(`/api/egg-industrial/containers/${id}/reset-cycle`, { notes });
            return res.data;
        },
        onSuccess: (data) => {
            invalidateAndSync(data);
            toast.success('Ciclo archivado en bitácora y contenedor reiniciado a 0 días');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al reiniciar ciclo del contenedor')
    });

    const deleteContainerMutation = useMutation({
        mutationFn: async (id) => {
            const res = await axios.delete(`/api/egg-industrial/containers/${id}`);
            return res.data;
        },
        onSuccess: (data) => {
            invalidateAndSync(data);
            toast.success('Contenedor eliminado');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar contenedor')
    });

    const saveDailyRowMutation = useMutation({
        mutationFn: async (payload) => {
            if (payload.id) {
                const res = await axios.put(`/api/egg-industrial/containers/daily-ledger/${payload.id}`, payload);
                return res.data;
            }
            const res = await axios.post('/api/egg-industrial/containers/daily-ledger', payload);
            return res.data;
        },
        onSuccess: (data) => {
            setDaysDrafts({});
            invalidateAndSync(data);
            setDailyModalState({ open: false, row: null });
            toast.success('Registro diario guardado y sincronizado con los contenedores');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar registro diario')
    });

    const deleteDailyRowMutation = useMutation({
        mutationFn: async (id) => {
            const res = await axios.delete(`/api/egg-industrial/containers/daily-ledger/${id}`);
            return res.data;
        },
        onSuccess: (data) => {
            setDaysDrafts({});
            invalidateAndSync(data);
            toast.success('Fila diaria eliminada y saldos recalculados');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar fila diaria')
    });

    const syncPeriodDaysMutation = useMutation({
        mutationFn: async (payload) => {
            const res = await axios.post('/api/egg-industrial/containers/sync-period-days', payload);
            return res.data;
        },
        onSuccess: (data) => {
            setDaysDrafts({});
            invalidateAndSync(data);
            toast.success('Días de contenedores encendidos calculados según las fechas del corte');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al sincronizar días del período')
    });

    const createCutoffMutation = useMutation({
        mutationFn: async (payload) => {
            const res = await axios.post('/api/egg-industrial/containers/cutoffs', payload);
            return res.data;
        },
        onSuccess: (data) => {
            setDaysDrafts({});
            invalidateAndSync(data);
            setCutoffModalOpen(false);
            setActiveSectionTab('cutoffs');
            if (data.cutoff_chain?.next_period_start) {
                setPeriodStart(data.cutoff_chain.next_period_start);
            }
            toast.success(`Corte ${data.created_cutoff_code || ''} registrado. El próximo corte parte con ${Number(data.cutoff_chain?.last_cutoff_lbs_balance || 0).toLocaleString('en-US')} lbs`);
            if (data.created_cutoff_id) {
                handleOpenStatementPdf({ cutoff_id: data.created_cutoff_id, code: data.created_cutoff_code });
            }
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al realizar el corte por fechas')
    });

    const revertCutoffMutation = useMutation({
        mutationFn: async (cutoffId) => {
            const res = await axios.delete(`/api/egg-industrial/containers/cutoffs/${cutoffId}`);
            return res.data;
        },
        onSuccess: (data) => {
            setDaysDrafts({});
            invalidateAndSync(data);
            setSelectedLedgerView('active');
            toast.success('Último corte revertido; filas diarias y días restaurados al período vigente');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al revertir el último corte')
    });

    const handleOpenStatementPdf = async ({ cutoff_id = null, code = null } = {}) => {
        if (pdfViewer.pdfUrl) URL.revokeObjectURL(pdfViewer.pdfUrl);
        const sub = cutoff_id
            ? `Corte Oficial ${code || `#${cutoff_id}`}`
            : `Período Vigente (${formatDate(periodStart)} al ${formatDate(periodEnd)})`;
        setPdfViewer({
            isOpen: true, pdfUrl: null, isLoading: true, error: null,
            title: 'Estado de Cuenta - Almacenamiento en Contenedor',
            subtitle: sub,
            fileName: `estado_cuenta_contenedores_${cutoff_id || periodEnd}.pdf`
        });
        try {
            const res = await axios.get('/api/egg-industrial/containers/statement-report', {
                params: cutoff_id ? { cutoff_id } : { period_start: periodStart, period_end: periodEnd, customer_name: customerName },
                responseType: 'blob'
            });
            const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            setPdfViewer(prev => ({ ...prev, pdfUrl: url, isLoading: false }));
        } catch (err) {
            setPdfViewer(prev => ({ ...prev, isLoading: false, error: err.response?.data?.message || 'No se pudo generar el PDF del Estado de Cuenta.' }));
        }
    };

    const handleExportStatementExcel = async ({ cutoff_id = null } = {}) => {
        try {
            const res = await axios.get('/api/egg-industrial/containers/statement-report', {
                params: cutoff_id ? { cutoff_id, format: 'excel' } : { period_start: periodStart, period_end: periodEnd, customer_name: customerName, format: 'excel' },
                responseType: 'blob'
            });
            const url = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `estado_cuenta_contenedores_${cutoff_id || periodEnd}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast.success('Estado de cuenta exportado a Excel');
        } catch {
            toast.error('Error al exportar Estado de Cuenta a Excel');
        }
    };

    const closePdfViewer = () => {
        if (pdfViewer.pdfUrl) URL.revokeObjectURL(pdfViewer.pdfUrl);
        setPdfViewer(prev => ({ ...prev, isOpen: false, pdfUrl: null }));
    };

    const handleSyncPeriodDays = (useFullPeriodSpan = true) => {
        syncPeriodDaysMutation.mutate({ period_start: periodStart, period_end: periodEnd, lock_to_last_cutoff: lockToLastCutoff, use_full_period_span: useFullPeriodSpan });
    };

    const handleRevertCutoff = async (cutoff) => {
        const ok = await confirm({
            title: `¿Revertir ${cutoff.cutoff_code}?`,
            message: `Se deshará el corte del ${formatDate(cutoff.period_start)} al ${formatDate(cutoff.period_end)} y sus filas diarias regresarán al período vigente.`,
            confirmText: 'Sí, revertir último corte',
            cancelText: 'Cancelar',
            variant: 'danger'
        });
        if (!ok) return;
        revertCutoffMutation.mutate(cutoff.id);
    };

    const handleDeleteDailyRow = async (row) => {
        const ok = await confirm({
            title: `¿Eliminar registro del ${formatDate(row.entry_date)}?`,
            message: 'Se recalcularán el saldo de libras y los días de los contenedores del período vigente.',
            confirmText: 'Eliminar fila',
            cancelText: 'Cancelar',
            variant: 'danger'
        });
        if (!ok) return;
        deleteDailyRowMutation.mutate(row.id);
    };

    const handleTogglePower = (container) => {
        const nextPower = !container.is_active_power;
        const draftDays = daysDrafts[container.id];
        const currentDays = draftDays !== undefined ? parseFloat(draftDays) || 0 : parseFloat(container.days_on) || 0;
        const nextDays = nextPower && currentDays === 0 ? 1 : currentDays;
        setDaysDrafts(prev => { const copy = { ...prev }; delete copy[container.id]; return copy; });
        togglePowerMutation.mutate({ id: container.id, is_active_power: nextPower, days_on: nextDays });
    };

    const handleAdjustDays = (container, delta) => {
        const currentVal = daysDrafts[container.id] !== undefined ? parseFloat(daysDrafts[container.id]) || 0 : parseFloat(container.days_on) || 0;
        const nextVal = Math.max(0, +(currentVal + delta).toFixed(2));
        setDaysDrafts(prev => ({ ...prev, [container.id]: String(nextVal) }));
        updateContainerMutation.mutate({ id: container.id, days_on: nextVal, log_change: true });
    };

    const handleDaysInputChange = (containerId, value) => setDaysDrafts(prev => ({ ...prev, [containerId]: value }));

    const handleDaysInputCommit = (container) => {
        const raw = daysDrafts[container.id];
        if (raw === undefined) return;
        const nextVal = Math.max(0, parseFloat(raw) || 0);
        setDaysDrafts(prev => { const copy = { ...prev }; delete copy[container.id]; return copy; });
        if (nextVal === parseFloat(container.days_on || 0)) return;
        updateContainerMutation.mutate({ id: container.id, days_on: nextVal, log_change: true });
        toast.success(`Días actualizados en ${container.name}`);
    };

    const handleResetCycle = async (container) => {
        const ok = await confirm({
            title: `¿Cerrar ciclo individual de ${container.name}?`,
            message: `Se guardará el registro de ${container.days_on} día(s) en la bitácora y el contenedor quedará APAGADO con 0 días.`,
            confirmText: 'Sí, cerrar ciclo',
            cancelText: 'Cancelar'
        });
        if (!ok) return;
        resetCycleMutation.mutate({ id: container.id });
    };

    const handleDeleteContainer = async (container) => {
        const ok = await confirm({
            title: `¿Eliminar ${container.name}?`,
            message: `¿Está seguro de eliminar el contenedor ${container.code} (${container.name})?`,
            confirmText: 'Eliminar',
            cancelText: 'Cancelar',
            variant: 'danger'
        });
        if (!ok) return;
        deleteContainerMutation.mutate(container.id);
    };

    const openAddModal = () => setModalState({ open: true, mode: 'add', container: null });
    const openEditModal = (container) => setModalState({ open: true, mode: 'edit', container });
    const openRateModal = () => setModalState({ open: true, mode: 'rate', container: null });
    const closeModal = () => setModalState({ open: false, mode: 'add', container: null });
    const openDailyAddModal = () => setDailyModalState({ open: true, row: null });
    const openDailyEditModal = (row) => setDailyModalState({ open: true, row });
    const closeDailyModal = () => setDailyModalState({ open: false, row: null });

    const handleModalSave = (formPayload) => {
        if (modalState.mode === 'add') addContainerMutation.mutate(formPayload);
        else if (modalState.mode === 'edit' && modalState.container) {
            updateContainerMutation.mutate(
                { id: modalState.container.id, ...formPayload, log_change: true },
                { onSuccess: () => { closeModal(); toast.success('Contenedor actualizado correctamente'); } }
            );
        } else if (modalState.mode === 'rate') updateDailyRateMutation.mutate(formPayload.daily_rate);
    };

    return {
        containers, filteredContainers, dailyLedger, summary, cutoffChain, cutoffs, logs, isLoading,
        statusFilter, setStatusFilter, searchTerm, setSearchTerm, activeSectionTab, setActiveSectionTab,
        selectedLedgerView, setSelectedLedgerView,
        periodStart, setPeriodStart, periodEnd, setPeriodEnd, periodSpanDays,
        lockToLastCutoff, setLockToLastCutoff, customerName, setCustomerName,
        daysDrafts, modalState, openAddModal, openEditModal, openRateModal, closeModal, handleModalSave,
        cutoffModalOpen, setCutoffModalOpen,
        dailyModalState, openDailyAddModal, openDailyEditModal, closeDailyModal,
        saveDailyRowMutation, handleDeleteDailyRow,
        pdfViewer, closePdfViewer, handleOpenStatementPdf, handleExportStatementExcel,
        handleSyncPeriodDays, createCutoffMutation, handleRevertCutoff,
        handleTogglePower, handleAdjustDays, handleDaysInputChange, handleDaysInputCommit,
        handleResetCycle, handleDeleteContainer,
        isMutating:
            togglePowerMutation.isPending || updateContainerMutation.isPending ||
            addContainerMutation.isPending || updateDailyRateMutation.isPending ||
            resetCycleMutation.isPending || syncPeriodDaysMutation.isPending ||
            createCutoffMutation.isPending || revertCutoffMutation.isPending ||
            saveDailyRowMutation.isPending || deleteDailyRowMutation.isPending
    };
}
