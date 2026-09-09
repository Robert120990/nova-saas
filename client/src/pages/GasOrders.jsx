import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Fuel,
    Search,
    RefreshCw,
    Calendar,
    Eye,
    X,
    Clock,
    CheckCircle2,
    AlertCircle,
    Info,
    FileText,
    CreditCard,
    Layers,
    PackageCheck,
    Check,
    Landmark,
    Plus,
    Trash2,
    ArrowLeftRight,
} from 'lucide-react';
import Money, { MoneyInput } from '../components/ui/Money';

function formatNumber(val) {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('es-SV', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(val) {
    if (!val) return '—';
    const s = String(val).substring(0, 10);
    const [y, m, d] = s.split('-');
    if (!y || !m || !d) return s;
    return `${d}/${m}/${y}`;
}

function calculateOrderCost(order) {
    if (!order) return 0;
    if (order.estado === 'RECIBIDO' && parseFloat(order.pago) > 0) {
        return parseFloat(order.pago);
    }
    const flete = parseFloat(order.flete) || 0;
    const isReceived = order.estado === 'RECIBIDO';
    const dGal = isReceived && parseFloat(order.r_diesel) > 0 ? parseFloat(order.r_diesel) : (parseFloat(order.p_diesel) || 0);
    const rGal = isReceived && parseFloat(order.r_regular) > 0 ? parseFloat(order.r_regular) : (parseFloat(order.p_regular) || 0);
    const sGal = isReceived && parseFloat(order.r_super) > 0 ? parseFloat(order.r_super) : (parseFloat(order.p_super) || 0);
    const iGal = isReceived && parseFloat(order.r_ion) > 0 ? parseFloat(order.r_ion) : (parseFloat(order.p_ion) || 0);

    const cD = (parseFloat(order.costo_d) || 0) + flete;
    const cR = (parseFloat(order.costo_r) || 0) + flete;
    const cS = (parseFloat(order.costo_s) || 0) + flete;
    const cI = (parseFloat(order.costo_i) || 0) + flete;

    return (dGal * cD) + (rGal * cR) + (sGal * cS) + (iGal * cI);
}

export default function GasOrders() {
    const queryClient = useQueryClient();

    const [statusFilter, setStatusFilter] = useState('PENDIENTE');
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Modal states
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [confirmSeenOrder, setConfirmSeenOrder] = useState(null);
    const [selectMethodOrder, setSelectMethodOrder] = useState(null); // Dialog asking Cheque vs Transferencia
    const [receivingOrder, setReceivingOrder] = useState(null);
    const [receiveMethod, setReceiveMethod] = useState('CHEQUE'); // 'CHEQUE' | 'TRANSFERENCIA'

    // General receive form state
    const [receiveForm, setReceiveForm] = useState({
        fecha_descarga: '',
        documento: '',
        observacion: '',
        ncr_numero: '',
        ncr_monto: '0.00',
        cupones: '0.00',
        r_diesel: '0',
        r_regular: '0',
        r_super: '0',
        r_ion: '0',
        costo_d: '0',
        costo_r: '0',
        costo_s: '0',
        costo_i: '0',
        flete: '0',
    });

    // Cheques subform and list state
    const [selectedBank, setSelectedBank] = useState('');
    const [chequesList, setChequesList] = useState([]);
    const [chequeForm, setChequeForm] = useState({
        numero_cuenta: '',
        cheque: '',
        valor: '0.00',
        concepto: '',
    });
    const [isValidatingCheque, setIsValidatingCheque] = useState(false);

    // Transfer subform state
    const [transferForm, setTransferForm] = useState({
        numero_cuenta: '',
        referencia: '',
        monto: '0.00',
        fecha_pago: '',
        concepto: '',
    });

    // Main orders query
    const { data: responseData, isLoading, isFetching, refetch } = useQuery({
        queryKey: ['gas-orders', statusFilter, searchTerm, startDate, endDate],
        queryFn: async () => {
            const params = {
                status: statusFilter,
                search: searchTerm,
                start_date: startDate || undefined,
                end_date: endDate || undefined,
            };
            const res = await axios.get('/api/gas-station/orders', { params });
            return res.data;
        },
        staleTime: 60 * 1000,
    });

    // Banks query for cheques
    const { data: banksData = [] } = useQuery({
        queryKey: ['gas-station-banks'],
        queryFn: async () => {
            const res = await axios.get('/api/gas-station/banks');
            return res.data?.data || [];
        },
        staleTime: 10 * 60 * 1000,
    });

    // Bank accounts query (all active accounts or filtered by bank)
    const { data: bankAccountsData = [] } = useQuery({
        queryKey: ['gas-station-accounts', selectedBank],
        queryFn: async () => {
            const params = selectedBank ? { bank_id: selectedBank } : {};
            const res = await axios.get('/api/gas-station/bank-accounts', { params });
            return res.data?.data || [];
        },
        staleTime: 5 * 60 * 1000,
    });

    // All active bank accounts (for transfer dropdown)
    const { data: allBankAccountsData = [] } = useQuery({
        queryKey: ['gas-station-all-accounts'],
        queryFn: async () => {
            const res = await axios.get('/api/gas-station/bank-accounts');
            return res.data?.data || [];
        },
        staleTime: 5 * 60 * 1000,
    });

    // Mark as Seen Mutation
    const markSeenMutation = useMutation({
        mutationFn: async (orderId) => {
            const res = await axios.patch(`/api/gas-station/orders/${orderId}/seen`);
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data?.message || 'Pedido marcado como visto exitosamente');
            queryClient.invalidateQueries({ queryKey: ['gas-orders'] });
            setConfirmSeenOrder(null);
            if (selectedOrder) {
                setSelectedOrder(prev => prev ? { ...prev, estado: 'VISTO' } : null);
            }
        },
        onError: (err) => {
            toast.error(err.response?.data?.error || 'Error al marcar como visto');
        }
    });

    // Receive Order Mutation
    const receiveOrderMutation = useMutation({
        mutationFn: async ({ orderId, payload }) => {
            const res = await axios.patch(`/api/gas-station/orders/${orderId}/receive`, payload);
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data?.message || 'Pedido recibido exitosamente');
            queryClient.invalidateQueries({ queryKey: ['gas-orders'] });
            setReceivingOrder(null);
            setSelectMethodOrder(null);
            if (selectedOrder) {
                setSelectedOrder(null);
            }
        },
        onError: (err) => {
            toast.error(err.response?.data?.error || 'Error al registrar recepción del pedido');
        }
    });

    const isUnconfigured = responseData?.unconfigured;
    const stationId = responseData?.stationId;
    const branchName = responseData?.branchName;
    const orders = responseData?.data || [];
    const summary = responseData?.summary || {
        totalOrders: 0,
        totalDiesel: 0,
        totalRegular: 0,
        totalSuper: 0,
        totalIon: 0,
        totalGallons: 0,
    };

    // Step 1: Open Method Selection dialog
    const handleInitiateReceive = (order) => {
        setSelectMethodOrder(order);
    };

    // Step 2: Open Receive Modal with chosen method
    const handleSelectReceiveMethod = async (method, order = selectMethodOrder) => {
        if (!order) return;
        setReceiveMethod(method);
        setSelectMethodOrder(null);

        const todaySv = new Date().toLocaleDateString('en-CA'); // 'YYYY-MM-DD'
        let defaultDate = todaySv;
        if (order.fecha_descarga && order.fecha_descarga.includes('/')) {
            const [d, m, y] = order.fecha_descarga.split('/');
            if (y && m && d) defaultDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }

        const pD = parseFloat(order.p_diesel) || 0;
        const pR = parseFloat(order.p_regular) || 0;
        const pS = parseFloat(order.p_super) || 0;
        const pI = parseFloat(order.p_ion) || 0;

        const rD = parseFloat(order.r_diesel) || 0;
        const rR = parseFloat(order.r_regular) || 0;
        const rS = parseFloat(order.r_super) || 0;
        const rI = parseFloat(order.r_ion) || 0;

        const docDefault = order.documento || '';
        const galD = rD > 0 ? rD : pD;
        const galR = rR > 0 ? rR : pR;
        const galS = rS > 0 ? rS : pS;
        const galI = rI > 0 ? rI : pI;

        const costD = order.costo_d !== undefined && order.costo_d !== null ? parseFloat(order.costo_d) || 0 : 0;
        const costR = order.costo_r !== undefined && order.costo_r !== null ? parseFloat(order.costo_r) || 0 : 0;
        const costS = order.costo_s !== undefined && order.costo_s !== null ? parseFloat(order.costo_s) || 0 : 0;
        const costI = order.costo_i !== undefined && order.costo_i !== null ? parseFloat(order.costo_i) || 0 : 0;
        const fleteVal = order.flete !== undefined && order.flete !== null ? parseFloat(order.flete) || 0 : 0;

        const ncrMontoDefault = order.ncr_monto !== undefined && order.ncr_monto !== null ? String(order.ncr_monto) : '0.00';
        const cuponesDefault = order.cupones !== undefined && order.cupones !== null ? String(order.cupones) : '0.00';

        setReceiveForm({
            fecha_descarga: defaultDate,
            documento: docDefault,
            observacion: order.observacion || '',
            ncr_numero: order.ncr_numero || '',
            ncr_monto: ncrMontoDefault,
            cupones: cuponesDefault,
            r_diesel: String(galD),
            r_regular: String(galR),
            r_super: String(galS),
            r_ion: String(galI),
            costo_d: costD > 0 ? String(costD) : '0',
            costo_r: costR > 0 ? String(costR) : '0',
            costo_s: costS > 0 ? String(costS) : '0',
            costo_i: costI > 0 ? String(costI) : '0',
            flete: fleteVal > 0 ? String(fleteVal) : '0',
        });

        // Compute suggested payment amount if order.pago is not set
        const totalEstimated = (galD * (costD + fleteVal)) + (galR * (costR + fleteVal)) + (galS * (costS + fleteVal)) + (galI * (costI + fleteVal));
        const netEstimated = Math.max(0, totalEstimated - (parseFloat(ncrMontoDefault) || 0) - (parseFloat(cuponesDefault) || 0));
        const initialPayment = order.pago && parseFloat(order.pago) > 0
            ? String(order.pago)
            : (netEstimated > 0 ? netEstimated.toFixed(2) : '0.00');

        setSelectedBank('');
        setChequeForm({
            numero_cuenta: '',
            cheque: '',
            valor: initialPayment,
            concepto: docDefault ? `PAGO DE PIPA CCF# ${docDefault}` : '',
        });

        // Initialize transfer form
        setTransferForm({
            numero_cuenta: '',
            referencia: '',
            monto: initialPayment,
            fecha_pago: defaultDate,
            concepto: docDefault ? `PAGO DE PIPA CCF# ${docDefault}` : '',
        });

        // Fetch existing vouchers if Cheque mode
        if (method === 'CHEQUE') {
            try {
                const vRes = await axios.get(`/api/gas-station/orders/${order.id}/vouchers`);
                const loadedVouchers = (vRes.data?.data || []).map(v => ({
                    numero_cuenta: v.numero_cuenta,
                    nombre_cuenta: v.nombre_cuenta || v.numero_cuenta,
                    cheque: v.cheque,
                    valor: parseFloat(v.valor) || 0,
                    concepto: v.concepto || '',
                }));
                setChequesList(loadedVouchers);
            } catch (e) {
                setChequesList([]);
            }
        } else {
            // Fetch existing transfer movement if Transferencia mode
            try {
                const tRes = await axios.get(`/api/gas-station/orders/${order.id}/transfer`);
                if (tRes.data?.data) {
                    const t = tRes.data.data;
                    let fecPago = defaultDate;
                    if (t.fecha && t.fecha.includes('/')) {
                        const [d, m, y] = t.fecha.split('/');
                        if (y && m && d) fecPago = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                    }
                    setTransferForm({
                        numero_cuenta: t.numero_cuenta || '',
                        referencia: t.documento ? t.documento.trim() : '',
                        monto: t.monto ? String(t.monto) : '0.00',
                        fecha_pago: fecPago,
                        concepto: t.concepto || '',
                    });
                }
            } catch (e) {
                // Keep default
            }
        }

        setReceivingOrder(order);
    };

    // Auto update transfer observation string following frm_descarga_pedido2.vb
    useEffect(() => {
        if (receiveMethod === 'TRANSFERENCIA' && receivingOrder) {
            const numCta = (transferForm.numero_cuenta || '').trim();
            const ctaLast4 = numCta.length >= 4 ? numCta.slice(-4) : numCta;
            const montoNum = parseFloat(transferForm.monto) || 0;
            const baseForma = (receivingOrder.forma_pago || '').trim();

            if (numCta && montoNum > 0) {
                const montoFmt = montoNum.toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                setReceiveForm(prev => ({
                    ...prev,
                    observacion: `${baseForma}**TRANSF. #${ctaLast4} - $${montoFmt}**`
                }));
            }
        }
    }, [receiveMethod, receivingOrder, transferForm.numero_cuenta, transferForm.monto]);

    // Update concepts when document number changes
    useEffect(() => {
        if (receiveForm.documento) {
            const defaultConcept = `PAGO DE PIPA CCF# ${receiveForm.documento.trim()}`;
            setChequeForm(prev => prev.concepto ? prev : { ...prev, concepto: defaultConcept });
            setTransferForm(prev => prev.concepto ? prev : { ...prev, concepto: defaultConcept });
        }
    }, [receiveForm.documento]);

    // Add cheque with validation in RRS
    const handleAddCheque = async () => {
        if (!selectedBank) {
            toast.error('Seleccione un banco');
            return;
        }
        if (!chequeForm.numero_cuenta) {
            toast.error('Seleccione una cuenta bancaria');
            return;
        }
        if (!chequeForm.cheque.trim()) {
            toast.error('Ingrese el número de cheque');
            return;
        }
        const monto = parseFloat(chequeForm.valor) || 0;
        if (monto <= 0) {
            toast.error('Ingrese un monto válido para el cheque');
            return;
        }
        if (!receiveForm.documento.trim()) {
            toast.error('Ingrese primero el número de documento');
            return;
        }

        // Check if already in list
        if (chequesList.some(c => c.numero_cuenta === chequeForm.numero_cuenta && c.cheque === chequeForm.cheque.trim())) {
            toast.error('Este cheque ya fue agregado a la lista');
            return;
        }

        try {
            setIsValidatingCheque(true);
            const res = await axios.get('/api/gas-station/vouchers/validate', {
                params: {
                    account: chequeForm.numero_cuenta,
                    cheque: chequeForm.cheque.trim(),
                }
            });

            if (!res.data?.exists) {
                toast.error('Cheque no encontrado en RRS para esta cuenta');
                return;
            }

            const accountObj = bankAccountsData.find(a => a.numero === chequeForm.numero_cuenta);
            const concepto = chequeForm.concepto.trim() || `PAGO DE PIPA CCF# ${receiveForm.documento.trim()}`;

            setChequesList(prev => [
                ...prev,
                {
                    numero_cuenta: chequeForm.numero_cuenta,
                    nombre_cuenta: accountObj?.nombre || chequeForm.numero_cuenta,
                    cheque: chequeForm.cheque.trim(),
                    valor: monto,
                    concepto,
                }
            ]);

            // Reset subform
            setChequeForm({
                numero_cuenta: '',
                cheque: '',
                valor: '0.00',
                concepto: `PAGO DE PIPA CCF# ${receiveForm.documento.trim()}`,
            });
            setSelectedBank('');
            toast.success('Cheque verificado y agregado');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error al validar cheque');
        } finally {
            setIsValidatingCheque(false);
        }
    };

    const handleRemoveCheque = (index) => {
        setChequesList(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmitReceive = (e) => {
        e.preventDefault();
        if (!receivingOrder) return;

        if (!receiveForm.documento.trim()) {
            toast.error('Debe ingresar el número de documento');
            return;
        }

        if (!receiveForm.fecha_descarga.trim()) {
            toast.error('Debe ingresar la fecha de descarga');
            return;
        }

        const galDiesel = parseFloat(receiveForm.r_diesel) || 0;
        const galRegular = parseFloat(receiveForm.r_regular) || 0;
        const galSuper = parseFloat(receiveForm.r_super) || 0;
        const galIon = parseFloat(receiveForm.r_ion) || 0;

        const costDiesel = parseFloat(receiveForm.costo_d) || 0;
        const costRegular = parseFloat(receiveForm.costo_r) || 0;
        const costSuper = parseFloat(receiveForm.costo_s) || 0;
        const costIon = parseFloat(receiveForm.costo_i) || 0;

        if (galDiesel <= 0 && galRegular <= 0 && galSuper <= 0 && galIon <= 0) {
            toast.error('Debe ingresar los galones recibidos de al menos un producto');
            return;
        }

        if (galDiesel > 0 && costDiesel <= 0) {
            toast.error('Debe ingresar el costo por galón para Diésel');
            return;
        }

        if (galRegular > 0 && costRegular <= 0) {
            toast.error('Debe ingresar el costo por galón para Regular');
            return;
        }

        if (galSuper > 0 && costSuper <= 0) {
            toast.error('Debe ingresar el costo por galón para Súper');
            return;
        }

        if (galIon > 0 && costIon <= 0) {
            toast.error('Debe ingresar el costo por galón para Ion Diésel');
            return;
        }

        if (receiveMethod === 'TRANSFERENCIA') {
            if (!transferForm.numero_cuenta) {
                toast.error('Falta seleccionar la Cuenta Bancaria');
                return;
            }
            if (!transferForm.referencia.trim()) {
                toast.error('Falta ingresar el Número de Referencia');
                return;
            }
            const montoT = parseFloat(transferForm.monto) || 0;
            if (montoT <= 0) {
                toast.error('Monto de transferencia incorrecto');
                return;
            }
        }

        const payload = {
            metodo_pago: receiveMethod,
            fecha_descarga: receiveForm.fecha_descarga,
            documento: receiveForm.documento.trim(),
            observacion: receiveForm.observacion.trim(),
            ncr_numero: receiveForm.ncr_numero.trim(),
            ncr_monto: parseFloat(receiveForm.ncr_monto) || 0,
            cupones: parseFloat(receiveForm.cupones) || 0,
            r_diesel: parseFloat(receiveForm.r_diesel) || 0,
            r_regular: parseFloat(receiveForm.r_regular) || 0,
            r_super: parseFloat(receiveForm.r_super) || 0,
            r_ion: parseFloat(receiveForm.r_ion) || 0,
            costo_d: parseFloat(receiveForm.costo_d) || 0,
            costo_r: parseFloat(receiveForm.costo_r) || 0,
            costo_s: parseFloat(receiveForm.costo_s) || 0,
            costo_i: parseFloat(receiveForm.costo_i) || 0,
            flete: parseFloat(receiveForm.flete) || 0,
            cheques: chequesList.map(c => ({
                numero_cuenta: c.numero_cuenta,
                cheque: c.cheque,
                valor: c.valor,
                concepto: c.concepto,
            })),
            // Transfer payload
            numero_cuenta: transferForm.numero_cuenta,
            referencia: transferForm.referencia.trim(),
            monto: parseFloat(transferForm.monto) || 0,
            fecha_pago: transferForm.fecha_pago || receiveForm.fecha_descarga,
            concepto: transferForm.concepto.trim() || `PAGO DE PIPA CCF# ${receiveForm.documento.trim()}`,
        };

        receiveOrderMutation.mutate({ orderId: receivingOrder.id, payload });
    };

    const getStatusBadge = (estado) => {
        const est = String(estado || '').toUpperCase();
        if (est === 'PENDIENTE') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock className="w-3.5 h-3.5" />
                    PENDIENTE
                </span>
            );
        }
        if (est === 'VISTO') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                    <Eye className="w-3.5 h-3.5" />
                    VISTO
                </span>
            );
        }
        if (est === 'RECIBIDO') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    RECIBIDO
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <Info className="w-3.5 h-3.5" />
                {est || 'OTRO'}
            </span>
        );
    };

    // Calculate totals for receiving modal (Cheque mode)
    const totalCheques = chequesList.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0);
    const cuponesVal = parseFloat(receiveForm.cupones) || 0;
    const ncrMontoVal = parseFloat(receiveForm.ncr_monto) || 0;
    const pagoTotal = totalCheques + cuponesVal + ncrMontoVal;

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Fuel className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">Consulta de Pedidos</h1>
                            <p className="text-xs text-slate-500 font-medium">
                                Monitoreo, confirmación y recepción de pedidos de combustible desde RRS
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center flex-wrap gap-2.5 w-full sm:w-auto justify-start sm:justify-end">
                    {stationId ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-medium text-slate-700">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Estación RRS: <strong>{stationId}</strong> {branchName ? `(${branchName})` : ''}</span>
                        </div>
                    ) : (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-xl border border-amber-200 text-xs font-medium text-amber-700">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            <span>Sin estación RRS configurada</span>
                        </div>
                    )}

                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-medium transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                        title="Refrescar lista"
                    >
                        <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                        <span>Actualizar</span>
                    </button>
                </div>
            </div>

            {/* Warning if station is not configured */}
            {isUnconfigured && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-800">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs leading-relaxed">
                        <p className="font-semibold text-amber-900">Estación de RRS no configurada para esta sucursal</p>
                        <p>
                            Para consultar pedidos en línea, debe definir el código de estación (<code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">rrs_id_empresa</code>) en{' '}
                            <strong>Gasolinera &gt; Configuración</strong>.
                        </p>
                    </div>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">Pedidos {statusFilter === 'TODOS' ? '' : statusFilter.toLowerCase()}</span>
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Layers className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-slate-800 tracking-tight font-mono">{summary.totalOrders}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">En el listado actual</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">Diésel</span>
                        <span className="w-3 h-3 rounded-full bg-slate-700" title="Diésel" />
                    </div>
                    <p className="mt-2 text-xl font-bold text-slate-800 tracking-tight font-mono">{formatNumber(summary.totalDiesel)} <span className="text-xs font-normal text-slate-500">gln</span></p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Galones pedidos</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">Regular</span>
                        <span className="w-3 h-3 rounded-full bg-amber-500" title="Regular" />
                    </div>
                    <p className="mt-2 text-xl font-bold text-slate-800 tracking-tight font-mono">{formatNumber(summary.totalRegular)} <span className="text-xs font-normal text-slate-500">gln</span></p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Galones pedidos</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">Súper</span>
                        <span className="w-3 h-3 rounded-full bg-rose-500" title="Súper" />
                    </div>
                    <p className="mt-2 text-xl font-bold text-slate-800 tracking-tight font-mono">{formatNumber(summary.totalSuper)} <span className="text-xs font-normal text-slate-500">gln</span></p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Galones pedidos</p>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-4 rounded-2xl border border-indigo-200/80 shadow-sm col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-indigo-700 uppercase">Total Galones</span>
                        <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                            <Fuel className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <p className="mt-2 text-xl font-black text-indigo-900 tracking-tight font-mono">{formatNumber(summary.totalGallons)} <span className="text-xs font-normal text-indigo-700">gln</span></p>
                    <p className="text-[11px] text-indigo-600 mt-0.5">Suma de productos</p>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
                    {/* Status Tabs */}
                    <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
                        <button
                            type="button"
                            onClick={() => setStatusFilter('PENDIENTE')}
                            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                                statusFilter === 'PENDIENTE'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Pendientes / Vistos
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('RECIBIDO')}
                            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                                statusFilter === 'RECIBIDO'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Recibidos
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('TODOS')}
                            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                                statusFilter === 'TODOS'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Todos
                        </button>
                    </div>

                    {/* Search & Dates */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 md:justify-end">
                        <div className="relative flex-1 max-w-md">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Buscar pedido, documento, referencia..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3.5 py-1.5 text-[13px] font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                            />
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <div className="relative">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="px-2.5 py-1.5 text-[12px] font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700"
                                    title="Fecha desde"
                                />
                            </div>
                            <span className="text-slate-400 text-xs">-</span>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="px-2.5 py-1.5 text-[12px] font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700"
                                    title="Fecha hasta"
                                />
                            </div>
                            {(startDate || endDate || searchTerm) && (
                                <button
                                    onClick={() => {
                                        setStartDate('');
                                        setEndDate('');
                                        setSearchTerm('');
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                    title="Limpiar filtros"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                        <span className="text-xs font-medium text-slate-500">Cargando pedidos desde RRS...</span>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                            <Fuel className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-semibold text-slate-700 mt-2">No se encontraron pedidos</p>
                        <p className="text-xs text-slate-500 max-w-sm">
                            {isUnconfigured
                                ? 'Configure la estación de RRS en la configuración de gasolinera.'
                                : statusFilter === 'PENDIENTE'
                                ? 'No hay pedidos pendientes o vistos para la estación en este momento.'
                                : 'No se encontraron resultados con los filtros aplicados.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="py-3 px-4">Pedido #</th>
                                    <th className="py-3 px-4">Fecha</th>
                                    <th className="py-3 px-4">Estado</th>
                                    <th className="py-3 px-4 text-right">Diésel</th>
                                    <th className="py-3 px-4 text-right">Regular</th>
                                    <th className="py-3 px-4 text-right">Súper</th>
                                    <th className="py-3 px-4 text-right">Total Gln</th>
                                    <th className="py-3 px-4">Forma de Pago / Referencia</th>
                                    <th className="py-3 px-4 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                {orders.map((order) => {
                                    const pDiesel = parseFloat(order.p_diesel) || 0;
                                    const pRegular = parseFloat(order.p_regular) || 0;
                                    const pSuper = parseFloat(order.p_super) || 0;
                                    const totalGln = order.total_galones || 0;
                                    const est = String(order.estado || '').toUpperCase();

                                    return (
                                        <tr key={order.id} className="hover:bg-indigo-50/30 transition-colors">
                                            <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                                                {order.numero || `#${order.id}`}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                                                {formatDate(order.fecha)}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                {getStatusBadge(order.estado)}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono">
                                                {pDiesel > 0 ? (
                                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">
                                                        {formatNumber(pDiesel)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono">
                                                {pRegular > 0 ? (
                                                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold">
                                                        {formatNumber(pRegular)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono">
                                                {pSuper > 0 ? (
                                                    <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 font-semibold">
                                                        {formatNumber(pSuper)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700">
                                                {formatNumber(totalGln)}
                                            </td>
                                            <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={order.forma_pago}>
                                                {order.forma_pago || '—'}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="inline-flex items-center justify-center gap-1">
                                                    {/* Marcar como Visto: solo visible en PENDIENTE */}
                                                    {est === 'PENDIENTE' && (
                                                        <button
                                                            onClick={() => setConfirmSeenOrder(order)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                                            title="Marcar pedido como visto"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                            <span className="hidden sm:inline">Visto</span>
                                                        </button>
                                                    )}

                                                    {/* Recibir Pedido: solo visible si el estado es VISTO */}
                                                    {est === 'VISTO' && (
                                                        <button
                                                            onClick={() => handleInitiateReceive(order)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                                            title="Recibir pedido y registrar descarga"
                                                        >
                                                            <PackageCheck className="w-3.5 h-3.5" />
                                                            <span className="hidden sm:inline">Recibir</span>
                                                        </button>
                                                    )}

                                                    {/* Ver Detalle */}
                                                    <button
                                                        onClick={() => setSelectedOrder(order)}
                                                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                                        title="Ver detalle del pedido"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal: Confirm Marcar como Visto */}
            {confirmSeenOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
                                    <Eye className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-800">
                                        ¿Marcar Pedido como Visto?
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Pedido #{confirmSeenOrder.numero || confirmSeenOrder.id}
                                    </p>
                                </div>
                            </div>

                            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                El estado del pedido cambiará a <strong className="text-sky-700">VISTO</strong> para indicar que la estación tiene conocimiento del pedido y se encuentra lista para recibir la descarga.
                            </p>

                            <div className="flex items-center justify-end gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setConfirmSeenOrder(null)}
                                    disabled={markSeenMutation.isPending}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => markSeenMutation.mutate(confirmSeenOrder.id)}
                                    disabled={markSeenMutation.isPending}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                                >
                                    {markSeenMutation.isPending ? (
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Check className="w-3.5 h-3.5" />
                                    )}
                                    <span>Confirmar y Marcar como Visto</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Selector de Método de Pago al Recibir (Cheque vs Transferencia) */}
            {selectMethodOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                                        <PackageCheck className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-slate-800">
                                            Recibir Pedido #{selectMethodOrder.numero || selectMethodOrder.id}
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            Seleccione el método de pago para registrar la descarga:
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectMethodOrder(null)}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                                {/* Opción 1: Pago con Cheque */}
                                <button
                                    type="button"
                                    onClick={() => handleSelectReceiveMethod('CHEQUE')}
                                    className="p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 text-left transition-all group flex flex-col justify-between cursor-pointer space-y-3"
                                >
                                    <div className="p-2.5 w-fit rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                        <Landmark className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-900">
                                            Pago con Cheque(s)
                                        </h4>
                                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                            Registro de uno o más cheques bancarios con verificación de vouchers, descuento de cupones y notas de crédito.
                                        </p>
                                    </div>
                                    <span className="text-[11px] font-bold text-indigo-600 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                                        Continuar &rarr;
                                    </span>
                                </button>

                                {/* Opción 2: Pago por Transferencia */}
                                <button
                                    type="button"
                                    onClick={() => handleSelectReceiveMethod('TRANSFERENCIA')}
                                    className="p-4 rounded-xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all group flex flex-col justify-between cursor-pointer space-y-3"
                                >
                                    <div className="p-2.5 w-fit rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                        <ArrowLeftRight className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm group-hover:text-emerald-900">
                                            Pago por Transferencia
                                        </h4>
                                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                            Registro directo a cuenta bancaria con número de referencia, fecha de pago y registro en movimientos bancarios.
                                        </p>
                                    </div>
                                    <span className="text-[11px] font-bold text-emerald-600 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                                        Continuar &rarr;
                                    </span>
                                </button>
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectMethodOrder(null)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Recibir Pedido (con selector interno de Cheque vs Transferencia) */}
            {receivingOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
                        {/* Modal Header */}
                        <div className="px-6 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/90">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${receiveMethod === 'TRANSFERENCIA' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                    {receiveMethod === 'TRANSFERENCIA' ? <ArrowLeftRight className="w-5 h-5" /> : <PackageCheck className="w-5 h-5" />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                        Recibir Pedido #{receivingOrder.numero || receivingOrder.id}
                                        {getStatusBadge(receivingOrder.estado)}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        {receiveMethod === 'TRANSFERENCIA' ? 'Modalidad: Pago por Transferencia' : 'Modalidad: Pago con Cheque(s)'}
                                    </p>
                                </div>
                            </div>

                            {/* Pestañas para alternar de método */}
                            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
                                <div className="inline-flex p-1 bg-slate-200/80 rounded-xl border border-slate-300">
                                    <button
                                        type="button"
                                        onClick={() => setReceiveMethod('CHEQUE')}
                                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                                            receiveMethod === 'CHEQUE'
                                                ? 'bg-white text-indigo-700 shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        Cheque
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setReceiveMethod('TRANSFERENCIA')}
                                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                                            receiveMethod === 'TRANSFERENCIA'
                                                ? 'bg-white text-emerald-700 shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        Transferencia
                                    </button>
                                </div>

                                <button
                                    onClick={() => setReceivingOrder(null)}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSubmitReceive} className="overflow-y-auto flex-1 p-5 space-y-4">
                            {/* Sección 1: Encabezado y Forma de Pago Original */}
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                        Forma de Pago Original
                                    </label>
                                    <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 break-words">
                                        {receivingOrder.forma_pago || 'CREDITO'}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                            Número Doc. / CCF <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ej. 53930"
                                            value={receiveForm.documento}
                                            onChange={(e) => setReceiveForm(prev => ({ ...prev, documento: e.target.value }))}
                                            className="w-full px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                            Fecha Descarga <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={receiveForm.fecha_descarga}
                                            onChange={(e) => setReceiveForm(prev => ({ ...prev, fecha_descarga: e.target.value }))}
                                            className="w-full px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                        Observación
                                    </label>
                                    <textarea
                                        rows={1}
                                        maxLength={200}
                                        placeholder="Observaciones de la descarga..."
                                        value={receiveForm.observacion}
                                        onChange={(e) => setReceiveForm(prev => ({ ...prev, observacion: e.target.value }))}
                                        className="w-full px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 resize-none"
                                    />
                                </div>
                            </div>

                            {/* Sección 2: Descarga de Combustibles y Captura de Costos */}
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3.5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1 border-b border-slate-200">
                                    <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <Fuel className="w-3.5 h-3.5 text-indigo-600" />
                                        Descarga de Combustible y Captura de Costos
                                    </h4>
                                    <div className="flex items-center gap-2">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase shrink-0">
                                            Flete /gln ($):
                                        </label>
                                        <MoneyInput
                                            step="0.0001"
                                            min="0"
                                            placeholder="0.0000"
                                            value={receiveForm.flete}
                                            onChange={(e) => setReceiveForm(prev => ({ ...prev, flete: e.target.value }))}
                                            className="w-24 px-2 py-1 text-right text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                                            title="Flete por galón a sumar al costo"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    {/* Diésel */}
                                    <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2.5 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                                                <span className="flex items-center gap-1.5">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-slate-700 shrink-0" />
                                                    Diésel
                                                </span>
                                                <span className="text-[10px] font-normal text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                    Ped: {formatNumber(receivingOrder.p_diesel)} gln
                                                </span>
                                            </div>

                                            <div className="mt-2 space-y-2">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                                                        Galones Recibidos
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={receiveForm.r_diesel}
                                                        onChange={(e) => setReceiveForm(prev => ({ ...prev, r_diesel: e.target.value }))}
                                                        className="w-full px-2 py-1 text-right text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5 flex items-center justify-between">
                                                        <span>Costo /gln ($)</span>
                                                        {parseFloat(receiveForm.r_diesel) > 0 && (parseFloat(receiveForm.costo_d) || 0) <= 0 && (
                                                            <span className="text-rose-500 font-semibold text-[9px] lowercase">requerido</span>
                                                        )}
                                                    </label>
                                                    <MoneyInput
                                                        step="0.00001"
                                                        min="0"
                                                        placeholder="0.0000"
                                                        value={receiveForm.costo_d}
                                                        onChange={(e) => setReceiveForm(prev => ({ ...prev, costo_d: e.target.value }))}
                                                        className={`w-full px-2 py-1 text-right text-xs font-mono font-bold bg-slate-50 border rounded focus:bg-white focus:outline-none focus:ring-2 text-slate-800 ${
                                                            parseFloat(receiveForm.r_diesel) > 0 && (parseFloat(receiveForm.costo_d) || 0) <= 0
                                                                ? 'border-rose-400 focus:ring-rose-500/20'
                                                                : 'border-slate-300 focus:ring-indigo-500/20'
                                                        }`}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-slate-100 space-y-1">
                                            {parseFloat(receiveForm.flete) > 0 && (
                                                <div className="flex items-center justify-between text-[10px] text-slate-500">
                                                    <span>Costo + Flete:</span>
                                                    <span className="font-mono">
                                                        <Money value={(parseFloat(receiveForm.costo_d) || 0) + (parseFloat(receiveForm.flete) || 0)} digits={4} />
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                                                <span className="text-slate-500">Subtotal:</span>
                                                <span className="font-mono text-indigo-700">
                                                    <Money value={(parseFloat(receiveForm.r_diesel) || 0) * ((parseFloat(receiveForm.costo_d) || 0) + (parseFloat(receiveForm.flete) || 0))} />
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Regular */}
                                    <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2.5 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                                                <span className="flex items-center gap-1.5">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                                                    Regular
                                                </span>
                                                <span className="text-[10px] font-normal text-slate-500 bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded">
                                                    Ped: {formatNumber(receivingOrder.p_regular)} gln
                                                </span>
                                            </div>

                                            <div className="mt-2 space-y-2">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                                                        Galones Recibidos
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={receiveForm.r_regular}
                                                        onChange={(e) => setReceiveForm(prev => ({ ...prev, r_regular: e.target.value }))}
                                                        className="w-full px-2 py-1 text-right text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5 flex items-center justify-between">
                                                        <span>Costo /gln ($)</span>
                                                        {parseFloat(receiveForm.r_regular) > 0 && (parseFloat(receiveForm.costo_r) || 0) <= 0 && (
                                                            <span className="text-rose-500 font-semibold text-[9px] lowercase">requerido</span>
                                                        )}
                                                    </label>
                                                    <MoneyInput
                                                        step="0.00001"
                                                        min="0"
                                                        placeholder="0.0000"
                                                        value={receiveForm.costo_r}
                                                        onChange={(e) => setReceiveForm(prev => ({ ...prev, costo_r: e.target.value }))}
                                                        className={`w-full px-2 py-1 text-right text-xs font-mono font-bold bg-slate-50 border rounded focus:bg-white focus:outline-none focus:ring-2 text-slate-800 ${
                                                            parseFloat(receiveForm.r_regular) > 0 && (parseFloat(receiveForm.costo_r) || 0) <= 0
                                                                ? 'border-rose-400 focus:ring-rose-500/20'
                                                                : 'border-slate-300 focus:ring-indigo-500/20'
                                                        }`}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-slate-100 space-y-1">
                                            {parseFloat(receiveForm.flete) > 0 && (
                                                <div className="flex items-center justify-between text-[10px] text-slate-500">
                                                    <span>Costo + Flete:</span>
                                                    <span className="font-mono">
                                                        <Money value={(parseFloat(receiveForm.costo_r) || 0) + (parseFloat(receiveForm.flete) || 0)} digits={4} />
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                                                <span className="text-slate-500">Subtotal:</span>
                                                <span className="font-mono text-amber-700">
                                                    <Money value={(parseFloat(receiveForm.r_regular) || 0) * ((parseFloat(receiveForm.costo_r) || 0) + (parseFloat(receiveForm.flete) || 0))} />
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Súper */}
                                    <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2.5 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                                                <span className="flex items-center gap-1.5">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                                                    Súper
                                                </span>
                                                <span className="text-[10px] font-normal text-slate-500 bg-rose-50 text-rose-800 px-1.5 py-0.5 rounded">
                                                    Ped: {formatNumber(receivingOrder.p_super)} gln
                                                </span>
                                            </div>

                                            <div className="mt-2 space-y-2">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                                                        Galones Recibidos
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={receiveForm.r_super}
                                                        onChange={(e) => setReceiveForm(prev => ({ ...prev, r_super: e.target.value }))}
                                                        className="w-full px-2 py-1 text-right text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5 flex items-center justify-between">
                                                        <span>Costo /gln ($)</span>
                                                        {parseFloat(receiveForm.r_super) > 0 && (parseFloat(receiveForm.costo_s) || 0) <= 0 && (
                                                            <span className="text-rose-500 font-semibold text-[9px] lowercase">requerido</span>
                                                        )}
                                                    </label>
                                                    <MoneyInput
                                                        step="0.00001"
                                                        min="0"
                                                        placeholder="0.0000"
                                                        value={receiveForm.costo_s}
                                                        onChange={(e) => setReceiveForm(prev => ({ ...prev, costo_s: e.target.value }))}
                                                        className={`w-full px-2 py-1 text-right text-xs font-mono font-bold bg-slate-50 border rounded focus:bg-white focus:outline-none focus:ring-2 text-slate-800 ${
                                                            parseFloat(receiveForm.r_super) > 0 && (parseFloat(receiveForm.costo_s) || 0) <= 0
                                                                ? 'border-rose-400 focus:ring-rose-500/20'
                                                                : 'border-slate-300 focus:ring-indigo-500/20'
                                                        }`}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-slate-100 space-y-1">
                                            {parseFloat(receiveForm.flete) > 0 && (
                                                <div className="flex items-center justify-between text-[10px] text-slate-500">
                                                    <span>Costo + Flete:</span>
                                                    <span className="font-mono">
                                                        <Money value={(parseFloat(receiveForm.costo_s) || 0) + (parseFloat(receiveForm.flete) || 0)} digits={4} />
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                                                <span className="text-slate-500">Subtotal:</span>
                                                <span className="font-mono text-rose-700">
                                                    <Money value={(parseFloat(receiveForm.r_super) || 0) * ((parseFloat(receiveForm.costo_s) || 0) + (parseFloat(receiveForm.flete) || 0))} />
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ion Diésel */}
                                    <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2.5 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                                                <span className="flex items-center gap-1.5">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                                                    Ion Diésel
                                                </span>
                                                <span className="text-[10px] font-normal text-slate-500 bg-indigo-50 text-indigo-800 px-1.5 py-0.5 rounded">
                                                    Ped: {formatNumber(receivingOrder.p_ion)} gln
                                                </span>
                                            </div>

                                            <div className="mt-2 space-y-2">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                                                        Galones Recibidos
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={receiveForm.r_ion}
                                                        onChange={(e) => setReceiveForm(prev => ({ ...prev, r_ion: e.target.value }))}
                                                        className="w-full px-2 py-1 text-right text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5 flex items-center justify-between">
                                                        <span>Costo /gln ($)</span>
                                                        {parseFloat(receiveForm.r_ion) > 0 && (parseFloat(receiveForm.costo_i) || 0) <= 0 && (
                                                            <span className="text-rose-500 font-semibold text-[9px] lowercase">requerido</span>
                                                        )}
                                                    </label>
                                                    <MoneyInput
                                                        step="0.00001"
                                                        min="0"
                                                        placeholder="0.0000"
                                                        value={receiveForm.costo_i}
                                                        onChange={(e) => setReceiveForm(prev => ({ ...prev, costo_i: e.target.value }))}
                                                        className={`w-full px-2 py-1 text-right text-xs font-mono font-bold bg-slate-50 border rounded focus:bg-white focus:outline-none focus:ring-2 text-slate-800 ${
                                                            parseFloat(receiveForm.r_ion) > 0 && (parseFloat(receiveForm.costo_i) || 0) <= 0
                                                                ? 'border-rose-400 focus:ring-rose-500/20'
                                                                : 'border-slate-300 focus:ring-indigo-500/20'
                                                        }`}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-slate-100 space-y-1">
                                            {parseFloat(receiveForm.flete) > 0 && (
                                                <div className="flex items-center justify-between text-[10px] text-slate-500">
                                                    <span>Costo + Flete:</span>
                                                    <span className="font-mono">
                                                        <Money value={(parseFloat(receiveForm.costo_i) || 0) + (parseFloat(receiveForm.flete) || 0)} digits={4} />
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                                                <span className="text-slate-500">Subtotal:</span>
                                                <span className="font-mono text-indigo-700">
                                                    <Money value={(parseFloat(receiveForm.r_ion) || 0) * ((parseFloat(receiveForm.costo_i) || 0) + (parseFloat(receiveForm.flete) || 0))} />
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Resumen de Descarga y Costos */}
                                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <div>
                                            <span className="block text-[10px] font-bold text-slate-500 uppercase">Total Galones</span>
                                            <span className="font-mono font-bold text-xs text-slate-800">
                                                {formatNumber((parseFloat(receiveForm.r_diesel) || 0) + (parseFloat(receiveForm.r_regular) || 0) + (parseFloat(receiveForm.r_super) || 0) + (parseFloat(receiveForm.r_ion) || 0))} gln
                                            </span>
                                        </div>
                                        <div className="h-5 w-px bg-indigo-200 hidden sm:block" />
                                        <div>
                                            <span className="block text-[10px] font-bold text-slate-500 uppercase">Total Estimado</span>
                                            <span className="font-mono font-bold text-xs text-indigo-900">
                                                <Money value={
                                                    ((parseFloat(receiveForm.r_diesel) || 0) * ((parseFloat(receiveForm.costo_d) || 0) + (parseFloat(receiveForm.flete) || 0))) +
                                                    ((parseFloat(receiveForm.r_regular) || 0) * ((parseFloat(receiveForm.costo_r) || 0) + (parseFloat(receiveForm.flete) || 0))) +
                                                    ((parseFloat(receiveForm.r_super) || 0) * ((parseFloat(receiveForm.costo_s) || 0) + (parseFloat(receiveForm.flete) || 0))) +
                                                    ((parseFloat(receiveForm.r_ion) || 0) * ((parseFloat(receiveForm.costo_i) || 0) + (parseFloat(receiveForm.flete) || 0)))
                                                } />
                                            </span>
                                        </div>
                                        <div className="h-5 w-px bg-indigo-200 hidden sm:block" />
                                        <div>
                                            <span className="block text-[10px] font-bold text-slate-500 uppercase">Neto a Pagar</span>
                                            <span className="font-mono font-bold text-xs text-emerald-700">
                                                <Money value={Math.max(0, (
                                                    ((parseFloat(receiveForm.r_diesel) || 0) * ((parseFloat(receiveForm.costo_d) || 0) + (parseFloat(receiveForm.flete) || 0))) +
                                                    ((parseFloat(receiveForm.r_regular) || 0) * ((parseFloat(receiveForm.costo_r) || 0) + (parseFloat(receiveForm.flete) || 0))) +
                                                    ((parseFloat(receiveForm.r_super) || 0) * ((parseFloat(receiveForm.costo_s) || 0) + (parseFloat(receiveForm.flete) || 0))) +
                                                    ((parseFloat(receiveForm.r_ion) || 0) * ((parseFloat(receiveForm.costo_i) || 0) + (parseFloat(receiveForm.flete) || 0)))
                                                ) - (parseFloat(receiveForm.ncr_monto) || 0) - (parseFloat(receiveForm.cupones) || 0))} />
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const totalCalculado = (
                                                ((parseFloat(receiveForm.r_diesel) || 0) * ((parseFloat(receiveForm.costo_d) || 0) + (parseFloat(receiveForm.flete) || 0))) +
                                                ((parseFloat(receiveForm.r_regular) || 0) * ((parseFloat(receiveForm.costo_r) || 0) + (parseFloat(receiveForm.flete) || 0))) +
                                                ((parseFloat(receiveForm.r_super) || 0) * ((parseFloat(receiveForm.costo_s) || 0) + (parseFloat(receiveForm.flete) || 0))) +
                                                ((parseFloat(receiveForm.r_ion) || 0) * ((parseFloat(receiveForm.costo_i) || 0) + (parseFloat(receiveForm.flete) || 0)))
                                            );
                                            const neto = Math.max(0, totalCalculado - (parseFloat(receiveForm.ncr_monto) || 0) - (parseFloat(receiveForm.cupones) || 0));
                                            const formattedNeto = neto.toFixed(2);
                                            if (receiveMethod === 'TRANSFERENCIA') {
                                                setTransferForm(prev => ({ ...prev, monto: formattedNeto }));
                                            } else {
                                                setChequeForm(prev => ({ ...prev, valor: formattedNeto }));
                                            }
                                            toast.success(`Monto de pago actualizado a $${formattedNeto}`);
                                        }}
                                        className="self-start md:self-auto px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                                    >
                                        Aplicar al Monto de Pago
                                    </button>
                                </div>

                                {/* Notas de Crédito */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                            Notas Crédito (Números)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="0001, 0002, 0003"
                                            value={receiveForm.ncr_numero}
                                            onChange={(e) => setReceiveForm(prev => ({ ...prev, ncr_numero: e.target.value }))}
                                            className="w-full px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                            Monto Notas Crédito ($)
                                        </label>
                                        <MoneyInput
                                            value={receiveForm.ncr_monto}
                                            onChange={(e) => setReceiveForm(prev => ({ ...prev, ncr_monto: e.target.value }))}
                                            className="w-full px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 text-right font-mono"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Sección 3: Según Modalidad de Pago */}
                            {receiveMethod === 'TRANSFERENCIA' ? (
                                /* === FORMULARIO DE TRANSFERENCIA BANCARIA (frm_descarga_pedido2) === */
                                <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <ArrowLeftRight className="w-4 h-4 text-emerald-600" />
                                        <h4 className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                                            Datos de Transferencia Bancaria
                                        </h4>
                                    </div>

                                    <div className="p-3.5 bg-white rounded-xl border border-emerald-100 shadow-2xs space-y-3">
                                        {/* Cta Bancaria */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                                Cta Bancaria <span className="text-rose-500">*</span>
                                            </label>
                                            <select
                                                required
                                                value={transferForm.numero_cuenta}
                                                onChange={(e) => setTransferForm(prev => ({ ...prev, numero_cuenta: e.target.value }))}
                                                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                                            >
                                                <option value="">-- Seleccione Cuenta Bancaria --</option>
                                                {allBankAccountsData.map(a => (
                                                    <option key={a.numero} value={a.numero}>
                                                        {a.descri || `${a.numero} - ${a.nombre}`}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Concepto */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                                Concepto
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="PAGO DE PIPA CCF# ..."
                                                value={transferForm.concepto}
                                                onChange={(e) => setTransferForm(prev => ({ ...prev, concepto: e.target.value }))}
                                                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                                            />
                                        </div>

                                        {/* Fila: Referencia, Monto y Fecha Pago */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                                    Referencia <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    maxLength={10}
                                                    placeholder="Ej. 12817957"
                                                    value={transferForm.referencia}
                                                    onChange={(e) => setTransferForm(prev => ({ ...prev, referencia: e.target.value }))}
                                                    className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                                                />
                                                <span className="text-[10px] text-slate-400">Máx. 10 caracteres</span>
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1 text-right">
                                                    Monto ($) <span className="text-rose-500">*</span>
                                                </label>
                                                <MoneyInput
                                                    required
                                                    value={transferForm.monto}
                                                    onChange={(e) => setTransferForm(prev => ({ ...prev, monto: e.target.value }))}
                                                    className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 text-right"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                                    Fecha Pago <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    required
                                                    value={transferForm.fecha_pago}
                                                    onChange={(e) => setTransferForm(prev => ({ ...prev, fecha_pago: e.target.value }))}
                                                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* === FORMULARIO DE CHEQUES Y CUPONES (frm_descarga_pedido) === */
                                <>
                                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Landmark className="w-4 h-4 text-indigo-600" />
                                                <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                                    Emisión y Registro de Cheques
                                                </h4>
                                            </div>
                                            <span className="text-[11px] text-slate-500 font-medium">
                                                {chequesList.length} cheque(s) en lista
                                            </span>
                                        </div>

                                        {/* Formulario para agregar cheque */}
                                        <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5 shadow-2xs">
                                            {/* Selección de Banco */}
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                                    Banco:
                                                </label>
                                                <select
                                                    value={selectedBank}
                                                    onChange={(e) => {
                                                        setSelectedBank(e.target.value);
                                                        setChequeForm(prev => ({ ...prev, numero_cuenta: '' }));
                                                    }}
                                                    className="w-full px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                                                >
                                                    <option value="">-- Seleccionar Banco --</option>
                                                    {banksData.map(b => (
                                                        <option key={b.id} value={b.id}>
                                                            {b.descripcion}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Fila: Cuenta, Concepto, Cheque, Monto y Botón Agregar */}
                                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                                                <div className="sm:col-span-3">
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                                                        Cuenta
                                                    </label>
                                                    <select
                                                        value={chequeForm.numero_cuenta}
                                                        disabled={!selectedBank}
                                                        onChange={(e) => setChequeForm(prev => ({ ...prev, numero_cuenta: e.target.value }))}
                                                        className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 disabled:opacity-50"
                                                    >
                                                        <option value="">-- Cuenta --</option>
                                                        {bankAccountsData.map(a => (
                                                            <option key={a.numero} value={a.numero}>
                                                                {a.display_name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="sm:col-span-3">
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                                                        Concepto
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="PAGO DE PIPA..."
                                                        value={chequeForm.concepto}
                                                        onChange={(e) => setChequeForm(prev => ({ ...prev, concepto: e.target.value }))}
                                                        className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                                                    />
                                                </div>

                                                <div className="sm:col-span-2">
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                                                        # Cheque
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="Ej. 4165536"
                                                        value={chequeForm.cheque}
                                                        onChange={(e) => setChequeForm(prev => ({ ...prev, cheque: e.target.value }))}
                                                        className="w-full px-2 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                                                    />
                                                </div>

                                                <div className="sm:col-span-2">
                                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5 text-right">
                                                        Monto ($)
                                                    </label>
                                                    <MoneyInput
                                                        value={chequeForm.valor}
                                                        onChange={(e) => setChequeForm(prev => ({ ...prev, valor: e.target.value }))}
                                                        className="w-full px-2 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 text-right"
                                                    />
                                                </div>

                                                <div className="sm:col-span-2 flex justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={handleAddCheque}
                                                        disabled={isValidatingCheque || !chequeForm.numero_cuenta || !chequeForm.cheque}
                                                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-40 cursor-pointer"
                                                        title="Verificar y agregar cheque"
                                                    >
                                                        {isValidatingCheque ? (
                                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                        ) : (
                                                            <Plus className="w-3.5 h-3.5" />
                                                        )}
                                                        <span>Agregar</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tabla de Cheques Agregados */}
                                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                                            <table className="w-full text-left border-collapse text-xs">
                                                <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                                                    <tr>
                                                        <th className="py-2 px-3">Número Cta.</th>
                                                        <th className="py-2 px-3">Concepto</th>
                                                        <th className="py-2 px-3 font-mono">Cheque</th>
                                                        <th className="py-2 px-3 text-right">Monto</th>
                                                        <th className="py-2 px-3 text-center w-12">Acción</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {chequesList.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={5} className="py-4 text-center text-slate-400 text-xs italic">
                                                                No se han registrado cheques para este pago
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        chequesList.map((chq, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50/50">
                                                                <td className="py-1.5 px-3 font-mono text-[11px] text-slate-700">
                                                                    {chq.numero_cuenta}
                                                                    {chq.nombre_cuenta && chq.nombre_cuenta !== chq.numero_cuenta && (
                                                                        <span className="block text-[10px] font-sans text-slate-400 truncate max-w-xs">
                                                                            {chq.nombre_cuenta}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="py-1.5 px-3 text-slate-600 text-xs truncate max-w-xs" title={chq.concepto}>
                                                                    {chq.concepto}
                                                                </td>
                                                                <td className="py-1.5 px-3 font-mono font-bold text-indigo-700 text-xs">
                                                                    #{chq.cheque}
                                                                </td>
                                                                <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-800 text-xs">
                                                                    <Money value={chq.valor} />
                                                                </td>
                                                                <td className="py-1.5 px-3 text-center">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveCheque(idx)}
                                                                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                                                        title="Eliminar cheque"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                                {chequesList.length > 0 && (
                                                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-xs">
                                                        <tr>
                                                            <td colSpan={3} className="py-2 px-3 text-slate-700 uppercase text-[10px]">
                                                                Subtotal Cheques
                                                            </td>
                                                            <td className="py-2 px-3 text-right font-mono text-indigo-700">
                                                                <Money value={totalCheques} />
                                                            </td>
                                                            <td />
                                                        </tr>
                                                    </tfoot>
                                                )}
                                            </table>
                                        </div>
                                    </div>

                                    {/* Sección 4: Descuento Cupones y Pago Total */}
                                    <div className="p-3.5 bg-slate-900 text-white rounded-xl shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                                                Descuento Cupones:
                                            </label>
                                            <MoneyInput
                                                value={receiveForm.cupones}
                                                onChange={(e) => setReceiveForm(prev => ({ ...prev, cupones: e.target.value }))}
                                                className="w-32 px-3 py-1.5 text-xs font-mono font-bold bg-slate-800 border border-slate-700 rounded-lg text-white text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                Pago Total:
                                            </span>
                                            <span className="text-xl font-black font-mono text-emerald-400">
                                                <Money value={pagoTotal} />
                                            </span>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Footer Buttons */}
                            <div className="flex items-center justify-end gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setReceivingOrder(null)}
                                    disabled={receiveOrderMutation.isPending}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                                >
                                    Salir / Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={receiveOrderMutation.isPending}
                                    className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                                >
                                    {receiveOrderMutation.isPending ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-4 h-4" />
                                    )}
                                    <span>Guardar Descarga</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Order Detail Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                    <Fuel className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                        Pedido #{selectedOrder.numero || selectedOrder.id}
                                        {getStatusBadge(selectedOrder.estado)}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Fecha: {formatDate(selectedOrder.fecha)} · Estación RRS: {selectedOrder.id_estacion}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto space-y-5 text-xs">
                            {/* Fuel Comparison Table */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-[11px] font-bold text-slate-500 uppercase">Desglose de Combustible y Costos</h4>
                                    {parseFloat(selectedOrder.flete) > 0 && (
                                        <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                            Flete aplicado: <Money value={selectedOrder.flete} digits={4} /> /gln
                                        </span>
                                    )}
                                </div>
                                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                                            <tr>
                                                <th className="py-2.5 px-3">Producto</th>
                                                <th className="py-2.5 px-3 text-right">Gal. Pedidos</th>
                                                <th className="py-2.5 px-3 text-right">Gal. Recibidos</th>
                                                <th className="py-2.5 px-3 text-right">Costo /gln</th>
                                                <th className="py-2.5 px-3 text-right">Flete /gln</th>
                                                <th className="py-2.5 px-3 text-right">Costo Efectivo</th>
                                                <th className="py-2.5 px-3 text-right">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-mono">
                                            <tr>
                                                <td className="py-2.5 px-3 font-sans font-semibold text-slate-700 flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                                                    Diésel
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                                                    {formatNumber(selectedOrder.p_diesel)} gln
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-slate-600">
                                                    {formatNumber(selectedOrder.r_diesel)} gln
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-slate-600">
                                                    <Money value={selectedOrder.costo_d || 0} digits={4} />
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-slate-500">
                                                    <Money value={selectedOrder.flete || 0} digits={4} />
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                                                    <Money value={(parseFloat(selectedOrder.costo_d) || 0) + (parseFloat(selectedOrder.flete) || 0)} digits={4} />
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                                    <Money value={(parseFloat(selectedOrder.estado === 'RECIBIDO' && parseFloat(selectedOrder.r_diesel) > 0 ? selectedOrder.r_diesel : selectedOrder.p_diesel) || 0) * ((parseFloat(selectedOrder.costo_d) || 0) + (parseFloat(selectedOrder.flete) || 0))} />
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2.5 px-3 font-sans font-semibold text-slate-700 flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                                    Regular
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                                                    {formatNumber(selectedOrder.p_regular)} gln
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-slate-600">
                                                    {formatNumber(selectedOrder.r_regular)} gln
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-slate-600">
                                                    <Money value={selectedOrder.costo_r || 0} digits={4} />
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-slate-500">
                                                    <Money value={selectedOrder.flete || 0} digits={4} />
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                                                    <Money value={(parseFloat(selectedOrder.costo_r) || 0) + (parseFloat(selectedOrder.flete) || 0)} digits={4} />
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-bold text-amber-800">
                                                    <Money value={(parseFloat(selectedOrder.estado === 'RECIBIDO' && parseFloat(selectedOrder.r_regular) > 0 ? selectedOrder.r_regular : selectedOrder.p_regular) || 0) * ((parseFloat(selectedOrder.costo_r) || 0) + (parseFloat(selectedOrder.flete) || 0))} />
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2.5 px-3 font-sans font-semibold text-slate-700 flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                                                    Súper
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                                                    {formatNumber(selectedOrder.p_super)} gln
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-slate-600">
                                                    {formatNumber(selectedOrder.r_super)} gln
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-slate-600">
                                                    <Money value={selectedOrder.costo_s || 0} digits={4} />
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-slate-500">
                                                    <Money value={selectedOrder.flete || 0} digits={4} />
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                                                    <Money value={(parseFloat(selectedOrder.costo_s) || 0) + (parseFloat(selectedOrder.flete) || 0)} digits={4} />
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-bold text-rose-800">
                                                    <Money value={(parseFloat(selectedOrder.estado === 'RECIBIDO' && parseFloat(selectedOrder.r_super) > 0 ? selectedOrder.r_super : selectedOrder.p_super) || 0) * ((parseFloat(selectedOrder.costo_s) || 0) + (parseFloat(selectedOrder.flete) || 0))} />
                                                </td>
                                            </tr>
                                            {parseFloat(selectedOrder.p_ion) > 0 && (
                                                <tr>
                                                    <td className="py-2.5 px-3 font-sans font-semibold text-slate-700 flex items-center gap-2">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                                                        Ion Diésel
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                                                        {formatNumber(selectedOrder.p_ion)} gln
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right text-slate-600">
                                                        {formatNumber(selectedOrder.r_ion)} gln
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right text-slate-600">
                                                        <Money value={selectedOrder.costo_i || 0} digits={4} />
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right text-slate-500">
                                                        <Money value={selectedOrder.flete || 0} digits={4} />
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                                                        <Money value={(parseFloat(selectedOrder.costo_i) || 0) + (parseFloat(selectedOrder.flete) || 0)} digits={4} />
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-bold text-indigo-800">
                                                        <Money value={(parseFloat(selectedOrder.estado === 'RECIBIDO' && parseFloat(selectedOrder.r_ion) > 0 ? selectedOrder.r_ion : selectedOrder.p_ion) || 0) * ((parseFloat(selectedOrder.costo_i) || 0) + (parseFloat(selectedOrder.flete) || 0))} />
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        <tfoot className="bg-slate-50 font-bold font-mono border-t border-slate-200">
                                            <tr>
                                                <td className="py-2.5 px-3 font-sans text-slate-800">Total</td>
                                                <td className="py-2.5 px-3 text-right text-indigo-700">
                                                    {formatNumber(selectedOrder.total_galones)} gln
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-emerald-700">
                                                    {formatNumber(
                                                        (parseFloat(selectedOrder.r_diesel) || 0) +
                                                        (parseFloat(selectedOrder.r_regular) || 0) +
                                                        (parseFloat(selectedOrder.r_super) || 0) +
                                                        (parseFloat(selectedOrder.r_ion) || 0)
                                                    )} gln
                                                </td>
                                                <td colSpan={3} className="py-2.5 px-3 text-right font-sans text-slate-500 text-[11px] uppercase">
                                                    Total Estimado / Facturado:
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-emerald-700 font-bold text-sm">
                                                    <Money value={calculateOrderCost(selectedOrder)} />
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* Payment & Discharge Info */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                        <CreditCard className="w-3.5 h-3.5" />
                                        Forma de Pago / Bancos
                                    </span>
                                    <p className="text-slate-800 font-medium leading-relaxed">
                                        {selectedOrder.forma_pago || 'No especificada'}
                                    </p>
                                </div>

                                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5" />
                                        Fecha de Descarga
                                    </span>
                                    <p className="text-slate-800 font-medium">
                                        {selectedOrder.fecha_descarga || 'No registrada'}
                                    </p>
                                </div>
                            </div>

                            {/* Document, Notes & Observations */}
                            {(selectedOrder.documento || selectedOrder.observacion || selectedOrder.ncr_numero) && (
                                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                        <FileText className="w-3.5 h-3.5" />
                                        Documentos y Observaciones
                                    </span>
                                    {selectedOrder.documento && (
                                        <p className="text-slate-700">
                                            <strong>Documento / Remisión:</strong> {selectedOrder.documento}
                                        </p>
                                    )}
                                    {selectedOrder.ncr_numero && (
                                        <p className="text-slate-700">
                                            <strong>Notas de Crédito:</strong> #{selectedOrder.ncr_numero}{' '}
                                            {parseFloat(selectedOrder.ncr_monto) > 0 && (
                                                <span className="text-emerald-700 font-bold">
                                                    (<Money value={selectedOrder.ncr_monto} />)
                                                </span>
                                            )}
                                        </p>
                                    )}
                                    {selectedOrder.observacion && (
                                        <p className="text-slate-600 italic">
                                            "{selectedOrder.observacion}"
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                {String(selectedOrder.estado || '').toUpperCase() === 'PENDIENTE' && (
                                    <button
                                        onClick={() => {
                                            const ord = selectedOrder;
                                            setSelectedOrder(null);
                                            setConfirmSeenOrder(ord);
                                        }}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>Marcar como Visto</span>
                                    </button>
                                )}

                                {String(selectedOrder.estado || '').toUpperCase() === 'VISTO' && (
                                    <button
                                        onClick={() => {
                                            const ord = selectedOrder;
                                            setSelectedOrder(null);
                                            handleInitiateReceive(ord);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                                    >
                                        <PackageCheck className="w-3.5 h-3.5" />
                                        <span>Recibir Pedido</span>
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
