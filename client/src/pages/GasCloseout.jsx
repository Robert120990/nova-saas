import { useState, useRef, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
    Calculator, Lock, Unlock, Loader2, User, Calendar, Hash, X,
    Fuel, Receipt, CreditCard, Gift, Percent, Truck, Droplets,
    FlaskConical, Banknote, ArrowLeft, UserCheck, Printer, BarChart3, LockOpen, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
// SearchableSelect moved to modal components
import { downloadCloseoutPdf } from '../utils/closeoutPdf';
import Money from '../components/ui/Money';
import { useDirtyTracker } from '../hooks/useDirtyTracker';
import * as XLSX from 'xlsx';
import { getTodayString } from '../utils/dateUtils';
import { unwrapList } from '../utils/apiUtils';
import {
    GasNozzleAssignModal,
    GasRemesasModal,
    GasGastosModal,
    GasLubricantesModal,
    GasTankReadingsModal,
    GasCuponesModal,
    GasAdelantosModal,
    GasReadingsModal,
    GasDescuentosModal,
    GasTarjetasModal,
    GasCreditosModal,
    GasValesModal,
    GasDiferenciasModal,
    GasAnticiposModal,
    GasTrupputModal
} from '../components/gas';

const parseDecimal = (value) => {
    if (value == null) return NaN;
    let str = String(value).trim();
    if (str === '') return NaN;
    const hasComma = str.includes(',');
    const hasDot = str.includes('.');
    if (hasComma && hasDot) {
        const lastComma = str.lastIndexOf(',');
        const lastDot = str.lastIndexOf('.');
        if (lastComma > lastDot) {
            str = str.replace(/\./g, '').replace(',', '.');
        } else {
            str = str.replace(/,/g, '');
        }
    } else if (hasComma) {
        str = str.replace(',', '.');
    }
    str = str.replace(/[^0-9.-]/g, '');
    return parseFloat(str);
};

const GasCloseout = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const confirm = useConfirm();
    const editId = searchParams.get('editId');
    const isSuperAdmin = user?.role === 'SuperAdmin' || user?.role?.toLowerCase() === 'superadmin';

    const toDateStr = (v) => {
        if (!v) return '';
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
        try { return new Date(v).toISOString().slice(0, 10); } catch { return ''; }
    };

    const toDateStrDDMMYYYY = (v) => {
        if (!v) return '';
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
            const [y, m, d] = v.slice(0, 10).split('-');
            return `${d}/${m}/${y}`;
        }
        try {
            const d = new Date(v);
            if (isNaN(d.getTime())) return '';
            return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        } catch { return ''; }
    };

    const formatHora = (v) => {
        if (!v) return '';
        try {
            const d = new Date(v);
            if (isNaN(d.getTime())) return '';
            return d.toTimeString().slice(0, 5);
        } catch { return ''; }
    };

    const shiftEstado = (s) => (s?.status === 'open' ? 'ABIERTO' : 'CERRADO');

    const [closeoutId, setCloseoutId] = useState(null);
    const [estado, setEstado] = useState(null);
    const [readings, setReadings] = useState([]);
    const [sellerId, setSellerId] = useState('');
    const [sellerName, setSellerName] = useState('');
    const [fechaTurno, setFechaTurno] = useState(getTodayString());
    const [numeroTurno, setNumeroTurno] = useState('');
    const [userModifiedTurno, setUserModifiedTurno] = useState(false);
    const [closeoutDespachadores, setCloseoutDespachadores] = useState([]);
    const [despachadorSelectValue, setDespachadorSelectValue] = useState('');
    const [showReadingsModal, setShowReadingsModal] = useState(false);
    const [editAnterior, setEditAnterior] = useState(false);
    const [showGastosModal, setShowGastosModal] = useState(false);
    const [gastos, setGastos] = useState([]);
    const [expenseCategories, setExpenseCategories] = useState([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
    const [tankReadings, setTankReadings] = useState([]);
    const [showTankReadingsModal, setShowTankReadingsModal] = useState(false);
    const [superAdminTankEdit, setSuperAdminTankEdit] = useState(false);
    const [showRemesasModal, setShowRemesasModal] = useState(false);
    const [remesas, setRemesas] = useState([]);
    const [showCuponesModal, setShowCuponesModal] = useState(false);
    const [cupones, setCupones] = useState([]);
    const [showDescuentosModal, setShowDescuentosModal] = useState(false);
    const [descuentos, setDescuentos] = useState([]);
    const [showAdelantosModal, setShowAdelantosModal] = useState(false);
    const [adelantos, setAdelantos] = useState([]);
    const [showLubricantesModal, setShowLubricantesModal] = useState(false);
    const [lubricantReadings, setLubricantReadings] = useState([]);
    const [lubricantLoading, setLubricantLoading] = useState(false);
    const [showTarjetasModal, setShowTarjetasModal] = useState(false);
    const [tarjetas, setTarjetas] = useState([]);
    const [showCreditosModal, setShowCreditosModal] = useState(false);
    const [creditos, setCreditos] = useState([]);
    const [showValesModal, setShowValesModal] = useState(false);
    const [vales, setVales] = useState([]);
    const [showAnticiposModal, setShowAnticiposModal] = useState(false);
    const [anticiposDesp, setAnticiposDesp] = useState([]);
    const [showTrupputModal, setShowTrupputModal] = useState(false);
    const [trupputDesp, setTrupputDesp] = useState([]);
    const [showDiferenciasModal, setShowDiferenciasModal] = useState(false);
    const [diferenciasData, setDiferenciasData] = useState(null);
    const [diferenciasLoading, setDiferenciasLoading] = useState(false);
    const [showConfirmComplementaria, setShowConfirmComplementaria] = useState(false);
    const [targetShiftId, setTargetShiftId] = useState('');
    const [closeoutBranchId, setCloseoutBranchId] = useState(null);
    const [despachadorNozzleAssignments, setDespachadorNozzleAssignments] = useState([]);
    const [showNozzleAssignModal, setShowNozzleAssignModal] = useState(false);
    const [modalAssignments, setModalAssignments] = useState([]);
    const [modalSelectedDespachadorId, setModalSelectedDespachadorId] = useState('');
    const [importResult, setImportResult] = useState(null);
    const [importing, setImporting] = useState(false);

    const inputRefs = useRef({});
    const fileInputRef = useRef(null);
    const tankInputRefs = useRef({});
    const badgeTapCountRef = useRef(0);
    const badgeTapTimerRef = useRef(null);
    const lubricantInputRefs = useRef({});
    const lastDespachadorRef = useRef(null);

    const modalSnapshotsRef = useRef({
        gastos: '[]',
        remesas: '[]',
        cupones: '[]',
        descuentos: '[]',
        adelantos: '[]',
        tarjetas: '[]',
        creditos: '[]',
        vales: '[]',
        anticipos: '[]',
        trupput: '[]'
    });
    const isAutoSavingRef = useRef(false);

    const getDefaultDespachador = () => {
        if (lastDespachadorRef.current) return lastDespachadorRef.current;
        if (closeoutDespachadores.length > 0) return closeoutDespachadores[0].despachador_id;
        if (allDespachadores.length > 0) return allDespachadores[0].id;
        return '';
    };

    const trackDespachadorChange = (field, value) => {
        if (field === 'despachador_id' && value) {
            lastDespachadorRef.current = value;
        }
    };

    useEffect(() => {
        const handler = (e) => {
            if (e.ctrlKey && e.altKey && e.key?.toLowerCase() === 'a') {
                e.preventDefault();
                if (!isSuperAdmin) {
                    toast.error('Solo los usuarios con rol SuperAdmin pueden activar la edición de lecturas anteriores');
                    return;
                }
                setEditAnterior(prev => {
                    const next = !prev;
                    if (next) {
                        toast.info('Modo SuperAdmin: Edición de lecturas anteriores activada');
                    } else {
                        toast.info('Edición de lecturas anteriores desactivada');
                    }
                    return next;
                });
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isSuperAdmin]);

    useEffect(() => {
        const onModalEscape = (e) => {
            if (e.key === 'Escape') {
                const openKey = ['gastos', 'remesas', 'cupones', 'descuentos', 'adelantos', 'tarjetas', 'creditos', 'vales', 'anticipos', 'trupput']
                    .find(k => {
                        switch (k) {
                            case 'gastos': return showGastosModal;
                            case 'remesas': return showRemesasModal;
                            case 'cupones': return showCuponesModal;
                            case 'descuentos': return showDescuentosModal;
                            case 'adelantos': return showAdelantosModal;
                            case 'tarjetas': return showTarjetasModal;
                            case 'creditos': return showCreditosModal;
                            case 'vales': return showValesModal;
                            case 'anticipos': return showAnticiposModal;
                            case 'trupput': return showTrupputModal;
                            default: return false;
                        }
                    });
                if (openKey) {
                    e.preventDefault();
                    handleSafeCloseModal(openKey);
                }
            }
        };
        window.addEventListener('keydown', onModalEscape);
        return () => window.removeEventListener('keydown', onModalEscape);
    }, [showGastosModal, showRemesasModal, showCuponesModal, showDescuentosModal, showAdelantosModal, showTarjetasModal, showCreditosModal, showValesModal, showAnticiposModal, showTrupputModal, gastos, remesas, cupones, descuentos, adelantos, tarjetas, creditos, vales, anticiposDesp, trupputDesp, estado, closeoutId]);

    const handleEstadoBadgeClick = async () => {
        if (!isSuperAdmin || estado !== 'reabierto') return;
        clearTimeout(badgeTapTimerRef.current);
        badgeTapTimerRef.current = setTimeout(() => { badgeTapCountRef.current = 0; }, 3000);
        const nextCount = badgeTapCountRef.current + 1;
        badgeTapCountRef.current = nextCount;
        if (nextCount < 5) return;
        badgeTapCountRef.current = 0;
        clearTimeout(badgeTapTimerRef.current);
        if (superAdminTankEdit) {
            setSuperAdminTankEdit(false);
            setEditAnterior(false);
            toast.info('Edición de tanques desactivada');
            return;
        }
        const ok = await confirm({
            title: '¿Habilitar edición de tanques?',
            message: 'Modo SuperAdmin: podrá editar las lecturas de tanque de este turno reabierto. Si existen turnos posteriores, sus lecturas anteriores y diferencias se recalcularán automáticamente.',
            confirmLabel: 'Habilitar edición',
            cancelLabel: 'Cancelar',
            variant: 'warning',
        });
        if (ok) {
            setSuperAdminTankEdit(true);
            toast.success('Edición de lecturas de tanque habilitada');
        }
    };

    const { data: editData, isLoading: editLoading } = useQuery({
        queryKey: ['gas-closeout-edit', editId],
        queryFn: async () => (await axios.get(`/api/gas-station/closeouts/${editId}`)).data,
        enabled: !!editId,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
    });

    useEffect(() => {
        if (editData) {
            setCloseoutId(editData.id);
            setReadings(editData.readings);
            setEstado(editData.estado);
            setSellerId(editData.seller_id);
            setSellerName(editData.seller_name);
            setFechaTurno(editData.fecha_turno?.split('T')[0] || editData.fecha_turno);
            setNumeroTurno(editData.numero_turno);
            setTankReadings(editData.tankReadings || []);
            setLubricantReadings(editData.lubricantReadings || []);
            setCloseoutDespachadores(editData.despachadores || []);
            setDespachadorNozzleAssignments(editData.despachadorNozzleAssignments || []);
            const cleanLoadedGastos = (editData.gastos || []).map(e => ({ ...e, fecha: toDateStr(e.fecha) }));
            setGastos(cleanLoadedGastos);
            setRemesas(editData.remesas || []);
            setCupones(editData.cupones || []);
            setDescuentos(editData.descuentos || []);
            setAdelantos(editData.adelantos || []);
            setTarjetas(editData.tarjetas || []);
            setCreditos(editData.creditos || []);
            setVales(editData.vales || []);
            setAnticiposDesp(editData.anticipos_despachadores || []);
            setTrupputDesp(editData.trupput_despachos || []);
            modalSnapshotsRef.current = {
                gastos: JSON.stringify(cleanLoadedGastos),
                remesas: JSON.stringify(editData.remesas || []),
                cupones: JSON.stringify(editData.cupones || []),
                descuentos: JSON.stringify(editData.descuentos || []),
                adelantos: JSON.stringify(editData.adelantos || []),
                tarjetas: JSON.stringify(editData.tarjetas || []),
                creditos: JSON.stringify(editData.creditos || []),
                vales: JSON.stringify(editData.vales || []),
                anticipos: JSON.stringify(editData.anticipos_despachadores || []),
                trupput: JSON.stringify(editData.trupput_despachos || [])
            };
            const firstWithDesp = [editData.gastos, editData.remesas, editData.cupones, editData.descuentos, editData.adelantos, editData.tarjetas, editData.creditos, editData.vales, editData.anticipos_despachadores, editData.trupput_despachos]
                .flat()
                .find(r => r && r.despachador_id);
            lastDespachadorRef.current = firstWithDesp?.despachador_id || editData.despachadores?.[0]?.despachador_id || null;
        }
    }, [editId, editData]);

    useEffect(() => {
        if (!editId) {
            setCloseoutId(null);
            setReadings([]);
            setEstado(null);
            setSellerId('');
            setSellerName('');
            setTankReadings([]);
            setLubricantReadings([]);
            setCloseoutDespachadores([]);
            setDespachadorNozzleAssignments([]);
            setGastos([]);
            setRemesas([]);
            setCupones([]);
            setDescuentos([]);
            setAdelantos([]);
            setTarjetas([]);
            setCreditos([]);
            setVales([]);
            setAnticiposDesp([]);
            setTrupputDesp([]);
            modalSnapshotsRef.current = {
                gastos: '[]',
                remesas: '[]',
                cupones: '[]',
                descuentos: '[]',
                adelantos: '[]',
                tarjetas: '[]',
                creditos: '[]',
                vales: '[]',
                anticipos: '[]',
                trupput: '[]'
            };
            lastDespachadorRef.current = null;
        }
    }, [editId]);

    const { data: sellers = [] } = useQuery({
        queryKey: ['sellers-all'],
        queryFn: async () => unwrapList(await axios.get('/api/sellers', { params: { limit: 200 } }))
    });

    const { data: allDespachadores = [] } = useQuery({
        queryKey: ['gas-despachadores-all', user?.branch_id],
        queryFn: async () => unwrapList(await axios.get('/api/gas-station/despachadores', { params: { limit: 999 } }))
    });

    // Opciones de despachadores para selectores de modales (Remesas, Tarjetas, Créditos, etc.)
    // Toma prioritariamente el nombre ingresado para este turno específico (closeoutDespachadores.nombre)
    const despachadoresOptions = useMemo(() => {
        const closeoutMap = new Map();
        (closeoutDespachadores || []).forEach(cd => {
            closeoutMap.set(cd.despachador_id, cd);
        });

        if (closeoutDespachadores && closeoutDespachadores.length > 0) {
            const options = closeoutDespachadores.map(cd => {
                const catalogDesp = allDespachadores.find(a => a.id === cd.despachador_id);
                const code = catalogDesp?.codigo || cd.despachador_codigo || '';
                const name = cd.nombre || catalogDesp?.descripcion || '';
                return {
                    id: cd.despachador_id,
                    codigo: code,
                    descripcion: name,
                    label: name ? `${code} — ${name}` : code
                };
            });

            allDespachadores.forEach(d => {
                if (!closeoutMap.has(d.id)) {
                    options.push({
                        id: d.id,
                        codigo: d.codigo,
                        descripcion: d.descripcion,
                        label: d.descripcion ? `${d.codigo} — ${d.descripcion}` : d.codigo
                    });
                }
            });

            return options;
        }

        return allDespachadores.map(d => ({
            id: d.id,
            codigo: d.codigo,
            descripcion: d.descripcion,
            label: d.descripcion ? `${d.codigo} — ${d.descripcion}` : d.codigo
        }));
    }, [closeoutDespachadores, allDespachadores]);

    const { data: lastTurno } = useQuery({
        queryKey: ['gas-last-turno'],
        queryFn: async () => (await axios.get('/api/gas-station/closeouts/last-turno')).data
    });

    const { data: nextTurno } = useQuery({
        queryKey: ['gas-next-turno', fechaTurno],
        queryFn: async () => (await axios.get('/api/gas-station/closeouts/next-turno', { params: { fecha: fechaTurno } })).data,
        enabled: !!fechaTurno && !closeoutId && !editId
    });

    useEffect(() => {
        if (nextTurno?.next_turno && !userModifiedTurno) {
            setNumeroTurno(nextTurno.next_turno);
        }
    }, [nextTurno, userModifiedTurno]);

    useEffect(() => {
        setUserModifiedTurno(false);
    }, [fechaTurno]);

    const { data: posTypesList = [] } = useQuery({
        queryKey: ['gas-pos-types', user?.branch_id],
        queryFn: async () => unwrapList(await axios.get('/api/gas-station/pos-types')),
        enabled: !!(closeoutId || editId)
    });

    const { data: liveNozzleAssignments = [] } = useQuery({
        queryKey: ['gas-despachador-nozzles-all', user?.branch_id],
        queryFn: async () => unwrapList(await axios.get('/api/gas-station/despachador-nozzles/all'))
    });

    const { data: gasSettings } = useQuery({
        queryKey: ['gas-station-settings'],
        queryFn: () => axios.get('/api/gas-station/settings').then(r => r.data),
    });

    const creditosAfectanCxcSetting = gasSettings?.creditos_afectan_cxc === '1';
    const creditosDesdeFecha = gasSettings?.creditos_afectan_cxc_desde || null;
    const currentTurnoFecha = String(editData?.fecha_turno || fechaTurno || '').split('T')[0];
    const creditosAfectanCxc = creditosAfectanCxcSetting && (!creditosDesdeFecha || (currentTurnoFecha && currentTurnoFecha >= creditosDesdeFecha));

    const despachadorVentas = useMemo(() => {
        if (!despachadorNozzleAssignments.length || !readings.length) return {};
        const map = {};
        for (const d of closeoutDespachadores) {
            const assignedNozzles = despachadorNozzleAssignments
                .filter(a => a.despachador_id === d.despachador_id)
                .map(a => a.nozzle_id);
            let total = 0;
            for (const r of readings) {
                if (assignedNozzles.includes(r.nozzle_id)) {
                    total += (r.lectura_actual - r.lectura_anterior - (r.calibracion || 0)) * r.precio;
                }
            }
            map[d.despachador_id] = total;
        }
        return map;
    }, [despachadorNozzleAssignments, readings, closeoutDespachadores]);

    const despachadorNoPercibido = useMemo(() => {
        const map = {};
        for (const d of closeoutDespachadores) {
            const did = d.despachador_id;
            const gastosSum = gastos.filter(g => parseInt(g.despachador_id) === did).reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
            const cuponesSum = cupones.filter(c => parseInt(c.despachador_id) === did).reduce((s, c) => s + (parseFloat(c.monto) || 0), 0);
            const descuentosSum = descuentos.filter(dd => parseInt(dd.despachador_id) === did).reduce((s, dd) => s + (parseFloat(dd.total) || 0), 0);
            const adelantosSum = adelantos.filter(a => parseInt(a.despachador_id) === did).reduce((s, a) => s + (parseFloat(a.monto) || 0), 0);
            const tarjetasSum = tarjetas.filter(t => parseInt(t.despachador_id) === did).reduce((s, t) => s + (parseFloat(t.monto) || 0), 0);
            const creditosSum = creditos.filter(c => parseInt(c.despachador_id) === did).reduce((s, c) => s + (parseFloat(c.monto) || 0), 0);
            const valesSum = vales.filter(v => parseInt(v.despachador_id) === did).reduce((s, v) => s + (parseFloat(v.monto) || 0), 0);
            const anticiposDespSum = anticiposDesp.filter(a => parseInt(a.despachador_id) === did).reduce((s, a) => s + (parseFloat(a.monto) || 0), 0);
            map[did] = gastosSum + cuponesSum + descuentosSum + adelantosSum + tarjetasSum + creditosSum + valesSum + anticiposDespSum;
        }
        return map;
    }, [closeoutDespachadores, gastos, cupones, descuentos, adelantos, tarjetas, creditos, vales, anticiposDesp]);

    const despachadorEntregado = useMemo(() => {
        const map = {};
        for (const d of closeoutDespachadores) {
            const did = d.despachador_id;
            const remesasSum = remesas.filter(r => parseInt(r.despachador_id) === did).reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
            map[did] = remesasSum;
        }
        return map;
    }, [closeoutDespachadores, remesas]);

    const initMutation = useMutation({
        mutationFn: (data) => axios.post('/api/gas-station/closeouts/init', data),
        onSuccess: (res) => {
            setCloseoutId(res.data.id);
            setReadings(res.data.readings.map(r => ({ ...r, lectura_actual: r.lectura_anterior })));
            setTankReadings(res.data.tankReadings?.map(r => ({ ...r, lectura_actual: r.lectura_anterior })) || []);
            setEstado('abierto');
            if (res.data.despachadores) setCloseoutDespachadores(res.data.despachadores);
            if (res.data.despachadorNozzleAssignments) setDespachadorNozzleAssignments(res.data.despachadorNozzleAssignments);
            queryClient.invalidateQueries({ queryKey: ['gas-last-turno'] });
            queryClient.invalidateQueries({ queryKey: ['gas-closeouts'] });
            toast.success('Cierre de lecturas iniciado');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al iniciar')
    });

    const updateMutation = useMutation({
        mutationFn: ({ readingId, data }) =>
            axios.patch(`/api/gas-station/closeouts/${closeoutId}/readings/${readingId}`, data),
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar')
    });

    const batchUpdateMutation = useMutation({
        mutationFn: (readings) =>
            axios.patch(`/api/gas-station/closeouts/${closeoutId}/readings/batch`, { readings }),
        onSuccess: (res) => {
            const updated = res.data.readings;
            setReadings(prev => prev.map(r => {
                const u = updated.find(x => x.id === r.id);
                if (u) return { ...r, lectura_actual: u.lectura_actual, diferencia: u.diferencia, monto: u.monto };
                return r;
            }));
            setImportResult(null);
            setImporting(false);
            toast.success(`${res.data.updated} lecturas actualizadas`);
        },
        onError: (error) => {
            setImporting(false);
            toast.error(error.response?.data?.message || 'Error al importar lecturas');
        }
    });

    const handleImportExcel = (file) => {
        if (!file) return;
        setImporting(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];

                // Get rows as arrays for robust column detection
                const allRows = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 });

                // Find data rows: rows where columns 2 and 3 (0-indexed) are numeric volumes
                const dataRows = [];
                for (const cells of allRows) {
                    const col2 = parseDecimal(cells[2]);
                    const col3 = parseDecimal(cells[3]);
                    const col1 = String(cells[1] ?? '').trim();
                    // Data rows have numeric volumes in col 2 (Initial) and col 3 (Final)
                    // Skip header rows (non-numeric col 2)
                    if (!isNaN(col2) && !isNaN(col3) && col2 >= 0 && col3 >= 0 && col1) {
                        dataRows.push({
                            initial_volume: col2,
                            final_volume: col3,
                            nozzle: col1
                        });
                    }
                }

                const matched = [];
                const warnings = [];
                const unmatched = [];

                for (let i = 0; i < dataRows.length; i++) {
                    const row = dataRows[i];
                    const initialVolume = parseDecimal(row.initial_volume);
                    const finalVolume = parseDecimal(row.final_volume);
                    const nozzleDesc = String(row.nozzle || '');

                    if (isNaN(initialVolume) || isNaN(finalVolume)) {
                        unmatched.push({ row: nozzleDesc, reason: 'Volumen inválido' });
                        continue;
                    }

                    const reading = readings[i];
                    if (!reading) {
                        unmatched.push({ row: nozzleDesc, reason: 'No hay lectura en esta posición' });
                        continue;
                    }

                    const antDiff = Math.abs(parseFloat(reading.lectura_anterior) - initialVolume);
                    if (antDiff >= 0.001) {
                        warnings.push({ row: nozzleDesc, reading: `${reading.codigo_pistola} — ${reading.descripcion_producto}`, expected: reading.lectura_anterior, actual: initialVolume, diff: antDiff.toFixed(3) });
                    }

                    matched.push({ readingId: reading.id, lectura_actual: finalVolume, codigo_pistola: reading.codigo_pistola, descripcion_producto: reading.descripcion_producto });
                }

                setImportResult({ matched, warnings, unmatched, total: dataRows.length });
                setImporting(false);
            } catch (err) {
                setImporting(false);
                toast.error('Error al leer el archivo Excel');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const closeMutation = useMutation({
        mutationFn: () => axios.post(`/api/gas-station/closeouts/${closeoutId}/close`),
        onSuccess: (res) => {
            setEstado('cerrado');
            setSuperAdminTankEdit(false);
            setEditAnterior(false);
            queryClient.invalidateQueries({ queryKey: ['gas-last-turno'] });
            queryClient.invalidateQueries({ queryKey: ['gas-closeouts'] });
            toast.success(res.data?.message || 'Cierre cerrado exitosamente');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al cerrar')
    });

    const handlePdf = async () => {
        try {
            const { data } = await axios.get(`/api/gas-station/closeouts/${closeoutId}/print-full`);
            await downloadCloseoutPdf(data);
        } catch (error) {
            toast.error('Error al generar PDF');
        }
    };

    const updateDespachadoresMutation = useMutation({
        mutationFn: (despachadores) => axios.put(`/api/gas-station/closeouts/${closeoutId}/despachadores`, { despachadores }),
        onSuccess: (res) => {
            if (res.data?.despachadores) {
                setCloseoutDespachadores(prev => prev.map(p => {
                    const saved = res.data.despachadores.find(s => s.despachador_id === p.despachador_id);
                    return saved ? { ...p, nombre: saved.nombre } : p;
                }));
            }
            queryClient.invalidateQueries({ queryKey: ['gas-closeout-edit', closeoutId] });
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar despachadores')
    });

    const updateNozzleAssignmentsMutation = useMutation({
        mutationFn: (assignments) => axios.put(`/api/gas-station/closeouts/${closeoutId}/despachador-nozzles`, { assignments }),
        onSuccess: (res) => {
            setDespachadorNozzleAssignments(res.data);
            toast.success('Asignaciones de mangueras actualizadas');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar asignaciones')
    });

    const updateTankMutation = useMutation({
        mutationFn: ({ readingId, data }) =>
            axios.patch(`/api/gas-station/closeouts/${closeoutId}/tank-readings/${readingId}`, data),
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar lectura de tanque')
    });

    const saveExpensesMutation = useMutation({
        mutationFn: (expenses) => axios.post(`/api/gas-station/closeouts/${closeoutId}/expenses`, {
            expenses: expenses.map(e => ({
                ...e,
                provider_id: e.provider_id || null
            }))
        }),
        onSuccess: (res) => {
            const clean = res.data.map(e => ({ ...e, fecha: toDateStr(e.fecha) }));
            setGastos(clean);
            if (modalSnapshotsRef.current) modalSnapshotsRef.current.gastos = JSON.stringify(clean);
            queryClient.invalidateQueries({ queryKey: ['gas-closeout-expenses', closeoutId] });
            setShowGastosModal(false);
            if (isAutoSavingRef.current) {
                toast.success('Gastos guardados automáticamente al salir');
                isAutoSavingRef.current = false;
            } else {
                toast.success('Gastos guardados');
            }
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar gastos')
    });

    const saveRemesasMutation = useMutation({
        mutationFn: (remesas) => axios.post(`/api/gas-station/closeouts/${closeoutId}/remesas`, { remesas }),
        onSuccess: (res) => {
            setRemesas(res.data);
            if (modalSnapshotsRef.current) modalSnapshotsRef.current.remesas = JSON.stringify(res.data);
            queryClient.invalidateQueries({ queryKey: ['gas-closeout-remesas', closeoutId] });
            setShowRemesasModal(false);
            if (isAutoSavingRef.current) {
                toast.success('Remesas guardadas automáticamente al salir');
                isAutoSavingRef.current = false;
            } else {
                toast.success('Remesas guardadas');
            }
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar remesas')
    });

    const gastosTotal = useMemo(() =>
        gastos.reduce((s, e) => s + (parseFloat(e.valor) || 0), 0),
    [gastos]);

    const remesasTotal = useMemo(() =>
        remesas.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0),
    [remesas]);

    const saveCuponesMutation = useMutation({
        mutationFn: (cupones) => axios.post(`/api/gas-station/closeouts/${closeoutId}/cupones`, { cupones }),
        onSuccess: (res) => {
            setCupones(res.data);
            if (modalSnapshotsRef.current) modalSnapshotsRef.current.cupones = JSON.stringify(res.data);
            queryClient.invalidateQueries({ queryKey: ['gas-closeout-cupones', closeoutId] });
            setShowCuponesModal(false);
            if (isAutoSavingRef.current) {
                toast.success('Cupones guardados automáticamente al salir');
                isAutoSavingRef.current = false;
            } else {
                toast.success('Cupones guardados');
            }
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar cupones')
    });

    const cuponesTotal = useMemo(() =>
        cupones.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0),
    [cupones]);

    const saveDescuentosMutation = useMutation({
        mutationFn: (descuentos) => axios.post(`/api/gas-station/closeouts/${closeoutId}/descuentos`, { descuentos }),
        onSuccess: (res) => {
            setDescuentos(res.data);
            if (modalSnapshotsRef.current) modalSnapshotsRef.current.descuentos = JSON.stringify(res.data);
            queryClient.invalidateQueries({ queryKey: ['gas-closeout-descuentos', closeoutId] });
            setShowDescuentosModal(false);
            if (isAutoSavingRef.current) {
                toast.success('Descuentos guardados automáticamente al salir');
                isAutoSavingRef.current = false;
            } else {
                toast.success('Descuentos guardados');
            }
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar descuentos')
    });

    const descuentosTotal = useMemo(() =>
        descuentos.reduce((s, d) => s + (parseFloat(d.total) || 0), 0),
    [descuentos]);

    const saveAdelantosMutation = useMutation({
        mutationFn: (adelantos) => axios.post(`/api/gas-station/closeouts/${closeoutId}/adelantos`, { adelantos }),
        onSuccess: (res) => {
            setAdelantos(res.data);
            if (modalSnapshotsRef.current) modalSnapshotsRef.current.adelantos = JSON.stringify(res.data);
            queryClient.invalidateQueries({ queryKey: ['gas-closeout-adelantos', closeoutId] });
            setShowAdelantosModal(false);
            if (isAutoSavingRef.current) {
                toast.success('Adelantos guardados automáticamente al salir');
                isAutoSavingRef.current = false;
            } else {
                toast.success('Adelantos guardados');
            }
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar adelantos')
    });

    const adelantosTotal = useMemo(() =>
        adelantos.reduce((s, a) => s + (parseFloat(a.monto) || 0), 0),
    [adelantos]);

    const tarjetasTotal = useMemo(() =>
        tarjetas.reduce((s, t) => s + (parseFloat(t.monto) || 0), 0),
    [tarjetas]);

    const tarjetasResumenPorTipo = useMemo(() => {
        const map = {};
        for (const t of tarjetas) {
            const key = t.pos_type_id ? String(t.pos_type_id) : 'sin_tipo';
            if (!map[key]) {
                const tipo = posTypesList.find(p => String(p.id) === key);
                map[key] = {
                    key,
                    nombre: tipo ? tipo.nombre : 'Sin tipo de POS',
                    cantidad: 0,
                    total: 0
                };
            }
            map[key].cantidad += 1;
            map[key].total += parseFloat(t.monto) || 0;
        }
        return Object.values(map).sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [tarjetas, posTypesList]);

    const creditosTotal = useMemo(() =>
        creditos.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0),
    [creditos]);

    const valesTotal = useMemo(() =>
        vales.reduce((s, v) => s + (parseFloat(v.monto) || 0), 0),
    [vales]);

    const anticiposDespTotal = useMemo(() =>
        anticiposDesp.reduce((s, a) => s + (parseFloat(a.monto) || 0), 0),
    [anticiposDesp]);

    const trupputDespTotal = useMemo(() =>
        trupputDesp.reduce((s, t) => s + (parseFloat(t.monto) || 0), 0),
    [trupputDesp]);

    const pendingAnticiposByClient = useMemo(() => {
        const map = {};
        anticiposDesp.forEach(a => {
            if (!a.cliente_id) return;
            if (Number(a.id) > 1e9) {
                map[a.cliente_id] = (map[a.cliente_id] || 0) + (parseFloat(a.monto) || 0);
            }
        });
        return map;
    }, [anticiposDesp]);

    const pendingTrupputGalonesByClient = useMemo(() => {
        const map = {};
        trupputDesp.forEach(t => {
            if (!t.cliente_id) return;
            if (Number(t.id) > 1e9) {
                map[t.cliente_id] = (map[t.cliente_id] || 0) + (parseFloat(t.galones) || 0);
            }
        });
        return map;
    }, [trupputDesp]);

    const saveTarjetasMutation = useMutation({
        mutationFn: (tarjetas) => axios.post(`/api/gas-station/closeouts/${closeoutId}/tarjetas`, { tarjetas }),
        onSuccess: (res) => {
            setTarjetas(res.data);
            if (modalSnapshotsRef.current) modalSnapshotsRef.current.tarjetas = JSON.stringify(res.data);
            queryClient.invalidateQueries({ queryKey: ['gas-closeout-tarjetas', closeoutId] });
            setShowTarjetasModal(false);
            if (isAutoSavingRef.current) {
                toast.success('Tarjetas guardadas automáticamente al salir');
                isAutoSavingRef.current = false;
            } else {
                toast.success('Tarjetas guardadas');
            }
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar tarjetas')
    });

    const saveCreditosMutation = useMutation({
        mutationFn: (creditos) => axios.post(`/api/gas-station/closeouts/${closeoutId}/creditos`, { creditos }),
        onSuccess: (res) => {
            setCreditos(res.data);
            if (modalSnapshotsRef.current) modalSnapshotsRef.current.creditos = JSON.stringify(res.data);
            queryClient.invalidateQueries({ queryKey: ['gas-closeout-creditos', closeoutId] });
            setShowCreditosModal(false);
            if (isAutoSavingRef.current) {
                toast.success('Créditos guardados automáticamente al salir');
                isAutoSavingRef.current = false;
            } else {
                toast.success('Créditos guardados');
            }
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar créditos')
    });

    const saveValesMutation = useMutation({
        mutationFn: (vales) => axios.post(`/api/gas-station/closeouts/${closeoutId}/vales`, { vales }),
        onSuccess: (res) => {
            setVales(res.data);
            if (modalSnapshotsRef.current) modalSnapshotsRef.current.vales = JSON.stringify(res.data);
            queryClient.invalidateQueries({ queryKey: ['gas-closeout-vales', closeoutId] });
            setShowValesModal(false);
            if (isAutoSavingRef.current) {
                toast.success('Vales guardados automáticamente al salir');
                isAutoSavingRef.current = false;
            } else {
                toast.success('Vales guardados');
            }
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar vales')
    });

    const saveAnticiposDespMutation = useMutation({
        mutationFn: (anticipos) => axios.post(`/api/gas-station/closeouts/${closeoutId}/anticipos-desp`, { anticipos }),
        onSuccess: (res) => {
            setAnticiposDesp(res.data);
            if (modalSnapshotsRef.current) modalSnapshotsRef.current.anticipos = JSON.stringify(res.data);
            queryClient.invalidateQueries({ queryKey: ['gas-closeout-anticipos-desp', closeoutId] });
            setShowAnticiposModal(false);
            if (isAutoSavingRef.current) {
                toast.success('Anticipos despachados guardados automáticamente al salir');
                isAutoSavingRef.current = false;
            } else {
                toast.success('Anticipos despachados guardados');
            }
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar anticipos despachados')
    });

    const saveTrupputDespMutation = useMutation({
        mutationFn: (despachos) => axios.post(`/api/gas-station/closeouts/${closeoutId}/trupput-desp`, { despachos }),
        onSuccess: (res) => {
            setTrupputDesp(res.data);
            if (modalSnapshotsRef.current) modalSnapshotsRef.current.trupput = JSON.stringify(res.data);
            queryClient.invalidateQueries({ queryKey: ['gas-closeout-trupput-desp', closeoutId] });
            setShowTrupputModal(false);
            if (isAutoSavingRef.current) {
                toast.success('Despachos Trupput guardados automáticamente al salir');
                isAutoSavingRef.current = false;
            } else {
                toast.success('Despachos Trupput guardados');
            }
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar despachos Trupput')
    });

    const sectionConfig = {
        gastos: {
            name: 'Gastos',
            getData: () => gastos,
            setData: setGastos,
            setShow: setShowGastosModal,
            mutate: (data) => saveExpensesMutation.mutate(data),
            mutateAsync: (data) => saveExpensesMutation.mutateAsync(data),
            isPending: () => saveExpensesMutation.isPending,
            cleanForSave: (data) => data.map(e => ({ ...e, provider_id: e.provider_id || null })),
            isEmptyRow: (r) => (!r.rubro || r.rubro.trim() === '') && (!r.proveedor || r.proveedor.trim() === '') && (!r.documento || r.documento.trim() === '') && (!r.comentario || r.comentario.trim() === '') && (parseFloat(r.valor) || 0) === 0,
            validateRow: (r) => {
                if (!r.despachador_id) return 'Falta asignar despachador';
                if (!r.rubro || r.rubro.trim() === '') return 'Falta seleccionar el rubro';
                if ((parseFloat(r.valor) || 0) <= 0) return 'El valor debe ser mayor a 0';
                return null;
            }
        },
        remesas: {
            name: 'Remesas',
            getData: () => remesas,
            setData: setRemesas,
            setShow: setShowRemesasModal,
            mutate: (data) => saveRemesasMutation.mutate(data),
            mutateAsync: (data) => saveRemesasMutation.mutateAsync(data),
            isPending: () => saveRemesasMutation.isPending,
            isEmptyRow: (r) => (!r.descripcion || r.descripcion.trim() === '') && (parseFloat(r.monto) || 0) === 0,
            validateRow: (r) => {
                if (!r.despachador_id) return 'Falta asignar despachador';
                if ((parseFloat(r.monto) || 0) <= 0) return 'El monto debe ser mayor a 0';
                return null;
            }
        },
        cupones: {
            name: 'Cupones',
            getData: () => cupones,
            setData: setCupones,
            setShow: setShowCuponesModal,
            mutate: (data) => saveCuponesMutation.mutate(data),
            mutateAsync: (data) => saveCuponesMutation.mutateAsync(data),
            isPending: () => saveCuponesMutation.isPending,
            isEmptyRow: (r) => (!r.cupon || r.cupon.trim() === '') && !r.distribuidora_id && (parseFloat(r.monto) || 0) === 0,
            validateRow: (r) => {
                if (!r.despachador_id) return 'Falta asignar despachador';
                if ((parseFloat(r.monto) || 0) <= 0) return 'El monto debe ser mayor a 0';
                return null;
            }
        },
        descuentos: {
            name: 'Descuentos',
            getData: () => descuentos,
            setData: setDescuentos,
            setShow: setShowDescuentosModal,
            mutate: (data) => saveDescuentosMutation.mutate(data),
            mutateAsync: (data) => saveDescuentosMutation.mutateAsync(data),
            isPending: () => saveDescuentosMutation.isPending,
            isEmptyRow: (r) => (!r.documento || r.documento.trim() === '') && !r.cliente_id && (parseFloat(r.total) || 0) === 0 && (parseFloat(r.cantidad) || 0) === 0,
            validateRow: (r) => {
                if (!r.despachador_id) return 'Falta asignar despachador';
                if ((parseFloat(r.total) || 0) <= 0 && (parseFloat(r.cantidad) || 0) <= 0) return 'Debe ingresar total o galonaje mayor a 0';
                return null;
            }
        },
        adelantos: {
            name: 'Adelantos',
            getData: () => adelantos,
            setData: setAdelantos,
            setShow: setShowAdelantosModal,
            mutate: (data) => saveAdelantosMutation.mutate(data),
            mutateAsync: (data) => saveAdelantosMutation.mutateAsync(data),
            isPending: () => saveAdelantosMutation.isPending,
            isEmptyRow: (r) => (!r.empleado || r.empleado.trim() === '') && (parseFloat(r.monto) || 0) === 0,
            validateRow: (r) => {
                if (!r.despachador_id) return 'Falta asignar despachador';
                if (!r.empleado || r.empleado.trim() === '') return 'Falta ingresar el empleado';
                if ((parseFloat(r.monto) || 0) <= 0) return 'El monto debe ser mayor a 0';
                return null;
            }
        },
        tarjetas: {
            name: 'Tarjetas',
            getData: () => tarjetas,
            setData: setTarjetas,
            setShow: setShowTarjetasModal,
            mutate: (data) => saveTarjetasMutation.mutate(data),
            mutateAsync: (data) => saveTarjetasMutation.mutateAsync(data),
            isPending: () => saveTarjetasMutation.isPending,
            isEmptyRow: (r) => (!r.num_tarjeta || r.num_tarjeta.trim() === '') && (!r.num_autorizacion || r.num_autorizacion.trim() === '') && !r.pos_type_id && (parseFloat(r.monto) || 0) === 0,
            validateRow: (r) => {
                if (!r.despachador_id) return 'Falta asignar despachador';
                if ((parseFloat(r.monto) || 0) <= 0) return 'El monto debe ser mayor a 0';
                return null;
            }
        },
        creditos: {
            name: 'Créditos',
            getData: () => creditos,
            setData: setCreditos,
            setShow: setShowCreditosModal,
            mutate: (data) => saveCreditosMutation.mutate(data),
            mutateAsync: (data) => saveCreditosMutation.mutateAsync(data),
            isPending: () => saveCreditosMutation.isPending,
            isEmptyRow: (r) => !r.cliente_id && (!r.documento || r.documento.trim() === '') && (parseFloat(r.monto) || 0) === 0 && (parseFloat(r.cantidad) || 0) === 0,
            validateRow: (r) => {
                if (!r.despachador_id) return 'Falta asignar despachador';
                if (!r.cliente_id) return 'Falta seleccionar el cliente';
                if ((parseFloat(r.monto) || 0) <= 0) return 'El monto debe ser mayor a 0';
                return null;
            }
        },
        vales: {
            name: 'Vales',
            getData: () => vales,
            setData: setVales,
            setShow: setShowValesModal,
            mutate: (data) => saveValesMutation.mutate(data),
            mutateAsync: (data) => saveValesMutation.mutateAsync(data),
            isPending: () => saveValesMutation.isPending,
            isEmptyRow: (r) => !r.cliente_id && (!r.documento || r.documento.trim() === '') && (parseFloat(r.monto) || 0) === 0 && (parseFloat(r.cantidad) || 0) === 0,
            validateRow: (r) => {
                if (!r.despachador_id) return 'Falta asignar despachador';
                if (!r.cliente_id) return 'Falta seleccionar el cliente';
                if ((parseFloat(r.monto) || 0) <= 0) return 'El monto debe ser mayor a 0';
                return null;
            }
        },
        anticipos: {
            name: 'Anticipos Despachados',
            getData: () => anticiposDesp,
            setData: setAnticiposDesp,
            setShow: setShowAnticiposModal,
            mutate: (data) => saveAnticiposDespMutation.mutate(data),
            mutateAsync: (data) => saveAnticiposDespMutation.mutateAsync(data),
            isPending: () => saveAnticiposDespMutation.isPending,
            isEmptyRow: (r) => !r.cliente_id && (!r.documento || r.documento.trim() === '') && (parseFloat(r.monto) || 0) === 0 && (parseFloat(r.cantidad) || 0) === 0,
            validateRow: (r) => {
                if (!r.despachador_id) return 'Falta asignar despachador';
                if (!r.cliente_id) return 'Falta seleccionar el cliente';
                if ((parseFloat(r.monto) || 0) <= 0) return 'El monto debe ser mayor a 0';
                return null;
            }
        },
        trupput: {
            name: 'Trupput Despachos',
            getData: () => trupputDesp,
            setData: setTrupputDesp,
            setShow: setShowTrupputModal,
            mutate: (data) => saveTrupputDespMutation.mutate(data),
            mutateAsync: (data) => saveTrupputDespMutation.mutateAsync(data),
            isPending: () => saveTrupputDespMutation.isPending,
            isEmptyRow: (r) => !r.cliente_id && (!r.documento || r.documento.trim() === '') && (parseFloat(r.galones) || 0) === 0 && (parseFloat(r.monto) || 0) === 0,
            validateRow: (r) => {
                if (!r.despachador_id) return 'Falta asignar despachador';
                if (!r.cliente_id) return 'Falta seleccionar el cliente';
                if ((parseFloat(r.monto) || 0) <= 0 && (parseFloat(r.galones) || 0) <= 0) return 'Debe ingresar monto o galonaje mayor a 0';
                return null;
            }
        }
    };

    const isSectionDirty = (key) => {
        const cfg = sectionConfig[key];
        if (!cfg || !modalSnapshotsRef.current) return false;
        const current = cfg.getData();
        const snap = modalSnapshotsRef.current[key] || '[]';
        return JSON.stringify(current) !== snap;
    };

    const isAnySectionDirty = () => {
        if (!modalSnapshotsRef.current) return false;
        return ['gastos', 'remesas', 'cupones', 'descuentos', 'adelantos', 'tarjetas', 'creditos', 'vales', 'anticipos', 'trupput'].some(k => isSectionDirty(k));
    };

    useDirtyTracker('cierre', readings.some(r => r.valor) || isAnySectionDirty());

    const handleSaveSection = (key) => {
        const cfg = sectionConfig[key];
        if (!cfg) return;
        const current = cfg.getData();
        const nonEmptyRows = current.filter(r => !cfg.isEmptyRow(r));
        for (const row of nonEmptyRows) {
            const err = cfg.validateRow(row);
            if (err) {
                toast.error(`En ${cfg.name}: ${err}`);
                return;
            }
        }
        cfg.setData(nonEmptyRows);
        const dataToSave = cfg.cleanForSave ? cfg.cleanForSave(nonEmptyRows) : nonEmptyRows;
        isAutoSavingRef.current = false;
        cfg.mutate(dataToSave);
    };

    const handleSafeCloseModal = async (key) => {
        const cfg = sectionConfig[key];
        if (!cfg) return;

        if (estado === 'cerrado' || !closeoutId) {
            cfg.setShow(false);
            return;
        }

        if (!isSectionDirty(key)) {
            cfg.setShow(false);
            return;
        }

        const current = cfg.getData();
        const nonEmptyRows = current.filter(r => !cfg.isEmptyRow(r));
        const snap = modalSnapshotsRef.current[key] || '[]';
        const isStillDirty = JSON.stringify(nonEmptyRows) !== snap;

        if (!isStillDirty) {
            cfg.setData(nonEmptyRows);
            cfg.setShow(false);
            return;
        }

        let validationError = null;
        for (const row of nonEmptyRows) {
            const err = cfg.validateRow(row);
            if (err) {
                validationError = err;
                break;
            }
        }

        if (validationError) {
            const ok = await confirm({
                title: `Cambios sin guardar en ${cfg.name}`,
                message: `Hay filas con información incompleta (${validationError}). Si sales ahora, los cambios no guardados se perderán. ¿Deseas continuar editando o descartar los cambios?`,
                confirmLabel: 'Descartar cambios y salir',
                cancelLabel: 'Continuar editando',
                variant: 'warning',
            });
            if (ok) {
                try {
                    const initialData = JSON.parse(snap);
                    cfg.setData(initialData);
                } catch { }
                cfg.setShow(false);
            }
            return;
        }

        try {
            cfg.setData(nonEmptyRows);
            const dataToSave = cfg.cleanForSave ? cfg.cleanForSave(nonEmptyRows) : nonEmptyRows;
            isAutoSavingRef.current = true;
            await cfg.mutateAsync(dataToSave);
            cfg.setShow(false);
        } catch (err) {
            console.error(`Error al auto-guardar ${cfg.name}:`, err);
            isAutoSavingRef.current = false;
            const ok = await confirm({
                title: `Error al auto-guardar ${cfg.name}`,
                message: `Hubo un problema al guardar automáticamente: ${err?.response?.data?.message || err.message || 'Error del servidor'}. ¿Deseas descartar los cambios o continuar editando?`,
                confirmLabel: 'Descartar cambios y salir',
                cancelLabel: 'Continuar editando',
                variant: 'danger',
            });
            if (ok) {
                try {
                    const initialData = JSON.parse(snap);
                    cfg.setData(initialData);
                } catch { }
                cfg.setShow(false);
            }
        }
    };


    const generarComplementariaMutation = useMutation({
        mutationFn: ({ shift_id }) => axios.post(`/api/gas-station/closeouts/${closeoutId}/generar-complementaria`, { shift_id }),
        onSuccess: (res) => {
            const { resultados, total_exitosos, total_fallidos } = res.data;
            if (total_fallidos > 0) {
                const errores = resultados.filter(r => !r.success).map(r => `${r.producto}: ${r.error}`).join('. ');
                toast.error(`${total_exitosos} exitosas, ${total_fallidos} fallidas. ${errores}`);
            } else {
                toast.success(`${total_exitosos} complementarias generadas exitosamente`);
            }
            setShowDiferenciasModal(false);
            setShowConfirmComplementaria(false);
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al generar complementaria')
    });

    const dayStr = closeoutId ? String(editData?.fecha_turno || fechaTurno || '').split('T')[0] : null;
    const dayShiftsQuery = useQuery({
        queryKey: ['shifts', 'day', closeoutBranchId, dayStr],
        queryFn: async () => (await axios.get('/api/shifts', { params: { branch_id: closeoutBranchId, start_date: dayStr, end_date: dayStr, limit: 50 } })).data,
        enabled: showDiferenciasModal && !!closeoutBranchId && !!dayStr,
    });

    useEffect(() => {
        if (!showDiferenciasModal || !targetShiftId) return;
        let active = true;
        setDiferenciasLoading(true);
        axios.get(`/api/gas-station/closeouts/${closeoutId}/ventas-comparacion`, { params: { shift_id: targetShiftId } })
            .then(({ data }) => {
                if (active) {
                    setDiferenciasData(data);
                    setCloseoutBranchId(data.branch_id);
                }
            })
            .catch((error) => {
                if (active) toast.error(error.response?.data?.message || 'Error al obtener datos de comparacion');
            })
            .finally(() => {
                if (active) setDiferenciasLoading(false);
            });
        return () => { active = false; };
    }, [showDiferenciasModal, targetShiftId, closeoutId]);

    const selectedTargetShift = (Array.isArray(dayShiftsQuery.data) ? dayShiftsQuery.data : (dayShiftsQuery.data?.data || [])).find(s => String(s.id) === String(targetShiftId)) || null;

    const lubricantTotal = useMemo(() =>
        lubricantReadings.reduce((s, r) => s + (parseFloat(r.total) || 0), 0),
    [lubricantReadings]);

    const saveLubricantesMutation = useMutation({
        mutationFn: (readings) => axios.post(`/api/gas-station/closeouts/${closeoutId}/lubricantes`, { readings }),
        onSuccess: (res) => {
            setLubricantReadings(res.data);
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar lubricantes')
    });

    // Carga remota para SearchableSelect (clientes/proveedores pueden ser miles)
    const loadCustomers = (extraParams = {}) => async (search, page) => {
        const { data } = await axios.get('/api/customers', {
            params: { search: search || undefined, page, limit: 50, ...extraParams }
        });
        return data;
    };

    const loadProviders = async (search, page) => {
        const { data } = await axios.get('/api/providers', {
            params: { search: search || undefined, page, limit: 50 }
        });
        return data;
    };

    const loadExpenseCategories = async () => {
        try {
            const res = await axios.get('/api/gas-station/expense-categories');
            setExpenseCategories(res.data);
        } catch { }
    };

    const handleOpenGastos = () => {
        loadExpenseCategories();
        setShowGastosModal(true);
    };

    const handleAddGastoRow = () => {
        const defaultDesp = getDefaultDespachador();
        setGastos(prev => [...prev, {
            id: Date.now(),
            rubro: '',
            fecha: getTodayString(),
            documento: '',
            tipo: 'ccf',
            provider_id: '',
            proveedor: '',
            valor: 0,
            comentario: '',
            despachador_id: defaultDesp
        }]);
    };

    const handleGastoChange = (id, field, value) => {
        trackDespachadorChange(field, value);
        setGastos(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
    };

    const handleRemoveGasto = (id) => {
        setGastos(prev => prev.filter(g => g.id !== id));
    };

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) return;
        try {
            const res = await axios.post('/api/gas-station/expense-categories', { name: newCategoryName.trim() });
            setExpenseCategories(prev => [...prev, res.data]);
            setNewCategoryName('');
            setShowNewCategoryInput(false);
            toast.success('Rubro creado');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al crear rubro');
        }
    };

    const handleOpenRemesas = () => {
        setShowRemesasModal(true);
    };

    const handleAddRemesaRow = () => {
        const tempId = Date.now();
        const defaultDesp = getDefaultDespachador();
        setRemesas(prev => {
            const maxDoc = prev.reduce((max, r) => {
                const num = parseInt(r.documento, 10);
                return !isNaN(num) && num > max ? num : max;
            }, 0);
            return [...prev, {
                id: tempId,
                codigo: `REM-${closeoutId}-${prev.length + 1}`,
                documento: String(maxDoc + 1).padStart(2, '0'),
                descripcion: '',
                despachador_id: defaultDesp,
                tipo_operacion: 'venta_combustible',
                monto: 0
            }];
        });
    };

    const handleRemesaChange = (id, field, value) => {
        trackDespachadorChange(field, value);
        setRemesas(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleRemoveRemesa = (id) => {
        setRemesas(prev => prev.filter(r => r.id !== id));
    };

    const escHtml = (str) => {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    const handlePrintRemesaLabel = (remesa) => {
        const companyName = user?.company_name || '';
        const branchName = user?.branch_name || '';
        const cuentaBancaria = gasSettings?.cuenta_bancaria_pista || '';
        const barcodeValue = `${remesa.codigo || remesa.id}|${remesa.id}`;
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Remesa</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3/dist/JsBarcode.all.min.js"></script>
<style>
    @page { margin: 0; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 6mm 4mm; color: #1e293b; font-size: 10px; width: 76mm; max-width: 76mm; border: 1px solid #000; }
    .header { text-align: center; margin-bottom: 6px; }
    .header h2 { font-size: 13px; margin: 0 0 2px; }
    .header .sub { font-size: 9px; color: #64748b; }
    .label { font-size: 7px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 1px; }
    .value { font-size: 12px; font-weight: 700; margin-bottom: 6px; }
    .value.monto { font-size: 18px; color: #059669; }
    .divider { border: 0; border-top: 1px dashed #cbd5e1; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 9px; }
    .row .lbl { color: #64748b; }
    .row .val { font-weight: 600; }
    .barcode-wrap { text-align: center; margin: 6px 0; }
    .barcode-wrap svg { max-width: 100%; height: auto; }
    @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 76mm; max-width: 76mm; }
    }
</style></head><body>
    <div class="header">
        <h2>${escHtml(companyName)}</h2>
        <div class="sub">${escHtml(branchName)}</div>
    </div>
    <hr class="divider">
    <div class="label">Remesa</div>
    <div class="value">${escHtml(remesa.documento || '—')}</div>
    <div class="barcode-wrap">
        <svg id="barcode"></svg>
    </div>
    <div class="row">
        <span class="lbl">Turno</span>
        <span class="val">#${numeroTurno || '—'}</span>
    </div>
    <div class="row">
        <span class="lbl">Fecha</span>
        <span class="val">${fechaTurno || '—'}</span>
    </div>
    <div class="row">
        <span class="lbl">Despachador</span>
        <span class="val">${escHtml(remesa.despachador_descripcion || '—')}</span>
    </div>
    <div class="row">
        <span class="lbl">Tipo Operación</span>
        <span class="val">${({
            venta_combustible: 'Venta Combustible',
            recuperacion_credito: 'Recuperación Crédito',
            pago_anticipado: 'Pago Anticipado'
        }[remesa.tipo_operacion] || remesa.tipo_operacion)}</span>
    </div>
    <hr class="divider">
    <div style="text-align:center;">
        <div class="label">Monto</div>
        <div class="value monto">$${parseFloat(remesa.monto || 0).toFixed(2)}</div>
    </div>
    ${cuentaBancaria ? `
    <hr class="divider">
    <div style="text-align:center;">
        <div class="label">Cuenta Bancaria</div>
        <div style="font-size:11px;font-weight:600;color:#1e293b;">${escHtml(cuentaBancaria)}</div>
    </div>` : ''}
    <script>
        try {
            JsBarcode("#barcode", ${JSON.stringify(barcodeValue)}, {
                width: 1, height: 30, displayValue: true, fontSize: 9, margin: 2
            });
        } catch(e) { console.error(e); }
        setTimeout(() => { window.print(); }, 300);
    </script>
</body></html>`;

        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
    };

    const handleOpenCupones = () => {
        setShowCuponesModal(true);
    };

    const handleAddCuponRow = () => {
        const defaultDesp = getDefaultDespachador();
        setCupones(prev => [...prev, {
            id: Date.now(),
            cupon: '',
            distribuidora_id: '',
            distribuidora_nombre: '',
            producto_codigo: '',
            producto_descripcion: '',
            monto: 0,
            despachador_id: defaultDesp
        }]);
    };

    const handleCuponChange = (id, field, value) => {
        trackDespachadorChange(field, value);
        setCupones(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handleRemoveCupon = (id) => {
        setCupones(prev => prev.filter(c => c.id !== id));
    };

    const handleOpenDescuentos = () => {
        setShowDescuentosModal(true);
    };

    const handleAddDescuentoRow = () => {
        const defaultDesp = getDefaultDespachador();
        setDescuentos(prev => [...prev, {
            id: Date.now(),
            documento: '',
            cliente_id: '',
            cliente_nombre: '',
            producto_codigo: '',
            producto_descripcion: '',
            cantidad: 0,
            valor: 0,
            total: 0,
            despachador_id: defaultDesp
        }]);
    };

    const handleDescuentoChange = (id, field, value) => {
        trackDespachadorChange(field, value);
        setDescuentos(prev => prev.map(d => {
            if (d.id !== id) return d;
            const updated = { ...d, [field]: value };
            if (field === 'cantidad' || field === 'valor') {
                updated.total = (parseFloat(updated.cantidad) || 0) * (parseFloat(updated.valor) || 0);
            }
            return updated;
        }));
    };

    const handleRemoveDescuento = (id) => {
        setDescuentos(prev => prev.filter(d => d.id !== id));
    };

    const handleOpenAdelantos = () => {
        setShowAdelantosModal(true);
    };

    const handleAddAdelantoRow = () => {
        const defaultDesp = getDefaultDespachador();
        setAdelantos(prev => [...prev, {
            id: Date.now(),
            empleado: '',
            monto: 0,
            despachador_id: defaultDesp
        }]);
    };

    const handleAdelantoChange = (id, field, value) => {
        trackDespachadorChange(field, value);
        setAdelantos(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
    };

    const handleRemoveAdelanto = (id) => {
        setAdelantos(prev => prev.filter(a => a.id !== id));
    };

    const handleOpenTarjetas = () => {
        setShowTarjetasModal(true);
    };

    const handleAddTarjetaRow = () => {
        const defaultDesp = getDefaultDespachador();
        setTarjetas(prev => [...prev, {
            id: Date.now(),
            num_tarjeta: '',
            num_autorizacion: '',
            pos_type_id: '',
            despachador_id: defaultDesp,
            tipo_operacion: 'venta_combustible',
            monto: 0
        }]);
    };

    const handleTarjetaChange = (id, field, value) => {
        trackDespachadorChange(field, value);
        setTarjetas(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    const handleRemoveTarjeta = (id) => {
        setTarjetas(prev => prev.filter(t => t.id !== id));
    };

    const handleOpenCreditos = () => {
        setShowCreditosModal(true);
    };

    const handleAddCreditoRow = () => {
        const defaultDesp = getDefaultDespachador();
        setCreditos(prev => [...prev, {
            id: Date.now(),
            documento: '',
            tipo_documento: 'FAC',
            cliente_id: '',
            cliente_nombre: '',
            producto_codigo: '',
            producto_descripcion: '',
            despachador_id: defaultDesp,
            cantidad: 0,
            precio: 0,
            monto: 0,
            placa: '',
            kilometraje: ''
        }]);
    };

    const handleCreditoChange = (id, field, value) => {
        trackDespachadorChange(field, value);
        setCreditos(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handleRemoveCredito = (id) => {
        setCreditos(prev => prev.filter(c => c.id !== id));
    };

    const handleOpenVales = () => {
        setShowValesModal(true);
    };

    const handleAddValeRow = () => {
        const defaultDesp = getDefaultDespachador();
        setVales(prev => [...prev, {
            id: Date.now(),
            documento: '',
            tipo_documento: 'FAC',
            cliente_id: '',
            cliente_nombre: '',
            producto_codigo: '',
            producto_descripcion: '',
            despachador_id: defaultDesp,
            cantidad: 0,
            precio: 0,
            monto: 0,
            placa: '',
            kilometraje: ''
        }]);
    };

    const handleValeChange = (id, field, value) => {
        trackDespachadorChange(field, value);
        setVales(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
    };

    const handleRemoveVale = (id) => {
        setVales(prev => prev.filter(v => v.id !== id));
    };

    const handleOpenAnticipos = () => {
        setShowAnticiposModal(true);
    };

    const handleOpenTrupput = () => {
        setShowTrupputModal(true);
    };

    const handleOpenDiferencias = () => {
        setShowDiferenciasModal(true);
        setDiferenciasLoading(false);
        setTargetShiftId('');
        setDiferenciasData(null);
        setCloseoutBranchId(editData?.branch_id || user?.branch_id || null);
    };

    const handleAddAnticipoRow = () => {
        const defaultDesp = getDefaultDespachador();
        setAnticiposDesp(prev => [...prev, {
            id: Date.now(),
            cliente_id: '',
            cliente_nombre: '',
            saldo_disponible: null,
            documento: '',
            tipo_documento: 'FAC',
            producto_codigo: '',
            producto_descripcion: '',
            despachador_id: defaultDesp,
            cantidad: 0,
            precio: 0,
            monto: 0,
            placa: '',
            kilometraje: ''
        }]);
    };

    const handleAnticipoChange = (id, field, value) => {
        trackDespachadorChange(field, value);
        setAnticiposDesp(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
    };

    const handleAnticipoClienteChange = async (id, clienteId) => {
        setAnticiposDesp(prev => prev.map(a => a.id === id ? { ...a, cliente_id: clienteId, saldo_disponible: null } : a));
        if (clienteId) {
            try {
                const res = await axios.get(`/api/gas-station/advances/available/${clienteId}`);
                const balance = parseFloat(res.data.total_disponible) || 0;
                setAnticiposDesp(prev => prev.map(a => a.id === id ? { ...a, saldo_disponible: balance } : a));
            } catch (e) {
                console.error('Error fetching available balance:', e);
                setAnticiposDesp(prev => prev.map(a => a.id === id ? { ...a, saldo_disponible: 0 } : a));
            }
        }
    };

    const handleRemoveAnticipo = (id) => {
        setAnticiposDesp(prev => prev.filter(a => a.id !== id));
    };

    const handleAddTrupputRow = () => {
        const defaultDesp = getDefaultDespachador();
        setTrupputDesp(prev => [...prev, {
            id: Date.now(),
            cliente_id: '',
            cliente_nombre: '',
            galones_disponibles: null,
            documento: '',
            producto_codigo: '',
            producto_descripcion: '',
            despachador_id: defaultDesp,
            galones: 0,
            precio: 0,
            monto: 0,
            placa: '',
            kilometraje: ''
        }]);
    };

    const handleTrupputChange = (id, field, value) => {
        trackDespachadorChange(field, value);
        setTrupputDesp(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    const handleTrupputClienteChange = async (id, clienteId) => {
        setTrupputDesp(prev => prev.map(t => t.id === id ? { ...t, cliente_id: clienteId, galones_disponibles: null } : t));
        if (clienteId) {
            try {
                const res = await axios.get(`/api/gas-station/trupput/available/${clienteId}`);
                const balance = parseFloat(res.data.total_galones) || 0;
                setTrupputDesp(prev => prev.map(t => t.id === id ? { ...t, galones_disponibles: balance } : t));
            } catch (e) {
                console.error('Error fetching available trupput galones:', e);
                setTrupputDesp(prev => prev.map(t => t.id === id ? { ...t, galones_disponibles: 0 } : t));
            }
        }
    };

    const handleRemoveTrupput = (id) => {
        setTrupputDesp(prev => prev.filter(t => t.id !== id));
    };

    const { data: distributorsData } = useQuery({
        queryKey: ['gas-distributors-all', user?.branch_id],
        queryFn: async () => unwrapList(await axios.get('/api/gas-station/distributors', { params: { limit: 999 } })),
    });
    const distributors = distributorsData || [];

    const { data: nozzlesRes } = useQuery({
        queryKey: ['gas-nozzles-all', user?.branch_id],
        queryFn: async () => unwrapList(await axios.get('/api/gas-station/nozzles', { params: { limit: 999 } })),
    });
    const nozzlesData = Array.isArray(nozzlesRes) ? nozzlesRes : (nozzlesRes?.data || []);

    const fuelProducts = useMemo(() => {
        const map = {};
        nozzlesData.forEach(n => {
            const key = n.product_codigo;
            if (!map[key]) {
                map[key] = { codigo: n.product_codigo, descripcion: n.product_nombre };
            }
        });
        return Object.values(map);
    }, [nozzlesData]);

    const fuelPriceByCode = useMemo(() => {
        const map = {};
        readings.forEach(r => {
            if (r.codigo_producto && parseFloat(r.precio) > 0) {
                map[r.codigo_producto] = parseFloat(r.precio);
            }
        });
        return map;
    }, [readings]);

    const fuelTypeNames = { 3: 'DIESEL', 1: 'REGULAR', 2: 'SUPER', 4: 'ION DIESEL' };
    const fuelTypeOrder = ['DIESEL', 'REGULAR', 'SUPER', 'ION DIESEL'];

    const summaryByProduct = useMemo(() => {
        const map = {};
        readings.forEach(r => {
            const key = r.codigo_producto;
            if (!map[key]) {
                map[key] = {
                    codigo_producto: r.codigo_producto,
                    descripcion_producto: r.descripcion_producto,
                    precio: r.precio,
                    total_lectura: 0,
                    total_monto: 0
                };
            }
            const diferencia = r.lectura_actual - r.lectura_anterior - r.calibracion;
            const monto = diferencia * r.precio;
            map[key].total_lectura += diferencia;
            map[key].total_monto += monto;
        });
        return Object.values(map);
    }, [readings]);

    const totals = useMemo(() => ({
        totalLectura: readings.reduce((s, r) => s + (r.lectura_actual - r.lectura_anterior - r.calibracion), 0),
        totalMonto: readings.reduce((s, r) => s + ((r.lectura_actual - r.lectura_anterior - r.calibracion) * r.precio), 0)
    }), [readings]);

    const lectVsTanqComparison = useMemo(() => {
        const lectByType = {};
        const tanqByType = {};

        readings.forEach(r => {
            const t = r.tipo_combustible === 5 ? 3 : r.tipo_combustible;
            if (!t || t === 0) return;
            if (!lectByType[t]) lectByType[t] = 0;
            lectByType[t] += r.lectura_actual - r.lectura_anterior - (r.calibracion || 0);
        });

        tankReadings.forEach(r => {
            const t = r.tipo_combustible === 5 ? 3 : r.tipo_combustible;
            if (!t || t === 0) return;
            if (!tanqByType[t]) tanqByType[t] = 0;
            tanqByType[t] += (r.lectura_anterior || 0) + (r.recarga || 0) - (r.lectura_actual || 0);
        });

        return fuelTypeOrder.map(name => {
            const t = Object.keys(fuelTypeNames).find(k => fuelTypeNames[k] === name);
            if (!t) return null;
            const lect = lectByType[t] || 0;
            const tanq = tanqByType[t] || 0;
            const diff = lect - tanq;
            const pct = lect > 0 ? (Math.abs(diff) / lect) * 100 : 0;
            return {
                tipo: name,
                vendidoLect: lect,
                vendidoTanq: tanq,
                diferencia: diff,
                pctDiferencia: pct,
                alertLevel: diff === 0 ? 'none' : pct <= 3 ? 'warning' : 'danger'
            };
        }).filter(Boolean);
    }, [readings, tankReadings]);

    const handleInit = async (e) => {
        e.preventDefault();
        if (!sellerId || !fechaTurno || !numeroTurno) {
            toast.error('Todos los campos son requeridos');
            return;
        }
        const name = sellers.find(s => s.id === parseInt(sellerId))?.nombre || '';
        setSellerName(name);
        const sourceAssignments = despachadorNozzleAssignments.length > 0
            ? despachadorNozzleAssignments
            : liveNozzleAssignments;

        let targetDespachadores = closeoutDespachadores;

        const assignedDespIds = [...new Set(sourceAssignments.map(a => a.despachador_id))];
        const selectedIds = targetDespachadores.map(d => d.despachador_id);
        const missingIds = assignedDespIds.filter(id => !selectedIds.includes(id));

        if (missingIds.length > 0) {
            const missingDesps = allDespachadores.filter(d => missingIds.includes(d.id));
            const missingNames = missingDesps.map(d => `${d.codigo} — ${d.descripcion}`).join('\n');
            const ok = await confirm({
                title: 'Despachadores faltantes',
                message: `Los siguientes despachadores tienen mangueras asignadas pero no están en el turno:\n\n${missingNames}\n\n¿Desea incluirlos automáticamente?`,
                confirmLabel: 'Sí, incluirlos',
                cancelLabel: 'No, cancelar',
                variant: 'warning',
            });
            if (!ok) return;
            targetDespachadores = [
                ...closeoutDespachadores,
                ...missingDesps.map(d => ({
                    despachador_id: d.id,
                    nombre: d.descripcion || d.codigo || ''
                }))
            ];
            setCloseoutDespachadores(targetDespachadores);
        }

        initMutation.mutate({
            seller_id: parseInt(sellerId, 10),
            seller_name: name,
            fecha_turno: fechaTurno,
            numero_turno: parseInt(numeroTurno, 10),
            branch_id: user?.branch_id,
            despachadores: targetDespachadores,
            nozzle_assignments: targetDespachadores.map(d => ({
                despachador_id: d.despachador_id,
                nozzle_ids: sourceAssignments
                    .filter(a => a.despachador_id === d.despachador_id)
                    .map(a => a.nozzle_id)
            }))
        });
    };

    const handleReadingChange = (nozzleId, field, value) => {
        if (estado === 'cerrado' || estado === 'reabierto') return;
        if (field === 'lectura_anterior' && !isSuperAdmin) return;
        setReadings(prev => prev.map(r =>
            r.nozzle_id === nozzleId ? { ...r, [field]: parseFloat(value) || 0 } : r
        ));
    };

    const handleReadingBlur = (readingId, nozzleId) => {
        const r = readings.find(x => x.nozzle_id === nozzleId);
        if (!r) return;
        const payload = {
            lectura_actual: r.lectura_actual,
            calibracion: r.calibracion
        };
        if (isSuperAdmin && editAnterior) {
            payload.lectura_anterior = r.lectura_anterior;
        }
        updateMutation.mutate({
            readingId,
            data: payload
        });
    };

    const handleKeyDown = (e, index, field) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const currentReading = readings[index];
            if (!currentReading) return;

            if (field === 'lectura_anterior') {
                const actualKey = `lectura_actual-${currentReading.nozzle_id}`;
                const actualEl = inputRefs.current[actualKey];
                if (actualEl) { actualEl.focus(); return; }
            }

            if (field === 'lectura_actual') {
                const nextReading = readings[index + 1];
                if (nextReading) {
                    const nextKey = editAnterior && isSuperAdmin ? `anterior-${nextReading.nozzle_id}` : `lectura_actual-${nextReading.nozzle_id}`;
                    const nextEl = inputRefs.current[nextKey];
                    if (nextEl) nextEl.focus();
                }
                return;
            }

            if (field === 'calibracion') {
                const nextReading = readings[index + 1];
                if (nextReading) {
                    const nextKey = editAnterior && isSuperAdmin ? `anterior-${nextReading.nozzle_id}` : `lectura_actual-${nextReading.nozzle_id}`;
                    const nextEl = inputRefs.current[nextKey];
                    if (nextEl) nextEl.focus();
                }
            }
        }
    };

    const handleTankReadingChange = (tankId, field, value) => {
        if (estado === 'cerrado' || (estado === 'reabierto' && !superAdminTankEdit)) return;
        setTankReadings(prev => prev.map(r =>
            r.tank_id === tankId ? { ...r, [field]: parseFloat(value) || 0 } : r
        ));
    };

    const handleTankReadingBlur = (readingId, tankId) => {
        const r = tankReadings.find(x => x.tank_id === tankId);
        if (!r) return;
        updateTankMutation.mutate({
            readingId,
            data: { lectura_actual: r.lectura_actual, recarga: r.recarga, lectura_anterior: r.lectura_anterior }
        });
    };

    const handleTankKeyDown = (e, index, field) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const currentReading = tankReadings[index];
            if (!currentReading) return;

            if (field === 'lectura_anterior') {
                const recargaKey = `recarga-${currentReading.tank_id}`;
                const recargaEl = tankInputRefs.current[recargaKey];
                if (recargaEl) { recargaEl.focus(); return; }
            }

            if (field === 'recarga') {
                const actualKey = `lectura_actual-${currentReading.tank_id}`;
                const actualEl = tankInputRefs.current[actualKey];
                if (actualEl) { actualEl.focus(); return; }
            }

            if (field === 'lectura_actual') {
                const nextReading = tankReadings[index + 1];
                if (nextReading) {
                    const nextKey = editAnterior ? `anterior-${nextReading.tank_id}` : `recarga-${nextReading.tank_id}`;
                    const nextEl = tankInputRefs.current[nextKey];
                    if (nextEl) nextEl.focus();
                }
            }
        }
    };

    const handleLubricantKeyDown = (e, index, field) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const currentReading = lubricantReadings[index];
            if (!currentReading) return;

            if (field === 'lectura_inicial') {
                const recargaKey = `lub-recarga-${currentReading.producto_id}`;
                const recargaEl = lubricantInputRefs.current[recargaKey];
                if (recargaEl) { recargaEl.focus(); return; }
            }

            if (field === 'recarga') {
                const finalKey = `lub-final-${currentReading.producto_id}`;
                const finalEl = lubricantInputRefs.current[finalKey];
                if (finalEl) { finalEl.focus(); return; }
            }

            if (field === 'lectura_final') {
                const nextReading = lubricantReadings[index + 1];
                if (nextReading) {
                    const nextKey = `lub-recarga-${nextReading.producto_id}`;
                    const nextEl = lubricantInputRefs.current[nextKey];
                    if (nextEl) nextEl.focus();
                }
            }
        }
    };

    const handleLubricantBlur = () => {
        const updated = lubricantReadings.map(r => {
            const ventas = parseFloat(r.lectura_inicial || 0) + parseFloat(r.recarga || 0) - parseFloat(r.lectura_final || 0);
            const total = ventas * parseFloat(r.precio || 0);
            return {
                ...r,
                recarga: parseFloat(r.recarga) || 0,
                lectura_final: parseFloat(r.lectura_final) || 0,
                ventas: parseFloat(ventas.toFixed(5)),
                total: parseFloat(total.toFixed(2)),
            };
        });
        saveLubricantesMutation.mutate(updated);
    };

    const handleOpenTanques = async () => {
        if (tankReadings.length === 0 && closeoutId) {
            try {
                const res = await axios.post(`/api/gas-station/closeouts/${closeoutId}/tank-readings/init`);
                setTankReadings(res.data.map(r => ({ ...r, lectura_actual: r.lectura_anterior })));
            } catch { }
        }
        setShowTankReadingsModal(true);
        setEditAnterior(false);
    };

    const fetchLubricantInitials = async () => {
        if (!closeoutId) return [];
        setLubricantLoading(true);
        try {
            const branch = closeoutBranchId || user?.branch_id || '';
            const res = await axios.get(`/api/products/lubricants?branch_id=${branch}&closeout_id=${closeoutId || ''}`);
            const products = res.data;
            if (products.length > 0) {
                const mapped = products.map(p => {
                    const inicial = parseFloat(p.lectura_inicial) || 0;
                    return {
                        producto_id: p.id,
                        producto_codigo: p.codigo,
                        producto_descripcion: p.descripcion,
                        lectura_inicial: inicial,
                        recarga: 0,
                        lectura_final: inicial,
                        ventas: 0,
                        precio: parseFloat(p.precio_unitario) || 0,
                        total: 0,
                    };
                });
                setLubricantReadings(mapped);
                return mapped;
            }
            return [];
        } catch (error) {
            console.error('Error cargando lubricantes:', error);
            toast.error('Error al cargar lubricantes');
            return [];
        } finally {
            setLubricantLoading(false);
        }
    };

    const handleOpenLubricantes = async () => {
        if (lubricantReadings.length === 0 && closeoutId) {
            await fetchLubricantInitials();
        }
        setShowLubricantesModal(true);
        setEditAnterior(false);
    };

    const handleRecargarLubricantes = async () => {
        const ok = await confirm({
            title: 'Reinicializar Lubricantes',
            message: '¿Reinicializar los lubricantes leyendo las lecturas iniciales del último turno? Los valores actuales se sobrescribirán.',
            confirmLabel: 'Sí, reinicializar',
            cancelLabel: 'Cancelar',
            variant: 'warning',
        });
        if (!ok) return;
        const mapped = await fetchLubricantInitials();
        if (mapped.length === 0) {
            toast.info('No hay productos de lubricantes configurados');
            return;
        }
        if (estado !== 'cerrado') {
            const updated = mapped.map(r => {
                const ventas = parseFloat(r.lectura_inicial || 0) + parseFloat(r.recarga || 0) - parseFloat(r.lectura_final || 0);
                const total = ventas * parseFloat(r.precio || 0);
                return {
                    ...r,
                    ventas: parseFloat(ventas.toFixed(5)),
                    total: parseFloat(total.toFixed(2)),
                };
            });
            console.log(`[Recargar Lubricantes] Guardando ${updated.length} lecturas para closeout ${closeoutId}`);
            try {
                await saveLubricantesMutation.mutateAsync(updated);
                toast.success(`${updated.length} lubricantes reinicializados desde el último turno`);
            } catch (err) {
                console.error('[Recargar Lubricantes] Error al guardar:', err);
                toast.error('Error al guardar lubricantes: ' + (err?.response?.data?.error || err.message || 'Error desconocido'));
            }
        } else {
            toast.success('Valores cargados desde el último turno (turno cerrado, solo lectura)');
        }
    };

    const actionButtons = [
        { label: 'Lecturas', icon: Fuel, key: 'lecturas', enabled: true },
        { label: 'Gastos', icon: Receipt, key: 'gastos', enabled: true },
        { label: 'Cupones', icon: CreditCard, key: 'cupones', enabled: true },
        { label: 'Créditos', icon: CreditCard, key: 'creditos', enabled: true },
        { label: 'Vales', icon: Gift, key: 'vales', enabled: true },
        { label: 'Descuentos', icon: Percent, key: 'descuentos', enabled: true },
        { label: 'Anticipos Desp.', icon: Truck, key: 'anticipos', enabled: true },
        { label: 'Trupput', icon: Fuel, key: 'trupput', enabled: true },
        { label: 'Remesas', icon: Banknote, key: 'remesas', enabled: true },
        { label: 'Lubricantes', icon: Droplets, key: 'lubricantes', enabled: true },
        { label: 'Tanques', icon: FlaskConical, key: 'tanques', enabled: true },
        { label: 'Tarjetas', icon: CreditCard, key: 'tarjetas', enabled: true },
        { label: 'Adelantos', icon: Banknote, key: 'adelantos', enabled: true },
        { label: 'Lecturas/Vtas', icon: BarChart3, key: 'diferencias', enabled: true },
    ];

    const inputCls = "w-28 px-1.5 py-0.5 bg-white border border-slate-200 rounded outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[11px] text-right font-mono";
    const inputDisabledCls = "w-28 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-right font-mono text-slate-500";
    const inputCalibCls = "w-20 px-1.5 py-0.5 bg-white border border-slate-200 rounded outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[11px] text-right font-mono";
    const inputCalibDisabledCls = "w-20 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-right font-mono text-slate-500";

    const openNozzleModal = () => {
        const source = despachadorNozzleAssignments.length > 0 ? despachadorNozzleAssignments : liveNozzleAssignments;
        setModalAssignments(source.map(a => ({ despachador_id: a.despachador_id, nozzle_id: a.nozzle_id })));
        setModalSelectedDespachadorId('');
        setShowNozzleAssignModal(true);
    };

    const handleModalSave = () => {
        if (closeoutId) {
            const assignments = closeoutDespachadores.map(d => ({
                despachador_id: d.despachador_id,
                nozzle_ids: modalAssignments.filter(a => a.despachador_id === d.despachador_id).map(a => a.nozzle_id)
            }));
            updateNozzleAssignmentsMutation.mutate(assignments);
        } else {
            setDespachadorNozzleAssignments(modalAssignments);
        }
        setShowNozzleAssignModal(false);
    };

    if (editLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-indigo-600" />
                <span className="ml-3 text-sm font-medium text-slate-500">Cargando cierre...</span>
            </div>
        );
    }

    if (closeoutId && readings.length > 0) {
        const diferenciaTotal = gastosTotal + remesasTotal + cuponesTotal + descuentosTotal + adelantosTotal + tarjetasTotal + creditosTotal + valesTotal + anticiposDespTotal + trupputDespTotal - totals.totalMonto - lubricantTotal;
        return (
            <>
                <div className="space-y-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                            {editId && (
                                <button
                                    onClick={() => navigate('/gas-station/historial-lecturas')}
                                    className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Volver al historial"
                                >
                                    <ArrowLeft size={18} />
                                </button>
                            )}
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <Calculator size={20} className="text-indigo-600" />
                                    Cierre de Lecturas
                                    {editId && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Editando</span>}
                                </h2>
                                <p className="text-slate-500 text-[11px] font-medium">
                                    Turno #{numeroTurno} — {fechaTurno} — {sellerName}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <span onClick={handleEstadoBadgeClick} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                                estado === 'cerrado'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : estado === 'reabierto'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                                {estado === 'cerrado' ? <Lock size={12} /> : estado === 'reabierto' ? <LockOpen size={12} /> : <Unlock size={12} />}
                                {estado === 'cerrado' ? 'Cerrado' : estado === 'reabierto' ? 'Reabierto' : 'Abierto'}
                            </span>
                            <button
                                onClick={handlePdf}
                                className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                title="Descargar PDF"
                            >
                                <Printer size={16} />
                            </button>
                            {(estado === 'abierto' || estado === 'reabierto') && (
                                <button
                                    onClick={async () => {
                                        if (tankReadings.length > 0) {
                                            const todasSinDiferencia = tankReadings.every(r =>
                                                Math.abs((parseFloat(r.lectura_anterior) || 0) + (parseFloat(r.recarga) || 0) - (parseFloat(r.lectura_actual) || 0)) < 0.00001
                                            );
                                            if (todasSinDiferencia) {
                                                toast.error('Las lecturas de tanque no han sido ingresadas (todas con diferencia cero). Ingrese las lecturas reales antes de cerrar el turno.');
                                                return;
                                            }
                                        }
                                        const dirtySections = Object.keys(sectionConfig).filter(k => isSectionDirty(k));
                                        if (dirtySections.length > 0) {
                                            const dirtyNames = dirtySections.map(k => sectionConfig[k].name).join(', ');
                                            const proceed = await confirm({
                                                title: 'Hay cambios pendientes sin guardar',
                                                message: `Las siguientes secciones tienen modificaciones que no han sido guardadas en el servidor: ${dirtyNames}. Si continúa, estos cambios se descartarán. ¿Desea cerrar el turno de todos modos?`,
                                                confirmLabel: 'Ignorar y cerrar turno',
                                                cancelLabel: 'Revisar y guardar',
                                                variant: 'danger',
                                            });
                                            if (!proceed) return;
                                        }

                                        const ok = await confirm({
                                            title: estado === 'reabierto' ? '¿Recerrar Turno?' : '¿Cerrar Turno?',
                                            message: estado === 'reabierto'
                                                ? 'El turno volverá a estado cerrado. Las lecturas y tanques permanecerán sin cambios.'
                                                : 'Una vez cerrado no podrá modificar las lecturas ni los egresos del turno.',
                                            confirmLabel: estado === 'reabierto' ? 'Sí, recerrar' : 'Sí, cerrar turno',
                                            cancelLabel: 'Cancelar',
                                            variant: 'warning',
                                        });
                                        if (ok) closeMutation.mutate();
                                    }}
                                    disabled={closeMutation.isPending}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg disabled:opacity-50"
                                >
                                    {closeMutation.isPending ? 'Cerrando...' : estado === 'reabierto' ? 'Recerrar Turno' : 'Cerrar Turno'}
                                </button>
                            )}
                        </div>
                    </div>

                    {superAdminTankEdit && estado === 'reabierto' && (
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                            <span className="flex items-center gap-2 text-[11px] font-bold text-amber-700 min-w-0">
                                <ShieldCheck size={14} className="shrink-0" />
                                Edición de tanques habilitada (SuperAdmin). Los turnos posteriores se recalcularán al guardar.
                            </span>
                            <button
                                type="button"
                                onClick={() => { setSuperAdminTankEdit(false); setEditAnterior(false); }}
                                className="text-[10px] font-bold uppercase text-amber-700 hover:bg-amber-100 px-2 py-1 rounded-lg border border-amber-300 shrink-0 transition-colors"
                            >
                                Desactivar
                            </button>
                        </div>
                    )}

                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className="flex-1 flex flex-col gap-4 min-w-0">
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                                <div className="px-4 py-2 border-b border-slate-100">
                                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Resumen de Lecturas</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                                                <th className="px-3 py-1.5">Código</th>
                                                <th className="px-3 py-1.5">Descripción</th>
                                                <th className="px-3 py-1.5 text-right">Precio</th>
                                                <th className="px-3 py-1.5 text-right">Total Lectura</th>
                                                <th className="px-3 py-1.5 text-right">Total Monto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 text-xs">
                                            {summaryByProduct.map(p => (
                                                <tr key={p.codigo_producto} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-3 py-1.5 font-mono font-bold text-slate-800">{p.codigo_producto}</td>
                                                    <td className="px-3 py-1.5 text-slate-600">{p.descripcion_producto}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-slate-700"><Money value={p.precio} /></td>
                                                    <td className="px-3 py-1.5 text-right font-mono font-bold text-indigo-600">{p.total_lectura.toFixed(5)}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-900"><Money value={p.total_monto} /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-50 border-t border-slate-100 text-xs font-bold">
                                            <tr>
                                                <td colSpan={3} className="px-3 py-1.5 text-right text-slate-600 uppercase tracking-wider">Totales</td>
                                                <td className="px-3 py-1.5 text-right font-mono text-indigo-600">{totals.totalLectura.toFixed(5)}</td>
                                                <td className="px-3 py-1.5 text-right font-mono text-slate-900"><Money value={totals.totalMonto} /></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1">
                                    <div className="px-4 py-2 border-b border-slate-100">
                                        <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Ingresos</h3>
                                    </div>
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                                                <th className="px-3 py-1.5">Descripción</th>
                                                <th className="px-3 py-1.5 text-right w-28">Monto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 text-xs">
                                            <tr className="hover:bg-slate-50 transition-colors">
                                                <td className="px-3 py-1.5 text-slate-600">Combustible (Ventas)</td>
                                                <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-600"><Money value={totals.totalMonto} /></td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors">
                                                <td className="px-3 py-1.5 text-slate-600">Lubricantes</td>
                                                <td className={`px-3 py-1.5 text-right font-mono ${lubricantTotal > 0 ? 'font-bold text-emerald-600' : 'text-slate-400'}`}>
                                                    <Money value={lubricantTotal} />
                                                </td>
                                            </tr>
                                        </tbody>
                                        <tfoot className="bg-slate-50 border-t border-slate-100 text-xs font-bold">
                                            <tr>
                                                <td className="px-3 py-1.5 text-right text-slate-600 uppercase tracking-wider">Total Ingresos</td>
                                                <td className="px-3 py-1.5 text-right font-mono text-emerald-600"><Money value={totals.totalMonto + lubricantTotal} /></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1">
                                    <div className="px-4 py-2 border-b border-slate-100">
                                        <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider">Egresos</h3>
                                    </div>
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                                                <th className="px-3 py-1.5">Descripción</th>
                                                <th className="px-3 py-1.5 text-right w-28">Monto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 text-xs">
                                            <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50">
                                                <td className="px-3 py-1.5 text-slate-700 font-semibold">Créditos</td>
                                                <td className="px-3 py-1.5 text-right font-mono font-semibold text-red-600"><Money value={creditosTotal} /></td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50">
                                                <td className="px-3 py-1.5 text-slate-700 font-semibold">Vales</td>
                                                <td className="px-3 py-1.5 text-right font-mono font-semibold text-red-600"><Money value={valesTotal} /></td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50">
                                                <td className="px-3 py-1.5 text-slate-700 font-semibold">Anticipos Desp.</td>
                                                <td className="px-3 py-1.5 text-right font-mono font-semibold" style={{ color: anticiposDespTotal > 0 ? '#dc2626' : '#94a3b8' }}><Money value={anticiposDespTotal} /></td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50">
                                                <td className="px-3 py-1.5 text-slate-700 font-semibold">Trupput Desp.</td>
                                                <td className="px-3 py-1.5 text-right font-mono font-semibold" style={{ color: trupputDespTotal > 0 ? '#dc2626' : '#94a3b8' }}><Money value={trupputDespTotal} /></td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50">
                                                <td className="px-3 py-1.5 text-slate-700 font-semibold">Gastos</td>
                                                <td className="px-3 py-1.5 text-right font-mono font-semibold text-red-600"><Money value={gastosTotal} /></td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50">
                                                <td className="px-3 py-1.5 text-slate-700 font-semibold">Remesas</td>
                                                <td className="px-3 py-1.5 text-right font-mono font-semibold text-red-600"><Money value={remesasTotal} /></td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50">
                                                <td className="px-3 py-1.5 text-slate-700 font-semibold">Cupones</td>
                                                <td className="px-3 py-1.5 text-right font-mono font-semibold text-red-600"><Money value={cuponesTotal} /></td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50">
                                                <td className="px-3 py-1.5 text-slate-700 font-semibold">Descuentos</td>
                                                <td className="px-3 py-1.5 text-right font-mono font-semibold text-red-600"><Money value={descuentosTotal} /></td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50">
                                                <td className="px-3 py-1.5 text-slate-700 font-semibold">Adelantos</td>
                                                <td className="px-3 py-1.5 text-right font-mono font-semibold text-red-600"><Money value={adelantosTotal} /></td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50">
                                                <td className="px-3 py-1.5 text-slate-700 font-semibold">Tarjetas</td>
                                                <td className="px-3 py-1.5 text-right font-mono font-semibold text-red-600"><Money value={tarjetasTotal} /></td>
                                            </tr>
                                        </tbody>
                                        <tfoot className="bg-slate-50 border-t border-slate-100 text-xs font-bold">
                                            <tr>
                                                <td className="px-3 py-1.5 text-right text-slate-600 uppercase tracking-wider">Total Egresos</td>
                                                <td className="px-3 py-1.5 text-right font-mono text-red-600"><Money value={gastosTotal + remesasTotal + cuponesTotal + descuentosTotal + adelantosTotal + tarjetasTotal + creditosTotal + valesTotal + anticiposDespTotal + trupputDespTotal} /></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                            <div className="flex flex-col lg:flex-row gap-4">
                                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="px-4 py-2 border-b border-slate-100">
                                        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Lecturas de Tanques</h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                                                    <th className="px-3 py-1.5">Tanque</th>
                                                    <th className="px-3 py-1.5 text-right w-28">Lect. Ant.</th>
                                                    <th className="px-3 py-1.5 text-right w-24">Recarga</th>
                                                    <th className="px-3 py-1.5 text-right w-28">Lect. Actual</th>
                                                    <th className="px-3 py-1.5 text-right w-28">Venta (Difer.)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 text-xs">
                                                {tankReadings.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="px-3 py-8 text-center text-xs text-slate-400">
                                                            No hay lecturas de tanques registradas.
                                                        </td>
                                                    </tr>
                                                )}
                                                {tankReadings.map(r => {
                                                    const diferencia = (r.lectura_anterior || 0) + (r.recarga || 0) - (r.lectura_actual || 0);
                                                    return (
                                                        <tr key={r.tank_id || r.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-3 py-1.5 whitespace-nowrap">
                                                                <span className="font-medium text-slate-800">{r.codigo_tanque}</span>
                                                                <span className="text-[10px] text-slate-400 ml-1">— {r.descripcion_tanque}</span>
                                                            </td>
                                                            <td className="px-3 py-1.5 text-right font-mono text-slate-600">{(r.lectura_anterior || 0).toFixed(5)}</td>
                                                            <td className="px-3 py-1.5 text-right font-mono text-slate-600">{(r.recarga || 0).toFixed(5)}</td>
                                                            <td className="px-3 py-1.5 text-right font-mono text-slate-600">{(r.lectura_actual || 0).toFixed(5)}</td>
                                                            <td className="px-3 py-1.5 text-right font-mono font-bold text-indigo-600">{diferencia.toFixed(5)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot className="bg-slate-50 border-t border-slate-100 text-xs font-bold">
                                                <tr>
                                                    <td colSpan={2} className="px-3 py-1.5 text-right text-slate-600 uppercase tracking-wider">Totales</td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">{tankReadings.reduce((s, r) => s + (r.recarga || 0), 0).toFixed(5)}</td>
                                                    <td className="px-3 py-1.5"></td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-indigo-600">{tankReadings.reduce((s, r) => s + ((r.lectura_anterior || 0) + (r.recarga || 0) - (r.lectura_actual || 0)), 0).toFixed(5)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                                <div className="lg:flex-none bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="px-4 py-2 border-b border-slate-100">
                                        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Comparación Lectura vs Tanque</h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                                                    <th className="px-3 py-1.5">Tipo</th>
                                                    <th className="px-3 py-1.5 text-right">Vendido Lect.</th>
                                                    <th className="px-3 py-1.5 text-right">Vendido Tanq.</th>
                                                    <th className="px-3 py-1.5 text-right">Diferencia</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 text-xs">
                                                {lectVsTanqComparison.map(row => (
                                                    <tr key={row.tipo} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-3 py-1.5 font-bold text-slate-800">{row.tipo}</td>
                                                        <td className="px-3 py-1.5 text-right font-mono text-indigo-600">{row.vendidoLect.toFixed(2)}</td>
                                                        <td className="px-3 py-1.5 text-right font-mono text-indigo-600">{row.vendidoTanq.toFixed(2)}</td>
                                                        <td className={`px-3 py-1.5 text-right font-mono font-bold rounded-xl ${
                                                            row.alertLevel === 'none'
                                                                ? 'text-slate-400'
                                                                : row.alertLevel === 'warning'
                                                                    ? 'text-amber-600 bg-amber-50/50'
                                                                    : 'text-red-600 bg-red-50 ring-1 ring-red-300 animate-pulse shadow-sm'
                                                        }`}>
                                                            {row.diferencia.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-slate-50 border-t border-slate-100 text-xs font-bold">
                                                <tr>
                                                    <td className="px-3 py-1.5 text-right text-slate-600 uppercase tracking-wider">Totales</td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-indigo-600">
                                                        {lectVsTanqComparison.reduce((s, r) => s + r.vendidoLect, 0).toFixed(2)}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-indigo-600">
                                                        {lectVsTanqComparison.reduce((s, r) => s + r.vendidoTanq, 0).toFixed(2)}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-900">
                                                        {lectVsTanqComparison.reduce((s, r) => s + r.diferencia, 0).toFixed(2)}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-4 py-2 border-b border-slate-100">
                                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Diferencia</h3>
                                </div>
                                <div className="px-4 py-3 flex items-center justify-between">
                                    <span className="text-xs font-medium text-slate-500">Faltante / Sobrante del turno</span>
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-black font-mono shadow-sm ${diferenciaTotal >= 0 ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-red-50 text-red-700 ring-1 ring-red-200'}`}>
                                        <Money value={diferenciaTotal} />
                                    </span>
                                </div>
                            </div>
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                        <UserCheck size={12} className="text-indigo-500" />
                                        Despachadores del Turno
                                    </h4>
                                    {estado !== 'cerrado' && (
                                        <button
                                            type="button"
                                            onClick={openNozzleModal}
                                            className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                                        >
                                            <Fuel size={12} />
                                            Editar Mangueras
                                        </button>
                                    )}
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                                                <th className="px-2 py-1 w-14">Código</th>
                                                <th className="px-2 py-1">Nombre</th>
                                                <th className="px-2 py-1 text-right w-28">Venta</th>
                                                <th className="px-2 py-1 text-right w-28 text-red-600">No Percibido</th>
                                                <th className="px-2 py-1 text-right w-28 text-amber-600">Entregado</th>
                                                <th className="px-2 py-1 text-right w-28">Diferencia</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 text-[11px]">
                                            {closeoutDespachadores.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="px-2 py-3 text-center text-[10px] text-slate-400">
                                                        Sin despachadores asignados
                                                    </td>
                                                </tr>
                                            )}
                                            {closeoutDespachadores.map((d, i) => {
                                                const desp = allDespachadores.find(a => a.id === d.despachador_id);
                                                const venta = despachadorVentas[d.despachador_id] || 0;
                                                const noPercibido = despachadorNoPercibido[d.despachador_id] || 0;
                                                const entregado = despachadorEntregado[d.despachador_id] || 0;
                                                const diferencia = (noPercibido + entregado) - venta;
                                                return (
                                                    <tr key={d.despachador_id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-1.5 py-1 font-bold text-slate-700">{desp?.codigo || ''}</td>
                                                        <td className="px-1.5 py-1">
                                                            {estado !== 'cerrado' ? (
                                                                <input
                                                                    type="text"
                                                                    value={d.nombre || ''}
                                                                    onChange={(e) => {
                                                                        const updated = [...closeoutDespachadores];
                                                                        updated[i] = { ...updated[i], nombre: e.target.value };
                                                                        setCloseoutDespachadores(updated);
                                                                    }}
                                                                    onBlur={(e) => {
                                                                        const updated = [...closeoutDespachadores];
                                                                        updated[i] = { ...updated[i], nombre: e.target.value };
                                                                        updateDespachadoresMutation.mutate(updated);
                                                                    }}
                                                                    placeholder="Nombre"
                                                                    className="w-full px-1 py-0.5 bg-white border border-slate-200 rounded outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[11px] font-medium"
                                                                />
                                                            ) : (
                                                                <span className="text-slate-600">{d.nombre || ''}</span>
                                                            )}
                                                        </td>
                                                        <td className="px-1.5 py-1 text-right font-mono font-bold text-emerald-600"><Money value={venta} /></td>
                                                        <td className="px-1.5 py-1 text-right font-mono font-bold text-red-600"><Money value={noPercibido} /></td>
                                                        <td className="px-1.5 py-1 text-right font-mono font-bold text-amber-600"><Money value={entregado} /></td>
                                                        <td className="px-1.5 py-1 text-right">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black font-mono shadow-sm ${diferencia >= 0 ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-red-50 text-red-700 ring-1 ring-red-200'}`}>
                                                                <Money value={diferencia} />
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <div className="w-full lg:w-72 lg:shrink-0">
                            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Opciones del Turno</h3>
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
                                <div className="grid grid-cols-2 gap-1.5">
                                    {actionButtons.map(btn => {
                                        const Icon = btn.icon;
                                        const isLectura = btn.key === 'lecturas';
                                        const isGastos = btn.key === 'gastos';
                                        const isRemesas = btn.key === 'remesas';
                                        const isCupones = btn.key === 'cupones';
                                        const isDescuentos = btn.key === 'descuentos';
                                        const isAdelantos = btn.key === 'adelantos';
                                        const isLubricantes = btn.key === 'lubricantes';
                                        const isTarjetas = btn.key === 'tarjetas';
                                        const isCreditos = btn.key === 'creditos';
                                        const isVales = btn.key === 'vales';
                                        const isAnticipos = btn.key === 'anticipos';
                                        const isTrupput = btn.key === 'trupput';
                                        const isTanques = btn.key === 'tanques';
                                        const isDiferencias = btn.key === 'diferencias';
                                        const isBlockedReabierto = estado === 'reabierto' && (isLectura || (isTanques && !superAdminTankEdit));
                                        const canClick = !isBlockedReabierto && (isLectura || isGastos || isRemesas || isCupones || isDescuentos || isAdelantos || isLubricantes || isTarjetas || isCreditos || isVales || isAnticipos || isTrupput || isTanques || isDiferencias || (btn.enabled && estado === 'abierto'));
                                        const isBtnDirty = isSectionDirty(btn.key) && estado !== 'cerrado';
                                        return (
                                            <button
                                                key={btn.key}
                                                onClick={() => {
                                                    if (isLectura) { setShowReadingsModal(true); setEditAnterior(false); }
                                                    if (isGastos) handleOpenGastos();
                                                    if (btn.key === 'tanques') handleOpenTanques();
                                                    if (isRemesas) handleOpenRemesas();
                                                    if (isCupones) handleOpenCupones();
                                                    if (isDescuentos) handleOpenDescuentos();
                                                    if (isAdelantos) handleOpenAdelantos();
                                                    if (isLubricantes) handleOpenLubricantes();
                                                    if (isTarjetas) handleOpenTarjetas();
                                                    if (isCreditos) handleOpenCreditos();
                                                    if (isVales) handleOpenVales();
                                                    if (btn.key === 'anticipos') handleOpenAnticipos();
                                                    if (btn.key === 'trupput') handleOpenTrupput();
                                                    if (isDiferencias) handleOpenDiferencias();
                                                }}
                                                disabled={!canClick}
                                                className={`relative flex flex-col items-center gap-1 py-3 px-1 rounded-xl border transition-all text-[9px] font-bold uppercase leading-tight ${
                                                    canClick
                                                    ? 'bg-white border-slate-200 text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 cursor-pointer shadow-sm'
                                                    : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                                }`}
                                            >
                                                {isBtnDirty && (
                                                    <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white animate-pulse" title="Cambios sin guardar" />
                                                )}
                                                <Icon size={18} className={canClick ? 'text-slate-500' : 'text-slate-200'} />
                                                {btn.label}
                                            </button>
                                        );
                                    })}
                        </div>
                    </div>
                        </div>
                    </div>
                </div>

                <GasReadingsModal
                    isOpen={showReadingsModal}
                    onClose={() => { setShowReadingsModal(false); setEditAnterior(false); }}
                    estado={estado}
                    isSuperAdmin={isSuperAdmin}
                    editAnterior={editAnterior}
                    fileInputRef={fileInputRef}
                    importing={importing}
                    handleImportExcel={handleImportExcel}
                    readings={readings}
                    inputRefs={inputRefs}
                    handleReadingChange={handleReadingChange}
                    handleReadingBlur={handleReadingBlur}
                    handleKeyDown={handleKeyDown}
                    inputCls={inputCls}
                    inputDisabledCls={inputDisabledCls}
                    inputCalibCls={inputCalibCls}
                    inputCalibDisabledCls={inputCalibDisabledCls}
                    importResult={importResult}
                    setImportResult={setImportResult}
                    setImporting={setImporting}
                    batchUpdateMutation={batchUpdateMutation}
                />

                <GasGastosModal
                    isOpen={showGastosModal}
                    onClose={() => handleSafeCloseModal('gastos')}
                    isDirty={isSectionDirty('gastos')}
                    estado={estado}
                    gastos={gastos}
                    expenseCategories={expenseCategories}
                    newCategoryName={newCategoryName}
                    setNewCategoryName={setNewCategoryName}
                    showNewCategoryInput={showNewCategoryInput}
                    setShowNewCategoryInput={setShowNewCategoryInput}
                    handleCreateCategory={handleCreateCategory}
                    handleGastoChange={handleGastoChange}
                    loadProviders={loadProviders}
                    despachadoresOptions={despachadoresOptions}
                    handleRemoveGasto={handleRemoveGasto}
                    handleAddGastoRow={handleAddGastoRow}
                    gastosTotal={gastosTotal}
                    handleSaveSection={handleSaveSection}
                    isSaving={saveExpensesMutation.isPending}
                />

                <GasRemesasModal
                    isOpen={showRemesasModal}
                    onClose={() => handleSafeCloseModal('remesas')}
                    isDirty={isSectionDirty('remesas')}
                    estado={estado}
                    remesas={remesas}
                    despachadoresOptions={despachadoresOptions}
                    onRemesaChange={handleRemesaChange}
                    onPrintLabel={handlePrintRemesaLabel}
                    onRemoveRemesa={handleRemoveRemesa}
                    onAddRemesa={handleAddRemesaRow}
                    remesasTotal={remesasTotal}
                    onSave={() => handleSaveSection('remesas')}
                    isSaving={saveRemesasMutation.isPending}
                />

                <GasCuponesModal
                    isOpen={showCuponesModal}
                    onClose={() => handleSafeCloseModal('cupones')}
                    isDirty={isSectionDirty('cupones')}
                    estado={estado}
                    cupones={cupones}
                    distributors={distributors}
                    fuelProducts={fuelProducts}
                    despachadoresOptions={despachadoresOptions}
                    handleCuponChange={handleCuponChange}
                    handleRemoveCupon={handleRemoveCupon}
                    handleAddCuponRow={handleAddCuponRow}
                    cuponesTotal={cuponesTotal}
                    handleSaveSection={handleSaveSection}
                    isSaving={saveCuponesMutation.isPending}
                />

                <GasDescuentosModal
                    isOpen={showDescuentosModal}
                    onClose={() => handleSafeCloseModal('descuentos')}
                    isDirty={isSectionDirty('descuentos')}
                    estado={estado}
                    descuentos={descuentos}
                    loadCustomers={loadCustomers}
                    fuelProducts={fuelProducts}
                    despachadoresOptions={despachadoresOptions}
                    handleDescuentoChange={handleDescuentoChange}
                    handleRemoveDescuento={handleRemoveDescuento}
                    handleAddDescuentoRow={handleAddDescuentoRow}
                    descuentosTotal={descuentosTotal}
                    handleSaveSection={handleSaveSection}
                    isSaving={saveDescuentosMutation.isPending}
                />

                <GasAdelantosModal
                    isOpen={showAdelantosModal}
                    onClose={() => handleSafeCloseModal('adelantos')}
                    isDirty={isSectionDirty('adelantos')}
                    estado={estado}
                    adelantos={adelantos}
                    despachadoresOptions={despachadoresOptions}
                    handleAdelantoChange={handleAdelantoChange}
                    handleRemoveAdelanto={handleRemoveAdelanto}
                    handleAddAdelantoRow={handleAddAdelantoRow}
                    adelantosTotal={adelantosTotal}
                    handleSaveSection={handleSaveSection}
                    isSaving={saveAdelantosMutation.isPending}
                />

                <GasTarjetasModal
                    isOpen={showTarjetasModal}
                    onClose={() => handleSafeCloseModal('tarjetas')}
                    isDirty={isSectionDirty('tarjetas')}
                    estado={estado}
                    tarjetas={tarjetas}
                    posTypesList={posTypesList}
                    despachadoresOptions={despachadoresOptions}
                    handleTarjetaChange={handleTarjetaChange}
                    handleRemoveTarjeta={handleRemoveTarjeta}
                    handleAddTarjetaRow={handleAddTarjetaRow}
                    tarjetasTotal={tarjetasTotal}
                    handleSaveSection={handleSaveSection}
                    isSaving={saveTarjetasMutation.isPending}
                    tarjetasResumenPorTipo={tarjetasResumenPorTipo}
                />

                <GasLubricantesModal
                    isOpen={showLubricantesModal}
                    onClose={() => { setShowLubricantesModal(false); setEditAnterior(false); }}
                    estado={estado}
                    editAnterior={editAnterior}
                    setEditAnterior={setEditAnterior}
                    handleRecargarLubricantes={handleRecargarLubricantes}
                    lubricantLoading={lubricantLoading}
                    lubricantReadings={lubricantReadings}
                    setLubricantReadings={setLubricantReadings}
                    handleLubricantBlur={handleLubricantBlur}
                    handleLubricantKeyDown={handleLubricantKeyDown}
                    lubricantInputRefs={lubricantInputRefs}
                    lubricantTotal={lubricantTotal}
                    inputCls={inputCls}
                    inputDisabledCls={inputDisabledCls}
                />

                <GasTankReadingsModal
                    isOpen={showTankReadingsModal}
                    onClose={() => { setShowTankReadingsModal(false); setEditAnterior(false); }}
                    estado={estado}
                    superAdminTankEdit={superAdminTankEdit}
                    editAnterior={editAnterior}
                    setEditAnterior={setEditAnterior}
                    tankReadings={tankReadings}
                    handleTankReadingChange={handleTankReadingChange}
                    handleTankReadingBlur={handleTankReadingBlur}
                    handleTankKeyDown={handleTankKeyDown}
                    tankInputRefs={tankInputRefs}
                    inputCls={inputCls}
                    inputDisabledCls={inputDisabledCls}
                    inputCalibCls={inputCalibCls}
                    inputCalibDisabledCls={inputCalibDisabledCls}
                />

                <GasCreditosModal
                    isOpen={showCreditosModal}
                    onClose={() => handleSafeCloseModal('creditos')}
                    isDirty={isSectionDirty('creditos')}
                    estado={estado}
                    creditos={creditos}
                    creditosAfectanCxc={creditosAfectanCxc}
                    creditosDesdeFecha={creditosDesdeFecha}
                    toDateStrDDMMYYYY={toDateStrDDMMYYYY}
                    loadCustomers={loadCustomers}
                    fuelProducts={fuelProducts}
                    despachadoresOptions={despachadoresOptions}
                    handleCreditoChange={handleCreditoChange}
                    handleRemoveCredito={handleRemoveCredito}
                    handleAddCreditoRow={handleAddCreditoRow}
                    creditosTotal={creditosTotal}
                    handleSaveSection={handleSaveSection}
                    isSaving={saveCreditosMutation.isPending}
                />

                <GasValesModal
                    isOpen={showValesModal}
                    onClose={() => handleSafeCloseModal('vales')}
                    isDirty={isSectionDirty('vales')}
                    estado={estado}
                    vales={vales}
                    loadCustomers={loadCustomers}
                    fuelProducts={fuelProducts}
                    despachadoresOptions={despachadoresOptions}
                    handleValeChange={handleValeChange}
                    handleRemoveVale={handleRemoveVale}
                    handleAddValeRow={handleAddValeRow}
                    valesTotal={valesTotal}
                    handleSaveSection={handleSaveSection}
                    isSaving={saveValesMutation.isPending}
                />

                <GasDiferenciasModal
                    isOpen={showDiferenciasModal}
                    onClose={() => { setShowDiferenciasModal(false); setDiferenciasData(null); }}
                    editData={editData}
                    fechaTurno={fechaTurno}
                    numeroTurno={numeroTurno}
                    toDateStrDDMMYYYY={toDateStrDDMMYYYY}
                    dayShiftsQuery={dayShiftsQuery}
                    targetShiftId={targetShiftId}
                    setTargetShiftId={setTargetShiftId}
                    formatHora={formatHora}
                    shiftEstado={shiftEstado}
                    selectedTargetShift={selectedTargetShift}
                    diferenciasLoading={diferenciasLoading}
                    diferenciasData={diferenciasData}
                    showConfirmComplementaria={showConfirmComplementaria}
                    setShowConfirmComplementaria={setShowConfirmComplementaria}
                    generarComplementariaMutation={generarComplementariaMutation}
                />

                <GasAnticiposModal
                    isOpen={showAnticiposModal}
                    onClose={() => handleSafeCloseModal('anticipos')}
                    isDirty={isSectionDirty('anticipos')}
                    estado={estado}
                    anticiposDesp={anticiposDesp}
                    loadCustomers={loadCustomers}
                    fuelProducts={fuelProducts}
                    despachadoresOptions={despachadoresOptions}
                    handleAnticipoChange={handleAnticipoChange}
                    handleAnticipoClienteChange={handleAnticipoClienteChange}
                    handleRemoveAnticipo={handleRemoveAnticipo}
                    handleAddAnticipoRow={handleAddAnticipoRow}
                    anticiposDespTotal={anticiposDespTotal}
                    handleSaveSection={handleSaveSection}
                    isSaving={saveAnticiposDespMutation.isPending}
                    pendingAnticiposByClient={pendingAnticiposByClient}
                />

                <GasTrupputModal
                    isOpen={showTrupputModal}
                    onClose={() => handleSafeCloseModal('trupput')}
                    isDirty={isSectionDirty('trupput')}
                    estado={estado}
                    trupputDesp={trupputDesp}
                    loadCustomers={loadCustomers}
                    fuelProducts={fuelProducts}
                    despachadoresOptions={despachadoresOptions}
                    handleTrupputChange={handleTrupputChange}
                    handleTrupputClienteChange={handleTrupputClienteChange}
                    handleRemoveTrupput={handleRemoveTrupput}
                    handleAddTrupputRow={handleAddTrupputRow}
                    trupputDespTotal={trupputDespTotal}
                    handleSaveSection={handleSaveSection}
                    isSaving={saveTrupputDespMutation.isPending}
                    fuelPriceByCode={fuelPriceByCode}
                    pendingTrupputGalonesByClient={pendingTrupputGalonesByClient}
                />

                <GasNozzleAssignModal
                isOpen={showNozzleAssignModal}
                onClose={() => setShowNozzleAssignModal(false)}
                modalSelectedDespachadorId={modalSelectedDespachadorId}
                setModalSelectedDespachadorId={setModalSelectedDespachadorId}
                despachadoresOptions={despachadoresOptions}
                nozzlesData={nozzlesData}
                modalAssignments={modalAssignments}
                setModalAssignments={setModalAssignments}
                closeoutDespachadores={closeoutDespachadores}
                allDespachadores={allDespachadores}
                onSave={handleModalSave}
                closeoutId={closeoutId}
            />
            </>
        );
    }

    return (
        <div className="max-w-lg mx-auto mt-12 space-y-6">
            <div className="text-center">
                <h2 className="text-xl font-bold text-slate-900 flex items-center justify-center gap-2">
                    <Calculator size={22} className="text-indigo-600" />
                    Cierre de Lecturas
                </h2>
                <p className="text-slate-500 text-[11px] font-medium mt-1">Gasolinera — Iniciar nuevo cierre</p>
            </div>

            <form onSubmit={handleInit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                {lastTurno && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2 flex items-center gap-3 text-xs">
                        <span className="font-bold text-indigo-700 uppercase tracking-wider">Último Turno:</span>
                        <span className="text-indigo-600">{(() => { const ds = toDateStr(lastTurno.fecha_turno); if (!ds) return '—'; const [y, m, d] = ds.split('-'); return `${d}/${m}/${y}`; })()} — #{lastTurno.numero_turno}</span>
                    </div>
                )}
                <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Vendedor</label>
                    <div className="relative">
                        <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                            value={sellerId}
                            onChange={(e) => setSellerId(e.target.value)}
                            required
                            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-xs font-medium appearance-none cursor-pointer"
                        >
                            <option value="">Seleccionar vendedor...</option>
                            {sellers.filter(s => s.status === 'activo').map(s => (
                                <option key={s.id} value={s.id}>{s.nombre}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Fecha de Turno</label>
                    <div className="relative">
                        <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="date"
                            value={fechaTurno}
                            onChange={(e) => setFechaTurno(e.target.value)}
                            required
                            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-xs font-medium"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Número de Turno</label>
                    <div className="relative">
                        <Hash size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={numeroTurno}
                                    onChange={(e) => { setNumeroTurno(e.target.value); setUserModifiedTurno(true); }}
                                    required
                                    placeholder="Ej: 1"
                                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-xs font-medium"
                                />
                    </div>
                </div>
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase">Despachadores del Turno</label>
                        <button
                            type="button"
                            onClick={openNozzleModal}
                            className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                            <Fuel size={11} />
                            Configurar Mangueras
                        </button>
                    </div>
                    <div className="space-y-1.5 mb-2">
                        {closeoutDespachadores.map((d, i) => {
                            const desp = allDespachadores.find(a => a.id === d.despachador_id);
                            return (
                                <div key={d.despachador_id} className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg min-w-[60px]">{desp?.codigo || ''}</span>
                                    <input
                                        type="text"
                                        value={d.nombre || ''}
                                        onChange={(e) => {
                                            const updated = [...closeoutDespachadores];
                                            updated[i] = { ...updated[i], nombre: e.target.value };
                                            setCloseoutDespachadores(updated);
                                        }}
                                        placeholder="Nombre del despachador"
                                        className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-xs font-medium"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setCloseoutDespachadores(prev => prev.filter((_, idx) => idx !== i))}
                                        className="p-1 text-slate-600 hover:text-red-500 transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    <select
                        value={despachadorSelectValue}
                        onChange={(e) => {
                            const id = parseInt(e.target.value);
                            if (!id) return;
                            const desp = allDespachadores.find(a => a.id === id);
                            if (desp && !closeoutDespachadores.find(d => d.despachador_id === id)) {
                                setCloseoutDespachadores(prev => [...prev, { despachador_id: id, nombre: desp.descripcion || desp.codigo || '' }]);
                            }
                            setDespachadorSelectValue('');
                        }}
                        className="w-full pl-3 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-xs font-medium appearance-none cursor-pointer"
                    >
                        <option value="">+ Agregar despachador...</option>
                        {allDespachadores
                            .filter(a => !closeoutDespachadores.find(d => d.despachador_id === a.id))
                            .map(a => (
                                <option key={a.id} value={a.id}>{a.descripcion ? `${a.codigo} — ${a.descripcion}` : a.codigo}</option>
                            ))}
                    </select>
                </div>
                <button
                    type="submit"
                    disabled={initMutation.isPending}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {initMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
                    {initMutation.isPending ? 'Iniciando...' : 'Iniciar Lectura'}
                </button>
            </form>
            <GasNozzleAssignModal
                isOpen={showNozzleAssignModal}
                onClose={() => setShowNozzleAssignModal(false)}
                modalSelectedDespachadorId={modalSelectedDespachadorId}
                setModalSelectedDespachadorId={setModalSelectedDespachadorId}
                despachadoresOptions={despachadoresOptions}
                nozzlesData={nozzlesData}
                modalAssignments={modalAssignments}
                setModalAssignments={setModalAssignments}
                closeoutDespachadores={closeoutDespachadores}
                allDespachadores={allDespachadores}
                onSave={handleModalSave}
                closeoutId={closeoutId}
            />
        </div>
    );
};

export default GasCloseout;
