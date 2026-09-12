import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { useConfirm } from '../../context/ConfirmContext';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Search, Users, Umbrella, Loader2, User, Calendar, ShieldCheck, CheckCircle2, AlertCircle, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import Money, { MoneyInput } from '../../components/ui/Money';
import EmployeeSearchModal from '../../components/rh/EmployeeSearchModal';

const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px] font-medium";
const labelCls = "block text-[11px] font-bold text-slate-500 uppercase mb-1";
const roCls = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-medium text-slate-700";

const yearNow = new Date().getFullYear();
const monthNow = new Date().getMonth() + 1;

const years = Array.from({ length: 10 }, (_, i) => yearNow - 5 + i);
const months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
];

const Vacaciones = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const employeeInputRef = useRef(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAño, setFilterAño] = useState(yearNow);
    const [filterMes, setFilterMes] = useState('');
    const [page, setPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Employee search modal
    const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);

    // Elegibles modal state
    const [isElegiblesModalOpen, setIsElegiblesModalOpen] = useState(false);
    const [elegiblesAño, setElegiblesAño] = useState(yearNow);
    const [elegiblesMes, setElegiblesMes] = useState(monthNow);
    const [incluirPendientes, setIncluirPendientes] = useState(false);

    // Form state
    const [empleadoId, setEmpleadoId] = useState('');
    const [empleadoData, setEmpleadoData] = useState(null);
    const [periodoAño, setPeriodoAño] = useState(yearNow);
    const [periodoMes, setPeriodoMes] = useState(monthNow);
    const [quincena, setQuincena] = useState('primera');
    // Service period dates (from last vacation or hire date, to today)
    const [fechaInicial, setFechaInicial] = useState('');
    const [fechaFinal, setFechaFinal] = useState('');
    const [diasTranscurridos, setDiasTranscurridos] = useState(0);
    const [vacacionesMonto, setVacacionesMonto] = useState(0);
    // Whether the employee qualifies for vacation (>= 365 days of service)
    const [aplicaVacacion, setAplicaVacacion] = useState(false);
    const [diasServicio, setDiasServicio] = useState(0); // total service days in period

    // Calculated
    const [calculo, setCalculo] = useState(null);
    const [calculando, setCalculando] = useState(false);

    // Employee code input
    const [codigoInput, setCodigoInput] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => { setDebouncedSearch(searchTerm); setPage(1); }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // F3 shortcut
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F3') {
                e.preventDefault();
                if (isModalOpen) {
                    setIsEmpModalOpen(true);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isModalOpen]);

    const { data: response = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['rh-planilla-vacaciones', debouncedSearch, page, filterAño, filterMes],
        queryFn: async () => (await axios.get('/api/rh/planilla-vacaciones', {
            params: { search: debouncedSearch, page, año: filterAño, mes: filterMes || undefined }
        })).data
    });

    const items = response.data || [];

    // Query for employees eligible for vacation
    const { data: elegiblesResponse = { data: [], total: 0 }, isLoading: isLoadingElegibles } = useQuery({
        queryKey: ['rh-vacaciones-elegibles', elegiblesAño, elegiblesMes, incluirPendientes],
        queryFn: async () => (await axios.get('/api/rh/planilla-vacaciones/elegibles', {
            params: { año: elegiblesAño, mes: elegiblesMes, incluir_pendientes: incluirPendientes }
        })).data,
        enabled: isElegiblesModalOpen
    });

    const elegiblesList = elegiblesResponse.data || [];
    const totalEstimadoPagar = elegiblesList.reduce((acc, curr) => acc + (parseFloat(curr.vacaciones_monto_estimado) || 0), 0);

    // Calculate service days and qualification whenever period dates change
    useEffect(() => {
        if (fechaInicial && fechaFinal) {
            const d1 = new Date(fechaInicial + 'T00:00:00');
            const d2 = new Date(fechaFinal + 'T00:00:00');
            const diff = Math.max(0, Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
            setDiasTranscurridos(diff);
            setDiasServicio(diff);
            // Art. 177 C.Tr.: right to vacation after 1 year (>= 365 days) of continuous service
            setAplicaVacacion(diff >= 365);
        } else {
            setDiasTranscurridos(0);
            setDiasServicio(0);
            setAplicaVacacion(false);
        }
    }, [fechaInicial, fechaFinal]);

    // Auto-calculate vacation amount: ALWAYS 15 fixed days + 30% surcharge (Art. 177 C.Tr.)
    // Only triggers when the service period qualifies (>= 365 days)
    useEffect(() => {
        if (selected) return; // preserve stored values when editing
        if (empleadoData?.sueldo_base && aplicaVacacion) {
            const sueldoDiario = parseFloat(empleadoData.sueldo_base) / 30;
            // Vacation pay is always 15 calendar days, independent of diasTranscurridos
            const montoBase = sueldoDiario * 15;
            const total = montoBase * 1.30;
            setVacacionesMonto(Math.round(total * 100) / 100);
        } else if (!selected) {
            setVacacionesMonto(0);
            setCalculo(null);
        }
    }, [empleadoData?.sueldo_base, aplicaVacacion, selected]);

    // Calculate deductions only when period qualifies and amount is set
    useEffect(() => {
        if (empleadoId && vacacionesMonto > 0 && aplicaVacacion) {
            const timer = setTimeout(async () => {
                setCalculando(true);
                try {
                    const res = await axios.get('/api/rh/planilla-vacaciones/calcular', {
                        params: { empleado_id: empleadoId, monto: vacacionesMonto, quincena }
                    });
                    setCalculo(res.data);
                } catch {
                    setCalculo(null);
                } finally {
                    setCalculando(false);
                }
            }, 400);
            return () => clearTimeout(timer);
        } else if (!selected) {
            setCalculo(null);
        }
    }, [empleadoId, vacacionesMonto, quincena, aplicaVacacion, selected]);

    const handleFechaInicialChange = (val) => {
        setFechaInicial(val);
        // When user manually changes the initial date, update final to today if empty
        if (val && !fechaFinal) {
            setFechaFinal(new Date().toISOString().substring(0, 10));
        }
    };

    // Fetch employee data by code
    const handleCodigoSearch = async () => {
        if (!codigoInput.trim()) return;
        try {
            const res = await axios.get('/api/rh/empleados', { params: { search: codigoInput.trim(), limit: 1, solo_activos: 1 } });
            const emp = res.data.data?.[0];
            if (emp) {
                await loadEmpleado(emp.id);
            } else {
                toast.error('Empleado no encontrado');
            }
        } catch {
            toast.error('Error al buscar empleado');
        }
    };

    const loadEmpleado = async (id, customFechaInicio = null, customFechaFin = null) => {
        try {
            const res = await axios.get(`/api/rh/planilla-vacaciones/empleado/${id}`);
            const emp = res.data;
            setEmpleadoData(emp);
            setEmpleadoId(id);
            setCodigoInput(emp.codigo);
            setCalculo(null);
            setVacacionesMonto(0);
            setAplicaVacacion(false);

            if (customFechaInicio && customFechaFin) {
                setFechaInicial(customFechaInicio);
                setFechaFinal(customFechaFin);
                return;
            }

            // Determine period start: last vacation's fecha_final + 1 day, or employee hire date
            const today = new Date().toISOString().substring(0, 10);
            let periodoInicio = '';

            try {
                const ultRes = await axios.get(`/api/rh/planilla-vacaciones/ultima/${id}`);
                const ultima = ultRes.data;
                if (ultima?.fecha_final) {
                    // Start the new period the day after the last vacation ended
                    const d = new Date(ultima.fecha_final + 'T00:00:00');
                    d.setDate(d.getDate() + 1);
                    periodoInicio = d.toISOString().substring(0, 10);
                }
            } catch (err) {
                console.warn('No se pudo obtener la última vacación:', err);
            }

            // Fallback to hire date if no previous vacation found
            if (!periodoInicio && emp.fecha_ingreso) {
                const hireStr = typeof emp.fecha_ingreso === 'string'
                    ? emp.fecha_ingreso.substring(0, 10)
                    : new Date(emp.fecha_ingreso).toISOString().substring(0, 10);

                const dIng = new Date(hireStr + 'T00:00:00');
                const dToday = new Date();
                const totalDias = Math.floor((dToday - dIng) / (1000 * 60 * 60 * 24));

                // If more than 365 days, compute from hire date but of the previous year
                if (totalDias >= 365) {
                    const añoAnt = dToday.getFullYear() - 1;
                    const parts = hireStr.split('-');
                    if (parts.length === 3) {
                        periodoInicio = `${añoAnt}-${parts[1]}-${parts[2]}`;
                    } else {
                        periodoInicio = hireStr;
                    }
                } else {
                    periodoInicio = hireStr;
                }
            }

            setFechaInicial(periodoInicio);
            setFechaFinal(today);
        } catch {
            toast.error('Error al cargar datos del empleado');
        }
    };

    const handleSelectEmployee = (emp) => {
        loadEmpleado(emp.id);
        setIsEmpModalOpen(false);
    };

    const handleRegistrarDesdeElegible = async (elegible) => {
        setIsElegiblesModalOpen(false);
        resetForm();
        setPeriodoAño(elegiblesAño);
        setPeriodoMes(elegiblesMes);
        setIsModalOpen(true);
        await loadEmpleado(elegible.empleado_id, elegible.fecha_inicio_periodo, elegible.fecha_fin_periodo);
    };

    const mutation = useMutation({
        mutationFn: (data) => {
            if (selected) return axios.put(`/api/rh/planilla-vacaciones/${selected.id}`, data);
            return axios.post('/api/rh/planilla-vacaciones', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rh-planilla-vacaciones'] });
            queryClient.invalidateQueries({ queryKey: ['rh-vacaciones-elegibles'] });
            setIsModalOpen(false);
            resetForm();
            toast.success(selected ? 'Planilla actualizada' : 'Planilla creada');
        },
        onError: (error) => { toast.error(error.response?.data?.message || 'Error al guardar'); }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/rh/planilla-vacaciones/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rh-planilla-vacaciones'] });
            queryClient.invalidateQueries({ queryKey: ['rh-vacaciones-elegibles'] });
            toast.success('Planilla eliminada');
        },
        onError: (error) => { toast.error(error.response?.data?.message || 'Error al eliminar'); }
    });

    const handleDownloadPDF = async (id) => {
        try {
            const res = await axios.get(`/api/rh/planilla-vacaciones/${id}/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Vacacion_${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('PDF descargado');
        } catch { toast.error('Error al descargar PDF'); }
    };

    const resetForm = () => {
        setSelected(null);
        setEmpleadoId('');
        setEmpleadoData(null);
        setCodigoInput('');
        setPeriodoAño(yearNow);
        setPeriodoMes(monthNow);
        setQuincena('primera');
        setFechaInicial('');
        setFechaFinal('');
        setDiasTranscurridos(0);
        setDiasServicio(0);
        setVacacionesMonto(0);
        setAplicaVacacion(false);
        setCalculo(null);
    };

    const handleEdit = (item) => {
        setSelected(item);
        setEmpleadoId(item.empleado_id);
        setPeriodoAño(item.periodo_año);
        setPeriodoMes(item.periodo_mes);
        setQuincena(item.quincena);
        setFechaInicial(item.fecha_inicial ? item.fecha_inicial.substring(0, 10) : '');
        setFechaFinal(item.fecha_final ? item.fecha_final.substring(0, 10) : '');
        setDiasTranscurridos(item.dias_transcurridos);
        setVacacionesMonto(parseFloat(item.vacaciones_monto));
        setCodigoInput(item.empleado_codigo || '');
        setEmpleadoData({
            id: item.empleado_id,
            codigo: item.empleado_codigo,
            nombres: item.empleado_nombres,
            apellidos: item.empleado_apellidos,
            sueldo_base: item.sueldo_base,
            cargo_nombre: item.cargo_nombre,
            departamento_nombre: item.departamento_nombre
        });
        setCalculo({
            vacaciones_monto: parseFloat(item.vacaciones_monto),
            descuento_isss: parseFloat(item.descuento_isss),
            descuento_afp: parseFloat(item.descuento_afp),
            descuento_renta: parseFloat(item.descuento_renta),
            isss_info: item.isss_info ? (typeof item.isss_info === 'string' ? JSON.parse(item.isss_info) : item.isss_info) : null,
            afp_info: item.afp_info ? (typeof item.afp_info === 'string' ? JSON.parse(item.afp_info) : item.afp_info) : null,
            renta_info: item.renta_info ? (typeof item.renta_info === 'string' ? JSON.parse(item.renta_info) : item.renta_info) : null,
            total_devengado: parseFloat(item.total_devengado),
            total_deducciones: parseFloat(item.total_deducciones),
            monto_recibir: parseFloat(item.monto_recibir)
        });
        // Editing an existing record: it already qualified when created
        setAplicaVacacion(true);
        setDiasServicio(item.dias_transcurridos || 0);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        const ok = await confirm({ title: '¿Eliminar planilla?', message: 'Esta planilla será eliminada permanentemente.', confirmLabel: 'Sí, eliminar', variant: 'danger' });
        if (ok) deleteMutation.mutate(id);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!empleadoId) return toast.error('Seleccione un empleado');
        if (!fechaInicial || !fechaFinal) return toast.error('Ingrese las fechas del período de servicio');
        if (!selected && !aplicaVacacion) return toast.error(`El empleado no ha cumplido 1 año (${diasServicio} días). Aún no aplica vacación.`);

        mutation.mutate({
            empleado_id: empleadoId,
            periodo_año: periodoAño,
            periodo_mes: periodoMes,
            quincena,
            fecha_inicial: fechaInicial,
            fecha_final: fechaFinal,
            dias_transcurridos: diasTranscurridos || 15,
            vacaciones_monto: parseFloat(vacacionesMonto) || 0,
            descuento_isss: calculo?.descuento_isss || 0,
            descuento_afp: calculo?.descuento_afp || 0,
            descuento_renta: calculo?.descuento_renta || 0,
            total_devengado: parseFloat(vacacionesMonto) || 0,
            total_deducciones: calculo?.total_deducciones || 0,
            monto_recibir: calculo?.monto_recibir || Math.max(0, (parseFloat(vacacionesMonto) || 0) - (calculo?.total_deducciones || 0))
        });
    };

    // Financial metrics breakdown
    const sueldo = parseFloat(empleadoData?.sueldo_base || 0);
    const diasVac = diasTranscurridos > 0 ? diasTranscurridos : 15;
    const sueldoDiario = sueldo / 30;
    const salarioBaseVacaciones = Math.round((sueldoDiario * diasVac) * 100) / 100;
    const recargoLey = Math.round((salarioBaseVacaciones * 0.30) * 100) / 100;

    const totalDevengado = parseFloat(vacacionesMonto || 0);
    const totalDeducciones = parseFloat(calculo?.total_deducciones || 0);
    const montoRecibir = calculo?.monto_recibir !== undefined
        ? parseFloat(calculo.monto_recibir)
        : Math.max(0, totalDevengado - totalDeducciones);

    return (
        <div className="space-y-3 text-slate-900">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Planilla de Vacaciones</h2>
                    <p className="text-slate-500 text-[11px] font-medium">Gestión de vacaciones de ley (15 días + 30% de recargo Art. 177 C.Tr.) y deducciones</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setElegiblesAño(filterAño || yearNow);
                            setElegiblesMes(filterMes ? parseInt(filterMes) : monthNow);
                            setIsElegiblesModalOpen(true);
                        }}
                        className="flex items-center gap-2 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 hover:border-indigo-300 px-3.5 py-2 rounded-xl font-bold text-sm transition-all shadow-sm active:scale-95 cursor-pointer"
                        title="Consultar empleados con derecho a vacación en este mes"
                    >
                        <ShieldCheck size={18} className="text-indigo-600" />
                        <span>Consultar Elegibles</span>
                    </button>
                    <button onClick={() => { resetForm(); setIsModalOpen(true); }}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95 cursor-pointer">
                        <Plus size={18} /><span>Nueva Planilla</span>
                    </button>
                </div>
            </div>

            <div className="flex gap-3 items-end flex-wrap">
                <div className="relative max-w-sm flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input type="text" placeholder="Buscar empleado..." value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-medium shadow-sm" />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Año</label>
                    <select value={filterAño} onChange={e => { setFilterAño(parseInt(e.target.value)); setPage(1); }}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/10">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Mes</label>
                    <select value={filterMes} onChange={e => { setFilterMes(e.target.value); setPage(1); }}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/10">
                        <option value="">Todos</option>
                        {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table headers={['Periodo', 'Quincena', 'Empleado', 'Vacaciones', 'Devengado', 'Deducciones', 'Líquido', 'Acciones']}
                    data={items} isLoading={isLoading}
                    renderRow={(item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-3 py-2">
                                <span className="text-xs font-bold text-slate-700">{months.find(m => m.value === item.periodo_mes)?.label} {item.periodo_año}</span>
                            </td>
                            <td className="px-3 py-2">
                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded capitalize">
                                    {item.quincena} quincena
                                </span>
                            </td>
                            <td className="px-3 py-2">
                                <div className="text-xs font-bold text-slate-900">{item.empleado_nombres} {item.empleado_apellidos}</div>
                                <div className="text-[10px] font-mono text-slate-400">{item.empleado_codigo}</div>
                            </td>
                            <td className="px-3 py-2 text-xs font-bold text-slate-700 tabular-nums">
                                <Money value={item.vacaciones_monto} />
                            </td>
                            <td className="px-3 py-2 text-xs font-bold text-slate-800 tabular-nums">
                                <Money value={item.total_devengado} />
                            </td>
                            <td className="px-3 py-2 text-xs text-rose-600 font-bold tabular-nums">
                                <Money value={item.total_deducciones} />
                            </td>
                            <td className="px-3 py-2 text-xs font-black text-emerald-600 tabular-nums">
                                <Money value={item.monto_recibir} />
                            </td>
                            <td className="px-3 py-2 flex gap-1">
                                <button onClick={() => handleEdit(item)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar"><Edit size={15} /></button>
                                <button onClick={() => handleDownloadPDF(item.id)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Descargar PDF"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></button>
                                <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={15} /></button>
                            </td>
                        </tr>
                    )} />
            </div>

            <Pagination currentPage={page} totalPages={response.totalPages} totalItems={response.total}
                onPageChange={setPage} itemsOnPage={items.length} isLoading={isLoading} />

            {/* --- Creation/Edit Modal --- */}
            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }}
                title={selected ? 'Editar Planilla de Vacaciones' : 'Nueva Planilla de Vacaciones'}
                maxWidth="max-w-6xl" maxHeight="sm:max-h-[92vh]" height="sm:h-[88vh]" bodyClassName="px-4 sm:px-6 py-4">
                <form onSubmit={handleSubmit} className="pb-2">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                        {/* Columna Izquierda: Formulario, Período y Deducciones Fijas */}
                        <div className="lg:col-span-7 min-w-0 space-y-3">
                            {/* Metadata Row */}
                            <div className="grid grid-cols-12 gap-3">
                                <div className="col-span-4 sm:col-span-3">
                                    <label className={labelCls}>Año</label>
                                    <select value={periodoAño} onChange={e => setPeriodoAño(parseInt(e.target.value))} className={fieldCls}>
                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-4 sm:col-span-4">
                                    <label className={labelCls}>Mes</label>
                                    <select value={periodoMes} onChange={e => setPeriodoMes(parseInt(e.target.value))} className={fieldCls}>
                                        {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-4 sm:col-span-5">
                                    <label className={labelCls}>Quincena</label>
                                    <select value={quincena} onChange={e => setQuincena(e.target.value)} className={fieldCls}>
                                        <option value="primera">Primera Quincena</option>
                                        <option value="segunda">Segunda Quincena</option>
                                    </select>
                                </div>
                                <div className="col-span-12">
                                    <label className={labelCls}>Código Empleado <span className="text-[9px] text-indigo-500 font-normal lowercase">(F3 para buscar)</span></label>
                                    <div className="flex gap-2">
                                        <input ref={employeeInputRef} type="text" value={codigoInput}
                                            onChange={e => setCodigoInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCodigoSearch(); } }}
                                            placeholder="Ingrese código de colaborador (Ej: EMP-001)"
                                            className="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm font-mono" />
                                        <button type="button" onClick={handleCodigoSearch} title="Buscar por código"
                                            className="px-3.5 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 text-xs font-semibold">
                                            <Search size={15} />
                                            <span className="hidden sm:inline">Buscar</span>
                                        </button>
                                        <button type="button" onClick={() => setIsEmpModalOpen(true)} title="Catálogo de empleados (F3)"
                                            className="px-3.5 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 text-xs font-bold shadow-sm shadow-indigo-600/20">
                                            <Users size={15} />
                                            <span>Catálogo F3</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Empleado Banner */}
                            {empleadoData ? (
                                <div className="flex items-center gap-3 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                        <User size={16} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="font-bold text-slate-800 text-[13px] truncate">{empleadoData.nombres} {empleadoData.apellidos}</div>
                                        <div className="text-[11px] text-slate-500 flex items-center gap-2 truncate">
                                            <span>{empleadoData.cargo_nombre || 'Sin cargo'}</span>
                                            <span>•</span>
                                            <span>{empleadoData.departamento_nombre || 'Sin departamento'}</span>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 border-l border-slate-200 pl-3">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Sueldo Base</span>
                                        <Money value={sueldo} className="font-bold text-indigo-600 text-sm" />
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex items-center gap-2.5 text-xs text-amber-800">
                                    <AlertCircle size={16} className="text-amber-600 shrink-0" />
                                    <span>Presione <strong>F3</strong> o ingrese el código para seleccionar al colaborador a liquidar vacaciones.</span>
                                </div>
                            )}

                            {/* Eligibility Status Banner */}
                            {empleadoData && (
                                aplicaVacacion ? (
                                    <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 text-xs text-emerald-800">
                                        <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <span className="font-bold">Aplica vacación — </span>
                                            <span>{diasServicio} días de servicio ({Math.floor(diasServicio / 365)} año{Math.floor(diasServicio / 365) !== 1 ? 's' : ''} y {diasServicio % 365} días). Se calcularán 15 días + 30% recargo (Art. 177 C.Tr.).</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 text-xs text-rose-800">
                                        <AlertCircle size={15} className="text-rose-600 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <span className="font-bold">No aplica aún — </span>
                                            <span>
                                                {diasServicio > 0
                                                    ? `${diasServicio} días de servicio. Faltan ${365 - diasServicio} días para completar 1 año (Art. 177 C.Tr.).`
                                                    : 'Seleccione el período de servicio para evaluar.'}
                                            </span>
                                        </div>
                                    </div>
                                )
                            )}

                            {/* Tarjeta de Período de Servicio */}
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="bg-slate-50/90 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <Umbrella size={13} className="text-indigo-600 shrink-0" />
                                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                                            Período de Servicio Cotizable
                                        </span>
                                    </div>
                                    {sueldo > 0 && (
                                        <span className="text-[9px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-medium">
                                            Salario Diario: <Money value={sueldoDiario} />
                                        </span>
                                    )}
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-[11px]">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 uppercase text-[9px] font-bold tracking-wider">
                                                <th className="text-left py-1 px-3 font-bold">Inicio Servicio</th>
                                                <th className="text-left py-1 px-2 font-bold">Fin Servicio</th>
                                                <th className="text-center py-1 px-2 font-bold">Días Serv.</th>
                                                <th className="text-right py-1 px-3 font-bold">Monto Vac. (15d + 30%)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="hover:bg-slate-50/60 transition-colors">
                                                <td className="py-1.5 px-3">
                                                    <input
                                                        type="date"
                                                        value={fechaInicial}
                                                        onChange={e => handleFechaInicialChange(e.target.value)}
                                                        className="h-7 w-[125px] px-2 text-[11px] bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 transition-colors"
                                                    />
                                                </td>
                                                <td className="py-1.5 px-2">
                                                    <input
                                                        type="date"
                                                        value={fechaFinal}
                                                        onChange={e => setFechaFinal(e.target.value)}
                                                        className="h-7 w-[125px] px-2 text-[11px] bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 transition-colors"
                                                    />
                                                </td>
                                                <td className="py-1.5 px-2 text-center">
                                                    <span className={`inline-block h-7 px-2.5 py-1 text-[11px] font-bold rounded tabular-nums ${aplicaVacacion ? 'text-emerald-700 bg-emerald-50/80 border border-emerald-200' : 'text-slate-600 bg-slate-100 border border-slate-200'}`}>
                                                        {diasTranscurridos > 0 ? `${diasTranscurridos} días` : '—'}
                                                    </span>
                                                </td>
                                                <td className="py-1.5 px-3 text-right">
                                                    <MoneyInput
                                                        value={vacacionesMonto || ''}
                                                        onChange={e => setVacacionesMonto(parseFloat(e.target.value) || 0)}
                                                        className="h-7 w-28 px-2 text-[12px] bg-white border border-slate-200 rounded text-right font-black text-indigo-600 focus:ring-1 focus:ring-indigo-500 outline-none tabular-nums"
                                                        placeholder="0.00"
                                                    />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Desglose rápido informativo de la fórmula legal */}
                                {sueldo > 0 && (
                                    <div className="bg-slate-50/60 px-3 py-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 flex-wrap gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-slate-600">Base 15 días:</span>
                                            <Money value={salarioBaseVacaciones} className="font-bold text-slate-700" />
                                            <span className="text-slate-300">•</span>
                                            <span className="font-semibold text-slate-600">+30% Recargo:</span>
                                            <Money value={recargoLey} className="font-bold text-slate-700" />
                                        </div>
                                        <span className="text-slate-400 italic">Art. 177 Código de Trabajo</span>
                                    </div>
                                )}
                            </div>

                            {/* RECUADRO DE DEDUCCIONES FIJO */}
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck size={14} className="text-indigo-600" />
                                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                            DEDUCCIONES DE LEY Y RETENCIONES
                                        </span>
                                    </div>
                                    <div>
                                        {calculando ? (
                                            <span className="inline-flex items-center gap-1.5 text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md font-bold animate-pulse">
                                                <Loader2 size={11} className="animate-spin" /> Calculando retenciones...
                                            </span>
                                        ) : vacacionesMonto > 0 && calculo ? (
                                            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
                                                Retenciones calculadas
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-medium">
                                                Sin retenciones
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="p-3.5 space-y-3">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-[11px]">
                                            <thead>
                                                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[9px] font-bold tracking-wider">
                                                    <th className="text-left py-1.5 font-bold">Concepto</th>
                                                    <th className="text-right py-1.5 font-bold">Base Gravada</th>
                                                    <th className="text-right py-1.5 font-bold">Tasa</th>
                                                    <th className="text-right py-1.5 font-bold">Tope / Tramo</th>
                                                    <th className="text-right py-1.5 font-bold">Descuento</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {/* ISSS */}
                                                <tr className="hover:bg-slate-50/70 transition-colors">
                                                    <td className="py-2 text-slate-700 font-semibold flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                                                        <span>ISSS (Salud)</span>
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-600">
                                                        <Money value={vacacionesMonto > 0 && calculo ? vacacionesMonto : 0} />
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {calculo?.isss_info?.porcentaje ? `${calculo.isss_info.porcentaje}%` : (vacacionesMonto > 0 ? '3.00%' : '-')}
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {calculo?.isss_info?.tope ? `$${calculo.isss_info.tope.toFixed(2)}` : (vacacionesMonto > 0 ? '$500.00' : '-')}
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums font-bold text-rose-600">
                                                        <Money value={calculo?.descuento_isss || 0} />
                                                    </td>
                                                </tr>

                                                {/* AFP */}
                                                <tr className="hover:bg-slate-50/70 transition-colors">
                                                    <td className="py-2 text-slate-700 font-semibold flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                                                        <span>AFP {calculo?.afp_info?.nombre ? `(${calculo.afp_info.nombre})` : ''}</span>
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-600">
                                                        <Money value={vacacionesMonto > 0 && calculo ? vacacionesMonto : 0} />
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {calculo?.afp_info?.porcentaje ? `${calculo.afp_info.porcentaje}%` : (vacacionesMonto > 0 ? '7.25%' : '-')}
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {calculo?.afp_info?.tope ? `$${calculo.afp_info.tope.toFixed(2)}` : (vacacionesMonto > 0 ? '$3,188.56' : '-')}
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums font-bold text-rose-600">
                                                        <Money value={calculo?.descuento_afp || 0} />
                                                    </td>
                                                </tr>

                                                {/* Renta */}
                                                <tr className="hover:bg-slate-50/70 transition-colors">
                                                    <td className="py-2 text-slate-700 font-semibold flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                                                        <span>Impuesto sobre la Renta</span>
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-600">
                                                        <Money value={calculo?.renta_info?.ingreso_gravado || Math.max(0, vacacionesMonto - (calculo?.descuento_isss || 0) - (calculo?.descuento_afp || 0))} />
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {calculo?.renta_info?.porcentaje !== undefined ? `${calculo.renta_info.porcentaje}%` : (vacacionesMonto > 0 ? 'Según tramo' : '-')}
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {calculo?.renta_info?.valor_descuento !== undefined ? `+$${parseFloat(calculo.renta_info.valor_descuento).toFixed(2)}` : '-'}
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums font-bold text-rose-600">
                                                        <Money value={calculo?.descuento_renta || 0} />
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Totales dentro del recuadro */}
                                    <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs bg-slate-50/80 -mx-3.5 -mb-3.5 px-3.5 py-2.5">
                                        <span className="text-[10px] text-slate-400 leading-tight max-w-[280px]">
                                            * Por ley, el descanso vacacional está gravado con deducciones de ISSS, AFP y Renta.
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-slate-500 uppercase">Total Descuentos:</span>
                                            <Money value={totalDeducciones} className="font-black text-rose-600 text-sm" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Columna Derecha: Tarjeta Ejecutiva del Monto a Recibir */}
                        <div className="lg:col-span-5 min-w-0 lg:sticky lg:top-2 space-y-4">
                            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-2xl border border-slate-800 space-y-4 relative overflow-hidden">
                                {/* Ambient decorative glows */}
                                <div className="absolute -right-10 -top-10 w-36 h-36 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
                                <div className="absolute -left-10 -bottom-10 w-36 h-36 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

                                {/* Header de la tarjeta */}
                                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 relative z-10">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
                                            <Wallet size={15} />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold tracking-wider uppercase text-slate-200">
                                                Resumen de Vacaciones
                                            </h4>
                                            <span className="text-[10px] text-indigo-300 font-medium capitalize">
                                                {quincena} quincena • {months.find(m => m.value === periodoMes)?.label} {periodoAño}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Hero Net Amount to Pay */}
                                <div className="bg-slate-800/50 backdrop-blur-sm p-4 rounded-xl border border-slate-700/60 relative z-10">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
                                        Total Líquido a Pagar
                                    </span>
                                    <div className="flex items-baseline gap-2">
                                        <Money value={montoRecibir} className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight" />
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-1 block">
                                        Pago neto a transferir o pagar al colaborador
                                    </span>
                                </div>

                                {/* Side-by-side metric boxes */}
                                <div className="grid grid-cols-2 gap-3 relative z-10">
                                    <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                                            <TrendingUp size={12} className="text-emerald-400" />
                                            <span>Devengado (+)</span>
                                        </div>
                                        <Money value={totalDevengado} className="text-base sm:text-lg font-bold text-white block" />
                                        <span className="text-[9px] text-slate-500">Salario + Recargo 30%</span>
                                    </div>

                                    <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                                            <TrendingDown size={12} className="text-rose-400" />
                                            <span>Deducciones (-)</span>
                                        </div>
                                        <Money value={totalDeducciones} className="text-base sm:text-lg font-bold text-rose-400 block" />
                                        <span className="text-[9px] text-slate-500">ISSS, AFP y Renta</span>
                                    </div>
                                </div>

                                {/* Breakdown detail lines */}
                                <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/80 space-y-2 text-xs relative z-10 font-mono">
                                    <div className="flex justify-between items-center text-slate-300">
                                        <span className="text-[11px] text-slate-400">Salario Base (15 días):</span>
                                        <Money value={salarioBaseVacaciones} className="font-semibold text-slate-200" />
                                    </div>
                                    <div className="flex justify-between items-center text-slate-300">
                                        <span className="text-[11px] text-slate-400">+ Recargo de Ley (30%):</span>
                                        <Money value={recargoLey} className="font-semibold text-emerald-400" />
                                    </div>
                                    <div className="flex justify-between items-center pt-1.5 border-t border-slate-800 text-slate-200 font-bold">
                                        <span className="text-[11px]">Total Devengado Vacaciones:</span>
                                        <Money value={totalDevengado} className="text-indigo-300" />
                                    </div>
                                    <div className="flex justify-between items-center text-rose-400/90 pt-1 text-[11px]">
                                        <span>- Retención ISSS (3%):</span>
                                        <Money value={calculo?.descuento_isss || 0} />
                                    </div>
                                    <div className="flex justify-between items-center text-rose-400/90 text-[11px]">
                                        <span>- Retención AFP (7.25%):</span>
                                        <Money value={calculo?.descuento_afp || 0} />
                                    </div>
                                    <div className="flex justify-between items-center text-rose-400/90 text-[11px]">
                                        <span>- Retención Impuesto Renta:</span>
                                        <Money value={calculo?.descuento_renta || 0} />
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-2 pt-2 relative z-10">
                                    <button
                                        type="submit"
                                        disabled={mutation.isPending || !empleadoId || vacacionesMonto <= 0}
                                        className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                                    >
                                        {mutation.isPending ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                <span>Guardando planilla...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 size={16} />
                                                <span>{selected ? 'Guardar Cambios' : 'Registrar Planilla de Vacaciones'}</span>
                                            </>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => { setIsModalOpen(false); resetForm(); }}
                                        className="w-full py-1.5 text-slate-400 hover:text-white transition-colors text-xs font-semibold text-center cursor-pointer"
                                    >
                                        Cancelar operación
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* --- Modern Employee Search Modal (F3) --- */}
            <EmployeeSearchModal
                isOpen={isEmpModalOpen}
                onClose={() => setIsEmpModalOpen(false)}
                onSelect={handleSelectEmployee}
            />

            {/* --- Modal de Consulta de Empleados Elegibles --- */}
            <Modal
                isOpen={isElegiblesModalOpen}
                onClose={() => setIsElegiblesModalOpen(false)}
                title="Empleados con Derecho a Vacación"
                maxWidth="max-w-6xl"
            >
                <div className="space-y-4">
                    {/* Header Controls & Filters */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Año de Consulta</label>
                                <select
                                    value={elegiblesAño}
                                    onChange={e => setElegiblesAño(parseInt(e.target.value))}
                                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Mes de Consulta</label>
                                <select
                                    value={elegiblesMes}
                                    onChange={e => setElegiblesMes(parseInt(e.target.value))}
                                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </div>
                            <div className="pt-4 md:pt-3">
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                                    <input
                                        type="checkbox"
                                        checked={incluirPendientes}
                                        onChange={e => setIncluirPendientes(e.target.checked)}
                                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <span>Incluir acumuladas (+365 días de meses anteriores)</span>
                                </label>
                            </div>
                        </div>

                        {/* Summary Metrics */}
                        <div className="flex items-center gap-3 self-end md:self-center">
                            <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-right shadow-sm">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Elegibles</span>
                                <span className="text-base font-black text-indigo-700">{elegiblesList.length}</span>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-right shadow-sm">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Monto Estimado</span>
                                <span className="text-base font-black text-emerald-600 tabular-nums">
                                    <Money value={totalEstimadoPagar} />
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Table of Elegibles */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                                    <tr>
                                        <th className="px-3 py-2.5">Empleado</th>
                                        <th className="px-3 py-2.5">Cargo / Depto</th>
                                        <th className="px-3 py-2.5">Sueldo Base</th>
                                        <th className="px-3 py-2.5">Ingreso / Antigüedad</th>
                                        <th className="px-3 py-2.5">Última Vacación</th>
                                        <th className="px-3 py-2.5">Período de Vacación</th>
                                        <th className="px-3 py-2.5">Monto Estimado</th>
                                        <th className="px-3 py-2.5">Estado</th>
                                        <th className="px-3 py-2.5 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {isLoadingElegibles ? (
                                        <tr>
                                            <td colSpan={9} className="py-12 text-center text-slate-400">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <Loader2 size={24} className="animate-spin text-indigo-600" />
                                                    <span className="text-xs font-medium">Verificando elegibilidad y aniversarios de ley...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : elegiblesList.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-12 text-center">
                                                <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                                                    <Umbrella size={32} className="text-slate-300" />
                                                    <span className="text-sm font-bold text-slate-700">Sin empleados con derecho este mes</span>
                                                    <span className="text-xs text-slate-400 max-w-sm">
                                                        Ningún colaborador activo cumple su ciclo de 365 días en {months.find(m => m.value === elegiblesMes)?.label} {elegiblesAño}.
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        elegiblesList.map((item) => (
                                            <tr key={item.empleado_id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-3 py-2.5">
                                                    <div className="font-bold text-slate-900">{item.nombre_completo}</div>
                                                    <div className="text-[10px] font-mono text-slate-400">{item.empleado_codigo}</div>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="font-semibold text-slate-700">{item.cargo_nombre}</div>
                                                    <div className="text-[10px] text-slate-400">{item.departamento_nombre}</div>
                                                </td>
                                                <td className="px-3 py-2.5 font-bold text-slate-800 tabular-nums">
                                                    <Money value={item.sueldo_base} />
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="font-medium text-slate-700">{item.fecha_ingreso}</div>
                                                    <div className="text-[10px] font-mono text-slate-400">{item.dias_totales_empresa} días en empresa</div>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="font-medium text-slate-700">
                                                        {item.ultima_vacacion_fecha_final ? item.ultima_vacacion_fecha_final : 'Sin registro previo'}
                                                    </div>
                                                    <div className="text-[10px] text-indigo-600 font-medium">
                                                        {item.origen === 'ultima_vacacion' ? 'Desde última vacación' : 'Desde fecha de ingreso'}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="font-semibold text-slate-800 text-[11px]">
                                                        {item.fecha_inicio_periodo} al {item.fecha_fin_periodo}
                                                    </div>
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded mt-0.5">
                                                        {item.dias_servicio} días
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="font-black text-emerald-700 tabular-nums text-xs">
                                                        <Money value={item.vacaciones_monto_estimado} />
                                                    </div>
                                                    <div className="text-[9px] text-slate-400">15 días + 30%</div>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    {item.es_mes_aniversario ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                            Cumple este mes
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                            Pendiente acumulada
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRegistrarDesdeElegible(item)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
                                                    >
                                                        <Plus size={13} />
                                                        <span>Registrar Vacación</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            type="button"
                            onClick={() => setIsElegiblesModalOpen(false)}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                        >
                            Cerrar consulta
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Vacaciones;
