import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import {
    Activity,
    Plus,
    DollarSign,
    Wrench,
    TrendingUp,
    TrendingDown,
    Calculator,
    BarChart3,
    Clock,
    ShieldAlert,
    CheckCircle,
    User,
    Calendar,
    Settings,
    FileText,
    Info,
    XCircle,
    Trash2
} from 'lucide-react';

const EggCostsMaintenance = () => {
    const { user } = useAuth();
    const companyId = user?.company_id || 1;

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'N/A';
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    // Lists
    const [costs, setCosts] = useState([]);
    const [batches, setBatches] = useState([]);
    const [maintenanceLogs, setMaintenanceLogs] = useState([]);
    const [forecast, setForecast] = useState(null);
    const [loading, setLoading] = useState(true);

    // Tab state
    const [activeTab, setActiveTab] = useState('costs'); // 'costs', 'maintenance', 'forecasting'

    // Form states
    const [costForm, setCostForm] = useState({
        batch_id: '',
        diesel_cost: '150.00',
        electricity_cost: '280.00',
        water_cost: '35.00',
        labor_cost: '180.00',
        packaging_materials_cost: '520.00',
        chemicals_cip_cost: '25.00',
        quality_tests_cost: '60.00'
    });

    const [maintenanceForm, setMaintenanceForm] = useState({
        equipment_name: 'pasteurizador',
        maintenance_type: 'preventivo',
        description: '',
        spare_parts_used: '',
        usage_hours_count: '',
        technician_name: '',
        cost: '0.00'
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [profitMarginPercent, setProfitMarginPercent] = useState(35);
    const [dateStart, setDateStart] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
    const [dateEnd, setDateEnd] = useState(new Date().toISOString().split('T')[0]);
    const [costConcepts, setCostConcepts] = useState([]);
    const [variableCostsModal, setVariableCostsModal] = useState(null);
    const [variableCosts, setVariableCosts] = useState([]);
    const [newVarCost, setNewVarCost] = useState({ concept_name: '', amount: '' });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [cRes, bRes, mRes, fRes, ccRes] = await Promise.all([
                axios.get('/api/egg-industrial/costs'),
                axios.get('/api/egg-industrial/batches'),
                axios.get('/api/egg-industrial/maintenance'),
                axios.get('/api/egg-industrial/forecast'),
                axios.get('/api/egg-industrial/cost-concepts')
            ]);
            setCosts(cRes.data);
            setBatches(bRes.data);
            setMaintenanceLogs(mRes.data);
            setCostConcepts(ccRes.data);
            setForecast(fRes.data);
        } catch (error) {
            console.error('Error fetching cost and maintenance data:', error);
            toast.error('Error al cargar analíticas e historial industrial.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [companyId]);

    // Handle create cost record
    const handleCreateCost = async (e) => {
        e.preventDefault();

        if (!costForm.batch_id) {
            return toast.error('Debe seleccionar un lote de producción.');
        }

        setIsSubmitting(true);
        try {
            await axios.post('/api/egg-industrial/costs', {
                batch_id: parseInt(costForm.batch_id),
                diesel_cost: parseFloat(costForm.diesel_cost),
                electricity_cost: parseFloat(costForm.electricity_cost),
                water_cost: parseFloat(costForm.water_cost),
                labor_cost: parseFloat(costForm.labor_cost),
                packaging_materials_cost: parseFloat(costForm.packaging_materials_cost),
                chemicals_cip_cost: parseFloat(costForm.chemicals_cip_cost),
                quality_tests_cost: parseFloat(costForm.quality_tests_cost)
            });
            toast.success('Costos operativos industriales cargados al lote.');
            setCostForm({
                batch_id: '',
                diesel_cost: '150.00',
                electricity_cost: '280.00',
                water_cost: '35.00',
                labor_cost: '180.00',
                packaging_materials_cost: '520.00',
                chemicals_cip_cost: '25.00',
                quality_tests_cost: '60.00'
            });
            fetchData();
            setActiveTab('costs');
        } catch (error) {
            console.error('Error saving industrial cost:', error);
            toast.error('Error al cargar costos.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openVariableCosts = async (batch) => {
        setVariableCostsModal(batch);
        try {
            const res = await axios.get(`/api/egg-industrial/batches/${batch.id}/variable-costs`);
            setVariableCosts(res.data);
        } catch (e) { setVariableCosts([]); }
        setNewVarCost({ concept_name: '', amount: '' });
    };

    const addVariableCost = async () => {
        if (!newVarCost.concept_name.trim() || !newVarCost.amount) return toast.error('Complete nombre y monto.');
        try {
            await axios.post(`/api/egg-industrial/batches/${variableCostsModal.id}/variable-costs`, {
                concept_name: newVarCost.concept_name,
                amount: parseFloat(newVarCost.amount)
            });
            toast.success('Costo variable agregado.');
            setNewVarCost({ concept_name: '', amount: '' });
            openVariableCosts(variableCostsModal);
        } catch (e) { toast.error('Error al agregar.'); }
    };

    const deleteVariableCost = async (id) => {
        try {
            await axios.delete(`/api/egg-industrial/variable-costs/${id}`);
            openVariableCosts(variableCostsModal);
        } catch (e) { toast.error('Error al eliminar.'); }
    };

    const getTotalFixedCost = () => costConcepts.reduce((s, c) => s + parseFloat(c.default_value || 0), 0);
    const getTotalVariableCost = () => variableCosts.reduce((s, c) => s + parseFloat(c.amount || 0), 0);

    // Handle create maintenance log
    const handleCreateMaintenance = async (e) => {
        e.preventDefault();

        if (!maintenanceForm.description.trim()) {
            return toast.error('La descripción técnica es obligatoria.');
        }
        if (!maintenanceForm.usage_hours_count || parseInt(maintenanceForm.usage_hours_count) <= 0) {
            return toast.error('Debe ingresar las horas de uso acumuladas.');
        }
        if (!maintenanceForm.technician_name.trim()) {
            return toast.error('Ingrese el nombre del técnico responsable.');
        }

        setIsSubmitting(true);
        try {
            await axios.post('/api/egg-industrial/maintenance', {
                ...maintenanceForm,
                usage_hours_count: parseInt(maintenanceForm.usage_hours_count),
                cost: parseFloat(maintenanceForm.cost)
            });
            toast.success('Mantenimiento técnico de maquinaria registrado.');
            setMaintenanceForm({
                equipment_name: 'pasteurizador',
                maintenance_type: 'preventivo',
                description: '',
                spare_parts_used: '',
                usage_hours_count: '',
                technician_name: '',
                cost: '0.00'
            });
            fetchData();
            setActiveTab('maintenance');
        } catch (error) {
            console.error('Error registering maintenance:', error);
            toast.error('Error al guardar bitácora de mantenimiento.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Cost calculations helpers
    const calculateTotalCost = (c) => {
        return parseFloat(c.diesel_cost) + parseFloat(c.electricity_cost) + parseFloat(c.water_cost) +
            parseFloat(c.labor_cost) + parseFloat(c.packaging_materials_cost) +
            parseFloat(c.chemicals_cip_cost) + parseFloat(c.quality_tests_cost);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-teal-500/10 rounded-2xl border border-teal-500/20 text-teal-400">
                        <Calculator className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white uppercase tracking-wider">Costeo Industrial y Mantenimiento Técnico</h1>
                        <p className="text-[12px] text-slate-400 font-semibold tracking-tight">Centros de costo por lote, costeo unitario por libra pasteurizada, bitácora técnica de máquinas y previsión predictiva de demanda</p>
                    </div>
                </div>
            </div>

            {/* Custom Tab Selectors */}
            <div className="flex flex-wrap gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-900 w-fit">
                <button
                    onClick={() => setActiveTab('costs')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'costs' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    Centros de Costo por Lote
                </button>
                <button
                    onClick={() => setActiveTab('maintenance')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        activeTab === 'maintenance' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <Wrench size={14} />
                    Mantenimiento de Máquinas
                </button>
                <button
                    onClick={() => setActiveTab('forecasting')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        activeTab === 'forecasting' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <BarChart3 size={14} />
                    Previsión de Demanda (Forecasting)
                </button>
            </div>

            {/* TAB CONTENTS */}
            {activeTab === 'costs' && (
                <div className="space-y-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-teal-400" />
                                Centro de Costos por Lote
                            </h2>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <Calendar size={14} className="text-slate-500" />
                                    <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] text-white font-semibold focus:outline-none" />
                                    <span className="text-slate-500 text-xs">a</span>
                                    <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] text-white font-semibold focus:outline-none" />
                                </div>
                            </div>
                        </div>
                        <div className="h-px bg-slate-800" />

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-1 mb-2">
                            <div className="bg-slate-950 border border-slate-850 rounded-lg p-1.5 text-center">
                                <span className="text-[7px] font-black text-slate-500 uppercase block truncate">Costo Fijo Total</span>
                                <span className="text-[10px] font-black text-amber-400">${getTotalFixedCost().toLocaleString()}</span>
                            </div>
                            {(() => {
                                const filtered = batches.filter(b => b.completed_at && b.completed_at >= dateStart && b.completed_at <= dateEnd + 'T23:59:59');
                                const totalYield = filtered.reduce((s, b) => s + parseFloat(b.yield_liquid_lbs || 0), 0);
                                const totalVar = filtered.reduce((s, b) => s + (b.variable_costs || []).reduce((ss, c) => ss + parseFloat(c.amount || 0), 0), 0);
                                const totalAll = getTotalFixedCost() * filtered.length + totalVar;
                                return (
                                    <>
                                        <div className="bg-slate-950 border border-slate-850 rounded-lg p-1.5 text-center">
                                            <span className="text-[7px] font-black text-slate-500 uppercase block truncate">Lotes</span>
                                            <span className="text-[10px] font-black text-white">{filtered.length}</span>
                                        </div>
                                        <div className="bg-slate-950 border border-slate-850 rounded-lg p-1.5 text-center">
                                            <span className="text-[7px] font-black text-slate-500 uppercase block truncate">Rendimiento</span>
                                            <span className="text-[10px] font-black text-teal-400">{totalYield.toLocaleString()} Lbs</span>
                                        </div>
                                        <div className="bg-slate-950 border border-slate-850 rounded-lg p-1.5 text-center">
                                            <span className="text-[7px] font-black text-slate-500 uppercase block truncate">Costo Total</span>
                                            <span className="text-[10px] font-black text-amber-400">${totalAll.toLocaleString()}</span>
                                        </div>
                                        <div className="bg-slate-950 border border-slate-850 rounded-lg p-1.5 text-center">
                                            <span className="text-[7px] font-black text-slate-500 uppercase block truncate">Costo/Lb Prom.</span>
                                            <span className="text-[10px] font-black text-indigo-400">${totalYield > 0 ? (totalAll / totalYield).toFixed(4) : '0'}</span>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    {batches.filter(b => b.completed_at && b.completed_at >= dateStart && b.completed_at <= dateEnd + 'T23:59:59').length === 0 ? (
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-500 text-xs font-semibold">
                            No hay lotes finalizados en el rango de fechas seleccionado.
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-900/50 border-b border-slate-850 text-slate-400 font-extrabold uppercase tracking-tighter text-[9px]">
                                        <th className="px-3 py-2">Producto</th>
                                        <th className="px-3 py-2">Fecha Fin</th>
                                        <th className="px-3 py-2 text-right">Rend.</th>
                                        <th className="px-3 py-2 text-right">Cáscara</th>
                                        <th className="px-3 py-2 text-right">Merma</th>
                                        <th className="px-3 py-2 text-right">Costo Total</th>
                                        <th className="px-3 py-2 text-right">Costo/Lb</th>
                                        <th className="px-3 py-2 text-right">Precio/Lb Sug.</th>
                                        <th className="px-3 py-2 text-right">Total Vta.</th>
                                        <th className="px-3 py-2 text-center w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-850 font-medium text-slate-300">
                            {batches.filter(b => b.completed_at && b.completed_at >= dateStart && b.completed_at <= dateEnd + 'T23:59:59').sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)).map(b => {
                                const yieldLbs = parseFloat(b.yield_liquid_lbs || 0);
                                const inputLbs = parseFloat(b.input_weight_lbs || 1);
                                const wasteShell = parseFloat(b.waste_shell_lbs || 0);
                                const wasteLoss = parseFloat(b.waste_loss_lbs || 0);
                                const fixedTotal = getTotalFixedCost();
                                const varTotal = (b.variable_costs || []).reduce((s, c) => s + parseFloat(c.amount || 0), 0);
                                const totalCost = fixedTotal + varTotal;
                                const costPerLb = yieldLbs > 0 ? totalCost / yieldLbs : 0;
                                const shellCost = (wasteShell / inputLbs) * totalCost;
                                const lossCost = (wasteLoss / inputLbs) * totalCost;
                                return (
                                    <tr key={b.id} className="hover:bg-slate-900/40 transition-colors">
                                        <td className="px-3 py-2.5">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-white text-[11px] capitalize">{b.product_type}</span>
                                                <span className="text-[9px] text-slate-500">{b.presentation}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-[10px] text-slate-400">
                                            {formatDate(b.completed_at)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <span className="font-bold text-teal-400 text-[11px]">{yieldLbs.toLocaleString()}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] text-slate-400">{wasteShell.toLocaleString()} Lbs</span>
                                                <span className="text-[8px] text-rose-400">${shellCost.toFixed(2)}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] text-slate-400">{wasteLoss.toLocaleString()} Lbs</span>
                                                <span className="text-[8px] text-rose-400">${lossCost.toFixed(2)}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-bold text-amber-400 text-[11px]">${totalCost.toLocaleString()}</span>
                                                {varTotal > 0 && <span className="text-[8px] text-indigo-400">+${varTotal.toLocaleString()} var</span>}
                                                {(shellCost + lossCost) > 0 && <span className="text-[8px] text-rose-500">Desp: ${(shellCost + lossCost).toFixed(2)}</span>}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <span className="font-bold text-indigo-400 text-[11px]">${costPerLb.toFixed(4)}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <span className="font-bold text-teal-400 text-[11px]">${(costPerLb / (1 - (profitMarginPercent / 100))).toFixed(4)}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <span className="font-bold text-emerald-400 text-[11px]">${((costPerLb / (1 - (profitMarginPercent / 100))) * yieldLbs).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            <button
                                                onClick={() => openVariableCosts(b)}
                                                className="px-2 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[9px] font-extrabold flex items-center gap-1"
                                                title="Agregar costos variables"
                                            >
                                                <Plus size={11} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-indigo-400" />
                            Simulador de Precio de Venta
                        </h2>
                        <div className="h-px bg-slate-800" />
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                                <span>Margen de Utilidad Deseado:</span>
                                <span className="text-teal-400 font-black text-sm">{profitMarginPercent}%</span>
                            </div>
                            <input
                                type="range"
                                min="15"
                                max="75"
                                value={profitMarginPercent}
                                onChange={(e) => setProfitMarginPercent(parseInt(e.target.value))}
                                className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
                            />
                            {(() => {
                                const filtered = batches.filter(b => b.completed_at && b.completed_at >= dateStart && b.completed_at <= dateEnd + 'T23:59:59');
                                const totalYield = filtered.reduce((s, b) => s + parseFloat(b.yield_liquid_lbs || 0), 0);
                                const totalVar = filtered.reduce((s, b) => s + (b.variable_costs || []).reduce((ss, c) => ss + parseFloat(c.amount || 0), 0), 0);
                                const totalCostAll = getTotalFixedCost() * filtered.length + totalVar;
                                const avgCostPerLb = totalYield > 0 ? totalCostAll / totalYield : 0;
                                const suggestedPrice = avgCostPerLb / (1 - (profitMarginPercent / 100));
                                return (
                                    <div className="bg-slate-950 border border-slate-850 rounded-lg p-3 grid grid-cols-2 gap-2 text-center">
                                        <div>
                                            <span className="text-[8px] font-black text-slate-500 block">Costo Prom./Lb</span>
                                            <span className="text-xs font-bold text-white">${avgCostPerLb.toFixed(4)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[8px] font-black text-slate-500 block">Precio Venta Sug./Lb</span>
                                            <span className="text-xs font-black text-teal-400">${suggestedPrice.toFixed(4)}</span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'maintenance' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Add technical maintenance Log Form */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl h-fit space-y-6">
                        <div>
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Wrench className="h-4 w-4 text-teal-400" />
                                Registrar Mantenimiento
                            </h2>
                            <div className="h-px bg-slate-800" />
                        </div>

                        <form onSubmit={handleCreateMaintenance} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Equipo Industrial</label>
                                <select
                                    value={maintenanceForm.equipment_name}
                                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, equipment_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="pasteurizador">Pasteurizador de Placas APV</option>
                                    <option value="quebradora">Quebradora Centrífuga SANOVO</option>
                                    <option value="tanque holding">Tanques de Holding de Acero Inox</option>
                                    <option value="caldera">Caldera de Vapor Cleaver-Brooks</option>
                                    <option value="llenadora">Llenadora Automática de Envases</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tipo de Bitácora</label>
                                <select
                                    value={maintenanceForm.maintenance_type}
                                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, maintenance_type: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="preventivo">Preventivo Programado</option>
                                    <option value="correctivo">Correctivo por Falla/Paro</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Horas de Uso Acumuladas</label>
                                    <input
                                        type="number"
                                        value={maintenanceForm.usage_hours_count}
                                        onChange={(e) => setMaintenanceForm({ ...maintenanceForm, usage_hours_count: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none"
                                        placeholder="Ej: 480"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Costo Repuestos/Servicio ($)</label>
                                    <input
                                        type="number"
                                        value={maintenanceForm.cost}
                                        onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none"
                                        placeholder="0.00"
                                        step="0.01"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nombre del Técnico / Firma</label>
                                <input
                                    type="text"
                                    value={maintenanceForm.technician_name}
                                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, technician_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none"
                                    placeholder="Ej: Ing. Hugo Martínez"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Detalle del Trabajo Técnico</label>
                                <textarea
                                    value={maintenanceForm.description}
                                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none h-16"
                                    placeholder="Describa el cambio de juntas, sensores..."
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Repuestos Utilizados</label>
                                <input
                                    type="text"
                                    value={maintenanceForm.spare_parts_used}
                                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, spare_parts_used: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none"
                                    placeholder="Ej: Juntas de goma, sensor PT100"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-extrabold transition-all border border-teal-500 shadow-lg shadow-teal-600/15"
                            >
                                Guardar Mantenimiento
                            </button>
                        </form>
                    </div>

                    {/* Maintenance logs table */}
                    <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Activity className="h-4 w-4 text-indigo-400" />
                            Registro Técnico de Maquinaria Industrial
                        </h2>
                        <div className="h-px bg-slate-800" />

                        <div className="space-y-3 overflow-y-auto max-h-[520px] pr-1">
                            {maintenanceLogs.map(log => (
                                <div key={log.id} className="bg-slate-950 border border-slate-850 rounded-2xl p-4 flex flex-col md:flex-row justify-between gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-white capitalize">{log.equipment_name}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                log.maintenance_type === 'preventivo' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse'
                                            }`}>
                                                {log.maintenance_type}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 font-semibold">{log.description}</p>
                                        {log.spare_parts_used && (
                                            <div className="text-[10px] text-slate-500">
                                                Repuestos: <b className="text-indigo-400">{log.spare_parts_used}</b>
                                            </div>
                                        )}
                                        <div className="flex gap-4 text-[10px] text-slate-500 font-extrabold uppercase">
                                            <span className="flex items-center gap-0.5">
                                                <User size={11} />
                                                Técnico: {log.technician_name}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex md:flex-col justify-between items-end text-right">
                                        <span className="text-[10px] text-slate-500 font-semibold">{new Date(log.created_at).toLocaleDateString()}</span>
                                        <div className="flex gap-3 text-xs mt-2">
                                            <div className="text-center bg-slate-900 border border-slate-800 px-2 py-1 rounded-xl">
                                                <span className="text-[8px] font-black block text-slate-500 uppercase">Horas Uso</span>
                                                <span className="text-[11px] font-bold text-white">{log.usage_hours_count} hrs</span>
                                            </div>
                                            <div className="text-center bg-slate-900 border border-slate-800 px-2 py-1 rounded-xl">
                                                <span className="text-[8px] font-black block text-slate-500 uppercase">Costo</span>
                                                <span className="text-[11px] font-bold text-teal-400">${parseFloat(log.cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'forecasting' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Forecasting KPI Indicators */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl h-fit space-y-6">
                        <div>
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Settings className="h-4 w-4 text-indigo-400" />
                                KPIs de Previsión Predictiva
                            </h2>
                            <div className="h-px bg-slate-800" />
                        </div>

                        {forecast && (
                            <div className="space-y-4">
                                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 flex flex-col">
                                    <span className="text-[9px] font-black text-slate-500 uppercase block tracking-wider">Demanda Proyectada Próximo Mes</span>
                                    <span className="text-2xl font-black text-white mt-1">{forecast.forecast.toLocaleString()} Unidades</span>
                                    <span className="text-[9px] text-slate-400 font-semibold mt-1">Estimación en base a ventas del semestre</span>
                                </div>

                                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 flex flex-col">
                                    <span className="text-[9px] font-black text-slate-500 uppercase block tracking-wider">Materia Prima Requerida (Lbs)</span>
                                    <span className="text-xl font-black text-teal-400 mt-1">{forecast.recommended_purchase_raw_material_lbs.toLocaleString()} Lbs</span>
                                    <span className="text-[9px] text-slate-400 font-semibold mt-1">Con factor de rendimiento cáscara de 15%</span>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-center">
                                        <span className="text-[7.5px] font-black text-slate-500 block uppercase">Stock de Seguridad</span>
                                        <span className="font-extrabold text-white text-xs mt-1">{forecast.safety_stock.toLocaleString()} Uds</span>
                                    </div>
                                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-center">
                                        <span className="text-[7.5px] font-black text-slate-500 block uppercase">Nivel Confianza</span>
                                        <span className="font-extrabold text-teal-400 text-xs mt-1">{forecast.confidence_interval}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Historical Chart Represented with beautiful customized CSS */}
                    <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
                        <div>
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-indigo-400" />
                                Historial de Demanda vs. Predicción Próximo Mes
                            </h2>
                            <div className="h-px bg-slate-800" />
                        </div>

                        {forecast && (
                            <div className="space-y-6">
                                {/* HTML/CSS Chart bars */}
                                <div className="flex items-end justify-between gap-4 h-64 bg-slate-950/50 p-6 rounded-2xl border border-slate-850 relative">
                                    {/* Grid background lines */}
                                    <div className="absolute inset-0 flex flex-col justify-between p-6 pointer-events-none opacity-10">
                                        <div className="border-t border-slate-400 w-full" />
                                        <div className="border-t border-slate-400 w-full" />
                                        <div className="border-t border-slate-400 w-full" />
                                        <div className="border-t border-slate-400 w-full" />
                                    </div>

                                    {forecast.historical.map((val, idx) => {
                                        const maxVal = Math.max(...forecast.historical, forecast.forecast) * 1.15;
                                        const heightPercent = `${(val / maxVal) * 100}%`;

                                        return (
                                            <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end relative z-10">
                                                <div className="text-[9px] font-black text-slate-400">${val.toLocaleString()}</div>
                                                <div 
                                                    style={{ height: heightPercent }} 
                                                    className="w-full max-w-[28px] bg-slate-800 hover:bg-slate-700 transition-all rounded-t-lg border-t border-slate-700" 
                                                />
                                                <span className="text-[9px] text-slate-500 font-extrabold uppercase">Mes -{6 - idx}</span>
                                            </div>
                                        );
                                    })}

                                    {/* Predicted Bar */}
                                    <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end relative z-10">
                                        <div className="text-[9px] font-black text-indigo-400">${forecast.forecast.toLocaleString()}</div>
                                        <div 
                                            style={{ height: `${(forecast.forecast / (Math.max(...forecast.historical, forecast.forecast) * 1.15)) * 100}%` }} 
                                            className="w-full max-w-[28px] bg-indigo-600 hover:bg-indigo-500 transition-all rounded-t-lg border-t border-indigo-400 shadow-lg shadow-indigo-600/30 animate-pulse" 
                                        />
                                        <span className="text-[9px] text-indigo-400 font-extrabold uppercase">FORECAST</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2.5 p-3 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 text-indigo-400">
                                    <Info size={16} className="shrink-0" />
                                    <p className="text-[10px] font-bold leading-normal">
                                        <b>ANÁLISIS INDUSTRIAL:</b> El algoritmo predictivo proyecta un crecimiento sostenido de la demanda. Se aconseja programar un mantenimiento de válvula en el <b>pasteurizador</b> antes de iniciar la semana de producción para evitar cuellos de botella.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {variableCostsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full mx-4 space-y-4 max-h-[80vh] overflow-y-auto">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white uppercase">Costos Variables</h3>
                        <button onClick={() => setVariableCostsModal(null)} className="text-slate-500 hover:text-white">
                            <XCircle size={18} />
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400">
                        Lote: <b>{variableCostsModal.product_type}</b> ({variableCostsModal.presentation})
                    </p>
                    <div className="space-y-2">
                        <div className="text-[9px] font-black text-slate-500 uppercase">Costos Fijos</div>
                        {costConcepts.map(cc => (
                            <div key={cc.id} className="flex justify-between bg-slate-950 rounded-lg p-2 text-[10px]">
                                <span className="text-slate-400">{cc.concept_name}</span>
                                <span className="font-bold text-slate-300">${parseFloat(cc.default_value).toFixed(2)}</span>
                            </div>
                        ))}
                        <div className="text-[9px] font-black text-slate-500 uppercase pt-2">Costos Variables Agregados</div>
                        {variableCosts.map(vc => (
                            <div key={vc.id} className="flex justify-between items-center bg-slate-950 rounded-lg p-2 text-[10px]">
                                <span className="text-indigo-400">{vc.concept_name}</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-indigo-300">${parseFloat(vc.amount).toFixed(2)}</span>
                                    <button onClick={() => deleteVariableCost(vc.id)} className="text-rose-400 hover:text-rose-300">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        <div className="flex gap-2 pt-2">
                            <input type="text" value={newVarCost.concept_name} onChange={(e) => setNewVarCost({ ...newVarCost, concept_name: e.target.value })} placeholder="Concepto" className="flex-1 px-2 py-1.5 bg-slate-950 border border-slate-850 rounded-lg text-[10px] text-white font-semibold focus:outline-none" />
                            <input type="number" value={newVarCost.amount} onChange={(e) => setNewVarCost({ ...newVarCost, amount: e.target.value })} placeholder="$" className="w-24 px-2 py-1.5 bg-slate-950 border border-slate-850 rounded-lg text-[10px] text-white font-semibold text-right focus:outline-none" step="0.01" />
                            <button onClick={addVariableCost} className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-[10px] font-extrabold">
                                <Plus size={12} />
                            </button>
                        </div>
                    </div>
                    <button onClick={() => setVariableCostsModal(null)} className="w-full py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">Cerrar</button>
                </div>
                </div>
            )}
        </div>
    );
};

export default EggCostsMaintenance;
