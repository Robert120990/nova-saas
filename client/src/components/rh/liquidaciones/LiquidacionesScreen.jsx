import { unwrapList, unwrapPagination } from '../../../utils/apiUtils';
import { toDateInput } from '../../../utils/dateUtils';
import { useRhPayrollRequest } from '../../../hooks/useRhPayrollRequest';
import { useBenefitCalculation } from '../../../hooks/useBenefitCalculation';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../../ui/Table';
import Pagination from '../../ui/Pagination';
import { useConfirm } from '../../../context/ConfirmContext';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import Money from '../../ui/Money';
import { useDirtyTracker } from '../../../hooks/useDirtyTracker';
import EmployeeSearchModal from '../../rh/EmployeeSearchModal';

const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px] font-medium";
const labelCls = "block text-[11px] font-bold text-slate-500 uppercase mb-1";
const roCls = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-medium text-slate-700";
const _sectionCls = "bg-white rounded-xl border border-slate-200 p-4 space-y-3";

const yearNow = new Date().getFullYear();
const monthNow = new Date().getMonth() + 1;

const years = Array.from({ length: 10 }, (_, i) => yearNow - 5 + i);
const months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
];

import LiquidacionesModal from './LiquidacionesModal';
import FiniquitoModal from './FiniquitoModal';

