import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { unwrapList } from '../../../utils/apiUtils';
import { useConfirm } from '../../../context/ConfirmContext';

export default function useSuppliesModel() {
    const queryClient = useQueryClient();
    const confirm = useConfirm();

    const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | 'empaque' | 'aditivo' | 'quimico_cip'
    const [stockFilter, setStockFilter] = useState('all'); // 'all' | 'low' | 'out' | 'ok'
    const [searchTerm, setSearchTerm] = useState('');
    const [activeViewTab, setActiveViewTab] = useState('catalog'); // 'catalog' | 'kardex'

    const [supplyModalState, setSupplyModalState] = useState({ open: false, item: null });
    const [movementModalState, setMovementModalState] = useState({
        open: false,
        supply: null,
        defaultType: 'entrada_compra'
    });

    const [pdfViewer, setPdfViewer] = useState({
        isOpen: false,
        pdfUrl: null,
        isLoading: false,
        error: null,
        title: 'Inventario Valorizado de Insumos Industriales',
        subtitle: 'Material de Empaque, Ingredientes/Aditivos y Químicos CIP',
        fileName: 'inventario_insumos_industrial.pdf'
    });

    const { data: overviewData, isLoading } = useQuery({
        queryKey: ['egg-industrial-supplies'],
        queryFn: async () => {
            const res = await axios.get('/api/egg-industrial/supplies');
            const payload = res.data || {};
            return {
                supplies: unwrapList({ data: payload.supplies || [] }),
                summary: payload.summary || {
                    total_items: 0,
                    total_inventory_value: 0,
                    empaque_count: 0,
                    empaque_value: 0,
                    aditivo_count: 0,
                    aditivo_value: 0,
                    quimico_cip_count: 0,
                    quimico_cip_value: 0,
                    low_stock_count: 0,
                    out_of_stock_count: 0,
                    optimal_stock_count: 0
                },
                movements: unwrapList({ data: payload.movements || [] }),
                batches: unwrapList({ data: payload.batches || [] })
            };
        }
    });

    const supplies = useMemo(
        () => (Array.isArray(overviewData?.supplies) ? overviewData.supplies : []),
        [overviewData]
    );
    const summary = overviewData?.summary || {
        total_items: supplies.length,
        total_inventory_value: 0,
        empaque_count: 0,
        empaque_value: 0,
        aditivo_count: 0,
        aditivo_value: 0,
        quimico_cip_count: 0,
        quimico_cip_value: 0,
        low_stock_count: 0,
        out_of_stock_count: 0,
        optimal_stock_count: 0
    };
    const movements = useMemo(
        () => (Array.isArray(overviewData?.movements) ? overviewData.movements : []),
        [overviewData]
    );
    const batches = useMemo(
        () => (Array.isArray(overviewData?.batches) ? overviewData.batches : []),
        [overviewData]
    );

    const filteredSupplies = useMemo(() => {
        return supplies.filter(item => {
            if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
            if (stockFilter === 'low' && item.stock_status !== 'bajo_stock') return false;
            if (stockFilter === 'out' && item.stock_status !== 'agotado') return false;
            if (stockFilter === 'ok' && item.stock_status !== 'ok') return false;
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase();
                const matchName = String(item.item_name || '').toLowerCase().includes(q);
                const matchCode = String(item.item_code || '').toLowerCase().includes(q);
                const matchCat = String(item.category_label || '').toLowerCase().includes(q);
                if (!matchName && !matchCode && !matchCat) return false;
            }
            return true;
        });
    }, [supplies, categoryFilter, stockFilter, searchTerm]);

    const filteredMovements = useMemo(() => {
        return movements.filter(m => {
            if (categoryFilter !== 'all' && m.category !== categoryFilter) return false;
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase();
                const matchName = String(m.item_name || '').toLowerCase().includes(q);
                const matchCode = String(m.item_code || '').toLowerCase().includes(q);
                const matchRef = String(m.reference_doc || '').toLowerCase().includes(q);
                const matchBatch = String(m.batch_code || '').toLowerCase().includes(q);
                if (!matchName && !matchCode && !matchRef && !matchBatch) return false;
            }
            return true;
        });
    }, [movements, categoryFilter, searchTerm]);

    const syncCache = (newData) => {
        if (newData && Array.isArray(newData.supplies)) {
            queryClient.setQueryData(['egg-industrial-supplies'], {
                supplies: unwrapList({ data: newData.supplies }),
                summary: newData.summary,
                movements: unwrapList({ data: newData.movements || [] }),
                batches: unwrapList({ data: newData.batches || [] })
            });
        } else {
            queryClient.invalidateQueries({ queryKey: ['egg-industrial-supplies'] });
        }
    };

    const saveSupplyMutation = useMutation({
        mutationFn: async (payload) => {
            if (payload.id) {
                const res = await axios.put(`/api/egg-industrial/supplies/${payload.id}`, payload);
                return res.data;
            }
            const res = await axios.post('/api/egg-industrial/supplies', payload);
            return res.data;
        },
        onSuccess: (data, variables) => {
            syncCache(data);
            setSupplyModalState({ open: false, item: null });
            toast.success(variables.id ? 'Insumo actualizado correctamente' : 'Nuevo insumo registrado en inventario');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar insumo')
    });

    const registerMovementMutation = useMutation({
        mutationFn: async (payload) => {
            const res = await axios.post('/api/egg-industrial/supplies/movements', payload);
            return res.data;
        },
        onSuccess: (data) => {
            syncCache(data);
            setMovementModalState({ open: false, supply: null, defaultType: 'entrada_compra' });
            toast.success('Movimiento registrado y existencias actualizadas');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al registrar movimiento de insumo')
    });

    const syncCostingMutation = useMutation({
        mutationFn: async () => {
            const res = await axios.post('/api/egg-industrial/supplies/sync-costing');
            return res.data;
        },
        onSuccess: (data) => {
            syncCache(data);
            toast.success('Catálogo y costos de insumos sincronizados con Costeo por Libra');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al sincronizar con Costeo')
    });

    const deleteSupplyMutation = useMutation({
        mutationFn: async (id) => {
            const res = await axios.delete(`/api/egg-industrial/supplies/${id}`);
            return res.data;
        },
        onSuccess: (data) => {
            syncCache(data);
            toast.success('Insumo eliminado del catálogo');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar insumo')
    });

    const handleDeleteSupply = async (item) => {
        const ok = await confirm({
            title: `¿Eliminar ${item.item_name}?`,
            message: `Se eliminará el insumo ${item.item_code} del inventario.`,
            confirmText: 'Eliminar',
            cancelText: 'Cancelar',
            variant: 'danger'
        });
        if (!ok) return;
        deleteSupplyMutation.mutate(item.id);
    };

    const handleOpenReportPdf = async () => {
        if (pdfViewer.pdfUrl) URL.revokeObjectURL(pdfViewer.pdfUrl);
        setPdfViewer(prev => ({
            ...prev,
            isOpen: true,
            pdfUrl: null,
            isLoading: true,
            error: null
        }));
        try {
            const res = await axios.get('/api/egg-industrial/supplies/report', {
                params: { category: categoryFilter },
                responseType: 'blob'
            });
            const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            setPdfViewer(prev => ({ ...prev, pdfUrl: url, isLoading: false }));
        } catch (err) {
            setPdfViewer(prev => ({
                ...prev,
                isLoading: false,
                error: err.response?.data?.message || 'No se pudo generar el PDF de Inventario de Insumos.'
            }));
        }
    };

    const handleExportExcel = async () => {
        try {
            const res = await axios.get('/api/egg-industrial/supplies/report', {
                params: { category: categoryFilter, format: 'excel' },
                responseType: 'blob'
            });
            const url = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `inventario_insumos_industrial_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast.success('Inventario de insumos exportado a Excel');
        } catch {
            toast.error('Error al exportar inventario de insumos a Excel');
        }
    };

    const closePdfViewer = () => {
        if (pdfViewer.pdfUrl) URL.revokeObjectURL(pdfViewer.pdfUrl);
        setPdfViewer(prev => ({ ...prev, isOpen: false, pdfUrl: null }));
    };

    const openNewSupplyModal = () => setSupplyModalState({ open: true, item: null });
    const openEditSupplyModal = (item) => setSupplyModalState({ open: true, item });
    const closeSupplyModal = () => setSupplyModalState({ open: false, item: null });

    const openMovementModal = (supply = null, defaultType = 'entrada_compra') =>
        setMovementModalState({ open: true, supply: supply || supplies[0] || null, defaultType });
    const closeMovementModal = () =>
        setMovementModalState({ open: false, supply: null, defaultType: 'entrada_compra' });

    return {
        supplies,
        filteredSupplies,
        summary,
        movements,
        filteredMovements,
        batches,
        isLoading,
        categoryFilter,
        setCategoryFilter,
        stockFilter,
        setStockFilter,
        searchTerm,
        setSearchTerm,
        activeViewTab,
        setActiveViewTab,
        supplyModalState,
        openNewSupplyModal,
        openEditSupplyModal,
        closeSupplyModal,
        saveSupplyMutation,
        movementModalState,
        openMovementModal,
        closeMovementModal,
        registerMovementMutation,
        syncCostingMutation,
        handleDeleteSupply,
        pdfViewer,
        closePdfViewer,
        handleOpenReportPdf,
        handleExportExcel
    };
}
