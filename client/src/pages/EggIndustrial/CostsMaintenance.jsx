import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import Money, { MoneyInput } from '../../components/ui/Money';
import {
    Activity,
    Plus,
    DollarSign,
    Wrench,
    Calculator,
    BarChart3,
    User,
    Calendar,
    Settings,
    XCircle,
    Trash2,
    Package,
    RotateCcw,
    CheckCircle2,
    ArrowUpRight,
    ArrowDownRight,
    RefreshCw
} from 'lucide-react';

const EggCostsMaintenance = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const companyId = user?.company_id || 1;

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'N/A';
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    // Lists
    const [, setCosts] = useState([]);
    const [batches, setBatches] = useState([]);
    const [maintenanceLogs, setMaintenanceLogs] = useState([]);
    const [forecast, setForecast] = useState(null);
    const [, setLoading] = useState(true);

    // Returnables state (Control de cubetas y tapaderas)
    const [returnables, setReturnables] = useState([]);
    const [loadingReturnables, setLoadingReturnables] = useState(false);
    const [movementModal, setMovementModal] = useState(null);
    const [movementForm, setMovementForm] = useState({
        movement_type: 'entrega',
        quantity: '',
        reference_document: '',
        notes: ''
    });
    const [newCustomerModal, setNewCustomerModal] = useState(false);
    const [newCustomerForm, setNewCustomerForm] = useState({
        customer_name: '',
        packaging_type: 'cubeta_30lb',
        initial_balance: 0,
        notes: ''
    });

    // Tab state
    const [activeTab, setActiveTab] = useState('costs'); // 'costs', 'returnables', 'maintenance', 'forecasting'

    // Form states
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
            toast.error('Error al cargar datos de costos y mantenimiento.');
        } finally {
            setLoading(false);
        }
    };

    const fetchReturnables = async () => {
        setLoadingReturnables(true);
        try {
            const res = await axios.get('/api/egg-industrial/returnables/balances');
            setReturnables(res.data || []);
        } catch (error) {
            console.error('Error fetching returnables:', error);
            toast.error('Error al cargar balances de envases retornables.');
        } finally {
            setLoadingReturnables(false);
        }
    };

    useEffect(() => {
        fetchData();
        fetchReturnables();
    }, [companyId]);

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
        } catch (e) { toast.error('Error al agregar costo.'); }
    };

    const deleteVariableCost = async (id) => {
        try {
            await axios.delete(`/api/egg-industrial/variable-costs/${id}`);
            openVariableCosts(variableCostsModal);
        } catch (e) { toast.error('Error al eliminar costo.'); }
    };

    const getTotalFixedCost = () => costConcepts.reduce((s, c) => s + parseFloat(c.default_value || 0), 0);

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

    // Handle returnable movement submit
    const handleMovementSubmit = async (e) => {
        e.preventDefault();
        const qty = parseInt(movementForm.quantity);
        if (!qty || qty <= 0) return toast.error('Ingrese una cantidad válida mayor a 0.');

        try {
            await axios.post('/api/egg-industrial/returnables/movements', {
                returnable_id: movementModal.id,
                movement_type: movementForm.movement_type,
                quantity: qty,
                reference_document: movementForm.reference_document,
                notes: movementForm.notes,
                registered_by: user?.name || user?.username || 'Encargado Logística'
            });
            toast.success(`Movimiento de ${movementForm.movement_type} registrado correctamente.`);
            setMovementModal(null);
            setMovementForm({ movement_type: 'entrega', quantity: '', reference_document: '', notes: '' });
            fetchReturnables();
        } catch (error) {
            console.error('Error saving returnable movement:', error);
            toast.error(error.response?.data?.message || 'Error al registrar movimiento.');
        }
    };

    // Handle new customer for returnables
    const handleNewCustomerSubmit = async (e) => {
        e.preventDefault();
        if (!newCustomerForm.customer_name.trim()) return toast.error('Ingrese el nombre del cliente.');

        try {
            await axios.post('/api/egg-industrial/returnables/customers', {
                ...newCustomerForm,
                initial_balance: parseInt(newCustomerForm.initial_balance) || 0
            });
            toast.success('Cliente registrado para control de cubetas.');
            setNewCustomerModal(false);
            setNewCustomerForm({ customer_name: '', packaging_type: 'cubeta_30lb', initial_balance: 0, notes: '' });
            fetchReturnables();
        } catch (error) {
            console.error('Error creating customer returnable:', error);
            toast.error(error.response?.data?.message || 'Error al guardar cliente.');
        }
    };

    return (
        <div className="space-y-6 text-slate-900">
            {/* Header Banner - Acceso al Costeo por Libra */}
            <div className="bg-gradient-to-r from-emerald-50 via-white to-indigo-50 border border-emerald-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200 shrink-0">
                        <Calculator className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                                Oficial ANDELSA
                            </span>
                            <span className="text-xs font-bold text-slate-900">Módulo de Costeo por Libra de Ovoproductos</span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Simulador financiero: Costeo de Huevo Entero, Plus, Clara, Yema, Químicos CIP y Acuerdos Comerciales por Cliente.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/industrial/costeo-libra')}
                    className="w-full md:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                    Abrir Costeo por Libra &rarr;
                </button>
            </div>

            {/* Encabezado Principal */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                        <Settings className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Gestión de Costos, Envases y Mantenimiento</h1>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Costos por lote de producción, control de cubetas retornables con clientes y bitácora técnica de equipos.
                        </p>
                    </div>
                </div>
            </div>

            {/* Selector de Pestañas */}
            <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200 flex flex-wrap gap-1.5 w-fit">
                <button
                    onClick={() => setActiveTab('costs')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                        activeTab === 'costs'
                            ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <DollarSign size={14} />
                    Costos por Lote
                </button>
                <button
                    onClick={() => setActiveTab('returnables')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                        activeTab === 'returnables'
                            ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <RotateCcw size={14} />
                    Envases Retornables (Cubetas)
                </button>
                <button
                    onClick={() => setActiveTab('maintenance')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                        activeTab === 'maintenance'
                            ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Wrench size={14} />
                    Mantenimiento de Equipos
                </button>
                <button
                    onClick={() => setActiveTab('forecasting')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                        activeTab === 'forecasting'
                            ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <BarChart3 size={14} />
                    Proyección de Demanda
                </button>
            </div>

            {/* PESTAÑA 1: COSTOS POR LOTE */}
            {activeTab === 'costs' && (
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-teal-600" />
                                <span>Centro de Costos de Producción</span>
                            </h2>
                            <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-slate-500" />
                                <input
                                    type="date"
                                    value={dateStart}
                                    onChange={(e) => setDateStart(e.target.value)}
                                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                                <span className="text-slate-400 text-xs">a</span>
                                <input
                                    type="date"
                                    value={dateEnd}
                                    onChange={(e) => setDateEnd(e.target.value)}
                                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                                <span className="text-[10px] font-bold text-slate-500 uppercase block truncate">Costo Fijo Base</span>
                                <span className="text-sm font-black text-amber-700 block mt-1">
                                    <Money value={getTotalFixedCost()} />
                                </span>
                            </div>
                            {(() => {
                                const filtered = batches.filter(b => b.completed_at && b.completed_at >= dateStart && b.completed_at <= dateEnd + 'T23:59:59');
                                const totalYield = filtered.reduce((s, b) => s + parseFloat(b.yield_liquid_lbs || 0), 0);
                                const totalVar = filtered.reduce((s, b) => s + (b.variable_costs || []).reduce((ss, c) => ss + parseFloat(c.amount || 0), 0), 0);
                                const totalAll = getTotalFixedCost() * filtered.length + totalVar;
                                const totalWasteLbs = filtered.reduce((s, b) => s + parseFloat(b.waste_shell_lbs || 0) + parseFloat(b.waste_loss_lbs || 0), 0);
                                return (
                                    <>
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block truncate">Lotes Procesados</span>
                                            <span className="text-sm font-black text-slate-900 block mt-1">{filtered.length}</span>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block truncate">Rendimiento Líquido</span>
                                            <span className="text-sm font-black text-teal-700 block mt-1">{totalYield.toLocaleString()} Lbs</span>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block truncate">Merma de Cáscara</span>
                                            <span className="text-sm font-black text-rose-700 block mt-1">{totalWasteLbs.toLocaleString()} Lbs</span>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block truncate">Costo Total Acumulado</span>
                                            <span className="text-sm font-black text-amber-700 block mt-1">
                                                <Money value={totalAll} />
                                            </span>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block truncate">Costo Promedio / Lb</span>
                                            <span className="text-sm font-black text-indigo-700 block mt-1">
                                                <Money value={totalYield > 0 ? totalAll / totalYield : 0} />
                                            </span>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    {batches.filter(b => b.completed_at && b.completed_at >= dateStart && b.completed_at <= dateEnd + 'T23:59:59').length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-xs font-semibold shadow-sm">
                            No hay lotes finalizados en el rango de fechas seleccionado.
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                        <th className="px-4 py-3">Producto</th>
                                        <th className="px-3 py-3">Fecha Fin</th>
                                        <th className="px-3 py-3 text-right">Rendimiento</th>
                                        <th className="px-3 py-3 text-right">Merma</th>
                                        <th className="px-3 py-3 text-right">Costo Total</th>
                                        <th className="px-3 py-3 text-right">Costo / Lb</th>
                                        <th className="px-3 py-3 text-right">Precio Sugerido</th>
                                        <th className="px-3 py-3 text-right">Venta Total</th>
                                        <th className="px-3 py-3 text-center w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
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
                                            <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900 text-xs capitalize">{b.product_type}</span>
                                                        <span className="text-[10px] text-slate-500">{b.presentation}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-[11px] text-slate-600 font-medium">
                                                    {formatDate(b.completed_at)}
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <span className="font-bold text-teal-700 text-xs">{yieldLbs.toLocaleString()} Lbs</span>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[11px] text-slate-600 font-medium">{(wasteShell + wasteLoss).toLocaleString()} Lbs</span>
                                                        <span className="text-[9px] text-rose-600 font-bold">
                                                            <Money value={shellCost + lossCost} />
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-bold text-amber-700 text-xs">
                                                            <Money value={totalCost} />
                                                        </span>
                                                        {varTotal > 0 && (
                                                            <span className="text-[9px] text-indigo-600 font-bold">
                                                                +<Money value={varTotal} /> var
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <span className="font-bold text-indigo-700 text-xs">
                                                        <Money value={costPerLb} />
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <span className="font-bold text-teal-700 text-xs">
                                                        <Money value={costPerLb / (1 - (profitMarginPercent / 100))} />
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <span className="font-bold text-emerald-700 text-xs">
                                                        <Money value={(costPerLb / (1 - (profitMarginPercent / 100))) * yieldLbs} />
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    <button
                                                        onClick={() => openVariableCosts(b)}
                                                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold flex items-center gap-1"
                                                        title="Agregar costos variables"
                                                    >
                                                        <Plus size={11} />
                                                        <span>Variables</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* PESTAÑA 2: CONTROL DE ENVASES RETORNABLES */}
            {activeTab === 'returnables' && (
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <RotateCcw className="h-4 w-4 text-emerald-600" />
                                <span>Control de Cubetas y Tapaderas Retornables</span>
                            </h2>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Seguimiento de saldo de envases entregados a clientes (PriceSmart, La Francesa, Lorena, Denny's, etc.) y devoluciones a planta.
                            </p>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <button
                                onClick={fetchReturnables}
                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl border border-slate-200 transition-all"
                                title="Recargar saldos"
                            >
                                <RefreshCw size={15} className={loadingReturnables ? 'animate-spin' : ''} />
                            </button>
                            <button
                                onClick={() => setNewCustomerModal(true)}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
                            >
                                <Plus size={15} />
                                <span>Registrar Cliente para Envases</span>
                            </button>
                        </div>
                    </div>

                    {/* KPIs de Envases */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {(() => {
                            const totalPending = returnables.reduce((s, r) => s + (parseInt(r.current_balance) || 0), 0);
                            const totalDelivered = returnables.reduce((s, r) => s + (parseInt(r.total_delivered) || 0), 0);
                            const totalReturned = returnables.reduce((s, r) => s + (parseInt(r.total_returned) || 0), 0);
                            const returnRate = totalDelivered > 0 ? ((totalReturned / totalDelivered) * 100).toFixed(1) : '100';

                            return (
                                <>
                                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cubetas en Clientes</span>
                                            <Package size={16} className="text-amber-600" />
                                        </div>
                                        <div className="text-2xl font-black text-amber-700 mt-1">{totalPending.toLocaleString()}</div>
                                        <span className="text-[10px] text-slate-500 font-medium">Pendientes de devolución</span>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Entregadas</span>
                                            <ArrowUpRight size={16} className="text-indigo-600" />
                                        </div>
                                        <div className="text-2xl font-black text-slate-900 mt-1">{totalDelivered.toLocaleString()}</div>
                                        <span className="text-[10px] text-slate-500 font-medium">Con producto pasteurizado</span>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Retornadas</span>
                                            <ArrowDownRight size={16} className="text-teal-600" />
                                        </div>
                                        <div className="text-2xl font-black text-teal-700 mt-1">{totalReturned.toLocaleString()}</div>
                                        <span className="text-[10px] text-slate-500 font-medium">Ingresadas a planta</span>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tasa de Retorno</span>
                                            <CheckCircle2 size={16} className="text-emerald-600" />
                                        </div>
                                        <div className="text-2xl font-black text-emerald-700 mt-1">{returnRate}%</div>
                                        <span className="text-[10px] text-slate-500 font-medium">Eficiencia de recuperación</span>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* Tabla de Envases por Cliente */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                Saldos de Envases por Cliente ({returnables.length})
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">Envase estándar: Cubeta 30 Lb con tapadera hermética</span>
                        </div>

                        {returnables.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-xs font-semibold">
                                No se han registrado clientes para control de envases retornables. Haga clic en "Registrar Cliente para Envases" para comenzar.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                            <th className="px-4 py-3">Cliente</th>
                                            <th className="px-3 py-3">Tipo de Envase</th>
                                            <th className="px-3 py-3 text-right">Saldo Inicial</th>
                                            <th className="px-3 py-3 text-right">Entregadas (+)</th>
                                            <th className="px-3 py-3 text-right">Devueltas (-)</th>
                                            <th className="px-4 py-3 text-right">Saldo Pendiente</th>
                                            <th className="px-3 py-3">Último Movimiento</th>
                                            <th className="px-4 py-3 text-center">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                        {returnables.map((r) => {
                                            const balance = parseInt(r.current_balance) || 0;
                                            return (
                                                <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="px-4 py-3 font-bold text-slate-900">
                                                        {r.customer_name}
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold uppercase">
                                                            {r.packaging_type === 'cubeta_30lb' ? 'Cubeta 30 Lb' : r.packaging_type}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-slate-600 font-medium">
                                                        {r.initial_balance || 0}
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-indigo-700 font-bold">
                                                        +{r.total_delivered || 0}
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-teal-700 font-bold">
                                                        -{r.total_returned || 0}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className={`px-2.5 py-1 rounded-xl text-xs font-black inline-block ${
                                                            balance > 50
                                                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                : balance > 0
                                                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        }`}>
                                                            {balance} Uds
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 text-[11px] text-slate-500 font-medium">
                                                        {formatDate(r.last_movement_date || r.created_at)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => {
                                                                setMovementModal(r);
                                                                setMovementForm({ movement_type: 'entrega', quantity: '', reference_document: '', notes: '' });
                                                            }}
                                                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all"
                                                        >
                                                            Movimiento &plusmn;
                                                        </button>
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
            )}

            {/* PESTAÑA 3: MANTENIMIENTO DE MAQUINARIA */}
            {activeTab === 'maintenance' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <Wrench className="h-4 w-4 text-teal-600" />
                                <span>Registrar Mantenimiento Técnico</span>
                            </h2>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">Bitácora de servicio preventivo y correctivo</p>
                        </div>

                        <form onSubmit={handleCreateMaintenance} className="space-y-3.5 text-xs">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Equipo de Planta</label>
                                <select
                                    value={maintenanceForm.equipment_name}
                                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, equipment_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                >
                                    <option value="pasteurizador">Pasteurizador de Placas APV</option>
                                    <option value="quebradora">Quebradora Centrífuga SANOVO</option>
                                    <option value="tanque holding">Tanques de Holding de Acero Inox</option>
                                    <option value="caldera">Caldera de Vapor Cleaver-Brooks</option>
                                    <option value="llenadora">Llenadora Automática de Envases</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Tipo de Servicio</label>
                                <select
                                    value={maintenanceForm.maintenance_type}
                                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, maintenance_type: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                >
                                    <option value="preventivo">Preventivo Programado</option>
                                    <option value="correctivo">Correctivo por Falla/Paro</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Horas de Uso</label>
                                    <input
                                        type="number"
                                        value={maintenanceForm.usage_hours_count}
                                        onChange={(e) => setMaintenanceForm({ ...maintenanceForm, usage_hours_count: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none shadow-sm"
                                        placeholder="Ej: 480"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Costo ($)</label>
                                    <MoneyInput
                                        value={maintenanceForm.cost}
                                        onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none shadow-sm"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Técnico Responsable</label>
                                <input
                                    type="text"
                                    value={maintenanceForm.technician_name}
                                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, technician_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none shadow-sm"
                                    placeholder="Ej: Ing. Hugo Martínez"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Descripción del Trabajo</label>
                                <textarea
                                    value={maintenanceForm.description}
                                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none shadow-sm h-16"
                                    placeholder="Cambio de juntas de placas, lubricación de bombas..."
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Repuestos Utilizados</label>
                                <input
                                    type="text"
                                    value={maintenanceForm.spare_parts_used}
                                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, spare_parts_used: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none shadow-sm"
                                    placeholder="Ej: Juntas de goma, sensor PT100"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
                            >
                                Guardar Registro de Mantenimiento
                            </button>
                        </form>
                    </div>

                    {/* Historial de Mantenimientos */}
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                            <Activity className="h-4 w-4 text-indigo-600" />
                            <span>Bitácora de Intervenciones a Equipos</span>
                        </h2>

                        <div className="space-y-3 overflow-y-auto max-h-[550px] pr-1">
                            {maintenanceLogs.map(log => (
                                <div key={log.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-900 capitalize">{log.equipment_name}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                log.maintenance_type === 'preventivo'
                                                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                            }`}>
                                                {log.maintenance_type}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 font-medium">{log.description}</p>
                                        {log.spare_parts_used && (
                                            <div className="text-[11px] text-slate-500">
                                                Repuestos: <strong className="text-slate-800">{log.spare_parts_used}</strong>
                                            </div>
                                        )}
                                        <div className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1 pt-1">
                                            <User size={12} />
                                            <span>Técnico: {log.technician_name}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex md:flex-col justify-between items-end text-right">
                                        <span className="text-[11px] text-slate-500 font-medium">{formatDate(log.created_at)}</span>
                                        <div className="flex gap-2 text-xs mt-2">
                                            <div className="text-center bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                                                <span className="text-[9px] font-bold block text-slate-500 uppercase">Horas Uso</span>
                                                <span className="text-xs font-bold text-slate-800">{log.usage_hours_count} hrs</span>
                                            </div>
                                            <div className="text-center bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                                                <span className="text-[9px] font-bold block text-slate-500 uppercase">Costo</span>
                                                <span className="text-xs font-black text-teal-700">
                                                    <Money value={log.cost} />
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* PESTAÑA 4: PROYECCIÓN DE DEMANDA */}
            {activeTab === 'forecasting' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-indigo-600" />
                                <span>Estimación de Necesidades de Materia Prima</span>
                            </h2>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">Proyección para el próximo mes según historial</p>
                        </div>

                        {forecast && (
                            <div className="space-y-3.5">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Demanda Estimada Próximo Mes</span>
                                    <span className="text-2xl font-black text-slate-900 mt-1 block">{forecast.forecast.toLocaleString()} Lbs</span>
                                    <span className="text-[10px] text-slate-500 mt-0.5 block">Basado en volumen despachado del último período</span>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Materia Prima Requerida (Lbs)</span>
                                    <span className="text-xl font-black text-teal-700 mt-1 block">{forecast.recommended_purchase_raw_material_lbs.toLocaleString()} Lbs</span>
                                    <span className="text-[10px] text-slate-500 mt-0.5 block">Considerando 15% de merma de cáscara</span>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                                        <span className="text-[9px] font-bold text-slate-500 block uppercase">Stock de Seguridad</span>
                                        <span className="font-bold text-slate-900 text-xs mt-1 block">{forecast.safety_stock.toLocaleString()} Lbs</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                                        <span className="text-[9px] font-bold text-slate-500 block uppercase">Nivel Confianza</span>
                                        <span className="font-bold text-teal-700 text-xs mt-1 block">{forecast.confidence_interval}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-indigo-600" />
                                <span>Comparativo de Consumo Mensual vs. Estimación</span>
                            </h2>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">Historial reciente y mes entrante</p>
                        </div>

                        {forecast && (
                            <div className="space-y-4">
                                <div className="flex items-end justify-between gap-4 h-60 bg-slate-50 p-6 rounded-xl border border-slate-200 relative">
                                    {forecast.historical.map((val, idx) => {
                                        const maxVal = Math.max(...forecast.historical, forecast.forecast) * 1.15;
                                        const heightPercent = `${(val / maxVal) * 100}%`;

                                        return (
                                            <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end relative z-10">
                                                <div className="text-[10px] font-bold text-slate-600">
                                                    <Money value={val} />
                                                </div>
                                                <div 
                                                    style={{ height: heightPercent }} 
                                                    className="w-full max-w-[32px] bg-slate-300 hover:bg-slate-400 transition-all rounded-t-lg" 
                                                />
                                                <span className="text-[10px] text-slate-500 font-bold uppercase">Mes -{6 - idx}</span>
                                            </div>
                                        );
                                    })}

                                    <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end relative z-10">
                                        <div className="text-[10px] font-bold text-indigo-700">
                                            <Money value={forecast.forecast} />
                                        </div>
                                        <div 
                                            style={{ height: `${(forecast.forecast / (Math.max(...forecast.historical, forecast.forecast) * 1.15)) * 100}%` }} 
                                            className="w-full max-w-[32px] bg-indigo-600 hover:bg-indigo-700 transition-all rounded-t-lg shadow-md shadow-indigo-600/20" 
                                        />
                                        <span className="text-[10px] text-indigo-700 font-black uppercase">PROYECTADO</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL: MOVIMIENTO DE RETORNABLES */}
            {movementModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 uppercase">Movimiento de Envases Retornables</h3>
                                <p className="text-xs text-slate-500 font-medium">{movementModal.customer_name}</p>
                            </div>
                            <button onClick={() => setMovementModal(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <XCircle size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleMovementSubmit} className="space-y-3.5">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Tipo de Movimiento</label>
                                <select
                                    value={movementForm.movement_type}
                                    onChange={(e) => setMovementForm({ ...movementForm, movement_type: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                >
                                    <option value="entrega">Entrega a Cliente (+ Despacho con Producto)</option>
                                    <option value="devolucion">Devolución a Planta (- Retorno de Vacíos)</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Cantidad de Envases (Cubetas)</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={movementForm.quantity}
                                    onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
                                    placeholder="Ej: 20"
                                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Documento de Referencia (Remisión / Factura)</label>
                                <input
                                    type="text"
                                    value={movementForm.reference_document}
                                    onChange={(e) => setMovementForm({ ...movementForm, reference_document: e.target.value })}
                                    placeholder="Ej: Remisión #R-4502 / DTE-03"
                                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Observaciones</label>
                                <textarea
                                    value={movementForm.notes}
                                    onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
                                    placeholder="Estado físico de las cubetas, con o sin tapadera..."
                                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm h-16"
                                />
                            </div>

                            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setMovementModal(null)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
                                >
                                    Confirmar Movimiento
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: NUEVO CLIENTE PARA RETORNABLES */}
            {newCustomerModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <h3 className="text-base font-bold text-slate-900 uppercase">Registrar Cliente para Envases</h3>
                            <button onClick={() => setNewCustomerModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <XCircle size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleNewCustomerSubmit} className="space-y-3.5">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Nombre del Cliente / Empresa</label>
                                <input
                                    type="text"
                                    value={newCustomerForm.customer_name}
                                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, customer_name: e.target.value })}
                                    placeholder="Ej: PriceSmart El Salvador / Panadería La Francesa"
                                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Tipo de Empaque</label>
                                <select
                                    value={newCustomerForm.packaging_type}
                                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, packaging_type: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                >
                                    <option value="cubeta_30lb">Cubeta 30 Lbs con tapadera hermética</option>
                                    <option value="cubeta_15lb">Cubeta 15 Lbs con tapadera</option>
                                    <option value="tarima_plastica">Tarima Plástica Sanitaria</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Saldo Inicial en Cliente</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={newCustomerForm.initial_balance}
                                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, initial_balance: e.target.value })}
                                    placeholder="0"
                                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Notas y Condiciones</label>
                                <textarea
                                    value={newCustomerForm.notes}
                                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, notes: e.target.value })}
                                    placeholder="Contacto de bodega, frecuencia de retorno, sucursal..."
                                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm h-16"
                                />
                            </div>

                            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setNewCustomerModal(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
                                >
                                    Guardar Cliente
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: COSTOS VARIABLES */}
            {variableCostsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <h3 className="text-base font-bold text-slate-900 uppercase">Costos Variables por Lote</h3>
                            <button onClick={() => setVariableCostsModal(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <XCircle size={20} />
                            </button>
                        </div>
                        <p className="text-xs text-slate-600">
                            Lote: <strong className="text-slate-900 capitalize">{variableCostsModal.product_type}</strong> ({variableCostsModal.presentation})
                        </p>
                        <div className="space-y-2">
                            <div className="text-[10px] font-bold text-slate-500 uppercase">Costos Fijos Asignados</div>
                            {costConcepts.map(cc => (
                                <div key={cc.id} className="flex justify-between bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs">
                                    <span className="text-slate-600 font-medium">{cc.concept_name}</span>
                                    <span className="font-bold text-slate-900">
                                        <Money value={cc.default_value} />
                                    </span>
                                </div>
                            ))}
                            <div className="text-[10px] font-bold text-slate-500 uppercase pt-2">Costos Variables del Lote</div>
                            {variableCosts.map(vc => (
                                <div key={vc.id} className="flex justify-between items-center bg-indigo-50/50 border border-indigo-100 rounded-lg p-2.5 text-xs">
                                    <span className="text-indigo-900 font-semibold">{vc.concept_name}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-indigo-700">
                                            <Money value={vc.amount} />
                                        </span>
                                        <button onClick={() => deleteVariableCost(vc.id)} className="text-rose-600 hover:text-rose-700">
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <div className="flex gap-2 pt-2">
                                <input
                                    type="text"
                                    value={newVarCost.concept_name}
                                    onChange={(e) => setNewVarCost({ ...newVarCost, concept_name: e.target.value })}
                                    placeholder="Concepto (ej. Flete extra, Muestreo)"
                                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none"
                                />
                                <div className="w-28">
                                    <MoneyInput
                                        value={newVarCost.amount}
                                        onChange={(e) => setNewVarCost({ ...newVarCost, amount: e.target.value })}
                                        placeholder="0.00"
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold text-right focus:outline-none"
                                        step="0.01"
                                    />
                                </div>
                                <button onClick={addVariableCost} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold">
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="flex justify-end pt-3 border-t border-slate-200">
                            <button onClick={() => setVariableCostsModal(null)} className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EggCostsMaintenance;
