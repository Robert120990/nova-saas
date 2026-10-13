import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowRight, Loader2 } from 'lucide-react';
import { unwrapList } from '../../../../utils/apiUtils';
import {
    calculateOrderFinalTotals,
    validateDtePrerequisites,
    adaptOrderToSalePayload
} from '../../adapters/restaurantDteAdapter';
import {
    RestaurantDteSelector,
    RestaurantCcfCustomerPicker,
    RestaurantPaymentSummary
} from './finalize';

export default function RestaurantFinalizeModal({
    isOpen,
    onClose,
    order,
    branchId,
    user,
    onSuccess
}) {
    // Regla obligatoria: Selección DTE (01 Factura, 03 Crédito Fiscal, none Sin DTE)
    const [dteType, setDteType] = useState('01');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('01'); // 01 Efectivo, 02 Débito, 03 Crédito, 05 Transferencia, split Mixto
    const [paymentReference, setPaymentReference] = useState('');
    const [splitCashAmount, setSplitCashAmount] = useState('');
    const [splitSecondMethod, setSplitSecondMethod] = useState('02');
    const [tipAmount, setTipAmount] = useState(Number(order?.tip_amount || 0));
    const [cashGiven, setCashGiven] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!order) return;
        setTipAmount(Number(order.tip_amount || 0));
        setDteType('01');
        setSelectedCustomer(null);
        setCustomerSearch('');
        setPaymentMethod('01');
        setPaymentReference('');
        setSplitCashAmount('');
        setSplitSecondMethod('02');
        setCashGiven('');
    }, [order]);

    // Búsqueda de clientes para Crédito Fiscal (03)
    const { data: rawCustomers = [] } = useQuery({
        queryKey: ['customers-list-restaurant'],
        queryFn: async () => unwrapList(await axios.get('/api/customers')),
        enabled: Boolean(isOpen && order && dteType === '03')
    });

    const customers = useMemo(() => {
        const list = Array.isArray(rawCustomers) ? rawCustomers : [];
        if (!customerSearch.trim()) return list.slice(0, 15);
        const q = customerSearch.toLowerCase();
        return list.filter(c =>
            (c.nombre || '').toLowerCase().includes(q) ||
            (c.nrc || '').toLowerCase().includes(q) ||
            (c.nit || '').toLowerCase().includes(q)
        ).slice(0, 15);
    }, [rawCustomers, customerSearch]);

    const { netSubtotal, discount, total } = useMemo(() => {
        if (!order) return { netSubtotal: 0, discount: 0, total: 0 };
        return calculateOrderFinalTotals(order, tipAmount);
    }, [order, tipAmount]);

    const changeDue = useMemo(() => {
        const given = parseFloat(cashGiven) || 0;
        return Math.max(0, given - total);
    }, [cashGiven, total]);

    const handleConfirmFinalize = async () => {
        // 1. Validaciones previas del adaptador
        const validationError = validateDtePrerequisites(dteType, selectedCustomer);
        if (validationError) {
            toast.error(validationError);
            return;
        }

        // Validación de pago mixto
        let paymentsList = null;
        if (paymentMethod === 'split') {
            const splitCashNum = parseFloat(splitCashAmount) || 0;
            const splitRemainder = Math.max(0, Number((total - splitCashNum).toFixed(2)));
            if (splitCashNum <= 0 || splitRemainder <= 0) {
                toast.error('En pago mixto debe indicar una cantidad válida para efectivo y restante.');
                return;
            }
            paymentsList = [
                { codigo: '01', metodo_pago: '01', monto: splitCashNum },
                { codigo: splitSecondMethod, metodo_pago: splitSecondMethod, monto: splitRemainder, referencia: paymentReference || null }
            ];
        }

        setIsSubmitting(true);
        try {
            if (dteType === 'none') {
                // Opción: Cerrar comanda sin emisión de DTE fiscal
                await axios.put(`/api/restaurant/orders/${order.id}/close`, {
                    status: 'facturada',
                    tip_amount: tipAmount,
                    total_with_tip: total
                });
                toast.success('Comanda finalizada sin DTE fiscal.');
                onSuccess?.();
                onClose();
            } else {
                // Opción: Emitir DTE (Factura o CCF) usando el Adaptador
                const salePayload = adaptOrderToSalePayload(order, {
                    dteType,
                    customer: selectedCustomer,
                    paymentMethod,
                    paymentReference,
                    paymentsList,
                    tipAmount,
                    branchId,
                    userId: user?.id
                });

                const saleRes = await axios.post('/api/sales', salePayload);
                const createdSale = saleRes.data?.data || saleRes.data;
                const saleId = createdSale?.id || createdSale?.saleId || createdSale?.sale_id || null;

                // Cerrar comanda al persistirse la venta con propina final y enlace al DTE
                await axios.put(`/api/restaurant/orders/${order.id}/close`, {
                    status: 'facturada',
                    sale_id: saleId,
                    tip_amount: tipAmount,
                    total_with_tip: total
                });

                const tipoNombre = dteType === '01' ? 'Factura Electrónica' : 'Crédito Fiscal';
                if (createdSale?.codigo_generacion) {
                    toast.success(`¡${tipoNombre} emitida y procesada por Hacienda!`, {
                        description: `Control: ${createdSale.numero_control || 'Generado'} | CG: ${createdSale.codigo_generacion.slice(0, 8)}...`
                    });
                } else {
                    toast.success(`¡${tipoNombre} registrada exitosamente!`);
                }

                onSuccess?.(createdSale);
                onClose();
            }
        } catch (err) {
            console.error('Error al finalizar comanda:', err);
            const msg = err.response?.data?.message || err.response?.data?.error || 'Error al procesar el cobro y emisión';
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !order) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
                {/* Cabecera */}
                <div className="px-6 py-4 bg-linear-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-indigo-300">Finalizar Cuenta & Liquidación</span>
                        <h3 className="text-lg font-black flex items-center gap-2">
                            <span>Comanda #{order.id}</span>
                            {order.table_number && (
                                <span className="bg-indigo-500/30 text-indigo-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
                                    Mesa {order.table_number}
                                </span>
                            )}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/10 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Contenido con Scroll */}
                <div className="p-6 overflow-y-auto space-y-5 flex-1">
                    {/* Pregunta Regla: Selector DTE */}
                    <RestaurantDteSelector
                        dteType={dteType}
                        onSelectType={setDteType}
                    />

                    {/* Selector de Cliente si es Crédito Fiscal */}
                    {dteType === '03' && (
                        <RestaurantCcfCustomerPicker
                            selectedCustomer={selectedCustomer}
                            onSelectCustomer={(c) => { setSelectedCustomer(c); setCustomerSearch(c.nombre); }}
                            customerSearch={customerSearch}
                            onSearchChange={setCustomerSearch}
                            customers={customers}
                        />
                    )}

                    {/* Propina, Método de Pago y Resumen de Totales */}
                    <RestaurantPaymentSummary
                        netSubtotal={netSubtotal}
                        discount={discount}
                        tipAmount={tipAmount}
                        onTipChange={setTipAmount}
                        total={total}
                        paymentMethod={paymentMethod}
                        onPaymentMethodChange={setPaymentMethod}
                        paymentReference={paymentReference}
                        onPaymentReferenceChange={setPaymentReference}
                        cashGiven={cashGiven}
                        onCashGivenChange={setCashGiven}
                        changeDue={changeDue}
                        splitCashAmount={splitCashAmount}
                        onSplitCashAmountChange={setSplitCashAmount}
                        splitSecondMethod={splitSecondMethod}
                        onSplitSecondMethodChange={setSplitSecondMethod}
                    />
                </div>

                {/* Footer Acciones */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirmFinalize}
                        disabled={isSubmitting}
                        className={`px-6 py-2.5 rounded-xl text-white text-xs font-black shadow-md flex items-center gap-2 transition-all ${
                            dteType === 'none'
                                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
                                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                        } disabled:opacity-50`}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                <span>Transmitiendo...</span>
                            </>
                        ) : (
                            <>
                                <span>{dteType === 'none' ? 'Finalizar sin DTE' : `Emitir ${dteType === '01' ? 'Factura' : 'CCF'} y Cerrar`}</span>
                                <ArrowRight size={14} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
