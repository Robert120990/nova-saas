import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Modal from '../ui/Modal';

/**
 * GeneralDiscountDialog Component
 * Modal to configure and apply a general discount across the entire sale ticket (F8 shortcut).
 */
const GeneralDiscountDialog = ({ 
    isOpen, 
    onClose, 
    currentDiscount, 
    currentDiscountPercentage = null,
    onApply, 
    onRemove, 
    gravadoBruto, 
    branchPercentages, 
    maxDiscountAmount, 
    maxDiscountPercentage,
    currentCartTotalDiscounts = 0
}) => {
    const [mode, setMode] = useState('percentage'); // 'percentage' | 'amount'
    const [inputValue, setInputValue] = useState('');

    useEffect(() => {
        if (currentDiscountPercentage !== null && currentDiscountPercentage !== undefined && currentDiscountPercentage > 0) {
            setMode('percentage');
            setInputValue(currentDiscountPercentage.toString());
        } else if (currentDiscount > 0 && gravadoBruto > 0) {
            const pct = (currentDiscount / gravadoBruto) * 100;
            if (Math.abs(pct - Math.round(pct)) <= 0.1) {
                setMode('percentage');
                setInputValue(Math.round(pct).toString());
            } else {
                setMode('amount');
                setInputValue(currentDiscount.toString());
            }
        } else {
            setInputValue('');
        }
    }, [currentDiscount, currentDiscountPercentage, gravadoBruto, isOpen]);

    const numericInput = parseFloat(inputValue) || 0;
    let computedDiscount = 0;
    if (mode === 'percentage') {
        computedDiscount = Math.round((gravadoBruto * (numericInput / 100)) * 100) / 100;
    } else {
        computedDiscount = numericInput;
    }
    computedDiscount = Math.min(computedDiscount, gravadoBruto);
    const newGravado = Math.max(0, gravadoBruto - computedDiscount);
    const effectivePct = gravadoBruto > 0 ? (computedDiscount / gravadoBruto) * 100 : 0;

    // Descuentos acumulados en ítems del carrito
    const otherDiscounts = currentCartTotalDiscounts || 0;
    const projectedSaleDiscounts = otherDiscounts + computedDiscount;
    const remainingTicketCupo = maxDiscountAmount !== null ? Math.max(0, maxDiscountAmount - otherDiscounts) : null;

    const handleApply = () => {
        if (computedDiscount <= 0) {
            toast.error('Ingrese un valor de descuento mayor a cero');
            return;
        }
        if (computedDiscount > gravadoBruto) {
            toast.error(`El descuento no puede superar el total gravado disponible ($${gravadoBruto.toFixed(2)})`);
            return;
        }
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
        onApply(computedDiscount, mode === 'percentage' ? numericInput : null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Descuento General de la Venta (F8)" maxWidth="max-w-md">
            <div className="space-y-4">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                        <span>Base Gravada Disponible:</span>
                        <span className="text-sm font-bold text-slate-800 font-mono">${gravadoBruto.toFixed(2)}</span>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200 leading-relaxed">
                        El descuento general se aplica sobre operaciones gravadas (DTE Normativa 2.0). Los impuestos específicos a combustibles (FOVIAL/COTRANS) no son descontables.
                    </div>
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

                {/* Tabs Porcentaje / Monto */}
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
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
                        Monto Fijo ($)
                    </button>
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
                        {mode === 'percentage' ? 'Porcentaje de Descuento General (%)' : 'Monto de Descuento General ($)'}
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            step={mode === 'percentage' ? '1' : '0.01'}
                            min="0"
                            max={mode === 'percentage' ? (maxDiscountPercentage || 100) : (remainingTicketCupo !== null ? Math.min(remainingTicketCupo, gravadoBruto) : gravadoBruto)}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={mode === 'percentage' ? 'Ej: 10' : 'Ej: 15.00'}
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
                        <span>Descuento global resultante:</span>
                        <span className="font-bold text-rose-600">-${computedDiscount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Porcentaje efectivo:</span>
                        <span className={`font-mono font-bold ${maxDiscountPercentage && effectivePct > maxDiscountPercentage ? 'text-rose-600' : 'text-slate-700'}`}>
                            {effectivePct.toFixed(1)}% {maxDiscountPercentage ? `(Máx. ${maxDiscountPercentage}%)` : ''}
                        </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-900 font-bold border-t border-indigo-100 pt-1">
                        <span>Nuevo Gravado Final:</span>
                        <span className="font-black text-indigo-700 font-mono">${newGravado.toFixed(2)}</span>
                    </div>
                </div>

                {/* Botones de acción */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    {currentDiscount > 0 && (
                        <button
                            type="button"
                            onClick={() => { onRemove(); onClose(); }}
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
                        Aplicar Descuento
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default GeneralDiscountDialog;
