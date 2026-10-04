import { useAuth } from '../../../context/AuthContext';
import { unwrapList } from '../../../utils/apiUtils';
import { createPayrollSaveQueue } from './payrollSaveQueue';
import { normalizarDetallesGuardados } from './planillaDetails';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useConfirm } from '../../../context/ConfirmContext';
import { toast } from 'sonner';
import { useDirtyTracker } from '../../../hooks/useDirtyTracker';
import { yearNow, monthNow, months, calcularMontoDetalle } from './planillaUtils';
export default function usePlanillas() {

    const queryClient = useQueryClient();
    const { user } = useAuth();
    const companyId = user?.company_id;
    const draftKey = `rh-planilla-draft:${user?.id}:${companyId}`;
    const confirm = useConfirm();
    const employeeInputRef = useRef(null);

    const [activeTab, setActiveTab] = useState('historial'); // 'historial' | 'nuevo'
    const [selected, setSelectedState] = useState(null);
    const [filterAnio, setFilterAnio] = useState(yearNow);
    const [filterMes, setFilterMes] = useState(monthNow);
    const [filterQuincena, setFilterQuincena] = useState('');
    const [page, setPage] = useState(1);

    const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
    const [previewPeriodo, setPreviewPeriodo] = useState(null);
    const [exportModalConfig, setExportModalConfig] = useState(null);

    const [empleadoId, setEmpleadoIdState] = useState('');
    const [empleadoData, setEmpleadoData] = useState(null);
    const [periodoAnio, setPeriodoAnioState] = useState(yearNow);
    const [periodoMes, setPeriodoMesState] = useState(monthNow);
    const [quincena, setQuincenaState] = useState('primera');
    const [diasTrabajados, setDiasTrabajadosState] = useState(15);
    const [codigoInput, setCodigoInput] = useState('');
    const [detalles, setDetallesState] = useState([]);
    const [calculo, setCalculoState] = useState(null);
    const [calculando, setCalculando] = useState(false);
    const [generando, setGenerando] = useState(false);
    const [periodoBloqueado, setPeriodoBloqueado] = useState(false);
    const [guardandoManual, setGuardandoManual] = useState(false);
    const editRevisionRef = useRef(0);
    const loadSequenceRef = useRef(0);
    const revisionRef = useRef(null);
    const queueRef = useRef(null);
    const [unsaved, setUnsaved] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [loadingEmployee, setLoadingEmployee] = useState(false);
    const [hasConflict, setHasConflict] = useState(false);
    const [conflict, setConflict] = useState(null);
    const autoSaveRef = useRef(false);
    const savingRef = useRef(false);
    const operationRef = useRef(false);
    const mountedRef = useRef(true);
    const draftStorageWarning = useRef(false);
    const selectedRef = useRef(null);

    const diasTrabajadosRef = useRef(15);
    const detallesRef = useRef([]);
    const calculoRef = useRef(null);
    const empleadoIdRef = useRef('');
    const periodoAnioRef = useRef(yearNow);
    const periodoMesRef = useRef(monthNow);
    const quincenaRef = useRef('primera');
    const setSelected = value => { selectedRef.current = value; setSelectedState(value); };
    const setDiasTrabajados = value => { diasTrabajadosRef.current = value; setDiasTrabajadosState(value); };
    const setDetalles = value => { detallesRef.current = value; setDetallesState(value); };
    const setCalculo = value => { calculoRef.current = value; setCalculoState(value); };
    const setEmpleadoId = value => { empleadoIdRef.current = value; setEmpleadoIdState(value); };
    const setPeriodoAnio = value => { periodoAnioRef.current = value; setPeriodoAnioState(value); };
    const setPeriodoMes = value => { periodoMesRef.current = value; setPeriodoMesState(value); };
    const setQuincena = value => { quincenaRef.current = value; setQuincenaState(value); };
    const hayOtraAbiertaRef = useRef(false);

    const contextKey = () => [companyId, empleadoIdRef.current, periodoAnioRef.current, periodoMesRef.current, quincenaRef.current, mountedRef.current].join(':');
    const persistDraft = () => {
        if (!empleadoIdRef.current) return;
        try { sessionStorage.setItem(draftKey, JSON.stringify({
            empleado_id: empleadoIdRef.current, periodo_anio: periodoAnioRef.current,
            periodo_mes: periodoMesRef.current, quincena: quincenaRef.current,
            dias_trabajados: diasTrabajadosRef.current, detalles: detallesRef.current,
            id: selectedRef.current?.id, expected_revision: revisionRef.current
        })); } catch {
            if (!draftStorageWarning.current) {
                draftStorageWarning.current = true;
                toast.warning('El navegador no permite conservar un borrador local. Guarde sus cambios antes de salir.');
            }
        }
    };
    const clearDraft = () => { try { sessionStorage.removeItem(draftKey); } catch { /* El guardado en el servidor ya está confirmado. */ } };
    const markDirty = () => {
        editRevisionRef.current++;
        autoSaveRef.current = true;
        setUnsaved(true);
        setSaveError('');
        setCalculo(null);
        persistDraft();
    };
    useEffect(() => {
        mountedRef.current = true;
        const beforeUnload = event => { if (autoSaveRef.current || savingRef.current) { event.preventDefault(); event.returnValue = ''; } };
        window.addEventListener('beforeunload', beforeUnload);
        return () => { mountedRef.current = false; window.removeEventListener('beforeunload', beforeUnload); loadSequenceRef.current++; };
    }, []);

    useDirtyTracker('planillas', activeTab === 'nuevo' && (unsaved || guardandoManual));

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F3') {
                e.preventDefault();
                if (activeTab === 'nuevo' && !operationRef.current && !loadingEmployee && !generando && !guardandoManual) {
                    setIsEmpModalOpen(true);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTab, loadingEmployee, generando, guardandoManual]);

    const { data: response = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        staleTime: 0, refetchOnWindowFocus: true,
        queryKey: ['rh-planillas-grupos', companyId, page, filterAnio, filterMes, filterQuincena],
        queryFn: async () => (await axios.get('/api/rh/planillas/grupos', {
            params: { page, anio: filterAnio, mes: filterMes || undefined, quincena: filterQuincena || undefined }
        })).data
    });

    const items = unwrapList(response);

    const { data: abiertasData } = useQuery({
        staleTime: 0, refetchOnWindowFocus: true,
        queryKey: ['rh-planillas-abiertas', companyId],
        queryFn: async () => (await axios.get('/api/rh/planillas/abiertas')).data
    });

    const tieneAbiertas = Boolean(abiertasData?.tiene_abiertas);
    const planillasAbiertas = unwrapList(abiertasData?.planillas_abiertas);
    const primeraAbierta = planillasAbiertas[0] || null;

    const hayOtraAbierta = Boolean(
        planillasAbiertas.some(
            ab => !(ab.periodo_anio === periodoAnio && ab.periodo_mes === periodoMes && ab.quincena === quincena)
        )
    );
    useEffect(() => { hayOtraAbiertaRef.current = hayOtraAbierta; }, [hayOtraAbierta]);

    const otraAbiertaItem = hayOtraAbierta
        ? planillasAbiertas.find(ab => !(ab.periodo_anio === periodoAnio && ab.periodo_mes === periodoMes && ab.quincena === quincena))
        : null;

    const esEstePeriodoAbierto = Boolean(
        planillasAbiertas.some(
            ab => ab.periodo_anio === periodoAnio && ab.periodo_mes === periodoMes && ab.quincena === quincena
        )
    );

    const { data: cuentasActivas = [] } = useQuery({
        staleTime: 0, refetchOnWindowFocus: true,
        queryKey: ['rh-cuentas-activas', companyId],
        queryFn: async () => unwrapList(await axios.get('/api/rh/planillas/cuentas-activas')),
        enabled: activeTab === 'nuevo'
    });

    if (!queueRef.current) queueRef.current = createPayrollSaveQueue({
        read: () => ({
            key: contextKey(), editRevision: editRevisionRef.current,
            empleado_id: empleadoIdRef.current, periodo_anio: periodoAnioRef.current,
            periodo_mes: periodoMesRef.current, quincena: quincenaRef.current,
            dias_trabajados: diasTrabajadosRef.current,
            detalles: detallesRef.current.map(detail => ({ ...detail })),
            id: selectedRef.current?.id, expected_revision: revisionRef.current,
            headers: { Authorization: axios.defaults.headers.common.Authorization, 'x-company-id': String(companyId) }
        }),
        persist: async snapshot => {
            const { key: _key, editRevision: _editRevision, headers, id, ...data } = snapshot;
            // A failed calculation must never be converted into a zero-valued payroll.
            const calculation = (await axios.post('/api/rh/planillas/calcular', data, { headers })).data;
            const response = await (id
                ? axios.put(`/api/rh/planillas/${id}`, { ...data, ...calculation }, { headers })
                : axios.post('/api/rh/planillas', { ...data, ...calculation }, { headers }));
            return { id: id || response.data.id, revision: response.data.revision, calculation };
        },
        accept: (snapshot, result) => {
            queryClient.invalidateQueries({ queryKey: ['rh-planillas-grupos'] });
            queryClient.invalidateQueries({ queryKey: ['rh-planillas-abiertas'] });
            if (contextKey() !== snapshot.key) return;
            setSelected({ id: result.id, empleado_id: snapshot.empleado_id });
            revisionRef.current = result.revision;
            if (editRevisionRef.current === snapshot.editRevision) {
                setCalculo(result.calculation);
                autoSaveRef.current = false;
                setUnsaved(false);
                setSaveError('');
                clearDraft();
                setHasConflict(false);
            } else {
                // If the next request fails, recovery must use the revision just saved.
                persistDraft();
            }
        },
        onBusy: busy => { savingRef.current = busy; if (mountedRef.current) setGuardandoManual(busy); }
    });
    const saveCurrentEmployee = async ({ silent = false } = {}) => {
        try {
            const id = await queueRef.current();
            if (!silent && id) toast.success('Cambios guardados con éxito');
            return id;
        } catch (error) {
            const isNotFound = error.response?.status === 404;
            const message = isNotFound
                ? 'El registro de planilla o período ya no existe en el servidor (fue eliminado).'
                : (error.response?.data?.message || 'No se pudieron guardar los cambios. El borrador sigue en pantalla; reintente guardar.');
            setSaveError(message);
            setHasConflict([409, 404].includes(error.response?.status) || (error.response?.status === 400 && /cerrad|pagad/i.test(message)));
            toast.error(message, { id: 'planilla-save-error' });
            throw error;
        }
    };


    const reviewConflict = async () => {
        const key = contextKey();
        try {
            const { data } = await axios.get(`/api/rh/planillas/empleado/${empleadoIdRef.current}`, { params: {
                periodo_anio: periodoAnioRef.current, periodo_mes: periodoMesRef.current, quincena: quincenaRef.current
            } });
            if (key !== contextKey()) return;
            setConflict({ key, data });
        } catch { toast.error('No se pudieron consultar los datos guardados. Su borrador se conserva.'); }
    };

    const resolveConflict = async mode => {
        if (!conflict || conflict.key !== contextKey()) return;
        const { data } = conflict;
        if (mode === 'local' && data.totales?.estado === 'pagada') return;
        setConflict(null);
        setSelected(data.planilla_id ? { id: data.planilla_id, empleado_id: empleadoIdRef.current } : null);
        revisionRef.current = data.revision;
        setEmpleadoData(data);
        if (mode === 'local') {
            markDirty();
            try { await saveCurrentEmployee(); } catch { /* A further change requires another review. */ }
        } else {
            if (!data.planilla_id) {
                clearDraft();
                resetForm();
                setActiveTab('historial');
                return;
            }
            setDetalles(normalizarDetallesGuardados(unwrapList(data.detalles), data.sueldo_base, cuentasActivas));
            setDiasTrabajados(Number(data.dias_trabajados ?? 15));
            setCalculo(data.totales);
            setEmpleadoData(data);
            editRevisionRef.current++;
            autoSaveRef.current = false;
            setUnsaved(false);
            setSaveError('');
            setHasConflict(false);
            clearDraft();
        }
    };

    // Only the latest employee/period/edit can update the displayed calculation.
    useEffect(() => {
        if (!empleadoId || !detalles.length) return;
        let disposed = false;
        const key = contextKey();
        const revision = editRevisionRef.current;
        const timer = setTimeout(async () => {
            if (disposed || operationRef.current || contextKey() !== key) return;
            setCalculando(true);
            try {
                if (autoSaveRef.current && !hayOtraAbiertaRef.current) {
                    await saveCurrentEmployee({ silent: true });
                } else {
                    const { data } = await axios.post('/api/rh/planillas/calcular', {
                        empleado_id: empleadoId, detalles,
                        quincena, periodo_anio: periodoAnio, periodo_mes: periodoMes
                    });
                    if (!disposed && contextKey() === key && editRevisionRef.current === revision) setCalculo(data);
                }
            } catch { /* The save reports errors and keeps the draft. */ }
            finally { if (!disposed) setCalculando(false); }
        }, 500);
        return () => { disposed = true; clearTimeout(timer); };
    }, [empleadoId, detalles, periodoAnio, periodoMes, quincena]);

    const handleGenerar = async () => {
        if (!quincena) return toast.error('Seleccione una quincena');

        if (hayOtraAbierta && otraAbiertaItem) {
            const mesNom = months.find(m => m.value === otraAbiertaItem.periodo_mes)?.label || otraAbiertaItem.periodo_mes;
            const qNom = otraAbiertaItem.quincena === 'primera' ? '1ra Quincena' : '2da Quincena';
            return toast.error(`No puede generar esta planilla. El período ${mesNom} ${otraAbiertaItem.periodo_anio} (${qNom}) aún está abierto. Debe cerrarlo antes de crear uno nuevo.`);
        }

        if (operationRef.current) return;
        const snapshot = {
            periodo_anio: periodoAnioRef.current, periodo_mes: periodoMesRef.current,
            quincena: quincenaRef.current
        };
        const key = contextKey();
        const headers = { Authorization: axios.defaults.headers.common.Authorization, 'x-company-id': String(companyId) };
        operationRef.current = true;
        setGenerando(true);
        try {
            if (autoSaveRef.current || savingRef.current) await saveCurrentEmployee({ silent: true });
            const check = await axios.get('/api/rh/planillas/grupos', {
                params: { anio: snapshot.periodo_anio, mes: snapshot.periodo_mes, quincena: snapshot.quincena, limit: 1 }, headers
            });
            if (check.data.total > 0) {
                toast.error('Este período ya existe. Abra la planilla y use Sincronizar para conservar los valores digitados.');
                return;
            }
            if (contextKey() !== key) return;
            const res = await axios.post('/api/rh/planillas/generar', snapshot, { headers });
            queryClient.invalidateQueries({ queryKey: ['rh-planillas-grupos'] });
            queryClient.invalidateQueries({ queryKey: ['rh-planillas-abiertas'] });
            if (contextKey() !== key) return;
            toast.success(`Planilla generada para ${res.data.total} empleados`);
            setPeriodoBloqueado(true);

            setDetalles([]);
            setCalculo(null);
            setEmpleadoId('');
            setEmpleadoData(null);
            setCodigoInput('');
            setSelected(null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'No se pudo generar la planilla. Los datos se conservan.');
        } finally {
            operationRef.current = false;
            setGenerando(false);
        }
    };




    const loadEmpleado = async (id) => {
        const sequence = ++loadSequenceRef.current;
        try {
            if (autoSaveRef.current || savingRef.current) await saveCurrentEmployee({ silent: true });
        } catch { return; }
        if (sequence !== loadSequenceRef.current) return;
        const params = { periodo_anio: periodoAnioRef.current, periodo_mes: periodoMesRef.current, quincena: quincenaRef.current };
        setLoadingEmployee(true);
        try {
            const { data } = await axios.get(`/api/rh/planillas/empleado/${id}`, { params });
            if (sequence !== loadSequenceRef.current) return;
            setEmpleadoData(data);
            setEmpleadoId(id);
            setCodigoInput(data.codigo);
            revisionRef.current = data.revision || null;
            editRevisionRef.current++;
            autoSaveRef.current = false;
            setUnsaved(false);
            setSaveError('');
            if (data.planilla_id) {
                setSelected({ id: data.planilla_id, empleado_id: id });
                setDiasTrabajados(data.dias_trabajados !== undefined && data.dias_trabajados !== null ? parseInt(data.dias_trabajados) : 15);
                const parsedDetalles = normalizarDetallesGuardados(unwrapList(data.detalles), data.sueldo_base, cuentasActivas);

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

            } else {
                setSelected(null);
                setCalculo(null);
                const absent = Number(data.en_vacaciones) === 1 || Number(data.incapacitado) === 1;
                const initialDias = absent ? 0 : Number(data.dias_trabajados ?? 15);
                setDiasTrabajados(initialDias);
                const defaults = normalizarDetallesGuardados(unwrapList(data.detalles), data.sueldo_base, cuentasActivas);
                if (defaults.length) {
                    setDetalles(absent ? defaults.map(d => ({ ...d, cantidad: 0, valor_base: 0, valor_ingresado: 0 })) : defaults);
                } else {
                    buildDetalles(data, initialDias);
                }
            }
            setPeriodoBloqueado(true);
            return true;
        } catch (error) {
            if (sequence === loadSequenceRef.current) {
                if (error?.response?.status === 404) {
                    toast.error('El empleado o período de planilla ya no existe o fue eliminado', { id: 'rh-emp-not-found' });
                } else {
                    toast.error('Error al cargar datos del empleado');
                }
            }
        } finally {
            if (sequence === loadSequenceRef.current) { setLoadingEmployee(false); setCalculando(false); }
        }
    };


    const buildDetalles = (emp, forcedDias = null) => {
        if (!cuentasActivas || cuentasActivas.length === 0) return;
        const sueldoBase = parseFloat(emp?.sueldo_base || 0);
        const bonificacionFija = parseFloat(emp?.bonificacion_fija || 0);
        const diasToUse = forcedDias !== null ? forcedDias : diasTrabajados;
        const esAusente = Number(emp?.en_vacaciones) === 1 || Number(emp?.incapacitado) === 1;

        const activeDiscounts = unwrapList(emp?.descuentos_programados).filter(d => {
            const q = d.quincena || d.aplicar_en;
            if (quincena === 'primera' && q === 'segunda') return false;
            if (quincena === 'segunda' && q === 'primera') return false;
            return true;
        });

        const list = (Array.isArray(cuentasActivas) ? cuentasActivas : []).map(c => {
            let cantidad = 0;
            // Si el empleado está en vacaciones o incapacitado, todos los montos van a cero
            if (!esAusente) {
                if (c.operacion === 'sumar' && (c.codigo === '02' || (c.descripcion || '').toUpperCase().includes('BONIF'))) {
                    cantidad = bonificacionFija;
                } else if (c.tipo_valor === 'dias' && c.codigo === '01') {
                    cantidad = diasToUse;
                } else {
                    // Check if account matches any active scheduled discount
                    const matchingDiscounts = activeDiscounts.filter(d => {
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

                    if (matchingDiscounts.length) {
                        cantidad = matchingDiscounts.reduce((sum, discount) => sum + Number(discount.valor ?? discount.monto_cuota ?? 0), 0);
                    } else if (c.tipo_valor === 'valor' || c.tipo_valor === 'porcentaje' || c.tipo_valor === 'horas') {
                        cantidad = parseFloat(c.valor_base || 0);
                    }
                }
            }
            const monto = esAusente ? 0 : calcularMontoDetalle(c, cantidad, sueldoBase);
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
        if (hayOtraAbierta) {
            return toast.error('No se puede buscar o registrar empleados mientras exista otra planilla abierta.');
        }
        if (!codigoInput.trim()) return;
        try {
            const res = await axios.get('/api/rh/empleados', { params: { search: codigoInput.trim(), limit: 1, solo_activos: 1 } });
            const emp = unwrapList(res)[0];
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
        if (hayOtraAbierta) {
            return toast.error('No se puede registrar empleados mientras exista otra planilla abierta.');
        }
        loadEmpleado(emp.id);
        setIsEmpModalOpen(false);
    };

    const handleValorChange = (index, value) => {
        const updated = [...detallesRef.current];
        const d = { ...updated[index] };
        const raw = parseFloat(value) || 0;
        d.cantidad = raw;
        d.valor_base = raw;
        d.valor_ingresado = calcularMontoDetalle(d, raw, empleadoData?.sueldo_base);
        updated[index] = d;
        if (d.codigo === '01' && d.tipo_valor === 'dias') setDiasTrabajados(raw);
        setDetalles(updated);
        markDirty();
    };


    const handleDiasTrabajadosChange = newDias => {
        setDiasTrabajados(newDias);
        if (!detallesRef.current.length || !empleadoData) return;
        setDetalles(detallesRef.current.map(d => d.codigo === '01' && d.tipo_valor === 'dias'
            ? { ...d, cantidad: newDias, valor_base: newDias, valor_ingresado: calcularMontoDetalle(d, newDias, empleadoData.sueldo_base) }
            : d));
        markDirty();
    };



    const sincronizarMutation = useMutation({
        mutationFn: (data) => axios.post('/api/rh/planillas/sincronizar', data),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['rh-planillas-grupos'] });
            queryClient.invalidateQueries({ queryKey: ['rh-planillas-abiertas'] });

            toast.success(res.data.message);
            if (empleadoId) {
                loadEmpleado(empleadoId);
            }
        },
        onError: (error) => {
            if (error?.response?.status === 404) {
                toast.error('El período de planilla no fue encontrado o fue eliminado');
                queryClient.invalidateQueries({ queryKey: ['rh-planillas-grupos'] });
            } else {
                toast.error(error.response?.data?.message || 'Error al sincronizar planilla');
            }
        },
        onSettled: () => {
            operationRef.current = false;
        }
    });

    const handleSincronizar = async () => {
        try { if (autoSaveRef.current || savingRef.current) await saveCurrentEmployee({ silent: true }); } catch { return; }
        const ok = await confirm({
            title: '¿Sincronizar planilla?',
            message: `Se actualizarán sueldos base, bonificaciones fijas, nuevos descuentos programados y novedades de ausencias desde los expedientes. Las horas extras, comisiones y valores manuales digitados se mantendrán 100% intactos. ¿Continuar?`,
            confirmLabel: 'Sí, sincronizar',
            variant: 'primary'
        });
        if (ok) {
            operationRef.current = true;
            sincronizarMutation.mutate({
                periodo_anio: periodoAnio,
                periodo_mes: periodoMes,
                quincena
            });
        }
    };

    const [syncingHuevo, setSyncingHuevo] = useState(false);
    const handleSincronizarComisionesHuevo = async () => {
        try { if (autoSaveRef.current || savingRef.current) await saveCurrentEmployee({ silent: true }); } catch { return; }
        const ok = await confirm({
            title: '¿Sincronizar Comisiones de Huevo Industrial?',
            message: `Se liquidarán e importarán las comisiones por ventas de huevo industrial del período ${months.find(m => m.value === periodoMes)?.label} ${periodoAnio} (${quincena === 'primera' ? '1ra Quincena' : '2da Quincena'}) hacia la cuenta 07 (Comisiones) de los empleados vinculados, respetando estrictamente el tope de $1,000. ¿Desea proceder?`,
            confirmLabel: 'Sí, sincronizar comisiones',
            variant: 'primary'
        });
        if (!ok) return;

        try {
            operationRef.current = true;
            setSyncingHuevo(true);
            const res = await axios.post('/api/rh/planillas/sincronizar-comisiones-huevo', {
                periodo_anio: periodoAnio,
                periodo_mes: periodoMes,
                quincena
            });
            if (res.data?.success) {
                toast.success(res.data.message || 'Comisiones de huevo industrial sincronizadas');
                queryClient.invalidateQueries({ queryKey: ['rh-planillas-grupos'] });
                queryClient.invalidateQueries({ queryKey: ['rh-planillas-abiertas'] });
                if (empleadoId) {

                    loadEmpleado(empleadoId);
                }
            } else {
                toast.info(res.data?.message || 'Sin comisiones para sincronizar');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al sincronizar comisiones de huevo');
        } finally {
            operationRef.current = false;
            setSyncingHuevo(false);
        }
    };

    const excluirMutation = useMutation({
        mutationFn: ({ id, revision }) => axios.delete(`/api/rh/planillas/${id}`, { data: { expected_revision: revision } }),
        onSuccess: () => {
            autoSaveRef.current = false;
            setUnsaved(false);
            setSaveError('');
            revisionRef.current = null;
            editRevisionRef.current++;
            clearDraft();
            toast.success('Empleado excluido de esta planilla quincenal');
            queryClient.invalidateQueries({ queryKey: ['rh-planillas-grupos'] });
            queryClient.invalidateQueries({ queryKey: ['rh-planillas-abiertas'] });

            setSelected(null);
            setCalculo(null);
            setDetalles([]);
            setEmpleadoId('');
            setEmpleadoData(null);
            setCodigoInput('');
        },
        onError: (error) => {
            if (error?.response?.status === 404) {
                toast.error('El registro del empleado ya no existe en la planilla');
                queryClient.invalidateQueries({ queryKey: ['rh-planillas-grupos'] });
                if (empleadoIdRef.current) loadEmpleado(empleadoIdRef.current);
            } else {
                const message = error.response?.data?.message || 'Error al excluir empleado';
                toast.error(message);
                if (error.response?.status === 409) {
                    setSaveError(message);
                    setHasConflict(true);
                }
            }
            // Keep every field and the recovery draft if the deletion failed.
            setDetalles([...detallesRef.current]);
        },
        onSettled: () => {
            operationRef.current = false;
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
            try { if (savingRef.current) await saveCurrentEmployee({ silent: true }); } catch { return; }
            operationRef.current = true;
            excluirMutation.mutate({ id: selectedRef.current?.id, revision: revisionRef.current });
        }
    };

    const handleAgregarEmpleado = async () => {
        if (hayOtraAbierta) return toast.error('Cierre la otra planilla abierta antes de agregar empleados.');
        if (!empleadoIdRef.current) return;
        try { await saveCurrentEmployee(); } catch { /* Preserve the draft. */ }
    };


    const handleDownloadCSV = async (anio, mes, quincena, branchIds = [], departamentoIds = [], formatoBancario = 'ambos') => {
        try {
            const params = { anio, mes, quincena, limit: 9999 };
            if (branchIds && branchIds.length > 0) {
                params.branch_ids = Array.isArray(branchIds) ? branchIds.join(',') : branchIds;
            }
            if (departamentoIds && departamentoIds.length > 0) {
                params.departamento_ids = Array.isArray(departamentoIds) ? departamentoIds.join(',') : departamentoIds;
            }
            const res = await axios.get('/api/rh/planillas', { params });
            const rows = unwrapList(res);
            if (!rows.length) return toast.error('Sin datos para los filtros seleccionados');
            
            // Ordenar: empleados con cuenta bancaria al inicio, sin cuenta al final
            const sortedRows = [...rows].sort((a, b) => {
                const cuentaA = String(a.cuenta_planillera || '').trim();
                const cuentaB = String(b.cuenta_planillera || '').trim();
                const hasA = Boolean(cuentaA && cuentaA !== '0' && cuentaA !== '-');
                const hasB = Boolean(cuentaB && cuentaB !== '0' && cuentaB !== '-');
                if (hasA && !hasB) return -1;
                if (!hasA && hasB) return 1;
                return 0;
            });

            // CSV: separado por comas para Excel | TXT: separado por tabs para banco
            const makeRow = (r, sep) => {
                const nombre = `${r.empleado_nombres || ''} ${r.empleado_apellidos || ''}`.trim();
                const cuenta = r.cuenta_planillera || '';
                const monto = parseFloat(r.monto_recibir || 0).toFixed(2);
                return `${cuenta}${sep}${monto}${sep}${nombre}`;
            };

            // CSV: sep=, fuerza a Excel (locale español) a usar coma como separador
            // BOM (\uFEFF) garantiza que ñ, tildes, etc. se muestren correctamente
            // ="cuenta" obliga a Excel a mostrar el número completo sin notación científica (1E+13)
            const csvRows = sortedRows.map(r => {
                const nombre = `${r.empleado_nombres || ''} ${r.empleado_apellidos || ''}`.trim();
                const cuenta = r.cuenta_planillera || '';
                const monto = parseFloat(r.monto_recibir || 0).toFixed(2);
                return `="${cuenta}",${monto},${nombre}`;
            });
            const contentCsv = '\uFEFF' + 'sep=,\n' + csvRows.join('\n');
            const contentTxt = sortedRows.map(r => makeRow(r, '\t')).join('\n');

            const baseName = `PLANILLAS_${anio}${String(mes).padStart(2, '0')}_${quincena}`;

            const triggerDownload = (text, filename, mimeType) => {
                const blob = new Blob([text], { type: mimeType });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', filename);
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => window.URL.revokeObjectURL(url), 1000);
            };

            if (formatoBancario === 'csv' || formatoBancario === 'ambos') {
                triggerDownload(contentCsv, `${baseName}.csv`, 'text/csv;charset=utf-8');
            }

            if (formatoBancario === 'txt' || formatoBancario === 'ambos') {
                if (formatoBancario === 'ambos') {
                    setTimeout(() => {
                        triggerDownload(contentTxt, `${baseName}.txt`, 'text/plain;charset=utf-8');
                    }, 250);
                } else {
                    triggerDownload(contentTxt, `${baseName}.txt`, 'text/plain;charset=utf-8');
                }
            }

            if (formatoBancario === 'ambos') {
                toast.success('Archivos CSV y TXT descargados con éxito');
            } else if (formatoBancario === 'txt') {
                toast.success('Archivo TXT descargado con éxito');
            } else {
                toast.success('Archivo CSV descargado con éxito');
            }
        } catch { 
            toast.error('Error al descargar el archivo bancario'); 
        }
    };

    const handleConfirmExport = ({ tipo, anio, mes, quincena, branch_ids, departamento_ids, formato, formatoBancario }) => {
        if (tipo === 'csv') {
            handleDownloadCSV(anio, mes, quincena, branch_ids, departamento_ids, formatoBancario);
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
            queryClient.invalidateQueries({ queryKey: ['rh-planillas-abiertas'] });
            toast.success(res.data.message);
            if (empleadoIdRef.current) loadEmpleado(empleadoIdRef.current);
        },
        onError: (error) => {
            if (error?.response?.status === 404) {
                toast.error('El período que intenta cerrar ya no existe o fue eliminado');
                queryClient.invalidateQueries({ queryKey: ['rh-planillas-grupos'] });
                queryClient.invalidateQueries({ queryKey: ['rh-planillas-abiertas'] });
            } else {
                toast.error(error.response?.data?.message || 'Error al cerrar periodo');
            }
        },
        onSettled: () => { operationRef.current = false; }
    });

    const handleCerrarPeriodo = async (item) => {
        try { if (autoSaveRef.current || savingRef.current) await saveCurrentEmployee({ silent: true }); } catch { return; }
        const ok = await confirm({
            title: '¿Cerrar período?',
            message: `Se marcarán como pagadas todas las planillas de ${months.find(m => m.value === item.periodo_mes)?.label} ${item.periodo_anio} (${item.quincena === 'primera' ? '1ra' : '2da'}). ¿Confirmar?`,
            confirmLabel: 'Si, cerrar',
            variant: 'primary'
        });
        if (ok) {
            operationRef.current = true;
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
            queryClient.invalidateQueries({ queryKey: ['rh-planillas-abiertas'] });
            toast.success(res.data.message);
        },
        onError: (error) => {
            if (error?.response?.status === 404) {
                toast.error('El período ya no existe o ya fue eliminado');
                queryClient.invalidateQueries({ queryKey: ['rh-planillas-grupos'] });
                queryClient.invalidateQueries({ queryKey: ['rh-planillas-abiertas'] });
            } else {
                toast.error(error.response?.data?.message || 'Error al eliminar periodo');
            }
        }
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
        if ((autoSaveRef.current || savingRef.current) && empleadoIdRef.current) {
            try {
                await saveCurrentEmployee({ silent: true });
            } catch (e) {
                return;
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
        if ((autoSaveRef.current || savingRef.current) && empleadoIdRef.current) {
            try {
                await saveCurrentEmployee({ silent: true });
            } catch (e) {
                return;
            }
        }

        setExportModalConfig({
            anio: periodoAnio,
            mes: periodoMes,
            quincena: quincena,
            tipo: 'recibos'
        });
    };

    const handleVolverListado = async () => {
        if ((autoSaveRef.current || savingRef.current) && empleadoIdRef.current) {
            try {
                await saveCurrentEmployee({ silent: true });
            } catch { return; }
        }
        resetForm();
        setActiveTab('historial');
    };

    const resetForm = () => {
        loadSequenceRef.current++;
        editRevisionRef.current++;
        revisionRef.current = null;
        setHasConflict(false);
        setConflict(null);
        setLoadingEmployee(false);
        setCalculando(false);
        setUnsaved(false);
        setSaveError('');
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

        autoSaveRef.current = false;
    };

    const handleVerDetalle = async (item) => {
        try { if (autoSaveRef.current || savingRef.current) await saveCurrentEmployee({ silent: true }); } catch { return; }
        resetForm();
        setPeriodoAnio(Number(item.periodo_anio));
        setPeriodoMes(Number(item.periodo_mes));
        setQuincena(item.quincena);
        setDiasTrabajados(15);
        setPeriodoBloqueado(true);
        setActiveTab('nuevo');
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

    const handleNuevaPlanillaClick = () => {
        if (tieneAbiertas && primeraAbierta) {
            const mesLabel = months.find(m => m.value === primeraAbierta.periodo_mes)?.label || primeraAbierta.periodo_mes;
            const qLabel = primeraAbierta.quincena === 'primera' ? '1ra Quincena' : '2da Quincena';
            toast.error(`No puede crear una nueva planilla. El período ${mesLabel} ${primeraAbierta.periodo_anio} (${qLabel}) aún está abierto. Debe cerrarlo antes de iniciar una nueva.`);
            return;
        }
        resetForm();
        setActiveTab('nuevo');
    };

    useEffect(() => {
        let draft;
        try { draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null'); } catch { return; }
        if (!draft?.empleado_id || !Array.isArray(draft.detalles) || !draft.detalles.length) return;
        setPeriodoAnio(Number(draft.periodo_anio));
        setPeriodoMes(Number(draft.periodo_mes));
        setQuincena(draft.quincena);
        setActiveTab('nuevo');
        loadEmpleado(draft.empleado_id).then(loaded => {
            if (!loaded) return;
            setDetalles(draft.detalles);
            setDiasTrabajados(draft.dias_trabajados);
            // Preserve the original revision; a conflicting remote edit must be reviewed.
            revisionRef.current = draft.expected_revision;
            markDirty();
            toast.info('Se recuperaron cambios de planilla pendientes de guardar.');
        });
    }, []);

    
const changePeriod = async (field, value) => {
        try { if (autoSaveRef.current || savingRef.current) await saveCurrentEmployee({ silent: true }); } catch { return; }
        const previous = { anio: periodoAnioRef.current, mes: periodoMesRef.current, quincena: quincenaRef.current };
        resetForm();
        setPeriodoAnio(field === 'anio' ? Number(value) : previous.anio);
        setPeriodoMes(field === 'mes' ? Number(value) : previous.mes);
        setQuincena(field === 'quincena' ? value : previous.quincena);
    };
    
return { hasConflict, conflict, setConflict, reviewConflict, resolveConflict, activeTab, changePeriod, unsaved, saveError, loadingEmployee, handleNuevaPlanillaClick, tieneAbiertas, primeraAbierta, handleVerDetalle, handleCerrarPeriodo, filterAnio, setFilterAnio, setPage, filterMes, setFilterMes, filterQuincena, setFilterQuincena, items, isLoading, handleEliminarPeriodo, setExportModalConfig, page, response, handleVolverListado, periodoBloqueado, periodoMes, periodoAnio, quincena, handleVerPlanillaActual, handleVerRecibosActual, esEstePeriodoAbierto, cerrarMutation, setPeriodoAnio, setPeriodoMes, setQuincena, diasTrabajados, handleDiasTrabajadosChange, handleSincronizar, sincronizarMutation, handleSincronizarComisionesHuevo, syncingHuevo, setPeriodoBloqueado, handleGenerar, generando, hayOtraAbierta, employeeInputRef, codigoInput, setCodigoInput, handleCodigoSearch, setIsEmpModalOpen, empleadoData, saveCurrentEmployee, guardandoManual, savingRef, selected, handleExcluirEmpleado, excluirMutation, handleAgregarEmpleado, autoSaveRef, sinEmpleado, detalles, handleValorChange, sueldoQuincActual, ingresosAdicActual, percTotal, calculando, calculo, otrasDedActual, otraAbiertaItem, isEmpModalOpen, handleSelectEmployee, previewPeriodo, setPreviewPeriodo, exportModalConfig, handleConfirmExport };
}
