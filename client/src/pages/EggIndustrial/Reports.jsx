import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
    FileText,
    FileSpreadsheet,
    Calendar,
    Filter,
    Layers,
    PackageCheck,
    CheckCircle2,
    AlertOctagon,
    Boxes,
    Search,
    RefreshCw,
    Download,
    TrendingUp,
    Scale,
    Building2,
    CheckCircle,
    XCircle,
    FlaskConical
} from 'lucide-react';

const EggReports = () => {
    // Pestañas disponibles
    const [activeTab, setActiveTab] = useState('production'); // 'raw_materials' | 'production' | 'packaging' | 'quality' | 'wastes'

    // Filtros
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const formatDateForInput = (d) => d.toISOString().split('T')[0];

    const [filters, setFilters] = useState({
        from: formatDateForInput(thirtyDaysAgo),
        to: formatDateForInput(today),
        provider_id: '',
        product_type: '',
        batch_id: ''
    });

    // Catálogos para filtros
    const [providers, setProviders] = useState([]);
    const [batches, setBatches] = useState([]);

    // Datos del reporte activo
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState({ pdf: false, excel: false });

    // Cargar selectores al inicio
    useEffect(() => {
        const loadFilterOptions = async () => {
            try {
                const [provRes, batchRes] = await Promise.all([
                    axios.get('/api/egg-industrial/raw-materials'),
                    axios.get('/api/egg-industrial/batches')
                ]);
                
                // Extraer proveedores únicos
                const rawProv = provRes.data || [];
                const uniqueProvMap = new Map();
                rawProv.forEach(p => {
                    if (p.provider_id && !uniqueProvMap.has(p.provider_id)) {
                        uniqueProvMap.set(p.provider_id, p.provider_name || `Proveedor #${p.provider_id}`);
                    }
                });
                setProviders(Array.from(uniqueProvMap.entries()).map(([id, name]) => ({ id, name })));

                setBatches(batchRes.data || []);
            } catch (err) {
                console.error('Error cargando catálogos de filtros:', err);
            }
        };
        loadFilterOptions();
    }, []);

    // Cargar datos cuando cambie la pestaña o se ejecute la búsqueda
    useEffect(() => {
        fetchReportData();
    }, [activeTab]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            const endpoint = `/api/egg-industrial/reports/${activeTab === 'raw_materials' ? 'raw-materials' : activeTab}`;
            const params = {
                from: filters.from,
                to: filters.to,
                ...(filters.provider_id ? { provider_id: filters.provider_id } : {}),
                ...(filters.product_type ? { product_type: filters.product_type } : {}),
                ...(filters.batch_id ? { batch_id: filters.batch_id } : {})
            };

            const res = await axios.get(endpoint, { params });
            setReportData(res.data?.data || []);
        } catch (err) {
            console.error('Error al cargar datos del reporte:', err);
            toast.error('No se pudieron obtener los datos del reporte seleccionado.');
            setReportData([]);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (format) => {
        if (exporting[format]) return;
        setExporting(prev => ({ ...prev, [format]: true }));
        try {
            const endpoint = `/api/egg-industrial/reports/${activeTab === 'raw_materials' ? 'raw-materials' : activeTab}`;
            const params = {
                format,
                from: filters.from,
                to: filters.to,
                ...(filters.provider_id ? { provider_id: filters.provider_id } : {}),
                ...(filters.product_type ? { product_type: filters.product_type } : {}),
                ...(filters.batch_id ? { batch_id: filters.batch_id } : {})
            };

            const res = await axios.get(endpoint, {
                params,
                responseType: 'blob'
            });

            const blob = new Blob([res.data], {
                type: format === 'pdf'
                    ? 'application/pdf'
                    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `reporte_${activeTab}_${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success(`Reporte descargado con éxito en formato ${format.toUpperCase()}`);
        } catch (err) {
            console.error(`Error exportando a ${format}:`, err);
            toast.error(`Error al generar la descarga en ${format.toUpperCase()}`);
        } finally {
            setExporting(prev => ({ ...prev, [format]: false }));
        }
    };

    // Cálculos de métricas rápidas según la pestaña activa
    const totalRawLbs = activeTab === 'raw_materials'
        ? reportData.reduce((acc, row) => acc + (parseFloat(row.weight_lbs) || 0), 0)
        : 0;
    const totalRawBoxes = activeTab === 'raw_materials'
        ? reportData.reduce((acc, row) => acc + (parseInt(row.boxes_count) || 0), 0)
        : 0;

    const totalProdLbs = activeTab === 'production'
        ? reportData.reduce((acc, row) => acc + (parseFloat(row.actual_output_lbs) || 0), 0)
        : 0;
    const totalProdBroken = activeTab === 'production'
        ? reportData.reduce((acc, row) => acc + (parseFloat(row.egg_broken_lbs) || 0), 0)
        : 0;

    const totalPkgUnits = activeTab === 'packaging'
        ? reportData.reduce((acc, row) => acc + (parseInt(row.units_packaged) || 0), 0)
        : 0;
    const totalPkgLbs = activeTab === 'packaging'
        ? reportData.reduce((acc, row) => acc + (parseFloat(row.total_weight_lbs) || 0), 0)
        : 0;

    const totalWasteLbs = activeTab === 'wastes'
        ? reportData.reduce((acc, row) => acc + (parseFloat(row.weight_lbs) || 0), 0)
        : 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-300 pb-12">
            {/* Header del módulo de Reportes */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
                                Centro de Reportes - Huevo Industrial
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">
                                Análisis ejecutivo, rendimientos, trazabilidad de procesos y control de mermas
                            </p>
                        </div>
                    </div>
                </div>

                {/* Acciones de exportación */}
                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        type="button"
                        onClick={() => handleExport('pdf')}
                        disabled={exporting.pdf || reportData.length === 0}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                        <FileText size={15} />
                        {exporting.pdf ? 'Generando...' : 'Exportar PDF'}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleExport('excel')}
                        disabled={exporting.excel || reportData.length === 0}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                        <FileSpreadsheet size={15} />
                        {exporting.excel ? 'Generando...' : 'Exportar Excel'}
                    </button>
                    <button
                        type="button"
                        onClick={fetchReportData}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                        title="Refrescar datos"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Pestañas de Reportes */}
            <div className="flex gap-2 overflow-x-auto pb-1 border-b border-slate-200 text-xs font-bold uppercase tracking-wider">
                <button
                    onClick={() => setActiveTab('production')}
                    className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'production'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                    }`}
                >
                    <Layers size={16} />
                    1. Producción y Quebraje
                </button>
                <button
                    onClick={() => setActiveTab('raw_materials')}
                    className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'raw_materials'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                    }`}
                >
                    <Building2 size={16} />
                    2. Materia Prima (MP)
                </button>
                <button
                    onClick={() => setActiveTab('packaging')}
                    className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'packaging'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                    }`}
                >
                    <PackageCheck size={16} />
                    3. Empaque por Producción
                </button>
                <button
                    onClick={() => setActiveTab('quality')}
                    className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'quality'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                    }`}
                >
                    <FlaskConical size={16} />
                    4. Calidad y Conglomerados
                </button>
                <button
                    onClick={() => setActiveTab('wastes')}
                    className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'wastes'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                    }`}
                >
                    <AlertOctagon size={16} />
                    5. Mermas de Producción
                </button>
            </div>

            {/* Barra de Filtros */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <Filter size={14} className="text-indigo-600" />
                    Parámetros de Filtrado
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 text-xs">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                            Fecha Inicio
                        </label>
                        <input
                            type="date"
                            value={filters.from}
                            onChange={(e) => setFilters(prev => ({ ...prev, from: e.target.value }))}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                            Fecha Fin
                        </label>
                        <input
                            type="date"
                            value={filters.to}
                            onChange={(e) => setFilters(prev => ({ ...prev, to: e.target.value }))}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                    </div>

                    {(activeTab === 'raw_materials' || activeTab === 'quality') && (
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                                Proveedor
                            </label>
                            <select
                                value={filters.provider_id}
                                onChange={(e) => setFilters(prev => ({ ...prev, provider_id: e.target.value }))}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            >
                                <option value="">Todos los Proveedores</option>
                                {providers.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {(activeTab === 'production' || activeTab === 'packaging' || activeTab === 'raw_materials') && (
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                                Tipo de Producto
                            </label>
                            <select
                                value={filters.product_type}
                                onChange={(e) => setFilters(prev => ({ ...prev, product_type: e.target.value }))}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            >
                                <option value="">Todos los Productos</option>
                                <option value="huevo entero">Huevo Entero</option>
                                <option value="clara">Clara de Huevo</option>
                                <option value="yema">Yema Líquida</option>
                                <option value="yema azucarada">Yema Azucarada</option>
                                <option value="yema salada">Yema Salada</option>
                                <option value="fórmula especial">Fórmula Especial</option>
                            </select>
                        </div>
                    )}

                    {(activeTab === 'packaging' || activeTab === 'wastes') && (
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                                Lote de Producción
                            </label>
                            <select
                                value={filters.batch_id}
                                onChange={(e) => setFilters(prev => ({ ...prev, batch_id: e.target.value }))}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            >
                                <option value="">Todos los Lotes</option>
                                {batches.map(b => (
                                    <option key={b.id} value={b.id}>
                                        {b.batch_code_display || b.batch_uuid} - {b.product_type}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex items-end">
                        <button
                            type="button"
                            onClick={fetchReportData}
                            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                        >
                            <Search size={14} />
                            Consultar
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI Cards Dinámicos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Registros Encontrados
                    </span>
                    <span className="text-xl font-black text-slate-900">
                        {reportData.length}
                    </span>
                </div>

                {activeTab === 'production' && (
                    <>
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Total Libras Producidas
                            </span>
                            <span className="text-xl font-black text-emerald-600">
                                {totalProdLbs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lbs
                            </span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Huevo Quebrado (MP)
                            </span>
                            <span className="text-xl font-black text-indigo-600">
                                {totalProdBroken.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lbs
                            </span>
                        </div>
                    </>
                )}

                {activeTab === 'raw_materials' && (
                    <>
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Total Cajas Recibidas
                            </span>
                            <span className="text-xl font-black text-indigo-600">
                                {totalRawBoxes.toLocaleString()} Cjs
                            </span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Peso Total Recibido
                            </span>
                            <span className="text-xl font-black text-emerald-600">
                                {totalRawLbs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lbs
                            </span>
                        </div>
                    </>
                )}

                {activeTab === 'packaging' && (
                    <>
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Unidades Envasadas
                            </span>
                            <span className="text-xl font-black text-indigo-600">
                                {totalPkgUnits.toLocaleString()} Envases
                            </span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Peso Total Envasado
                            </span>
                            <span className="text-xl font-black text-emerald-600">
                                {totalPkgLbs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lbs
                            </span>
                        </div>
                    </>
                )}

                {activeTab === 'wastes' && (
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Total Mermas Registradas
                        </span>
                        <span className="text-xl font-black text-rose-600">
                            {totalWasteLbs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lbs
                        </span>
                    </div>
                )}
            </div>

            {/* Contenedor de la Tabla según Pestaña */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                {loading ? (
                    <div className="py-16 text-center text-slate-400 font-medium text-xs flex flex-col items-center gap-3">
                        <RefreshCw size={24} className="animate-spin text-indigo-600" />
                        Cargando reporte...
                    </div>
                ) : reportData.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 font-medium text-xs flex flex-col items-center gap-2">
                        <FileText size={32} className="text-slate-300" />
                        No se encontraron registros en el rango de fechas seleccionado.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        {/* TABLA 1: PRODUCCIÓN */}
                        {activeTab === 'production' && (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                        <th className="p-3">Lote</th>
                                        <th className="p-3">Fecha</th>
                                        <th className="p-3">Producto</th>
                                        <th className="p-3 text-right">Quebraje (Lbs)</th>
                                        <th className="p-3 text-right">Rendimiento (Lbs)</th>
                                        <th className="p-3 text-right">Rend. %</th>
                                        <th className="p-3 text-center">Estado Envasado</th>
                                        <th className="p-3 text-right">Efic. Envasado %</th>
                                        <th className="p-3 text-center">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {reportData.map((row) => (
                                        <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-3 font-black text-indigo-700">
                                                {row.batch_code_display || row.batch_uuid}
                                            </td>
                                            <td className="p-3 text-slate-600">
                                                {row.created_at ? new Date(row.created_at).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="p-3 font-bold text-slate-800 capitalize">
                                                {row.product_type}
                                            </td>
                                            <td className="p-3 text-right font-medium text-slate-700">
                                                {parseFloat(row.egg_broken_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                            </td>
                                            <td className="p-3 text-right font-bold text-emerald-700">
                                                {parseFloat(row.actual_output_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                            </td>
                                            <td className="p-3 text-right font-bold text-slate-800">
                                                {parseFloat(row.yield_pct || 0).toFixed(1)}%
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                                    row.packaging_status === 'cerrado'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {row.packaging_status || 'en_proceso'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right font-bold text-slate-900">
                                                {row.packaging_efficiency_pct ? `${parseFloat(row.packaging_efficiency_pct).toFixed(1)}%` : '-'}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold uppercase">
                                                    {row.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {/* TABLA 2: MATERIA PRIMA */}
                        {activeTab === 'raw_materials' && (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                        <th className="p-3">Lote Proveedor</th>
                                        <th className="p-3">Fecha Ingreso</th>
                                        <th className="p-3">Proveedor</th>
                                        <th className="p-3">Presentación</th>
                                        <th className="p-3 text-right">Cajas</th>
                                        <th className="p-3 text-right">Peso (Lbs)</th>
                                        <th className="p-3 text-right">Stock Disponible (Lbs)</th>
                                        <th className="p-3 text-center">Calidad / Grado</th>
                                        <th className="p-3 text-center">Dictamen</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {reportData.map((row) => (
                                        <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-3 font-black text-indigo-700">
                                                {row.provider_lot || `REC-${row.id}`}
                                            </td>
                                            <td className="p-3 text-slate-600">
                                                {row.entry_date ? new Date(row.entry_date).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="p-3 font-bold text-slate-800">
                                                {row.provider_name || 'N/A'}
                                            </td>
                                            <td className="p-3 capitalize text-slate-700">
                                                {row.egg_type}
                                            </td>
                                            <td className="p-3 text-right font-medium text-slate-700">
                                                {parseInt(row.boxes_count || 0).toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right font-bold text-slate-900">
                                                {parseFloat(row.weight_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                            </td>
                                            <td className="p-3 text-right font-bold text-emerald-700">
                                                {parseFloat(row.stock_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                            </td>
                                            <td className="p-3 text-center font-semibold">
                                                {row.quality_grade || '-'}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                                    row.status === 'aprobado'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : (row.status === 'rechazado' || row.status === 'no_conforme')
                                                            ? 'bg-rose-600 text-white font-black'
                                                            : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {/* TABLA 3: EMPAQUE POR PRODUCCIÓN */}
                        {activeTab === 'packaging' && (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                        <th className="p-3">Lote Comercial</th>
                                        <th className="p-3">Lote Producción</th>
                                        <th className="p-3">Fecha</th>
                                        <th className="p-3">Producto</th>
                                        <th className="p-3">Presentación</th>
                                        <th className="p-3 text-right">Unidades</th>
                                        <th className="p-3 text-right">Peso Unit. (Lbs)</th>
                                        <th className="p-3 text-right">Peso Total (Lbs)</th>
                                        <th className="p-3 text-center">Zona Bodega</th>
                                        <th className="p-3">Operador</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {reportData.map((row) => (
                                        <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-3 font-black text-indigo-700">
                                                {row.commercial_lot_display || row.barcode || `EMPQ-${row.id}`}
                                            </td>
                                            <td className="p-3 font-bold text-slate-700">
                                                {row.batch_code_display || row.batch_uuid || '-'}
                                            </td>
                                            <td className="p-3 text-slate-600">
                                                {row.packaging_date ? new Date(row.packaging_date).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="p-3 font-bold text-slate-800 capitalize">
                                                {row.product_type}
                                            </td>
                                            <td className="p-3 text-slate-700">
                                                {row.presentation}
                                            </td>
                                            <td className="p-3 text-right font-black text-slate-900">
                                                {parseInt(row.units_packaged || 0).toLocaleString()}
                                            </td>
                                            <td className="p-3 text-right font-medium text-slate-700">
                                                {parseFloat(row.weight_per_unit_lbs || 0).toFixed(2)}
                                            </td>
                                            <td className="p-3 text-right font-bold text-emerald-700">
                                                {parseFloat(row.total_weight_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-bold">
                                                    {row.warehouse_zone}
                                                </span>
                                            </td>
                                            <td className="p-3 text-slate-600">
                                                {row.operator_name || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {/* TABLA 4: CALIDAD */}
                        {activeTab === 'quality' && (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                        <th className="p-3">Lote MP</th>
                                        <th className="p-3">Proveedor</th>
                                        <th className="p-3 text-center">Grado</th>
                                        <th className="p-3 text-center">Talla</th>
                                        <th className="p-3 text-center">Dictamen</th>
                                        <th className="p-3 text-right">% Roto</th>
                                        <th className="p-3 text-right">% Sucio</th>
                                        <th className="p-3 text-right">°Brix</th>
                                        <th className="p-3">Inspector</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {reportData.map((row) => (
                                        <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-3 font-black text-indigo-700">
                                                {row.provider_lot || `REC-${row.id}`}
                                            </td>
                                            <td className="p-3 font-bold text-slate-800">
                                                {row.provider_name || 'N/A'}
                                            </td>
                                            <td className="p-3 text-center font-bold">
                                                {row.quality_grade || '-'}
                                            </td>
                                            <td className="p-3 text-center text-slate-600">
                                                {row.quality_size || '-'}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                                    row.status === 'aprobado'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : (row.status === 'rechazado' || row.status === 'no_conforme')
                                                            ? 'bg-rose-600 text-white font-black'
                                                            : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {row.quality_decision || row.status}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right font-medium text-slate-700">
                                                {row.pct_broken !== null ? `${parseFloat(row.pct_broken).toFixed(1)}%` : '-'}
                                            </td>
                                            <td className="p-3 text-right font-medium text-slate-700">
                                                {row.pct_dirty !== null ? `${parseFloat(row.pct_dirty).toFixed(1)}%` : '-'}
                                            </td>
                                            <td className="p-3 text-right font-bold text-indigo-700">
                                                {row.solids_brix !== null ? `${parseFloat(row.solids_brix).toFixed(1)}°` : '-'}
                                            </td>
                                            <td className="p-3 text-slate-600">
                                                {row.quality_inspector || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {/* TABLA 5: MERMAS DE PRODUCCIÓN */}
                        {activeTab === 'wastes' && (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                        <th className="p-3">Lote Producción</th>
                                        <th className="p-3">Fecha Registro</th>
                                        <th className="p-3">Etapa de Proceso</th>
                                        <th className="p-3">Tipo de Merma</th>
                                        <th className="p-3 text-right">Peso (Lbs)</th>
                                        <th className="p-3">Registrado Por</th>
                                        <th className="p-3">Observaciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {reportData.map((row) => (
                                        <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-3 font-black text-indigo-700">
                                                {row.batch_code_display || row.batch_uuid || '-'}
                                            </td>
                                            <td className="p-3 text-slate-600">
                                                {row.created_at ? new Date(row.created_at).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="p-3 font-bold text-slate-800 capitalize">
                                                {row.stage}
                                            </td>
                                            <td className="p-3 font-bold text-rose-700 capitalize">
                                                {row.waste_type?.replace('_', ' ')}
                                            </td>
                                            <td className="p-3 text-right font-black text-slate-900">
                                                {parseFloat(row.weight_lbs || 0).toFixed(1)} Lbs
                                            </td>
                                            <td className="p-3 text-slate-600">
                                                {row.operator_name || '-'}
                                            </td>
                                            <td className="p-3 text-slate-500 italic text-[11px]">
                                                {row.notes || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EggReports;
