import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
    Calculator, DollarSign, TrendingUp, Users, Settings2, 
    History, AlertTriangle, CheckCircle, Flame, Droplets, 
    Package, RefreshCcw, Save, Trash2, Plus, Sparkles, 
    FileText, ArrowUpRight, BarChart3, ChevronRight, Eye
} from 'lucide-react';
import Money, { MoneyInput } from '../../components/ui/Money';

export default function EggCosteoPorLibra() {
    const [activeTab, setActiveTab] = useState('calculator'); // calculator, simulator, clients, catalog, history
    const [loading, setLoading] = useState(false);

    // --- ESTADO CALCULADORA DINÁMICA ---
    const [calcParams, setCalcParams] = useState({
        product_type: 'Huevo Entero Pasteurizado',
        presentation: 'cubeta 30LB',
        raw_egg_box_cost: 38.00,
        raw_egg_lbs_per_box: 43.50,
        batch_size_lbs: 12000.00,
        water_added_pct: 0.0,
        sugar_added_pct: 0.0,
        salt_added_pct: 0.0,
        custom_gif_monthly: 24537.00,
        custom_monthly_volume_lbs: 100000.00,
        target_sale_price_per_lb: 1.25
    });

    const [calculationResult, setCalculationResult] = useState(null);

    // --- ESTADO ACUERDOS CLIENTES ---
    const [agreements, setAgreements] = useState([]);
    const [agreementModal, setAgreementModal] = useState({ open: false, data: null });

    // --- ESTADO CATÁLOGOS ---
    const [configs, setConfigs] = useState([]);
    const [cipItems, setCipItems] = useState([]);
    const [packagingItems, setPackagingItems] = useState([]);
    const [cipModal, setCipModal] = useState({ open: false, data: null });
    const [packModal, setPackModal] = useState({ open: false, data: null });

    // --- ESTADO HISTÓRICO & ESCENARIOS ---
    const [scenarios, setScenarios] = useState([]);
    const [costHistory, setCostHistory] = useState([]);
    const [scenarioNameInput, setScenarioNameInput] = useState('');
    const [saveScenarioModal, setSaveScenarioModal] = useState(false);

    // Cargar datos iniciales
    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const [confRes, cipRes, packRes, agrRes, scenRes, histRes] = await Promise.all([
                axios.get('/api/egg-industrial/costeo-libra/config'),
                axios.get('/api/egg-industrial/costeo-libra/cip-items'),
                axios.get('/api/egg-industrial/costeo-libra/packaging-items'),
                axios.get('/api/egg-industrial/costeo-libra/customer-agreements'),
                axios.get('/api/egg-industrial/costeo-libra/scenarios'),
                axios.get('/api/egg-industrial/costeo-libra/history')
            ]);
            setConfigs(confRes.data);
            setCipItems(cipRes.data);
            setPackagingItems(packRes.data);
            setAgreements(agrRes.data);
            setScenarios(scenRes.data);
            setCostHistory(histRes.data);

            // Ejecutar primer cálculo
            runCalculation(calcParams);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar datos del módulo de costeo.');
        } finally {
            setLoading(false);
        }
    };

    const runCalculation = async (paramsToUse = calcParams) => {
        try {
            const res = await axios.post('/api/egg-industrial/costeo-libra/calculate', paramsToUse);
            setCalculationResult(res.data);
        } catch (error) {
            console.error(error);
            toast.error('Error al calcular el costo por libra.');
        }
    };

    // Manejar cambio de parámetros de cálculo
    const handleParamChange = (field, value) => {
        const updated = { ...calcParams, [field]: value };
        
        // Ajustes contextuales automáticos según el producto
        if (field === 'product_type') {
            if (value.toLowerCase().includes('plus')) {
                updated.water_added_pct = 8.0;
                updated.sugar_added_pct = 0.0;
                updated.salt_added_pct = 0.0;
            } else if (value.toLowerCase().includes('azucarada')) {
                updated.sugar_added_pct = 4.0;
                updated.water_added_pct = 0.0;
                updated.salt_added_pct = 0.0;
            } else if (value.toLowerCase().includes('salada')) {
                updated.salt_added_pct = 10.0;
                updated.water_added_pct = 0.0;
                updated.sugar_added_pct = 0.0;
            } else {
                updated.water_added_pct = 0.0;
                updated.sugar_added_pct = 0.0;
                updated.salt_added_pct = 0.0;
            }
        }

        setCalcParams(updated);
        runCalculation(updated);
    };

    // Guardar Escenario
    const handleSaveScenario = async () => {
        if (!scenarioNameInput.trim()) {
            return toast.error('Ingresa un nombre descriptivo para el escenario.');
        }
        try {
            await axios.post('/api/egg-industrial/costeo-libra/scenarios', {
                scenario_name: scenarioNameInput.trim(),
                product_type: calcParams.product_type,
                presentation: calcParams.presentation,
                base_raw_egg_cost_per_box: calcParams.raw_egg_box_cost,
                batch_size_lbs: calcParams.batch_size_lbs,
                yield_liquid_pct: calculationResult?.parameters_used?.liquid_yield_pct || 83,
                calculated_cost_per_lb: calculationResult?.breakdown?.total_cost_per_lb || 0,
                target_sale_price_per_lb: calcParams.target_sale_price_per_lb || 0,
                margin_pct: calculationResult?.target_simulation?.margin_pct || 0,
                full_breakdown_json: calculationResult?.breakdown || {}
            });
            toast.success('Escenario de costeo guardado exitosamente.');
            setSaveScenarioModal(false);
            setScenarioNameInput('');
            const scenRes = await axios.get('/api/egg-industrial/costeo-libra/scenarios');
            setScenarios(scenRes.data);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al guardar escenario.');
        }
    };

    // Guardar Acuerdo Cliente
    const handleSaveAgreement = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/egg-industrial/costeo-libra/customer-agreements', agreementModal.data);
            toast.success('Acuerdo comercial guardado con éxito.');
            setAgreementModal({ open: false, data: null });
            const agrRes = await axios.get('/api/egg-industrial/costeo-libra/customer-agreements');
            setAgreements(agrRes.data);
            runCalculation();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al guardar acuerdo.');
        }
    };

    // Eliminar Acuerdo
    const handleDeleteAgreement = async (id) => {
        if (!window.confirm('¿Deseas eliminar este acuerdo comercial?')) return;
        try {
            await axios.delete(`/api/egg-industrial/costeo-libra/customer-agreements/${id}`);
            toast.success('Acuerdo eliminado.');
            const agrRes = await axios.get('/api/egg-industrial/costeo-libra/customer-agreements');
            setAgreements(agrRes.data);
            runCalculation();
        } catch (error) {
            toast.error('Error al eliminar acuerdo.');
        }
    };

    // Guardar Configuración Global
    const handleSaveGlobalConfig = async (key, val) => {
        try {
            await axios.put('/api/egg-industrial/costeo-libra/config', {
                settings: [{ setting_key: key, setting_value: parseFloat(val) || 0 }]
            });
            toast.success('Parámetro actualizado.');
            const confRes = await axios.get('/api/egg-industrial/costeo-libra/config');
            setConfigs(confRes.data);
            runCalculation();
        } catch (error) {
            toast.error('Error al actualizar parámetro.');
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 rounded-2xl border border-indigo-500/20 shadow-xl text-white">
                <div>
                    <div className="flex items-center gap-2 text-indigo-400 text-xs font-black uppercase tracking-wider mb-1">
                        <Sparkles className="w-4 h-4" />
                        <span>Planta Industrial ANDELSA • Ovoproductos</span>
                    </div>
                    <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
                        <Calculator className="w-7 h-7 text-indigo-400" />
                        <span>Costeo por Libra & Simulador Comercial</span>
                    </h1>
                    <p className="text-xs text-slate-300 mt-1">
                        Modelo oficial de absorción industrial: MP, Insumos, Empaque, CIP, Caldera/Energía, MOD y GIF prorrateado.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => runCalculation()}
                        className="px-3.5 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center gap-2 transition"
                    >
                        <RefreshCcw className="w-3.5 h-3.5" />
                        <span>Recalcular</span>
                    </button>
                    <button
                        onClick={() => setSaveScenarioModal(true)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition"
                    >
                        <Save className="w-3.5 h-3.5" />
                        <span>Guardar Escenario</span>
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                {[
                    { id: 'calculator', label: 'Calculadora Dinámica', icon: Calculator },
                    { id: 'simulator', label: 'Simulador & Rentabilidad', icon: TrendingUp },
                    { id: 'clients', label: 'Acuerdos Clientes & Semáforo', icon: Users, badge: agreements.length },
                    { id: 'catalog', label: 'Catálogo Insumos / CIP', icon: Settings2 },
                    { id: 'history', label: 'Histórico & Mix', icon: History, badge: scenarios.length }
                ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                                isActive
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            <span>{tab.label}</span>
                            {tab.badge !== undefined && (
                                <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-black ${
                                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* TAB 1: CALCULADORA DINÁMICA */}
            {activeTab === 'calculator' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Panel de Parámetros */}
                    <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <Settings2 className="w-4 h-4 text-indigo-500" />
                                <span>Parámetros del Lote a Costear</span>
                            </h2>
                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">
                                Batch {calcParams.batch_size_lbs.toLocaleString()} Lbs
                            </span>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                    Tipo de Producto
                                </label>
                                <select
                                    value={calcParams.product_type}
                                    onChange={(e) => handleParamChange('product_type', e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="Huevo Entero Pasteurizado">Huevo Entero Pasteurizado (83% rend.)</option>
                                    <option value="Huevo Entero Plus">Huevo Entero Plus (Con agua 8% y cítrico)</option>
                                    <option value="Clara de Huevo Pasteurizada">Clara Pasteurizada (53.95% rend.)</option>
                                    <option value="Yema Azucarada">Yema Azucarada (4% azúcar)</option>
                                    <option value="Yema Salada">Yema Salada (10% sal)</option>
                                    <option value="Huevo con Leche">Huevo con Leche (BK / Cocina Vuelos)</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                        Presentación
                                    </label>
                                    <select
                                        value={calcParams.presentation}
                                        onChange={(e) => handleParamChange('presentation', e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="cubeta 30LB">Cubeta 30 Lbs (Estándar)</option>
                                        <option value="cubeta 32LB">Cubeta 32 Lbs</option>
                                        <option value="galon 8LB">Galón 8 Lbs</option>
                                        <option value="medio galon 4LB">Medio Galón 4 Lbs</option>
                                        <option value="litro 2LB">Litro 2 Lbs</option>
                                        <option value="medio litro 1LB">Medio Litro 1 Lb</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                        Costo Caja Huevo Cáscara
                                    </label>
                                    <MoneyInput
                                        value={calcParams.raw_egg_box_cost}
                                        onChange={(val) => handleParamChange('raw_egg_box_cost', val)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                        Lbs por Caja (Aprox 360 un)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={calcParams.raw_egg_lbs_per_box}
                                        onChange={(e) => handleParamChange('raw_egg_lbs_per_box', parseFloat(e.target.value) || 43.5)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                        Tamaño del Batch (Lbs)
                                    </label>
                                    <input
                                        type="number"
                                        step="500"
                                        value={calcParams.batch_size_lbs}
                                        onChange={(e) => handleParamChange('batch_size_lbs', parseFloat(e.target.value) || 12000)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
                                    />
                                </div>
                            </div>

                            {/* Aditivos condicionales */}
                            {calcParams.product_type.toLowerCase().includes('plus') && (
                                <div className="p-3 bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800 rounded-xl space-y-2">
                                    <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400 font-black text-[11px]">
                                        <Droplets className="w-4 h-4" />
                                        <span>Parámetros de Dilución HE Plus</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-slate-600 dark:text-slate-300 font-semibold">% Agua Añadida:</span>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={calcParams.water_added_pct}
                                            onChange={(e) => handleParamChange('water_added_pct', parseFloat(e.target.value) || 0)}
                                            className="w-20 bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 rounded-lg px-2 py-1 text-right font-bold"
                                        />
                                    </div>
                                    <p className="text-[10px] text-cyan-600 dark:text-cyan-400 leading-relaxed">
                                        Estándar ANDELSA: 8% agua purificada manteniendo sólidos $\ge 21.5\%$.
                                    </p>
                                </div>
                            )}

                            {calcParams.product_type.toLowerCase().includes('azucarada') && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-amber-800 dark:text-amber-300 font-black">% Azúcar Industrial:</span>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={calcParams.sugar_added_pct}
                                            onChange={(e) => handleParamChange('sugar_added_pct', parseFloat(e.target.value) || 4)}
                                            className="w-20 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg px-2 py-1 text-right font-bold"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* GIF & Prorrateo */}
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-black uppercase text-slate-500">Prorrateo GIF Mensual</span>
                                    <span className="text-[10px] text-indigo-500 font-bold">Base 100k Lbs</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 block mb-0.5">GIF Total ($/mes)</label>
                                        <MoneyInput
                                            value={calcParams.custom_gif_monthly}
                                            onChange={(val) => handleParamChange('custom_gif_monthly', val)}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Volumen Proyectado (Lbs)</label>
                                        <input
                                            type="number"
                                            step="5000"
                                            value={calcParams.custom_monthly_volume_lbs}
                                            onChange={(e) => handleParamChange('custom_monthly_volume_lbs', parseFloat(e.target.value) || 100000)}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Panel de Resultados y Desglose Visual */}
                    <div className="lg:col-span-7 space-y-4">
                        {/* Tarjeta Principal de Costo por Libra */}
                        <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-indigo-500/30 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                                <Calculator className="w-48 h-48" />
                            </div>
                            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-indigo-300">
                                        Costo Unitario Calculado
                                    </span>
                                    <div className="text-4xl sm:text-5xl font-black tracking-tight mt-1 flex items-baseline gap-2">
                                        <Money value={calculationResult?.breakdown?.total_cost_per_lb || 0} />
                                        <span className="text-lg font-bold text-indigo-300">/ Libra</span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-indigo-200">
                                        <span className="bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-400/30">
                                            Presentación ({calcParams.presentation}): <strong className="text-white"><Money value={calculationResult?.breakdown?.cost_per_unit || 0} /></strong>
                                        </span>
                                        <span className="bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-400/30">
                                            Rendimiento Líquido: <strong className="text-white">{calculationResult?.parameters_used?.liquid_yield_pct?.toFixed(1)}%</strong>
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right sm:border-l sm:border-indigo-700/50 sm:pl-6 space-y-1">
                                    <div className="text-[10px] uppercase font-bold text-indigo-300">Batch Completo ({calcParams.batch_size_lbs.toLocaleString()} Lbs)</div>
                                    <div className="text-xl font-black text-white">
                                        <Money value={(calculationResult?.breakdown?.total_cost_per_lb || 0) * calcParams.batch_size_lbs} />
                                    </div>
                                    <div className="text-[11px] text-indigo-300">
                                        Equivalente a {(calcParams.batch_size_lbs / (calculationResult?.presentation_lbs || 30)).toFixed(0)} unidades
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Desglose de Componentes de Costo */}
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-4 flex items-center justify-between">
                                <span>Estructura de Absorción por Libra</span>
                                <span className="text-[11px] text-slate-400 font-normal">Suma de factores unitarios</span>
                            </h3>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {[
                                    {
                                        label: 'Materia Prima (Huevo Líquido)',
                                        value: calculationResult?.breakdown?.mp_cost_per_lb || 0,
                                        icon: Package,
                                        color: 'text-amber-500',
                                        bg: 'bg-amber-50 dark:bg-amber-950/40',
                                        desc: 'Huevo cáscara descontando 17% cáscara'
                                    },
                                    {
                                        label: 'Empaque & Etiquetas',
                                        value: calculationResult?.breakdown?.packaging_cost_per_lb || 0,
                                        icon: Package,
                                        color: 'text-blue-500',
                                        bg: 'bg-blue-50 dark:bg-blue-950/40',
                                        desc: 'Cubeta, tapa, liner, etiqueta 4x2'
                                    },
                                    {
                                        label: 'Químicos Sanitización CIP',
                                        value: calculationResult?.breakdown?.cip_cost_per_lb || 0,
                                        icon: Droplets,
                                        color: 'text-teal-500',
                                        bg: 'bg-teal-50 dark:bg-teal-950/40',
                                        desc: '$50.85 estándar / batch'
                                    },
                                    {
                                        label: 'Caldera, Vapor & Energía',
                                        value: calculationResult?.breakdown?.boiler_energy_cost_per_lb || 0,
                                        icon: Flame,
                                        color: 'text-orange-500',
                                        bg: 'bg-orange-50 dark:bg-orange-950/40',
                                        desc: 'Diesel 20.84 gal + Energía + Agua'
                                    },
                                    {
                                        label: 'Mano de Obra Directa (MOD)',
                                        value: calculationResult?.breakdown?.mod_cost_per_lb || 0,
                                        icon: Users,
                                        color: 'text-purple-500',
                                        bg: 'bg-purple-50 dark:bg-purple-950/40',
                                        desc: '$0.0500 fijo por libra producida'
                                    },
                                    {
                                        label: 'Gastos Indirectos (GIF)',
                                        value: calculationResult?.breakdown?.gif_cost_per_lb || 0,
                                        icon: BarChart3,
                                        color: 'text-indigo-500',
                                        bg: 'bg-indigo-50 dark:bg-indigo-950/40',
                                        desc: 'Prorrateo $24,537 mensual'
                                    }
                                ].map((item, idx) => {
                                    const Icon = item.icon;
                                    const total = calculationResult?.breakdown?.total_cost_per_lb || 1;
                                    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
                                    return (
                                        <div key={idx} className={`p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 ${item.bg}`}>
                                            <div className="flex items-center justify-between mb-1">
                                                <Icon className={`w-4 h-4 ${item.color}`} />
                                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-white/70 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300">
                                                    {pct}%
                                                </span>
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight line-clamp-1">
                                                {item.label}
                                            </div>
                                            <div className="text-base font-black text-slate-800 dark:text-slate-100 mt-0.5">
                                                <Money value={item.value} />
                                                <span className="text-[10px] text-slate-400 font-normal"> /lb</span>
                                            </div>
                                            <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate mt-1">
                                                {item.desc}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: SIMULADOR COMERCIAL & MATRIZ DE RENTABILIDAD */}
            {activeTab === 'simulator' && (
                <div className="space-y-6">
                    {/* Simulador Rápido con Precio Libre */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                                    <span>Simulador Comercial de Margen Libre</span>
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Calcula el margen bruto y comisión sobre ventas para cualquier precio ofertado a un cliente.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Precio Objetivo a Simular:</label>
                                <div className="w-36">
                                    <MoneyInput
                                        value={calcParams.target_sale_price_per_lb}
                                        onChange={(val) => handleParamChange('target_sale_price_per_lb', val)}
                                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-black text-slate-800 dark:text-slate-100"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Cards de Métricas del Simulador */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Costo Unitario Base</span>
                                <div className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1">
                                    <Money value={calculationResult?.breakdown?.total_cost_per_lb || 0} />
                                    <span className="text-xs font-medium text-slate-400"> /lb</span>
                                </div>
                                <span className="text-[10px] text-slate-500">Costo total por libra</span>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Margen Bruto ($/lb)</span>
                                <div className={`text-xl font-black mt-1 ${
                                    (calculationResult?.target_simulation?.margin_per_lb || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                }`}>
                                    <Money value={calculationResult?.target_simulation?.margin_per_lb || 0} />
                                    <span className="text-xs font-medium text-slate-400"> /lb</span>
                                </div>
                                <span className="text-[10px] text-slate-500">Ganancia neta por libra</span>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Margen Porcentual (%)</span>
                                <div className="text-xl font-black mt-1 flex items-center gap-2">
                                    <span className={
                                        (calculationResult?.target_simulation?.margin_pct || 0) >= 20 ? 'text-emerald-600' :
                                        (calculationResult?.target_simulation?.margin_pct || 0) >= 10 ? 'text-amber-600' : 'text-rose-600'
                                    }>
                                        {(calculationResult?.target_simulation?.margin_pct || 0).toFixed(1)}%
                                    </span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-black uppercase ${
                                        (calculationResult?.target_simulation?.margin_pct || 0) >= 20 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                        (calculationResult?.target_simulation?.margin_pct || 0) >= 10 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    }`}>
                                        {(calculationResult?.target_simulation?.margin_pct || 0) >= 20 ? 'Excelente' :
                                         (calculationResult?.target_simulation?.margin_pct || 0) >= 10 ? 'Aceptable' : 'Riesgo / Bajo'}
                                    </span>
                                </div>
                                <span className="text-[10px] text-slate-500">Margen sobre precio venta</span>
                            </div>

                            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                                <span className="text-[10px] font-bold text-indigo-500 uppercase">Bono Comercial Estimado</span>
                                <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-1">
                                    {(calculationResult?.target_simulation?.margin_pct || 0) >= 20 ? '1.5%' :
                                     (calculationResult?.target_simulation?.margin_pct || 0) >= 15 ? '1.0%' :
                                     (calculationResult?.target_simulation?.margin_pct || 0) >= 10 ? '0.5%' : '0.0%'}
                                </div>
                                <span className="text-[10px] text-indigo-500/80">Escala de incentivo comercial</span>
                            </div>
                        </div>
                    </div>

                    {/* Comparativa con Todos los Acuerdos Activos */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-indigo-500" />
                            <span>Rentabilidad Proyectada por Cliente frente al Costo Actual</span>
                        </h3>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400">
                                        <th className="py-2.5 px-3">Cliente</th>
                                        <th className="py-2.5 px-3">Producto / Presentación</th>
                                        <th className="py-2.5 px-3 text-right">Precio Pactado</th>
                                        <th className="py-2.5 px-3 text-right">Costo + Flete</th>
                                        <th className="py-2.5 px-3 text-right">Margen $/lb</th>
                                        <th className="py-2.5 px-3 text-center">Margen %</th>
                                        <th className="py-2.5 px-3 text-right">Volumen Mensual</th>
                                        <th className="py-2.5 px-3 text-right">Utilidad Bruta</th>
                                        <th className="py-2.5 px-3 text-center">Semáforo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-200">
                                    {calculationResult?.clients_comparison?.map((client) => (
                                        <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                                            <td className="py-3 px-3 font-bold">{client.customer_name}</td>
                                            <td className="py-3 px-3 text-slate-500">{client.product_type} ({client.presentation})</td>
                                            <td className="py-3 px-3 text-right font-black"><Money value={client.agreed_price} /></td>
                                            <td className="py-3 px-3 text-right text-slate-500"><Money value={client.effective_cost} /></td>
                                            <td className={`py-3 px-3 text-right font-bold ${client.margin_per_lb >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                <Money value={client.margin_per_lb} />
                                            </td>
                                            <td className="py-3 px-3 text-center font-black">
                                                <span className={client.margin_pct >= 20 ? 'text-emerald-600' : client.margin_pct >= 10 ? 'text-amber-600' : 'text-rose-600'}>
                                                    {client.margin_pct.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="py-3 px-3 text-right">{client.monthly_volume_lbs.toLocaleString()} Lbs</td>
                                            <td className="py-3 px-3 text-right font-black text-indigo-600 dark:text-indigo-400">
                                                <Money value={client.monthly_profit} />
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <span className={`inline-block w-3 h-3 rounded-full ${
                                                    client.status === 'green' ? 'bg-emerald-500 shadow-sm shadow-emerald-500' :
                                                    client.status === 'yellow' ? 'bg-amber-500 shadow-sm shadow-amber-500' : 'bg-rose-500 shadow-sm shadow-rose-500'
                                                }`} title={`Margen: ${client.margin_pct.toFixed(1)}%`} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: ACUERDOS CLIENTES & SEMÁFORO DE MARGEN */}
            {activeTab === 'clients' && (
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div>
                            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Users className="w-4 h-4 text-indigo-500" />
                                <span>Acuerdos de Precios & Contratos Comerciales</span>
                            </h2>
                            <p className="text-xs text-slate-500">
                                Matriz de clientes oficiales (PriceSmart, Panadería Lorena, Gate Gourmet, Denny's, etc.) con semáforo de margen contractual.
                            </p>
                        </div>
                        <button
                            onClick={() => setAgreementModal({
                                open: true,
                                data: {
                                    customer_name: '',
                                    product_type: 'Huevo Entero Pasteurizado',
                                    presentation: 'cubeta 30LB',
                                    agreed_price_per_lb: 1.20,
                                    monthly_volume_lbs: 10000,
                                    target_margin_pct: 20.0,
                                    freight_cost_per_lb: 0.00,
                                    payment_terms_days: 30,
                                    notes: ''
                                }
                            })}
                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Nuevo Contrato / Acuerdo</span>
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400">
                                    <th className="py-2.5 px-3">Cliente</th>
                                    <th className="py-2.5 px-3">Producto & Presentación</th>
                                    <th className="py-2.5 px-3 text-right">Precio Pactado</th>
                                    <th className="py-2.5 px-3 text-right">Volumen Mensual</th>
                                    <th className="py-2.5 px-3 text-center">Margen Objetivo</th>
                                    <th className="py-2.5 px-3 text-right">Flete ($/lb)</th>
                                    <th className="py-2.5 px-3">Condiciones</th>
                                    <th className="py-2.5 px-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-200">
                                {agreements.map((agr) => (
                                    <tr key={agr.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                                        <td className="py-3 px-3">
                                            <div className="font-black text-slate-800 dark:text-slate-100">{agr.customer_name}</div>
                                            {agr.notes && <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{agr.notes}</div>}
                                        </td>
                                        <td className="py-3 px-3">
                                            <div>{agr.product_type}</div>
                                            <span className="text-[10px] text-indigo-500 font-semibold">{agr.presentation}</span>
                                        </td>
                                        <td className="py-3 px-3 text-right font-black text-slate-900 dark:text-white">
                                            <Money value={agr.agreed_price_per_lb} />
                                            <span className="text-[10px] text-slate-400"> /lb</span>
                                        </td>
                                        <td className="py-3 px-3 text-right font-semibold">
                                            {parseFloat(agr.monthly_volume_lbs).toLocaleString()} Lbs
                                        </td>
                                        <td className="py-3 px-3 text-center font-black text-emerald-600">
                                            {parseFloat(agr.target_margin_pct).toFixed(1)}%
                                        </td>
                                        <td className="py-3 px-3 text-right text-slate-500">
                                            <Money value={agr.freight_cost_per_lb || 0} />
                                        </td>
                                        <td className="py-3 px-3 text-slate-500">
                                            Crédito {agr.payment_terms_days || 30} días
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => setAgreementModal({ open: true, data: agr })}
                                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition"
                                                >
                                                    <Settings2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteAgreement(agr.id)}
                                                    className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 rounded-lg transition"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 4: CATÁLOGO DE INSUMOS & PARÁMETROS ENERGÉTICOS */}
            {activeTab === 'catalog' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Parámetros Globales & Caldera */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Flame className="w-4 h-4 text-orange-500" />
                            <span>Parámetros de Caldera, Vapor & GIF</span>
                        </h3>

                        <div className="space-y-3">
                            {configs.map((c) => (
                                <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                    <div>
                                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{c.setting_label}</div>
                                        <div className="text-[10px] text-slate-400">Clave: {c.setting_key}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            step="0.01"
                                            defaultValue={c.setting_value}
                                            onBlur={(e) => handleSaveGlobalConfig(c.setting_key, e.target.value)}
                                            className="w-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-black text-right text-slate-800 dark:text-slate-100"
                                        />
                                        <span className="text-[10px] font-bold text-slate-400 w-12">{c.unit_label}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Químicos CIP & Empaques */}
                    <div className="space-y-6">
                        {/* Químicos CIP */}
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Droplets className="w-4 h-4 text-teal-500" />
                                <span>Químicos CIP & Sanitización ($50.85/batch)</span>
                            </h3>
                            <div className="space-y-2">
                                {cipItems.map((cip) => (
                                    <div key={cip.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                                        <div>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{cip.item_name}</span>
                                            <div className="text-[10px] text-slate-400">
                                                Dosis: {cip.dose_per_batch} {cip.dose_unit} • Presentación: {cip.presentation_qty} {cip.presentation_unit}
                                            </div>
                                        </div>
                                        <div className="font-black text-slate-900 dark:text-white">
                                            <Money value={cip.presentation_cost} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Empaques */}
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Package className="w-4 h-4 text-blue-500" />
                                <span>Catálogo de Materiales & Empaque</span>
                            </h3>
                            <div className="space-y-2">
                                {packagingItems.map((p) => (
                                    <div key={p.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                                        <div>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{p.item_name}</span>
                                            <div className="text-[10px] text-slate-400">Código: {p.item_code} ({p.category})</div>
                                        </div>
                                        <div className="font-black text-slate-900 dark:text-white">
                                            <Money value={p.unit_cost} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 5: HISTÓRICO & ESCENARIOS GUARDADOS */}
            {activeTab === 'history' && (
                <div className="space-y-6">
                    {/* Escenarios Guardados */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                        <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Save className="w-4 h-4 text-emerald-500" />
                            <span>Escenarios y Cotizaciones Guardadas</span>
                        </h2>

                        {scenarios.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-4 text-center">No hay escenarios guardados todavía.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {scenarios.map((scen) => (
                                    <div key={scen.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="font-black text-slate-800 dark:text-slate-100 text-xs">{scen.scenario_name}</span>
                                            <span className="text-[10px] text-slate-400">{new Date(scen.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <div className="text-[11px] text-slate-500">{scen.product_type} ({scen.presentation})</div>
                                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
                                            <div>
                                                <span className="text-[10px] text-slate-400 block">Costo / Lb</span>
                                                <strong className="font-black text-slate-800 dark:text-slate-200"><Money value={scen.calculated_cost_per_lb} /></strong>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-400 block">Precio Oferta</span>
                                                <strong className="font-black text-emerald-600"><Money value={scen.target_sale_price_per_lb} /></strong>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-400 block">Margen</span>
                                                <strong className="font-black text-indigo-600">{parseFloat(scen.margin_pct).toFixed(1)}%</strong>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Histórico Mensual de Costos de Producción */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <History className="w-4 h-4 text-indigo-500" />
                            <span>Evolución Mensual de Producción Real & Costo por Libra</span>
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400">
                                        <th className="py-2.5 px-3">Período</th>
                                        <th className="py-2.5 px-3">Producto</th>
                                        <th className="py-2.5 px-3 text-center">Lotes</th>
                                        <th className="py-2.5 px-3 text-right">Lbs Entrada</th>
                                        <th className="py-2.5 px-3 text-right">Lbs Producidas</th>
                                        <th className="py-2.5 px-3 text-right">Costo Total Real</th>
                                        <th className="py-2.5 px-3 text-right">Costo Promedio / Lb</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-200">
                                    {costHistory.map((h, i) => (
                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                                            <td className="py-2.5 px-3 font-bold">{h.period}</td>
                                            <td className="py-2.5 px-3">{h.product_type}</td>
                                            <td className="py-2.5 px-3 text-center">{h.batches_count}</td>
                                            <td className="py-2.5 px-3 text-right">{parseFloat(h.total_input_lbs || 0).toLocaleString()} Lbs</td>
                                            <td className="py-2.5 px-3 text-right font-semibold">{parseFloat(h.total_yield_lbs || 0).toLocaleString()} Lbs</td>
                                            <td className="py-2.5 px-3 text-right font-black"><Money value={h.total_cost || 0} /></td>
                                            <td className="py-2.5 px-3 text-right font-black text-indigo-600 dark:text-indigo-400">
                                                <Money value={h.avg_cost_per_lb || 0} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL GUARDAR ESCENARIO */}
            {saveScenarioModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
                        <h3 className="text-sm font-black uppercase text-slate-800 dark:text-slate-100">
                            Guardar Escenario de Costeo
                        </h3>
                        <p className="text-xs text-slate-500">
                            Guarda esta simulación con sus parámetros actuales ({calcParams.product_type} - {calcParams.presentation}) para consultarla o compararla luego.
                        </p>
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Nombre del Escenario</label>
                            <input
                                type="text"
                                placeholder="Ej: Cotización Q4 PriceSmart Huevo Entero $38"
                                value={scenarioNameInput}
                                onChange={(e) => setScenarioNameInput(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => setSaveScenarioModal(false)}
                                className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveScenario}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ACUERDO CLIENTE */}
            {agreementModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <form onSubmit={handleSaveAgreement} className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 text-xs">
                        <h3 className="text-sm font-black uppercase text-slate-800 dark:text-slate-100">
                            {agreementModal.data?.id ? 'Editar Acuerdo Comercial' : 'Nuevo Contrato / Acuerdo de Precio'}
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Nombre del Cliente</label>
                                <input
                                    type="text"
                                    required
                                    value={agreementModal.data?.customer_name || ''}
                                    onChange={(e) => setAgreementModal({ ...agreementModal, data: { ...agreementModal.data, customer_name: e.target.value } })}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Producto</label>
                                    <input
                                        type="text"
                                        required
                                        value={agreementModal.data?.product_type || ''}
                                        onChange={(e) => setAgreementModal({ ...agreementModal, data: { ...agreementModal.data, product_type: e.target.value } })}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Presentación</label>
                                    <input
                                        type="text"
                                        required
                                        value={agreementModal.data?.presentation || 'cubeta 30LB'}
                                        onChange={(e) => setAgreementModal({ ...agreementModal, data: { ...agreementModal.data, presentation: e.target.value } })}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Precio Pactado ($/lb)</label>
                                    <MoneyInput
                                        value={agreementModal.data?.agreed_price_per_lb || 0}
                                        onChange={(val) => setAgreementModal({ ...agreementModal, data: { ...agreementModal.data, agreed_price_per_lb: val } })}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Volumen Mes (Lbs)</label>
                                    <input
                                        type="number"
                                        value={agreementModal.data?.monthly_volume_lbs || 0}
                                        onChange={(e) => setAgreementModal({ ...agreementModal, data: { ...agreementModal.data, monthly_volume_lbs: parseFloat(e.target.value) || 0 } })}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Margen Obj (%)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={agreementModal.data?.target_margin_pct || 20}
                                        onChange={(e) => setAgreementModal({ ...agreementModal, data: { ...agreementModal.data, target_margin_pct: parseFloat(e.target.value) || 20 } })}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Notas / Condiciones Especiales</label>
                                <textarea
                                    rows="2"
                                    value={agreementModal.data?.notes || ''}
                                    onChange={(e) => setAgreementModal({ ...agreementModal, data: { ...agreementModal.data, notes: e.target.value } })}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setAgreementModal({ open: false, data: null })}
                                className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md"
                            >
                                Guardar Acuerdo
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
