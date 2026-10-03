import { unwrapList, unwrapPagination } from '../../../utils/apiUtils';
import { getTodayString, toDateInput } from '../../../utils/dateUtils';
import { useRhPayrollRequest } from '../../../hooks/useRhPayrollRequest';
import { useBenefitCalculation } from '../../../hooks/useBenefitCalculation';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useDirtyTracker } from '../../../hooks/useDirtyTracker';
import Table from '../../ui/Table';
import Pagination from '../../ui/Pagination';
import { useConfirm } from '../../../context/ConfirmContext';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Search, ShieldCheck } from 'lucide-react';
import Money from '../../ui/Money';
import EmployeeSearchModal from '../../rh/EmployeeSearchModal';

const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px] font-medium";
const labelCls = "block text-[11px] font-bold text-slate-500 uppercase mb-1";
const _roCls = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-medium text-slate-700";

const yearNow = new Date().getFullYear();
const monthNow = new Date().getMonth() + 1;

const years = Array.from({ length: 10 }, (_, i) => yearNow - 5 + i);
const months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
];

import VacacionesModal from './VacacionesModal';
import VacacionesElegiblesModal from './VacacionesElegiblesModal';

const VacacionesScreen = ({ companyId }) => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const headers = { 'x-company-id': companyId };
    const [loadingEmployee, setLoadingEmployee] = useState(false);
    const [employeeError, setEmployeeError] = useState('');
    const savingRef = useRef(false);
    const employeeInputRef = useRef(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const employeeScope = useRhPayrollRequest(JSON.stringify([companyId, isModalOpen, selected?.id]));
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


    const { calculo, setCalculo, calculando, calculationError, calculationReady, retryCalculation } = useBenefitCalculation({
        url: '/api/rh/planilla-vacaciones/calcular', companyId, open: isModalOpen, employeeId: empleadoId,
        params: { empleado_id: empleadoId, monto: vacacionesMonto, quincena },
        enabled: !loadingEmployee && vacacionesMonto > 0 && (aplicaVacacion || !!selected),
        storedKey: selected?.revision || selected?.id,
        preserveSaved: !!selected && Number(vacacionesMonto) === Number(selected.vacaciones_monto) && quincena === selected.quincena,
        savedCalculation: selected ? {
            descuento_isss: Number(selected.descuento_isss), descuento_afp: Number(selected.descuento_afp),
            descuento_renta: Number(selected.descuento_renta), total_deducciones: Number(selected.total_deducciones),
            monto_recibir: Number(selected.monto_recibir)
        } : null
    });
    useDirtyTracker('vacaciones', isModalOpen && !!empleadoId);

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
                if (isModalOpen && !savingRef.current && !loadingEmployee) {
                    setIsEmpModalOpen(true);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isModalOpen]);

    const { data: response = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['rh-planilla-vacaciones', companyId, debouncedSearch, page, filterAño, filterMes],
        queryFn: async ({ signal }) => {
            const result = await axios.get('/api/rh/planilla-vacaciones', {
                params: { search: debouncedSearch, page, año: filterAño, mes: filterMes || undefined }, headers, signal
            });
            return { ...unwrapPagination(result), data: unwrapList(result) };
        },
        enabled: !!companyId,
        staleTime: 0
    });

    const items = unwrapList(response);

    // Query for employees eligible for vacation
    const { data: elegiblesResponse = { data: [], total: 0 }, isLoading: isLoadingElegibles } = useQuery({
        queryKey: ['rh-vacaciones-elegibles', companyId, elegiblesAño, elegiblesMes, incluirPendientes],
        queryFn: async ({ signal }) => unwrapList(await axios.get('/api/rh/planilla-vacaciones/elegibles', {
            params: { año: elegiblesAño, mes: elegiblesMes, incluir_pendientes: incluirPendientes }, headers, signal
        })),
        enabled: isElegiblesModalOpen && !!companyId
    });

    const elegiblesList = unwrapList(elegiblesResponse);
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

    const handleFechaInicialChange = (val) => {
        setFechaInicial(val);
        // When user manually changes the initial date, update final to today if empty
        if (val && !fechaFinal) {
            setFechaFinal(getTodayString());
        }
    };

    // Fetch employee data by code
    const handleCodigoSearch = async () => {
        if (!codigoInput.trim() || savingRef.current) return;
        const request = employeeScope.begin();
        setLoadingEmployee(true);
        setEmployeeError('');
        try {
            const res = await axios.get('/api/rh/empleados', { params: { search: codigoInput.trim(), limit: 1, solo_activos: 1 }, headers, signal: request.signal });
            if (!request.isCurrent()) return;
            const emp = unwrapList(res)[0];
            if (emp) {
                await loadEmpleado(emp.id);
            } else {
                toast.error('Empleado no encontrado');
            }
        } catch (error) {
            if (request.isCurrent()) { setEmployeeError(error.response?.data?.message || 'Error al buscar empleado'); toast.error('Error al buscar empleado'); }
        } finally { if (request.isCurrent()) setLoadingEmployee(false); }
    };

    const loadEmpleado = async (id, customFechaInicio = null, customFechaFin = null) => {
        if (savingRef.current) return;
        if (selected) return toast.error('El empleado de una planilla registrada no puede cambiarse');
        const request = employeeScope.begin();
        setLoadingEmployee(true);
        setEmployeeError('');
        try {
            const [res, ultRes] = await Promise.all([
                axios.get(`/api/rh/planilla-vacaciones/empleado/${id}`, { headers, signal: request.signal }),
                axios.get(`/api/rh/planilla-vacaciones/ultima/${id}`, { headers, signal: request.signal })
            ]);
            if (!request.isCurrent()) return;
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
            const today = getTodayString();
            let periodoInicio = '';

                const ultima = ultRes.data;
                if (ultima?.fecha_final) {
                    // Start the new period the day after the last vacation ended
                    const d = new Date(toDateInput(ultima.fecha_final) + 'T00:00:00');
                    d.setDate(d.getDate() + 1);
                    periodoInicio = getTodayString(d);
                }


            // Fallback to hire date if no previous vacation found
            if (!periodoInicio && emp.fecha_ingreso) {
                const hireStr = toDateInput(emp.fecha_ingreso);

                const dIng = new Date(hireStr + 'T00:00:00');
                const dToday = new Date();
                const totalDias = Math.floor((dToday - dIng) / (1000 * 60 * 60 * 24));

                // If more than 365 days, compute from hire date but of the previous year
                if (totalDias >= 365) {
                    const añoAnt = dToday.getFullYear() - 1;
                    const lastDay = new Date(añoAnt, dIng.getMonth() + 1, 0).getDate();
                    periodoInicio = getTodayString(new Date(añoAnt, dIng.getMonth(), Math.min(dIng.getDate(), lastDay)));
                } else {
                    periodoInicio = hireStr;
                }
            }

            setFechaInicial(periodoInicio);
            setFechaFinal(today);
        } catch (error) {
            if (request.isCurrent()) {
                setEmployeeError(error.response?.data?.message || 'No se pudo cargar el empleado y su historial. Reintente la búsqueda.');
                toast.error('No se pudo cargar el empleado y su historial');
            }
        } finally { if (request.isCurrent()) setLoadingEmployee(false); }
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
        employeeScope.setContext(JSON.stringify([companyId, true, null]));
        await loadEmpleado(elegible.empleado_id, elegible.fecha_inicio_periodo, elegible.fecha_fin_periodo);
    };

    const saveContext = JSON.stringify([companyId, isModalOpen, selected?.id, empleadoId, periodoAño, periodoMes]);
    const saveScope = useRhPayrollRequest(saveContext);
    const mutation = useMutation({
        mutationFn: ({ payload, id, company, request }) => {
            if (!request.isCurrent()) throw new Error('El contexto cambió antes de guardar.');
            const config = { headers: { 'x-company-id': company } };
            return id ? axios.put(`/api/rh/planilla-vacaciones/${id}`, payload, config) : axios.post('/api/rh/planilla-vacaciones', payload, config);
        },
        onSuccess: async (_result, { id, request }) => {
            await queryClient.invalidateQueries({ queryKey: ['rh-planilla-vacaciones', companyId] });
            await queryClient.invalidateQueries({ queryKey: ['rh-vacaciones-elegibles', companyId] });
            if (request.isCurrent()) { setIsModalOpen(false); resetForm(); }
            toast.success(id ? 'Planilla actualizada' : 'Planilla creada');
        },
        onError: (error) => toast.error(error.response?.data?.message || error.message || 'Error al guardar'),
        onSettled: () => { savingRef.current = false; }
    });

    const closeModal = async () => {
        if (savingRef.current) return;
        if (empleadoId && !await confirm({ title: '¿Cerrar el formulario?', message: 'Los datos del formulario que no haya guardado se descartarán. Puede cancelar para continuar editando.', confirmLabel: 'Cerrar formulario', variant: 'danger' })) return;
        employeeScope.cancel();
        setIsModalOpen(false);
        setIsEmpModalOpen(false);
        resetForm();
    };

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/rh/planilla-vacaciones/${id}`, { headers }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rh-planilla-vacaciones'] });
            queryClient.invalidateQueries({ queryKey: ['rh-vacaciones-elegibles'] });
            toast.success('Planilla eliminada');
        },
        onError: (error) => { toast.error(error.response?.data?.message || 'Error al eliminar'); }
    });

    const handleDownloadPDF = async (id) => {
        try {
            const res = await axios.get(`/api/rh/planilla-vacaciones/${id}/pdf`, { responseType: 'blob', headers });
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
        employeeScope.cancel();
        setLoadingEmployee(false);
        setEmployeeError('');
        setIsEmpModalOpen(false);
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
        if (savingRef.current) return;
        employeeScope.cancel();
        setLoadingEmployee(false);
        setEmployeeError('');
        setSelected(item);
        setEmpleadoId(item.empleado_id);
        setPeriodoAño(item.periodo_año);
        setPeriodoMes(item.periodo_mes);
        setQuincena(item.quincena);
        setFechaInicial(toDateInput(item.fecha_inicial));
        setFechaFinal(toDateInput(item.fecha_final));
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
        if (savingRef.current) return;
        if (!empleadoId) return toast.error('Seleccione un empleado');
        if (loadingEmployee || employeeError) return toast.error('Cargue correctamente el empleado y su historial antes de guardar');
        if (!calculationReady) return toast.error(calculationError || 'Espere a que termine el cálculo de las retenciones antes de guardar');
        if (!fechaInicial || !fechaFinal) return toast.error('Ingrese las fechas del período de servicio');
        if (!selected && !aplicaVacacion) return toast.error(`El empleado no ha cumplido 1 año (${diasServicio} días). Aún no aplica vacación.`);

        const payload = {
            expected_revision: selected?.revision,
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
        };
        savingRef.current = true;
        mutation.mutate({ payload, id: selected?.id, company: companyId, request: saveScope.begin() });
    };

    // Financial metrics breakdown
    const sueldo = parseFloat(empleadoData?.sueldo_base || 0);
    const diasVac = 15;
    const sueldoDiario = sueldo / 30;
    const salarioBaseVacaciones = Math.round((sueldoDiario * diasVac) * 100) / 100;
    const recargoLey = Math.round((salarioBaseVacaciones * 0.30) * 100) / 100;

    const totalDevengado = parseFloat(vacacionesMonto || 0);
    const totalDeducciones = parseFloat(calculo?.total_deducciones || 0);
    const montoRecibir = calculo?.monto_recibir !== undefined
        ? parseFloat(calculo.monto_recibir)
        : Math.max(0, totalDevengado - totalDeducciones);

    const model = { aplicaVacacion, calculando, calculationError, calculationReady, calculo, closeModal, codigoInput, diasServicio, diasTranscurridos, elegiblesAño, elegiblesList, elegiblesMes, empleadoData, empleadoId, employeeError, employeeInputRef, fechaFinal, fechaInicial, fieldCls, handleCodigoSearch, handleFechaInicialChange, handleRegistrarDesdeElegible, handleSubmit, incluirPendientes, isElegiblesModalOpen, isLoadingElegibles, isModalOpen, labelCls, loadingEmployee, months, montoRecibir, mutation, periodoAño, periodoMes, quincena, recargoLey, retryCalculation, salarioBaseVacaciones, selected, setCodigoInput, setElegiblesAño, setElegiblesMes, setFechaFinal, setIncluirPendientes, setIsElegiblesModalOpen, setIsEmpModalOpen, setPeriodoAño, setPeriodoMes, setQuincena, setVacacionesMonto, sueldo, sueldoDiario, totalDeducciones, totalDevengado, totalEstimadoPagar, vacacionesMonto, years };

    return (
        <div className="space-y-3 text-slate-900">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Planilla de Vacaciones</h2>
                    <p className="text-slate-500 text-[11px] font-medium">Gestión de vacaciones de ley (15 días + 30% de recargo Art. 177 C.Tr.) y deducciones</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                        {(Array.isArray(years) ? years : []).map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Mes</label>
                    <select value={filterMes} onChange={e => { setFilterMes(e.target.value); setPage(1); }}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/10">
                        <option value="">Todos</option>
                        {(Array.isArray(months) ? months : []).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
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
                                <button onClick={() => handleEdit(item)} className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar"><Edit size={15} /></button>
                                <button onClick={() => handleDownloadPDF(item.id)} className="p-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Descargar PDF"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></button>
                                <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={15} /></button>
                            </td>
                        </tr>
                    )} />
            </div>

            <Pagination currentPage={page} totalPages={response.totalPages} totalItems={response.total}
                onPageChange={setPage} itemsOnPage={items.length} isLoading={isLoading} />

            {/* --- Creation/Edit Modal --- */}
            <VacacionesModal open={isModalOpen} onClose={closeModal} onSubmit={handleSubmit} model={model} />

            {/* --- Modern Employee Search Modal (F3) --- */}
            <EmployeeSearchModal
                isOpen={isEmpModalOpen}
                onClose={() => setIsEmpModalOpen(false)}
                onSelect={handleSelectEmployee}
            />

            {/* --- Modal de Consulta de Empleados Elegibles --- */}
            <VacacionesElegiblesModal open={isElegiblesModalOpen} onClose={() => setIsElegiblesModalOpen(false)} onSubmit={handleRegistrarDesdeElegible} model={model} />
        </div>
    );
};

export default VacacionesScreen;
