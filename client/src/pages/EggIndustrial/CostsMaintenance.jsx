import { formatDate } from '../../utils/dateUtils';
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
    RefreshCw,
    FileText,
    Printer,
    Search,
    Sparkles,
    Layers,
    AlertTriangle
} from 'lucide-react';

const EggCostsMaintenance = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const companyId = user?.company_id || 1;

    // Lists
    const [, setCosts] = useState([]);
    const [batches, setBatches] = useState([]);
    const [maintenanceLogs, setMaintenanceLogs] = useState([]);
    const [forecast, setForecast] = useState(null);
    const [, setLoading] = useState(true);

    // Returnables state (Control de cubetas y tapaderas & Estado de Cuenta)
    const [returnables, setReturnables] = useState([]);
    const [loadingReturnables, setLoadingReturnables] = useState(false);
    const [isSyncingSales, setIsSyncingSales] = useState(false);
    const [returnableSearch, setReturnableSearch] = useState('');
    const [returnableFilter, setReturnableFilter] = useState('all'); // 'all', 'pending', 'missing_lids'

    // Statement Modal state
    const [statementModal, setStatementModal] = useState(null);
    const [statementData, setStatementData] = useState(null);
    const [loadingStatement, setLoadingStatement] = useState(false);
    const [statementTypeFilter, setStatementTypeFilter] = useState('all');

    // Movement Modal
    const [movementModal, setMovementModal] = useState(null);
    const [movementForm, setMovementForm] = useState({
        movement_type: 'devolucion',
        cubetas_qty: '',
        cubetas_30lb_qty: '',
        cubetas_32lb_qty: '',
        tapaderas_qty: '',
        movement_date: new Date().toISOString().split('T')[0],
        reference_document: '',
        notes: ''
    });

    // New Customer Modal
    const [newCustomerModal, setNewCustomerModal] = useState(false);
    const [customerCatalog, setCustomerCatalog] = useState([]);
    const [newCustomerForm, setNewCustomerForm] = useState({
        customer_id: '',
        customer_name: '',
        packaging_type: 'cubeta_30lb',
        initial_balance: 0,
        initial_tapaderas: 0,
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
    const [profitMarginPercent, _setProfitMarginPercent] = useState(35);
    const [dateStart, setDateStart] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
    const [dateEnd, setDateEnd] = useState(new Date().toISOString().split('T')[0]);
    const [costConcepts, setCostConcepts] = useState([]);
    const [variableCostsModal, setVariableCostsModal] = useState(null);
    const [variableCosts, setVariableCosts] = useState([]);
    const [newVarCost, setNewVarCost] = useState({ concept_name: '', amount: '' });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [cRes, bRes, mRes, fRes, ccRes] = await Promise.allSettled([
                axios.get('/api/egg-industrial/costs'),
                axios.get('/api/egg-industrial/batches'),
                axios.get('/api/egg-industrial/maintenance'),
                axios.get('/api/egg-industrial/forecast'),
                axios.get('/api/egg-industrial/cost-concepts')
            ]);
            if (cRes.status === 'fulfilled') setCosts(cRes.value.data || []);
            if (bRes.status === 'fulfilled') setBatches(bRes.value.data || []);
            if (mRes.status === 'fulfilled') setMaintenanceLogs(mRes.value.data || []);
            if (ccRes.status === 'fulfilled') setCostConcepts(ccRes.value.data || []);
            if (fRes.status === 'fulfilled') setForecast(fRes.value.data || null);

            const allFailed = [cRes, bRes, mRes, fRes, ccRes].every(r => r.status === 'rejected');
            if (allFailed) {
                toast.error('Error al cargar datos de costos y mantenimiento.');
            }
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

    const syncSalesReturnables = async () => {
        setIsSyncingSales(true);
        try {
            const res = await axios.post('/api/egg-industrial/returnables/sync-sales');
            toast.success(res.data?.message || 'Sincronización de facturas completada.');
            await fetchReturnables();
            if (statementModal) {
                await openStatement(statementModal);
            }
        } catch (error) {
            console.error('Error syncing sales returnables:', error);
            toast.error(error.response?.data?.message || 'Error al sincronizar facturas.');
        } finally {
            setIsSyncingSales(false);
        }
    };

    const openStatement = async (customerRecord) => {
        setStatementModal(customerRecord);
        setLoadingStatement(true);
        try {
            const res = await axios.get(`/api/egg-industrial/returnables/customers/${customerRecord.id}/statement`);
            setStatementData(res.data);
        } catch (error) {
            console.error('Error fetching customer statement:', error);
            toast.error('Error al cargar estado de cuenta del cliente.');
        } finally {
            setLoadingStatement(false);
        }
    };

    const openNewCustomerModal = async () => {
        setNewCustomerModal(true);
        if (customerCatalog.length === 0) {
            try {
                const res = await axios.get('/api/customers?limit=200');
                setCustomerCatalog(res.data?.data || res.data || []);
            } catch (e) {
                console.warn('Could not fetch customer catalog:', e);
            }
        }
    };

    // Handle returnable movement submit (Cubetas y Tapaderas con 30 LB / 32 LB)
    const handleMovementSubmit = async (e) => {
        e.preventDefault();
        const c30 = parseInt(movementForm.cubetas_30lb_qty, 10) || 0;
        const c32 = parseInt(movementForm.cubetas_32lb_qty, 10) || 0;
        let cQty = parseInt(movementForm.cubetas_qty, 10) || 0;
        if (cQty === 0 && (c30 > 0 || c32 > 0)) {
            cQty = c30 + c32;
        }
        const tQty = parseInt(movementForm.tapaderas_qty, 10) || 0;
        if (cQty <= 0 && tQty <= 0) {
            return toast.error('Ingrese al menos una cantidad de cubetas o tapaderas mayor a 0.');
        }

        try {
            await axios.post('/api/egg-industrial/returnables/movements', {
                returnable_id: movementModal.id,
                movement_type: movementForm.movement_type,
                cubetas_qty: cQty,
                cubetas_30lb_qty: c30,
                cubetas_32lb_qty: c32,
                tapaderas_qty: tQty,
                movement_date: movementForm.movement_date || new Date().toISOString().split('T')[0],
                reference_document: movementForm.reference_document,
                notes: movementForm.notes,
                registered_by: user?.nombre || user?.name || user?.username || 'Encargado Logística'
            });
            toast.success(`Movimiento de ${movementForm.movement_type} registrado correctamente.`);
            setMovementModal(null);
            setMovementForm({ 
                movement_type: 'devolucion', 
                cubetas_qty: '', 
                cubetas_30lb_qty: '',
                cubetas_32lb_qty: '',
                tapaderas_qty: '', 
                movement_date: new Date().toISOString().split('T')[0],
                reference_document: '', 
                notes: '' 
            });
            await fetchReturnables();
            if (statementModal && statementModal.id === movementModal.id) {
                await openStatement(statementModal);
            }
        } catch (error) {
            console.error('Error saving returnable movement:', error);
            toast.error(error.response?.data?.message || 'Error al registrar movimiento.');
        }
    };

    // Handle new customer for returnables (Cubetas y Tapaderas)
    const handleNewCustomerSubmit = async (e) => {
        e.preventDefault();
        if (!newCustomerForm.customer_name.trim()) return toast.error('Ingrese o seleccione el nombre del cliente.');

        try {
            await axios.post('/api/egg-industrial/returnables/customers', {
                customer_id: newCustomerForm.customer_id ? parseInt(newCustomerForm.customer_id, 10) : null,
                customer_name: newCustomerForm.customer_name,
                packaging_type: newCustomerForm.packaging_type,
                initial_balance: parseInt(newCustomerForm.initial_balance, 10) || 0,
                initial_tapaderas: parseInt(newCustomerForm.initial_tapaderas, 10) || 0,
                notes: newCustomerForm.notes
            });
            toast.success('Cliente registrado para control de cubetas y tapaderas.');
            setNewCustomerModal(false);
            setNewCustomerForm({ 
                customer_id: '',
                customer_name: '', 
                packaging_type: 'cubeta_30lb', 
                initial_balance: 0, 
                initial_tapaderas: 0, 
                notes: '' 
            });
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
                                Seguimiento automatizado desde facturas de venta, estado de cuenta por cliente y conciliación de cubetas y tapaderas.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5">
                            <button
                                onClick={syncSalesReturnables}
                                disabled={isSyncingSales}
                                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                                title="Escanear y vincular facturas que contengan cubetas automáticamente"
                            >
                                <Sparkles size={14} className={isSyncingSales ? 'animate-spin text-indigo-600' : 'text-indigo-600'} />
                                <span>{isSyncingSales ? 'Sincronizando...' : 'Sincronizar Facturación Automática'}</span>
                            </button>
                            <button
                                onClick={fetchReturnables}
                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl border border-slate-200 transition-all"
                                title="Recargar saldos"
                            >
                                <RefreshCw size={15} className={loadingReturnables ? 'animate-spin' : ''} />
                            </button>
                            <button
                                onClick={openNewCustomerModal}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
                            >
                                <Plus size={15} />
                                <span>Registrar Cliente para Envases</span>
                            </button>
                        </div>
                    </div>

                    {/* KPIs de Envases: Cubetas y Tapaderas */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {(() => {
                            const totalPendingCubetas = returnables.reduce((s, r) => s + (parseInt(r.current_balance) || 0), 0);
                            const totalDeliveredCubetas = returnables.reduce((s, r) => s + (parseInt(r.delivered_qty) || 0), 0);
                            const totalReturnedCubetas = returnables.reduce((s, r) => s + (parseInt(r.returned_qty) || 0), 0);

                            const totalPendingTapaderas = returnables.reduce((s, r) => s + (parseInt(r.current_tapaderas) || 0), 0);
                            const totalDeliveredTapaderas = returnables.reduce((s, r) => s + (parseInt(r.delivered_tapaderas) || 0), 0);
                            const totalReturnedTapaderas = returnables.reduce((s, r) => s + (parseInt(r.returned_tapaderas) || 0), 0);

                            const missingLids = Math.max(0, totalPendingCubetas - totalPendingTapaderas);
                            const returnRateCubetas = totalDeliveredCubetas > 0 ? ((totalReturnedCubetas / totalDeliveredCubetas) * 100).toFixed(1) : '100';

                            return (
                                <>
                                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cubetas en Clientes</span>
                                            <Package size={16} className="text-amber-600" />
                                        </div>
                                        <div className="text-2xl font-black text-amber-700 mt-1">{totalPendingCubetas.toLocaleString()} <span className="text-xs font-bold text-amber-600/80">Uds</span></div>
                                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-semibold border-t border-slate-100 pt-2">
                                            <span>+{totalDeliveredCubetas.toLocaleString()} entregadas</span>
                                            <span>-{totalReturnedCubetas.toLocaleString()} devueltas</span>
                                        </div>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tapaderas en Clientes</span>
                                            <Layers size={16} className="text-indigo-600" />
                                        </div>
                                        <div className="text-2xl font-black text-indigo-700 mt-1">{totalPendingTapaderas.toLocaleString()} <span className="text-xs font-bold text-indigo-600/80">Uds</span></div>
                                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-semibold border-t border-slate-100 pt-2">
                                            <span>+{totalDeliveredTapaderas.toLocaleString()} entregadas</span>
                                            <span>-{totalReturnedTapaderas.toLocaleString()} devueltas</span>
                                        </div>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tapaderas Faltantes</span>
                                            <AlertTriangle size={16} className={missingLids > 0 ? 'text-rose-600' : 'text-slate-400'} />
                                        </div>
                                        <div className={`text-2xl font-black mt-1 ${missingLids > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                                            {missingLids.toLocaleString()} <span className="text-xs font-bold">Uds</span>
                                        </div>
                                        <div className="mt-2 text-[10px] text-slate-500 font-medium border-t border-slate-100 pt-2">
                                            {missingLids > 0 ? (
                                                <span className="text-rose-600 font-bold">Diferencia entre cubetas y tapas</span>
                                            ) : (
                                                <span className="text-emerald-600 font-bold">Sin descuadre de tapaderas</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tasa de Retorno</span>
                                            <CheckCircle2 size={16} className="text-emerald-600" />
                                        </div>
                                        <div className="text-2xl font-black text-emerald-700 mt-1">{returnRateCubetas}%</div>
                                        <div className="mt-2 text-[10px] text-slate-500 font-medium border-t border-slate-100 pt-2">
                                            Recuperación de envases retornables
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* Filtros y Buscador de Clientes */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3.5">
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input
                                type="text"
                                value={returnableSearch}
                                onChange={(e) => setReturnableSearch(e.target.value)}
                                placeholder="Buscar por cliente o código..."
                                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto">
                            <button
                                onClick={() => setReturnableFilter('all')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    returnableFilter === 'all'
                                        ? 'bg-slate-900 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                Todos ({returnables.length})
                            </button>
                            <button
                                onClick={() => setReturnableFilter('pending')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    returnableFilter === 'pending'
                                        ? 'bg-amber-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                Con Saldo Pendiente ({returnables.filter(r => (parseInt(r.current_balance) || 0) > 0 || (parseInt(r.current_tapaderas) || 0) > 0).length})
                            </button>
                            <button
                                onClick={() => setReturnableFilter('missing_lids')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    returnableFilter === 'missing_lids'
                                        ? 'bg-rose-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                Con Descuadre de Tapas ({returnables.filter(r => (parseInt(r.missing_tapaderas) || 0) > 0).length})
                            </button>
                        </div>
                    </div>

                    {/* Tabla de Envases y Estados de Cuenta por Cliente */}
                    {(() => {
                        const filtered = returnables.filter(r => {
                            const name = (r.customer_name || r.customer_full_name || '').toLowerCase();
                            const code = (r.customer_code || '').toLowerCase();
                            const matchesQuery = name.includes(returnableSearch.toLowerCase()) || code.includes(returnableSearch.toLowerCase());
                            if (!matchesQuery) return false;

                            if (returnableFilter === 'pending') {
                                return (parseInt(r.current_balance) || 0) > 0 || (parseInt(r.current_tapaderas) || 0) > 0;
                            }
                            if (returnableFilter === 'missing_lids') {
                                return (parseInt(r.missing_tapaderas) || 0) > 0;
                            }
                            return true;
                        });

                        return (
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                        Estado de Cuenta de Envases por Cliente ({filtered.length})
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-medium">Control independiente de Cubetas y Tapaderas</span>
                                </div>

                                {filtered.length === 0 ? (
                                    <div className="p-10 text-center space-y-3">
                                        <Package className="mx-auto text-slate-300" size={36} />
                                        <p className="text-slate-500 text-xs font-semibold">
                                            {returnables.length === 0 
                                                ? 'No se han registrado clientes con envases aún. Haga clic en "Sincronizar Facturación Automática" para cargar clientes desde facturas existentes o "Registrar Cliente" para empezar.'
                                                : 'No se encontraron clientes con los filtros aplicados.'}
                                        </p>
                                        {returnables.length === 0 && (
                                            <button
                                                onClick={syncSalesReturnables}
                                                disabled={isSyncingSales}
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-md shadow-indigo-600/20"
                                            >
                                                <Sparkles size={14} />
                                                <span>Cargar desde Facturas Emitidas</span>
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                                    <th className="px-4 py-3">Cliente</th>
                                                    <th className="px-3 py-3 text-right">Cubetas (+)</th>
                                                    <th className="px-3 py-3 text-right">Cubetas (-)</th>
                                                    <th className="px-4 py-3 text-right">Saldo Cubetas</th>
                                                    <th className="px-3 py-3 text-right">Tapas (+)</th>
                                                    <th className="px-3 py-3 text-right">Tapas (-)</th>
                                                    <th className="px-4 py-3 text-right">Saldo Tapas</th>
                                                    <th className="px-3 py-3 text-center">Descuadre</th>
                                                    <th className="px-3 py-3">Último Mov.</th>
                                                    <th className="px-4 py-3 text-center">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                                {filtered.map((r) => {
                                                    const cubetasBalance = parseInt(r.current_balance) || 0;
                                                    const tapaderasBalance = parseInt(r.current_tapaderas) || 0;
                                                    const missingTapas = Math.max(0, cubetasBalance - tapaderasBalance);

                                                    return (
                                                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                                                            <td className="px-4 py-3">
                                                                <div className="font-bold text-slate-900 text-xs">
                                                                    {r.customer_full_name || r.customer_name}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                                                                    {r.telefono && <span>Tel: {r.telefono}</span>}
                                                                    {r.dias_credito != null && (
                                                                        <span className="px-1.5 py-0.2 bg-slate-100 rounded text-slate-600 font-bold">
                                                                            Crédito {r.dias_credito}d
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 text-right text-indigo-700 font-bold">
                                                                +{r.delivered_qty || 0}
                                                            </td>
                                                            <td className="px-3 py-3 text-right text-teal-700 font-bold">
                                                                -{r.returned_qty || 0}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <span className={`px-2.5 py-1 rounded-xl text-xs font-black inline-block ${
                                                                    cubetasBalance > 50
                                                                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                        : cubetasBalance > 0
                                                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                }`}>
                                                                    {cubetasBalance} Uds
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-3 text-right text-indigo-700 font-bold">
                                                                +{r.delivered_tapaderas || 0}
                                                            </td>
                                                            <td className="px-3 py-3 text-right text-teal-700 font-bold">
                                                                -{r.returned_tapaderas || 0}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <span className={`px-2.5 py-1 rounded-xl text-xs font-black inline-block ${
                                                                    tapaderasBalance > 50
                                                                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                                        : tapaderasBalance > 0
                                                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                }`}>
                                                                    {tapaderasBalance} Uds
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-3 text-center">
                                                                {missingTapas > 0 ? (
                                                                    <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 text-[10px] font-black inline-flex items-center gap-1 border border-rose-200">
                                                                        <AlertTriangle size={10} />
                                                                        <span>-{missingTapas} Tapas</span>
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-emerald-700 text-[10px] font-bold">
                                                                        Al día
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-3 text-[11px] text-slate-500 font-medium whitespace-nowrap">
                                                                {formatDate(r.last_movement_date || r.created_at)}
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <button
                                                                        onClick={() => openStatement(r)}
                                                                        className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all"
                                                                        title="Ver Estado de Cuenta detallado tipo Kardex"
                                                                    >
                                                                        <FileText size={13} />
                                                                        <span>Estado de Cuenta</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setMovementModal(r);
                                                                            setMovementForm({ 
                                                                                movement_type: 'devolucion', 
                                                                                cubetas_qty: '', 
                                                                                tapaderas_qty: '', 
                                                                                movement_date: new Date().toISOString().split('T')[0],
                                                                                reference_document: '', 
                                                                                notes: '' 
                                                                            });
                                                                        }}
                                                                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
                                                                        title="Registrar devolución o entrega de envases"
                                                                    >
                                                                        <RotateCcw size={13} />
                                                                        <span>Movimiento &plusmn;</span>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
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

            {/* MODAL 1: ESTADO DE CUENTA DE ENVASES DEL CLIENTE (KARDEX DETALLADO) */}
            {statementModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-4xl w-full p-6 border border-slate-200 shadow-2xl space-y-5 text-xs my-8 max-h-[92vh] flex flex-col">
                        {/* Cabecera del Estado de Cuenta */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4 no-print">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">
                                        Estado de Cuenta de Envases Retornables
                                    </h3>
                                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                                        {statementModal.customer_name || statementData?.customer?.customer_name}
                                        {statementData?.customer?.telefono && ` • Tel: ${statementData.customer.telefono}`}
                                        {statementData?.customer?.nrc && ` • NRC: ${statementData.customer.nrc}`}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => window.print()}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-200"
                                    title="Imprimir Estado de Cuenta"
                                >
                                    <Printer size={14} />
                                    <span>Imprimir</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setMovementModal(statementModal);
                                        setMovementForm({ 
                                            movement_type: 'devolucion', 
                                            cubetas_qty: '', 
                                            tapaderas_qty: '', 
                                            movement_date: new Date().toISOString().split('T')[0],
                                            reference_document: '', 
                                            notes: '' 
                                        });
                                    }}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                                >
                                    <RotateCcw size={14} />
                                    <span>Registrar Retorno</span>
                                </button>
                                <button 
                                    onClick={() => {
                                        setStatementModal(null);
                                        setStatementData(null);
                                    }} 
                                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                                >
                                    <XCircle size={22} />
                                </button>
                            </div>
                        </div>

                        {/* Área imprimible / Contenido */}
                        <div id="statement-printable-area" className="space-y-4 overflow-y-auto flex-1 pr-1">
                            {/* Resumen del cliente para impresión */}
                            <div className="hidden print:block border-b border-slate-300 pb-3 mb-4">
                                <div className="text-sm font-black text-slate-900 uppercase">ANDELSA, S.A. DE C.V. - DIVISIÓN OVOPRODUCTOS</div>
                                <div className="text-xs font-bold text-slate-700 mt-1">ESTADO DE CUENTA DE ENVASES RETORNABLES (CUBETAS Y TAPADERAS)</div>
                                <div className="text-xs text-slate-600 mt-1">
                                    <strong>Cliente:</strong> {statementData?.customer?.customer_name} | 
                                    <strong> NRC:</strong> {statementData?.customer?.nrc || 'N/D'} | 
                                    <strong> Fecha de Emisión:</strong> {formatDate(new Date())}
                                </div>
                                <div className="text-xs text-slate-700 mt-1">
                                    <strong>Histórico Entregado:</strong> {statementData?.summary?.delivered_cubetas_30lb || 0} cubetas de 30 LB | {statementData?.summary?.delivered_cubetas_32lb || 0} cubetas de 32 LB | 
                                    <strong> Saldo Actual:</strong> {statementData?.summary?.current_cubetas || 0} cubetas / {statementData?.summary?.current_tapaderas || 0} tapaderas | 
                                    <strong className={statementData?.summary?.missing_tapaderas > 0 ? 'text-red-700' : 'text-slate-700'}> Tapas Faltantes:</strong> {statementData?.summary?.missing_tapaderas || 0}
                                </div>
                            </div>

                            {/* Tarjetas métricas del cliente */}
                            {statementData?.summary && (
                                <div className="space-y-2.5">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5">
                                            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Saldo Cubetas</span>
                                            <div className="text-xl font-black text-amber-900 mt-0.5">
                                                {statementData.summary.current_cubetas} <span className="text-xs font-bold">Uds</span>
                                            </div>
                                            <span className="text-[10px] text-amber-700/80 font-medium block mt-1">
                                                +{statementData.summary.delivered_cubetas} ent. / -{statementData.summary.returned_cubetas} dev.
                                            </span>
                                        </div>

                                        <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3.5">
                                            <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">Saldo Tapaderas</span>
                                            <div className="text-xl font-black text-indigo-900 mt-0.5">
                                                {statementData.summary.current_tapaderas} <span className="text-xs font-bold">Uds</span>
                                            </div>
                                            <span className="text-[10px] text-indigo-700/80 font-medium block mt-1">
                                                +{statementData.summary.delivered_tapaderas} ent. / -{statementData.summary.returned_tapaderas} dev.
                                            </span>
                                        </div>

                                        <div className={`rounded-xl p-3.5 border ${
                                            statementData.summary.missing_tapaderas > 0 
                                                ? 'bg-rose-50/80 border-rose-200 text-rose-900' 
                                                : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                                        }`}>
                                            <span className="text-[10px] font-bold uppercase tracking-wider block">Descuadre Tapas</span>
                                            <div className="text-xl font-black mt-0.5">
                                                {statementData.summary.missing_tapaderas > 0 ? `-${statementData.summary.missing_tapaderas}` : '0'}{' '}
                                                <span className="text-xs font-bold">Uds</span>
                                            </div>
                                            <span className="text-[10px] font-medium block mt-1">
                                                {statementData.summary.missing_tapaderas > 0 ? 'Faltan tapaderas por retornar' : 'Saldos perfectamente cuadrados'}
                                            </span>
                                        </div>

                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Tasa de Retorno</span>
                                            <div className="text-xl font-black text-teal-800 mt-0.5">
                                                {statementData.summary.return_rate_cubetas}%
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-medium block mt-1">
                                                Eficiencia de devolución del cliente
                                            </span>
                                        </div>
                                    </div>

                                    {/* Desglose informativo de presentaciones entregadas (30 LB vs 32 LB) */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs no-print">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-[11px] font-bold text-slate-600 uppercase">Histórico Entregado por Presentación:</span>
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-100/90 text-amber-900 border border-amber-300 font-bold text-[11px]">
                                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                                30 LB: {statementData.summary.delivered_cubetas_30lb || 0} cubetas
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-100/90 text-blue-900 border border-blue-300 font-bold text-[11px]">
                                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                32 LB: {statementData.summary.delivered_cubetas_32lb || 0} cubetas
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-medium">
                                            * Mismo envase plástico y tapadera hermética universal
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Filtro de tipos de movimiento */}
                            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 no-print">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Filtrar:</span>
                                    <button
                                        onClick={() => setStatementTypeFilter('all')}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                            statementTypeFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        Todos
                                    </button>
                                    <button
                                        onClick={() => setStatementTypeFilter('entrega')}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                            statementTypeFilter === 'entrega' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        Entregas / Facturas (+)
                                    </button>
                                    <button
                                        onClick={() => setStatementTypeFilter('devolucion')}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                            statementTypeFilter === 'devolucion' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        Devoluciones a Planta (-)
                                    </button>
                                </div>
                                <span className="text-[11px] text-slate-500 font-medium">
                                    {statementData?.movements?.length || 0} movimientos registrados
                                </span>
                            </div>

                            {/* Tabla de Movimientos Tipo Kardex */}
                            {loadingStatement ? (
                                <div className="p-8 text-center text-slate-500 font-semibold animate-pulse">
                                    Cargando estado de cuenta detallado...
                                </div>
                            ) : !statementData?.movements || statementData.movements.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 font-medium bg-slate-50 rounded-xl border border-slate-200">
                                    No hay movimientos registrados para este cliente aún.
                                </div>
                            ) : (
                                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                                                <th className="px-3 py-2.5">Fecha</th>
                                                <th className="px-3 py-2.5">Tipo</th>
                                                <th className="px-3 py-2.5">Documento / Referencia</th>
                                                <th className="px-3 py-2.5 text-right bg-amber-50/50">Cub. Ent. (+)</th>
                                                <th className="px-3 py-2.5 text-right bg-amber-50/50">Cub. Dev. (-)</th>
                                                <th className="px-3 py-2.5 text-right bg-amber-100/50 font-black">Saldo Cub.</th>
                                                <th className="px-3 py-2.5 text-right bg-indigo-50/50">Tap. Ent. (+)</th>
                                                <th className="px-3 py-2.5 text-right bg-indigo-50/50">Tap. Dev. (-)</th>
                                                <th className="px-3 py-2.5 text-right bg-indigo-100/50 font-black">Saldo Tap.</th>
                                                <th className="px-3 py-2.5">Notas / Responsable</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                            {statementData.movements
                                                .filter(m => statementTypeFilter === 'all' || m.movement_type === statementTypeFilter)
                                                .map((m) => (
                                                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                                                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-600 font-medium">
                                                            {formatDate(m.movement_date)}
                                                        </td>
                                                        <td className="px-3 py-2.5 whitespace-nowrap">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                                m.movement_type === 'entrega'
                                                                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                                                    : m.movement_type === 'devolucion'
                                                                    ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                                            }`}>
                                                                {m.movement_type === 'entrega' ? 'Entrega Factura' : (m.movement_type === 'devolucion' ? 'Devolución' : m.movement_type)}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-slate-900 font-bold">
                                                            <div>{m.reference_document || (m.sale_id ? `Venta #${m.sale_id}` : 'S/R')}</div>
                                                            {m.movement_type === 'entrega' && (m.cubetas_30lb > 0 || m.cubetas_32lb > 0) && (
                                                                <div className="flex items-center gap-1 mt-1">
                                                                    {m.cubetas_30lb > 0 && (
                                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                                                            {m.cubetas_30lb} cbt 30LB
                                                                        </span>
                                                                    )}
                                                                    {m.cubetas_32lb > 0 && (
                                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                                                                            {m.cubetas_32lb} cbt 32LB
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right text-indigo-700 font-bold bg-amber-50/30">
                                                            {m.cubetas_delivered > 0 ? `+${m.cubetas_delivered}` : '-'}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right text-teal-700 font-bold bg-amber-50/30">
                                                            {m.cubetas_returned > 0 ? `-${m.cubetas_returned}` : '-'}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right font-black text-amber-900 bg-amber-100/40">
                                                            {m.cubetas_balance}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right text-indigo-700 font-bold bg-indigo-50/30">
                                                            {m.tapaderas_delivered > 0 ? `+${m.tapaderas_delivered}` : '-'}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right text-teal-700 font-bold bg-indigo-50/30">
                                                            {m.tapaderas_returned > 0 ? `-${m.tapaderas_returned}` : '-'}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right font-black text-indigo-900 bg-indigo-100/40">
                                                            {m.tapaderas_balance}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-[11px] text-slate-600 max-w-xs truncate" title={m.notes || ''}>
                                                            {m.notes || 'Sin observaciones'}
                                                            {m.registered_by && <span className="block text-[9px] text-slate-400 font-medium">Por: {m.registered_by}</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Pie de modal */}
                        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200 no-print">
                            <button
                                type="button"
                                onClick={() => {
                                    setStatementModal(null);
                                    setStatementData(null);
                                }}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                            >
                                Cerrar Estado de Cuenta
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: MOVIMIENTO DE ENVASES RETORNABLES (CUBETAS Y TAPADERAS) */}
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
                                    <option value="devolucion">Devolución a Planta (- Retorno de Envases Vacíos)</option>
                                    <option value="entrega">Entrega a Cliente (+ Despacho con Producto)</option>
                                    <option value="ajuste">Ajuste Manual de Inventario</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Cubetas Físicas</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={movementForm.cubetas_qty}
                                        onChange={(e) => setMovementForm({ ...movementForm, cubetas_qty: e.target.value })}
                                        placeholder="Ej: 20"
                                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Tapaderas Físicas</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={movementForm.tapaderas_qty}
                                        onChange={(e) => setMovementForm({ ...movementForm, tapaderas_qty: e.target.value })}
                                        placeholder="Ej: 18"
                                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Desglose opcional por presentación */}
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                                    Desglose por Peso Facturado (Opcional)
                                </span>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] font-semibold text-slate-600 block mb-1">De 30 LB</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={movementForm.cubetas_30lb_qty || ''}
                                            onChange={(e) => {
                                                const v30 = e.target.value;
                                                const v32 = movementForm.cubetas_32lb_qty || 0;
                                                const sum = (parseInt(v30, 10) || 0) + (parseInt(v32, 10) || 0);
                                                setMovementForm({
                                                    ...movementForm,
                                                    cubetas_30lb_qty: v30,
                                                    cubetas_qty: sum > 0 ? sum : movementForm.cubetas_qty
                                                });
                                            }}
                                            placeholder="Cant. 30 LB"
                                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-semibold text-slate-600 block mb-1">De 32 LB</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={movementForm.cubetas_32lb_qty || ''}
                                            onChange={(e) => {
                                                const v32 = e.target.value;
                                                const v30 = movementForm.cubetas_30lb_qty || 0;
                                                const sum = (parseInt(v30, 10) || 0) + (parseInt(v32, 10) || 0);
                                                setMovementForm({
                                                    ...movementForm,
                                                    cubetas_32lb_qty: v32,
                                                    cubetas_qty: sum > 0 ? sum : movementForm.cubetas_qty
                                                });
                                            }}
                                            placeholder="Cant. 32 LB"
                                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Fecha del Movimiento</label>
                                <input
                                    type="date"
                                    value={movementForm.movement_date}
                                    onChange={(e) => setMovementForm({ ...movementForm, movement_date: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Documento de Referencia (Remisión / Recibo)</label>
                                <input
                                    type="text"
                                    value={movementForm.reference_document}
                                    onChange={(e) => setMovementForm({ ...movementForm, reference_document: e.target.value })}
                                    placeholder="Ej: Recibo de Retorno #145 / Remisión #R-4502"
                                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Observaciones</label>
                                <textarea
                                    value={movementForm.notes}
                                    onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
                                    placeholder="Condición de las cubetas, faltante de tapaderas rotas, etc..."
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

            {/* MODAL 3: REGISTRAR CLIENTE PARA ENVASES RETORNABLES */}
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
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Seleccionar Cliente del Catálogo</label>
                                <select
                                    value={newCustomerForm.customer_id}
                                    onChange={(e) => {
                                        const cId = e.target.value;
                                        const selected = customerCatalog.find(c => String(c.id) === String(cId));
                                        setNewCustomerForm({
                                            ...newCustomerForm,
                                            customer_id: cId,
                                            customer_name: selected ? selected.nombre : newCustomerForm.customer_name
                                        });
                                    }}
                                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm mb-2"
                                >
                                    <option value="">-- Seleccionar de clientes existentes (opcional) --</option>
                                    {customerCatalog.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.nombre} {c.codigo ? `(${c.codigo})` : ''}
                                        </option>
                                    ))}
                                </select>

                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Nombre del Cliente / Empresa</label>
                                <input
                                    type="text"
                                    value={newCustomerForm.customer_name}
                                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, customer_name: e.target.value })}
                                    placeholder="Ej: PriceSmart El Salvador / Panadería La Francesa"
                                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                    required
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
                                    <option value="cubeta_32lb">Cubeta 32 Lbs con tapadera hermética</option>
                                    <option value="cubeta_15lb">Cubeta 15 Lbs con tapadera</option>
                                    <option value="tarima_plastica">Tarima Plástica Sanitaria</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Saldo Inicial Cubetas</label>
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
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Saldo Inicial Tapaderas</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={newCustomerForm.initial_tapaderas}
                                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, initial_tapaderas: e.target.value })}
                                        placeholder="0"
                                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                    />
                                </div>
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
