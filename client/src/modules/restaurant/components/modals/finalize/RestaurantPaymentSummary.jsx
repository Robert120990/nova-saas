import { DollarSign, CreditCard, Landmark, Layers } from 'lucide-react';
import Money, { MoneyInput } from '../../../../../components/ui/Money';

const PAYMENT_METHODS = [
    { code: '01', label: 'Efectivo', icon: DollarSign },
    { code: '02', label: 'T. Débito', icon: CreditCard },
    { code: '03', label: 'T. Crédito', icon: CreditCard },
    { code: '05', label: 'Transferencia', icon: Landmark },
    { code: 'split', label: 'Mixto', icon: Layers }
];

export default function RestaurantPaymentSummary({
    netSubtotal,
    discount,
    tipAmount,
    onTipChange,
    total,
    paymentMethod,
    onPaymentMethodChange,
    paymentReference = '',
    onPaymentReferenceChange = () => {},
    cashGiven,
    onCashGivenChange,
    changeDue,
    splitCashAmount = '',
    onSplitCashAmountChange = () => {},
    splitSecondMethod = '02',
    onSplitSecondMethodChange = () => {}
}) {
    const applyQuickTipPercent = (pct) => {
        const calculated = Number(((netSubtotal * pct) / 100).toFixed(2));
        onTipChange(calculated);
    };

    const quickCashBills = [5, 10, 20, 50, 100].filter(b => b >= total);

    const splitCashNum = parseFloat(splitCashAmount) || 0;
    const splitRemainder = Math.max(0, Number((total - splitCashNum).toFixed(2)));

    return (
        <div className="space-y-4">
            {/* Propina Voluntaria */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <span className="text-xs font-black text-slate-800 block">Propina Voluntaria</span>
                        <span className="text-[10px] text-slate-400">Viaja al DTE en totalNoGravado sin afectar base del IVA</span>
                    </div>
                    <div className="w-32">
                        <MoneyInput
                            value={tipAmount}
                            onChange={onTipChange}
                            className="w-full text-right py-1.5 px-3 rounded-xl border border-slate-300 text-xs font-black bg-white"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Sugerencias:</span>
                    <button
                        type="button"
                        onClick={() => applyQuickTipPercent(10)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-slate-200 hover:bg-indigo-50 text-slate-700"
                    >
                        10%
                    </button>
                    <button
                        type="button"
                        onClick={() => applyQuickTipPercent(15)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-slate-200 hover:bg-indigo-50 text-slate-700"
                    >
                        15%
                    </button>
                    <button
                        type="button"
                        onClick={() => onTipChange(0)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-slate-200 hover:bg-rose-50 text-rose-600"
                    >
                        0% (Exonerar)
                    </button>
                </div>
            </div>

            {/* Forma de Pago y Liquidación */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                        Forma de Pago
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                        {PAYMENT_METHODS.map((m) => {
                            const Icon = m.icon;
                            const isSelected = paymentMethod === m.code;
                            return (
                                <button
                                    key={m.code}
                                    type="button"
                                    onClick={() => onPaymentMethodChange(m.code)}
                                    className={`p-2 rounded-xl border text-[11px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                                        isSelected
                                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <Icon size={14} />
                                    <span className="truncate max-w-full">{m.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Efectivo Estándar */}
                    {paymentMethod === '01' && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                            <span className="text-[10px] text-slate-500 font-bold block">Efectivo Recibido (Cálculo de cambio):</span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={cashGiven}
                                    onChange={(e) => onCashGivenChange(e.target.value)}
                                    placeholder={`$${total.toFixed(2)}`}
                                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                />
                                {parseFloat(cashGiven) > total && (
                                    <span className="text-[11px] font-black text-emerald-600 shrink-0">
                                        Cambio: <Money value={changeDue} />
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                <button
                                    type="button"
                                    onClick={() => onCashGivenChange(total.toFixed(2))}
                                    className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50"
                                >
                                    Exacto
                                </button>
                                {quickCashBills.slice(0, 3).map(bill => (
                                    <button
                                        key={bill}
                                        type="button"
                                        onClick={() => onCashGivenChange(String(bill))}
                                        className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50"
                                    >
                                        ${bill}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tarjeta de Débito o Crédito */}
                    {(paymentMethod === '02' || paymentMethod === '03') && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-600 block">
                                N° Autorización / Voucher / 4 últimos dígitos (opcional):
                            </label>
                            <input
                                type="text"
                                maxLength={50}
                                value={paymentReference}
                                onChange={(e) => onPaymentReferenceChange(e.target.value)}
                                placeholder="Ej: AUTH-98432 o 4321"
                                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                            />
                        </div>
                    )}

                    {/* Transferencia Bancaria */}
                    {paymentMethod === '05' && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-600 block">
                                N° Referencia / Comprobante Bancario:
                            </label>
                            <input
                                type="text"
                                maxLength={50}
                                value={paymentReference}
                                onChange={(e) => onPaymentReferenceChange(e.target.value)}
                                placeholder="Ej: TR-00984128"
                                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                            />
                        </div>
                    )}

                    {/* Pago Mixto (Efectivo + Tarjeta/Transferencia) */}
                    {paymentMethod === 'split' && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                            <span className="text-[10px] font-bold text-slate-700 block uppercase">
                                Desglose de Pago Combinado
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-[10px] text-slate-500 block">Parte Efectivo ($):</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={splitCashAmount}
                                        onChange={(e) => onSplitCashAmountChange(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white"
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-500 block">Restante con otro medio:</span>
                                    <div className="py-1 px-2.5 text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg">
                                        <Money value={splitRemainder} />
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <select
                                    value={splitSecondMethod}
                                    onChange={(e) => onSplitSecondMethodChange(e.target.value)}
                                    className="px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white"
                                >
                                    <option value="02">Tarjeta Débito (02)</option>
                                    <option value="03">Tarjeta Crédito (03)</option>
                                    <option value="05">Transferencia (05)</option>
                                </select>
                                <input
                                    type="text"
                                    value={paymentReference}
                                    onChange={(e) => onPaymentReferenceChange(e.target.value)}
                                    placeholder="N° Referencia / Voucher"
                                    className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Resumen de totales */}
                <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>Consumo (Alimentos/Bebidas):</span>
                            <span className="text-white font-medium"><Money value={netSubtotal} /></span>
                        </div>
                        {discount > 0 && (
                            <div className="flex justify-between text-xs text-rose-400">
                                <span>Descuento aplicado:</span>
                                <span>-<Money value={discount} /></span>
                            </div>
                        )}
                        <div className="flex justify-between text-xs text-indigo-300">
                            <span>Propina Voluntaria:</span>
                            <span>+<Money value={tipAmount} /></span>
                        </div>
                    </div>

                    <div className="border-t border-slate-800 pt-3">
                        <div className="flex justify-between items-baseline">
                            <span className="text-xs font-bold text-slate-300 uppercase">Total a Liquidar:</span>
                            <span className="text-xl font-black text-emerald-400"><Money value={total} /></span>
                        </div>
                        <span className="text-[10px] text-slate-500 block pt-1">
                            Método registrado: {PAYMENT_METHODS.find(m => m.code === paymentMethod)?.label || paymentMethod}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
