import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { useConfirm } from '../../context/ConfirmContext';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Search, Users, User, Loader2, Wallet, CheckCircle2, Calendar, TrendingUp, TrendingDown, AlertCircle, ShieldCheck } from 'lucide-react';
import Money, { MoneyInput } from '../../components/ui/Money';
import { useDirtyTracker } from '../../hooks/useDirtyTracker';
import EmployeeSearchModal from '../../components/rh/EmployeeSearchModal';

const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px] font-medium";
const labelCls = "block text-[11px] font-bold text-slate-500 uppercase mb-1";
const roCls = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-medium text-slate-700";
const sectionCls = "bg-white rounded-xl border border-slate-200 p-4 space-y-3";

const yearNow = new Date().getFullYear();
const monthNow = new Date().getMonth() + 1;

const years = Array.from({ length: 10 }, (_, i) => yearNow - 5 + i);
const months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
];

const Liquidaciones = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selected, setSelected] = useState(null);
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
    const [calculo, setCalculo] = useState(null);
    const [calculando, setCalculando] = useState(false);

    useDirtyTracker('liquidaciones', empleadoId && (diasIndemnizacion > 0 || diasVacaciones > 0));

    // Auto-calc partial amounts (not editable)
    const sueldo = parseFloat(empleadoData?.sueldo_base || 0);
    const sueldoQuincenal = sueldo / 2;

    const totalIndemnizacion = sueldo && diasIndemnizacion > 0
        ? Math.round(((diasIndemnizacion / 365) * sueldo) * 100) / 100 : 0;

    const totalVacaciones = sueldoQuincenal && diasVacaciones > 0
        ? Math.round((sueldoQuincenal * (diasVacaciones / 365) * 1.3) * 100) / 100 : 0;

    const totalAguinaldo = sueldoQuincenal && diasAguinaldo > 0
        ? Math.round((sueldoQuincenal * (diasAguinaldo / 365)) * 100) / 100 : 0;

    const pagoUltimosDias = sueldo && diasUltimos > 0
        ? Math.round((sueldo / 30) * diasUltimos * 100) / 100 : 0;

    const totalDevengado = totalIndemnizacion + totalVacaciones + totalAguinaldo + pagoUltimosDias;
    const montoDeducciones = totalVacaciones + totalAguinaldo + pagoUltimosDias;

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
            if (e.key === 'F3') { e.preventDefault(); if (isModalOpen) setIsEmpModalOpen(true); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isModalOpen]);


    const { data: response = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['rh-planilla-liquidaciones', debouncedSearch, page, filterAño, filterMes],
        queryFn: async () => (await axios.get('/api/rh/planilla-liquidaciones', {
            params: { search: debouncedSearch, page, año: filterAño, mes: filterMes || undefined }
        })).data
    });

    const items = response.data || [];

    // Deductions fetch
    useEffect(() => {
        if (empleadoId && montoDeducciones > 0) {
            const timer = setTimeout(async () => {
                setCalculando(true);
                try {
                    const res = await axios.get('/api/rh/planilla-liquidaciones/calcular', {
                        params: {
                            empleado_id: empleadoId,
                            vacaciones: totalVacaciones,
                            aguinaldo: totalAguinaldo,
                            ultimos_dias: pagoUltimosDias,
                            monto: montoDeducciones
                        }
                    });
                    setCalculo(res.data);
                } catch { setCalculo(null); }
                finally { setCalculando(false); }
            }, 500);
            return () => clearTimeout(timer);
        } else if (!selected) {
            setCalculo(null);
        }
    }, [empleadoId, montoDeducciones, selected]);

    // Load employee
    // Date -> days helpers
    const calcDays = (desde, hasta) => {
        if (!desde || !hasta) return 0;
        return Math.max(0, Math.ceil((new Date(hasta) - new Date(desde)) / (1000 * 60 * 60 * 24)) + 1);
    };

    const formatDate = (d) => {
        if (!d) return '';
        if (typeof d === 'string') return d.substring(0, 10);
        try {
            const dt = new Date(d);
            return isNaN(dt.getTime()) ? '' : dt.toISOString().substring(0, 10);
        } catch {
            return '';
        }
    };

    const loadEmpleado = async (id) => {
        try {
            const res = await axios.get(`/api/rh/planilla-liquidaciones/empleado/${id}`);
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

            try {
                const ultRes = await axios.get(`/api/rh/planilla-liquidaciones/ultima/${id}`);
                const ultima = ultRes.data;
                if (ultima && (ultima.periodo_indemnizacion_hasta || ultima.periodo_indemnizacion_desde)) {
                    if (ultima.periodo_indemnizacion_hasta) {
                        fechaInicio = formatDate(ultima.periodo_indemnizacion_hasta);
                    }
                    ultimaInfo = {
                        desde: formatDate(ultima.periodo_indemnizacion_desde),
                        hasta: formatDate(ultima.periodo_indemnizacion_hasta)
                    };
                }
            } catch (err) {
                console.warn('No se pudo obtener la última liquidación:', err);
            }

            // Si no existe última liquidación con indemnización, tomar fecha de ingreso
            if (!fechaInicio && emp.fecha_ingreso) {
                fechaInicio = formatDate(emp.fecha_ingreso);
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
        } catch { toast.error('Error al cargar empleado'); }
    };

    const handleCodigoSearch = async () => {
        if (!codigoInput.trim()) return;
        try {
            const res = await axios.get('/api/rh/empleados', { params: { search: codigoInput.trim(), limit: 1, solo_activos: 1 } });
            const emp = res.data.data?.[0];
            if (emp) await loadEmpleado(emp.id);
            else toast.error('Empleado no encontrado');
        } catch { toast.error('Error al buscar empleado'); }
    };

    const handleSelectEmployee = (emp) => {
        loadEmpleado(emp.id);
        setIsEmpModalOpen(false);
    };

    // Mutations
    const mutation = useMutation({
        mutationFn: (data) => {
            if (selected) return axios.put(`/api/rh/planilla-liquidaciones/${selected.id}`, data);
            return axios.post('/api/rh/planilla-liquidaciones', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rh-planilla-liquidaciones'] });
            setIsModalOpen(false); resetForm();
            toast.success(selected ? 'Liquidacion actualizada' : 'Liquidacion creada');
        },
        onError: (error) => { toast.error(error.response?.data?.message || 'Error al guardar'); }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/rh/planilla-liquidaciones/${id}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rh-planilla-liquidaciones'] }); toast.success('Liquidacion eliminada'); },
        onError: (error) => { toast.error(error.response?.data?.message || 'Error al eliminar'); }
    });

    const resetForm = () => {
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
        setPeriodoIndemnizacion({ desde: formatDate(item.periodo_indemnizacion_desde), hasta: formatDate(item.periodo_indemnizacion_hasta) });
        setPeriodoVacaciones({ desde: formatDate(item.periodo_vacaciones_desde), hasta: formatDate(item.periodo_vacaciones_hasta) });
        setPeriodoAguinaldo({ desde: formatDate(item.periodo_aguinaldo_desde), hasta: formatDate(item.periodo_aguinaldo_hasta) });
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
            const res = await axios.get(`/api/rh/planilla-liquidaciones/${id}/pdf`, { responseType: 'blob' });
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
                responseType: 'blob'
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
            const res = await axios.get(`/api/rh/planilla-liquidaciones/${id}/acuerdo-pago`, { responseType: 'blob' });
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
        if (!empleadoId) return toast.error('Seleccione un empleado');

        const payload = {
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
            ultimos_dias_laborados: null,
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
        mutation.mutate(payload);
    };

    return (
        <div className="space-y-3 text-slate-900">
            <div className="flex items-center justify-between">
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
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Mes</label>
                    <select value={filterMes} onChange={e => { setFilterMes(e.target.value); setPage(1); }}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/10">
                        <option value="">Todos</option>
                        {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }}
                title={selected ? 'Editar Liquidacion' : 'Nueva Liquidacion'} maxWidth="max-w-6xl"
                maxHeight="sm:max-h-[92vh]" height="sm:h-[88vh]" bodyClassName="px-4 sm:px-6 py-4">
                <form onSubmit={handleSubmit} className="pb-2">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                        {/* Columna Izquierda: Formulario y Deducciones Fijas */}
                        <div className="lg:col-span-7 min-w-0 space-y-3">
                            {/* Metadata + Employee */}
                            <div className="grid grid-cols-12 gap-3">
                                <div className="col-span-3 sm:col-span-2">
                                    <label className={labelCls}>Año</label>
                                    <select value={periodoAño} onChange={e => setPeriodoAño(parseInt(e.target.value))} className={fieldCls}>
                                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-4 sm:col-span-3">
                                    <label className={labelCls}>Mes</label>
                                    <select value={periodoMes} onChange={e => setPeriodoMes(parseInt(e.target.value))} className={fieldCls}>
                                        {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-12 sm:col-span-7">
                                    <label className={labelCls}>Codigo Empleado <span className="text-[9px] text-indigo-500 font-normal lowercase">(F3 para buscar)</span></label>
                                    <div className="flex gap-2">
                                        <input type="text" value={codigoInput}
                                            onChange={e => setCodigoInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCodigoSearch(); } }}
                                            placeholder="Ej: EMP-001" className="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm font-mono" />
                                        <button type="button" onClick={handleCodigoSearch} title="Buscar por código"
                                            className="px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors shrink-0"><Search size={16} /></button>
                                        <button type="button" onClick={() => setIsEmpModalOpen(true)} title="Catálogo de empleados (F3)"
                                            className="px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors shrink-0"><Users size={16} /></button>
                                    </div>
                                </div>
                            </div>

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
                                    <span>Presione <strong>F3</strong> o ingrese el código para seleccionar al colaborador a liquidar.</span>
                                </div>
                            )}

                            {/* Periods + Ultimos Dias - Ultra Compacto */}
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="bg-slate-50/90 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={13} className="text-indigo-600 shrink-0" />
                                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                                            Periodos de Liquidación
                                        </span>
                                    </div>
                                    {ultimaIndemnizacion?.desde && (
                                        <span className="text-[9px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-medium">
                                            Última indemn.: {new Date(ultimaIndemnizacion.desde + 'T00:00:00').toLocaleDateString('es-SV')} al {new Date(ultimaIndemnizacion.hasta + 'T00:00:00').toLocaleDateString('es-SV')}
                                        </span>
                                    )}
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-[11px]">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 uppercase text-[9px] font-bold tracking-wider">
                                                <th className="text-left py-1 px-3 font-bold">Concepto</th>
                                                <th className="text-left py-1 px-1.5 font-bold">Desde</th>
                                                <th className="text-left py-1 px-1.5 font-bold">Hasta</th>
                                                <th className="text-center py-1 px-1.5 font-bold">Días</th>
                                                <th className="text-right py-1 px-3 font-bold">Devengado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {/* Indemnizacion */}
                                            <tr className="hover:bg-slate-50/60 transition-colors">
                                                <td className="py-1 px-3 text-slate-700 font-semibold whitespace-nowrap">
                                                    Indemnización
                                                </td>
                                                <td className="py-1 px-1.5">
                                                    <input
                                                        type="date"
                                                        value={periodoIndemnizacion.desde}
                                                        onChange={e => {
                                                            setPeriodoIndemnizacion({ ...periodoIndemnizacion, desde: e.target.value });
                                                            setDiasIndemnizacion(calcDays(e.target.value, periodoIndemnizacion.hasta));
                                                        }}
                                                        className="h-7 w-[118px] px-1.5 text-[11px] bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 transition-colors"
                                                    />
                                                </td>
                                                <td className="py-1 px-1.5">
                                                    <input
                                                        type="date"
                                                        value={periodoIndemnizacion.hasta}
                                                        onChange={e => {
                                                            setPeriodoIndemnizacion({ ...periodoIndemnizacion, hasta: e.target.value });
                                                            setDiasIndemnizacion(calcDays(periodoIndemnizacion.desde, e.target.value));
                                                        }}
                                                        className="h-7 w-[118px] px-1.5 text-[11px] bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 transition-colors"
                                                    />
                                                </td>
                                                <td className="py-1 px-1.5 text-center">
                                                    <input
                                                        type="number"
                                                        value={diasIndemnizacion || ''}
                                                        onChange={e => setDiasIndemnizacion(parseInt(e.target.value) || 0)}
                                                        className="h-7 w-12 px-1 text-[11px] text-center font-bold text-indigo-700 bg-indigo-50/50 hover:bg-white focus:bg-white border border-indigo-100 focus:border-indigo-400 rounded outline-none transition-colors"
                                                        placeholder="0"
                                                        min="0"
                                                    />
                                                </td>
                                                <td className="py-1 px-3 text-right tabular-nums">
                                                    <Money value={totalIndemnizacion} className="font-bold text-slate-800 text-[11px]" />
                                                </td>
                                            </tr>

                                            {/* Vacaciones */}
                                            <tr className="hover:bg-slate-50/60 transition-colors">
                                                <td className="py-1 px-3 text-slate-700 font-semibold whitespace-nowrap">
                                                    Vacaciones
                                                </td>
                                                <td className="py-1 px-1.5">
                                                    <input
                                                        type="date"
                                                        value={periodoVacaciones.desde}
                                                        onChange={e => {
                                                            setPeriodoVacaciones({ ...periodoVacaciones, desde: e.target.value });
                                                            setDiasVacaciones(calcDays(e.target.value, periodoVacaciones.hasta));
                                                        }}
                                                        className="h-7 w-[118px] px-1.5 text-[11px] bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 transition-colors"
                                                    />
                                                </td>
                                                <td className="py-1 px-1.5">
                                                    <input
                                                        type="date"
                                                        value={periodoVacaciones.hasta}
                                                        onChange={e => {
                                                            setPeriodoVacaciones({ ...periodoVacaciones, hasta: e.target.value });
                                                            setDiasVacaciones(calcDays(periodoVacaciones.desde, e.target.value));
                                                        }}
                                                        className="h-7 w-[118px] px-1.5 text-[11px] bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 transition-colors"
                                                    />
                                                </td>
                                                <td className="py-1 px-1.5 text-center">
                                                    <input
                                                        type="number"
                                                        value={diasVacaciones || ''}
                                                        onChange={e => setDiasVacaciones(parseInt(e.target.value) || 0)}
                                                        className="h-7 w-12 px-1 text-[11px] text-center font-bold text-indigo-700 bg-indigo-50/50 hover:bg-white focus:bg-white border border-indigo-100 focus:border-indigo-400 rounded outline-none transition-colors"
                                                        placeholder="0"
                                                        min="0"
                                                    />
                                                </td>
                                                <td className="py-1 px-3 text-right tabular-nums">
                                                    <Money value={totalVacaciones} className="font-bold text-slate-800 text-[11px]" />
                                                </td>
                                            </tr>

                                            {/* Aguinaldo */}
                                            <tr className="hover:bg-slate-50/60 transition-colors">
                                                <td className="py-1 px-3 text-slate-700 font-semibold whitespace-nowrap">
                                                    Aguinaldo
                                                </td>
                                                <td className="py-1 px-1.5">
                                                    <input
                                                        type="date"
                                                        value={periodoAguinaldo.desde}
                                                        onChange={e => {
                                                            setPeriodoAguinaldo({ ...periodoAguinaldo, desde: e.target.value });
                                                            setDiasAguinaldo(calcDays(e.target.value, periodoAguinaldo.hasta));
                                                        }}
                                                        className="h-7 w-[118px] px-1.5 text-[11px] bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 transition-colors"
                                                    />
                                                </td>
                                                <td className="py-1 px-1.5">
                                                    <input
                                                        type="date"
                                                        value={periodoAguinaldo.hasta}
                                                        onChange={e => {
                                                            setPeriodoAguinaldo({ ...periodoAguinaldo, hasta: e.target.value });
                                                            setDiasAguinaldo(calcDays(periodoAguinaldo.desde, e.target.value));
                                                        }}
                                                        className="h-7 w-[118px] px-1.5 text-[11px] bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 transition-colors"
                                                    />
                                                </td>
                                                <td className="py-1 px-1.5 text-center">
                                                    <input
                                                        type="number"
                                                        value={diasAguinaldo || ''}
                                                        onChange={e => setDiasAguinaldo(parseInt(e.target.value) || 0)}
                                                        className="h-7 w-12 px-1 text-[11px] text-center font-bold text-indigo-700 bg-indigo-50/50 hover:bg-white focus:bg-white border border-indigo-100 focus:border-indigo-400 rounded outline-none transition-colors"
                                                        placeholder="0"
                                                        min="0"
                                                    />
                                                </td>
                                                <td className="py-1 px-3 text-right tabular-nums">
                                                    <Money value={totalAguinaldo} className="font-bold text-slate-800 text-[11px]" />
                                                </td>
                                            </tr>

                                            {/* Días Pendientes */}
                                            <tr className="hover:bg-slate-50/60 transition-colors bg-slate-50/30">
                                                <td className="py-1 px-3 text-slate-700 font-semibold whitespace-nowrap">
                                                    Días Pendientes
                                                </td>
                                                <td className="py-1 px-1.5 text-slate-400 text-[10px] italic" colSpan={2}>
                                                    Salarios laborados pendientes de liquidar
                                                </td>
                                                <td className="py-1 px-1.5 text-center">
                                                    <input
                                                        type="number"
                                                        value={diasUltimos || ''}
                                                        onChange={e => setDiasUltimos(parseInt(e.target.value) || 0)}
                                                        className="h-7 w-12 px-1 text-[11px] text-center font-bold text-indigo-700 bg-indigo-50/50 hover:bg-white focus:bg-white border border-indigo-100 focus:border-indigo-400 rounded outline-none transition-colors"
                                                        placeholder="0"
                                                        min="0"
                                                    />
                                                </td>
                                                <td className="py-1 px-3 text-right tabular-nums">
                                                    <Money value={pagoUltimosDias} className="font-bold text-slate-800 text-[11px]" />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
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
                                        ) : montoDeducciones > 0 && calculo ? (
                                            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
                                                Retenciones calculadas
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-medium">
                                                Sin retenciones gravadas
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
                                                        <Money value={montoDeducciones > 0 && calculo ? montoDeducciones : 0} />
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {calculo?.isss_info?.porcentaje ? `${calculo.isss_info.porcentaje}%` : (montoDeducciones > 0 ? '3.00%' : '-')}
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {calculo?.isss_info?.tope ? `$${calculo.isss_info.tope.toFixed(2)}` : (montoDeducciones > 0 ? '$1,000.00' : '-')}
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
                                                        <Money value={montoDeducciones > 0 && calculo ? montoDeducciones : 0} />
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {calculo?.afp_info?.porcentaje ? `${calculo.afp_info.porcentaje}%` : (montoDeducciones > 0 ? '7.25%' : '-')}
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {calculo?.afp_info?.tope ? `$${calculo.afp_info.tope.toFixed(2)}` : (montoDeducciones > 0 ? '$7,045.06' : '-')}
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
                                                        <Money value={calculo?.renta_info?.ingreso_gravado || 0} />
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {calculo?.renta_info ? `${calculo.renta_info.porcentaje}%` : '-'}
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {calculo?.renta_info ? `+$${calculo.renta_info.valor_descuento.toFixed(2)}` : '-'}
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums font-bold text-rose-600">
                                                        <Money value={calculo?.descuento_renta || 0} />
                                                    </td>
                                                </tr>

                                                {/* Otros Descuentos */}
                                                <tr className="hover:bg-slate-50/70 transition-colors bg-slate-50/50">
                                                    <td className="py-2 text-slate-700 font-semibold" colSpan={3}>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                                            <span>Otros Descuentos / Anticipos:</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 text-right" colSpan={2}>
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <span className="text-[11px] text-slate-400 font-medium">$</span>
                                                            <MoneyInput
                                                                value={otrosDescuentos || ''}
                                                                onChange={e => setOtrosDescuentos(parseFloat(e.target.value) || 0)}
                                                                className="w-24 px-2 py-1 text-[12px] bg-white border border-slate-200 rounded-lg text-right font-bold text-rose-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none"
                                                                placeholder="0.00"
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Totales y notas dentro del recuadro */}
                                    <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs bg-slate-50/80 -mx-3.5 -mb-3.5 px-3.5 py-2.5">
                                        <span className="text-[10px] text-slate-400 leading-tight max-w-[280px]">
                                            * Por ley, la indemnización por retiro o despido está exenta de ISSS, AFP y Renta.
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-slate-500 uppercase">Total Descuentos:</span>
                                            <Money value={totalDeducciones} className="font-black text-rose-600 text-sm" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modalidad de Cuotas */}
                            <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" checked={pagoCuotas} onChange={e => setPagoCuotas(e.target.checked)}
                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer" />
                                    <span className="text-[11px] font-bold text-slate-600 uppercase">Habilitar Pago en Cuotas</span>
                                </label>
                                {pagoCuotas && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                                        <div>
                                            <label className={labelCls}>Número de Cuotas</label>
                                            <input type="number" value={cuotas || ''} onChange={e => setCuotas(parseInt(e.target.value) || 1)}
                                                className={fieldCls} min="1" />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Monto por Cuota Estimado</label>
                                            <div className={`${roCls} font-bold text-indigo-600`}>
                                                <Money value={pagoPorCuota} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Columna Derecha: Tarjeta Ejecutiva del Monto a Pagar */}
                        <div className="lg:col-span-5 lg:sticky lg:top-2 space-y-4">
                            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-2xl border border-slate-800 space-y-4 relative overflow-hidden">
                                {/* Ambient decorative glows */}
                                <div className="absolute -right-10 -top-10 w-36 h-36 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
                                <div className="absolute -left-10 -bottom-10 w-36 h-36 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

                                {/* Header de la Tarjeta */}
                                <div className="flex items-center justify-between relative z-10 border-b border-white/10 pb-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                            <Wallet size={16} />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Liquidación Laboral</span>
                                            <h4 className="text-xs font-semibold text-slate-200">Resumen a Liquidar</h4>
                                        </div>
                                    </div>
                                    {empleadoData?.codigo && (
                                        <span className="text-[10px] bg-white/10 border border-white/15 px-2 py-0.5 rounded-md font-mono text-slate-300">
                                            {empleadoData.codigo}
                                        </span>
                                    )}
                                </div>

                                {/* Hero Amount to Pay */}
                                <div className="relative z-10 py-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                        Total Líquido a Pagar
                                    </span>
                                    <div className="flex items-baseline gap-2">
                                        <Money value={montoRecibir} className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-400" />
                                    </div>
                                    <p className="text-[11px] text-slate-400 font-medium mt-1">
                                        {montoRecibir > 0 ? 'Monto neto final a transferir o pagar al colaborador.' : 'Complete los períodos para visualizar el cálculo.'}
                                    </p>
                                </div>

                                {/* Balance Devengado vs Deducciones */}
                                <div className="grid grid-cols-2 gap-2 relative z-10">
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                                        <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                                            <TrendingUp size={13} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Devengado (+)</span>
                                        </div>
                                        <Money value={totalDevengado} className="text-base font-black text-white block" />
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                                        <div className="flex items-center gap-1.5 text-rose-400 mb-1">
                                            <TrendingDown size={13} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Deducciones (-)</span>
                                        </div>
                                        <Money value={totalDeducciones} className="text-base font-black text-rose-300 block" />
                                    </div>
                                </div>

                                {/* Desglose de Percepciones */}
                                <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-1.5 relative z-10 text-xs">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/10 pb-1 flex justify-between">
                                        <span>Concepto Devengado</span>
                                        <span>Subtotal</span>
                                    </div>
                                    <div className="flex justify-between items-center text-slate-300 text-[11px]">
                                        <span>Indemnización ({diasIndemnizacion || 0}d)</span>
                                        <Money value={totalIndemnizacion} className="font-semibold text-white" />
                                    </div>
                                    <div className="flex justify-between items-center text-slate-300 text-[11px]">
                                        <span>Vacaciones ({diasVacaciones || 0}d)</span>
                                        <Money value={totalVacaciones} className="font-semibold text-white" />
                                    </div>
                                    <div className="flex justify-between items-center text-slate-300 text-[11px]">
                                        <span>Aguinaldo ({diasAguinaldo || 0}d)</span>
                                        <Money value={totalAguinaldo} className="font-semibold text-white" />
                                    </div>
                                    <div className="flex justify-between items-center text-slate-300 text-[11px]">
                                        <span>Salarios Pendientes ({diasUltimos || 0}d)</span>
                                        <Money value={pagoUltimosDias} className="font-semibold text-white" />
                                    </div>
                                </div>

                                {/* Modalidad de Cuotas (si está marcada) */}
                                {pagoCuotas && cuotas > 1 && (
                                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 relative z-10 text-xs">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[10px] uppercase">
                                                <Calendar size={13} /> Pago Fraccionado
                                            </div>
                                            <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-bold font-mono">
                                                {cuotas} Cuotas
                                            </span>
                                        </div>
                                        <div className="flex items-baseline justify-between pt-1">
                                            <span className="text-[11px] text-slate-300">Valor por cuota:</span>
                                            <Money value={pagoPorCuota} className="text-base font-black text-amber-300" />
                                        </div>
                                    </div>
                                )}

                                {/* Botones de Acción dentro de la tarjeta lateral */}
                                <div className="pt-2 border-t border-white/10 flex flex-col gap-2 relative z-10">
                                    <button
                                        type="submit"
                                        disabled={mutation.isPending || !empleadoId}
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg shadow-emerald-900/40 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        {mutation.isPending ? (
                                            <><Loader2 size={16} className="animate-spin" /> Guardando Liquidación...</>
                                        ) : (
                                            <><CheckCircle2 size={16} /> {selected ? 'Guardar Cambios' : 'Registrar Liquidación'}</>
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

            {/* --- Finiquito Motivo Modal --- */}
            {isFiniquitoModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                    onClick={() => setIsFiniquitoModalOpen(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-900">Generar Finiquito</h3>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Ingrese el motivo de la liquidacion</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className={labelCls}>Motivo de Liquidacion</label>
                                <input type="text" value={finiquitoMotivo} onChange={e => setFiniquitoMotivo(e.target.value)}
                                    className={fieldCls} autoFocus
                                    onKeyDown={e => { if (e.key === 'Enter') handleConfirmFiniquito(); }} />
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                            <button type="button" onClick={() => setIsFiniquitoModalOpen(false)}
                                className="px-5 py-2.5 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm">Cancelar</button>
                            <button type="button" onClick={handleConfirmFiniquito}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-600/20 active:scale-95">
                                Generar Finiquito
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Liquidaciones;
