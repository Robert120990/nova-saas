import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Fuel,
    X,
    RefreshCw,
    CheckCircle2,
    ArrowLeftRight,
    PackageCheck,
    Landmark,
    Plus,
    Trash2,
    Clock,
    Eye,
    Info,
} from 'lucide-react';
import Money, { MoneyInput } from '../../ui/Money';
import { unwrapList } from '../../../utils/apiUtils';

function formatNumber(val) {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('es-SV', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function getStatusBadge(estado) {
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
}

export default function GasOrderReceiveModal({
    open,
    order,
    initialMethod = 'CHEQUE',
    onClose,
    onSuccess,
}) {
    const queryClient = useQueryClient();

    const [receiveMethod, setReceiveMethod] = useState(initialMethod);
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

    // Cheques subform state
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

    // Banks query for cheques
    const { data: banksData = [] } = useQuery({
        queryKey: ['gas-station-banks'],
        queryFn: async () => {
            const res = await axios.get('/api/gas-station/banks');
            return unwrapList(res);
        },
        enabled: open,
        staleTime: 10 * 60 * 1000,
    });

    // Bank accounts query (filtered by selected bank)
    const { data: bankAccountsData = [] } = useQuery({
        queryKey: ['gas-station-accounts', selectedBank],
        queryFn: async () => {
            const params = selectedBank ? { bank_id: selectedBank } : {};
            const res = await axios.get('/api/gas-station/bank-accounts', { params });
            return unwrapList(res);
        },
        enabled: open,
        staleTime: 5 * 60 * 1000,
    });

    // All active bank accounts (for transfer dropdown)
    const { data: allBankAccountsData = [] } = useQuery({
        queryKey: ['gas-station-all-accounts'],
        queryFn: async () => {
            const res = await axios.get('/api/gas-station/bank-accounts');
            return unwrapList(res);
        },
        enabled: open,
        staleTime: 5 * 60 * 1000,
    });

    // Initialize form when order or method changes
    useEffect(() => {
        if (!open || !order) return;

        setReceiveMethod(initialMethod);

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

        setTransferForm({
            numero_cuenta: '',
            referencia: '',
            monto: initialPayment,
            fecha_pago: defaultDate,
            concepto: docDefault ? `PAGO DE PIPA CCF# ${docDefault}` : '',
        });

        // Fetch existing vouchers or transfer movement
        if (initialMethod === 'CHEQUE') {
            axios.get(`/api/gas-station/orders/${order.id}/vouchers`)
                .then(vRes => {
                    const loadedVouchers = (vRes.data?.data || []).map(v => ({
                        numero_cuenta: v.numero_cuenta,
                        nombre_cuenta: v.nombre_cuenta || v.numero_cuenta,
                        cheque: v.cheque,
                        valor: parseFloat(v.valor) || 0,
                        concepto: v.concepto || '',
                    }));
                    setChequesList(loadedVouchers);
                })
                .catch(() => {
                    setChequesList([]);
                });
        } else {
            axios.get(`/api/gas-station/orders/${order.id}/transfer`)
                .then(tRes => {
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
                })
                .catch(() => {});
        }
    }, [open, order, initialMethod]);

    // Auto update transfer observation string following frm_descarga_pedido2.vb
    useEffect(() => {
        if (receiveMethod === 'TRANSFERENCIA' && order) {
            const numCta = (transferForm.numero_cuenta || '').trim();
            const ctaLast4 = numCta.length >= 4 ? numCta.slice(-4) : numCta;
            const montoNum = parseFloat(transferForm.monto) || 0;
            const baseForma = (order.forma_pago || '').trim();

            if (numCta && montoNum > 0) {
                const montoFmt = montoNum.toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                setReceiveForm(prev => ({
                    ...prev,
                    observacion: `${baseForma}**TRANSF. #${ctaLast4} - $${montoFmt}**`
                }));
            }
        }
    }, [receiveMethod, order, transferForm.numero_cuenta, transferForm.monto]);

    // Update concepts when document number changes
    useEffect(() => {
        if (receiveForm.documento) {
            const defaultConcept = `PAGO DE PIPA CCF# ${receiveForm.documento.trim()}`;
            setChequeForm(prev => prev.concepto ? prev : { ...prev, concepto: defaultConcept });
            setTransferForm(prev => prev.concepto ? prev : { ...prev, concepto: defaultConcept });
        }
    }, [receiveForm.documento]);

    // Receive Order Mutation
    const receiveOrderMutation = useMutation({
        mutationFn: async (payload) => {
            const res = await axios.patch(`/api/gas-station/orders/${order.id}/receive`, payload);
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data?.message || 'Pedido recibido exitosamente');
            queryClient.invalidateQueries({ queryKey: ['gas-orders'] });
            if (onSuccess) {
                onSuccess(data);
            }
            onClose();
        },
        onError: (err) => {
            toast.error(err.response?.data?.error || 'Error al registrar recepción del pedido');
        }
    });

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
        if (!order) return;

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
            numero_cuenta: transferForm.numero_cuenta,
            referencia: transferForm.referencia.trim(),
            monto: parseFloat(transferForm.monto) || 0,
            fecha_pago: transferForm.fecha_pago || receiveForm.fecha_descarga,
            concepto: transferForm.concepto.trim() || `PAGO DE PIPA CCF# ${receiveForm.documento.trim()}`,
        };

        receiveOrderMutation.mutate(payload);
    };

    if (!open || !order) return null;

    const totalCheques = chequesList.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0);
    const cuponesVal = parseFloat(receiveForm.cupones) || 0;
    const ncrMontoVal = parseFloat(receiveForm.ncr_monto) || 0;
    const pagoTotal = totalCheques + cuponesVal + ncrMontoVal;

    return (
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
                                Recibir Pedido #{order.numero || order.id}
                                {getStatusBadge(order.estado)}
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
                            onClick={onClose}
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
                                {order.forma_pago || 'CREDITO'}
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
                                            Ped: {formatNumber(order.p_diesel)} gln
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
                                            Ped: {formatNumber(order.p_regular)} gln
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
                                            Ped: {formatNumber(order.p_super)} gln
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
                                            Ped: {formatNumber(order.p_ion)} gln
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
                                                                className="p-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
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
                            onClick={onClose}
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
    );
}
