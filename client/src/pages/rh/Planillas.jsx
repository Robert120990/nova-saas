import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import { useConfirm } from '../../context/ConfirmContext';
import { toast } from 'sonner';
import { Plus, Edit, Search, Users, Loader2, User, CheckCircle, Zap, Trash2, Lock, ArrowLeft, FileText, ReceiptText, RefreshCw, UserX, UserPlus } from 'lucide-react';
import { useDirtyTracker } from '../../hooks/useDirtyTracker';
import EmployeeSearchModal from '../../components/rh/EmployeeSearchModal';
import PlanillaReportModal from '../../components/rh/PlanillaReportModal';
import PlanillaExportModal from '../../components/rh/PlanillaExportModal';

const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px] font-medium";
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

const calcularTarifaDetalle = (d, sueldoBase) => {
    const sueldo = parseFloat(sueldoBase || 0);
    const sueldoDiario = sueldo / 30;
    const valorHoraOrdinaria = sueldoDiario / 8;

    if (d.tipo_valor === 'horas') {
        let factor = 2.0;
        const descUpper = (d.descripcion || '').toUpperCase();
        if (d.valor_base_config && parseFloat(d.valor_base_config) > 0) {
            const vb = parseFloat(d.valor_base_config);
            if (vb <= 5) factor = vb;
            else return vb;
        } else if (descUpper.includes('NOCTURNA')) {
            factor = 2.5;
        } else if (d.operacion === 'restar') {
            factor = 1.0;
        } else {
            factor = 2.0;
        }
        return valorHoraOrdinaria * factor;
    }

    if (d.tipo_valor === 'dias') {
        let factor = 1.0;
        if (d.valor_base_config && parseFloat(d.valor_base_config) > 0) {
            const vb = parseFloat(d.valor_base_config);
            if (vb <= 5) factor = vb;
        }
        return sueldoDiario * factor;
    }

    return 1;
};

const calcularMontoDetalle = (d, cantidad, sueldoBase) => {
    const qty = parseFloat(cantidad) || 0;
    const sueldo = parseFloat(sueldoBase || 0);

    if (d.tipo_valor === 'horas') {
        const tarifa = calcularTarifaDetalle(d, sueldo);
        return Math.round(qty * tarifa * 100) / 100;
    }

    if (d.tipo_valor === 'dias') {
        const tarifa = calcularTarifaDetalle(d, sueldo);
        return Math.round(qty * tarifa * 100) / 100;
    }

    if (d.tipo_valor === 'porcentaje') {
        const pct = qty > 0 ? qty : parseFloat(d.valor_base_config || d.valor_base || 0);
        return Math.round(sueldo * (pct / 100) * 100) / 100;
    }

    // tipo_valor === 'valor'
    return Math.round(qty * 100) / 100;
};

