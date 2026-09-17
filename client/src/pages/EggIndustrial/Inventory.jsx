import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Boxes,
    Search,
    RefreshCw,
    AlertTriangle,
    ArrowRight,
    Scale,
    PackageCheck,
    Layers,
    SlidersHorizontal,
    CheckCircle2,
    Info,
    ExternalLink
} from 'lucide-react';

const EggInventory = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [inventoryData, setInventoryData] = useState({
        totals: {
            total_items: 0,
            total_stock_units: 0,
            total_weight_lbs: 0,
            total_weight_kg: 0
        },
        items: [],
        unmapped_products: []
    });

    // Filtros locales
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedType, setSelectedType] = useState('todos');
    const [unitOfMeasure, setUnitOfMeasure] = useState('lbs'); // 'lbs' | 'kg' | 'units'

    const fetchInventory = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/egg-industrial/inventory-translated');
            setInventoryData(res.data || {
                totals: { total_items: 0, total_stock_units: 0, total_weight_lbs: 0, total_weight_kg: 0 },
                items: [],
                unmapped_products: []
            });
        } catch (err) {
            console.error('Error cargando inventario traducido:', err);
            toast.error('No se pudo cargar el inventario industrial.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInventory();
    }, []);

    // Filtrar elementos de la tabla
    const filteredItems = (inventoryData.items || []).filter(item => {
        const matchesSearch =
            (item.product_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.product_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.matched_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.presentation || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesType = selectedType === 'todos' || item.product_type === selectedType;

        return matchesSearch && matchesType;
    });

    // Obtener tipos únicos de producto presentes
    const productTypes = Array.from(new Set((inventoryData.items || []).map(i => i.product_type).filter(Boolean)));

    return (
        <div className="space-y-6 animate-in fade-in duration-300 pb-12">
            {/* Header del módulo de Inventario Traducido */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Boxes size={24} />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
                                Inventario Industrial Traducido
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">
                                Conversión de existencias por tipo de producto, presentación y peso (Lbs / Kg) para CRM y Gestión de Pedidos
                            </p>
                        </div>
                    </div>
                </div>

                {/* Acciones y selector de unidad */}
                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Toggle de Unidad de Medida */}
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setUnitOfMeasure('lbs')}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${
                                unitOfMeasure === 'lbs'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Libras (Lbs)
                        </button>
                        <button
                            type="button"
                            onClick={() => setUnitOfMeasure('kg')}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${
                                unitOfMeasure === 'kg'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Kilogramos (Kg)
                        </button>
                        <button
                            type="button"
                            onClick={() => setUnitOfMeasure('units')}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${
                                unitOfMeasure === 'units'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Unidades
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={fetchInventory}
                        className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                        title="Actualizar existencias"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* BANNER DE ALERTA: Productos sin mapear en catálogo de huevo */}
            {inventoryData.unmapped_products?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-xs space-y-3">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl mt-0.5">
                                <AlertTriangle size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-amber-900">
                                    Atención: {inventoryData.unmapped_products.length} productos de huevo sin vincular
                                </h3>
                                <p className="text-xs text-amber-700 font-medium mt-0.5">
                                    Se detectaron productos en el catálogo comercial que no tienen asignado un código de vinculación ni factor de peso. Su inventario no puede traducirse a libras/kilogramos para la planta.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => navigate('/industrial/configuracion')}
                            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap"
                        >
                            Vincular Códigos
                            <ExternalLink size={14} />
                        </button>
                    </div>

                    {/* Chips de productos pendientes */}
                    <div className="flex flex-wrap gap-2 pt-1 border-t border-amber-200/60">
                        {inventoryData.unmapped_products.slice(0, 8).map(up => (
                            <span key={up.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs text-amber-900 font-semibold shadow-2xs">
                                <span className="font-mono text-[10px] text-amber-600">{up.codigo || `ID:${up.id}`}</span>
                                <span>{up.nombre}</span>
                            </span>
                        ))}
                        {inventoryData.unmapped_products.length > 8 && (
                            <span className="text-xs text-amber-700 font-bold self-center">
                                +{inventoryData.unmapped_products.length - 8} más...
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* KPI CARDS RESUMEN */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Productos Mapeados</span>
                        <PackageCheck size={16} className="text-indigo-600" />
                    </div>
                    <span className="text-2xl font-black text-slate-900">
                        {inventoryData.totals?.total_items || 0}
                    </span>
                    <span className="text-[11px] text-slate-400 block font-medium mt-0.5">
                        Líneas activas en catálogo
                    </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Stock Total (Unidades)</span>
                        <Boxes size={16} className="text-blue-600" />
                    </div>
                    <span className="text-2xl font-black text-blue-700">
                        {parseInt(inventoryData.totals?.total_stock_units || 0).toLocaleString()}
                    </span>
                    <span className="text-[11px] text-slate-400 block font-medium mt-0.5">
                        Envases / presentaciones físicas
                    </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Existencia en Libras</span>
                        <Scale size={16} className="text-emerald-600" />
                    </div>
                    <span className="text-2xl font-black text-emerald-600">
                        {parseFloat(inventoryData.totals?.total_weight_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                    <span className="text-[11px] text-emerald-700 font-bold block mt-0.5">
                        Libras Netas (Lbs)
                    </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Existencia en Kilos</span>
                        <Scale size={16} className="text-violet-600" />
                    </div>
                    <span className="text-2xl font-black text-violet-700">
                        {parseFloat(inventoryData.totals?.total_weight_kg || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                    <span className="text-[11px] text-violet-700 font-bold block mt-0.5">
                        Kilogramos Netos (Kg)
                    </span>
                </div>
            </div>

            {/* Barra de Búsqueda y Filtros de Inventario */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por código, producto o presentación..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                        Filtrar Tipo:
                    </span>
                    <button
                        type="button"
                        onClick={() => setSelectedType('todos')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                            selectedType === 'todos'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        Todos ({inventoryData.items?.length || 0})
                    </button>
                    {productTypes.map(t => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setSelectedType(t)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors whitespace-nowrap ${
                                selectedType === t
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* TABLA PRINCIPAL DE INVENTARIO TRADUCIDO */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                {loading ? (
                    <div className="py-16 text-center text-slate-400 font-medium text-xs flex flex-col items-center gap-3">
                        <RefreshCw size={24} className="animate-spin text-indigo-600" />
                        Cargando inventario traducido...
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 font-medium text-xs flex flex-col items-center gap-2">
                        <Boxes size={32} className="text-slate-300" />
                        No se encontraron productos registrados en el inventario.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                    <th className="p-3">Código Catálogo</th>
                                    <th className="p-3">Códigos Industriales Vinculados</th>
                                    <th className="p-3">Producto Comercial</th>
                                    <th className="p-3">Tipo Ovoproducto</th>
                                    <th className="p-3">Presentación</th>
                                    <th className="p-3 text-right">Stock Físico</th>
                                    <th className="p-3 text-right">Peso Unit.</th>
                                    <th className="p-3 text-right">
                                        {unitOfMeasure === 'lbs' ? 'Existencia Total (Lbs)' : unitOfMeasure === 'kg' ? 'Existencia Total (Kg)' : 'Existencia (Unidades)'}
                                    </th>
                                    <th className="p-3 text-center">Estado Existencia</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredItems.map((item, idx) => {
                                    const stockNum = parseFloat(item.stock_units) || 0;
                                    const lbsTotal = parseFloat(item.total_lbs) || 0;
                                    const kgTotal = parseFloat(item.total_kg) || 0;

                                    return (
                                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-3 font-mono font-bold text-slate-700">
                                                {item.product_code || '-'}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {(item.matched_code || '').split(',').map((c, i) => {
                                                        const clean = c.trim();
                                                        if (!clean) return null;
                                                        return (
                                                            <span key={i} className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md font-mono text-[10px] font-bold">
                                                                {clean}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td className="p-3 font-black text-slate-900">
                                                {item.product_name}
                                            </td>
                                            <td className="p-3 font-bold text-slate-700 capitalize">
                                                {item.product_type}
                                            </td>
                                            <td className="p-3 text-slate-600 font-medium">
                                                {item.presentation}
                                            </td>
                                            <td className="p-3 text-right font-black text-slate-900">
                                                {stockNum.toLocaleString()} u.
                                            </td>
                                            <td className="p-3 text-right text-slate-500 font-medium">
                                                {parseFloat(item.weight_per_unit_lbs || 0).toFixed(1)} Lbs ({parseFloat(item.weight_per_unit_kg || 0).toFixed(2)} Kg)
                                            </td>
                                            <td className="p-3 text-right font-black text-emerald-700 text-sm">
                                                {unitOfMeasure === 'lbs' && (
                                                    <span>{lbsTotal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lbs</span>
                                                )}
                                                {unitOfMeasure === 'kg' && (
                                                    <span>{kgTotal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Kg</span>
                                                )}
                                                {unitOfMeasure === 'units' && (
                                                    <span>{stockNum.toLocaleString()} Envases</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                {stockNum > 50 ? (
                                                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold">
                                                        Normal
                                                    </span>
                                                ) : stockNum > 0 ? (
                                                    <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-bold">
                                                        Stock Bajo
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg text-[10px] font-bold">
                                                        Agotado
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EggInventory;