const LiquidacionesScreen = ({ companyId }) => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const headers = { 'x-company-id': companyId };
    const [loadingEmployee, setLoadingEmployee] = useState(false);
    const [employeeError, setEmployeeError] = useState('');
    const savingRef = useRef(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const employeeScope = useRhPayrollRequest(JSON.stringify([companyId, isModalOpen, selected?.id]));
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAño, setFilterAño] = useState(yearNow);
    const [filterMes, setFilterMes] = useState('');
    const [page, setPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Employee search
    const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);

    // Finiquito modal
    const [isFiniquitoModalOpen, setIsFiniquitoModalOpen] = useState(false);
    const [finiquitoMotivo, setFiniquitoMotivo] = useState('RENUNCIA INMEDIATA');
    const [finiquitoId, setFiniquitoId] = useState(null);

    // Form
    const [empleadoId, setEmpleadoId] = useState('');
    const [empleadoData, setEmpleadoData] = useState(null);
    const [periodoAño, setPeriodoAño] = useState(yearNow);
    const [periodoMes, setPeriodoMes] = useState(monthNow);
    const [codigoInput, setCodigoInput] = useState('');

    // Periods
    const emptyPeriod = { desde: '', hasta: '' };
    const [periodoIndemnizacion, setPeriodoIndemnizacion] = useState(emptyPeriod);
    const [periodoVacaciones, setPeriodoVacaciones] = useState(emptyPeriod);
    const [periodoAguinaldo, setPeriodoAguinaldo] = useState(emptyPeriod);
    const [ultimaIndemnizacion, setUltimaIndemnizacion] = useState(null);

    // Days
    const [diasIndemnizacion, setDiasIndemnizacion] = useState(0);
    const [diasVacaciones, setDiasVacaciones] = useState(0);
    const [diasAguinaldo, setDiasAguinaldo] = useState(0);

    // Last days
    const [diasUltimos, setDiasUltimos] = useState(0);

    // Cuotas
    const [pagoCuotas, setPagoCuotas] = useState(false);
    const [cuotas, setCuotas] = useState(1);
    const [pagoPorCuota, setPagoPorCuota] = useState(0);

    // Otros descuentos
    const [otrosDescuentos, setOtrosDescuentos] = useState(0);

    // Calculated amounts


    useDirtyTracker('liquidaciones', isModalOpen && !!empleadoId);

    // Auto-calc partial amounts (not editable)
    const sueldo = parseFloat(empleadoData?.sueldo_base || 0);
    const sueldoQuincenal = sueldo / 2;

    const totalIndemnizacion = selected && Number(diasIndemnizacion) === Number(selected.dias_indemnizacion)
        ? Number(selected.total_indemnizacion) : sueldo && diasIndemnizacion > 0
        ? Math.round(((diasIndemnizacion / 365) * sueldo) * 100) / 100 : 0;

    const totalVacaciones = selected && Number(diasVacaciones) === Number(selected.dias_vacaciones)
        ? Number(selected.total_vacaciones) : sueldoQuincenal && diasVacaciones > 0
        ? Math.round((sueldoQuincenal * (diasVacaciones / 365) * 1.3) * 100) / 100 : 0;

    const totalAguinaldo = selected && Number(diasAguinaldo) === Number(selected.dias_aguinaldo)
        ? Number(selected.total_aguinaldo) : sueldoQuincenal && diasAguinaldo > 0
        ? Math.round((sueldoQuincenal * (diasAguinaldo / 365)) * 100) / 100 : 0;

    const savedDays = selected?.sueldo_base > 0 ? Math.round(Number(selected.pago_ultimos_dias || 0) * 30 / Number(selected.sueldo_base)) : 0;
    const pagoUltimosDias = selected && Number(diasUltimos) === savedDays
        ? Number(selected.pago_ultimos_dias) : sueldo && diasUltimos > 0
        ? Math.round((sueldo / 30) * diasUltimos * 100) / 100 : 0;

    const totalDevengado = totalIndemnizacion + totalVacaciones + totalAguinaldo + pagoUltimosDias;
    const montoDeducciones = totalVacaciones + totalAguinaldo + pagoUltimosDias;

    const { calculo, setCalculo, calculando, calculationError, calculationReady, retryCalculation } = useBenefitCalculation({
        url: '/api/rh/planilla-liquidaciones/calcular', companyId, open: isModalOpen, employeeId: empleadoId,
        params: { empleado_id: empleadoId, vacaciones: totalVacaciones, aguinaldo: totalAguinaldo, ultimos_dias: pagoUltimosDias, monto: montoDeducciones },
        enabled: !loadingEmployee,
        storedKey: selected?.revision || selected?.id,
        preserveSaved: !!selected && totalVacaciones === Number(selected.total_vacaciones) && totalAguinaldo === Number(selected.total_aguinaldo) && pagoUltimosDias === Number(selected.pago_ultimos_dias),
        savedCalculation: selected ? {
            descuento_isss: Number(selected.descuento_isss), descuento_afp: Number(selected.descuento_afp), descuento_renta: Number(selected.descuento_renta),
            total_deducciones_auto: Number(selected.descuento_isss) + Number(selected.descuento_afp) + Number(selected.descuento_renta)
        } : null
    });

    // Deductions
    const deduccionesAuto = calculo?.total_deducciones_auto || 0;
    const totalDeducciones = deduccionesAuto + parseFloat(otrosDescuentos || 0);
    const montoRecibir = totalDevengado - totalDeducciones;

    // Cuota calc
    useEffect(() => {
        if (pagoCuotas && cuotas > 0 && montoRecibir > 0) {
            setPagoPorCuota(Math.round((montoRecibir / cuotas) * 100) / 100);
        } else {
            setPagoPorCuota(0);
        }
    }, [pagoCuotas, cuotas, montoRecibir]);

    // Search debounce
    useEffect(() => {
        const timer = setTimeout(() => { setDebouncedSearch(searchTerm); setPage(1); }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // F3 shortcut
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F3') { e.preventDefault(); if (isModalOpen && !savingRef.current && !loadingEmployee) setIsEmpModalOpen(true); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isModalOpen]);


    const { data: response = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['rh-planilla-liquidaciones', companyId, debouncedSearch, page, filterAño, filterMes],
        queryFn: async ({ signal }) => {
            const result = await axios.get('/api/rh/planilla-liquidaciones', {
                params: { search: debouncedSearch, page, año: filterAño, mes: filterMes || undefined }, headers, signal
            });
            return { ...unwrapPagination(result), data: unwrapList(result) };
        },
        enabled: !!companyId,
        staleTime: 0
    });

    const items = unwrapList(response);

    // Load employee
    // Date -> days helpers
    const calcDays = (desde, hasta) => {
        if (!desde || !hasta) return 0;
        return Math.max(0, Math.ceil((new Date(hasta) - new Date(desde)) / (1000 * 60 * 60 * 24)) + 1);
    };

    const loadEmpleado = async (id) => {
        if (savingRef.current) return;
        if (selected) return toast.error('El empleado de una planilla registrada no puede cambiarse');
        const request = employeeScope.begin();
        setLoadingEmployee(true);
        setEmployeeError('');
        try {
            const [res, ultRes] = await Promise.all([
                axios.get(`/api/rh/planilla-liquidaciones/empleado/${id}`, { headers, signal: request.signal }),
                axios.get(`/api/rh/planilla-liquidaciones/ultima/${id}`, { headers, signal: request.signal })
            ]);
            if (!request.isCurrent()) return;
            const emp = res.data;
            setEmpleadoData(emp);
            setEmpleadoId(id);
            setCodigoInput(emp.codigo);
            setCalculo(null);

            // Pre-fill periodo_indemnizacion.desde:
            // 1. Primero buscar última liquidación con indemnización registrada
            // 2. Si no existe, tomar fecha_ingreso del colaborador
            let fechaInicio = '';
            let ultimaInfo = null;

                const ultima = ultRes.data;
                if (ultima && (ultima.periodo_indemnizacion_hasta || ultima.periodo_indemnizacion_desde)) {
                    if (ultima.periodo_indemnizacion_hasta) {
                        fechaInicio = toDateInput(ultima.periodo_indemnizacion_hasta);
                    }
                    ultimaInfo = {
                        desde: toDateInput(ultima.periodo_indemnizacion_desde),
                        hasta: toDateInput(ultima.periodo_indemnizacion_hasta)
                    };
                }


            // Si no existe última liquidación con indemnización, tomar fecha de ingreso
            if (!fechaInicio && emp.fecha_ingreso) {
                fechaInicio = toDateInput(emp.fecha_ingreso);
            }

            setPeriodoIndemnizacion(prev => {
                const hasta = prev.hasta || '';
                if (fechaInicio && hasta) {
                    setDiasIndemnizacion(calcDays(fechaInicio, hasta));
                }
                return {
                    desde: fechaInicio,
                    hasta
                };
            });
            setUltimaIndemnizacion(ultimaInfo);
        } catch (error) {
            if (request.isCurrent()) {
                setEmployeeError(error.response?.data?.message || 'No se pudo cargar el empleado y su historial. Reintente la búsqueda.');
                toast.error('No se pudo cargar el empleado y su historial');
            }
        } finally { if (request.isCurrent()) setLoadingEmployee(false); }
    };

    const handleCodigoSearch = async () => {
        if (!codigoInput.trim() || savingRef.current) return;
        const request = employeeScope.begin();
        setLoadingEmployee(true);
        setEmployeeError('');
        try {
            const res = await axios.get('/api/rh/empleados', { params: { search: codigoInput.trim(), limit: 1, solo_activos: 1 }, headers, signal: request.signal });
            if (!request.isCurrent()) return;
            const emp = unwrapList(res)[0];
            if (emp) await loadEmpleado(emp.id);
            else toast.error('Empleado no encontrado');
        } catch (error) {
            if (request.isCurrent()) { setEmployeeError(error.response?.data?.message || 'Error al buscar empleado'); toast.error('Error al buscar empleado'); }
        } finally { if (request.isCurrent()) setLoadingEmployee(false); }
    };

    const handleSelectEmployee = (emp) => {
        loadEmpleado(emp.id);
        setIsEmpModalOpen(false);
    };

    // Mutations
    const saveContext = JSON.stringify([companyId, isModalOpen, selected?.id, empleadoId, periodoAño, periodoMes]);
    const saveScope = useRhPayrollRequest(saveContext);
    const mutation = useMutation({
        mutationFn: ({ payload, id, company, request }) => {
            if (!request.isCurrent()) throw new Error('El contexto cambió antes de guardar.');
            const config = { headers: { 'x-company-id': company } };
            return id ? axios.put(`/api/rh/planilla-liquidaciones/${id}`, payload, config) : axios.post('/api/rh/planilla-liquidaciones', payload, config);
        },
        onSuccess: async (_result, { id, request }) => {
            await queryClient.invalidateQueries({ queryKey: ['rh-planilla-liquidaciones', companyId] });
            
            if (request.isCurrent()) { setIsModalOpen(false); resetForm(); }
            toast.success(id ? 'Liquidación actualizada' : 'Liquidación creada');
        },
        onError: (error) => {
            if (error?.response?.status === 404) {
                toast.error('El registro de liquidación ya no existe o fue eliminado en el servidor');
                setIsModalOpen(false);
                resetForm();
            } else {
                toast.error(error.response?.data?.message || error.message || 'Error al guardar');
            }
        },
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
        mutationFn: (id) => axios.delete(`/api/rh/planilla-liquidaciones/${id}`, { headers }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rh-planilla-liquidaciones'] }); toast.success('Liquidacion eliminada'); },
        onError: (error) => {
            if (error?.response?.status === 404) {
                toast.error('El registro de liquidación ya no existe o ya fue eliminado');
                queryClient.invalidateQueries({ queryKey: ['rh-planilla-liquidaciones'] });
            } else {
                toast.error(error.response?.data?.message || 'Error al eliminar');
            }
        }
    });

    const resetForm = () => {
        employeeScope.cancel();
        setLoadingEmployee(false);
        setEmployeeError('');
        setIsEmpModalOpen(false);
        setSelected(null); setEmpleadoId(''); setEmpleadoData(null); setCodigoInput('');
        setPeriodoAño(yearNow); setPeriodoMes(monthNow);
        setPeriodoIndemnizacion(emptyPeriod); setPeriodoVacaciones(emptyPeriod); setPeriodoAguinaldo(emptyPeriod);
        setDiasIndemnizacion(0); setDiasVacaciones(0); setDiasAguinaldo(0);
        setDiasUltimos(0);
        setOtrosDescuentos(0);
        setPagoCuotas(false); setCuotas(1); setPagoPorCuota(0);
        setCalculo(null); setUltimaIndemnizacion(null);
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
        setCodigoInput(item.empleado_codigo || '');
        setEmpleadoData({
            id: item.empleado_id, codigo: item.empleado_codigo,
            nombres: item.empleado_nombres, apellidos: item.empleado_apellidos,
            sueldo_base: item.sueldo_base, cargo_nombre: item.cargo_nombre,
            departamento_nombre: item.departamento_nombre
        });
        setPeriodoIndemnizacion({ desde: toDateInput(item.periodo_indemnizacion_desde), hasta: toDateInput(item.periodo_indemnizacion_hasta) });
        setPeriodoVacaciones({ desde: toDateInput(item.periodo_vacaciones_desde), hasta: toDateInput(item.periodo_vacaciones_hasta) });
        setPeriodoAguinaldo({ desde: toDateInput(item.periodo_aguinaldo_desde), hasta: toDateInput(item.periodo_aguinaldo_hasta) });
        setDiasIndemnizacion(item.dias_indemnizacion || 0);
        setDiasVacaciones(item.dias_vacaciones || 0);
        setDiasAguinaldo(item.dias_aguinaldo || 0);
        setDiasUltimos(item.sueldo_base > 0 ? Math.round((parseFloat(item.pago_ultimos_dias || 0) * 30 / parseFloat(item.sueldo_base))) : 0);
        setOtrosDescuentos(parseFloat(item.otros_descuentos) || 0);
        setPagoCuotas(!!item.pago_cuotas);
        setCuotas(item.cuotas || 1);
        setCalculo({
            descuento_isss: parseFloat(item.descuento_isss),
            descuento_afp: parseFloat(item.descuento_afp),
            descuento_renta: parseFloat(item.descuento_renta),
            total_devengado: parseFloat(item.total_devengado),
            total_deducciones_auto: parseFloat(item.descuento_isss) + parseFloat(item.descuento_afp) + parseFloat(item.descuento_renta)
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        const ok = await confirm({ title: 'Eliminar liquidacion?', message: 'Esta liquidacion sera eliminada permanentemente.', confirmLabel: 'Si, eliminar', variant: 'danger' });
        if (ok) deleteMutation.mutate(id);
    };

    const handleDownloadPDF = async (id) => {
        try {
            const res = await axios.get(`/api/rh/planilla-liquidaciones/${id}/pdf`, { responseType: 'blob', headers });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Liquidacion_${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('PDF descargado');
        } catch { toast.error('Error al descargar PDF'); }
    };

    const handleDownloadFiniquito = (id) => {
        setFiniquitoId(id);
        setFiniquitoMotivo('RENUNCIA INMEDIATA');
        setIsFiniquitoModalOpen(true);
    };

    const handleConfirmFiniquito = async () => {
        if (!finiquitoMotivo.trim()) return toast.error('Ingrese el motivo');
        try {
            const res = await axios.get(`/api/rh/planilla-liquidaciones/${finiquitoId}/finiquito`, {
                params: { motivo: finiquitoMotivo },
                responseType: 'blob', headers
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Finiquito_${finiquitoId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Finiquito descargado');
            setIsFiniquitoModalOpen(false);
        } catch { toast.error('Error al descargar finiquito'); }
    };

    const handleDownloadAcuerdoPago = async (id) => {
        try {
            const res = await axios.get(`/api/rh/planilla-liquidaciones/${id}/acuerdo-pago`, { responseType: 'blob', headers });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `AcuerdoPago_${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Acuerdo de Pago descargado');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al descargar acuerdo de pago');
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (savingRef.current) return;
        if (!empleadoId) return toast.error('Seleccione un empleado');
        if (loadingEmployee || employeeError) return toast.error('Cargue correctamente el empleado y su historial antes de guardar');
        if (!calculationReady) return toast.error(calculationError || 'Espere a que termine el cálculo de las retenciones antes de guardar');

        const payload = {
            expected_revision: selected?.revision,
            empleado_id: empleadoId,
            periodo_año: periodoAño,
            periodo_mes: periodoMes,
            periodo_indemnizacion_desde: periodoIndemnizacion.desde || null,
            periodo_indemnizacion_hasta: periodoIndemnizacion.hasta || null,
            periodo_vacaciones_desde: periodoVacaciones.desde || null,
            periodo_vacaciones_hasta: periodoVacaciones.hasta || null,
            periodo_aguinaldo_desde: periodoAguinaldo.desde || null,
            periodo_aguinaldo_hasta: periodoAguinaldo.hasta || null,
            dias_indemnizacion: diasIndemnizacion,
            dias_vacaciones: diasVacaciones,
            dias_aguinaldo: diasAguinaldo,
            ultimos_dias_laborados: toDateInput(selected?.ultimos_dias_laborados) || null,
            pago_ultimos_dias: pagoUltimosDias,
            total_indemnizacion: totalIndemnizacion,
            total_vacaciones: totalVacaciones,
            total_aguinaldo: totalAguinaldo,
            total_devengado: totalDevengado,
            descuento_isss: calculo?.descuento_isss || 0,
            descuento_afp: calculo?.descuento_afp || 0,
            descuento_renta: calculo?.descuento_renta || 0,
            otros_descuentos: parseFloat(otrosDescuentos) || 0,
            total_deducciones: totalDeducciones,
            monto_recibir: montoRecibir,
            pago_cuotas: pagoCuotas,
            cuotas: cuotas,
            pago_por_cuota: pagoPorCuota
        };
        savingRef.current = true;
        mutation.mutate({ payload, id: selected?.id, company: companyId, request: saveScope.begin() });
    };

    const model = { calcDays, calculando, calculationError, calculationReady, calculo, closeModal, codigoInput, cuotas, diasAguinaldo, diasIndemnizacion, diasUltimos, diasVacaciones, empleadoData, empleadoId, employeeError, fieldCls, finiquitoMotivo, handleCodigoSearch, handleConfirmFiniquito, handleSubmit, isFiniquitoModalOpen, isModalOpen, labelCls, loadingEmployee, months, montoDeducciones, montoRecibir, mutation, otrosDescuentos, pagoCuotas, pagoPorCuota, pagoUltimosDias, periodoAguinaldo, periodoAño, periodoIndemnizacion, periodoMes, periodoVacaciones, retryCalculation, roCls, selected, setCodigoInput, setCuotas, setDiasAguinaldo, setDiasIndemnizacion, setDiasUltimos, setDiasVacaciones, setFiniquitoMotivo, setIsEmpModalOpen, setIsFiniquitoModalOpen, setOtrosDescuentos, setPagoCuotas, setPeriodoAguinaldo, setPeriodoAño, setPeriodoIndemnizacion, setPeriodoMes, setPeriodoVacaciones, sueldo, totalAguinaldo, totalDeducciones, totalDevengado, totalIndemnizacion, totalVacaciones, ultimaIndemnizacion, years };

    return (
        <div className="space-y-3 text-slate-900">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Planilla de Liquidaciones</h2>
                    <p className="text-slate-500 text-[11px] font-medium">Liquidacion laboral: indemnizacion, vacaciones, aguinaldo y calculo de deducciones</p>
                </div>
                <button onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                    <Plus size={20} /><span>Nueva Liquidacion</span>
                </button>
            </div>

            <div className="flex gap-3 items-end">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input type="text" placeholder="Buscar empleado..." value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-medium shadow-sm" />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Año</label>
                    <select value={filterAño} onChange={e => { setFilterAño(parseInt(e.target.value)); setPage(1); }}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/10">
                        {(Array.isArray(years) ? years : []).map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Mes</label>
                    <select value={filterMes} onChange={e => { setFilterMes(e.target.value); setPage(1); }}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/10">
                        <option value="">Todos</option>
                        {(Array.isArray(months) ? months : []).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                <Table headers={['Periodo', 'Empleado', 'Indemnizacion', 'Vacaciones', 'Aguinaldo', 'Devengado', 'Deducciones', 'Neto', 'Acciones']}
                    data={items} isLoading={isLoading}
                    renderRow={(item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-3 py-1">
                                <span className="text-xs font-bold text-slate-700">{months.find(m => m.value === item.periodo_mes)?.label} {item.periodo_año}</span>
                            </td>
                            <td className="px-3 py-1">
                                <div className="text-xs font-bold text-slate-900">{item.empleado_nombres} {item.empleado_apellidos}</div>
                                <div className="text-[10px] font-mono text-indigo-500">{item.empleado_codigo}</div>
                            </td>
                            <td className="px-3 py-1 text-xs font-bold text-slate-700"><Money value={item.total_indemnizacion} /></td>
                            <td className="px-3 py-1 text-xs font-bold text-slate-700"><Money value={item.total_vacaciones} /></td>
                            <td className="px-3 py-1 text-xs font-bold text-slate-700"><Money value={item.total_aguinaldo} /></td>
                            <td className="px-3 py-1 text-xs font-bold text-slate-700"><Money value={item.total_devengado} /></td>
                            <td className="px-3 py-1 text-xs text-rose-600 font-bold"><Money value={item.total_deducciones} /></td>
                            <td className="px-3 py-1 text-xs font-bold text-emerald-600"><Money value={item.monto_recibir} /></td>
                            <td className="px-3 py-1 flex gap-1">
                                <button onClick={() => handleEdit(item)} className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={15} /></button>
                                <button onClick={() => handleDownloadPDF(item.id)} className="p-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Descargar PDF"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></button>
                                <button onClick={() => handleDownloadFiniquito(item.id)} className="p-1 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Descargar Finiquito"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 12l2 2 4-4"/></svg></button>
                                {item.pago_cuotas && (
                                    <button onClick={() => handleDownloadAcuerdoPago(item.id)} className="p-1 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Acuerdo de Pago"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></button>
                                )}
                                <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                            </td>
                        </tr>
                    )} />
            </div>

            <Pagination currentPage={page} totalPages={response.totalPages} totalItems={response.total}
                onPageChange={setPage} itemsOnPage={items.length} isLoading={isLoading} />

            {/* --- Modal --- */}
            <LiquidacionesModal open={isModalOpen} onClose={closeModal} onSubmit={handleSubmit} model={model} />

            {/* --- Modern Employee Search Modal (F3) --- */}
            <EmployeeSearchModal
                isOpen={isEmpModalOpen}
                onClose={() => setIsEmpModalOpen(false)}
                onSelect={handleSelectEmployee}
            />

            {/* --- Finiquito Motivo Modal --- */}
            {<FiniquitoModal open={isFiniquitoModalOpen} onClose={() => setIsFiniquitoModalOpen(false)} onSubmit={handleConfirmFiniquito} model={model} />}
        </div>
    );
};

export default LiquidacionesScreen;
