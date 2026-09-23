import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Users,
    Target,
    Link2,
    Send,
    CheckCircle2,
    Clock,
    AlertCircle,
    RefreshCw,
    Award,
    Lock,
    UserCheck,
    UserPlus,
    Trash2,
    X
} from 'lucide-react';
import Money from '../ui/Money';

export default function EggSellerGoalsManager({ selectedYear, selectedMonth }) {
    const [year, setYear] = useState(selectedYear || new Date().getFullYear());
    const [month, setMonth] = useState(selectedMonth || (new Date().getMonth() + 1));
    const [quincena, setQuincena] = useState('segunda'); // 'segunda' (cierre mensual estándar) o 'primera'

    const [sellers, setSellers] = useState([]);
    const [otherSellers, setOtherSellers] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [goals, setGoals] = useState([]);
    const [summary, setSummary] = useState([]);
    const [_loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [transferringId, setTransferringId] = useState(null);

    // Modal para crear / asignar nuevo vendedor a huevo industrial
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
        mode: 'from_employee', // 'from_employee' | 'from_seller' | 'custom'
        employee_id: '',
        seller_id: '',
        nombre: '',
        target_volume_lbs: 60000,
        target_min_price_lb: 1.25,
        commission_rate_per_lb: 0.0150,
        commission_cap_usd: 1000.00
    });
    const [savingCreate, setSavingCreate] = useState(false);

    // Formulario de edición rápida de meta
    const [editingGoal, setEditingGoal] = useState({
        seller_id: '',
        target_volume_lbs: 60000,
        target_min_price_lb: 1.25,
        target_amount_usd: 75000,
        commission_rate_per_lb: 0.0150,
        commission_cap_usd: 1000.00,
        notes: ''
    });
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

    // Cargar datos
    const loadAll = async () => {
        setLoading(true);
        try {
            const [seRes, goalsRes, sumRes] = await Promise.all([
                axios.get('/api/egg-industrial/commissions/sellers-employees'),
                axios.get('/api/egg-industrial/commissions/goals', { params: { year, month } }),
                axios.get('/api/egg-industrial/commissions/summary', { params: { year, month } })
            ]);

            setSellers(seRes.data?.sellers || []);
            setOtherSellers(seRes.data?.otherSellers || []);
            setEmployees(seRes.data?.employees || []);
            setGoals(goalsRes.data || []);
            setSummary(sumRes.data || []);
        } catch (err) {
            console.error('Error loading commissions data:', err);
            toast.error('Error al cargar datos comerciales.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
    }, [year, month]);

    // Vincular vendedor con empleado
    const handleLinkEmployee = async (sellerId, employeeId) => {
        try {
            await axios.post('/api/egg-industrial/commissions/link-seller-employee', {
                seller_id: sellerId,
                employee_id: employeeId ? parseInt(employeeId) : null
            });
            toast.success('Vinculación con empleado de nómina actualizada.');
            loadAll();
        } catch (err) {
            toast.error('Error al vincular vendedor.');
        }
    };

    // Crear o asignar nuevo vendedor a huevo industrial
    const handleCreateSeller = async (e) => {
        e.preventDefault();
        try {
            setSavingCreate(true);
            const payload = {
                target_volume_lbs: parseFloat(createForm.target_volume_lbs) || 60000,
                target_min_price_lb: parseFloat(createForm.target_min_price_lb) || 1.25,
                commission_rate_per_lb: parseFloat(createForm.commission_rate_per_lb) || 0.015,
                commission_cap_usd: Math.min(1000, parseFloat(createForm.commission_cap_usd) || 1000),
                period_year: year,
                period_month: month
            };

            if (createForm.mode === 'from_employee') {
                if (!createForm.employee_id) {
                    toast.error('Seleccione un empleado de la lista.');
                    return;
                }
                const emp = employees.find(x => x.id === parseInt(createForm.employee_id));
                payload.employee_id = emp?.id;
                payload.nombre = `${emp?.nombres || ''} ${emp?.apellidos || ''}`.trim();
            } else if (createForm.mode === 'from_seller') {
                if (!createForm.seller_id) {
                    toast.error('Seleccione un vendedor existente.');
                    return;
                }
                payload.seller_id = parseInt(createForm.seller_id);
                payload.employee_id = createForm.employee_id ? parseInt(createForm.employee_id) : null;
            } else {
                if (!createForm.nombre?.trim()) {
                    toast.error('Ingrese el nombre del vendedor.');
                    return;
                }
                payload.nombre = createForm.nombre.trim();
                payload.employee_id = createForm.employee_id ? parseInt(createForm.employee_id) : null;
            }

            const res = await axios.post('/api/egg-industrial/commissions/create-seller', payload);
            if (res.data?.success) {
                toast.success(res.data.message || 'Vendedor registrado exitosamente');
                setIsCreateModalOpen(false);
                setCreateForm({
                    mode: 'from_employee',
                    employee_id: '',
                    seller_id: '',
                    nombre: '',
                    target_volume_lbs: 60000,
                    target_min_price_lb: 1.25,
                    commission_rate_per_lb: 0.0150,
                    commission_cap_usd: 1000.00
                });
                loadAll();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error al registrar vendedor');
        } finally {
            setSavingCreate(false);
        }
    };

    // Quitar vendedor de huevo industrial
    const handleRemoveSeller = async (sellerId, sellerName) => {
        if (!window.confirm(`¿Quitar a "${sellerName}" del módulo de Huevo Industrial? Ya no aparecerá en metas ni liquidaciones de comisiones.`)) {
            return;
        }
        try {
            const res = await axios.post('/api/egg-industrial/commissions/remove-seller', { seller_id: sellerId });
            if (res.data?.success) {
                toast.success(res.data.message || 'Vendedor removido de huevo industrial.');
                loadAll();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error al remover vendedor');
        }
    };

    // Guardar meta
    const handleSaveGoal = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/egg-industrial/commissions/goals', {
                ...editingGoal,
                period_year: year,
                period_month: month
            });
            toast.success('Meta comercial guardada con éxito.');
            setIsGoalModalOpen(false);
            loadAll();
        } catch (err) {
            toast.error('Error al guardar meta comercial.');
        }
    };

    // Calcular comisiones del período
    const handleCalculateCommissions = async () => {
        setCalculating(true);
        try {
            await axios.post('/api/egg-industrial/commissions/calculate', {
                year,
                month,
                quincena
            });
            toast.success('Comisiones del período calculadas según entregas reales.');
            loadAll();
        } catch (err) {
            toast.error('Error al calcular comisiones.');
        } finally {
            setCalculating(false);
        }
    };

    // Transferir comisión topada a Planilla RH
    const handleTransferToPayroll = async (commId, sellerName, amount) => {
        setTransferringId(commId);
        try {
            const res = await axios.post('/api/egg-industrial/commissions/transfer-to-payroll', {
                commission_id: commId
            });
            toast.success(res.data?.message || `Comisión de $${amount} transferida a Planilla RH con éxito.`);
            loadAll();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error al transferir comisión a planilla.');
        } finally {
            setTransferringId(null);
        }
    };

    const monthsNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    return (
        <div className="space-y-6">
            {/* Barra de Filtros y Acciones */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">Período:</span>
                        <select
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value))}
                            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500"
                        >
                            {monthsNames.map((m, idx) => (
                                <option key={idx + 1} value={idx + 1}>
                                    {m}
                                </option>
                            ))}
                        </select>
                        <input
                            type="number"
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            className="w-20 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500 text-center"
                        />
                    </div>

                    <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                        <span className="text-xs font-bold text-slate-500 uppercase">Quincena de Pago:</span>
                        <select
                            value={quincena}
                            onChange={(e) => setQuincena(e.target.value)}
                            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500"
                        >
                            <option value="segunda">2da Quincena (Fin de Mes - Recomendado)</option>
                            <option value="primera">1ra Quincena</option>
                            <option value="mensual">Mensual Completo</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={handleCalculateCommissions}
                        disabled={calculating}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${calculating ? 'animate-spin' : ''}`} />
                        <span>Calcular Comisiones del Mes</span>
                    </button>
                </div>
            </div>

            {/* SECCIÓN 1: RESUMEN Y LIQUIDACIÓN HACIA PLANILLA */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                            <Award className="w-4 h-4 text-indigo-600" />
                            <span>Liquidación de Comisiones con Tope ($1,000) & Envío a Planilla</span>
                        </h3>
                        <p className="text-xs text-slate-500">
                            Cálculo de libras entregadas vs. meta mensual, aplicación del tope de $1,000.00 e integración a Recursos Humanos.
                        </p>
                    </div>

                    <span className="text-[10px] font-black bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1 rounded-full uppercase flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-amber-700" />
                        <span>Tope Máximo Rígido: $1,000.00 / vendedor</span>
                    </span>
                </div>

                {summary.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                        <Target className="w-8 h-8 text-slate-400 mx-auto" />
                        <p className="text-xs font-bold text-slate-700">No hay comisiones calculadas para este período.</p>
                        <p className="text-[11px] text-slate-500">
                            Haga clic en <strong>"Calcular Comisiones del Mes"</strong> para procesar las entregas reales.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead>
                                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase">
                                    <th className="p-3">Vendedor / Empleado Nómina</th>
                                    <th className="p-3 text-right">Meta (lb)</th>
                                    <th className="p-3 text-right">Despachado Real (lb)</th>
                                    <th className="p-3 text-right">Venta Total</th>
                                    <th className="p-3 text-right">Comisión Pura</th>
                                    <th className="p-3 text-right bg-indigo-50/50">Comisión Tope ($1K)</th>
                                    <th className="p-3 text-center">Estado Planilla</th>
                                    <th className="p-3 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                {summary.map((row) => {
                                    const isCapped = Boolean(row.is_capped);
                                    const isTransferred = row.status === 'transferido_planilla';
                                    const hasEmployee = Boolean(row.employee_id);

                                    return (
                                        <tr key={row.id} className="hover:bg-slate-50">
                                            <td className="p-3">
                                                <div className="font-bold text-slate-900">{row.seller_name}</div>
                                                {hasEmployee ? (
                                                    <div className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1">
                                                        <UserCheck className="w-3 h-3" />
                                                        <span>{row.empleado_nombre_completo} ({row.empleado_codigo})</span>
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                                                        <AlertCircle className="w-3 h-3" />
                                                        <span>Sin empleado de nómina vinculado</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3 text-right font-mono text-slate-600">
                                                {Number(row.target_volume_lbs || 60000).toLocaleString()} lb
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold text-indigo-700">
                                                {Number(row.total_lbs_delivered || 0).toLocaleString()} lb
                                            </td>
                                            <td className="p-3 text-right font-mono">
                                                <Money value={row.total_sales_amount} />
                                            </td>
                                            <td className="p-3 text-right font-mono text-slate-400">
                                                <Money value={row.raw_commission_amount} />
                                            </td>
                                            <td className="p-3 text-right font-mono font-black text-indigo-900 bg-indigo-50/50">
                                                <Money value={row.capped_commission_amount} />
                                                {isCapped && (
                                                    <span className="block text-[9px] text-amber-700 font-black">
                                                        CORTADO AL TOPE
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                {isTransferred ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        <span>En Planilla RH</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                        <Clock className="w-3 h-3" />
                                                        <span>Pendiente de Envío</span>
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleTransferToPayroll(row.id, row.seller_name, row.capped_commission_amount)}
                                                    disabled={!hasEmployee || transferringId === row.id || isTransferred}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 mx-auto ${
                                                        isTransferred
                                                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                                            : !hasEmployee
                                                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                                                    }`}
                                                    title={!hasEmployee ? 'Debe vincular un empleado de nómina primero' : 'Sumar comisión a la cuenta 07 en Planilla RH'}
                                                >
                                                    <Send className="w-3 h-3" />
                                                    <span>{isTransferred ? 'Sincronizado' : 'Sumar a Planilla'}</span>
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

            {/* SECCIÓN 2: VINCULACIÓN MULTI-EMPLEADO & ASIGNACIÓN DE METAS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* VINCULACIÓN VENDEDOR -> EMPLEADO DE PLANILLA */}
                <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                <Link2 className="w-4 h-4 text-indigo-600" />
                                <span>Vinculación de Vendedores con Planilla</span>
                            </h4>
                            <span className="text-[10px] text-slate-500 font-medium">sellers ↔ rh_empleados</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsCreateModalOpen(true)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shadow-indigo-600/20 active:scale-95 self-start sm:self-auto"
                        >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>+ Crear / Asignar Vendedor</span>
                        </button>
                    </div>

                    <p className="text-[11px] text-slate-500">
                        Solo el personal registrado como vendedor de Huevo Industrial aparece en esta lista y podrá acumular comisiones hacia su recibo de sueldo.
                    </p>

                    <div className="space-y-2.5">
                        {sellers.length === 0 ? (
                            <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                                <Users className="w-8 h-8 text-slate-300 mx-auto" />
                                <p className="text-xs font-bold text-slate-700">No hay vendedores asignados a Huevo Industrial.</p>
                                <p className="text-[11px] text-slate-500">
                                    Haga clic en <strong>"+ Crear / Asignar Vendedor"</strong> para registrar al personal de ventas.
                                </p>
                            </div>
                        ) : (
                            sellers.map((s) => (
                                <div key={s.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-all">
                                    <div>
                                        <span className="font-bold text-xs text-slate-900 block">{s.nombre}</span>
                                        <span className="text-[10px] text-slate-400">ID Vendedor #{s.id}</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <select
                                            value={s.employee_id || ''}
                                            onChange={(e) => handleLinkEmployee(s.id, e.target.value)}
                                            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-indigo-500"
                                        >
                                            <option value="">-- Sin Empleado Vinculado --</option>
                                            {employees.map((emp) => (
                                                <option key={emp.id} value={emp.id}>
                                                    {emp.codigo} - {emp.nombres} {emp.apellidos}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveSeller(s.id, s.nombre)}
                                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                            title="Quitar de Vendedores de Huevo Industrial"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* METAS COMERCIALES MENSUALES */}
                <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                            <Target className="w-4 h-4 text-indigo-600" />
                            <span>Metas Asignadas para {monthsNames[month - 1]} {year}</span>
                        </h4>
                    </div>

                    <p className="text-[11px] text-slate-500">
                        Configure la cuota mensual en libras, el precio piso y la tarifa de comisión por vendedor.
                    </p>

                    <div className="space-y-2.5">
                        {sellers.length === 0 ? (
                            <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                                <Target className="w-8 h-8 text-slate-300 mx-auto" />
                                <p className="text-xs font-bold text-slate-700">No hay metas configuradas.</p>
                                <p className="text-[11px] text-slate-500">
                                    Cree o asigne un vendedor para fijar su cuota mensual.
                                </p>
                            </div>
                        ) : (
                            sellers.map((s) => {
                            const goal = goals.find(g => g.seller_id === s.id);
                            return (
                                <div key={s.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                                    <div>
                                        <span className="font-bold text-xs text-slate-900 block">{s.nombre}</span>
                                        <span className="text-[10px] text-slate-500 font-mono">
                                            Meta: {Number(goal?.target_volume_lbs || 60000).toLocaleString()} lb @ {(parseFloat(goal?.commission_rate_per_lb || 0.0150) * 100).toFixed(2)} ¢/lb
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingGoal({
                                                seller_id: s.id,
                                                target_volume_lbs: goal?.target_volume_lbs || 60000,
                                                target_min_price_lb: goal?.target_min_price_lb || 1.25,
                                                target_amount_usd: goal?.target_amount_usd || 75000,
                                                commission_rate_per_lb: goal?.commission_rate_per_lb || 0.0150,
                                                commission_cap_usd: goal?.commission_cap_usd || 1000.00,
                                                notes: goal?.notes || ''
                                            });
                                            setIsGoalModalOpen(true);
                                        }}
                                        className="px-3 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-all shadow-2xs"
                                    >
                                        Editar Meta
                                    </button>
                                </div>
                            );
                        }))}
                    </div>
                </div>
            </div>

            {/* MODAL PARA CONFIGURAR META DEL VENDEDOR */}
            {isGoalModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <h3 className="text-sm font-black text-slate-900 uppercase flex items-center gap-2">
                                <Target className="w-4 h-4 text-indigo-600" />
                                <span>Fijar Meta Comercial ({monthsNames[month - 1]} {year})</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsGoalModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveGoal} className="space-y-3.5 text-xs">
                            <div>
                                <label className="font-bold text-slate-600 uppercase text-[10px] block mb-1">
                                    Meta Mensual en Libras (lb):
                                </label>
                                <input
                                    type="number"
                                    step="1000"
                                    value={editingGoal.target_volume_lbs}
                                    onChange={(e) => setEditingGoal({ ...editingGoal, target_volume_lbs: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold font-mono text-slate-800 focus:ring-1 focus:ring-indigo-500"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-slate-600 uppercase text-[10px] block mb-1">
                                        Precio Piso ($/lb):
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editingGoal.target_min_price_lb}
                                        onChange={(e) => setEditingGoal({ ...editingGoal, target_min_price_lb: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold font-mono text-slate-800 focus:ring-1 focus:ring-indigo-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-slate-600 uppercase text-[10px] block mb-1">
                                        Tarifa Comisión ($/lb):
                                    </label>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        value={editingGoal.commission_rate_per_lb}
                                        onChange={(e) => setEditingGoal({ ...editingGoal, commission_rate_per_lb: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold font-mono text-slate-800 focus:ring-1 focus:ring-indigo-500"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                                <label className="font-black text-amber-900 uppercase text-[10px] block">
                                    Tope Máximo de Comisión ($):
                                </label>
                                <input
                                    type="number"
                                    step="10"
                                    value={editingGoal.commission_cap_usd}
                                    onChange={(e) => setEditingGoal({ ...editingGoal, commission_cap_usd: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg font-black font-mono text-amber-950 focus:ring-1 focus:ring-amber-500 text-xs"
                                    required
                                />
                                <span className="text-[10px] text-amber-700 block">
                                    Límite no superable estipulado por política empresarial: $1,000.00
                                </span>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsGoalModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm"
                                >
                                    Guardar Meta
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL PARA CREAR O ASIGNAR VENDEDOR DE HUEVO INDUSTRIAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <form onSubmit={handleCreateSeller} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 text-xs">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <h3 className="text-sm font-black text-slate-900 uppercase flex items-center gap-2">
                                <UserPlus className="w-4 h-4 text-indigo-600" />
                                <span>Crear / Asignar Vendedor de Huevo Industrial</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Selector de modo */}
                        <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
                            <button
                                type="button"
                                onClick={() => setCreateForm({ ...createForm, mode: 'from_employee' })}
                                className={`py-1.5 px-2 rounded-lg font-bold text-[11px] transition-all ${
                                    createForm.mode === 'from_employee'
                                        ? 'bg-white text-indigo-700 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Desde Empleado Nómina
                            </button>
                            <button
                                type="button"
                                onClick={() => setCreateForm({ ...createForm, mode: 'from_seller' })}
                                className={`py-1.5 px-2 rounded-lg font-bold text-[11px] transition-all ${
                                    createForm.mode === 'from_seller'
                                        ? 'bg-white text-indigo-700 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Vendedor Existente POS
                            </button>
                        </div>

                        {createForm.mode === 'from_employee' ? (
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                    Seleccionar Empleado de Nómina
                                </label>
                                <select
                                    value={createForm.employee_id}
                                    onChange={(e) => {
                                        const empId = e.target.value;
                                        const emp = employees.find(x => x.id === parseInt(empId));
                                        setCreateForm({
                                            ...createForm,
                                            employee_id: empId,
                                            nombre: emp ? `${emp.nombres} ${emp.apellidos}`.trim() : ''
                                        });
                                    }}
                                    required
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="">-- Seleccionar Empleado --</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.codigo} - {emp.nombres} {emp.apellidos}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                    Seleccionar Vendedor del Sistema
                                </label>
                                <select
                                    value={createForm.seller_id}
                                    onChange={(e) => setCreateForm({ ...createForm, seller_id: e.target.value })}
                                    required
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="">-- Seleccionar Vendedor --</option>
                                    {otherSellers.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.nombre} (ID #{s.id})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 pt-1">
                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                    Meta Mensual (Libras)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    step="1000"
                                    value={createForm.target_volume_lbs}
                                    onChange={(e) => setCreateForm({ ...createForm, target_volume_lbs: e.target.value })}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-800"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                    Tarifa Comisión ($/lb)
                                </label>
                                <input
                                    type="number"
                                    min="0.0001"
                                    step="0.001"
                                    value={createForm.commission_rate_per_lb}
                                    onChange={(e) => setCreateForm({ ...createForm, commission_rate_per_lb: e.target.value })}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-800"
                                />
                            </div>
                        </div>

                        <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-amber-900 text-[11px] flex items-center justify-between">
                            <span>Tope Máximo Reglamentario:</span>
                            <strong className="font-black text-amber-950">$1,000.00 / mes</strong>
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={savingCreate}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50"
                            >
                                {savingCreate ? 'Guardando...' : 'Crear Vendedor'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
