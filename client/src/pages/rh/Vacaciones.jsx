import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { useConfirm } from '../../context/ConfirmContext';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Search, Users, Umbrella, Loader2, User } from 'lucide-react';
import EmployeeSearchModal from '../../components/rh/EmployeeSearchModal';

const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm";
const labelCls = "block text-xs font-semibold text-slate-500 mb-1";
const roCls = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700";

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

    // Form state
    const [empleadoId, setEmpleadoId] = useState('');
    const [empleadoData, setEmpleadoData] = useState(null);
    const [periodoAño, setPeriodoAño] = useState(yearNow);
    const [periodoMes, setPeriodoMes] = useState(monthNow);
    const [quincena, setQuincena] = useState('primera');
    const [fechaInicial, setFechaInicial] = useState('');
    const [fechaFinal, setFechaFinal] = useState('');
    const [diasTranscurridos, setDiasTranscurridos] = useState(0);
    const [vacacionesMonto, setVacacionesMonto] = useState(0);

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

    // Calculate days between dates
    useEffect(() => {
        if (fechaInicial && fechaFinal) {
            const d1 = new Date(fechaInicial);
            const d2 = new Date(fechaFinal);
            const diff = Math.max(0, Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
            setDiasTranscurridos(diff);
        } else {
            setDiasTranscurridos(0);
        }
    }, [fechaInicial, fechaFinal]);

    // Auto-calculate vacaciones: 15 days of salary + 30% recargo de ley
    useEffect(() => {
        if (selected) return; // preserve stored values when editing
        if (empleadoData?.sueldo_base && diasTranscurridos > 0) {
            // Standard vacation in El Salvador is 15 continuous calendar days
            const diasVac = (diasTranscurridos > 0 && diasTranscurridos <= 31) ? diasTranscurridos : 15;
            const sueldoDiario = parseFloat(empleadoData.sueldo_base) / 30;
            const montoBase = sueldoDiario * diasVac;
            const total = montoBase * 1.30;
            setVacacionesMonto(Math.round(total * 100) / 100);
        } else if (!selected) {
            setVacacionesMonto(0);
        }
    }, [empleadoData?.sueldo_base, diasTranscurridos, selected]);

    // Calculate deductions when monto changes
    useEffect(() => {
        if (empleadoId && vacacionesMonto > 0) {
            const timer = setTimeout(async () => {
                setCalculando(true);
                try {
                    const res = await axios.get('/api/rh/planilla-vacaciones/calcular', {
                        params: { empleado_id: empleadoId, monto: vacacionesMonto }
                    });
                    setCalculo(res.data);
                } catch {
                    setCalculo(null);
                } finally {
                    setCalculando(false);
                }
            }, 500);
            return () => clearTimeout(timer);
        } else if (!selected) {
            setCalculo(null);
        }
    }, [empleadoId, vacacionesMonto, selected]);

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

    const loadEmpleado = async (id) => {
        try {
            const res = await axios.get(`/api/rh/planilla-vacaciones/empleado/${id}`);
            setEmpleadoData(res.data);
            setEmpleadoId(id);
            setCodigoInput(res.data.codigo);
            setCalculo(null);
        } catch {
            toast.error('Error al cargar datos del empleado');
        }
    };

    const handleSelectEmployee = (emp) => {
        loadEmpleado(emp.id);
        setIsEmpModalOpen(false);
    };

    const mutation = useMutation({
        mutationFn: (data) => {
            if (selected) return axios.put(`/api/rh/planilla-vacaciones/${selected.id}`, data);
            return axios.post('/api/rh/planilla-vacaciones', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rh-planilla-vacaciones'] });
            setIsModalOpen(false);
            resetForm();
            toast.success(selected ? 'Planilla actualizada' : 'Planilla creada');
        },
        onError: (error) => { toast.error(error.response?.data?.message || 'Error al guardar'); }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/rh/planilla-vacaciones/${id}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rh-planilla-vacaciones'] }); toast.success('Planilla eliminada'); },
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
        setVacacionesMonto(0);
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
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        const ok = await confirm({ title: '¿Eliminar planilla?', message: 'Esta planilla será eliminada permanentemente.', confirmLabel: 'Sí, eliminar', variant: 'danger' });
        if (ok) deleteMutation.mutate(id);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!empleadoId) return toast.error('Seleccione un empleado');
        if (!fechaInicial || !fechaFinal) return toast.error('Ingrese las fechas');

        mutation.mutate({
            empleado_id: empleadoId,
            periodo_año: periodoAño,
            periodo_mes: periodoMes,
            quincena,
            fecha_inicial: fechaInicial,
            fecha_final: fechaFinal,
            dias_transcurridos: diasTranscurridos,
            vacaciones_monto: parseFloat(vacacionesMonto) || 0,
            descuento_isss: calculo?.descuento_isss || 0,
            descuento_afp: calculo?.descuento_afp || 0,
            descuento_renta: calculo?.descuento_renta || 0,
            total_devengado: calculo?.total_devengado || 0,
            total_deducciones: calculo?.total_deducciones || 0,
            monto_recibir: calculo?.monto_recibir || 0
        });
    };

    return (
        <div className="space-y-3 text-slate-900">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Planilla de Vacaciones</h2>
                    <p className="text-slate-500 text-[11px] font-medium">Gestión de vacaciones y cálculo de deducciones</p>
                </div>
                <button onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                    <Plus size={20} /><span>Nueva Planilla</span>
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
                <Table headers={['Periodo', 'Quincena', 'Empleado', 'Vacaciones ($)', 'Devengado', 'Deducciones', 'Neto', 'Acciones']}
                    data={items} isLoading={isLoading}
                    renderRow={(item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-3 py-1">
                                <span className="text-xs font-bold text-slate-700">{months.find(m => m.value === item.periodo_mes)?.label} {item.periodo_año}</span>
                            </td>
                            <td className="px-3 py-1">
                                <span className="text-[10px] font-bold text-slate-500 capitalize">{item.quincena}</span>
                            </td>
                            <td className="px-3 py-1">
                                <div className="text-xs font-bold text-slate-900">{item.empleado_nombres} {item.empleado_apellidos}</div>
                                <div className="text-[10px] font-mono text-indigo-500">{item.empleado_codigo}</div>
                            </td>
                            <td className="px-3 py-1 text-xs font-bold text-slate-700">${parseFloat(item.vacaciones_monto).toFixed(2)}</td>
                            <td className="px-3 py-1 text-xs font-bold text-slate-700">${parseFloat(item.total_devengado).toFixed(2)}</td>
                            <td className="px-3 py-1 text-xs text-red-600 font-bold">${parseFloat(item.total_deducciones).toFixed(2)}</td>
                            <td className="px-3 py-1 text-xs font-bold text-emerald-600">${parseFloat(item.monto_recibir).toFixed(2)}</td>
                            <td className="px-3 py-1 flex gap-1">
                                <button onClick={() => handleEdit(item)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={15} /></button>
                                <button onClick={() => handleDownloadPDF(item.id)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Descargar PDF"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></button>
                                <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                            </td>
                        </tr>
                    )} />
            </div>

            <Pagination currentPage={page} totalPages={response.totalPages} totalItems={response.total}
                onPageChange={setPage} itemsOnPage={items.length} isLoading={isLoading} />

            {/* --- Creation/Edit Modal --- */}
            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }}
                title={selected ? 'Editar Planilla de Vacaciones' : 'Nueva Planilla de Vacaciones'} maxWidth="max-w-4xl">
                <form onSubmit={handleSubmit} className="space-y-6 pb-4">
                    {selected && (
                        <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 mb-2 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs uppercase">
                                <Umbrella size={16} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Editando Planilla</span>
                                <span className="text-sm font-bold text-slate-700 leading-none">{selected?.empleado_nombres} {selected?.empleado_apellidos}</span>
                            </div>
                        </div>
                    )}

                    {/* Metadata Row */}
                    <div className="grid grid-cols-6 gap-3">
                        <div>
                            <label className={labelCls}>Año</label>
                            <select value={periodoAño} onChange={e => setPeriodoAño(parseInt(e.target.value))} className={fieldCls}>
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Mes</label>
                            <select value={periodoMes} onChange={e => setPeriodoMes(parseInt(e.target.value))} className={fieldCls}>
                                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Quincena</label>
                            <select value={quincena} onChange={e => setQuincena(e.target.value)} className={fieldCls}>
                                <option value="primera">Primera</option>
                                <option value="segunda">Segunda</option>
                            </select>
                        </div>
                        <div className="col-span-3">
                            <label className={labelCls}>Código Empleado <span className="text-[9px] text-indigo-400">(F3 para buscar)</span></label>
                            <div className="flex gap-2">
                                <input ref={employeeInputRef} type="text" value={codigoInput}
                                    onChange={e => setCodigoInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCodigoSearch(); } }}
                                    placeholder="Código"
                                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm font-mono" />
                                <button type="button" onClick={handleCodigoSearch}
                                    className="px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors">
                                    <Search size={16} />
                                </button>
                                <button type="button" onClick={() => setIsEmpModalOpen(true)}
                                    className="px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors">
                                    <Users size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Employee Read-only Data */}
                    {empleadoData && (
                        <div className="flex items-center gap-4 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs">
                            <User size={14} className="text-indigo-400 shrink-0" />
                            <span className="font-bold text-slate-700">{empleadoData.nombres} {empleadoData.apellidos}</span>
                            <span className="text-slate-400">|</span>
                            <span className="text-slate-500">{empleadoData.cargo_nombre || <span className="italic">Sin cargo</span>}</span>
                            <span className="text-slate-400">|</span>
                            <span className="text-slate-500">{empleadoData.departamento_nombre || <span className="italic">Sin depto.</span>}</span>
                            <span className="ml-auto font-bold text-indigo-600">Sueldo: ${parseFloat(empleadoData.sueldo_base || 0).toFixed(2)}</span>
                        </div>
                    )}

                    {/* Dates & Calculation */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                        <div className="grid grid-cols-4 gap-3">
                            <div>
                                <label className={labelCls}>Fecha Inicial</label>
                                <input type="date" value={fechaInicial} onChange={e => setFechaInicial(e.target.value)}
                                    className={fieldCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Fecha Final</label>
                                <input type="date" value={fechaFinal} onChange={e => setFechaFinal(e.target.value)}
                                    className={fieldCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Días Transcurridos</label>
                                <div className={`${roCls} font-bold text-slate-900`}>{diasTranscurridos}</div>
                            </div>
                            <div>
                                <label className={labelCls}>Vacaciones ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={vacacionesMonto || ''}
                                    onChange={e => setVacacionesMonto(parseFloat(e.target.value) || 0)}
                                    className={`${fieldCls} font-bold text-indigo-600`}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Deductions Results */}
                    {calculando && (
                        <div className="flex items-center justify-center py-8 text-slate-400">
                            <Loader2 size={20} className="animate-spin mr-2" /> Calculando deducciones...
                        </div>
                    )}
                    {calculo && !calculando && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Detalle de Deducciones</div>
                            <table className="w-full text-[12px]">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left py-1.5 text-slate-500 font-semibold">Concepto</th>
                                        <th className="text-right py-1.5 text-slate-500 font-semibold">Base</th>
                                        <th className="text-right py-1.5 text-slate-500 font-semibold">Tasa</th>
                                        <th className="text-right py-1.5 text-slate-500 font-semibold">Tope</th>
                                        <th className="text-right py-1.5 text-slate-500 font-semibold">Descuento</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-slate-100">
                                        <td className="py-1.5 text-red-600 font-medium">ISSS</td>
                                        <td className="py-1.5 text-right tabular-nums">${calculo.vacaciones_monto.toFixed(2)}</td>
                                        <td className="py-1.5 text-right tabular-nums">{calculo.isss_info?.porcentaje ?? '-'}%</td>
                                        <td className="py-1.5 text-right tabular-nums">{calculo.isss_info?.tope ? `$${calculo.isss_info.tope.toFixed(2)}` : '-'}</td>
                                        <td className="py-1.5 text-right tabular-nums font-bold text-red-600">${calculo.descuento_isss.toFixed(2)}</td>
                                    </tr>
                                    <tr className="border-b border-slate-100">
                                        <td className="py-1.5 text-red-600 font-medium">
                                            AFP {calculo.afp_info?.nombre ? `(${calculo.afp_info.nombre})` : ''}
                                        </td>
                                        <td className="py-1.5 text-right tabular-nums">${calculo.vacaciones_monto.toFixed(2)}</td>
                                        <td className="py-1.5 text-right tabular-nums">{calculo.afp_info?.porcentaje ?? '-'}%</td>
                                        <td className="py-1.5 text-right tabular-nums">{calculo.afp_info?.tope ? `$${calculo.afp_info.tope.toFixed(2)}` : '-'}</td>
                                        <td className="py-1.5 text-right tabular-nums font-bold text-red-600">${calculo.descuento_afp.toFixed(2)}</td>
                                    </tr>
                                    <tr className="border-b border-slate-100">
                                        <td className="py-1.5 text-red-600 font-medium">Renta</td>
                                        <td className="py-1.5 text-right tabular-nums">${calculo.renta_info?.ingreso_gravado.toFixed(2) ?? '-'}</td>
                                        <td className="py-1.5 text-right tabular-nums">
                                            {calculo.renta_info ? `${calculo.renta_info.porcentaje}% / s/excedente $${calculo.renta_info.excedente.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="py-1.5 text-right tabular-nums">
                                            {calculo.renta_info ? `Cuota fija $${calculo.renta_info.valor_descuento.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="py-1.5 text-right tabular-nums font-bold text-red-600">${calculo.descuento_renta.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <div className="border-t border-slate-200 pt-3 grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-indigo-600 uppercase">Total Devengado</label>
                                    <div className="text-lg font-black text-indigo-600">${calculo.total_devengado.toFixed(2)}</div>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-red-600 uppercase">Total Deducciones</label>
                                    <div className="text-lg font-black text-red-600">${calculo.total_deducciones.toFixed(2)}</div>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-emerald-600 uppercase">Monto a Recibir</label>
                                    <div className="text-lg font-black text-emerald-600">${calculo.monto_recibir.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                        <button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }}
                            className="px-5 py-2.5 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm">Cancelar</button>
                        <button type="submit" disabled={mutation.isPending || !empleadoId}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50">
                            {mutation.isPending ? <><Loader2 size={14} className="animate-spin inline mr-1" />Guardando...</> : (selected ? 'Guardar Cambios' : 'Registrar Planilla')}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* --- Modern Employee Search Modal (F3) --- */}
            <EmployeeSearchModal
                isOpen={isEmpModalOpen}
                onClose={() => setIsEmpModalOpen(false)}
                onSelect={handleSelectEmployee}
            />
        </div>
    );
};

export default Vacaciones;
