import { useState, useRef, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
    Calculator, Lock, Unlock, Loader2, User, Calendar, Hash, X,
    Fuel, Receipt, CreditCard, Gift, Percent, Truck, Droplets,
    FlaskConical, Banknote, ArrowLeft, Plus, Trash2, Save, UserCheck, Printer, BarChart3, FileText, LockOpen, Upload, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import SearchableSelect from '../components/ui/SearchableSelect';
import { downloadCloseoutPdf } from '../utils/closeoutPdf';
import Money, { MoneyInput } from '../components/ui/Money';
import * as XLSX from 'xlsx';

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
    const [fechaTurno, setFechaTurno] = useState(new Date().toISOString().split('T')[0]);
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
    const [showTarjetasModal, setShowTarjetasModal] = useState(false);
    const [tarjetas, setTarjetas] = useState([]);
    const [showCreditosModal, setShowCreditosModal] = useState(false);
    const [creditos, setCreditos] = useState([]);
    const [showValesModal, setShowValesModal] = useState(false);
    const [vales, setVales] = useState([]);
    const [showAnticiposModal, setShowAnticiposModal] = useState(false);
    const [anticiposDesp, setAnticiposDesp] = useState([]);
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
    const lubricantInputRefs = useRef({});
    const lastDespachadorRef = useRef(null);

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
            if (e.ctrlKey && e.altKey && e.key === 'a') {
                e.preventDefault();
                setEditAnterior(prev => !prev);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const { data: editData, isLoading: editLoading } = useQuery({
        queryKey: ['gas-closeout-edit', editId],
        queryFn: async () => (await axios.get(`/api/gas-station/closeouts/${editId}`)).data,
        enabled: !!editId
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
            setGastos((editData.gastos || []).map(e => ({ ...e, fecha: toDateStr(e.fecha) })));
            setRemesas(editData.remesas || []);
            setCupones(editData.cupones || []);
            setDescuentos(editData.descuentos || []);
            setAdelantos(editData.adelantos || []);
            setTarjetas(editData.tarjetas || []);
            setCreditos(editData.creditos || []);
            setVales(editData.vales || []);
            setAnticiposDesp(editData.anticipos_despachadores || []);
            const firstWithDesp = [editData.gastos, editData.remesas, editData.cupones, editData.descuentos, editData.adelantos, editData.tarjetas, editData.creditos, editData.vales, editData.anticipos_despachadores]
                .flat()
                .find(r => r && r.despachador_id);
            lastDespachadorRef.current = firstWithDesp?.despachador_id || editData.despachadores?.[0]?.despachador_id || null;
        }
    }, [editData]);

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
            lastDespachadorRef.current = null;
        }
    }, [editId]);

    const { data: sellers = [] } = useQuery({
        queryKey: ['sellers-all'],
        queryFn: async () => (await axios.get('/api/sellers', { params: { limit: 200 } })).data?.data || []
    });

    const { data: allDespachadores = [] } = useQuery({
        queryKey: ['gas-despachadores-all', user?.branch_id],
        queryFn: async () => (await axios.get('/api/gas-station/despachadores', { params: { limit: 999 } })).data?.data || []
    });

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
        queryFn: async () => (await axios.get('/api/gas-station/pos-types')).data,
        enabled: !!(closeoutId || editId)
    });

    const { data: liveNozzleAssignments = [] } = useQuery({
        queryKey: ['gas-despachador-nozzles-all', user?.branch_id],
        queryFn: async () => (await axios.get('/api/gas-station/despachador-nozzles/all')).data || []
    });

    const { data: gasSettings } = useQuery({
        queryKey: ['gas-station-settings'],
        queryFn: () => axios.get('/api/gas-station/settings').then(r => r.data),
    });

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
            setGastos(res.data.map(e => ({ ...e, fecha: toDateStr(e.fecha) })));
            queryClient.invalidateQueries({ queryKey: ['gas-closeout-expenses', closeoutId] });
            setShowGastosModal(false);
            toast.success('Gastos guardados');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar gastos')
    });

    const saveRemesasMutation = useMutation({
        mutationFn: (remesas) => axios.post(`/api/gas-station/closeouts/${closeoutId}/remesas`, { remesas }),
        onSuccess: (res) => {
            setRemesas(res.data);
            queryClient.invalidateQueries({ queryKey: ['gas-closeout-remesas', closeoutId] });
            setShowRemesasModal(false);
            toast.success('Remesas guardadas');
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
            queryClient.invalidateQueries({ queryKey: ['gas-closeout-cupones', closeoutId] });
            setShowCuponesModal(false);
            toast.success('Cupones guardados');
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
            queryClient.invalidateQueries({ queryKey: ['gas-closeout-descuentos', closeoutId] });
            setShowDescuentosModal(false);
            toast.success('Descuentos guardados');
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
            queryClient.invalidateQueries({ queryKey: ['gas-closeout-adelantos', closeoutId] });
            setShowAdelantosModal(false);
            toast.success('Adelantos guardados');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar adelantos')
    });

    const adelantosTotal = useMemo(() =>
        adelantos.reduce((s, a) => s + (parseFloat(a.monto) || 0), 0),
    [adelantos]);

    const tarjetasTotal = useMemo(() =>
        tarjetas.reduce((s, t) => s + (parseFloat(t.monto) || 0), 0),
    [tarjetas]);

    const creditosTotal = useMemo(() =>
        creditos.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0),
    [creditos]);

    const valesTotal = useMemo(() =>
        vales.reduce((s, v) => s + (parseFloat(v.monto) || 0), 0),
    [vales]);

    const anticiposDespTotal = useMemo(() =>
        anticiposDesp.reduce((s, a) => s + (parseFloat(a.monto) || 0), 0),
    [anticiposDesp]);

    const saveTarjetasMutation = useMutation({
        mutationFn: (tarjetas) => axios.post(`/api/gas-station/closeouts/${closeoutId}/tarjetas`, { tarjetas }),
        onSuccess: (res) => {
            setTarjetas(res.data);
            queryClient.invalidateQueries({ queryKey: ['gas-closeout-tarjetas', closeoutId] });
            setShowTarjetasModal(false);
            toast.success('Tarjetas guardadas');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar tarjetas')
    });

    const saveCreditosMutation = useMutation({
        mutationFn: (creditos) => axios.post(`/api/gas-station/closeouts/${closeoutId}/creditos`, { creditos }),
        onSuccess: (res) => {
            setCreditos(res.data);
            queryClient.invalidateQueries({ queryKey: ['gas-closeout-creditos', closeoutId] });
            setShowCreditosModal(false);
            toast.success('Créditos guardados');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar créditos')
    });

    const saveValesMutation = useMutation({
        mutationFn: (vales) => axios.post(`/api/gas-station/closeouts/${closeoutId}/vales`, { vales }),
        onSuccess: (res) => {
            setVales(res.data);
            queryClient.invalidateQueries({ queryKey: ['gas-closeout-vales', closeoutId] });
            setShowValesModal(false);
            toast.success('Vales guardados');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar vales')
    });

    const saveAnticiposDespMutation = useMutation({
        mutationFn: (anticipos) => axios.post(`/api/gas-station/closeouts/${closeoutId}/anticipos-desp`, { anticipos }),
        onSuccess: (res) => {
            setAnticiposDesp(res.data);
            queryClient.invalidateQueries({ queryKey: ['gas-closeout-anticipos-desp', closeoutId] });
            setShowAnticiposModal(false);
            toast.success('Anticipos despachados guardados');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar anticipos despachados')
    });

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

    const selectedTargetShift = dayShiftsQuery.data?.data?.find(s => String(s.id) === String(targetShiftId)) || null;

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
            fecha: new Date().toISOString().split('T')[0],
            documento: '',
            tipo: 'ccf',
            provider_id: '',
            proveedor: '',
            valor: 0,
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

    const { data: distributorsData } = useQuery({
        queryKey: ['gas-distributors-all', user?.branch_id],
        queryFn: async () => (await axios.get('/api/gas-station/distributors', { params: { limit: 999 } })).data?.data || [],
    });
    const distributors = distributorsData || [];

    const { data: nozzlesRes } = useQuery({
        queryKey: ['gas-nozzles-all', user?.branch_id],
        queryFn: async () => (await axios.get('/api/gas-station/nozzles', { params: { limit: 999 } })).data,
    });
    const nozzlesData = nozzlesRes?.data || [];

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
            seller_id: parseInt(sellerId),
            seller_name: name,
            fecha_turno: fechaTurno,
            numero_turno: numeroTurno,
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
        setReadings(prev => prev.map(r =>
            r.nozzle_id === nozzleId ? { ...r, [field]: parseFloat(value) || 0 } : r
        ));
    };

    const handleReadingBlur = (readingId, nozzleId) => {
        const r = readings.find(x => x.nozzle_id === nozzleId);
        if (!r) return;
        updateMutation.mutate({
            readingId,
            data: { lectura_actual: r.lectura_actual, calibracion: r.calibracion, lectura_anterior: r.lectura_anterior }
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
                    const nextKey = editAnterior ? `anterior-${nextReading.nozzle_id}` : `lectura_actual-${nextReading.nozzle_id}`;
                    const nextEl = inputRefs.current[nextKey];
                    if (nextEl) nextEl.focus();
                }
                return;
            }

            if (field === 'calibracion') {
                const nextReading = readings[index + 1];
                if (nextReading) {
                    const nextKey = editAnterior ? `anterior-${nextReading.nozzle_id}` : `lectura_actual-${nextReading.nozzle_id}`;
                    const nextEl = inputRefs.current[nextKey];
                    if (nextEl) nextEl.focus();
                }
            }
        }
    };

    const handleTankReadingChange = (tankId, field, value) => {
        if (estado === 'cerrado' || estado === 'reabierto') return;
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

    const handleOpenLubricantes = async () => {
        if (lubricantReadings.length === 0 && closeoutId) {
            try {
                const res = await axios.get(`/api/products/lubricants?branch_id=${user?.branch_id || ''}`);
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
                }
            } catch { }
        }
        setShowLubricantesModal(true);
        setEditAnterior(false);
    };

    const actionButtons = [
        { label: 'Lecturas', icon: Fuel, key: 'lecturas', enabled: true },
        { label: 'Gastos', icon: Receipt, key: 'gastos', enabled: true },
        { label: 'Cupones', icon: CreditCard, key: 'cupones', enabled: true },
        { label: 'Créditos', icon: CreditCard, key: 'creditos', enabled: true },
        { label: 'Vales', icon: Gift, key: 'vales', enabled: true },
        { label: 'Descuentos', icon: Percent, key: 'descuentos', enabled: true },
        { label: 'Anticipos Desp.', icon: Truck, key: 'anticipos', enabled: true },
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

    const modalSelectedNozzleIds = modalAssignments
        .filter(a => a.despachador_id === parseInt(modalSelectedDespachadorId))
        .map(a => a.nozzle_id);

    const nozzleOccupancyMap = {};
    modalAssignments.forEach(a => { nozzleOccupancyMap[a.nozzle_id] = a.despachador_id; });

    const renderNozzleAssignModal = () => {
        if (!showNozzleAssignModal) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                <div className="fixed inset-0 bg-black/40" onClick={() => setShowNozzleAssignModal(false)} />
                <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-2xl max-h-[90vh] flex flex-col">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <Fuel size={16} className="text-indigo-600" />
                            Asignación de Mangueras al Turno
                        </h3>
                        <button
                            onClick={() => setShowNozzleAssignModal(false)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <div className="p-5 overflow-y-auto">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            Despachador
                        </label>
                        <select
                            value={modalSelectedDespachadorId}
                            onChange={(e) => setModalSelectedDespachadorId(e.target.value)}
                            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                            <option value="">-- Seleccionar despachador --</option>
                            {closeoutDespachadores.map(d => {
                                const desp = allDespachadores.find(a => a.id === d.despachador_id);
                                return (
                                    <option key={d.despachador_id} value={d.despachador_id}>
                                        {desp?.codigo || ''} — {d.nombre || desp?.descripcion || ''}
                                    </option>
                                );
                            })}
                        </select>
                        {modalSelectedDespachadorId && (
                            <div className="mt-5 border-t border-slate-100 pt-4">
                                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Mangueras</h3>
                                {nozzlesData.length === 0 ? (
                                    <p className="text-xs text-slate-400 py-4 text-center">No hay mangueras registradas.</p>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                        {nozzlesData.map(n => {
                                            const occupancy = nozzleOccupancyMap[n.id];
                                            const isAssignedToCurrent = modalSelectedNozzleIds.includes(n.id);
                                            const isOccupied = occupancy && occupancy !== parseInt(modalSelectedDespachadorId);

                                            if (isOccupied) {
                                                const otherDesp = closeoutDespachadores.find(d => d.despachador_id === occupancy);
                                                const otherDespAll = allDespachadores.find(a => a.id === occupancy);
                                                const otherLabel = otherDesp?.nombre || otherDespAll?.codigo || `ID ${occupancy}`;
                                                return (
                                                    <div
                                                        key={n.id}
                                                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-xs text-slate-400 cursor-not-allowed"
                                                        title={`Asignada a ${otherLabel}`}
                                                    >
                                                        <Lock size={14} className="text-slate-300" />
                                                        <div className="text-left leading-tight">
                                                            <span className="font-bold">{n.codigo}</span>
                                                            {n.product_nombre && (
                                                                <span className="text-[10px] text-slate-400 block">{n.product_nombre}</span>
                                                            )}
                                                            {n.island_codigo && (
                                                                <span className="text-[10px] text-slate-400 block">Isla: {n.island_codigo}</span>
                                                            )}
                                                            <span className="text-[10px] text-amber-500 block">{otherLabel}</span>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <button
                                                    key={n.id}
                                                    onClick={() => {
                                                        setModalAssignments(prev => {
                                                            const exists = prev.find(a =>
                                                                a.despachador_id === parseInt(modalSelectedDespachadorId) &&
                                                                a.nozzle_id === n.id
                                                            );
                                                            if (exists) {
                                                                return prev.filter(a =>
                                                                    !(a.despachador_id === parseInt(modalSelectedDespachadorId) && a.nozzle_id === n.id)
                                                                );
                                                            }
                                                            return [...prev, { despachador_id: parseInt(modalSelectedDespachadorId), nozzle_id: n.id }];
                                                        });
                                                    }}
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                                                        isAssignedToCurrent
                                                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm'
                                                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'
                                                    }`}
                                                >
                                                    <Fuel size={14} className={isAssignedToCurrent ? 'text-indigo-500' : 'text-slate-300'} />
                                                    <div className="text-left leading-tight">
                                                        <span className="font-bold">{n.codigo}</span>
                                                        {n.product_nombre && (
                                                            <span className="text-[10px] text-slate-500 block">{n.product_nombre}</span>
                                                        )}
                                                        {n.island_codigo && (
                                                            <span className="text-[10px] text-slate-400 block">Isla: {n.island_codigo}</span>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                <p className="text-xs text-slate-400 mt-3">
                                    <Lock size={10} className="inline mr-1" />
                                    Mangueras ocupadas por otro despachador.
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-slate-100 shrink-0">
                        <button
                            onClick={() => setShowNozzleAssignModal(false)}
                            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleModalSave}
                            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm"
                        >
                            {closeoutId ? 'Guardar' : 'Aplicar'}
                        </button>
                    </div>
                </div>
            </div>
        );
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
        const diferenciaTotal = gastosTotal + remesasTotal + cuponesTotal + descuentosTotal + adelantosTotal + tarjetasTotal + creditosTotal + valesTotal + anticiposDespTotal - totals.totalMonto - lubricantTotal;
        return (
            <>
                <div className="space-y-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                            {editId && (
                                <button
                                    onClick={() => navigate('/gas-station/historial-lecturas')}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
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
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
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
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                title="Descargar PDF"
                            >
                                <Printer size={16} />
                            </button>
                            {(estado === 'abierto' || estado === 'reabierto') && (
                                <button
                                    onClick={async () => {
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
                                                <td className="px-3 py-1.5 text-right font-mono text-red-600"><Money value={gastosTotal + remesasTotal + cuponesTotal + descuentosTotal + adelantosTotal + tarjetasTotal + creditosTotal + valesTotal + anticiposDespTotal} /></td>
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
                                    {estado === 'abierto' && (
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
                                                            {estado === 'abierto' ? (
                                                                <input
                                                                    type="text"
                                                                    value={d.nombre}
                                                                    onChange={(e) => {
                                                                        const updated = [...closeoutDespachadores];
                                                                        updated[i] = { ...updated[i], nombre: e.target.value };
                                                                        setCloseoutDespachadores(updated);
                                                                    }}
                                                                    onBlur={() => updateDespachadoresMutation.mutate(closeoutDespachadores)}
                                                                    placeholder="Nombre"
                                                                    className="w-full px-1 py-0.5 bg-white border border-slate-200 rounded outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[11px] font-medium"
                                                                />
                                                            ) : (
                                                                <span className="text-slate-600">{d.nombre}</span>
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
                                        const isTanques = btn.key === 'tanques';
                                        const isDiferencias = btn.key === 'diferencias';
                                        const isBlockedReabierto = (isLectura || isTanques) && estado === 'reabierto';
                                        const canClick = !isBlockedReabierto && (isLectura || isGastos || isRemesas || isCupones || isDescuentos || isAdelantos || isLubricantes || isTarjetas || isCreditos || isVales || isAnticipos || isTanques || isDiferencias || (btn.enabled && estado === 'abierto'));
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
                                                    if (isDiferencias) handleOpenDiferencias();
                                                }}
                                                disabled={!canClick}
                                                className={`flex flex-col items-center gap-1 py-3 px-1 rounded-xl border transition-all text-[9px] font-bold uppercase leading-tight ${
                                                    canClick
                                                    ? 'bg-white border-slate-200 text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 cursor-pointer shadow-sm'
                                                    : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                                }`}
                                            >
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

                {showReadingsModal && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={() => { setShowReadingsModal(false); setEditAnterior(false); }} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-5xl max-h-[90vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Fuel size={16} className="text-indigo-600" />
                                    Lecturas por Pistola
                                    {estado === 'cerrado' && (
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Solo lectura</span>
                                    )}
                                </h3>
                                <div className="flex items-center gap-2">
                                    {estado !== 'cerrado' && (
                                        <>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".xlsx,.xls"
                                                className="hidden"
                                                onChange={(e) => {
                                                    handleImportExcel(e.target.files[0]);
                                                    e.target.value = '';
                                                }}
                                            />
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={importing}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all disabled:opacity-50"
                                            >
                                                {importing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                                                {importing ? 'Importando...' : 'Importar Excel'}
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => { setShowReadingsModal(false); setEditAnterior(false); }}
                                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                        <X size={16} className="text-slate-400" />
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-auto px-4 pb-4 flex-1 relative">
                                <table className="w-full text-left border-separate border-spacing-0 table-cards">
                                    <thead className="sticky top-0 z-20">
                                        <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                            <th className="px-1.5 py-1 w-16 bg-slate-50 border-b border-slate-100">Pistola</th>
                                            <th className="px-1.5 py-1 max-w-[120px] bg-slate-50 border-b border-slate-100">Producto</th>
                                            <th className="px-1.5 py-1 text-right w-16 bg-slate-50 border-b border-slate-100">Precio</th>
                                            <th className={`px-1.5 py-1 text-right w-32 bg-slate-50 border-b border-slate-100 ${editAnterior ? 'text-amber-600' : ''}`}>Lect. Ant{editAnterior && '*'}</th>
                                            <th className="px-1.5 py-1 text-right w-32 bg-slate-50 border-b border-slate-100">Lect. Actual</th>
                                            <th className="px-1.5 py-1 text-right w-24 bg-slate-50 border-b border-slate-100">Calibr</th>
                                            <th className="px-1.5 py-1 text-right w-16 bg-slate-50 border-b border-slate-100">Difer</th>
                                            <th className="px-1.5 py-1 text-right w-20 bg-slate-50 border-b border-slate-100">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {readings.map((r, idx) => {
                                            const diferencia = r.lectura_actual - r.lectura_anterior - r.calibracion;
                                            const monto = diferencia * r.precio;
                                            return (
                                                <tr key={r.nozzle_id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-indigo-50'} hover:bg-indigo-100 transition-colors text-[11px]`}>
                                                    <td className="px-1.5 py-0.5 font-bold text-slate-900 whitespace-nowrap" data-label="Pistola">{r.codigo_pistola}</td>
                                                    <td className="px-1.5 py-0.5 max-w-[120px] truncate" data-label="Producto">
                                                        <span className="font-medium text-slate-800">{r.codigo_producto}</span>
                                                        <span className="text-[10px] text-slate-400 ml-1">— {r.descripcion_producto}</span>
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-right font-mono text-slate-700 whitespace-nowrap" data-label="Precio"><Money value={r.precio} /></td>
                                                    <td className="px-1.5 py-0.5 text-right" data-label="Lect. Ant.">
                                                        {editAnterior ? (
                                                            <input
                                                                ref={el => { inputRefs.current[`anterior-${r.nozzle_id}`] = el; }}
                                                                type="number"
                                                                step="0.00001"
                                                                value={r.lectura_anterior || ''}
                                                                onChange={(e) => handleReadingChange(r.nozzle_id, 'lectura_anterior', e.target.value)}
                                                                onBlur={() => handleReadingBlur(r.id, r.nozzle_id)}
                                                                onKeyDown={(e) => handleKeyDown(e, idx, 'lectura_anterior')}
                                                                onFocus={(e) => e.target.select()}
                                                                disabled={estado === 'cerrado'}
                                                                className={`${estado === 'cerrado' ? inputDisabledCls : inputCls} ml-auto`}
                                                            />
                                                    ) : (
                                                        <span className="font-mono text-slate-500 whitespace-nowrap">{r.lectura_anterior.toFixed(5)}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-right" data-label="Lect. Actual">
                                                        <input
                                                            ref={el => { inputRefs.current[`lectura_actual-${r.nozzle_id}`] = el; }}
                                                            type="number"
                                                            step="0.00001"
                                                            value={r.lectura_actual || ''}
                                                            onChange={(e) => handleReadingChange(r.nozzle_id, 'lectura_actual', e.target.value)}
                                                            onBlur={() => handleReadingBlur(r.id, r.nozzle_id)}
                                                            onKeyDown={(e) => handleKeyDown(e, idx, 'lectura_actual')}
                                                            onFocus={(e) => e.target.select()}
                                                            onWheel={(e) => e.target.blur()}
                                                            disabled={estado === 'cerrado'}
                                                            className={`${estado === 'cerrado' ? inputDisabledCls : inputCls} ml-auto`}
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-right" data-label="Calibr.">
                                                        <input
                                                            ref={el => { inputRefs.current[`calibracion-${r.nozzle_id}`] = el; }}
                                                            type="number"
                                                            step="0.00001"
                                                            value={r.calibracion || ''}
                                                            onChange={(e) => handleReadingChange(r.nozzle_id, 'calibracion', e.target.value)}
                                                            onBlur={() => handleReadingBlur(r.id, r.nozzle_id)}
                                                            onKeyDown={(e) => handleKeyDown(e, idx, 'calibracion')}
                                                            onFocus={(e) => e.target.select()}
                                                            onWheel={(e) => e.target.blur()}
                                                            disabled={estado === 'cerrado'}
                                                            className={`${estado === 'cerrado' ? inputCalibDisabledCls : inputCalibCls} ml-auto`}
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-right font-mono font-bold text-indigo-600 whitespace-nowrap" data-label="Difer.">{diferencia.toFixed(5)}</td>
                                                    <td className="px-1.5 py-0.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap" data-label="Monto"><Money value={monto} /></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {importResult && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={() => { setImportResult(null); setImporting(false); }} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-lg max-h-[80vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Upload size={16} className="text-indigo-600" />
                                    Importar Lecturas
                                </h3>
                                <button onClick={() => { setImportResult(null); setImporting(false); }} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="p-5 overflow-y-auto">
                                <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
                                    <div className="text-center">
                                        <div className="text-2xl font-black text-emerald-600">{importResult.matched.length}</div>
                                        <div className="text-[10px] font-bold text-slate-500 uppercase">Coinciden</div>
                                    </div>
                                    <div className="w-px h-10 bg-slate-200" />
                                    <div className="text-center">
                                        <div className="text-2xl font-black text-slate-400">{importResult.total}</div>
                                        <div className="text-[10px] font-bold text-slate-500 uppercase">Total filas</div>
                                    </div>
                                    {importResult.warnings.length > 0 && (
                                        <>
                                            <div className="w-px h-10 bg-slate-200" />
                                            <div className="text-center">
                                                <div className="text-2xl font-black text-amber-500">{importResult.warnings.length}</div>
                                                <div className="text-[10px] font-bold text-slate-500 uppercase">Advertencias</div>
                                            </div>
                                        </>
                                    )}
                                    {importResult.unmatched.length > 0 && (
                                        <>
                                            <div className="w-px h-10 bg-slate-200" />
                                            <div className="text-center">
                                                <div className="text-2xl font-black text-rose-500">{importResult.unmatched.length}</div>
                                                <div className="text-[10px] font-bold text-slate-500 uppercase">Sin match</div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {importResult.warnings.length > 0 && (
                                    <div className="mb-4">
                                        <h4 className="text-[11px] font-bold text-amber-600 uppercase mb-2">Advertencias — Volumen inicial no coincide con lectura anterior</h4>
                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                            {importResult.warnings.map((w, i) => (
                                                <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-amber-50 text-[11px]">
                                                    <span className="font-medium text-slate-700">{w.reading}</span>
                                                    <span className="text-amber-600 ml-auto">Esperado: {w.expected} | Recibido: {w.actual}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {importResult.unmatched.length > 0 && (
                                    <div className="mb-4">
                                        <h4 className="text-[11px] font-bold text-rose-600 uppercase mb-2">Filas sin coincidencia</h4>
                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                            {importResult.unmatched.map((u, i) => (
                                                <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-rose-50 text-[11px]">
                                                    <span className="font-medium text-slate-700">{u.row}</span>
                                                    <span className="text-rose-500 ml-auto">{u.reason}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-slate-100 shrink-0">
                                <button
                                    onClick={() => { setImportResult(null); setImporting(false); }}
                                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => {
                                        batchUpdateMutation.mutate(importResult.matched.map(m => ({
                                            readingId: m.readingId,
                                            lectura_actual: m.lectura_actual
                                        })));
                                    }}
                                    disabled={importResult.matched.length === 0 || batchUpdateMutation.isPending}
                                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50 flex items-center gap-1"
                                >
                                    {batchUpdateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                    {batchUpdateMutation.isPending ? 'Guardando...' : `Aplicar ${importResult.matched.length} lectura(s)`}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showGastosModal && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={() => setShowGastosModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-4xl min-h-[65vh] max-h-[95vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Receipt size={16} className="text-indigo-600" />
                                    Gastos del Turno
                                    {estado === 'cerrado' && (
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Solo lectura</span>
                                    )}
                                </h3>
                                <button
                                    onClick={() => setShowGastosModal(false)}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="overflow-auto px-4 pb-4 flex-1">
                                <table className="w-full text-left border-separate border-spacing-0 table-cards">
                                    <thead className="sticky top-0 z-20">
                                        <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-36">Rubro</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-24">Fecha</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-24">Documento</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-16">Tipo</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-36">Proveedor</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-44">Despachador</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-20">Valor</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {gastos.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="px-3 py-8 text-center text-xs text-slate-400">
                                                    No hay gastos registrados. Agregue un gasto para comenzar.
                                                </td>
                                            </tr>
                                        )}
                                        {gastos.map(g => (
                                            <tr key={g.id} className="text-[11px] hover:bg-slate-50 transition-colors">
                                                <td className="px-1.5 py-1" data-label="Rubro">
                                                    {showNewCategoryInput ? (
                                                        <div className="flex gap-1">
                                                            <input
                                                                type="text"
                                                                value={newCategoryName}
                                                                onChange={(e) => setNewCategoryName(e.target.value)}
                                                                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCategory(); if (e.key === 'Escape') setShowNewCategoryInput(false); }}
                                                                placeholder="Nuevo rubro..."
                                                                className="w-full px-1.5 py-0.5 bg-white border border-indigo-300 rounded text-[11px] outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                                autoFocus
                                                            />
                                                            <button onClick={handleCreateCategory} className="p-0.5 text-indigo-600 hover:text-indigo-800">
                                                                <Plus size={14} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <select
                                                            value={g.rubro}
                                                            onChange={(e) => {
                                                                if (e.target.value === '__new__') {
                                                                    setShowNewCategoryInput(true);
                                                                    setNewCategoryName('');
                                                                } else {
                                                                    handleGastoChange(g.id, 'rubro', e.target.value);
                                                                }
                                                            }}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            <option value="">Seleccionar...</option>
                                                            {expenseCategories.map(c => (
                                                                <option key={c.id} value={c.name}>{c.name}</option>
                                                            ))}
                                                            <option value="__new__">+ Nuevo rubro...</option>
                                                        </select>
                                                    )}
                                                </td>
                                                <td className="px-1.5 py-1" data-label="Fecha">
                                                    <input
                                                        type="date"
                                                        value={g.fecha}
                                                        onChange={(e) => handleGastoChange(g.id, 'fecha', e.target.value)}
                                                        disabled={estado === 'cerrado'}
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1" data-label="Documento">
                                                    <input
                                                        type="text"
                                                        value={g.documento}
                                                        onChange={(e) => handleGastoChange(g.id, 'documento', e.target.value)}
                                                        disabled={estado === 'cerrado'}
                                                        placeholder="N° documento"
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1" data-label="Tipo">
                                                    <select
                                                        value={g.tipo}
                                                        onChange={(e) => handleGastoChange(g.id, 'tipo', e.target.value)}
                                                        disabled={estado === 'cerrado'}
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    >
                                                        <option value="ccf">CCF</option>
                                                        <option value="cmp">CMP</option>
                                                        <option value="fac">FAC</option>
                                                        <option value="tic">TIC</option>
                                                    </select>
                                                </td>
                                                <td className="px-1.5 py-1" data-label="Proveedor">
                                                    <SearchableSelect
                                                        loadOptions={loadProviders}
                                                        value={g.provider_id}
                                                        onChange={(e, opt) => {
                                                            handleGastoChange(g.id, 'provider_id', e.target.value);
                                                            handleGastoChange(g.id, 'proveedor', opt ? opt.nombre : '');
                                                        }}
                                                        disabled={estado === 'cerrado'}
                                                        placeholder="Buscar proveedor..."
                                                        valueKey="id"
                                                        labelKey="nombre"
                                                        displayKey="nombre"
                                                        codeKey="nrc"
                                                        codeLabel="NRC"
                                                        selectedLabel={g.proveedor}
                                                        dropdownWidth={380}
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1" data-label="Despachador">
                                                    <select
                                                        value={g.despachador_id || ''}
                                                        onChange={(e) => handleGastoChange(g.id, 'despachador_id', e.target.value)}
                                                        disabled={estado === 'cerrado'}
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    >
                                                        {allDespachadores.length === 0 && <option value="">Sin despachador</option>}
                                                        {allDespachadores.map(d => (
                                                            <option key={d.id} value={d.id}>{d.codigo} — {d.descripcion}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-1.5 py-1 text-right" data-label="Valor">
                                                    <MoneyInput
                                                        step="0.01"
                                                        value={g.valor || ''}
                                                        onChange={(e) => handleGastoChange(g.id, 'valor', parseFloat(e.target.value) || 0)}
                                                        onFocus={(e) => e.target.select()}
                                                        disabled={estado === 'cerrado'}
                                                        placeholder="0.00"
                                                        className="w-20 text-right bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1 text-center" data-label="">
                                                    {estado !== 'cerrado' && (
                                                        <button
                                                            onClick={() => handleRemoveGasto(g.id)}
                                                            className="p-0.5 text-slate-300 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {estado !== 'cerrado' && (
                                    <div className="flex items-center justify-between mt-3">
                                        <button
                                            onClick={handleAddGastoRow}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all"
                                        >
                                            <Plus size={14} />
                                            Agregar Gasto
                                        </button>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs text-slate-500">
                                                Total Gastos: <strong className="text-red-600 font-mono text-sm"><Money value={gastosTotal} /></strong>
                                            </span>
                                            <button
                                                onClick={() => {
                                                    const sinDesp = gastos.filter(g => !g.despachador_id);
                                                    if (sinDesp.length > 0) {
                                                        toast.error('Todos los gastos deben tener un despachador asignado');
                                                        return;
                                                    }
                                                    saveExpensesMutation.mutate(gastos);
                                                }}
                                                disabled={saveExpensesMutation.isPending}
                                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50"
                                            >
                                                {saveExpensesMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                {saveExpensesMutation.isPending ? 'Guardando...' : 'Guardar Gastos'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {showRemesasModal && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={() => setShowRemesasModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-3xl min-h-[50vh] max-h-[95vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Banknote size={16} className="text-indigo-600" />
                                    Remesas del Turno
                                    {estado === 'cerrado' && (
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Solo lectura</span>
                                    )}
                                </h3>
                                <button
                                    onClick={() => setShowRemesasModal(false)}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="overflow-auto px-4 pb-4 flex-1">
                                <table className="w-full text-left border-separate border-spacing-0 table-cards">
                                    <thead className="sticky top-0 z-20">
                                        <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-28">Código</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-28">Documento</th>
<th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-44">Despachador</th>
                                             <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-44">Tipo de Operación</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-24">Monto</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {remesas.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-3 py-8 text-center text-xs text-slate-400">
                                                    No hay remesas registradas. Agregue una remesa para comenzar.
                                                </td>
                                            </tr>
                                        )}
                                        {remesas.map(r => (
                                            <tr key={r.id} className="text-[11px] hover:bg-slate-50 transition-colors">
                                                <td className="px-1.5 py-1" data-label="Código">
                                                    <span className="text-[11px] font-mono text-slate-600">${escHtml(r.codigo || '—')}</span>
                                                </td>
                                                <td className="px-1.5 py-1" data-label="Documento">
                                                    <input
                                                        type="text"
                                                        value={r.documento}
                                                        onChange={(e) => handleRemesaChange(r.id, 'documento', e.target.value)}
                                                        disabled={estado === 'cerrado'}
                                                        placeholder="N° documento"
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1" data-label="Despachador">
                                                    <select
                                                        value={r.despachador_id || ''}
                                                        onChange={(e) => handleRemesaChange(r.id, 'despachador_id', e.target.value)}
                                                        disabled={estado === 'cerrado'}
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    >
                                                        {allDespachadores.length === 0 && <option value="">Sin despachador</option>}
                                                        {allDespachadores.map(disp => (
                                                            <option key={disp.id} value={disp.id}>{disp.codigo} — {disp.descripcion}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-1.5 py-1" data-label="Tipo de Operación">
                                                    <select
                                                        value={r.tipo_operacion}
                                                        onChange={(e) => handleRemesaChange(r.id, 'tipo_operacion', e.target.value)}
                                                        disabled={estado === 'cerrado'}
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    >
                                                        <option value="venta_combustible">Venta de Combustible</option>
                                                        <option value="recuperacion_credito">Recuperación de Crédito</option>
                                                        <option value="pago_anticipado">Pago Anticipado</option>
                                                    </select>
                                                </td>
                                                <td className="px-1.5 py-1 text-right" data-label="Monto">
                                                    <MoneyInput
                                                        step="0.01"
                                                        value={r.monto || ''}
                                                        onChange={(e) => handleRemesaChange(r.id, 'monto', parseFloat(e.target.value) || 0)}
                                                        onFocus={(e) => e.target.select()}
                                                        disabled={estado === 'cerrado'}
                                                        placeholder="0.00"
                                                        className="w-full text-right bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1 text-center" data-label="">
                                                    <div className="flex items-center justify-center gap-0.5">
                                                        <button
                                                            onClick={() => handlePrintRemesaLabel(r)}
                                                            className="p-0.5 text-slate-300 hover:text-indigo-500 transition-colors"
                                                            title="Imprimir etiqueta"
                                                        >
                                                            <Printer size={14} />
                                                        </button>
                                                        {estado !== 'cerrado' && (
                                                            <button
                                                                onClick={() => handleRemoveRemesa(r.id)}
                                                                className="p-0.5 text-slate-300 hover:text-red-500 transition-colors"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {estado !== 'cerrado' && (
                                    <div className="flex items-center justify-between mt-3">
                                        <button
                                            onClick={handleAddRemesaRow}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all"
                                        >
                                            <Plus size={14} />
                                            Agregar Remesa
                                        </button>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs text-slate-500">
                                                Total Remesas: <strong className="text-red-600 font-mono text-sm"><Money value={remesasTotal} /></strong>
                                            </span>
                                            <button
                                                onClick={() => {
                                                    const sinDesp = remesas.filter(r => !r.despachador_id);
                                                    if (sinDesp.length > 0) {
                                                        toast.error('Todas las remesas deben tener un despachador asignado');
                                                        return;
                                                    }
                                                    saveRemesasMutation.mutate(remesas);
                                                }}
                                                disabled={saveRemesasMutation.isPending}
                                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50"
                                            >
                                                {saveRemesasMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                {saveRemesasMutation.isPending ? 'Guardando...' : 'Guardar Remesas'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {showCuponesModal && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={() => setShowCuponesModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-4xl min-h-[50vh] max-h-[95vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <CreditCard size={16} className="text-indigo-600" />
                                    Cupones del Turno
                                    {estado === 'cerrado' && (
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Solo lectura</span>
                                    )}
                                </h3>
                                <button
                                    onClick={() => setShowCuponesModal(false)}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="overflow-auto px-4 pb-4 flex-1">
                                <table className="w-full text-left border-separate border-spacing-0 table-cards">
                                    <thead className="sticky top-0 z-20">
                                        <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-28">Cupón</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-32">Distribuidora</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-28">Producto</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-44">Despachador</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-20">Monto</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {cupones.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-3 py-8 text-center text-xs text-slate-400">
                                                    No hay cupones registrados. Agregue un cupón para comenzar.
                                                </td>
                                            </tr>
                                        )}
                                        {cupones.map(c => (
                                            <tr key={c.id} className="text-[11px] hover:bg-slate-50 transition-colors">
                                                <td className="px-1.5 py-1" data-label="Cupón">
                                                    <input
                                                        type="text"
                                                        value={c.cupon}
                                                        onChange={(e) => handleCuponChange(c.id, 'cupon', e.target.value)}
                                                        disabled={estado === 'cerrado'}
                                                        placeholder="N° cupón"
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1" data-label="Distribuidora">
                                                    <select
                                                        value={c.distribuidora_id}
                                                        onChange={(e) => {
                                                            const id = e.target.value;
                                                            const dist = distributors.find(d => d.id === parseInt(id));
                                                            handleCuponChange(c.id, 'distribuidora_id', id);
                                                            handleCuponChange(c.id, 'distribuidora_nombre', dist ? dist.descripcion : '');
                                                        }}
                                                        disabled={estado === 'cerrado'}
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    >
                                                        <option value="">Seleccionar...</option>
                                                        {distributors.map(d => (
                                                            <option key={d.id} value={d.id}>{d.codigo} — {d.descripcion}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-1.5 py-1" data-label="Producto">
                                                    <select
                                                        value={c.producto_codigo}
                                                        onChange={(e) => {
                                                            const cod = e.target.value;
                                                            const prod = fuelProducts.find(p => p.codigo === cod);
                                                            handleCuponChange(c.id, 'producto_codigo', cod);
                                                            handleCuponChange(c.id, 'producto_descripcion', prod ? prod.descripcion : '');
                                                        }}
                                                        disabled={estado === 'cerrado'}
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    >
                                                        <option value="">Seleccionar...</option>
                                                        {fuelProducts.map(p => (
                                                            <option key={p.codigo} value={p.codigo}>{p.codigo} — {p.descripcion}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-1.5 py-1" data-label="Despachador">
                                                    <select
                                                        value={c.despachador_id || ''}
                                                        onChange={(e) => handleCuponChange(c.id, 'despachador_id', e.target.value)}
                                                        disabled={estado === 'cerrado'}
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    >
                                                        {allDespachadores.length === 0 && <option value="">Sin despachador</option>}
                                                        {allDespachadores.map(d => (
                                                            <option key={d.id} value={d.id}>{d.codigo} — {d.descripcion}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-1.5 py-1 text-right" data-label="Monto">
                                                    <MoneyInput
                                                        step="0.01"
                                                        value={c.monto || ''}
                                                        onChange={(e) => handleCuponChange(c.id, 'monto', parseFloat(e.target.value) || 0)}
                                                        onFocus={(e) => e.target.select()}
                                                        disabled={estado === 'cerrado'}
                                                        placeholder="0.00"
                                                        className="w-full text-right bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1 text-center" data-label="">
                                                    {estado !== 'cerrado' && (
                                                        <button
                                                            onClick={() => handleRemoveCupon(c.id)}
                                                            className="p-0.5 text-slate-300 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {estado !== 'cerrado' && (
                                    <div className="flex items-center justify-between mt-3">
                                        <button
                                            onClick={handleAddCuponRow}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all"
                                        >
                                            <Plus size={14} />
                                            Agregar Cupón
                                        </button>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs text-slate-500">
                                                Total Cupones: <strong className="text-red-600 font-mono text-sm"><Money value={cuponesTotal} /></strong>
                                            </span>
                                            <button
                                                onClick={() => {
                                                    const sinDesp = cupones.filter(c => !c.despachador_id);
                                                    if (sinDesp.length > 0) {
                                                        toast.error('Todos los cupones deben tener un despachador asignado');
                                                        return;
                                                    }
                                                    saveCuponesMutation.mutate(cupones);
                                                }}
                                                disabled={saveCuponesMutation.isPending}
                                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50"
                                            >
                                                {saveCuponesMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                {saveCuponesMutation.isPending ? 'Guardando...' : 'Guardar Cupones'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {showDescuentosModal && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={() => setShowDescuentosModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-5xl min-h-[50vh] max-h-[95vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Percent size={16} className="text-indigo-600" />
                                    Descuentos del Turno
                                    {estado === 'cerrado' && (
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Solo lectura</span>
                                    )}
                                </h3>
                                <button
                                    onClick={() => setShowDescuentosModal(false)}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="overflow-auto px-4 pb-4 flex-1">
                                <table className="w-full text-left border-separate border-spacing-0 table-cards">
                                    <thead className="sticky top-0 z-20">
                                        <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-24">Documento</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-40">Cliente</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-28">Producto</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-44">Despachador</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-16">Cantidad</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-16">Valor</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-20">Total</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {descuentos.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="px-3 py-8 text-center text-xs text-slate-400">
                                                    No hay descuentos registrados. Agregue un descuento para comenzar.
                                                </td>
                                            </tr>
                                        )}
                                        {descuentos.map(d => (
                                            <tr key={d.id} className="text-[11px] hover:bg-slate-50 transition-colors">
                                                <td className="px-1.5 py-1" data-label="Documento">
                                                    <input
                                                        type="text"
                                                        value={d.documento}
                                                        onChange={(e) => handleDescuentoChange(d.id, 'documento', e.target.value)}
                                                        disabled={estado === 'cerrado'}
                                                        placeholder="N° documento"
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1" data-label="Cliente">
                                                    <SearchableSelect
                                                        loadOptions={loadCustomers()}
                                                        value={d.cliente_id}
                                                        onChange={(e, opt) => {
                                                            handleDescuentoChange(d.id, 'cliente_id', e.target.value);
                                                            handleDescuentoChange(d.id, 'cliente_nombre', opt ? opt.nombre : '');
                                                        }}
                                                        disabled={estado === 'cerrado'}
                                                        placeholder="Buscar cliente..."
                                                        valueKey="id"
                                                        labelKey="nombre"
                                                        displayKey="nombre"
                                                        codeKey="nit"
                                                        codeLabel="NIT/DOC"
                                                        selectedLabel={d.cliente_nombre}
                                                        dropdownWidth={420}
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1" data-label="Producto">
                                                    <select
                                                        value={d.producto_codigo}
                                                        onChange={(e) => {
                                                            const cod = e.target.value;
                                                            const prod = fuelProducts.find(p => p.codigo === cod);
                                                            handleDescuentoChange(d.id, 'producto_codigo', cod);
                                                            handleDescuentoChange(d.id, 'producto_descripcion', prod ? prod.descripcion : '');
                                                        }}
                                                        disabled={estado === 'cerrado'}
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    >
                                                        <option value="">Seleccionar...</option>
                                                        {fuelProducts.map(p => (
                                                            <option key={p.codigo} value={p.codigo}>{p.codigo} — {p.descripcion}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-1.5 py-1" data-label="Despachador">
                                                    <select
                                                        value={d.despachador_id || ''}
                                                        onChange={(e) => handleDescuentoChange(d.id, 'despachador_id', e.target.value)}
                                                        disabled={estado === 'cerrado'}
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    >
                                                        {allDespachadores.length === 0 && <option value="">Sin despachador</option>}
                                                        {allDespachadores.map(disp => (
                                                            <option key={disp.id} value={disp.id}>{disp.codigo} — {disp.descripcion}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-1.5 py-1 text-right" data-label="Cantidad">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={d.cantidad || ''}
                                                        onChange={(e) => handleDescuentoChange(d.id, 'cantidad', e.target.value)}
                                                        onFocus={(e) => e.target.select()}
                                                        disabled={estado === 'cerrado'}
                                                        placeholder="0"
                                                        className="w-full text-right bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1 text-right" data-label="Valor">
                                                    <MoneyInput
                                                        step="0.01"
                                                        value={d.valor ?? ''}
                                                        onChange={(e) => handleDescuentoChange(d.id, 'valor', e.target.value)}
                                                        onFocus={(e) => e.target.select()}
                                                        disabled={estado === 'cerrado'}
                                                        placeholder="0.00"
                                                        className="w-full text-right bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1 text-right" data-label="Total">
                                                    <span className="font-mono font-bold text-slate-900"><Money value={(parseFloat(d.cantidad) || 0) * (parseFloat(d.valor) || 0)} /></span>
                                                </td>
                                                <td className="px-1.5 py-1 text-center" data-label="">
                                                    {estado !== 'cerrado' && (
                                                        <button
                                                            onClick={() => handleRemoveDescuento(d.id)}
                                                            className="p-0.5 text-slate-300 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {estado !== 'cerrado' && (
                                    <div className="flex items-center justify-between mt-3">
                                        <button
                                            onClick={handleAddDescuentoRow}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all"
                                        >
                                            <Plus size={14} />
                                            Agregar Descuento
                                        </button>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs text-slate-500">
                                                Total Descuentos: <strong className="text-red-600 font-mono text-sm"><Money value={descuentosTotal} /></strong>
                                            </span>
                                            <button
                                                onClick={() => {
                                                    const sinDesp = descuentos.filter(d => !d.despachador_id);
                                                    if (sinDesp.length > 0) {
                                                        toast.error('Todos los descuentos deben tener un despachador asignado');
                                                        return;
                                                    }
                                                    saveDescuentosMutation.mutate(descuentos);
                                                }}
                                                disabled={saveDescuentosMutation.isPending}
                                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50"
                                            >
                                                {saveDescuentosMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                {saveDescuentosMutation.isPending ? 'Guardando...' : 'Guardar Descuentos'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {showAdelantosModal && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={() => setShowAdelantosModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-2xl min-h-[40vh] max-h-[95vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Banknote size={16} className="text-indigo-600" />
                                    Adelantos del Turno
                                    {estado === 'cerrado' && (
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Solo lectura</span>
                                    )}
                                </h3>
                                <button
                                    onClick={() => setShowAdelantosModal(false)}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="overflow-auto px-4 pb-4 flex-1">
                                <table className="w-full text-left border-separate border-spacing-0 table-cards">
                                    <thead className="sticky top-0 z-20">
                                        <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100">Empleado</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-44">Despachador</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-24">Monto</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {adelantos.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-3 py-8 text-center text-xs text-slate-400">
                                                    No hay adelantos registrados. Agregue un adelanto para comenzar.
                                                </td>
                                            </tr>
                                        )}
                                        {adelantos.map(a => (
                                            <tr key={a.id} className="text-[11px] hover:bg-slate-50 transition-colors">
                                                <td className="px-1.5 py-1" data-label="Empleado">
                                                    <input
                                                        type="text"
                                                        value={a.empleado}
                                                        onChange={(e) => handleAdelantoChange(a.id, 'empleado', e.target.value)}
                                                        disabled={estado === 'cerrado'}
                                                        placeholder="Nombre del empleado"
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1" data-label="Despachador">
                                                    <select
                                                        value={a.despachador_id || ''}
                                                        onChange={(e) => handleAdelantoChange(a.id, 'despachador_id', e.target.value)}
                                                        disabled={estado === 'cerrado'}
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    >
                                                        {allDespachadores.length === 0 && <option value="">Sin despachador</option>}
                                                        {allDespachadores.map(disp => (
                                                            <option key={disp.id} value={disp.id}>{disp.codigo} — {disp.descripcion}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-1.5 py-1 text-right" data-label="Monto">
                                                    <MoneyInput
                                                        step="0.01"
                                                        value={a.monto ?? ''}
                                                        onChange={(e) => handleAdelantoChange(a.id, 'monto', e.target.value)}
                                                        onFocus={(e) => e.target.select()}
                                                        disabled={estado === 'cerrado'}
                                                        placeholder="0.00"
                                                        className="w-full text-right bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1 text-center" data-label="">
                                                    {estado !== 'cerrado' && (
                                                        <button
                                                            onClick={() => handleRemoveAdelanto(a.id)}
                                                            className="p-0.5 text-slate-300 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {estado !== 'cerrado' && (
                                    <div className="flex items-center justify-between mt-3">
                                        <button
                                            onClick={handleAddAdelantoRow}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all"
                                        >
                                            <Plus size={14} />
                                            Agregar Adelanto
                                        </button>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs text-slate-500">
                                                Total Adelantos: <strong className="text-red-600 font-mono text-sm"><Money value={adelantosTotal} /></strong>
                                            </span>
                                            <button
                                                onClick={() => {
                                                    const sinDesp = adelantos.filter(a => !a.despachador_id);
                                                    if (sinDesp.length > 0) {
                                                        toast.error('Todos los adelantos deben tener un despachador asignado');
                                                        return;
                                                    }
                                                    saveAdelantosMutation.mutate(adelantos);
                                                }}
                                                disabled={saveAdelantosMutation.isPending}
                                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50"
                                            >
                                                {saveAdelantosMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                {saveAdelantosMutation.isPending ? 'Guardando...' : 'Guardar Adelantos'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {showTarjetasModal && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={() => setShowTarjetasModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-5xl min-h-[50vh] max-h-[95vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <CreditCard size={16} className="text-indigo-600" />
                                    Tarjetas del Turno
                                    {estado === 'cerrado' && (
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Solo lectura</span>
                                    )}
                                </h3>
                                <button
                                    onClick={() => setShowTarjetasModal(false)}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="overflow-auto px-4 pb-4 flex-1">
                                <table className="w-full text-left border-collapse table-cards">
                                    <thead>
                                        <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 sticky top-0 z-10">
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-28">No. Tarjeta</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-28">No. Autorización</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-32">Tipo POS</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-44">Despachador</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-40">Tipo Operación</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-24 text-right">Monto</th>
                                            {estado === 'abierto' && <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-6"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 text-[11px]">
                                        {tarjetas.length === 0 && (
                                            <tr>
                                                <td colSpan={estado === 'abierto' ? 7 : 6} className="px-2 py-3 text-center text-[10px] text-slate-400">
                                                    Sin registros de tarjetas
                                                </td>
                                            </tr>
                                        )}
                                        {tarjetas.map(t => {
                                            return (
                                                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-1.5 py-1" data-label="No. Tarjeta">
                                                        <input
                                                            type="text"
                                                            value={t.num_tarjeta}
                                                            placeholder="-0000"
                                                            onChange={(e) => {
                                                                const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 4);
                                                                handleTarjetaChange(t.id, 'num_tarjeta', raw);
                                                            }}
                                                            onBlur={(e) => {
                                                                const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 4);
                                                                const formatted = raw ? '-' + raw.padStart(4, '0') : '';
                                                                handleTarjetaChange(t.id, 'num_tarjeta', formatted);
                                                            }}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="No. Autorización">
                                                        <input
                                                            type="text"
                                                            value={t.num_autorizacion}
                                                            placeholder="Autorización"
                                                            onChange={(e) => handleTarjetaChange(t.id, 'num_autorizacion', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Tipo POS">
                                                        <select
                                                            value={t.pos_type_id || ''}
                                                            onChange={(e) => handleTarjetaChange(t.id, 'pos_type_id', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            <option value="">Seleccionar...</option>
                                                            {posTypesList.map(p => (
                                                                <option key={p.id} value={p.id}>{p.nombre}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Despachador">
                                                        <select
                                                            value={t.despachador_id || ''}
                                                            onChange={(e) => handleTarjetaChange(t.id, 'despachador_id', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            {allDespachadores.length === 0 && <option value="">Sin despachador</option>}
                                                            {allDespachadores.map(d => (
                                                                <option key={d.id} value={d.id}>{d.codigo} — {d.descripcion}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Tipo Operación">
                                                        <select
                                                            value={t.tipo_operacion || 'venta_combustible'}
                                                            onChange={(e) => handleTarjetaChange(t.id, 'tipo_operacion', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            <option value="venta_combustible">Venta de Combustible</option>
                                                            <option value="recuperacion_credito">Recuperación de Crédito</option>
                                                            <option value="pago_anticipado">Pago Anticipado</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Monto">
                                                    <MoneyInput
                                                        step="0.01"
                                                        min="0"
                                                        value={t.monto}
                                                        onChange={(e) => handleTarjetaChange(t.id, 'monto', parseFloat(e.target.value) || 0)}
                                                        disabled={estado === 'cerrado'}
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 text-right font-mono"
                                                    />
                                                    </td>
                                                    {estado === 'abierto' && (
                                                        <td className="px-1.5 py-1 text-center" data-label="">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveTarjeta(t.id)}
                                                                className="p-0.5 text-slate-300 hover:text-red-500 transition-colors"
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 size={11} />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    {estado === 'abierto' && (
                                        <tfoot className="bg-slate-50 border-t border-slate-100">
                                            <tr>
                                                <td colSpan={7} className="px-2 py-1">
                                                    <div className="flex items-center justify-between">
                                                        <button
                                                            onClick={handleAddTarjetaRow}
                                                            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                                                        >
                                                            <Plus size={14} />
                                                            Agregar Tarjeta
                                                        </button>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-xs text-slate-500">
                                                                Total Tarjetas: <strong className="text-red-600 font-mono text-sm"><Money value={tarjetasTotal} /></strong>
                                                            </span>
                                                            <button
                                                                onClick={() => {
                                                                    const sinDesp = tarjetas.filter(t => !t.despachador_id);
                                                                    if (sinDesp.length > 0) {
                                                                        toast.error('Todas las tarjetas deben tener un despachador asignado');
                                                                        return;
                                                                    }
                                                                    saveTarjetasMutation.mutate(tarjetas);
                                                                }}
                                                                disabled={saveTarjetasMutation.isPending}
                                                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50"
                                                            >
                                                                {saveTarjetasMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                                {saveTarjetasMutation.isPending ? 'Guardando...' : 'Guardar Tarjetas'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {showLubricantesModal && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={() => { setShowLubricantesModal(false); setEditAnterior(false); }} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-5xl min-h-[50vh] max-h-[90vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Droplets size={16} className="text-indigo-600" />
                                    Lecturas de Lubricantes
                                    {estado === 'cerrado' && (
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Solo lectura</span>
                                    )}
                                </h3>
                                <button
                                    onClick={() => { setShowLubricantesModal(false); setEditAnterior(false); }}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="overflow-auto px-4 pb-4 flex-1 relative">
                                <table className="w-full text-left border-separate border-spacing-0 table-cards">
                                    <thead className="sticky top-0 z-20">
                                        <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100">Código</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 max-w-[140px]">Descripción</th>
                                            <th className={`px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-28 ${editAnterior ? 'text-amber-600' : ''}`}>
                                                Inicial{editAnterior && '*'}
                                            </th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-28">Recarga</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-28">Final</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-28">Ventas</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-24">Precio</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-28">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {lubricantReadings.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="px-3 py-8 text-center text-xs text-slate-400">
                                                    No hay productos de lubricantes configurados.
                                                </td>
                                            </tr>
                                        )}
                                        {lubricantReadings.map((r, idx) => {
                                            const ventas = parseFloat(r.lectura_inicial || 0) + parseFloat(r.recarga || 0) - parseFloat(r.lectura_final || 0);
                                            const total = ventas * parseFloat(r.precio || 0);
                                            return (
                                                <tr key={r.producto_id} className="hover:bg-slate-50 transition-colors text-[11px]">
                                                    <td className="px-1.5 py-0.5 font-bold text-slate-900" data-label="Código">{r.producto_codigo}</td>
                                                    <td className="px-1.5 py-0.5 max-w-[140px] truncate" data-label="Descripción">
                                                        <span className="font-medium text-slate-800">{r.producto_descripcion}</span>
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-right" data-label="Inicial">
                                                        {editAnterior ? (
                                                            <input type="number" step="0.00001"
                                                                ref={(el) => { lubricantInputRefs.current[`lub-anterior-${r.producto_id}`] = el; }}
                                                                value={r.lectura_inicial ?? ''}
                                                                onChange={(e) => {
                                                                    setLubricantReadings(prev => prev.map(x =>
                                                                        x.producto_id === r.producto_id
                                                                            ? { ...x, lectura_inicial: e.target.value }
                                                                            : x
                                                                    ));
                                                                }}
                                                                onFocus={(e) => e.target.select()}
                                                                onBlur={handleLubricantBlur}
                                                                onKeyDown={(e) => handleLubricantKeyDown(e, idx, 'lectura_inicial')}
                                                                disabled={estado === 'cerrado'}
                                                                className={`${estado === 'cerrado' ? inputDisabledCls : inputCls} ml-auto`}
                                                            />
                                                        ) : (
                                                            <span className="font-mono text-slate-600 whitespace-nowrap">{parseFloat(r.lectura_inicial || 0).toFixed(5)}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-right" data-label="Recarga">
                                                        <input type="number" step="0.00001"
                                                            ref={(el) => { lubricantInputRefs.current[`lub-recarga-${r.producto_id}`] = el; }}
                                                            value={r.recarga ?? ''}
                                                            onChange={(e) => {
                                                                setLubricantReadings(prev => prev.map(x =>
                                                                    x.producto_id === r.producto_id
                                                                        ? { ...x, recarga: e.target.value }
                                                                        : x
                                                                ));
                                                            }}
                                                            onFocus={(e) => e.target.select()}
                                                            onBlur={handleLubricantBlur}
                                                            onKeyDown={(e) => handleLubricantKeyDown(e, idx, 'recarga')}
                                                            disabled={estado === 'cerrado'}
                                                            className={estado === 'cerrado' ? inputDisabledCls : inputCls}
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-right" data-label="Final">
                                                        <input type="number" step="0.00001"
                                                            ref={(el) => { lubricantInputRefs.current[`lub-final-${r.producto_id}`] = el; }}
                                                            value={r.lectura_final ?? ''}
                                                            onChange={(e) => {
                                                                setLubricantReadings(prev => prev.map(x =>
                                                                    x.producto_id === r.producto_id
                                                                        ? { ...x, lectura_final: e.target.value }
                                                                        : x
                                                                ));
                                                            }}
                                                            onFocus={(e) => e.target.select()}
                                                            onBlur={handleLubricantBlur}
                                                            onKeyDown={(e) => handleLubricantKeyDown(e, idx, 'lectura_final')}
                                                            disabled={estado === 'cerrado'}
                                                            className={estado === 'cerrado' ? inputDisabledCls : inputCls}
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-right font-mono font-bold text-slate-800" data-label="Ventas">{ventas.toFixed(5)}</td>
                                                    <td className="px-1.5 py-0.5 text-right font-mono text-slate-700" data-label="Precio"><Money value={parseFloat(r.precio || 0)} /></td>
                                                    <td className="px-1.5 py-0.5 text-right font-mono font-bold text-slate-900" data-label="Total">
                                                        <Money value={total} />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className="bg-slate-50 border-t border-slate-100 text-xs font-bold">
                                        <tr>
                                            <td colSpan={7} className="px-3 py-1.5 text-right text-slate-600 uppercase tracking-wider">Total Lubricantes</td>
                                            <td className="px-3 py-1.5 text-right font-mono text-indigo-600">
                                                <Money value={lubricantTotal} />
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {showTankReadingsModal && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={() => { setShowTankReadingsModal(false); setEditAnterior(false); }} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-4xl min-h-[50vh] max-h-[90vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <FlaskConical size={16} className="text-indigo-600" />
                                    Lecturas por Tanque
                                    {estado === 'cerrado' && (
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Solo lectura</span>
                                    )}
                                </h3>
                                <button onClick={() => { setShowTankReadingsModal(false); setEditAnterior(false); }}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="overflow-auto px-4 pb-4 flex-1 relative">
                                <table className="w-full text-left border-separate border-spacing-0 table-cards">
                                    <thead className="sticky top-0 z-20">
                                        <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-14">Tanque</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 min-w-[120px]">Descripción</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-20">Capacidad</th>
                                            <th className={`px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-32 ${editAnterior ? 'text-amber-600' : ''}`}>
                                                Lect. Ant{editAnterior && '*'}
                                            </th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-28">Recarga</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-28">Lect. Actual</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-24">Difer</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {tankReadings.map((r, idx) => {
                                            const diferencia = (r.lectura_anterior || 0) + (r.recarga || 0) - (r.lectura_actual || 0);
                                            return (
                                                <tr key={r.tank_id} className="hover:bg-slate-50 transition-colors text-[11px]">
                                                    <td className="px-1.5 py-0.5 font-bold text-slate-900 whitespace-nowrap" data-label="Tanque">{r.codigo_tanque}</td>
                                                    <td className="px-1.5 py-0.5 truncate" data-label="Descripción">
                                                        <span className="font-medium text-slate-800">{r.descripcion_tanque}</span>
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-right font-mono text-slate-700 whitespace-nowrap" data-label="Capacidad">{parseFloat(r.capacidad || 0).toFixed(2)}</td>
                                                    <td className="px-1.5 py-0.5 text-right" data-label="Lect. Ant.">
                                                        {editAnterior ? (
                                                            <input
                                                                ref={el => { tankInputRefs.current[`anterior-${r.tank_id}`] = el; }}
                                                                type="number"
                                                                step="0.00001"
                                                                value={r.lectura_anterior || ''}
                                                                onChange={(e) => handleTankReadingChange(r.tank_id, 'lectura_anterior', e.target.value)}
                                                                onBlur={() => handleTankReadingBlur(r.id, r.tank_id)}
                                                                onKeyDown={(e) => handleTankKeyDown(e, idx, 'lectura_anterior')}
                                                                onFocus={(e) => e.target.select()}
                                                                disabled={estado === 'cerrado'}
                                                                className={`${estado === 'cerrado' ? inputDisabledCls : inputCls} ml-auto`}
                                                            />
                                                        ) : (
                                                            <span className="font-mono text-slate-500 whitespace-nowrap">{(r.lectura_anterior || 0).toFixed(5)}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-right" data-label="Recarga">
                                                        <input
                                                            ref={el => { tankInputRefs.current[`recarga-${r.tank_id}`] = el; }}
                                                            type="number"
                                                            step="0.00001"
                                                            value={r.recarga || ''}
                                                            onChange={(e) => handleTankReadingChange(r.tank_id, 'recarga', e.target.value)}
                                                            onBlur={() => handleTankReadingBlur(r.id, r.tank_id)}
                                                            onKeyDown={(e) => handleTankKeyDown(e, idx, 'recarga')}
                                                            onFocus={(e) => e.target.select()}
                                                            disabled={estado === 'cerrado'}
                                                            className={`${estado === 'cerrado' ? inputCalibDisabledCls : inputCalibCls} ml-auto`}
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-right" data-label="Lect. Actual">
                                                        <input
                                                            ref={el => { tankInputRefs.current[`lectura_actual-${r.tank_id}`] = el; }}
                                                            type="number"
                                                            step="0.00001"
                                                            value={r.lectura_actual || ''}
                                                            onChange={(e) => handleTankReadingChange(r.tank_id, 'lectura_actual', e.target.value)}
                                                            onBlur={() => handleTankReadingBlur(r.id, r.tank_id)}
                                                            onKeyDown={(e) => handleTankKeyDown(e, idx, 'lectura_actual')}
                                                            onFocus={(e) => e.target.select()}
                                                            disabled={estado === 'cerrado'}
                                                            className={`${estado === 'cerrado' ? inputDisabledCls : inputCls} ml-auto`}
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-right font-mono font-bold text-indigo-600 whitespace-nowrap" data-label="Difer.">{diferencia.toFixed(5)}</td>
                                                </tr>
                                            );
                                        })}
                                        {tankReadings.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="px-3 py-8 text-center text-xs text-slate-400">
                                                    No hay tanques registrados.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {showCreditosModal && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={() => setShowCreditosModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-6xl min-h-[50vh] max-h-[95vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <CreditCard size={16} className="text-indigo-600" />
                                    Créditos del Turno
                                    {estado === 'cerrado' && (
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Solo lectura</span>
                                    )}
                                </h3>
                                <button
                                    onClick={() => setShowCreditosModal(false)}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="overflow-auto px-4 pb-4 flex-1">
                                <table className="w-full text-left border-collapse table-cards">
                                    <thead>
                                        <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 sticky top-0 z-10">
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-24">Documento</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-16">Tipo</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-36">Cliente</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-28">Producto</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-44">Despachador</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20 text-right">Cantidad</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20 text-right">Precio</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20 text-right">Monto</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20">Placa</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20">Kilometraje</th>
                                            {estado === 'abierto' && <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-6"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 text-[11px]">
                                        {creditos.length === 0 && (
                                            <tr>
                                                <td colSpan={estado === 'abierto' ? 12 : 11} className="px-2 py-3 text-center text-[10px] text-slate-400">
                                                    Sin registros de créditos
                                                </td>
                                            </tr>
                                        )}
                                        {creditos.map(c => {
                                            return (
                                                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-1.5 py-1" data-label="Documento">
                                                        <input
                                                            type="text"
                                                            value={c.documento}
                                                            placeholder="Documento"
                                                            onChange={(e) => handleCreditoChange(c.id, 'documento', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Tipo">
                                                        <select
                                                            value={c.tipo_documento || 'FAC'}
                                                            onChange={(e) => handleCreditoChange(c.id, 'tipo_documento', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            <option value="FAC">FAC</option>
                                                            <option value="CCF">CCF</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Cliente">
                                                        <SearchableSelect
                                                            loadOptions={loadCustomers({ es_credito: 1 })}
                                                            value={c.cliente_id}
                                                            onChange={(e, opt) => {
                                                                handleCreditoChange(c.id, 'cliente_id', e.target.value);
                                                                handleCreditoChange(c.id, 'cliente_nombre', opt ? opt.nombre : '');
                                                            }}
                                                            disabled={estado === 'cerrado'}
                                                            placeholder="Buscar cliente..."
                                                            valueKey="id"
                                                            labelKey="nombre"
                                                            displayKey="nombre"
                                                            codeKey="nrc"
                                                            codeLabel="NRC"
                                                            selectedLabel={c.cliente_nombre}
                                                            dropdownWidth={420}
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Producto">
                                                        <select
                                                            value={c.producto_codigo}
                                                            onChange={(e) => {
                                                                const cod = e.target.value;
                                                                const prod = fuelProducts.find(p => p.codigo === cod);
                                                                handleCreditoChange(c.id, 'producto_codigo', cod);
                                                                handleCreditoChange(c.id, 'producto_descripcion', prod ? prod.descripcion : '');
                                                            }}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            <option value="">Seleccionar...</option>
                                                            {fuelProducts.map(p => (
                                                                <option key={p.codigo} value={p.codigo}>{p.codigo} — {p.descripcion}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Despachador">
                                                        <select
                                                            value={c.despachador_id || ''}
                                                            onChange={(e) => handleCreditoChange(c.id, 'despachador_id', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            {allDespachadores.length === 0 && <option value="">Sin despachador</option>}
                                                            {allDespachadores.map(d => (
                                                                <option key={d.id} value={d.id}>{d.codigo} — {d.descripcion}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Cantidad">
                                                        <input
                                                            type="number"
                                                            step="0.00001"
                                                            min="0"
                                                            value={c.cantidad}
                                                            onChange={(e) => {
                                                                const cant = parseFloat(e.target.value) || 0;
                                                                handleCreditoChange(c.id, 'cantidad', cant);
                                                                const monto = parseFloat(c.monto) || 0;
                                                                handleCreditoChange(c.id, 'precio', cant > 0 ? monto / cant : 0);
                                                            }}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 text-right font-mono"
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1 text-right font-mono font-bold text-indigo-600" data-label="Precio">
                                                        {parseFloat(c.cantidad) > 0 ? <Money value={parseFloat(c.monto) / parseFloat(c.cantidad)} /> : <Money value={0} />}
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Monto">
                                                    <MoneyInput
                                                        step="0.01"
                                                        min="0"
                                                        value={c.monto}
                                                        onChange={(e) => {
                                                            const monto = parseFloat(e.target.value) || 0;
                                                            handleCreditoChange(c.id, 'monto', monto);
                                                            const cant = parseFloat(c.cantidad) || 0;
                                                            handleCreditoChange(c.id, 'precio', cant > 0 ? monto / cant : 0);
                                                        }}
                                                        disabled={estado === 'cerrado'}
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 text-right font-mono"
                                                    />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Placa">
                                                        <input
                                                            type="text"
                                                            value={c.placa}
                                                            placeholder="Placa"
                                                            onChange={(e) => handleCreditoChange(c.id, 'placa', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Kilometraje">
                                                        <input
                                                            type="text"
                                                            value={c.kilometraje}
                                                            placeholder="KM"
                                                            onChange={(e) => handleCreditoChange(c.id, 'kilometraje', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        />
                                                    </td>
                                                    {estado === 'abierto' && (
                                                        <td className="px-1.5 py-1 text-center" data-label="">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveCredito(c.id)}
                                                                className="p-0.5 text-slate-300 hover:text-red-500 transition-colors"
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 size={11} />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    {estado === 'abierto' && (
                                        <tfoot className="bg-slate-50 border-t border-slate-100">
                                            <tr>
                                                <td colSpan={12} className="px-2 py-1">
                                                    <div className="flex items-center justify-between">
                                                        <button
                                                            onClick={handleAddCreditoRow}
                                                            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                                                        >
                                                            <Plus size={14} />
                                                            Agregar Crédito
                                                        </button>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-xs text-slate-500">
                                                                Total Créditos: <strong className="text-red-600 font-mono text-sm"><Money value={creditosTotal} /></strong>
                                                            </span>
                                                            <button
                                                                onClick={() => {
                                                                    const sinDesp = creditos.filter(c => !c.despachador_id);
                                                                    if (sinDesp.length > 0) {
                                                                        toast.error('Todos los créditos deben tener un despachador asignado');
                                                                        return;
                                                                    }
                                                                    saveCreditosMutation.mutate(creditos);
                                                                }}
                                                                disabled={saveCreditosMutation.isPending}
                                                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50"
                                                            >
                                                                {saveCreditosMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                                {saveCreditosMutation.isPending ? 'Guardando...' : 'Guardar Créditos'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {showValesModal && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={() => setShowValesModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-6xl min-h-[50vh] max-h-[95vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Gift size={16} className="text-indigo-600" />
                                    Vales del Turno
                                    {estado === 'cerrado' && (
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Solo lectura</span>
                                    )}
                                </h3>
                                <button
                                    onClick={() => setShowValesModal(false)}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="overflow-auto px-4 pb-4 flex-1">
                                <table className="w-full text-left border-collapse table-cards">
                                    <thead>
                                        <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 sticky top-0 z-10">
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-24">Documento</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-16">Tipo</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-36">Cliente</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-28">Producto</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-44">Despachador</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20 text-right">Cantidad</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20 text-right">Precio</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20 text-right">Monto</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20">Placa</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20">Kilometraje</th>
                                            {estado === 'abierto' && <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-6"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 text-[11px]">
                                        {vales.length === 0 && (
                                            <tr>
                                                <td colSpan={estado === 'abierto' ? 12 : 11} className="px-2 py-3 text-center text-[10px] text-slate-400">
                                                    Sin registros de vales
                                                </td>
                                            </tr>
                                        )}
                                        {vales.map(v => {
                                            return (
                                                <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-1.5 py-1" data-label="Documento">
                                                        <input
                                                            type="text"
                                                            value={v.documento}
                                                            placeholder="Documento"
                                                            onChange={(e) => handleValeChange(v.id, 'documento', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Tipo">
                                                        <select
                                                            value={v.tipo_documento || 'FAC'}
                                                            onChange={(e) => handleValeChange(v.id, 'tipo_documento', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            <option value="FAC">FAC</option>
                                                            <option value="CCF">CCF</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Cliente">
                                                        <SearchableSelect
                                                            loadOptions={loadCustomers({ es_credito: 1 })}
                                                            value={v.cliente_id}
                                                            onChange={(e, opt) => {
                                                                handleValeChange(v.id, 'cliente_id', e.target.value);
                                                                handleValeChange(v.id, 'cliente_nombre', opt ? opt.nombre : '');
                                                            }}
                                                            disabled={estado === 'cerrado'}
                                                            placeholder="Buscar cliente..."
                                                            valueKey="id"
                                                            labelKey="nombre"
                                                            displayKey="nombre"
                                                            codeKey="nrc"
                                                            codeLabel="NRC"
                                                            selectedLabel={v.cliente_nombre}
                                                            dropdownWidth={420}
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Producto">
                                                        <select
                                                            value={v.producto_codigo}
                                                            onChange={(e) => {
                                                                const cod = e.target.value;
                                                                const prod = fuelProducts.find(p => p.codigo === cod);
                                                                handleValeChange(v.id, 'producto_codigo', cod);
                                                                handleValeChange(v.id, 'producto_descripcion', prod ? prod.descripcion : '');
                                                            }}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            <option value="">Seleccionar...</option>
                                                            {fuelProducts.map(p => (
                                                                <option key={p.codigo} value={p.codigo}>{p.codigo} — {p.descripcion}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Despachador">
                                                        <select
                                                            value={v.despachador_id || ''}
                                                            onChange={(e) => handleValeChange(v.id, 'despachador_id', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            {allDespachadores.length === 0 && <option value="">Sin despachador</option>}
                                                            {allDespachadores.map(d => (
                                                                <option key={d.id} value={d.id}>{d.codigo} — {d.descripcion}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Cantidad">
                                                        <input
                                                            type="number"
                                                            step="0.00001"
                                                            min="0"
                                                            value={v.cantidad}
                                                            onChange={(e) => {
                                                                const cant = parseFloat(e.target.value) || 0;
                                                                handleValeChange(v.id, 'cantidad', cant);
                                                                const monto = parseFloat(v.monto) || 0;
                                                                handleValeChange(v.id, 'precio', cant > 0 ? monto / cant : 0);
                                                            }}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 text-right font-mono"
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1 text-right font-mono font-bold text-indigo-600" data-label="Precio">
                                                        {parseFloat(v.cantidad) > 0 ? <Money value={parseFloat(v.monto) / parseFloat(v.cantidad)} /> : <Money value={0} />}
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Monto">
                                                    <MoneyInput
                                                        step="0.01"
                                                        min="0"
                                                        value={v.monto}
                                                        onChange={(e) => {
                                                            const monto = parseFloat(e.target.value) || 0;
                                                            handleValeChange(v.id, 'monto', monto);
                                                            const cant = parseFloat(v.cantidad) || 0;
                                                            handleValeChange(v.id, 'precio', cant > 0 ? monto / cant : 0);
                                                        }}
                                                        disabled={estado === 'cerrado'}
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 text-right font-mono"
                                                    />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Placa">
                                                        <input
                                                            type="text"
                                                            value={v.placa}
                                                            placeholder="Placa"
                                                            onChange={(e) => handleValeChange(v.id, 'placa', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Kilometraje">
                                                        <input
                                                            type="text"
                                                            value={v.kilometraje}
                                                            placeholder="KM"
                                                            onChange={(e) => handleValeChange(v.id, 'kilometraje', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        />
                                                    </td>
                                                    {estado === 'abierto' && (
                                                        <td className="px-1.5 py-1 text-center" data-label="">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveVale(v.id)}
                                                                className="p-0.5 text-slate-300 hover:text-red-500 transition-colors"
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 size={11} />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    {estado === 'abierto' && (
                                        <tfoot className="bg-slate-50 border-t border-slate-100">
                                            <tr>
                                                <td colSpan={12} className="px-2 py-1">
                                                    <div className="flex items-center justify-between">
                                                        <button
                                                            onClick={handleAddValeRow}
                                                            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                                                        >
                                                            <Plus size={14} />
                                                            Agregar Vale
                                                        </button>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-xs text-slate-500">
                                                                Total Vales: <strong className="text-red-600 font-mono text-sm"><Money value={valesTotal} /></strong>
                                                            </span>
                                                            <button
                                                                onClick={() => {
                                                                    const sinDesp = vales.filter(v => !v.despachador_id);
                                                                    if (sinDesp.length > 0) {
                                                                        toast.error('Todos los vales deben tener un despachador asignado');
                                                                        return;
                                                                    }
                                                                    saveValesMutation.mutate(vales);
                                                                }}
                                                                disabled={saveValesMutation.isPending}
                                                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50"
                                                            >
                                                                {saveValesMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                                {saveValesMutation.isPending ? 'Guardando...' : 'Guardar Vales'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {showDiferenciasModal && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={() => { setShowDiferenciasModal(false); setDiferenciasData(null); }} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-5xl max-h-[90vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <BarChart3 size={16} className="text-indigo-600" />
                                    Lecturas vs Ventas
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                        {toDateStrDDMMYYYY(editData?.fecha_turno || fechaTurno) || '—'} — Turno #{numeroTurno}
                                    </span>
                                </h3>
                                <button
                                    onClick={() => { setShowDiferenciasModal(false); setDiferenciasData(null); }}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="overflow-auto px-4 pb-4 flex-1">
                                <div className="flex flex-wrap items-center gap-3 mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Enviar a turno</span>
                                            {dayShiftsQuery.isLoading ? (
                                                <span className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                                                    <Loader2 size={12} className="animate-spin" /> Cargando turnos...
                                                </span>
                                            ) : (dayShiftsQuery.data?.data || []).length === 0 ? (
                                                <span className="flex items-center gap-2 text-[11px] font-bold text-amber-700">
                                                    <AlertTriangle size={12} /> No hay turnos para esta fecha en la sucursal
                                                </span>
                                            ) : (
                                                <>
                                                    <select
                                                        value={targetShiftId}
                                                        onChange={e => setTargetShiftId(e.target.value)}
                                                        className="text-[12px] font-bold text-slate-700 border border-slate-200 rounded-xl px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                                    >
                                                        <option value="">Seleccione un turno</option>
                                                        {dayShiftsQuery.data.data.map(s => (
                                                            <option key={s.id} value={s.id}>
                                                                Turno #{s.shift_number} — {toDateStrDDMMYYYY(s.shift_date)}{formatHora(s.start_time) ? ` ${formatHora(s.start_time)}` : ''} — {s.pos_name}{s.seller_name ? ` — ${s.seller_name}` : ''} — {shiftEstado(s)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {selectedTargetShift && (
                                                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-tight">
                                                            Las complementarias se asignarán a este turno
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        {diferenciasLoading ? (
                                            <div className="flex items-center justify-center py-16">
                                                <Loader2 size={24} className="animate-spin text-indigo-600" />
                                                <span className="ml-3 text-sm font-medium text-slate-500">Cargando datos...</span>
                                            </div>
                                        ) : !diferenciasData ? (
                                            <div className="flex items-center justify-center py-16">
                                                <BarChart3 size={18} className="text-slate-400" />
                                                <span className="ml-3 text-sm font-medium text-slate-500">Seleccione un turno para ver las ventas y diferencias</span>
                                            </div>
                                        ) : (
                                            <>
                                                <table className="w-full text-left border-collapse mt-3 table-cards">
                                            <thead>
                                                <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 sticky top-0 z-10">
                                                    <th className="px-2 py-1 bg-slate-50 border-b border-slate-100">Código</th>
                                                    <th className="px-2 py-1 bg-slate-50 border-b border-slate-100">Producto</th>
                                                    <th className="px-2 py-1 bg-slate-50 border-b border-slate-100 text-right">Precio</th>
                                                    <th className="px-2 py-1 bg-slate-50 border-b border-slate-100 text-right">Lectura (Gl)</th>
                                                    <th className="px-2 py-1 bg-slate-50 border-b border-slate-100 text-right">Lectura ($)</th>
                                                    <th className="px-2 py-1 bg-slate-50 border-b border-slate-100 text-right">Venta (Gl)</th>
                                                    <th className="px-2 py-1 bg-slate-50 border-b border-slate-100 text-right">Venta ($)</th>
                                                    <th className="px-2 py-1 bg-slate-50 border-b border-slate-100 text-right">Dif. (Gl)</th>
                                                    <th className="px-2 py-1 bg-slate-50 border-b border-slate-100 text-right">Dif. ($)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 text-[11px]">
                                                {diferenciasData.data.map((row, i) => (
                                                    <tr key={i} className={`hover:bg-slate-50 transition-colors ${parseFloat(row.diferencia_monto) > 0 ? 'bg-amber-50/50' : ''}`}>
                                                        <td className="px-2 py-1 font-bold text-slate-700" data-label="Código">{row.codigo_producto}</td>
                                                        <td className="px-2 py-1 text-slate-600" data-label="Producto">{row.descripcion_producto}</td>
                                                        <td className="px-2 py-1 text-right font-mono text-slate-700" data-label="Precio"><Money value={parseFloat(row.precio)} /></td>
                                                        <td className="px-2 py-1 text-right font-mono text-slate-700" data-label="Lectura (Gl)">{parseFloat(row.lectura_galones).toFixed(5)}</td>
                                                        <td className="px-2 py-1 text-right font-mono text-slate-700" data-label="Lectura ($)"><Money value={parseFloat(row.lectura_monto)} /></td>
                                                        <td className="px-2 py-1 text-right font-mono text-slate-700" data-label="Venta (Gl)">{parseFloat(row.venta_galones).toFixed(5)}</td>
                                                        <td className="px-2 py-1 text-right font-mono text-slate-700" data-label="Venta ($)"><Money value={parseFloat(row.venta_monto)} /></td>
                                                        <td className={`px-2 py-1 text-right font-mono font-bold ${parseFloat(row.diferencia_galones) > 0 ? 'text-red-600' : parseFloat(row.diferencia_galones) < 0 ? 'text-emerald-600' : 'text-slate-500'}`} data-label="Dif. (Gl)">
                                                            {parseFloat(row.diferencia_galones).toFixed(5)}
                                                        </td>
                                                        <td className={`px-2 py-1 text-right font-mono font-bold ${parseFloat(row.diferencia_monto) > 0 ? 'text-red-600' : parseFloat(row.diferencia_monto) < 0 ? 'text-emerald-600' : 'text-slate-500'}`} data-label="Dif. ($)">
                                                            <Money value={parseFloat(row.diferencia_monto)} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-slate-50 border-t-2 border-slate-200 text-xs font-bold">
                                                <tr>
                                                    <td colSpan={3} className="px-2 py-1.5 text-right text-slate-600 uppercase tracking-wider">Totales</td>
                                                    <td className="px-2 py-1.5 text-right font-mono text-slate-800">{diferenciasData.totales.lectura_galones.toFixed(5)}</td>
                                                    <td className="px-2 py-1.5 text-right font-mono text-slate-800"><Money value={diferenciasData.totales.lectura_monto} /></td>
                                                    <td className="px-2 py-1.5 text-right font-mono text-slate-800">{diferenciasData.totales.venta_galones.toFixed(5)}</td>
                                                    <td className="px-2 py-1.5 text-right font-mono text-slate-800"><Money value={diferenciasData.totales.venta_monto} /></td>
                                                    <td className={`px-2 py-1.5 text-right font-mono ${diferenciasData.totales.diferencia_galones > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                        {diferenciasData.totales.diferencia_galones.toFixed(5)}
                                                    </td>
                                                    <td className={`px-2 py-1.5 text-right font-mono ${diferenciasData.totales.diferencia_monto > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                        <Money value={diferenciasData.totales.diferencia_monto} />
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                        <div className="mt-4 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                                            <span className="text-xs text-slate-500">
                                                Diferencias Positivas: <strong className="text-red-600 font-mono">
                                                    <Money value={diferenciasData.totales.diferencia_monto > 0 ? diferenciasData.totales.diferencia_monto : 0} />
                                                </strong>
                                            </span>
                                            <button
                                                onClick={() => setShowConfirmComplementaria(true)}
                                                disabled={generarComplementariaMutation.isPending || diferenciasData.totales.diferencia_monto <= 0 || !targetShiftId}
                                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50 shadow-lg"
                                            >
                                                {generarComplementariaMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                                                {generarComplementariaMutation.isPending ? 'Generando...' : 'Generar DTE Complementaria'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {showConfirmComplementaria && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={() => setShowConfirmComplementaria(false)} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-2xl max-h-[90vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <AlertTriangle size={16} className="text-amber-500" />
                                    Confirmar Generación de Complementarias
                                </h3>
                                <button onClick={() => setShowConfirmComplementaria(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="overflow-auto px-4 py-3 flex-1">
                                {(() => {
                                    const TASA_FOVIAL = 0.20;
                                    const TASA_COTRANS = 0.10;
                                    const productos = (diferenciasData?.data || []).filter(r => parseFloat(r.diferencia_galones) > 0);
                                    const totalMontoBruto = productos.reduce((s, r) => s + (parseFloat(r.diferencia_galones) * parseFloat(r.precio)), 0);
                                    const totalFovial = productos.reduce((s, r) => s + (parseFloat(r.diferencia_galones) * TASA_FOVIAL), 0);
                                    const totalCotran = productos.reduce((s, r) => s + (parseFloat(r.diferencia_galones) * TASA_COTRANS), 0);
                                    const totalBaseGrav = totalMontoBruto - totalFovial - totalCotran;
                                    return (
                                        <>
                                            <p className="text-xs text-slate-600 mb-3">
                                                Se generará <strong className="text-slate-800">{productos.length} DTE{productos.length !== 1 ? 's' : ''}</strong> de tipo Factura Consumidor Final (CF), uno por cada producto con diferencia positiva:
                                            </p>
                                            {selectedTargetShift && (
                                                <p className="text-[11px] font-bold text-indigo-600 mb-3 flex items-center gap-2">
                                                    <Calendar size={12} />
                                                    Se enviarán al Turno #{selectedTargetShift.shift_number} — {toDateStrDDMMYYYY(selectedTargetShift.shift_date)}{formatHora(selectedTargetShift.start_time) ? ` ${formatHora(selectedTargetShift.start_time)}` : ''} — {selectedTargetShift.pos_name}{selectedTargetShift.seller_name ? ` — ${selectedTargetShift.seller_name}` : ''} — {shiftEstado(selectedTargetShift)}
                                                </p>
                                            )}
                                            <table className="w-full text-left border-collapse text-[11px] table-cards">
                                                <thead>
                                                    <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200">
                                                        <th className="px-2 py-1">Producto</th>
                                                        <th className="px-2 py-1 text-right">Dif. (Gl)</th>
                                                        <th className="px-2 py-1 text-right">Precio/Gal</th>
                                                        <th className="px-2 py-1 text-right">Monto Bruto</th>
                                                        <th className="px-2 py-1 text-right">FOVIAL</th>
                                                        <th className="px-2 py-1 text-right">COTRANS</th>
                                                        <th className="px-2 py-1 text-right">Base Gravable</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {productos.map((row, i) => {
                                                        const gl = parseFloat(row.diferencia_galones) || 0;
                                                        const precio = parseFloat(row.precio) || 0;
                                                        const montoBruto = gl * precio;
                                                        const fovial = gl * TASA_FOVIAL;
                                                        const cotrans = gl * TASA_COTRANS;
                                                        const baseGrav = montoBruto - fovial - cotrans;
                                                        return (
                                                            <tr key={i} className="hover:bg-slate-50">
                                                                <td className="px-2 py-1.5 font-medium text-slate-700" data-label="Producto">{row.descripcion_producto}</td>
                                                                <td className="px-2 py-1.5 text-right font-mono text-slate-600" data-label="Dif. (Gl)">{gl.toFixed(5)}</td>
                                                                <td className="px-2 py-1.5 text-right font-mono text-slate-600" data-label="Precio/Gal"><Money value={precio} /></td>
                                                                <td className="px-2 py-1.5 text-right font-mono text-slate-600" data-label="Monto Bruto"><Money value={montoBruto} /></td>
                                                                <td className="px-2 py-1.5 text-right font-mono text-slate-600" data-label="FOVIAL"><Money value={fovial} /></td>
                                                                <td className="px-2 py-1.5 text-right font-mono text-slate-600" data-label="COTRANS"><Money value={cotrans} /></td>
                                                                <td className="px-2 py-1.5 text-right font-mono font-bold text-slate-800" data-label="Base Gravable"><Money value={baseGrav} /></td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot className="bg-slate-50 border-t-2 border-slate-200 text-xs font-bold">
                                                    <tr>
                                                        <td className="px-2 py-1.5 text-slate-600 uppercase tracking-wider">
                                                            {productos.length} DTE{productos.length !== 1 ? 's' : ''}
                                                        </td>
                                                        <td></td>
                                                        <td></td>
                                                        <td className="px-2 py-1.5 text-right font-mono text-slate-800"><Money value={totalMontoBruto} /></td>
                                                        <td className="px-2 py-1.5 text-right font-mono text-slate-800"><Money value={totalFovial} /></td>
                                                        <td className="px-2 py-1.5 text-right font-mono text-slate-800"><Money value={totalCotran} /></td>
                                                        <td className="px-2 py-1.5 text-right font-mono text-slate-800"><Money value={totalBaseGrav} /></td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                            <div className="mt-4 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                                                <button
                                                    onClick={() => setShowConfirmComplementaria(false)}
                                                    className="px-4 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={() => generarComplementariaMutation.mutate({ shift_id: targetShiftId })}
                                                    disabled={generarComplementariaMutation.isPending}
                                                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50 shadow-lg"
                                                >
                                                    {generarComplementariaMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                                                    {generarComplementariaMutation.isPending ? 'Generando...' : 'Confirmar y Generar'}
                                                </button>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}

                {showAnticiposModal && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={() => setShowAnticiposModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-6xl min-h-[50vh] max-h-[95vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Truck size={16} className="text-indigo-600" />
                                    Anticipos Despachados del Turno
                                    {estado === 'cerrado' && (
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Solo lectura</span>
                                    )}
                                </h3>
                                <button
                                    onClick={() => setShowAnticiposModal(false)}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="overflow-auto px-4 pb-4 flex-1">
                                <table className="w-full text-left border-collapse table-cards">
                                    <thead>
                                        <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 sticky top-0 z-10">
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-28">Cliente</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20">Saldo Disp.</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-24">Documento</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-16">Tipo</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-28">Producto</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-44">Despachador</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20 text-right">Cantidad</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20 text-right">Precio</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20 text-right">Monto</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20">Placa</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20">Kilometraje</th>
                                            {estado === 'abierto' && <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-6"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 text-[11px]">
                                        {anticiposDesp.length === 0 && (
                                            <tr>
                                                <td colSpan={estado === 'abierto' ? 13 : 12} className="px-2 py-3 text-center text-[10px] text-slate-400">
                                                    Sin registros de anticipos despachados
                                                </td>
                                            </tr>
                                        )}
                                        {anticiposDesp.map(a => {
                                            const excedeSaldo = parseFloat(a.monto) > 0 && parseFloat(a.saldo_disponible) > 0 && parseFloat(a.monto) > parseFloat(a.saldo_disponible);
                                            return (
                                                <tr key={a.id} className={`hover:bg-slate-50 transition-colors ${excedeSaldo ? 'bg-red-50' : ''}`}>
                                                    <td className="px-1.5 py-1" data-label="Cliente">
                                                        <SearchableSelect
                                                            loadOptions={loadCustomers({ es_anticipado: 1 })}
                                                            value={a.cliente_id}
                                                            onChange={(e, opt) => {
                                                                handleAnticipoClienteChange(a.id, e.target.value);
                                                                if (opt) handleAnticipoChange(a.id, 'cliente_nombre', opt.nombre);
                                                            }}
                                                            disabled={estado === 'cerrado'}
                                                            placeholder="Buscar cliente..."
                                                            valueKey="id"
                                                            labelKey="nombre"
                                                            displayKey="nombre"
                                                            codeKey="nrc"
                                                            codeLabel="NRC"
                                                            selectedLabel={a.cliente_nombre}
                                                            dropdownWidth={420}
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1 text-center font-mono font-bold text-xs" data-label="Saldo Disp.">
                                                        {a.cliente_id ? (
                                                            <span className={`${parseFloat(a.saldo_disponible) && parseFloat(a.monto) > parseFloat(a.saldo_disponible) ? 'text-red-600' : 'text-indigo-600'}`}>
                                                                <Money value={parseFloat(a.saldo_disponible || 0)} />
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300">---</span>
                                                        )}
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Documento">
                                                        <input
                                                            type="text"
                                                            value={a.documento}
                                                            placeholder="Documento"
                                                            onChange={(e) => handleAnticipoChange(a.id, 'documento', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Tipo">
                                                        <select
                                                            value={a.tipo_documento || 'FAC'}
                                                            onChange={(e) => handleAnticipoChange(a.id, 'tipo_documento', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            <option value="FAC">FAC</option>
                                                            <option value="CCF">CCF</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Producto">
                                                        <select
                                                            value={a.producto_codigo}
                                                            onChange={(e) => {
                                                                const cod = e.target.value;
                                                                const prod = fuelProducts.find(p => p.codigo === cod);
                                                                handleAnticipoChange(a.id, 'producto_codigo', cod);
                                                                handleAnticipoChange(a.id, 'producto_descripcion', prod ? prod.descripcion : '');
                                                            }}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            <option value="">Seleccionar...</option>
                                                            {fuelProducts.map(p => (
                                                                <option key={p.codigo} value={p.codigo}>{p.codigo} — {p.descripcion}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Despachador">
                                                        <select
                                                            value={a.despachador_id || ''}
                                                            onChange={(e) => handleAnticipoChange(a.id, 'despachador_id', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            {allDespachadores.length === 0 && <option value="">Sin despachador</option>}
                                                            {allDespachadores.map(d => (
                                                                <option key={d.id} value={d.id}>{d.codigo} — {d.descripcion}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Cantidad">
                                                        <input
                                                            type="number"
                                                            step="0.00001"
                                                            min="0"
                                                            value={a.cantidad}
                                                            onChange={(e) => {
                                                                const cant = parseFloat(e.target.value) || 0;
                                                                handleAnticipoChange(a.id, 'cantidad', cant);
                                                                const monto = parseFloat(a.monto) || 0;
                                                                handleAnticipoChange(a.id, 'precio', cant > 0 ? monto / cant : 0);
                                                            }}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 text-right font-mono"
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1 text-right font-mono font-bold text-indigo-600" data-label="Precio">
                                                        {parseFloat(a.cantidad) > 0 ? <Money value={parseFloat(a.monto) / parseFloat(a.cantidad)} /> : <Money value={0} />}
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Monto">
                                                    <MoneyInput
                                                        step="0.01"
                                                        min="0"
                                                        value={a.monto}
                                                        onChange={(e) => {
                                                            const monto = parseFloat(e.target.value) || 0;
                                                            handleAnticipoChange(a.id, 'monto', monto);
                                                            const cant = parseFloat(a.cantidad) || 0;
                                                            handleAnticipoChange(a.id, 'precio', cant > 0 ? monto / cant : 0);
                                                        }}
                                                        disabled={estado === 'cerrado'}
                                                        className={`w-full bg-white border rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 text-right font-mono ${excedeSaldo ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                                                    />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Placa">
                                                        <input
                                                            type="text"
                                                            value={a.placa}
                                                            placeholder="Placa"
                                                            onChange={(e) => handleAnticipoChange(a.id, 'placa', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Kilometraje">
                                                        <input
                                                            type="text"
                                                            value={a.kilometraje}
                                                            placeholder="KM"
                                                            onChange={(e) => handleAnticipoChange(a.id, 'kilometraje', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        />
                                                    </td>
                                                    {estado === 'abierto' && (
                                                        <td className="px-1.5 py-1 text-center" data-label="">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveAnticipo(a.id)}
                                                                className="p-0.5 text-slate-300 hover:text-red-500 transition-colors"
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 size={11} />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    {estado === 'abierto' && (
                                        <tfoot className="bg-slate-50 border-t border-slate-100">
                                            <tr>
                                                <td colSpan={13} className="px-2 py-1">
                                                    <div className="flex items-center justify-between">
                                                        <button
                                                            onClick={handleAddAnticipoRow}
                                                            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                                                        >
                                                            <Plus size={14} />
                                                            Agregar Anticipo Despachado
                                                        </button>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-xs text-slate-500">
                                                                Total Anticipos: <strong className="text-red-600 font-mono text-sm"><Money value={anticiposDespTotal} /></strong>
                                                            </span>
                                                            <button
                                                                onClick={() => {
                                                                    const sinDesp = anticiposDesp.filter(a => !a.despachador_id);
                                                                    if (sinDesp.length > 0) {
                                                                        toast.error('Todos los anticipos deben tener un despachador asignado');
                                                                        return;
                                                                    }
                                                                    saveAnticiposDespMutation.mutate(anticiposDesp);
                                                                }}
                                                                disabled={saveAnticiposDespMutation.isPending}
                                                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50"
                                                            >
                                                                {saveAnticiposDespMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                                {saveAnticiposDespMutation.isPending ? 'Guardando...' : 'Guardar Anticipos'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    </div>
                )}
                {renderNozzleAssignModal()}
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
                                        value={d.nombre}
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
                                        className="p-1 text-slate-300 hover:text-red-500 transition-colors"
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
                                <option key={a.id} value={a.id}>{a.codigo} — {a.descripcion}</option>
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
            {renderNozzleAssignModal()}
        </div>
    );
};

export default GasCloseout;
