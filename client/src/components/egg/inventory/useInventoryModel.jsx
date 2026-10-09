import { getTodayString } from '../../../utils/dateUtils';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

export default function useInventoryModel() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('finished_product'); // 'finished_product' | 'raw_material' | 'wastes'

    // Datos del inventario general (Materia prima, Producto terminado x presentación, Mermas)
    const [overviewData, setOverviewData] = useState({
        raw_materials: { summary: {}, lots: [] },
        finished_products: { summary: {}, by_presentation: [], lots: [] },
        wastes: { summary: {}, by_stage: [], logs: [], batch_wastes: [] }
    });

    // Datos de inventario traducido a catálogo comercial
    const [inventoryData, setInventoryData] = useState({
        totals: {
            total_items: 0,
            total_stock_units: 0,
            total_weight_lbs: 0,
            total_weight_kg: 0
        },
        items: [],
        by_mapping: [],
        unmapped_products: []
    });

    // Filtros locales
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedType, setSelectedType] = useState('todos');
    const [unitOfMeasure, setUnitOfMeasure] = useState('lbs'); // 'lbs' | 'kg' | 'units'
    const [viewMode, setViewMode] = useState('mapping'); // 'mapping' | 'detail' (para catálogo comercial)

    // Estados de Modales
    const [isTarimasModalOpen, setIsTarimasModalOpen] = useState(false);
    const [selectedRmLot, setSelectedRmLot] = useState(null);

    const [isLotsModalOpen, setIsLotsModalOpen] = useState(false);
    const [selectedPresentation, setSelectedPresentation] = useState(null);

    const onOpenTarimasModal = useCallback((lot) => {
        setSelectedRmLot(lot);
        setIsTarimasModalOpen(true);
    }, []);

    const onCloseTarimasModal = useCallback(() => {
        setIsTarimasModalOpen(false);
        setSelectedRmLot(null);
    }, []);

    const onOpenLotsModal = useCallback((presentation) => {
        setSelectedPresentation(presentation);
        setIsLotsModalOpen(true);
    }, []);

    const onCloseLotsModal = useCallback(() => {
        setIsLotsModalOpen(false);
        setSelectedPresentation(null);
    }, []);

    // Carga de inventario unificada
    const fetchInventory = async () => {
        setLoading(true);
        try {
            const [overviewRes, translatedRes] = await Promise.allSettled([
                axios.get('/api/egg-industrial/inventory-overview'),
                axios.get('/api/egg-industrial/inventory-translated')
            ]);

            if (overviewRes.status === 'fulfilled' && overviewRes.value?.data) {
                setOverviewData(overviewRes.value.data);
            } else {
                console.error('Error fetching inventory-overview:', overviewRes.reason);
            }

            if (translatedRes.status === 'fulfilled' && translatedRes.value?.data) {
                setInventoryData(translatedRes.value.data);
            } else {
                console.error('Error fetching inventory-translated:', translatedRes.reason);
            }
        } catch (err) {
            console.error('Error cargando inventario industrial:', err);
            toast.error('No se pudo cargar el inventario industrial.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInventory();
    }, []);

    // Exportar a PDF o Excel
    const handleExport = async (format) => {
        try {
            const res = await axios.get(`/api/egg-industrial/inventory-translated/export?format=${format}`, {
                responseType: 'blob'
            });
            const isPdf = format === 'pdf';
            const blob = new Blob([res.data], {
                type: isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);
            if (isPdf) {
                window.open(url, '_blank');
            } else {
                const a = document.createElement('a');
                a.href = url;
                a.download = `inventario_industrial_${getTodayString(new Date())}.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            }
            setTimeout(() => window.URL.revokeObjectURL(url), 10000);
            toast.success(`Reporte exportado en formato ${format.toUpperCase()}`);
        } catch (err) {
            console.error(`Error al exportar inventario a ${format}:`, err);
            toast.error(`Error al exportar a ${format.toUpperCase()}`);
        }
    };

    // 1. Filtrar lista agrupada por vinculación (egg_product_code_mappings)
    const filteredMappings = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return (inventoryData.by_mapping || []).filter(m => {
            if (!term) return true;
            const matchName = (m.commercial_name || '').toLowerCase().includes(term);
            const matchType = (m.industrial_product_type || '').toLowerCase().includes(term);
            let codesStr = '';
            if (typeof m.catalog_codes === 'string') codesStr = m.catalog_codes;
            else if (Array.isArray(m.catalog_codes)) codesStr = m.catalog_codes.join(' ');
            const matchCodes = codesStr.toLowerCase().includes(term);
            return matchName || matchType || matchCodes;
        });
    }, [inventoryData.by_mapping, searchTerm]);

    // 2. Filtrar lista detallada de items de catálogo (sin tipo ni presentación)
    const filteredItems = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return (inventoryData.items || []).filter(item => {
            const matchesSearch = !term ||
                (item.product_name || '').toLowerCase().includes(term) ||
                (item.product_code || '').toLowerCase().includes(term) ||
                (item.matched_code || '').toLowerCase().includes(term);

            const matchesType = selectedType === 'todos' || item.product_type === selectedType;

            return matchesSearch && matchesType;
        });
    }, [inventoryData.items, searchTerm, selectedType]);

    // Tipos de producto para filtro de catálogo comercial
    const productTypes = useMemo(() => {
        return Array.from(new Set((inventoryData.items || []).map(i => i.product_type).filter(Boolean)));
    }, [inventoryData.items]);

    return {
        navigate,
        loading,
        setLoading,
        activeTab,
        setActiveTab,
        overviewData,
        inventoryData,
        searchTerm,
        setSearchTerm,
        selectedType,
        setSelectedType,
        unitOfMeasure,
        setUnitOfMeasure,
        viewMode,
        setViewMode,
        fetchInventory,
        handleExport,
        filteredMappings,
        filteredItems,
        productTypes,
        // Modal tarimas
        isTarimasModalOpen,
        selectedRmLot,
        onOpenTarimasModal,
        onCloseTarimasModal,
        // Modal lotes envasado
        isLotsModalOpen,
        selectedPresentation,
        onOpenLotsModal,
        onCloseLotsModal
    };
}
