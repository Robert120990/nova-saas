import { useState, useEffect } from 'react';
import { Tag } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../ui/Modal';

/**
 * ItemDiscountDialog Component
 * Modal to configure and apply percentage, amount, or per-unit discounts on a specific cart line item.
 */
const ItemDiscountDialog = ({ 
    item, 
    onClose, 
    onApply, 
    onRemove, 
    branchPercentages, 
    maxDiscountAmount, 
    maxDiscountPercentage,
    currentCartTotalDiscounts = 0,
    currentGeneralDiscount = 0,
}) => {
    const qty = parseFloat(item.cantidad) || 0;
    const price = parseFloat(item.precio) || 0;
    const lineGross = qty * price;
    const isFuel = item.tipo_combustible > 0;
    const fovial = isFuel ? Math.round(qty * 0.20 * 100) / 100 : 0;
    const cotrans = isFuel ? Math.round(qty * 0.10 * 100) / 100 : 0;
    const fuelTaxes = fovial + cotrans;
    const discountableBase = Math.max(0, lineGross - fuelTaxes);
    const unitDiscountableBase = qty > 0 ? (discountableBase / qty) : 0;

    const [mode, setMode] = useState('percentage'); // 'percentage' | 'amount' | 'unit_amount'
    const [inputValue, setInputValue] = useState('');

    useEffect(() => {
        if (item.descuento > 0 && discountableBase > 0) {
            const pct = (item.descuento / discountableBase) * 100;
            if (Math.abs(pct - Math.round(pct)) < 0.05) {
                setMode('percentage');
                setInputValue(Math.round(pct).toString());
            } else {
                setMode('amount');
                setInputValue(item.descuento.toString());
            }
        } else {
            setInputValue('');
        }
    }, [item, discountableBase]);

    const numericInput = parseFloat(inputValue) || 0;
    let computedDiscount = 0;
    if (mode === 'percentage') {
        computedDiscount = Math.round((discountableBase * (numericInput / 100)) * 100) / 100;
    } else if (mode === 'unit_amount') {
        computedDiscount = Math.round((numericInput * qty) * 100) / 100;
    } else {
        computedDiscount = numericInput;
    }
    computedDiscount = Math.min(computedDiscount, discountableBase);
    const newLineTotal = Math.max(0, lineGross - computedDiscount);
    const effectivePct = discountableBase > 0 ? (computedDiscount / discountableBase) * 100 : 0;
    const effectiveUnitDiscount = qty > 0 ? (computedDiscount / qty) : 0;

    // Descuentos ya otorgados a otros productos de la venta
    const otherDiscounts = Math.max(0, (currentCartTotalDiscounts || 0) - (parseFloat(item.descuento) || 0)) + (currentGeneralDiscount || 0);
    const projectedSaleDiscounts = otherDiscounts + computedDiscount;
    const remainingTicketCupo = maxDiscountAmount !== null ? Math.max(0, maxDiscountAmount - otherDiscounts) : null;

    const handleApply = () => {
        if (computedDiscount <= 0) {
            toast.error('Ingrese un valor de descuento mayor a cero');
            return;
        }
        if (computedDiscount > discountableBase) {
            toast.error(`El descuento no puede superar la base gravada disponible ($${discountableBase.toFixed(2)})`);
            return;
        }
        const isFromRule = item.discountRule && (
            (mode === 'percentage' && Math.abs(numericInput - parseFloat(item.discountRule.discount_value)) < 0.01) ||
            (mode === 'amount' && (
                Math.abs(computedDiscount - Math.round((parseFloat(item.discountRule.discount_value) * qty) * 100) / 100) < 0.02 ||
                Math.abs(computedDiscount - Math.round((discountableBase * (parseFloat(item.discountRule.discount_value) / 100)) * 100) / 100) < 0.02
            ))
        );

        if (!isFromRule) {
            // 1. Tope de Margen (%): Valida que el porcentaje efectivo no exceda el % máximo permitido
            if (maxDiscountPercentage && effectivePct > (maxDiscountPercentage + 0.01)) {
                toast.error(`El descuento representa un ${effectivePct.toFixed(1)}%, superando el porcentaje máximo permitido (${maxDiscountPercentage}%)`);
                return;
            }

            // 2. Tope Acumulado por Ticket ($): Valida que el total acumulado en la venta no supere el monto máximo
            if (maxDiscountAmount && projectedSaleDiscounts > (maxDiscountAmount + 0.01)) {
                toast.error(`El descuento total acumulado de la venta ($${projectedSaleDiscounts.toFixed(2)}) excede el monto máximo permitido por ticket ($${maxDiscountAmount.toFixed(2)}). Cupo disponible: $${(remainingTicketCupo || 0).toFixed(2)}`);
                return;
            }
        }
        onApply(item.id, computedDiscount);
        onClose();
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Descuento por Producto" maxWidth="max-w-md">
            <div className="space-y-4">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <div className="font-bold text-slate-900 text-sm">{item.nombre}</div>
                    <div className="text-xs text-slate-500 mt-1 flex justify-between font-mono">
                        <span>{qty} x ${price.toFixed(2)} = ${lineGross.toFixed(2)}</span>
                        {isFuel && (
                            <span className="text-amber-600 font-bold">FOV/COT: ${fuelTaxes.toFixed(2)}</span>
                        )}
                    </div>
                    {isFuel && (
                        <div className="mt-2 text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200/80 leading-snug">
                            Los impuestos FOVIAL y COTRANS no son descontables por ley. Base máxima descontable: <strong>${discountableBase.toFixed(2)}</strong>.
                        </div>
                    )}
                </div>

                {/* Límites de Sucursal */}
                {(maxDiscountPercentage || maxDiscountAmount) && (
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {maxDiscountPercentage && (
                            <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100">
                                Máx. Margen: {maxDiscountPercentage}%
                            </span>
                        )}
                        {maxDiscountAmount && (
                            <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100">
                                Tope Ticket: ${maxDiscountAmount.toFixed(2)} {remainingTicketCupo !== null && `(Disp: $${remainingTicketCupo.toFixed(2)})`}
                            </span>
                        )}
                    </div>
                )}

                {/* Regla de Descuento Configurada para el Producto */}
                {item.discountRule && (
                    <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                                <Tag size={16} />
                            </div>
                            <div className="min-w-0">
                                <div className="text-xs font-bold text-amber-900 truncate">
                                    Regla de Producto Configurada
                                </div>
                                <div className="text-[11px] text-amber-700 font-medium">
                                    {item.discountRule.discount_type === 'percentage'
                                        ? `${parseFloat(item.discountRule.discount_value)}% de descuento`
                                        : `$${parseFloat(item.discountRule.discount_value).toFixed(2)} por unidad`
                                    }
                                    {qty > 1 && (
                                        <span> (Total: ${(() => {
                                            if (item.discountRule.discount_type === 'percentage') {
                                                return (Math.round((discountableBase * (parseFloat(item.discountRule.discount_value) / 100)) * 100) / 100).toFixed(2);
                                            } else {
                                                return Math.min(Math.round((parseFloat(item.discountRule.discount_value) * qty) * 100) / 100, discountableBase).toFixed(2);
                                            }
                                        })()})</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                if (item.discountRule.discount_type === 'percentage') {
                                    setMode('percentage');
                                    setInputValue(parseFloat(item.discountRule.discount_value).toString());
                                } else {
                                    setMode('amount');
                                    const fixedTotal = Math.min(Math.round((parseFloat(item.discountRule.discount_value) * qty) * 100) / 100, discountableBase);
                                    setInputValue(fixedTotal.toFixed(2));
                                }
                            }}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all whitespace-nowrap shadow-sm active:scale-95"
                        >
                            Usar Regla
                        </button>
                    </div>
                )}

                {/* Tabs Porcentaje / Monto Total / Por Unidad */}
                <div className={`grid ${qty > 1 ? 'grid-cols-3' : 'grid-cols-2'} gap-1 p-1 bg-slate-100 rounded-xl`}>
                    <button
                        type="button"
                        onClick={() => { setMode('percentage'); setInputValue(''); }}
                        className={`py-2 text-xs font-bold rounded-lg transition-all ${
                            mode === 'percentage' 
                                ? 'bg-white text-indigo-600 shadow-sm' 
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Porcentaje (%)
                    </button>
                    <button
                        type="button"
                        onClick={() => { setMode('amount'); setInputValue(''); }}
                        className={`py-2 text-xs font-bold rounded-lg transition-all ${
                            mode === 'amount' 
                                ? 'bg-white text-indigo-600 shadow-sm' 
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        {qty > 1 ? 'Total Línea ($)' : 'Monto Fijo ($)'}
                    </button>
                    {qty > 1 && (
                        <button
                            type="button"
                            onClick={() => { setMode('unit_amount'); setInputValue(''); }}
                            className={`py-2 text-xs font-bold rounded-lg transition-all ${
                                mode === 'unit_amount' 
                                ? 'bg-white text-indigo-600 shadow-sm' 
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Por Unidad ($/u)
                        </button>
                    )}
                </div>

                {/* Botones de porcentajes rápidos */}
                {mode === 'percentage' && branchPercentages?.length > 0 && (
                    <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">Porcentajes Rápidos</span>
                        <div className="grid grid-cols-4 gap-2">
                            {branchPercentages.map((pct) => {
                                const isOverLimit = maxDiscountPercentage && pct > maxDiscountPercentage;
                                return (
                                    <button
                                        key={pct}
                                        type="button"
                                        disabled={isOverLimit}
                                        onClick={() => setInputValue(pct.toString())}
                                        className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                                            inputValue === pct.toString()
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                                                : isOverLimit
                                                    ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400'
                                                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                                        }`}
                                    >
                                        {pct}%
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Input de Valor */}
                <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">
                        {mode === 'percentage' 
                            ? 'Porcentaje a Descontar (%)' 
                            : mode === 'unit_amount' 
                            ? `Monto a Descontar por Unidad ($/u) [x ${qty} u]` 
                            : 'Monto Total de la Línea en Dólares ($)'}
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            step={mode === 'percentage' ? '1' : '0.01'}
                            min="0"
                            max={
                                mode === 'percentage' 
                                    ? (maxDiscountPercentage || 100) 
                                    : mode === 'unit_amount' 
                                    ? unitDiscountableBase 
                                    : discountableBase
                            }
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={mode === 'percentage' ? 'Ej: 10' : mode === 'unit_amount' ? 'Ej: 1.00' : 'Ej: 5.00'}
                            className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400"
                            autoFocus
                        />
                        <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">
                            {mode === 'percentage' ? '%' : '$'}
                        </span>
                    </div>
                </div>

                {/* Preview */}
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100/80 space-y-1">
                    <div className="flex justify-between text-xs text-slate-600">
                        <span>Descuento total aplicado:</span>
                        <span className="font-bold text-rose-600">-${computedDiscount.toFixed(2)}</span>
                    </div>
                    {qty > 1 && (
                        <div className="flex justify-between text-[11px] text-slate-500">
                            <span>Descuento unitario equivalente:</span>
                            <span className="font-mono font-semibold text-slate-700">-${effectiveUnitDiscount.toFixed(2)} / u</span>
                        </div>
                    )}
                    <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Porcentaje efectivo:</span>
                        <span className={`font-mono font-bold ${maxDiscountPercentage && effectivePct > maxDiscountPercentage ? 'text-rose-600' : 'text-slate-700'}`}>
                            {effectivePct.toFixed(1)}% {maxDiscountPercentage ? `(Máx. ${maxDiscountPercentage}%)` : ''}
                        </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-900 font-bold border-t border-indigo-100 pt-1">
                        <span>Nuevo Total del Ítem:</span>
                        <span className="font-black text-indigo-700 font-mono">${newLineTotal.toFixed(2)}</span>
                    </div>
                </div>

                {/* Botones de acción */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    {item.descuento > 0 && (
                        <button
                            type="button"
                            onClick={() => { onRemove(item.id); onClose(); }}
                            className="px-3 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-rose-200"
                        >
                            Quitar
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleApply}
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-indigo-200"
                    >
                        Aplicar
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ItemDiscountDialog;
