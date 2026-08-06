import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { useConfirm } from '../../context/ConfirmContext';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Search, Users, User, X, Loader2 } from 'lucide-react';

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
    const [empSearch, setEmpSearch] = useState('');

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

    // Employee search list
    const { data: empResponse = { data: [] } } = useQuery({
        queryKey: ['rh-empleados-search', empSearch],
        queryFn: async () => (await axios.get('/api/rh/empleados', { params: { search: empSearch, limit: 50, solo_activos: 1 } })).data,
        enabled: isEmpModalOpen, staleTime: 0
    });

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
                        params: { empleado_id: empleadoId, monto: montoDeducciones }
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
    const loadEmpleado = async (id) => {
        try {
            const res = await axios.get(`/api/rh/planilla-liquidaciones/empleado/${id}`);
            const emp = res.data;
            setEmpleadoData(emp);
            setEmpleadoId(id);
            setCodigoInput(emp.codigo);
            setCalculo(null);

            // Only pre-fill periodo_indemnizacion.desde from last liquidacion
            try {
                const ultRes = await axios.get(`/api/rh/planilla-liquidaciones/ultima/${id}`);
                const ultima = ultRes.data;
                if (ultima) {
                    setPeriodoIndemnizacion({
                        desde: ultima.periodo_indemnizacion_hasta ? ultima.periodo_indemnizacion_hasta.substring(0, 10) : '',
                        hasta: ''
                    });
                    setUltimaIndemnizacion({
                        desde: ultima.periodo_indemnizacion_desde ? ultima.periodo_indemnizacion_desde.substring(0, 10) : '',
                        hasta: ultima.periodo_indemnizacion_hasta ? ultima.periodo_indemnizacion_hasta.substring(0, 10) : ''
                    });
                } else if (emp.fecha_ingreso) {
                    setPeriodoIndemnizacion({ desde: emp.fecha_ingreso.substring(0, 10), hasta: '' });
                    setUltimaIndemnizacion(null);
                }
            } catch { /* no last liquidacion, leave empty */ }
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

    const handleSelectEmployee = (emp) => { loadEmpleado(emp.id); setIsEmpModalOpen(false); setEmpSearch(''); };

    const filteredEmployees = useMemo(() => {
        let list = empResponse.data || [];
        if (!empSearch) return list.slice(0, 20);
        const s = empSearch.toLowerCase();
        return list.filter(e => e.codigo?.toLowerCase().includes(s) || e.nombres?.toLowerCase().includes(s) || e.apellidos?.toLowerCase().includes(s)).slice(0, 30);
    }, [empResponse.data, empSearch]);

    // Date -> days helpers
    const calcDays = (desde, hasta) => {
        if (!desde || !hasta) return 0;
        return Math.max(0, Math.ceil((new Date(hasta) - new Date(desde)) / (1000 * 60 * 60 * 24)) + 1);
    };

    const formatDate = (d) => d ? d.substring(0, 10) : '';

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
                            <td className="px-3 py-1 text-xs font-bold text-slate-700">${parseFloat(item.total_indemnizacion).toFixed(2)}</td>
                            <td className="px-3 py-1 text-xs font-bold text-slate-700">${parseFloat(item.total_vacaciones).toFixed(2)}</td>
                            <td className="px-3 py-1 text-xs font-bold text-slate-700">${parseFloat(item.total_aguinaldo).toFixed(2)}</td>
                            <td className="px-3 py-1 text-xs font-bold text-slate-700">${parseFloat(item.total_devengado).toFixed(2)}</td>
                            <td className="px-3 py-1 text-xs text-red-600 font-bold">${parseFloat(item.total_deducciones).toFixed(2)}</td>
                            <td className="px-3 py-1 text-xs font-bold text-emerald-600">${parseFloat(item.monto_recibir).toFixed(2)}</td>
                            <td className="px-3 py-1 flex gap-1">
                                <button onClick={() => handleEdit(item)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={15} /></button>
                                <button onClick={() => handleDownloadPDF(item.id)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Descargar PDF"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></button>
                                <button onClick={() => handleDownloadFiniquito(item.id)} className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Descargar Finiquito"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 12l2 2 4-4"/></svg></button>
                                {item.pago_cuotas && (
                                    <button onClick={() => handleDownloadAcuerdoPago(item.id)} className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Acuerdo de Pago"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></button>
                                )}
                                <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                            </td>
                        </tr>
                    )} />
            </div>

            <Pagination currentPage={page} totalPages={response.totalPages} totalItems={response.total}
                onPageChange={setPage} itemsOnPage={items.length} isLoading={isLoading} />

            {/* --- Modal --- */}
            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }}
                title={selected ? 'Editar Liquidacion' : 'Nueva Liquidacion'} maxWidth="max-w-5xl">
                <form onSubmit={handleSubmit} className="space-y-6 pb-4">
                    {/* Metadata + Employee */}
                    <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-2">
                            <label className={labelCls}>Año</label>
                            <select value={periodoAño} onChange={e => setPeriodoAño(parseInt(e.target.value))} className={fieldCls}>
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className={labelCls}>Mes</label>
                            <select value={periodoMes} onChange={e => setPeriodoMes(parseInt(e.target.value))} className={fieldCls}>
                                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                        <div className="col-span-8">
                            <label className={labelCls}>Codigo Empleado <span className="text-[9px] text-indigo-400">(F3 para buscar)</span></label>
                            <div className="flex gap-2">
                                <input type="text" value={codigoInput}
                                    onChange={e => setCodigoInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCodigoSearch(); } }}
                                    placeholder="Codigo" className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm font-mono" />
                                <button type="button" onClick={handleCodigoSearch}
                                    className="px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"><Search size={16} /></button>
                                <button type="button" onClick={() => setIsEmpModalOpen(true)}
                                    className="px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"><Users size={16} /></button>
                            </div>
                        </div>
                    </div>

                    {empleadoData && (
                        <div className="flex items-center gap-4 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs">
                            <User size={14} className="text-indigo-400 shrink-0" />
                            <span className="font-bold text-slate-700">{empleadoData.nombres} {empleadoData.apellidos}</span>
                            <span className="text-slate-400">|</span>
                            <span className="text-slate-500">{empleadoData.cargo_nombre || <span className="italic">Sin cargo</span>}</span>
                            <span className="text-slate-400">|</span>
                            <span className="text-slate-500">{empleadoData.departamento_nombre || <span className="italic">Sin depto.</span>}</span>
                            <span className="ml-auto font-bold text-indigo-600">Sueldo: ${sueldo.toFixed(2)}</span>
                        </div>
                    )}

                    {/* Periods + Ultimos Dias */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">PERIODOS</span>
                        </div>
                        <div className="p-3 space-y-2">
                            {/* Indemnizacion */}
                            {ultimaIndemnizacion?.desde && (
                                <div className="text-[9px] text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md inline-block">
                                    Ultima indemnizacion: {new Date(ultimaIndemnizacion.desde + 'T00:00:00').toLocaleDateString('es-SV')} - {new Date(ultimaIndemnizacion.hasta + 'T00:00:00').toLocaleDateString('es-SV')}
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase w-28 shrink-0">Indemnización</span>
                                <input type="date" value={periodoIndemnizacion.desde} onChange={e => { setPeriodoIndemnizacion({ ...periodoIndemnizacion, desde: e.target.value }); setDiasIndemnizacion(calcDays(e.target.value, periodoIndemnizacion.hasta)); }}
                                    className="w-[130px] px-2 py-1.5 text-[12px] bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none" />
                                <input type="date" value={periodoIndemnizacion.hasta} onChange={e => { setPeriodoIndemnizacion({ ...periodoIndemnizacion, hasta: e.target.value }); setDiasIndemnizacion(calcDays(periodoIndemnizacion.desde, e.target.value)); }}
                                    className="w-[130px] px-2 py-1.5 text-[12px] bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none" />
                                <input type="number" value={diasIndemnizacion || ''} onChange={e => setDiasIndemnizacion(parseInt(e.target.value) || 0)}
                                    className="w-[70px] px-2 py-1.5 text-[12px] bg-white border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none"
                                    placeholder="Dias" min="0" />
                            </div>
                            {/* Vacaciones */}
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase w-28 shrink-0">Vacaciones</span>
                                <input type="date" value={periodoVacaciones.desde} onChange={e => { setPeriodoVacaciones({ ...periodoVacaciones, desde: e.target.value }); setDiasVacaciones(calcDays(e.target.value, periodoVacaciones.hasta)); }}
                                    className="w-[130px] px-2 py-1.5 text-[12px] bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none" />
                                <input type="date" value={periodoVacaciones.hasta} onChange={e => { setPeriodoVacaciones({ ...periodoVacaciones, hasta: e.target.value }); setDiasVacaciones(calcDays(periodoVacaciones.desde, e.target.value)); }}
                                    className="w-[130px] px-2 py-1.5 text-[12px] bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none" />
                                <input type="number" value={diasVacaciones || ''} onChange={e => setDiasVacaciones(parseInt(e.target.value) || 0)}
                                    className="w-[70px] px-2 py-1.5 text-[12px] bg-white border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none"
                                    placeholder="Dias" min="0" />
                            </div>
                            {/* Aguinaldo */}
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase w-28 shrink-0">Aguinaldo</span>
                                <input type="date" value={periodoAguinaldo.desde} onChange={e => { setPeriodoAguinaldo({ ...periodoAguinaldo, desde: e.target.value }); setDiasAguinaldo(calcDays(e.target.value, periodoAguinaldo.hasta)); }}
                                    className="w-[130px] px-2 py-1.5 text-[12px] bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none" />
                                <input type="date" value={periodoAguinaldo.hasta} onChange={e => { setPeriodoAguinaldo({ ...periodoAguinaldo, hasta: e.target.value }); setDiasAguinaldo(calcDays(periodoAguinaldo.desde, e.target.value)); }}
                                    className="w-[130px] px-2 py-1.5 text-[12px] bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none" />
                                <input type="number" value={diasAguinaldo || ''} onChange={e => setDiasAguinaldo(parseInt(e.target.value) || 0)}
                                    className="w-[70px] px-2 py-1.5 text-[12px] bg-white border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none"
                                    placeholder="Dias" min="0" />
                            </div>
                            {/* Ultimos Dias Laborados */}
                            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                                <span className="text-[10px] font-bold text-slate-500 uppercase w-28 shrink-0">Ult. Dias Lab.</span>
                                <input type="number" value={diasUltimos || ''} onChange={e => setDiasUltimos(parseInt(e.target.value) || 0)}
                                    className="w-[70px] px-2 py-1.5 text-[12px] bg-white border border-slate-200 rounded-lg text-center focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none"
                                    placeholder="Dias" min="0" />
                                {diasUltimos > 0 && (
                                    <span className="text-[11px] text-indigo-600 font-bold">= ${pagoUltimosDias.toFixed(2)}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Totals Devengados */}
                    {empleadoData && (
                        <div className="flex items-center gap-3 bg-indigo-50/40 px-3 py-2 rounded-xl border border-indigo-100 text-xs flex-wrap">
                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider shrink-0">Devengado:</span>
                            <span className="font-bold text-slate-700">Indem. ${totalIndemnizacion.toFixed(2)}</span>
                            <span className="text-slate-300">|</span>
                            <span className="font-bold text-slate-700">Vac. ${totalVacaciones.toFixed(2)}</span>
                            <span className="text-slate-300">|</span>
                            <span className="font-bold text-slate-700">Aguin. ${totalAguinaldo.toFixed(2)}</span>
                            <span className="text-slate-300">|</span>
                            <span className="font-bold text-slate-700">Ult.Dias ${pagoUltimosDias.toFixed(2)}</span>
                            <span className="ml-auto font-black text-base text-indigo-600">TOTAL ${totalDevengado.toFixed(2)}</span>
                        </div>
                    )}

                    {/* Deductions */}
                    {calculando && (
                        <div className="flex items-center justify-center py-6 text-slate-400">
                            <Loader2 size={20} className="animate-spin mr-2" /> Calculando deducciones...
                        </div>
                    )}
                    {calculo && !calculando && (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">DEDUCCIONES</div>
                            <table className="w-full text-[11px]">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left py-1 text-slate-500 font-semibold">Concepto</th>
                                        <th className="text-right py-1 text-slate-500 font-semibold">Base</th>
                                        <th className="text-right py-1 text-slate-500 font-semibold">Tasa</th>
                                        <th className="text-right py-1 text-slate-500 font-semibold">Tope</th>
                                        <th className="text-right py-1 text-slate-500 font-semibold">Desc.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-slate-100">
                                        <td className="py-1 text-red-600 font-medium">ISSS</td>
                                        <td className="py-1 text-right tabular-nums">${montoDeducciones.toFixed(2)}</td>
                                        <td className="py-1 text-right tabular-nums">{calculo.isss_info?.porcentaje ?? '-'}%</td>
                                        <td className="py-1 text-right tabular-nums">{calculo.isss_info?.tope ? `$${calculo.isss_info.tope.toFixed(2)}` : '-'}</td>
                                        <td className="py-1 text-right tabular-nums font-bold text-red-600">${calculo.descuento_isss.toFixed(2)}</td>
                                    </tr>
                                    <tr className="border-b border-slate-100">
                                        <td className="py-1 text-red-600 font-medium">AFP{calculo.afp_info?.nombre ? ` (${calculo.afp_info.nombre})` : ''}</td>
                                        <td className="py-1 text-right tabular-nums">${montoDeducciones.toFixed(2)}</td>
                                        <td className="py-1 text-right tabular-nums">{calculo.afp_info?.porcentaje ?? '-'}%</td>
                                        <td className="py-1 text-right tabular-nums">{calculo.afp_info?.tope ? `$${calculo.afp_info.tope.toFixed(2)}` : '-'}</td>
                                        <td className="py-1 text-right tabular-nums font-bold text-red-600">${calculo.descuento_afp.toFixed(2)}</td>
                                    </tr>
                                    <tr className="border-b border-slate-100">
                                        <td className="py-1 text-red-600 font-medium">Renta</td>
                                        <td className="py-1 text-right tabular-nums">${calculo.renta_info?.ingreso_gravado?.toFixed(2) ?? '-'}</td>
                                        <td className="py-1 text-right tabular-nums">{calculo.renta_info ? `${calculo.renta_info.porcentaje}% / s/e $${calculo.renta_info.excedente.toFixed(2)}` : '-'}</td>
                                        <td className="py-1 text-right tabular-nums">{calculo.renta_info ? `Fija $${calculo.renta_info.valor_descuento.toFixed(2)}` : '-'}</td>
                                        <td className="py-1 text-right tabular-nums font-bold text-red-600">${calculo.descuento_renta.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <div className="flex items-center gap-3 border-t border-slate-200 pt-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Otros Desc.</label>
                                <input type="number" value={otrosDescuentos || ''} onChange={e => setOtrosDescuentos(parseFloat(e.target.value) || 0)}
                                    className="w-28 px-2 py-1 text-[12px] bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none" step="0.01" min="0" />
                                <span className="ml-auto font-bold text-red-600 text-[13px] whitespace-nowrap shrink-0">Deducciones ${totalDeducciones.toFixed(2)}</span>
                                <span className="text-slate-300 shrink-0">|</span>
                                <span className="font-black text-emerald-600 text-[13px] whitespace-nowrap shrink-0">Recibir ${montoRecibir.toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    {/* Cuotas */}
                    <div className={sectionCls}>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={pagoCuotas} onChange={e => setPagoCuotas(e.target.checked)}
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                            <span className="text-[11px] font-bold text-slate-500 uppercase">Pago en Cuotas</span>
                        </label>
                        {pagoCuotas && (
                            <div className="grid grid-cols-5 gap-3 mt-3">
                                <div>
                                    <label className={labelCls}>Numero de Cuotas</label>
                                    <input type="number" value={cuotas || ''} onChange={e => setCuotas(parseInt(e.target.value) || 1)}
                                        className={fieldCls} min="1" />
                                </div>
                                <div>
                                    <label className={labelCls}>Pago por Cuota ($)</label>
                                    <div className={`${roCls} font-bold text-indigo-600`}>${pagoPorCuota.toFixed(2)}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                        <button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }}
                            className="px-5 py-2.5 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm">Cancelar</button>
                        <button type="submit" disabled={mutation.isPending || !empleadoId}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50">
                            {mutation.isPending ? <><Loader2 size={14} className="animate-spin inline mr-1" />Guardando...</> : (selected ? 'Guardar Cambios' : 'Registrar Liquidacion')}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* --- Employee Search Modal --- */}
            {isEmpModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                    onClick={() => { setIsEmpModalOpen(false); setEmpSearch(''); }}>
                    <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col"
                        onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Seleccionar Empleado</h3>
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Busque por codigo o nombre</p>
                            </div>
                            <button onClick={() => { setIsEmpModalOpen(false); setEmpSearch(''); }}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} className="text-slate-400" /></button>
                        </div>
                        <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input autoFocus type="text" placeholder="Buscar por nombre o codigo..." value={empSearch}
                                    onChange={e => setEmpSearch(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all font-medium" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="grid grid-cols-1 gap-2">
                                {filteredEmployees.map(emp => (
                                    <button key={emp.id} type="button" onClick={() => handleSelectEmployee(emp)}
                                        className="flex items-start gap-4 p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-left group">
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm group-hover:shadow-indigo-100 transition-all">
                                            <User size={20} className="text-slate-400 group-hover:text-indigo-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-slate-900 truncate">{emp.nombres} {emp.apellidos}</div>
                                            <div className="flex gap-3 mt-1">
                                                <span className="text-[10px] font-mono font-bold text-indigo-500">{emp.codigo}</span>
                                                {emp.cargo_nombre && <span className="text-[10px] text-slate-400">{emp.cargo_nombre}</span>}
                                                {emp.departamento_nombre && <span className="text-[10px] text-slate-400">{emp.departamento_nombre}</span>}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                                {filteredEmployees.length === 0 && (
                                    <div className="py-12 text-center text-slate-400">
                                        <Users size={40} className="mx-auto opacity-20 mb-2" />
                                        <p className="font-bold uppercase tracking-widest text-xs italic">No se encontraron empleados</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-center">
                            <span className="text-[10px] text-slate-400 font-medium">Presione <kbd className="bg-slate-200 px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-600">F3</kbd> para abrir esta ventana</span>
                        </div>
                    </div>
                </div>
            )}

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
