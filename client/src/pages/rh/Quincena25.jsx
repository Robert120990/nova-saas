import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { 
    Sparkles, 
    Calculator, 
    Save, 
    Lock, 
    Unlock, 
    Trash2, 
    FileText, 
    ReceiptText, 
    Download, 
    FileSpreadsheet, 
    ShieldCheck, 
    AlertTriangle, 
    CheckCircle2, 
    Clock, 
    Search,
    Eye
} from 'lucide-react';

import Money, { MoneyInput } from '../../components/ui/Money';
import PlanillaReportModal from '../../components/rh/PlanillaReportModal';
import { useConfirm } from '../../context/ConfirmContext';

const yearNow = new Date().getFullYear();
// A partir de 2027 es obligatorio, pero permitimos 2026 en adelante
const defaultYear = yearNow >= 2027 ? yearNow : 2027;
const availableYears = [2026, 2027, 2028, 2029, 2030, 2031];

const Quincena25 = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();

    // Filtros principales
    const [selectedYear, setSelectedYear] = useState(defaultYear);
    const [selectedDepto, setSelectedDepto] = useState('all');
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [tabActiva, setTabActiva] = useState('gestion'); // 'gestion' | 'historial'

    // Datos calculados / en edición
    const [itemsCalculados, setItemsCalculados] = useState(null);
    const [isCalculating, setIsCalculating] = useState(false);

    // Modal de Reportes (Planilla y Recibos PDF)
    const [previewPeriodo, setPreviewPeriodo] = useState(null);

    // 1. Obtener Departamentos y Sucursales para los filtros
    const { data: deptosResp = { data: [] } } = useQuery({
        queryKey: ['rh-departamentos-all'],
        queryFn: async () => (await axios.get('/api/rh/departamentos', { params: { limit: 5000 } })).data
    });
    const departamentos = deptosResp.data || [];

    const { data: branchesResp = [] } = useQuery({
        queryKey: ['branches-all'],
        queryFn: async () => {
            const res = await axios.get('/api/branches');
            return Array.isArray(res.data) ? res.data : (res.data?.data || []);
        }
    });
    const branches = Array.isArray(branchesResp) ? branchesResp : [];

    // 2. Obtener Historial de Resumen por Año
    const { data: resumen = [], isLoading: isLoadingResumen } = useQuery({
        queryKey: ['rh-quincena25-resumen'],
        queryFn: async () => (await axios.get('/api/rh/planilla-quincena25/resumen')).data
    });

    // 3. Obtener Planilla Guardada para el Año Seleccionado
    const { data: planillaGuardada = [], isLoading: isLoadingPlanilla } = useQuery({
        queryKey: ['rh-quincena25-periodo', selectedYear, selectedDepto, selectedBranch],
        queryFn: async () => {
            const params = { año: selectedYear };
            if (selectedDepto !== 'all') params.departamento_id = selectedDepto;
            if (selectedBranch !== 'all') params.branch_id = selectedBranch;
            const res = await axios.get('/api/rh/planilla-quincena25', { params });
            return res.data || [];
        }
    });

    // Si ya existe planilla guardada y no estamos en modo simulación manual, usamos los datos guardados
    const itemsActuales = useMemo(() => {
        if (itemsCalculados !== null) return itemsCalculados;
        return planillaGuardada;
    }, [itemsCalculados, planillaGuardada]);

    // Estado del período actual
    const estadoPeriodo = useMemo(() => {
        if (!planillaGuardada.length) return 'no_generada';
        return planillaGuardada[0]?.estado || 'borrador';
    }, [planillaGuardada]);

    const esPagada = estadoPeriodo === 'pagada';
    const fechaPago = planillaGuardada[0]?.fecha_pago;

    // Métricas para las tarjetas de resumen
    const metricas = useMemo(() => {
        const list = itemsActuales || [];
        const total = list.reduce((s, r) => s + parseFloat(r.monto_recibir || 0), 0);
        const elegibles = list.filter(r => parseFloat(r.sueldo_base || 0) <= 1500.00);
        const excluidos = list.filter(r => parseFloat(r.sueldo_base || 0) > 1500.00);
        const conPago = list.filter(r => parseFloat(r.monto_recibir || 0) > 0);
        const proporcionales = list.filter(r => r.es_proporcional && parseFloat(r.monto_recibir || 0) > 0);

        return {
            totalMonto: total,
            totalEmpleados: list.length,
            totalElegibles: elegibles.length,
            totalExcluidos: excluidos.length,
            totalConPago: conPago.length,
            totalProporcionales: proporcionales.length
        };
    }, [itemsActuales]);

    // Items filtrados por búsqueda de texto
    const filteredItems = useMemo(() => {
        if (!searchTerm.trim()) return itemsActuales;
        const q = searchTerm.toLowerCase().trim();
        return itemsActuales.filter(r => 
            (r.codigo || '').toLowerCase().includes(q) ||
            (r.nombres || '').toLowerCase().includes(q) ||
            (r.apellidos || '').toLowerCase().includes(q) ||
            (r.cargo_nombre || '').toLowerCase().includes(q) ||
            (r.departamento_nombre || '').toLowerCase().includes(q)
        );
    }, [itemsActuales, searchTerm]);

    // Mutación: Calcular automáticamente
    const handleCalcular = async () => {
        setIsCalculating(true);
        try {
            const params = { año: selectedYear };
            if (selectedDepto !== 'all') params.departamento_id = selectedDepto;
            if (selectedBranch !== 'all') params.branch_id = selectedBranch;
            const res = await axios.get('/api/rh/planilla-quincena25/calcular', { params });
            setItemsCalculados(res.data || []);
            toast.success(`Cálculo de Quincena 25 para ${selectedYear} generado con éxito`);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al calcular Quincena 25');
        } finally {
            setIsCalculating(false);
        }
    };

    // Mutación: Guardar Planilla
    const saveMutation = useMutation({
        mutationFn: (data) => axios.post('/api/rh/planilla-quincena25', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rh-quincena25-periodo'] });
            queryClient.invalidateQueries({ queryKey: ['rh-quincena25-resumen'] });
            setItemsCalculados(null);
            toast.success('Planilla 25 guardada exitosamente');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar planilla')
    });

    const handleGuardar = () => {
        if (!itemsActuales.length) return toast.error('No hay registros para guardar');
        saveMutation.mutate({
            año: selectedYear,
            items: itemsActuales,
            filtro_departamento_id: selectedDepto !== 'all' ? parseInt(selectedDepto) : null,
            estado: estadoPeriodo === 'pagada' ? 'pagada' : 'borrador'
        });
    };

    // Mutación: Cerrar Período (Marcar Pagada)
    const cerrarMutation = useMutation({
        mutationFn: (año) => axios.post('/api/rh/planilla-quincena25/cerrar-periodo', { año }),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['rh-quincena25-periodo'] });
            queryClient.invalidateQueries({ queryKey: ['rh-quincena25-resumen'] });
            toast.success(res.data.message);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al cerrar período')
    });

    const handleCerrarPeriodo = async () => {
        const ok = await confirm({
            title: '¿Cerrar y marcar como pagada la Planilla 25?',
            message: `Se marcará como pagada la Quincena 25 del ejercicio fiscal ${selectedYear}. Esta acción consolidará el período y registrará la fecha de dispersión. ¿Desea continuar?`,
            confirmLabel: 'Sí, cerrar período',
            variant: 'primary'
        });
        if (ok) cerrarMutation.mutate(selectedYear);
    };

    // Mutación: Reabrir Período
    const reabrirMutation = useMutation({
        mutationFn: (año) => axios.post('/api/rh/planilla-quincena25/reabrir-periodo', { año }),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['rh-quincena25-periodo'] });
            queryClient.invalidateQueries({ queryKey: ['rh-quincena25-resumen'] });
            toast.success(res.data.message);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al reabrir período')
    });

    const handleReabrirPeriodo = async () => {
        const ok = await confirm({
            title: '¿Reabrir período a borrador?',
            message: `El período ${selectedYear} volverá al estado borrador para permitir modificaciones. ¿Confirmar?`,
            confirmLabel: 'Sí, reabrir',
            variant: 'warning'
        });
        if (ok) reabrirMutation.mutate(selectedYear);
    };

    // Mutación: Eliminar Período
    const deleteMutation = useMutation({
        mutationFn: ({ año, departamento_id }) => {
            const params = { año };
            if (departamento_id && departamento_id !== 'all') params.departamento_id = departamento_id;
            return axios.delete('/api/rh/planilla-quincena25/periodo', { params });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rh-quincena25-periodo'] });
            queryClient.invalidateQueries({ queryKey: ['rh-quincena25-resumen'] });
            setItemsCalculados(null);
            toast.success('Registros eliminados con éxito');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar período')
    });

    const handleEliminarPeriodo = async () => {
        const ok = await confirm({
            title: '¿Eliminar registros de Quincena 25?',
            message: `Se eliminarán los registros calculados para el ejercicio ${selectedYear}. Esta acción no se puede deshacer. ¿Desea continuar?`,
            confirmLabel: 'Sí, eliminar',
            variant: 'danger'
        });
        if (ok) deleteMutation.mutate({ año: selectedYear, departamento_id: selectedDepto });
    };

    // Edición en caliente de ajustes y observaciones
    const handleUpdateItem = (empId, field, val) => {
        if (esPagada) return;
        const updater = (prevList) => prevList.map(item => {
            if (item.empleado_id !== empId) return item;
            const updated = { ...item, [field]: val };
            if (field === 'ajuste') {
                const montoQ25 = parseFloat(updated.monto_quincena25 || 0);
                const adj = parseFloat(val || 0);
                updated.monto_recibir = Math.round((montoQ25 + adj) * 100) / 100;
            }
            return updated;
        });

        if (itemsCalculados !== null) {
            setItemsCalculados(updater);
        } else {
            setItemsCalculados(updater(planillaGuardada));
        }
    };

    // Descarga de archivos bancarios
    const handleDownloadBanco = async (formato = 'ambos') => {
        try {
            const params = { año: selectedYear, formatoBancario: formato };
            if (selectedDepto !== 'all') params.departamento_id = selectedDepto;
            if (selectedBranch !== 'all') params.branch_id = selectedBranch;
            const res = await axios.get('/api/rh/planilla-quincena25/export-banco', { params });
            const data = res.data;

            const triggerFile = (content, filename, mime) => {
                const blob = new Blob([content], { type: mime });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => window.URL.revokeObjectURL(url), 1000);
            };

            if (formato === 'csv' || formato === 'ambos') {
                triggerFile(data.csv, `${data.filename}.csv`, 'text/csv;charset=utf-8');
            }
            if (formato === 'txt' || formato === 'ambos') {
                setTimeout(() => {
                    triggerFile(data.txt, `${data.filename}.txt`, 'text/plain;charset=utf-8');
                }, 200);
            }
            toast.success('Archivo(s) bancario(s) descargado(s) exitosamente');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al exportar archivo bancario');
        }
    };

    // Descarga de Anexo F-14 para Hacienda
    const handleDownloadHaciendaF14 = async () => {
        try {
            const res = await axios.get('/api/rh/planilla-quincena25/export-hacienda', {
                params: { año: selectedYear },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = `ANEXO_F14_QUINCENA25_${selectedYear}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => window.URL.revokeObjectURL(url), 1000);
            toast.success('Anexo F-14 de Quincena 25 descargado');
        } catch (error) {
            toast.error('Error al generar Anexo F-14 para Hacienda');
        }
    };

    return (
        <div className="space-y-6 pb-12 animate-fadeIn text-slate-800">
            {/* Header Principal */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
                        <Sparkles size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">Quincena 25 (Planilla 25)</h1>
                            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                Decreto Legislativo Nº 499
                            </span>
                            {selectedYear >= 2027 ? (
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                    Obligatorio 2027
                                </span>
                            ) : (
                                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                    Incentivo Fiscal 2026
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Prestación económica extraordinaria anual del 50 % de salario mensual para empleados con sueldo nominal $\le \$1,500.00$.
                        </p>
                    </div>
                </div>

                {/* Switch de Vistas */}
                <div className="flex items-center gap-2 self-start md:self-auto bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setTabActiva('gestion')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            tabActiva === 'gestion'
                                ? 'bg-white text-indigo-700 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Gestión Actual
                    </button>
                    <button
                        onClick={() => setTabActiva('historial')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            tabActiva === 'historial'
                                ? 'bg-white text-indigo-700 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Historial Anual
                    </button>
                </div>
            </div>

            {/* Vista 1: Gestión Actual */}
            {tabActiva === 'gestion' && (
                <>
                    {/* Barra de Filtros y Control de Período */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
                            {/* Selector de Año */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Ejercicio Fiscal
                                </label>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => {
                                        setSelectedYear(parseInt(e.target.value));
                                        setItemsCalculados(null);
                                    }}
                                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {availableYears.map(yr => (
                                        <option key={yr} value={yr}>
                                            {yr} {yr >= 2027 ? '(Obligatorio)' : '(Voluntario)'}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Selector de Departamento */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Departamento
                                </label>
                                <select
                                    value={selectedDepto}
                                    onChange={(e) => {
                                        setSelectedDepto(e.target.value);
                                        setItemsCalculados(null);
                                    }}
                                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="all">Todos los Departamentos</option>
                                    {departamentos.map(d => (
                                        <option key={d.id} value={d.id}>{d.descripcion}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Selector de Sucursal */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Sucursal
                                </label>
                                <select
                                    value={selectedBranch}
                                    onChange={(e) => {
                                        setSelectedBranch(e.target.value);
                                        setItemsCalculados(null);
                                    }}
                                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="all">Todas las Sucursales</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Botón de Cálculo / Simulación */}
                        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                            <button
                                onClick={handleCalcular}
                                disabled={isCalculating || esPagada}
                                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md ${
                                    esPagada
                                        ? 'bg-slate-400 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25'
                                }`}
                            >
                                <Calculator size={15} />
                                {isCalculating ? 'Calculando...' : 'Calcular Quincena 25'}
                            </button>
                        </div>
                    </div>

                    {/* Tarjetas de Métricas Resumen */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Tarjeta 1: Total Planilla */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total a Dispersar</p>
                                <h3 className="text-xl font-black text-indigo-700 mt-1">
                                    <Money value={metricas.totalMonto} />
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    {metricas.totalConPago} empleados con pago
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <Sparkles size={20} />
                            </div>
                        </div>

                        {/* Tarjeta 2: Elegibles */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Elegibles ($\le \$1,500$)</p>
                                <h3 className="text-xl font-black text-emerald-700 mt-1">
                                    {metricas.totalElegibles} <span className="text-xs font-medium text-slate-500">/ {metricas.totalEmpleados}</span>
                                </h3>
                                <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                                    {metricas.totalProporcionales} proporcionales (&lt;1 año)
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <ShieldCheck size={20} />
                            </div>
                        </div>

                        {/* Tarjeta 3: Excluidos por Ley */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Excluidos ($&gt; \$1,500$)</p>
                                <h3 className="text-xl font-black text-amber-600 mt-1">
                                    {metricas.totalExcluidos}
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Techo salarial según Art. 1 D.L. 499
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                <AlertTriangle size={20} />
                            </div>
                        </div>

                        {/* Tarjeta 4: Estado del Período */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Estado Período</p>
                                <div className="mt-1 flex items-center gap-2">
                                    {esPagada ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                                            <CheckCircle2 size={13} />
                                            Pagada
                                        </span>
                                    ) : itemsActuales.length > 0 ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200">
                                            <Clock size={13} />
                                            Borrador
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200">
                                            Sin calcular
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    {fechaPago ? `Pagada el ${fechaPago}` : 'Pago: 15-25 enero'}
                                </p>
                            </div>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                esPagada ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
                            }`}>
                                {esPagada ? <Lock size={20} /> : <Unlock size={20} />}
                            </div>
                        </div>
                    </div>

                    {/* Toolbar de Acciones (Guardar, Cerrar, PDFs, Exportaciones) */}
                    <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-2">
                        {/* Buscador de Empleado */}
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                            <input
                                type="text"
                                placeholder="Buscar por código, nombre..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        {/* Botones de Operación */}
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                            {/* Guardar Planilla */}
                            {itemsActuales.length > 0 && !esPagada && (
                                <button
                                    onClick={handleGuardar}
                                    disabled={saveMutation.isPending}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 transition-all"
                                >
                                    <Save size={14} />
                                    Guardar Planilla
                                </button>
                            )}

                            {/* Cerrar Período */}
                            {itemsActuales.length > 0 && !esPagada && (
                                <button
                                    onClick={handleCerrarPeriodo}
                                    disabled={cerrarMutation.isPending}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-900 text-white shadow-sm transition-all"
                                >
                                    <Lock size={14} />
                                    Cerrar Período
                                </button>
                            )}

                            {/* Reabrir Período */}
                            {esPagada && (
                                <button
                                    onClick={handleReabrirPeriodo}
                                    disabled={reabrirMutation.isPending}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all"
                                >
                                    <Unlock size={14} />
                                    Reabrir Período
                                </button>
                            )}

                            {/* Ver Planilla Oficial PDF */}
                            {itemsActuales.length > 0 && (
                                <button
                                    onClick={() => setPreviewPeriodo({
                                        anio: selectedYear,
                                        tipo: 'quincena25',
                                        departamento_id: selectedDepto,
                                        departamento_nombre: departamentos.find(d => String(d.id) === String(selectedDepto))?.descripcion,
                                        branch_id: selectedBranch
                                    })}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all"
                                >
                                    <FileText size={14} />
                                    Planilla PDF
                                </button>
                            )}

                            {/* Ver Recibos de Pago PDF */}
                            {itemsActuales.length > 0 && (
                                <button
                                    onClick={() => setPreviewPeriodo({
                                        anio: selectedYear,
                                        tipo: 'quincena25-recibos',
                                        departamento_id: selectedDepto,
                                        departamento_nombre: departamentos.find(d => String(d.id) === String(selectedDepto))?.descripcion,
                                        branch_id: selectedBranch
                                    })}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-all"
                                >
                                    <ReceiptText size={14} />
                                    Recibos PDF
                                </button>
                            )}

                            {/* Exportar Banco */}
                            {itemsActuales.length > 0 && (
                                <button
                                    onClick={() => handleDownloadBanco('ambos')}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-all"
                                >
                                    <Download size={14} />
                                    Banco (CSV/TXT)
                                </button>
                            )}

                            {/* Exportar Anexo F-14 Hacienda */}
                            {itemsActuales.length > 0 && (
                                <button
                                    onClick={handleDownloadHaciendaF14}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all"
                                    title="Descargar Anexo F-14 para Ministerio de Hacienda (MH.UVI.DGII/006.001/2026)"
                                >
                                    <FileSpreadsheet size={14} />
                                    Anexo F-14 MH
                                </button>
                            )}

                            {/* Eliminar Período */}
                            {itemsActuales.length > 0 && !esPagada && (
                                <button
                                    onClick={handleEliminarPeriodo}
                                    disabled={deleteMutation.isPending}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-xl text-red-600 hover:bg-red-50 border border-red-200 transition-all"
                                    title="Eliminar registros calculados"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tabla de Detalle de Nómina */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-700 border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                                    <tr>
                                        <th className="py-3 px-3 w-12 text-center">Nº</th>
                                        <th className="py-3 px-3 w-20">Código</th>
                                        <th className="py-3 px-3">Empleado</th>
                                        <th className="py-3 px-3">Cargo / Depto</th>
                                        <th className="py-3 px-3 text-right">Sueldo Base</th>
                                        <th className="py-3 px-3 text-center">Antigüedad</th>
                                        <th className="py-3 px-3 text-center">Condición</th>
                                        <th className="py-3 px-3 text-right">Monto Q25</th>
                                        <th className="py-3 px-3 text-right w-24">Ajuste</th>
                                        <th className="py-3 px-3 text-right font-black text-indigo-900">Total Pagar</th>
                                        <th className="py-3 px-3 w-40">Observaciones</th>
                                        <th className="py-3 px-3 text-center w-16">Recibo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {isLoadingPlanilla ? (
                                        <tr>
                                            <td colSpan="12" className="py-12 text-center text-slate-400">
                                                Cargando registros de Quincena 25...
                                            </td>
                                        </tr>
                                    ) : filteredItems.length === 0 ? (
                                        <tr>
                                            <td colSpan="12" className="py-12 text-center text-slate-400">
                                                No hay registros para este período. Haz clic en "Calcular Quincena 25" para generar la nómina.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredItems.map((item, idx) => {
                                            const sueldo = parseFloat(item.sueldo_base || 0);
                                            const esExcluido = sueldo > 1500.00;
                                            const montoQ25 = parseFloat(item.monto_quincena25 || 0);
                                            const netoRecibir = parseFloat(item.monto_recibir || 0);

                                            return (
                                                <tr 
                                                    key={item.empleado_id || idx}
                                                    className={`hover:bg-slate-50/80 transition-colors ${
                                                        esExcluido ? 'bg-slate-50/50 opacity-75' : ''
                                                    }`}
                                                >
                                                    <td className="py-3 px-3 text-center text-slate-400 font-medium">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="py-3 px-3 font-bold text-slate-800">
                                                        {item.codigo}
                                                    </td>
                                                    <td className="py-3 px-3 font-semibold text-slate-900">
                                                        {item.nombres} {item.apellidos}
                                                    </td>
                                                    <td className="py-3 px-3 text-slate-600">
                                                        <div className="truncate max-w-[150px] font-medium">
                                                            {item.cargo_nombre || 'GENERAL'}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                                            {item.departamento_nombre || 'GENERAL'}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-bold text-slate-800">
                                                        <Money value={sueldo} />
                                                    </td>
                                                    <td className="py-3 px-3 text-center text-slate-600 font-medium text-[11px]">
                                                        {item.dias_laborados_anio || 0} días
                                                    </td>
                                                    <td className="py-3 px-3 text-center">
                                                        {esExcluido ? (
                                                            <span className="inline-block px-2 py-0.5 text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-full">
                                                                Excluido (&gt; $1,500)
                                                            </span>
                                                        ) : item.es_proporcional ? (
                                                            <span className="inline-block px-2 py-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full">
                                                                Proporcional
                                                            </span>
                                                        ) : (
                                                            <span className="inline-block px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full">
                                                                100% de Ley
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-medium text-slate-700">
                                                        <Money value={montoQ25} />
                                                    </td>
                                                    <td className="py-3 px-3 text-right">
                                                        {esPagada || esExcluido ? (
                                                            <Money value={parseFloat(item.ajuste || 0)} />
                                                        ) : (
                                                            <MoneyInput
                                                                value={item.ajuste ?? 0}
                                                                onChange={(e) => handleUpdateItem(item.empleado_id, 'ajuste', e.target.value)}
                                                                className="w-20 text-right px-1.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-black text-indigo-700 text-sm">
                                                        <Money value={netoRecibir} />
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        {esPagada || esExcluido ? (
                                                            <span className="text-[11px] text-slate-500 truncate block max-w-[150px]">
                                                                {item.observaciones || '—'}
                                                            </span>
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={item.observaciones || ''}
                                                                onChange={(e) => handleUpdateItem(item.empleado_id, 'observaciones', e.target.value)}
                                                                placeholder="Notas..."
                                                                className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3 text-center">
                                                        {!esExcluido && netoRecibir > 0 && (
                                                            <button
                                                                onClick={() => setPreviewPeriodo({
                                                                    anio: selectedYear,
                                                                    tipo: 'quincena25-recibos',
                                                                    empleado_id: item.empleado_id
                                                                })}
                                                                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                                                title="Ver recibo de pago de este empleado"
                                                            >
                                                                <Eye size={15} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Vista 2: Historial Anual */}
            {tabActiva === 'historial' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-6 space-y-4">
                    <div>
                        <h3 className="text-base font-bold text-slate-900">Historial Consolidado de Quincena 25</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Registro histórico de emisiones anuales de la Planilla 25 y totales dispersados.
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                                <tr>
                                    <th className="py-3 px-4">Ejercicio Fiscal</th>
                                    <th className="py-3 px-4">Departamento</th>
                                    <th className="py-3 px-4 text-center">Total Empleados</th>
                                    <th className="py-3 px-4 text-center">Beneficiarios</th>
                                    <th className="py-3 px-4 text-right">Monto Dispersado</th>
                                    <th className="py-3 px-4 text-center">Estado</th>
                                    <th className="py-3 px-4 text-center">Fecha Pago</th>
                                    <th className="py-3 px-4 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoadingResumen ? (
                                    <tr>
                                        <td colSpan="8" className="py-8 text-center text-slate-400">
                                            Cargando historial...
                                        </td>
                                    </tr>
                                ) : resumen.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="py-8 text-center text-slate-400">
                                            No hay registros históricos de Quincena 25.
                                        </td>
                                    </tr>
                                ) : (
                                    resumen.map((r, i) => (
                                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-4 font-black text-slate-900">
                                                {r.periodo_anio}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 font-medium">
                                                {r.departamento_nombre || 'Todos'}
                                            </td>
                                            <td className="py-3 px-4 text-center font-semibold text-slate-800">
                                                {r.total_empleados}
                                            </td>
                                            <td className="py-3 px-4 text-center font-semibold text-emerald-700">
                                                {r.total_beneficiarios}
                                            </td>
                                            <td className="py-3 px-4 text-right font-black text-indigo-700">
                                                <Money value={r.total_monto} />
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {r.estado === 'pagada' ? (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                                                        Pagada
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200">
                                                        Borrador
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-center text-slate-500 font-medium">
                                                {r.fecha_pago ? new Date(r.fecha_pago).toLocaleDateString('es-SV') : '—'}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <button
                                                    onClick={() => {
                                                        setSelectedYear(r.periodo_anio);
                                                        if (r.filtro_departamento_id) setSelectedDepto(r.filtro_departamento_id);
                                                        setTabActiva('gestion');
                                                    }}
                                                    className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                                                >
                                                    Abrir
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal de Reporte (Planilla y Recibos PDF) */}
            <PlanillaReportModal
                isOpen={!!previewPeriodo}
                onClose={() => setPreviewPeriodo(null)}
                periodo={previewPeriodo}
            />
        </div>
    );
};

export default Quincena25;