const Planillas = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const employeeInputRef = useRef(null);

    const [activeTab, setActiveTab] = useState('historial'); // 'historial' | 'nuevo'
    const [selected, setSelected] = useState(null);
    const [filterAnio, setFilterAnio] = useState(yearNow);
    const [filterMes, setFilterMes] = useState(monthNow);
    const [filterQuincena, setFilterQuincena] = useState('');
    const [page, setPage] = useState(1);

    const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
    const [previewPeriodo, setPreviewPeriodo] = useState(null);
    const [exportModalConfig, setExportModalConfig] = useState(null);

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

    useDirtyTracker('planillas', activeTab === 'nuevo' && empleadoId && detalles.length > 0);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F3') {
                e.preventDefault();
                if (activeTab === 'nuevo') {
                    setIsEmpModalOpen(true);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTab]);

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
        enabled: activeTab === 'nuevo'
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
                setDiasTrabajados(data.dias_trabajados !== undefined && data.dias_trabajados !== null ? parseInt(data.dias_trabajados) : 15);
                const sueldoBase = parseFloat(data.sueldo_base || 0);
                const sueldoDiario = sueldoBase / 30;

                const parsedDetalles = (data.detalles || []).map(d => {
                    let cantidad = 0;
                    if (d.cantidad !== undefined) {
                        cantidad = d.cantidad;
                    } else if (d.valor_base !== null && d.valor_base !== undefined && parseFloat(d.valor_base) > 0) {
                        cantidad = parseFloat(d.valor_base);
                    } else {
                        if (d.tipo_valor === 'dias') {
                            cantidad = sueldoDiario > 0 ? Math.round(parseFloat(d.valor_ingresado || 0) / sueldoDiario) : 0;
                        } else if (d.tipo_valor === 'horas') {
                            const tarifa = calcularTarifaDetalle(d, sueldoBase);
                            const val = parseFloat(d.valor_ingresado || 0);
                            if (val > 0 && val <= 40 && tarifa > 0 && Math.abs(val - Math.round(val * tarifa * 100) / 100) > 0.01) {
                                cantidad = val;
                            } else if (tarifa > 0) {
                                cantidad = Math.round((val / tarifa) * 100) / 100;
                            } else {
                                cantidad = val;
                            }
                        } else if (d.tipo_valor === 'porcentaje') {
                            cantidad = sueldoBase > 0 ? Math.round((parseFloat(d.valor_ingresado || 0) / sueldoBase) * 10000) / 100 : 0;
                        } else {
                            cantidad = parseFloat(d.valor_ingresado || 0);
                        }
                    }
                    const monto = calcularMontoDetalle(d, cantidad, sueldoBase);
                    return {
                        ...d,
                        cantidad: cantidad,
                        valor_base: cantidad,
                        valor_ingresado: monto
                    };
                });

                setDetalles(parsedDetalles);
                const tot = data.totales;
                const otrasDed = parsedDetalles.filter(d => d.operacion === 'restar').reduce((s, d) => s + parseFloat(d.valor_ingresado || 0), 0);
                const isss = parseFloat(tot?.descuento_isss || 0);
                const afp = parseFloat(tot?.descuento_afp || 0);
                const renta = parseFloat(tot?.descuento_renta || 0);
                const totalDed = tot ? Math.round((isss + afp + renta + otrasDed) * 100) / 100 : 0;
                const totPercep = parseFloat(tot?.total_percepciones || 0);
                const calc = tot ? {
                    total_percepciones: totPercep,
                    total_deducciones_cuentas: otrasDed,
                    descuento_isss: isss,
                    descuento_afp: afp,
                    descuento_renta: renta,
                    total_deducciones: totalDed,
                    monto_recibir: Math.round((totPercep - totalDed) * 100) / 100
                } : null;
                setCalculo(calc);
                cacheRef.current[id] = { detalles: parsedDetalles, calculo: calc, planilla_id: data.planilla_id };
            } else {
                setSelected(null);
                setCalculo(null);
                const esAusente = data.en_vacaciones === 1 || data.incapacitado === 1;
                const initialDias = esAusente ? 0 : 15;
                setDiasTrabajados(initialDias);
                buildDetalles(data, initialDias);
            }
        } catch {
            toast.error('Error al cargar datos del empleado');
        }
    };

    const buildDetalles = (emp, forcedDias = null) => {
        if (!cuentasActivas || cuentasActivas.length === 0) return;
        const sueldoBase = parseFloat(emp?.sueldo_base || 0);
        const bonificacionFija = parseFloat(emp?.bonificacion_fija || 0);
        const diasToUse = forcedDias !== null ? forcedDias : diasTrabajados;

        const activeDiscounts = (emp?.descuentos_programados || []).filter(d => {
            const q = d.quincena || d.aplicar_en;
            if (quincena === 'primera' && q === 'segunda') return false;
            if (quincena === 'segunda' && q === 'primera') return false;
            return true;
        });

        const list = cuentasActivas.map(c => {
            let cantidad = 0;
            if (c.operacion === 'sumar' && (c.codigo === '02' || (c.descripcion || '').toUpperCase().includes('BONIF'))) {
                cantidad = bonificacionFija;
            } else if (c.tipo_valor === 'dias' && c.codigo === '01') {
                cantidad = diasToUse;
            } else {
                // Check if account matches any active scheduled discount
                const matchDiscount = activeDiscounts.find(d => {
                    if (d.cuenta_id && Number(d.cuenta_id) === Number(c.id)) return true;
                    if (d.cuenta_codigo && d.cuenta_codigo === c.codigo) return true;
                    const desc = (c.descripcion || '').toLowerCase();
                    const nom = (d.desc_nombre || d.nombre || d.descripcion || '').toLowerCase();
                    if (nom.includes('prestamo') && desc.includes('prestamo')) return true;
                    if (nom.includes('procuraduria') && desc.includes('procuraduria')) return true;
                    if ((nom.includes('fsv') || nom.includes('fondo social')) && (desc.includes('fsv') || desc.includes('vivienda') || desc.includes('fondo social'))) return true;
                    if (nom.includes('anticipo') && desc.includes('anticipo')) return true;
                    return false;
                });

                if (matchDiscount) {
                    cantidad = parseFloat(matchDiscount.valor !== undefined ? matchDiscount.valor : (matchDiscount.monto_cuota || 0));
                } else if (c.tipo_valor === 'valor' || c.tipo_valor === 'porcentaje' || c.tipo_valor === 'horas') {
                    cantidad = parseFloat(c.valor_base || 0);
                }
            }
            const monto = calcularMontoDetalle(c, cantidad, sueldoBase);
            return {
                cuenta_id: c.id,
                codigo: c.codigo,
                descripcion: c.descripcion,
                operacion: c.operacion,
                tipo_valor: c.tipo_valor,
                valor_base_config: c.valor_base,
                valor_base: cantidad,
                cantidad: cantidad,
                valor_ingresado: monto,
                orden: c.orden || 0
            };
        });
        setDetalles(list);
    };

    useEffect(() => {
        if (activeTab === 'nuevo' && !selected && empleadoData && detalles.length === 0) {
            buildDetalles(empleadoData);
        }
    }, [cuentasActivas, activeTab]);

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
    };

    const handleValorChange = (index, value) => {
        const updated = [...detalles];
        const d = { ...updated[index] };
        const raw = parseFloat(value) || 0;
        const sueldoBase = parseFloat(empleadoData?.sueldo_base || 0);

        d.cantidad = raw;
        d.valor_base = raw;
        d.valor_ingresado = calcularMontoDetalle(d, raw, sueldoBase);
        updated[index] = d;

        if (d.codigo === '01' && d.tipo_valor === 'dias') {
            setDiasTrabajados(raw);
        }

        setDetalles(updated);
        autoSaveRef.current = true;
        if (empleadoId) {
            cacheRef.current[empleadoId] = { detalles: updated, calculo: calculo ? { ...calculo } : null, planilla_id: selected?.id };
        }
    };

    const handleDiasTrabajadosChange = (newDias) => {
        setDiasTrabajados(newDias);
        if (detalles && detalles.length > 0 && empleadoData) {
            const updated = detalles.map(d => {
                if (d.codigo === '01' && d.tipo_valor === 'dias') {
                    const monto = calcularMontoDetalle(d, newDias, empleadoData.sueldo_base);
                    return { ...d, cantidad: newDias, valor_base: newDias, valor_ingresado: monto };
                }
                return d;
            });
            setDetalles(updated);
            autoSaveRef.current = true;
        }
    };


    const sincronizarMutation = useMutation({
        mutationFn: (data) => axios.post('/api/rh/planillas/sincronizar', data),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['rh-planillas-grupos'] });
            toast.success(res.data.message);
            if (empleadoId) {
                loadEmpleado(empleadoId);
            }
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al sincronizar planilla');
        }
    });

    const handleSincronizar = async () => {
        const ok = await confirm({
            title: '¿Sincronizar planilla?',
            message: `Se buscarán empleados nuevos o faltantes y se actualizarán novedades de vacaciones/incapacidades. Todas las horas extras, turnos y valores que ya ingresaste se mantendrán 100% intactos. ¿Continuar?`,
            confirmLabel: 'Sí, sincronizar',
            variant: 'primary'
        });
        if (ok) {
            sincronizarMutation.mutate({
                periodo_anio: periodoAnio,
                periodo_mes: periodoMes,
                quincena
            });
        }
    };

    const excluirMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/rh/planillas/${id}`),
        onSuccess: () => {
            toast.success('Empleado excluido de esta planilla quincenal');
            queryClient.invalidateQueries({ queryKey: ['rh-planillas-grupos'] });
            if (empleadoId) delete cacheRef.current[empleadoId];
            setSelected(null);
            setCalculo(null);
            setDetalles([]);
            setEmpleadoId('');
            setEmpleadoData(null);
            setCodigoInput('');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al excluir empleado');
        }
    });

    const handleExcluirEmpleado = async () => {
        if (!selected?.id || !empleadoData) return;
        const ok = await confirm({
            title: '¿Excluir de esta planilla?',
            message: `¿Desea retirar a ${empleadoData.nombres} ${empleadoData.apellidos} de la planilla de este período? No se borrará del catálogo general de empleados, únicamente se excluye de esta quincena.`,
            confirmLabel: 'Sí, excluir',
            variant: 'danger'
        });
        if (ok) {
            excluirMutation.mutate(selected.id);
        }
    };

    const handleAgregarEmpleado = async () => {
        if (!empleadoId || !calculo) return;
        savingRef.current = true;
        try {
            const data = {
                empleado_id: empleadoId,
                periodo_anio: periodoAnio,
                periodo_mes: periodoMes,
                quincena,
                dias_trabajados: diasTrabajados,
                detalles: detalles,
                total_percepciones: calculo.total_percepciones,
                total_deducciones: calculo.total_deducciones,
                descuento_isss: calculo.descuento_isss,
                descuento_afp: calculo.descuento_afp,
                descuento_renta: calculo.descuento_renta,
                monto_recibir: calculo.monto_recibir
            };
            const saveRes = await axios.post('/api/rh/planillas', data);
            setSelected({ id: saveRes.data.id, empleado_id: empleadoId });
            queryClient.invalidateQueries({ queryKey: ['rh-planillas-grupos'] });
            toast.success(`${empleadoData?.nombres || 'Empleado'} agregado a la planilla`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error al agregar a la planilla');
        } finally {
            savingRef.current = false;
        }
    };

    const handleDownloadCSV = async (anio, mes, quincena, branchIds = [], departamentoIds = []) => {
        try {
            const params = { anio, mes, quincena, limit: 9999 };
            if (branchIds && branchIds.length > 0) {
                params.branch_ids = Array.isArray(branchIds) ? branchIds.join(',') : branchIds;
            }
            if (departamentoIds && departamentoIds.length > 0) {
                params.departamento_ids = Array.isArray(departamentoIds) ? departamentoIds.join(',') : departamentoIds;
            }
            const res = await axios.get('/api/rh/planillas', { params });
            const rows = res.data.data || [];
            if (!rows.length) return toast.error('Sin datos para los filtros seleccionados');
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

    const handleConfirmExport = ({ tipo, anio, mes, quincena, branch_ids, departamento_ids, formato }) => {
        if (tipo === 'csv') {
            handleDownloadCSV(anio, mes, quincena, branch_ids, departamento_ids);
        } else {
            setPreviewPeriodo({
                anio,
                mes,
                quincena,
                tipo,
                branch_ids,
                departamento_ids,
                formato
            });
        }
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

    const handleVerPlanillaActual = async () => {
        if (autoSaveRef.current && !savingRef.current && empleadoId && calculo) {
            autoSaveRef.current = false;
            savingRef.current = true;
            try {
                const data = {
                    empleado_id: empleadoId,
                    periodo_anio: periodoAnio,
                    periodo_mes: periodoMes,
                    quincena,
                    dias_trabajados: diasTrabajados,
                    detalles: detalles,
                    total_percepciones: calculo.total_percepciones,
                    total_deducciones: calculo.total_deducciones,
                    descuento_isss: calculo.descuento_isss,
                    descuento_afp: calculo.descuento_afp,
                    descuento_renta: calculo.descuento_renta,
                    monto_recibir: calculo.monto_recibir
                };
                if (selected?.id) {
                    await axios.put(`/api/rh/planillas/${selected.id}`, data);
                } else {
                    await axios.post('/api/rh/planillas', data);
                }
                queryClient.invalidateQueries({ queryKey: ['rh-planillas-grupos'] });
            } catch (e) {
                console.error('Error saving before preview:', e);
            } finally {
                savingRef.current = false;
            }
        }

        setExportModalConfig({
            anio: periodoAnio,
            mes: periodoMes,
            quincena: quincena,
            tipo: 'planilla'
        });
    };

    const handleVerRecibosActual = async () => {
        if (autoSaveRef.current && !savingRef.current && empleadoId && calculo) {
            autoSaveRef.current = false;
            savingRef.current = true;
            try {
                const data = {
                    empleado_id: empleadoId,
                    periodo_anio: periodoAnio,
                    periodo_mes: periodoMes,
                    quincena,
                    dias_trabajados: diasTrabajados,
                    detalles: detalles,
                    total_percepciones: calculo.total_percepciones,
                    total_deducciones: calculo.total_deducciones,
                    descuento_isss: calculo.descuento_isss,
                    descuento_afp: calculo.descuento_afp,
                    descuento_renta: calculo.descuento_renta,
                    monto_recibir: calculo.monto_recibir
                };
                if (selected?.id) {
                    await axios.put(`/api/rh/planillas/${selected.id}`, data);
                } else {
                    await axios.post('/api/rh/planillas', data);
                }
                queryClient.invalidateQueries({ queryKey: ['rh-planillas-grupos'] });
            } catch (e) {
                console.error('Error saving before preview:', e);
            } finally {
                savingRef.current = false;
            }
        }

        setExportModalConfig({
            anio: periodoAnio,
            mes: periodoMes,
            quincena: quincena,
            tipo: 'recibos'
        });
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
        resetForm();
        setPeriodoAnio(item.periodo_anio);
        setPeriodoMes(item.periodo_mes);
        setQuincena(item.quincena);
        setDiasTrabajados(15);
        setPeriodoBloqueado(true);
        setActiveTab('nuevo');
    };

    const estadoBadge = (item) => {
        if (item.estado_general === 'pagada') return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle size={11} />Pagada</span>;
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Pendiente</span>;
    };

    const percTotal = detalles.reduce((s, d) => s + (d.operacion === 'sumar' ? parseFloat(d.valor_ingresado || 0) : 0), 0);
    const otrasDedActual = detalles.reduce((s, d) => s + (d.operacion === 'restar' ? parseFloat(d.valor_ingresado || 0) : 0), 0);
    const sueldoQuincActual = empleadoData
        ? (detalles.find(d => d.codigo === '01')?.valor_ingresado !== undefined
            ? parseFloat(detalles.find(d => d.codigo === '01')?.valor_ingresado || 0)
            : ((parseFloat(empleadoData.sueldo_base || 0) / 30) * diasTrabajados))
        : 0;
    const ingresosAdicActual = Math.max(0, Math.round((percTotal - sueldoQuincActual) * 100) / 100);
    const sinEmpleado = !empleadoId;

    return (
        <div className="space-y-4 text-slate-900 pb-12">
            {activeTab === 'historial' ? (
                <>
                    {/* Header List View */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <div>
                            <h2 className="text-xl font-bold tracking-tight text-slate-900">Planillas</h2>
                            <p className="text-slate-500 text-xs font-medium">Gestión y control de planillas quincenales</p>
                        </div>
                        <button
                            onClick={() => { resetForm(); setActiveTab('nuevo'); }}
                            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                        >
                            <Plus size={18} />
                            <span>Nueva Planilla</span>
                        </button>
                    </div>

                    {/* Filter Bar */}
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-end">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Año</label>
                            <select
                                value={filterAnio}
                                onChange={e => { setFilterAnio(parseInt(e.target.value)); setPage(1); }}
                                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Mes</label>
                            <select
                                value={filterMes}
                                onChange={e => { setFilterMes(parseInt(e.target.value)); setPage(1); }}
                                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <option value="">Todos</option>
                                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Quincena</label>
                            <select
                                value={filterQuincena}
                                onChange={e => { setFilterQuincena(e.target.value); setPage(1); }}
                                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <option value="">Todas</option>
                                <option value="primera">Primera</option>
                                <option value="segunda">Segunda</option>
                            </select>
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <Table
                            headers={['Periodo', 'Q', '# Emp', 'Sueldo Quinc.', 'Ing. Adic.', 'Total Dev.', 'ISSS', 'AFP', 'Renta', 'Ded.', 'Neto', 'Estado', 'Acciones']}
                            data={items}
                            isLoading={isLoading}
                            renderRow={(item) => (
                                <tr key={`${item.periodo_anio}-${item.periodo_mes}-${item.quincena}`} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                    <td className="px-3 py-2">
                                        <span className="text-xs font-bold text-slate-700">{months.find(m => m.value === item.periodo_mes)?.label} {item.periodo_anio}</span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{item.quincena === 'primera' ? '1ra' : '2da'}</span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className="text-xs font-bold text-slate-800">{item.total_empleados}</span>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-700 font-medium">${parseFloat(item.total_sueldos_quincenal || (parseFloat(item.total_sueldos || 0) / 2)).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-xs font-semibold text-slate-600">${parseFloat(item.total_ingresos_adic || 0).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-xs font-bold text-indigo-600">${parseFloat(item.total_percepciones || 0).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-xs text-slate-600">${parseFloat(item.total_isss || 0).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-xs text-slate-600">${parseFloat(item.total_afp || 0).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-xs text-slate-600">${parseFloat(item.total_renta || 0).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-xs font-bold text-red-600">${parseFloat(item.total_deducciones || 0).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-xs font-bold text-emerald-600">${parseFloat(item.total_neto || 0).toFixed(2)}</td>
                                    <td className="px-3 py-2">{estadoBadge(item)}</td>
                                    <td className="px-3 py-2 flex items-center gap-1">
                                        <button
                                            onClick={() => handleVerDetalle(item)}
                                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Editar planilla"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleEliminarPeriodo(item)}
                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Eliminar período"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleCerrarPeriodo(item)}
                                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                            title="Cerrar período (Marcar pagada)"
                                        >
                                            <Lock size={16} />
                                        </button>
                                        <span className="w-px h-4 bg-slate-200 mx-0.5" />
                                        <button
                                            onClick={() => setExportModalConfig({ anio: item.periodo_anio, mes: item.periodo_mes, quincena: item.quincena, tipo: 'planilla' })}
                                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Ver Planilla Oficial (PDF)"
                                        >
                                            <FileText size={16} />
                                        </button>
                                        <button
                                            onClick={() => setExportModalConfig({ anio: item.periodo_anio, mes: item.periodo_mes, quincena: item.quincena, tipo: 'recibos' })}
                                            className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                            title="Ver Recibos Masivos (PDF)"
                                        >
                                            <ReceiptText size={16} />
                                        </button>
                                        <button
                                            onClick={() => setExportModalConfig({ anio: item.periodo_anio, mes: item.periodo_mes, quincena: item.quincena, tipo: 'csv' })}
                                            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                                            title="Exportar CSV bancario"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                        </button>
                                    </td>
                                </tr>
                            )}
                        />
                    </div>

                    <Pagination
                        currentPage={page}
                        totalPages={response.totalPages}
                        totalItems={response.total}
                        onPageChange={setPage}
                        itemsOnPage={items.length}
                        isLoading={isLoading}
                    />
                </>
            ) : (
                /* --- Full Normal Screen Form (Nueva / Edición de Planilla) --- */
                <div className="space-y-4">
                    {/* Form Top Navigation Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => { resetForm(); setActiveTab('historial'); }}
                                className="p-2 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl transition-colors border border-slate-200 shadow-sm flex items-center justify-center"
                                title="Volver a la lista de planillas"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div>
                                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                                    {periodoBloqueado ? 'Planilla Quincenal' : 'Nueva Planilla Quincenal'}
                                </h2>
                                <p className="text-slate-500 text-xs font-medium">
                                    {months.find(m => m.value === periodoMes)?.label} {periodoAnio} — {quincena === 'primera' ? '1ra Quincena' : '2da Quincena'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {periodoBloqueado && (
                                <button
                                    type="button"
                                    onClick={handleVerPlanillaActual}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 rounded-xl transition-all shadow-sm active:scale-95"
                                    title="Ver planilla en formato oficial"
                                >
                                    <FileText size={14} />
                                    <span>Ver Planilla</span>
                                </button>
                            )}
                            {periodoBloqueado && (
                                <button
                                    type="button"
                                    onClick={handleVerRecibosActual}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200/60 rounded-xl transition-all shadow-sm active:scale-95"
                                    title="Ver recibos de pago masivos"
                                >
                                    <ReceiptText size={14} />
                                    <span>Ver Recibos</span>
                                </button>
                            )}
                            {periodoBloqueado ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-3 py-1.5 rounded-xl">
                                    <CheckCircle size={14} /> Período Generado
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-3 py-1.5 rounded-xl">
                                    <Zap size={14} /> Pendiente de Generar
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => { resetForm(); setActiveTab('historial'); }}
                                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                            >
                                Volver al Listado
                            </button>
                        </div>
                    </div>

                    {/* Period Parameters Card */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 items-end">
                            <div>
                                <label className={labelCls}>Año</label>
                                <select
                                    value={periodoAnio}
                                    onChange={e => setPeriodoAnio(parseInt(e.target.value))}
                                    disabled={periodoBloqueado}
                                    className={fieldCls}
                                >
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Mes</label>
                                <select
                                    value={periodoMes}
                                    onChange={e => setPeriodoMes(parseInt(e.target.value))}
                                    disabled={periodoBloqueado}
                                    className={fieldCls}
                                >
                                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Quincena</label>
                                <select
                                    value={quincena}
                                    onChange={e => setQuincena(e.target.value)}
                                    disabled={periodoBloqueado}
                                    className={fieldCls}
                                >
                                    <option value="primera">Primera</option>
                                    <option value="segunda">Segunda</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Días Trab.</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="30"
                                    value={diasTrabajados}
                                    onChange={e => handleDiasTrabajadosChange(parseInt(e.target.value) || 15)}
                                    disabled={periodoBloqueado}
                                    className={fieldCls}
                                />
                            </div>
                            <div className="sm:col-span-2 lg:col-span-2 flex items-end">
                                {periodoBloqueado ? (
                                    <div className="w-full flex flex-wrap items-center justify-between gap-2 bg-slate-50 text-slate-700 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200">
                                        <div className="flex items-center gap-2">
                                            <span className="flex items-center gap-1 text-emerald-600 font-bold">
                                                <CheckCircle size={14} /> Activa
                                            </span>
                                            <button
                                                type="button"
                                                onClick={handleSincronizar}
                                                disabled={sincronizarMutation.isPending}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-lg text-[11px] font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                                title="Incorporar empleados nuevos o actualizar novedades sin borrar horas extras ni datos existentes"
                                            >
                                                <RefreshCw size={12} className={sincronizarMutation.isPending ? 'animate-spin' : ''} />
                                                <span>{sincronizarMutation.isPending ? 'Sincronizando...' : 'Sincronizar'}</span>
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setPeriodoBloqueado(false)}
                                            className="text-[11px] text-slate-500 hover:text-slate-800 font-bold underline"
                                        >
                                            Cambiar período
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleGenerar}
                                        disabled={generando}
                                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
                                    >
                                        {generando ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                        {generando ? 'Generando para todos...' : 'Generar Planilla'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Employee Search & Banner */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                            <div className="lg:col-span-5">
                                <label className={labelCls}>
                                    Código de Empleado <span className="text-[9px] text-indigo-500 font-normal lowercase">(F3 para buscar en catálogo)</span>
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        ref={employeeInputRef}
                                        type="text"
                                        value={codigoInput}
                                        onChange={e => setCodigoInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCodigoSearch(); } }}
                                        placeholder="Ej: 0001"
                                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleCodigoSearch}
                                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors font-medium text-xs flex items-center gap-1.5"
                                        title="Buscar por código"
                                    >
                                        <Search size={15} />
                                        <span>Buscar</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsEmpModalOpen(true)}
                                        className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-colors font-bold text-xs flex items-center gap-1.5"
                                        title="Ver lista de empleados (F3)"
                                    >
                                        <Users size={15} />
                                        <span>Lista (F3)</span>
                                    </button>
                                </div>
                            </div>

                            <div className="lg:col-span-7">
                                {empleadoData ? (
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-xs">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                                                <User size={15} />
                                            </div>
                                            <div>
                                                <span className="font-bold text-slate-800 text-sm block">
                                                    {empleadoData.nombres} {empleadoData.apellidos}
                                                </span>
                                                <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                                    CÓD: {empleadoData.codigo}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
                                        <div>
                                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Cargo</span>
                                            <span className="text-slate-700 font-medium">{empleadoData.cargo_nombre || 'Sin cargo'}</span>
                                        </div>
                                        <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
                                        <div>
                                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Depto</span>
                                            <span className="text-slate-700 font-medium">{empleadoData.departamento_nombre || 'Sin depto.'}</span>
                                        </div>
                                        {parseFloat(empleadoData.bonificacion_fija || 0) > 0 && (
                                            <>
                                                <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
                                                <div>
                                                    <span className="text-[10px] text-amber-600 uppercase font-bold block">Bonif. Fija</span>
                                                    <span className="text-xs font-black text-amber-700">
                                                        ${parseFloat(empleadoData.bonificacion_fija).toFixed(2)}/q
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                        {empleadoData.en_vacaciones === 1 && (
                                            <>
                                                <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-lg">
                                                    🏖️ Vacaciones
                                                </span>
                                            </>
                                        )}
                                        {empleadoData.incapacitado === 1 && (
                                            <>
                                                <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-lg">
                                                    🏥 Incapacitado
                                                </span>
                                            </>
                                        )}
                                        {(empleadoData.en_vacaciones === 1 || empleadoData.incapacitado === 1) && diasTrabajados > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => handleDiasTrabajadosChange(0)}
                                                className="text-[10px] font-bold text-amber-800 hover:text-amber-950 bg-amber-100/70 hover:bg-amber-200/90 px-2 py-0.5 rounded border border-amber-300/80 transition-colors shadow-xs"
                                                title="Ajustar días trabajados a 0 para esta quincena"
                                            >
                                                Poner 0 días
                                            </button>
                                        )}

                                        <div className="ml-auto flex flex-wrap items-center gap-2">
                                            {selected?.id ? (
                                                <button
                                                    type="button"
                                                    onClick={handleExcluirEmpleado}
                                                    disabled={excluirMutation.isPending}
                                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                                                    title="Excluir a este empleado únicamente de esta planilla quincenal"
                                                >
                                                    <UserX size={13} />
                                                    <span>{excluirMutation.isPending ? 'Excluyendo...' : 'Excluir de Planilla'}</span>
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded-lg">
                                                        No incluido en quincena
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={handleAgregarEmpleado}
                                                        disabled={savingRef.current}
                                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                                        title="Agregar formalmente a este empleado a la planilla de esta quincena"
                                                    >
                                                        <UserPlus size={13} />
                                                        <span>{savingRef.current ? 'Agregando...' : 'Agregar a Planilla'}</span>
                                                    </button>
                                                </div>
                                            )}

                                            <div className="text-right pl-2 border-l border-slate-200">
                                                <span className="text-[10px] text-slate-400 uppercase font-bold block">Sueldo Quincenal</span>
                                                <span className="text-sm font-black text-indigo-600">
                                                    ${((parseFloat(empleadoData.sueldo_base || 0) / 30) * diasTrabajados).toFixed(2)}
                                                </span>
                                                <span className="text-[9px] text-slate-400 block font-medium">
                                                    Base: ${parseFloat(empleadoData.sueldo_base || 0).toFixed(2)}/mes
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 bg-slate-50/70 p-3 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                                        <User size={16} className="text-slate-300 shrink-0" />
                                        <span>Seleccione un empleado del listado o escriba su código para comenzar a editar cuentas.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Main Two-Column View: Cuentas Table & Summary Panel */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                        {/* Cuentas Table (Left) */}
                        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                                <div>
                                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Cuentas de Planilla</span>
                                    <span className="text-[10px] text-slate-400">Conceptos de percepciones y deducciones</span>
                                </div>
                                {autoSaveRef.current && (
                                    <span className="text-[10px] text-indigo-600 font-medium animate-pulse">Guardando cambios...</span>
                                )}
                            </div>

                            <div className="overflow-x-auto">
                                {sinEmpleado ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-slate-300 text-xs italic gap-1.5">
                                        <Users size={28} className="opacity-30" />
                                        <span>Seleccione un empleado para ver y editar sus cuentas</span>
                                    </div>
                                ) : detalles.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-xs gap-1.5">
                                        <Loader2 size={20} className="animate-spin text-indigo-500" />
                                        <span>Cargando cuentas de planilla...</span>
                                    </div>
                                ) : (
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase">
                                                <th className="text-left px-3 py-1.5 w-12">Cód.</th>
                                                <th className="text-left px-3 py-1.5">Descripción</th>
                                                <th className="text-center px-2 py-1.5 w-16">Operación</th>
                                                <th className="text-center px-2 py-1.5 w-16">Tipo</th>
                                                <th className="text-right px-3 py-1.5 w-32">Cant. / Base</th>
                                                <th className="text-right px-3 py-1.5 w-28">Total ($)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {detalles.map((d, i) => (
                                                <tr key={i} className={`hover:bg-slate-50/70 transition-colors ${d.operacion === 'sumar' ? '' : 'bg-red-50/15'}`}>
                                                    <td className="px-3 py-1 font-bold font-mono text-slate-700">{d.codigo}</td>
                                                    <td className="px-3 py-1 text-slate-700 font-medium text-xs">
                                                        <div>{d.descripcion}</div>
                                                        {d.tipo_valor === 'horas' && empleadoData?.sueldo_base && (
                                                            <div className="text-[10px] text-slate-400 font-normal">
                                                                Tarifa: ${(calcularTarifaDetalle(d, empleadoData.sueldo_base)).toFixed(2)}/hr
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-1 text-center">
                                                        <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                            d.operacion === 'sumar' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' : 'bg-rose-50 text-rose-700 border border-rose-200/50'
                                                        }`}>
                                                            {d.operacion === 'sumar' ? '+ Suma' : '− Resta'}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-1 text-center">
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 capitalize">
                                                            {d.tipo_valor}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-1 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <input
                                                                type="number"
                                                                step={d.tipo_valor === 'dias' ? '1' : (d.tipo_valor === 'horas' ? '0.5' : '0.01')}
                                                                min="0"
                                                                value={d.cantidad !== undefined ? d.cantidad : ''}
                                                                onChange={e => handleValorChange(i, e.target.value)}
                                                                placeholder="0"
                                                                className="w-full max-w-[80px] px-2 py-0.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-bold text-right shadow-sm"
                                                            />
                                                            <span className="text-[10px] text-slate-400 font-medium w-7 text-left">
                                                                {d.tipo_valor === 'horas' ? 'hrs' : (d.tipo_valor === 'dias' ? 'días' : (d.tipo_valor === 'porcentaje' ? '%' : '$'))}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-1 text-right font-bold text-slate-900 text-xs">
                                                        <span className={d.operacion === 'sumar' ? 'text-slate-900' : 'text-rose-600'}>
                                                            ${parseFloat(d.valor_ingresado || 0).toFixed(2)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {/* Summary Panel (Right) */}
                        <div className="lg:col-span-4">
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-4">
                                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200">
                                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Resumen del Cálculo</span>
                                    <span className="text-[10px] text-slate-400">Totalizaciones y retenciones de ley</span>
                                </div>

                                <div className="p-4 space-y-4">
                                    {sinEmpleado ? (
                                        <div className="text-slate-300 text-xs italic text-center py-8">
                                            Seleccione un empleado para visualizar el resumen
                                        </div>
                                    ) : (
                                        <>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500 font-medium">Sueldo Quincenal</span>
                                                    <span className="font-semibold text-slate-700">${sueldoQuincActual.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500 font-medium">Ingresos Adicionales</span>
                                                    <span className="font-semibold text-slate-700">${ingresosAdicActual.toFixed(2)}</span>
                                                </div>
                                                <div className="border-t border-slate-100 pt-2 flex justify-between items-baseline">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                                        Total Devengado
                                                    </label>
                                                    <div className="text-xl font-black text-indigo-600">
                                                        ${percTotal.toFixed(2)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="border-t border-slate-100 pt-4 space-y-2.5">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                                    Retenciones y Deducciones
                                                </label>
                                                {calculando ? (
                                                    <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                                                        <Loader2 size={14} className="animate-spin" /> Calculando retenciones...
                                                    </div>
                                                ) : calculo ? (
                                                    <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-slate-600 font-medium">ISSS {calculo.isss_info?.porcentaje ? `(${calculo.isss_info.porcentaje}%)` : ''}</span>
                                                            <span className="font-bold text-rose-600">${calculo.descuento_isss.toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-slate-600 font-medium">AFP {calculo.afp_info?.porcentaje ? `(${calculo.afp_info.porcentaje}%)` : ''}</span>
                                                            <span className="font-bold text-rose-600">${calculo.descuento_afp.toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-slate-600 font-medium">Renta</span>
                                                            <span className="font-bold text-rose-600">${calculo.descuento_renta.toFixed(2)}</span>
                                                        </div>
                                                        {((calculo.total_deducciones_cuentas !== undefined ? calculo.total_deducciones_cuentas : otrasDedActual) > 0) && (
                                                            <div className="flex justify-between items-center text-xs border-t border-slate-200/60 pt-1.5">
                                                                <span className="text-slate-600 font-medium">Otras Deducciones</span>
                                                                <span className="font-bold text-rose-600">${parseFloat(calculo.total_deducciones_cuentas !== undefined ? calculo.total_deducciones_cuentas : otrasDedActual).toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-slate-400 italic">Sin cálculo disponible</p>
                                                )}
                                            </div>

                                            <div className="border-t border-slate-100 pt-4 space-y-2">
                                                {calculando ? (
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total a Pagar</label>
                                                        <div className="text-slate-300 text-xl font-black mt-1">—</div>
                                                    </div>
                                                ) : calculo ? (
                                                    <>
                                                        <div className="flex justify-between items-center text-xs text-slate-500">
                                                            <span>Total Deducciones</span>
                                                            <span className="font-bold text-rose-600">${calculo.total_deducciones.toFixed(2)}</span>
                                                        </div>
                                                        <div className="border-t border-slate-200 pt-3 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                                                            <label className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                                                                Neto a Recibir (Total a Pagar)
                                                            </label>
                                                            <div className="text-2xl font-black text-emerald-600 mt-1">
                                                                ${calculo.monto_recibir.toFixed(2)}
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total a Pagar</label>
                                                        <div className="text-slate-300 text-xl font-black mt-1">—</div>
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
            )}

            {/* --- Modern Employee Search Modal (F3) --- */}
            <EmployeeSearchModal
                isOpen={isEmpModalOpen}
                onClose={() => setIsEmpModalOpen(false)}
                onSelect={handleSelectEmployee}
            />

            {/* --- Official Planilla Report Modal --- */}
            <PlanillaReportModal
                isOpen={!!previewPeriodo}
                onClose={() => setPreviewPeriodo(null)}
                periodo={previewPeriodo}
            />

            {/* --- Export Options & Filters Modal --- */}
            <PlanillaExportModal
                isOpen={!!exportModalConfig}
                onClose={() => setExportModalConfig(null)}
                periodo={exportModalConfig}
                onConfirm={handleConfirmExport}
            />
        </div>
    );
};

export default Planillas;
