import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { unwrapList } from '../../../utils/apiUtils';
import { useConfirm } from '../../../context/ConfirmContext';

export default function useContainersModel() {
    const queryClient = useQueryClient();
    const confirm = useConfirm();

    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'available' | 'active'
    const [searchTerm, setSearchTerm] = useState('');
    const [activeSectionTab, setActiveSectionTab] = useState('table'); // 'table' | 'logs'

    // Modal state ('add' | 'edit' | 'rate')
    const [modalState, setModalState] = useState({
        open: false,
        mode: 'add',
        container: null
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
                summary: payload.summary || {
                    total_containers: 0,
                    available_count: 0,
                    active_count: 0,
                    total_days_on: 0,
                    default_daily_rate: 195,
                    default_daily_iva: 25.35,
                    default_daily_with_iva: 220.35,
                    iva_rate_percent: 13,
                    total_subtotal: 0,
                    total_iva: 0,
                    total_with_iva: 0
                },
                logs: unwrapList({ data: payload.logs || [] })
            };
        }
    });

    const containers = useMemo(
        () => (Array.isArray(overviewData?.containers) ? overviewData.containers : []),
        [overviewData]
    );
    const summary = overviewData?.summary || {
        total_containers: containers.length,
        available_count: 0,
        active_count: 0,
        total_days_on: 0,
        default_daily_rate: 195,
        default_daily_iva: 25.35,
        default_daily_with_iva: 220.35,
        iva_rate_percent: 13,
        total_subtotal: 0,
        total_iva: 0,
        total_with_iva: 0
    };
    const logs = useMemo(
        () => (Array.isArray(overviewData?.logs) ? overviewData.logs : []),
        [overviewData]
    );

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
                summary: newData.summary,
                logs: unwrapList({ data: newData.logs || [] })
            });
        } else {
            queryClient.invalidateQueries({ queryKey: ['egg-containers-overview'] });
        }
    };

    const togglePowerMutation = useMutation({
        mutationFn: async ({ id, is_active_power, days_on, notes }) => {
            const res = await axios.post(`/api/egg-industrial/containers/${id}/toggle-power`, {
                is_active_power,
                days_on,
                notes
            });
            return res.data;
        },
        onSuccess: (data, variables) => {
            invalidateAndSync(data);
            toast.success(
                variables.is_active_power
                    ? 'Contenedor encendido (En almacenamiento)'
                    : 'Contenedor apagado (Disponible)'
            );
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al cambiar estado del contenedor');
        }
    });

    const updateContainerMutation = useMutation({
        mutationFn: async ({ id, ...payload }) => {
            const res = await axios.put(`/api/egg-industrial/containers/${id}`, payload);
            return res.data;
        },
        onSuccess: (data) => {
            invalidateAndSync(data);
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al actualizar contenedor');
        }
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
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al adicionar contenedor');
        }
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
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al actualizar tarifa diaria');
        }
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
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al reiniciar ciclo del contenedor');
        }
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
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al eliminar contenedor');
        }
    });

    const handleTogglePower = (container) => {
        const nextPower = !container.is_active_power;
        const draftDays = daysDrafts[container.id];
        const currentDays = draftDays !== undefined ? parseFloat(draftDays) || 0 : parseFloat(container.days_on) || 0;
        const nextDays = nextPower && currentDays === 0 ? 1 : currentDays;

        setDaysDrafts(prev => {
            const copy = { ...prev };
            delete copy[container.id];
            return copy;
        });

        togglePowerMutation.mutate({
            id: container.id,
            is_active_power: nextPower,
            days_on: nextDays
        });
    };

    const handleAdjustDays = (container, delta) => {
        const currentVal = daysDrafts[container.id] !== undefined
            ? parseFloat(daysDrafts[container.id]) || 0
            : parseFloat(container.days_on) || 0;
        const nextVal = Math.max(0, +(currentVal + delta).toFixed(2));
        setDaysDrafts(prev => ({ ...prev, [container.id]: String(nextVal) }));
        updateContainerMutation.mutate({
            id: container.id,
            days_on: nextVal,
            log_change: true
        });
    };

    const handleDaysInputChange = (containerId, value) => {
        setDaysDrafts(prev => ({ ...prev, [containerId]: value }));
    };

    const handleDaysInputCommit = (container) => {
        const raw = daysDrafts[container.id];
        if (raw === undefined) return;
        const nextVal = Math.max(0, parseFloat(raw) || 0);
        setDaysDrafts(prev => {
            const copy = { ...prev };
            delete copy[container.id];
            return copy;
        });
        if (nextVal === parseFloat(container.days_on || 0)) return;
        updateContainerMutation.mutate({
            id: container.id,
            days_on: nextVal,
            log_change: true
        });
        toast.success(`Días actualizados en ${container.name}`);
    };

    const handleResetCycle = async (container) => {
        const ok = await confirm({
            title: `¿Cerrar ciclo y reiniciar ${container.name}?`,
            message: `Se guardará el registro de ${container.days_on} día(s) en la bitácora y el contenedor quedará APAGADO (Disponible) con 0 días.`,
            confirmText: 'Sí, cerrar ciclo y reiniciar',
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

    const handleModalSave = (formPayload) => {
        if (modalState.mode === 'add') {
            addContainerMutation.mutate(formPayload);
        } else if (modalState.mode === 'edit' && modalState.container) {
            updateContainerMutation.mutate(
                { id: modalState.container.id, ...formPayload, log_change: true },
                {
                    onSuccess: () => {
                        closeModal();
                        toast.success('Contenedor actualizado correctamente');
                    }
                }
            );
        } else if (modalState.mode === 'rate') {
            updateDailyRateMutation.mutate(formPayload.daily_rate);
        }
    };

    return {
        containers,
        filteredContainers,
        summary,
        logs,
        isLoading,
        statusFilter,
        setStatusFilter,
        searchTerm,
        setSearchTerm,
        activeSectionTab,
        setActiveSectionTab,
        daysDrafts,
        modalState,
        openAddModal,
        openEditModal,
        openRateModal,
        closeModal,
        handleModalSave,
        handleTogglePower,
        handleAdjustDays,
        handleDaysInputChange,
        handleDaysInputCommit,
        handleResetCycle,
        handleDeleteContainer,
        isMutating:
            togglePowerMutation.isPending ||
            updateContainerMutation.isPending ||
            addContainerMutation.isPending ||
            updateDailyRateMutation.isPending ||
            resetCycleMutation.isPending
    };
}
