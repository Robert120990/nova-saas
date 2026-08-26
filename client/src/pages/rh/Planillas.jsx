import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { useConfirm } from '../../context/ConfirmContext';
import { toast } from 'sonner';
import { Plus, Edit, Search, Users, X, Loader2, User, CheckCircle, Zap, Download, Trash2, Lock } from 'lucide-react';
import { useDirtyTracker } from '../../hooks/useDirtyTracker';

const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px] font-medium";
const labelCls = "block text-[11px] font-bold text-slate-500 uppercase mb-1";

const yearNow = new Date().getFullYear();
const monthNow = new Date().getMonth() + 1;
const years = Array.from({ length: 10 }, (_, i) => yearNow - 5 + i);
const months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
];

const Planillas = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const employeeInputRef = useRef(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const [filterAnio, setFilterAnio] = useState(yearNow);
    const [filterMes, setFilterMes] = useState(monthNow);
    const [filterQuincena, setFilterQuincena] = useState('');
    const [page, setPage] = useState(1);

    const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
    const [empSearch, setEmpSearch] = useState('');

    const [empleadoId, setEmpleadoId] = useState('');
    const [empleadoData, setEmpleadoData] = useState(null);
    const [periodoAnio, setPeriodoAnio] = useState(yearNow);
    const [periodoMes, setPeriodoMes] = useState(monthNow);
    const [quincena, setQuincena] = useState('primera');
    const [diasTrabajados, setDiasTrabajados] = useState(15);
    const [codigoInput, setCodigoInput] = useState('');
    const [detalles, setDetalles] = useState([]);
    const [calculo, setCalculo] = useState(null);
    const [calculando, setCalculando] = useState(false);
    const [generando, setGenerando] = useState(false);
    const [periodoBloqueado, setPeriodoBloqueado] = useState(false);
    const cacheRef = useRef({});
    const autoSaveRef = useRef(false);
    const savingRef = useRef(false);

    useDirtyTracker('planillas', empleadoId && detalles.length > 0);

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

    const { data: empResponse = { data: [] }, isLoading: empLoading } = useQuery({
        queryKey: ['rh-empleados-search', empSearch],
        queryFn: async () => (await axios.get('/api/rh/empleados', { params: { search: empSearch, limit: 200, solo_activos: 1 } })).data,
        enabled: isEmpModalOpen,
        staleTime: 0
    });

    const { data: response = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['rh-planillas-grupos', page, filterAnio, filterMes, filterQuincena],
        queryFn: async () => (await axios.get('/api/rh/planillas/grupos', {
            params: { page, anio: filterAnio, mes: filterMes || undefined, quincena: filterQuincena || undefined }
        })).data
    });

    const items = response.data || [];

    const { data: cuentasActivas = [] } = useQuery({
        queryKey: ['rh-cuentas-activas'],
        queryFn: async () => (await axios.get('/api/rh/planillas/cuentas-activas')).data,
        enabled: isModalOpen
    });

    // Auto-calculate with 500ms debounce + auto-save when dirty
    useEffect(() => {
        if (!empleadoId || !detalles || detalles.length === 0) return;
        const timer = setTimeout(async () => {
            setCalculando(true);
            try {
                const res = await axios.post('/api/rh/planillas/calcular', {
                    empleado_id: empleadoId,
                    detalles: detalles
                });
                setCalculo(res.data);

                if (autoSaveRef.current && !savingRef.current) {
                    autoSaveRef.current = false;
                    savingRef.current = true;
                    const data = {
                        empleado_id: empleadoId,
                        periodo_anio: periodoAnio,
                        periodo_mes: periodoMes,
                        quincena,
                        dias_trabajados: diasTrabajados,
                        detalles: detalles,
                        total_percepciones: res.data.total_percepciones,
                        total_deducciones: res.data.total_deducciones,
                        descuento_isss: res.data.descuento_isss,
                        descuento_afp: res.data.descuento_afp,
                        descuento_renta: res.data.descuento_renta,
                        monto_recibir: res.data.monto_recibir
                    };
                    try {
                        const saveRes = await (selected?.id
                            ? axios.put(`/api/rh/planillas/${selected.id}`, data)
                            : axios.post('/api/rh/planillas', data));
                        queryClient.invalidateQueries({ queryKey: ['rh-planillas-grupos'] });
                        if (empleadoId) delete cacheRef.current[empleadoId];
                        if (!selected?.id) {
                            setSelected({ id: saveRes.data.id, empleado_id: empleadoId });
                        }
                    } catch (err) {
                        toast.error(err.response?.data?.message || 'Error al guardar');
                    } finally {
                        savingRef.current = false;
                    }
                }
            } catch {
                setCalculo(null);
            } finally {
                setCalculando(false);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [empleadoId, detalles]);

    const handleGenerar = async () => {
        if (!quincena) return toast.error('Seleccione una quincena');

        try {
            const check = await axios.get('/api/rh/planillas/grupos', {
                params: { anio: periodoAnio, mes: periodoMes, quincena, limit: 1 }
            });
            if (check.data.total > 0) {
                const ok = await confirm({
                    title: '¿Regenerar planilla?',
                    message: `Ya existen ${check.data.total} planilla(s) para ${months.find(m => m.value === periodoMes)?.label} ${periodoAnio} (${quincena === 'primera' ? '1ra' : '2da'}). Al regenerar se eliminarán y crearán de nuevo. ¿Continuar?`,
                    confirmLabel: 'Si, regenerar',
                    variant: 'danger'
                });
                if (!ok) return;
            }
        } catch { /* seguir */ }

        setGenerando(true);
        try {
            const res = await axios.post('/api/rh/planillas/generar', {
                periodo_anio: periodoAnio,
                periodo_mes: periodoMes,
                quincena
            });
            toast.success(`Planilla generada para ${res.data.total} empleados`);
            setPeriodoBloqueado(true);
            cacheRef.current = {};
            setDetalles([]);
            setCalculo(null);
            setEmpleadoId('');
            setEmpleadoData(null);
            setCodigoInput('');
            setSelected(null);
            queryClient.invalidateQueries({ queryKey: ['rh-planillas-grupos'] });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al generar planilla');
        } finally {
            setGenerando(false);
        }
    };

    const cacheDetallesActual = () => {
        if (empleadoId) {
            cacheRef.current[empleadoId] = { detalles: [...detalles], calculo: calculo ? { ...calculo } : null };
        }
    };

    const loadEmpleado = async (id) => {
        cacheDetallesActual();

        const cached = cacheRef.current[id];
        const cachedPlanillaId = cached?.planilla_id;

        try {
            const params = { periodo_anio: periodoAnio, periodo_mes: periodoMes, quincena };
            const res = await axios.get(`/api/rh/planillas/empleado/${id}`, { params });
            const data = res.data;
            setEmpleadoData(data);
            setEmpleadoId(id);
            setCodigoInput(data.codigo);

            if (cached) {
                setDetalles(cached.detalles);
                setCalculo(cached.calculo);
                setSelected(cachedPlanillaId ? { id: cachedPlanillaId, empleado_id: id } : null);
            } else if (data.planilla_id) {
                setSelected({ id: data.planilla_id, empleado_id: id });
                setDetalles(data.detalles || []);
                const tot = data.totales;
                const calc = tot ? {
                    total_percepciones: parseFloat(tot.total_percepciones || 0),
                    descuento_isss: parseFloat(tot.descuento_isss || 0),
                    descuento_afp: parseFloat(tot.descuento_afp || 0),
                    descuento_renta: parseFloat(tot.descuento_renta || 0),
                    total_deducciones: parseFloat(tot.total_deducciones || 0),
                    monto_recibir: parseFloat(tot.monto_recibir || 0)
                } : null;
                setCalculo(calc);
                cacheRef.current[id] = { detalles: data.detalles || [], calculo: calc, planilla_id: data.planilla_id };
            } else {
                setSelected(null);
                setCalculo(null);
                buildDetalles(data);
            }
        } catch {
            toast.error('Error al cargar datos del empleado');
        }
    };

    const buildDetalles = (emp) => {
        if (!cuentasActivas || cuentasActivas.length === 0) return;
        const sueldoBase = parseFloat(emp.sueldo_base || 0);
        const sueldoDiario = sueldoBase / 30;
        const list = cuentasActivas.map(c => {
            let valor = 0;
            if (c.tipo_valor === 'dias') {
                if (c.codigo === '01') valor = sueldoDiario * diasTrabajados;
            } else if (c.tipo_valor === 'valor') {
                valor = parseFloat(c.valor_base || 0);
            } else if (c.tipo_valor === 'porcentaje') {
                valor = sueldoBase * (parseFloat(c.valor_base || 0) / 100);
            }
            return {
                cuenta_id: c.id,
                codigo: c.codigo,
                descripcion: c.descripcion,
                operacion: c.operacion,
                tipo_valor: c.tipo_valor,
                valor_base: c.valor_base,
                valor_ingresado: Math.round(valor * 100) / 100,
                orden: c.orden || 0
            };
        });
        setDetalles(list);
    };

    useEffect(() => {
        if (isModalOpen && !selected && empleadoData && detalles.length === 0) {
            buildDetalles(empleadoData);
        }
    }, [cuentasActivas, isModalOpen]);

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

    const handleSelectEmployee = (emp) => {
        loadEmpleado(emp.id);
        setIsEmpModalOpen(false);
        setEmpSearch('');
    };

    const filteredEmployees = useMemo(() => {
        let list = empResponse.data || [];
        if (!empSearch) return list.slice(0, 20);
        const s = empSearch.toLowerCase();
        return list.filter(e => e.codigo?.toLowerCase().includes(s) || e.nombres?.toLowerCase().includes(s) || e.apellidos?.toLowerCase().includes(s)).slice(0, 30);
    }, [empResponse.data, empSearch]);

    const handleValorChange = (index, value) => {
        const updated = [...detalles];
        const d = updated[index];
        const raw = parseFloat(value) || 0;
        if (d.codigo === '01' && d.tipo_valor === 'dias') {
            const sueldoDiario = parseFloat(empleadoData?.sueldo_base || 0) / 30;
            d.valor_ingresado = Math.round(sueldoDiario * raw * 100) / 100;
        } else {
            d.valor_ingresado = raw;
        }
        setDetalles(updated);
        autoSaveRef.current = true;
        if (empleadoId) {
            cacheRef.current[empleadoId] = { detalles: updated, calculo: calculo ? { ...calculo } : null, planilla_id: selected?.id };
        }
    };

    const handleDownloadRecibosMasivos = async (anio, mes, quincena) => {
        try {
            const res = await axios.get('/api/rh/planillas/recibos-masivos', {
                params: { anio, mes, quincena },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Recibos_Planilla_${anio}_${mes}_${quincena}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Recibos masivos generados');
        } catch { toast.error('Error al generar recibos masivos'); }
    };

    const handleDownloadCSV = async (anio, mes, quincena) => {
        try {
            const res = await axios.get('/api/rh/planillas', {
                params: { anio, mes, quincena, limit: 9999 }
            });
            const rows = res.data.data || [];
            if (!rows.length) return toast.error('Sin datos');
            const csv = rows.map(r => {
                const nombre = `${r.empleado_nombres || ''} ${r.empleado_apellidos || ''}`.trim();
                return `${r.empleado_codigo || ''}\t${parseFloat(r.monto_recibir || 0).toFixed(2)}\t${nombre}`;
            }).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `PLANILLAS_${anio}${String(mes).padStart(2,'0')}_${quincena}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('CSV descargado');
        } catch { toast.error('Error al descargar CSV'); }
    };

    const cerrarMutation = useMutation({
        mutationFn: (data) => axios.post('/api/rh/planillas/cerrar-periodo', data),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['rh-planillas-grupos'] });
            toast.success(res.data.message);
        },
        onError: (error) => { toast.error(error.response?.data?.message || 'Error al cerrar periodo'); }
    });

    const handleCerrarPeriodo = async (item) => {
        const ok = await confirm({
            title: '¿Cerrar período?',
            message: `Se marcarán como pagadas todas las planillas de ${months.find(m => m.value === item.periodo_mes)?.label} ${item.periodo_anio} (${item.quincena === 'primera' ? '1ra' : '2da'}). ¿Confirmar?`,
            confirmLabel: 'Si, cerrar',
            variant: 'primary'
        });
        if (ok) {
            cerrarMutation.mutate({
                periodo_anio: item.periodo_anio,
                periodo_mes: item.periodo_mes,
                quincena: item.quincena
            });
        }
    };

    const eliminarMutation = useMutation({
        mutationFn: (data) => axios.post('/api/rh/planillas/eliminar-periodo', data),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['rh-planillas-grupos'] });
            toast.success(res.data.message);
        },
        onError: (error) => { toast.error(error.response?.data?.message || 'Error al eliminar periodo'); }
    });

    const handleEliminarPeriodo = async (item) => {
        const ok = await confirm({
            title: '¿Eliminar período?',
            message: `Se eliminarán todas las planillas de ${months.find(m => m.value === item.periodo_mes)?.label} ${item.periodo_anio} (${item.quincena === 'primera' ? '1ra' : '2da'}). Esta acción no se puede deshacer. ¿Confirmar?`,
            confirmLabel: 'Si, eliminar',
            variant: 'danger'
        });
        if (ok) {
            eliminarMutation.mutate({
                periodo_anio: item.periodo_anio,
                periodo_mes: item.periodo_mes,
                quincena: item.quincena
            });
        }
    };

    const resetForm = () => {
        setSelected(null);
        setEmpleadoId('');
        setEmpleadoData(null);
        setCodigoInput('');
        setPeriodoAnio(yearNow);
        setPeriodoMes(monthNow);
        setQuincena('primera');
        setDiasTrabajados(15);
        setDetalles([]);
        setCalculo(null);
        setPeriodoBloqueado(false);
        cacheRef.current = {};
    };

    const handleVerDetalle = (item) => {
        setSelected(null);
        setEmpleadoId('');
        setEmpleadoData(null);
        setCodigoInput('');
        setPeriodoAnio(item.periodo_anio);
        setPeriodoMes(item.periodo_mes);
        setQuincena(item.quincena);
        setDiasTrabajados(15);
        setDetalles([]);
        setCalculo(null);
        setPeriodoBloqueado(true);
        setIsModalOpen(true);
    };

    const estadoBadge = (item) => {
        if (item.estado_general === 'pagada') return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle size={11} />Pagada</span>;
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Pendiente</span>;
    };

    const percTotal = detalles.reduce((s, d) => s + (d.operacion === 'sumar' ? parseFloat(d.valor_ingresado || 0) : 0), 0);

    const sinEmpleado = !empleadoId;

    return (
        <div className="space-y-3 text-slate-900">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Planillas</h2>
                    <p className="text-slate-500 text-[11px] font-medium">Gestión de planillas quincenales</p>
                </div>
                <button onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                    <Plus size={20} /><span>Nueva Planilla</span>
                </button>
            </div>

            <div className="flex gap-3 items-end">
                <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Año</label>
                    <select value={filterAnio} onChange={e => { setFilterAnio(parseInt(e.target.value)); setPage(1); }}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/10">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Mes</label>
                    <select value={filterMes} onChange={e => { setFilterMes(parseInt(e.target.value)); setPage(1); }}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/10">
                        <option value="">Todos</option>
                        {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Quincena</label>
                    <select value={filterQuincena} onChange={e => { setFilterQuincena(e.target.value); setPage(1); }}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/10">
                        <option value="">Todas</option>
                        <option value="primera">Primera</option>
                        <option value="segunda">Segunda</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table headers={['Periodo', 'Q', '# Emp', 'Sueldos', 'Perc.', 'ISSS', 'AFP', 'Renta', 'Ded.', 'Neto', 'Estado', 'Acciones']}
                    data={items} isLoading={isLoading}
                    renderRow={(item) => (
                        <tr key={`${item.periodo_anio}-${item.periodo_mes}-${item.quincena}`} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-3 py-1">
                                <span className="text-xs font-bold text-slate-700">{months.find(m => m.value === item.periodo_mes)?.label} {item.periodo_anio}</span>
                            </td>
                            <td className="px-3 py-1">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">{item.quincena === 'primera' ? '1ra' : '2da'}</span>
                            </td>
                            <td className="px-3 py-1">
                                <span className="text-xs font-bold text-slate-800">{item.total_empleados}</span>
                            </td>
                            <td className="px-3 py-1 text-xs text-slate-700">${parseFloat(item.total_sueldos || 0).toFixed(2)}</td>
                            <td className="px-3 py-1 text-xs font-bold text-indigo-600">${parseFloat(item.total_percepciones || 0).toFixed(2)}</td>
                            <td className="px-3 py-1 text-xs text-slate-600">${parseFloat(item.total_isss || 0).toFixed(2)}</td>
                            <td className="px-3 py-1 text-xs text-slate-600">${parseFloat(item.total_afp || 0).toFixed(2)}</td>
                            <td className="px-3 py-1 text-xs text-slate-600">${parseFloat(item.total_renta || 0).toFixed(2)}</td>
                            <td className="px-3 py-1 text-xs font-bold text-red-600">${parseFloat(item.total_deducciones || 0).toFixed(2)}</td>
                            <td className="px-3 py-1 text-xs font-bold text-emerald-600">${parseFloat(item.total_neto || 0).toFixed(2)}</td>
                            <td className="px-3 py-1">{estadoBadge(item)}</td>
                            <td className="px-3 py-1 flex gap-1">
                                <button onClick={() => handleVerDetalle(item)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar"><Edit size={15} /></button>
                                <button onClick={() => handleDownloadRecibosMasivos(item.periodo_anio, item.periodo_mes, item.quincena)} className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Recibos Masivos">
                                    <Download size={15} />
                                </button>
                                <button onClick={() => handleDownloadCSV(item.periodo_anio, item.periodo_mes, item.quincena)} className="p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors" title="CSV">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                </button>
                                <button onClick={() => handleCerrarPeriodo(item)} className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Cerrar"><Lock size={15} /></button>
                                <button onClick={() => handleEliminarPeriodo(item)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={15} /></button>
                            </td>
                        </tr>
                    )} />
            </div>

            <Pagination currentPage={page} totalPages={response.totalPages} totalItems={response.total}
                onPageChange={setPage} itemsOnPage={items.length} isLoading={isLoading} />

            {/* --- Creation/Edit Modal --- */}
            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }}
                title="Planilla Quincenal" maxWidth="max-w-6xl">
                <div className="space-y-4 pb-4">
                    {/* Header: Periodo + Generar */}
                    <div className="grid grid-cols-8 gap-3">
                        <div>
                            <label className={labelCls}>Año</label>
                            <select value={periodoAnio} onChange={e => setPeriodoAnio(parseInt(e.target.value))} disabled={periodoBloqueado} className={fieldCls}>
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Mes</label>
                            <select value={periodoMes} onChange={e => setPeriodoMes(parseInt(e.target.value))} disabled={periodoBloqueado} className={fieldCls}>
                                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Quincena</label>
                            <select value={quincena} onChange={e => setQuincena(e.target.value)} disabled={periodoBloqueado} className={fieldCls}>
                                <option value="primera">Primera</option>
                                <option value="segunda">Segunda</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Días Trab.</label>
                            <input type="number" min="1" max="30" value={diasTrabajados}
                                onChange={e => setDiasTrabajados(parseInt(e.target.value) || 15)} disabled={periodoBloqueado} className={fieldCls} />
                        </div>
                        <div className="col-span-4 flex items-end">
                            {periodoBloqueado ? (
                                <div className="w-full flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg font-bold text-sm border border-emerald-200">
                                    <CheckCircle size={16} /> Planilla generada
                                </div>
                            ) : (
                                <button type="button" onClick={handleGenerar} disabled={generando}
                                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50">
                                    {generando ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                    {generando ? 'Generando...' : 'Generar'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Employee Search */}
                    <div>
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

                    {/* Employee Info (always visible) */}
                    {empleadoData ? (
                        <div className="flex items-center gap-4 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs">
                            <User size={14} className="text-indigo-400 shrink-0" />
                            <span className="font-bold text-slate-700">{empleadoData.nombres} {empleadoData.apellidos}</span>
                            <span className="text-slate-400">|</span>
                            <span className="text-slate-500">{empleadoData.cargo_nombre || <span className="italic">Sin cargo</span>}</span>
                            <span className="text-slate-400">|</span>
                            <span className="text-slate-500">{empleadoData.departamento_nombre || <span className="italic">Sin depto.</span>}</span>
                            <span className="ml-auto font-bold text-indigo-600">Sueldo: ${parseFloat(empleadoData.sueldo_base || 0).toFixed(2)}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4 bg-slate-50/50 px-3 py-2 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                            <User size={14} className="text-slate-300 shrink-0" />
                            <span className="italic">Sin empleado seleccionado</span>
                        </div>
                    )}

                    {/* Two-column layout: always visible */}
                    <div className="flex gap-4">
                        {/* Left: Cuentas Table */}
                        <div className="flex-1 min-w-0 bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                                <span className="text-[11px] font-bold text-slate-500 uppercase">Cuentas de Planilla</span>
                            </div>
                            <div className="overflow-x-auto" style={{ maxHeight: sinEmpleado ? '120px' : '420px' }}>
                                {sinEmpleado ? (
                                    <div className="flex items-center justify-center h-[100px] text-slate-300 text-xs italic">
                                        Seleccione un empleado para ver sus cuentas
                                    </div>
                                ) : detalles.length === 0 ? (
                                    <div className="flex items-center justify-center h-[100px] text-slate-300 text-xs italic">
                                        Cargando cuentas...
                                    </div>
                                ) : (
                                    <table className="w-full text-xs">
                                        <thead className="sticky top-0 z-10 bg-white">
                                            <tr className="border-b border-slate-100">
                                                <th className="text-left px-2 py-1.5 text-[10px] font-bold text-slate-500 uppercase w-12">Cód.</th>
                                                <th className="text-left px-2 py-1.5 text-[10px] font-bold text-slate-500 uppercase">Descripción</th>
                                                <th className="text-center px-2 py-1.5 text-[10px] font-bold text-slate-500 uppercase w-10">Op.</th>
                                                <th className="text-center px-2 py-1.5 text-[10px] font-bold text-slate-500 uppercase w-14">Tipo</th>
                                                <th className="text-right px-2 py-1.5 text-[10px] font-bold text-slate-500 uppercase w-20">
                                                    {detalles.some(d => d.codigo === '01' && d.tipo_valor === 'dias') ? 'Días' : 'Valor'}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detalles.map((d, i) => (
                                                <tr key={i} className={`border-b border-slate-50 hover:bg-slate-50/50 ${d.operacion === 'sumar' ? '' : 'bg-red-50/20'}`}>
                                                    <td className="px-2 py-1 font-bold text-slate-800">{d.codigo}</td>
                                                    <td className="px-2 py-1 text-slate-600 truncate max-w-[200px]">{d.descripcion}</td>
                                                    <td className="px-2 py-1 text-center">
                                                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${d.operacion === 'sumar' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                                            {d.operacion === 'sumar' ? '+' : '−'}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-1 text-center text-slate-400 text-[10px]">{d.tipo_valor}</td>
                                                    <td className="px-2 py-1 text-right">
                                                        <input type="number"
                                                            step={d.codigo === '01' && d.tipo_valor === 'dias' ? '1' : '0.01'}
                                                            min="0"
                                                            value={d.codigo === '01' && d.tipo_valor === 'dias'
                                                                ? Math.round(d.valor_ingresado / (parseFloat(empleadoData?.sueldo_base || 1) / 30))
                                                                : d.valor_ingresado}
                                                            onChange={e => handleValorChange(i, e.target.value)}
                                                            className="w-full max-w-[90px] px-2 py-1 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-xs font-medium text-right" />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {/* Right: Summary Panel */}
                        <div className="w-72 shrink-0">
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase">Resumen</span>
                                </div>
                                <div className="p-4 space-y-4">
                                    {sinEmpleado ? (
                                        <div className="text-slate-300 text-xs italic text-center py-4">Seleccione un empleado</div>
                                    ) : (
                                        <>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valor Devengado</label>
                                                <div className="text-2xl font-black text-indigo-600 mt-1">${percTotal.toFixed(2)}</div>
                                            </div>

                                            <div className="border-t border-slate-100 pt-4 space-y-2">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deducciones de Ley</label>
                                                {calculando ? (
                                                    <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                                                        <Loader2 size={14} className="animate-spin" /> Calculando...
                                                    </div>
                                                ) : calculo ? (
                                                    <div className="space-y-1.5">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-slate-600">ISSS {calculo.isss_info?.porcentaje ? `(${calculo.isss_info.porcentaje}%)` : ''}</span>
                                                            <span className="font-bold text-red-500">$ {calculo.descuento_isss.toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-slate-600">AFP {calculo.afp_info?.porcentaje ? `(${calculo.afp_info.porcentaje}%)` : ''}</span>
                                                            <span className="font-bold text-red-500">$ {calculo.descuento_afp.toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-slate-600">Renta</span>
                                                            <span className="font-bold text-red-500">$ {calculo.descuento_renta.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-slate-300 italic">Ajuste los valores para calcular</p>
                                                )}
                                            </div>

                                            <div className="border-t border-slate-100 pt-4">
                                                {calculando ? (
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total a Pagar</label>
                                                        <div className="text-slate-300 text-lg font-black mt-1">—</div>
                                                    </div>
                                                ) : calculo ? (
                                                    <>
                                                        <div className="flex justify-between text-xs mb-2">
                                                            <span className="text-slate-500">Deducciones</span>
                                                            <span className="font-bold text-red-500">$ {calculo.total_deducciones.toFixed(2)}</span>
                                                        </div>
                                                        <div className="border-t border-slate-200 pt-2">
                                                            <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Total a Pagar</label>
                                                            <div className="text-xl font-black text-emerald-600 mt-1">$ {calculo.monto_recibir.toFixed(2)}</div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total a Pagar</label>
                                                        <div className="text-slate-300 text-lg font-black mt-1">—</div>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </Modal>

            {/* --- Employee Search Modal (F3) --- */}
            {isEmpModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                    onClick={() => { setIsEmpModalOpen(false); setEmpSearch(''); }}>
                    <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col"
                        onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Seleccionar Empleado</h3>
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Busque por código o nombre</p>
                            </div>
                            <button onClick={() => { setIsEmpModalOpen(false); setEmpSearch(''); }}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input autoFocus type="text" placeholder="Buscar por nombre o código..."
                                    value={empSearch} onChange={e => setEmpSearch(e.target.value)}
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
                                {empLoading && (
                                    <div className="py-12 text-center text-slate-400">
                                        <Loader2 size={40} className="mx-auto opacity-40 mb-2 animate-spin" />
                                        <p className="font-bold uppercase tracking-widest text-xs italic">Cargando empleados...</p>
                                    </div>
                                )}
                                {!empLoading && filteredEmployees.length === 0 && (
                                    <div className="py-12 text-center text-slate-400">
                                        <Users size={40} className="mx-auto opacity-20 mb-2" />
                                        <p className="font-bold uppercase tracking-widest text-xs italic">No se encontraron empleados</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-center">
                            <span className="text-[10px] text-slate-400 font-medium">Presione <kbd className="bg-slate-200 px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-600">F3</kbd> para abrir esta ventana desde el formulario</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Planillas;
