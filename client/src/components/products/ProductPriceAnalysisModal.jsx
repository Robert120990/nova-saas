import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Modal from '../ui/Modal';
import Money from '../ui/Money';
import { toast } from 'sonner';
import { 
    Search, Store, Tag, Users, TrendingUp, AlertTriangle, 
    CheckCircle2, AlertCircle, HelpCircle, ArrowUpRight, 
    Percent, Download, RefreshCw, Check
} from 'lucide-react';

const PRESET_MARGINS = [15, 20, 25, 30, 35, 40, 50];

const ProductPriceAnalysisModal = ({ isOpen, onClose, defaultBranchId }) => {
    const queryClient = useQueryClient();

    // Filtros
    const [branchId, setBranchId] = useState(defaultBranchId || '');
    const [categoryId, setCategoryId] = useState('');
    const [providerId, setProviderId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [targetMargin, setTargetMargin] = useState(25); // Margen objetivo %
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'perdida' | 'bajo' | 'optimo' | 'sin_costo'

    // Debounce búsqueda
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Cargar sucursales
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data,
        enabled: isOpen
    });

    // Asignar sucursal por defecto si no hay seleccionada
    useEffect(() => {
        if (!branchId && branches.length > 0) {
            setBranchId(defaultBranchId || branches[0].id);
        }
    }, [branches, defaultBranchId, branchId]);

    // Cargar categorías
    const { data: categories = [] } = useQuery({
        queryKey: ['categories-catalog'],
        queryFn: async () => (await axios.get('/api/categories', { params: { limit: 2000 } })).data?.data || [],
        enabled: isOpen
    });

    // Cargar proveedores
    const { data: providers = [] } = useQuery({
        queryKey: ['providers-catalog'],
        queryFn: async () => (await axios.get('/api/providers', { params: { limit: 2000 } })).data?.data || [],
        enabled: isOpen
    });

    // Cargar datos de análisis de precios (Lista completa sin paginado)
    const { 
        data: analysisResponse = { data: [], total: 0, stats: {} }, 
        isLoading, 
        isFetching, 
        refetch 
    } = useQuery({
        queryKey: ['product-price-analysis', branchId, categoryId, providerId, debouncedSearch],
        queryFn: async () => {
            const res = await axios.get('/api/products/price-analysis', {
                params: {
                    branch_id: branchId || undefined,
                    category_id: categoryId || undefined,
                    provider_id: providerId || undefined,
                    search: debouncedSearch || undefined,
                    limit: 'all'
                }
            });
            return res.data;
        },
        enabled: isOpen && Boolean(branchId || branches.length > 0)
    });

    const rawProducts = analysisResponse.data || [];

    // Mutación para aplicar precio sugerido
    const updatePriceMutation = useMutation({
        mutationFn: async ({ productId, branchId, newPrice }) => {
            const res = await axios.post('/api/products/update-branch-price', {
                product_id: productId,
                branch_id: branchId,
                precio_unitario: newPrice
            });
            return res.data;
        },
        onSuccess: (data, variables) => {
            toast.success(`Precio actualizado a $${parseFloat(variables.newPrice).toFixed(2)} correctamente`);
            queryClient.invalidateQueries({ queryKey: ['product-price-analysis'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al actualizar precio');
        }
    });

    // Cálculos derivados para cada producto
    const processedProducts = useMemo(() => {
        const marginPctNum = parseFloat(targetMargin) || 25;
        const targetDecimal = Math.min(0.99, Math.max(0.01, marginPctNum / 100));

        return rawProducts.map(p => {
            const costo = parseFloat(p.costo || 0);
            const precio = parseFloat(p.precio || 0);
            const existencia = parseFloat(p.existencia || 0);

            const utilidad = precio - costo;
            const rentabilidad = precio > 0 ? (utilidad / precio) * 100 : 0;
            const markup = costo > 0 ? (utilidad / costo) * 100 : 0;

            // Precio sugerido según margen comercial sobre venta: Costo / (1 - Margen)
            let precioSugerido = 0;
            if (costo > 0) {
                precioSugerido = Math.round((costo / (1 - targetDecimal)) * 100) / 100;
            }

            // Determinación de estado e indicador
            let estado = 'optimo'; // 'optimo' | 'bajo' | 'perdida' | 'sin_costo'
            let indicadorMensaje = 'Precio óptimo';
            let necesitaSubir = false;

            if (costo <= 0) {
                estado = 'sin_costo';
                indicadorMensaje = 'Sin costo';
            } else if (precio <= costo) {
                estado = 'perdida';
                indicadorMensaje = precio === costo ? 'Venta al costo' : 'En pérdida';
                necesitaSubir = true;
            } else if (rentabilidad < marginPctNum) {
                estado = 'bajo';
                indicadorMensaje = 'Margen bajo';
                necesitaSubir = true;
            } else {
                estado = 'optimo';
                indicadorMensaje = 'Óptimo';
            }

            const diferenciaSugerida = precioSugerido > 0 && precioSugerido > precio
                ? Math.round((precioSugerido - precio) * 100) / 100
                : 0;

            return {
                ...p,
                costo,
                precio,
                existencia,
                utilidad,
                rentabilidad,
                markup,
                precioSugerido,
                diferenciaSugerida,
                estado,
                indicadorMensaje,
                necesitaSubir
            };
        });
    }, [rawProducts, targetMargin]);

    // Filtrar en memoria por estado si se selecciona un tab de alerta
    const displayedProducts = useMemo(() => {
        if (statusFilter === 'all') return processedProducts;
        return processedProducts.filter(p => p.estado === statusFilter);
    }, [processedProducts, statusFilter]);

    // Métricas para las tarjetas de resumen (calculadas sobre toda la lista completa)
    const metrics = useMemo(() => {
        const total = processedProducts.length;
        const perdidaCount = processedProducts.filter(p => p.estado === 'perdida').length;
        const bajoCount = processedProducts.filter(p => p.estado === 'bajo').length;
        const optimoCount = processedProducts.filter(p => p.estado === 'optimo').length;
        const sinCostoCount = processedProducts.filter(p => p.estado === 'sin_costo').length;

        const validProducts = processedProducts.filter(p => p.precio > 0 && p.costo > 0);
        const avgMargin = validProducts.length > 0
            ? validProducts.reduce((sum, p) => sum + p.rentabilidad, 0) / validProducts.length
            : 0;

        return {
            total,
            perdidaCount,
            bajoCount,
            optimoCount,
            sinCostoCount,
            avgMargin
        };
    }, [processedProducts]);

    // Exportar a CSV
    const handleExportCSV = () => {
        if (displayedProducts.length === 0) {
            return toast.error('No hay datos para exportar');
        }

        const headers = [
            'Código', 'Descripción', 'Categoría', 'Proveedor', 
            'Costo ($)', 'Precio ($)', 'Existencia', 'Utilidad ($)', 
            'Rentabilidad (%)', 'Estado', 'Precio Sugerido ($)'
        ];

        const rows = displayedProducts.map(p => [
            `"${p.codigo || ''}"`,
            `"${(p.nombre || '').replace(/"/g, '""')}"`,
            `"${(p.category_name || 'Sin categoría').replace(/"/g, '""')}"`,
            `"${(p.provider_name || 'Sin proveedor').replace(/"/g, '""')}"`,
            p.costo.toFixed(2),
            p.precio.toFixed(2),
            p.existencia,
            p.utilidad.toFixed(2),
            p.costo > 0 ? `${p.rentabilidad.toFixed(2)}%` : 'N/A',
            `"${p.indicadorMensaje}"`,
            p.precioSugerido > 0 ? p.precioSugerido.toFixed(2) : '-'
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `analisis_precios_rentabilidad_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Aplicar precio sugerido
    const handleApplyPrice = (product) => {
        if (!branchId) return toast.error('Seleccione una sucursal');
        if (!product.precioSugerido || product.precioSugerido <= 0) {
            return toast.error('No hay precio sugerido válido');
        }

        updatePriceMutation.mutate({
            productId: product.id,
            branchId: parseInt(branchId),
            newPrice: product.precioSugerido
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Análisis de Precios, Márgenes y Rentabilidad"
            maxWidth="max-w-[98vw] 2xl:max-w-[1550px]"
            maxHeight="sm:max-h-[96vh]"
            height="sm:h-[94vh]"
            bodyClassName="p-2.5 sm:p-4 flex flex-col gap-2.5 h-full overflow-hidden"
        >
            {/* Top Toolbar / Filters (Compact) */}
            <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-xs space-y-2 shrink-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 items-end">
                    {/* Sucursal */}
                    <div className="lg:col-span-3">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-0.5 flex items-center gap-1">
                            <Store size={12} className="text-indigo-600" />
                            <span>Sucursal</span>
                        </label>
                        <select
                            value={branchId}
                            onChange={(e) => setBranchId(e.target.value)}
                            className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-xs"
                        >
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.nombre}</option>
                            ))}
                        </select>
                    </div>

                    {/* Categoría */}
                    <div className="lg:col-span-3">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-0.5 flex items-center gap-1">
                            <Tag size={12} className="text-indigo-600" />
                            <span>Categoría</span>
                        </label>
                        <select
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-xs"
                        >
                            <option value="">Todas las categorías</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Proveedor */}
                    <div className="lg:col-span-3">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-0.5 flex items-center gap-1">
                            <Users size={12} className="text-indigo-600" />
                            <span>Proveedor</span>
                        </label>
                        <select
                            value={providerId}
                            onChange={(e) => setProviderId(e.target.value)}
                            className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-xs"
                        >
                            <option value="">Todos los proveedores</option>
                            {providers.map(pr => (
                                <option key={pr.id} value={pr.id}>{pr.nombre}</option>
                            ))}
                        </select>
                    </div>

                    {/* Búsqueda */}
                    <div className="lg:col-span-3">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-0.5 flex items-center gap-1">
                            <Search size={12} className="text-indigo-600" />
                            <span>Búsqueda</span>
                        </label>
                        <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Código, nombre..."
                                className="w-full pl-7 pr-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-xs"
                            />
                        </div>
                    </div>
                </div>

                {/* Sub-toolbar: Target Margin + Actions */}
                <div className="pt-1.5 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1">
                            <TrendingUp size={12} className="text-indigo-600" />
                            <span>Margen Objetivo:</span>
                        </span>
                        
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-0.5 shadow-xs">
                            <input
                                type="number"
                                min="1"
                                max="99"
                                value={targetMargin}
                                onChange={(e) => setTargetMargin(Math.max(1, Math.min(99, parseInt(e.target.value) || 25)))}
                                className="w-12 px-1 py-0.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded text-center outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <span className="text-xs font-bold text-indigo-700">%</span>
                        </div>

                        {/* Presets rápidos */}
                        <div className="hidden sm:flex items-center gap-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase mr-0.5">Presets:</span>
                            {PRESET_MARGINS.map(m => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setTargetMargin(m)}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                        Number(targetMargin) === m
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'bg-white hover:bg-slate-200 text-slate-600 border border-slate-200'
                                    }`}
                                >
                                    {m}%
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Botones de acción derecha */}
                    <div className="flex items-center gap-1.5 ml-auto">
                        <button
                            type="button"
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg border border-slate-200 transition-colors shadow-xs disabled:opacity-50"
                            title="Recargar análisis"
                        >
                            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
                        </button>
                        <button
                            type="button"
                            onClick={handleExportCSV}
                            className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95"
                            title="Exportar a CSV"
                        >
                            <Download size={13} className="text-slate-500" />
                            <span>Exportar CSV</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI Summary Cards (Compact) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 shrink-0">
                <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`p-2 rounded-xl border text-left transition-all ${
                        statusFilter === 'all'
                            ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                >
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight block">Total Items</span>
                    <span className="text-sm sm:text-base font-bold text-slate-900">{metrics.total}</span>
                </button>

                <button
                    type="button"
                    onClick={() => setStatusFilter('perdida')}
                    className={`p-2 rounded-xl border text-left transition-all ${
                        statusFilter === 'perdida'
                            ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:bg-rose-50/40'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-rose-600 uppercase tracking-tight">En Pérdida</span>
                        <AlertTriangle size={12} className="text-rose-600" />
                    </div>
                    <span className="text-sm sm:text-base font-bold text-rose-700">{metrics.perdidaCount}</span>
                </button>

                <button
                    type="button"
                    onClick={() => setStatusFilter('bajo')}
                    className={`p-2 rounded-xl border text-left transition-all ${
                        statusFilter === 'bajo'
                            ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:bg-amber-50/40'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-amber-600 uppercase tracking-tight">Margen Bajo</span>
                        <ArrowUpRight size={12} className="text-amber-600" />
                    </div>
                    <span className="text-sm sm:text-base font-bold text-amber-700">{metrics.bajoCount}</span>
                </button>

                <button
                    type="button"
                    onClick={() => setStatusFilter('optimo')}
                    className={`p-2 rounded-xl border text-left transition-all ${
                        statusFilter === 'optimo'
                            ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:bg-emerald-50/40'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-tight">Óptimo</span>
                        <CheckCircle2 size={12} className="text-emerald-600" />
                    </div>
                    <span className="text-sm sm:text-base font-bold text-emerald-700">{metrics.optimoCount}</span>
                </button>

                <button
                    type="button"
                    onClick={() => setStatusFilter('sin_costo')}
                    className={`p-2 rounded-xl border text-left transition-all ${
                        statusFilter === 'sin_costo'
                            ? 'bg-slate-100 border-slate-300 ring-2 ring-slate-500/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Sin Costo</span>
                        <HelpCircle size={12} className="text-slate-400" />
                    </div>
                    <span className="text-sm sm:text-base font-bold text-slate-600">{metrics.sinCostoCount}</span>
                </button>

                <div className="p-2 rounded-xl border border-slate-200 bg-white text-left">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight block">Margen Prom.</span>
                    <span className={`text-sm sm:text-base font-bold ${metrics.avgMargin >= targetMargin ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {metrics.avgMargin.toFixed(1)}%
                    </span>
                </div>
            </div>

            {/* Table Area with Full Scroll (Compact & Responsive) */}
            <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto overflow-x-hidden md:overflow-x-auto relative">
                    {/* Vista en tarjeta para móvil */}
                    <div className="md:hidden divide-y divide-slate-100">
                        {isLoading ? (
                            <div className="px-4 py-10 text-center">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-6 h-6 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-xs font-semibold text-slate-500">Cargando productos...</span>
                                </div>
                            </div>
                        ) : displayedProducts.length > 0 ? (
                            <div className="p-2 space-y-2">
                                {displayedProducts.map((p) => {
                                    const isUpdating = updatePriceMutation.isPending && updatePriceMutation.variables?.productId === p.id;
                                    return (
                                        <div key={p.id} className="bg-slate-50/70 rounded-xl p-2.5 border border-slate-100 shadow-xs space-y-1.5 text-xs">
                                            <div className="flex items-start justify-between gap-1.5">
                                                <div className="min-w-0">
                                                    <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded text-[10px] mr-1">
                                                        {p.codigo}
                                                    </span>
                                                    <span className="font-bold text-slate-900">{p.nombre}</span>
                                                </div>
                                                <span className="text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded uppercase shrink-0">
                                                    {p.category_name || 'Sin cat.'}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-1.5 bg-white p-2 rounded-lg border border-slate-100 text-[11px]">
                                                <div>
                                                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Costo:</span>
                                                    <span className="font-medium text-slate-700"><Money value={p.costo} /></span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Precio Actual:</span>
                                                    <span className="font-bold text-slate-900"><Money value={p.precio} /></span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Existencia:</span>
                                                    <span className="font-bold text-slate-800">{p.existencia}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Margen:</span>
                                                    <span className={`font-bold ${p.rentabilidad >= targetMargin ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                        {p.costo > 0 ? `${p.rentabilidad.toFixed(1)}%` : 'N/A'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-0.5">
                                                <div>
                                                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Sugerido:</span>
                                                    <span className="font-bold text-indigo-700 text-xs">
                                                        {p.precioSugerido > 0 ? <Money value={p.precioSugerido} /> : '-'}
                                                    </span>
                                                </div>
                                                {p.necesitaSubir && p.precioSugerido > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleApplyPrice(p)}
                                                        disabled={isUpdating}
                                                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs disabled:opacity-50 inline-flex items-center gap-1"
                                                    >
                                                        {isUpdating ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
                                                        <span>Aplicar Sugerido</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="px-4 py-10 text-center text-slate-400 italic text-xs">
                                No se encontraron productos con los filtros seleccionados
                            </div>
                        )}
                    </div>

                    {/* Vista en Tabla Compacta (Optimizado para ancho completo sin scroll horizontal) */}
                    <table className="hidden md:table w-full text-left border-collapse table-auto">
                        <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur border-b border-slate-200 shadow-xs text-[10px] font-bold text-slate-600 uppercase tracking-tight">
                            <tr>
                                <th className="px-2 py-2 w-[85px]">Código</th>
                                <th className="px-2 py-2">Descripción</th>
                                <th className="px-2 py-2 w-[110px]">Categoría</th>
                                <th className="px-2 py-2 text-right w-[75px]">Costo</th>
                                <th className="px-2 py-2 text-right w-[75px]">Precio</th>
                                <th className="px-1.5 py-2 text-center w-[55px]">Exist.</th>
                                <th className="px-2 py-2 text-right w-[75px]">Utilidad</th>
                                <th className="px-1.5 py-2 text-center w-[70px]">Margen</th>
                                <th className="px-1.5 py-2 text-center w-[85px]">Estado</th>
                                <th className="px-2 py-2 text-right w-[85px]">P. Sugerido</th>
                                <th className="px-1.5 py-2 text-center w-[65px]">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px]">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={11} className="px-4 py-14 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-6 h-6 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-xs font-semibold text-slate-500">Cargando lista completa de productos...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : displayedProducts.length > 0 ? (
                                displayedProducts.map((p) => {
                                    const isUpdating = updatePriceMutation.isPending && updatePriceMutation.variables?.productId === p.id;

                                    return (
                                        <tr key={p.id} className="hover:bg-indigo-50/25 transition-colors border-b border-slate-100 last:border-0 leading-tight">
                                            {/* Código */}
                                            <td className="px-2 py-1 whitespace-nowrap">
                                                <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded text-[10px]">
                                                    {p.codigo}
                                                </span>
                                            </td>

                                            {/* Descripción */}
                                            <td className="px-2 py-1 max-w-[220px]">
                                                <div className="font-bold text-slate-800 text-[11px] truncate" title={p.nombre}>
                                                    {p.nombre}
                                                </div>
                                                {p.provider_name && (
                                                    <div className="text-[9px] text-slate-400 font-medium truncate" title={`Proveedor: ${p.provider_name}`}>
                                                        {p.provider_name}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Categoría */}
                                            <td className="px-2 py-1 max-w-[110px]">
                                                {p.category_name ? (
                                                    <span className="inline-block text-[9px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded uppercase truncate max-w-[105px]" title={p.category_name}>
                                                        {p.category_name}
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] text-slate-400 italic">—</span>
                                                )}
                                            </td>

                                            {/* Costo */}
                                            <td className="px-2 py-1 text-right whitespace-nowrap text-slate-600 font-medium">
                                                <Money value={p.costo} />
                                            </td>

                                            {/* Precio */}
                                            <td className="px-2 py-1 text-right whitespace-nowrap font-bold text-slate-900">
                                                <Money value={p.precio} />
                                            </td>

                                            {/* Existencia */}
                                            <td className="px-1.5 py-1 text-center whitespace-nowrap">
                                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                    p.existencia > 0 
                                                        ? 'bg-emerald-50 text-emerald-700' 
                                                        : p.existencia < 0 
                                                            ? 'bg-rose-50 text-rose-700' 
                                                            : 'text-slate-400'
                                                }`}>
                                                    {p.existencia}
                                                </span>
                                            </td>

                                            {/* Utilidad */}
                                            <td className="px-2 py-1 text-right whitespace-nowrap">
                                                <span className={`font-bold ${p.utilidad < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                                                    <Money value={p.utilidad} />
                                                </span>
                                            </td>

                                            {/* Margen % */}
                                            <td className="px-1.5 py-1 text-center whitespace-nowrap">
                                                {p.costo <= 0 ? (
                                                    <span className="text-slate-400 italic text-[10px]">—</span>
                                                ) : (
                                                    <span className={`font-bold ${
                                                        p.rentabilidad <= 0
                                                            ? 'text-rose-600'
                                                            : p.rentabilidad < targetMargin
                                                                ? 'text-amber-600'
                                                                : 'text-emerald-600'
                                                    }`}>
                                                        {p.rentabilidad.toFixed(1)}%
                                                    </span>
                                                )}
                                            </td>

                                            {/* Indicador / Estado */}
                                            <td className="px-1.5 py-1 text-center whitespace-nowrap">
                                                {p.estado === 'optimo' && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                                        <CheckCircle2 size={10} />
                                                        <span>Óptimo</span>
                                                    </span>
                                                )}
                                                {p.estado === 'bajo' && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                                                        <ArrowUpRight size={10} />
                                                        <span>Subir</span>
                                                    </span>
                                                )}
                                                {p.estado === 'perdida' && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                                                        <AlertTriangle size={10} />
                                                        <span>Pérdida</span>
                                                    </span>
                                                )}
                                                {p.estado === 'sin_costo' && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                                        <HelpCircle size={10} />
                                                        <span>S/C</span>
                                                    </span>
                                                )}
                                            </td>

                                            {/* Precio Sugerido */}
                                            <td className="px-2 py-1 text-right whitespace-nowrap">
                                                {p.costo <= 0 ? (
                                                    <span className="text-slate-400 italic text-[10px]">—</span>
                                                ) : p.necesitaSubir ? (
                                                    <span className="font-bold text-indigo-700">
                                                        <Money value={p.precioSugerido} />
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">
                                                        <Money value={p.precio} />
                                                    </span>
                                                )}
                                            </td>

                                            {/* Acción Rápida: Aplicar */}
                                            <td className="px-1.5 py-1 text-center whitespace-nowrap">
                                                {p.necesitaSubir && p.precioSugerido > 0 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleApplyPrice(p)}
                                                        disabled={isUpdating}
                                                        className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50"
                                                        title={`Aplicar precio sugerido: $${p.precioSugerido.toFixed(2)}`}
                                                    >
                                                        {isUpdating ? <RefreshCw size={9} className="animate-spin" /> : <Check size={9} />}
                                                        <span>Aplicar</span>
                                                    </button>
                                                ) : (
                                                    <span className="text-[10px] text-slate-300">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={11} className="px-4 py-14 text-center text-slate-400 italic text-xs">
                                        No se encontraron productos con los filtros seleccionados
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer compacto sin paginado */}
                <div className="px-3 py-1.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 font-medium shrink-0">
                    <div className="flex items-center gap-2">
                        <span>Mostrando <strong className="text-slate-900 font-bold">{displayedProducts.length}</strong> de <strong className="text-slate-900 font-bold">{processedProducts.length}</strong> productos</span>
                        {statusFilter !== 'all' && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider border border-indigo-200/60">
                                Filtro: {statusFilter.replace('_', ' ')}
                            </span>
                        )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal">
                        Lista completa vertical • Sin paginado
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ProductPriceAnalysisModal;
