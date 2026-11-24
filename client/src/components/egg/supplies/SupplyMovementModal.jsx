import { useState, useEffect, useMemo } from 'react';
import { X, ArrowUpDown, CheckCircle2 } from 'lucide-react';
import Money, { MoneyInput } from '../../ui/Money';
import { getTodayString } from '../../../utils/dateUtils';

export default function SupplyMovementModal({
    open,
    onClose,
    onSave,
    supply = null,
    supplies = [],
    batches = [],
    defaultType = 'entrada_compra',
    isSubmitting = false
}) {
    const [selectedSupplyId, setSelectedSupplyId] = useState('');
    const [movementType, setMovementType] = useState('entrada_compra');
    const [quantity, setQuantity] = useState('');
    const [unitCost, setUnitCost] = useState(0);
    const [movementDate, setMovementDate] = useState('');
    const [referenceDoc, setReferenceDoc] = useState('');
    const [selectedBatchId, setSelectedBatchId] = useState('');
    const [providerName, setProviderName] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (!open) return;
        const target = supply || supplies[0] || null;
        setSelectedSupplyId(target ? String(target.id) : '');
        setMovementType(defaultType || 'entrada_compra');
        setQuantity(
            defaultType === 'salida_cip' && target?.dose_per_batch > 0
                ? String(target.dose_per_batch)
                : ''
        );
        setUnitCost(target?.unit_cost ?? 0);
        setMovementDate(getTodayString(new Date()));
        setReferenceDoc('');
        setSelectedBatchId('');
        setProviderName('');
        setNotes('');
    }, [open, supply, supplies, defaultType]);

    const activeSupply = useMemo(
        () => (Array.isArray(supplies) ? supplies : []).find(s => String(s.id) === String(selectedSupplyId)) || supply,
        [supplies, selectedSupplyId, supply]
    );

    const isOutbound = ['salida_produccion', 'salida_cip', 'ajuste_negativo'].includes(movementType);
    const numQty = Math.max(0, parseFloat(quantity) || 0);
    const currentStock = parseFloat(activeSupply?.current_stock || 0);
    const projectedStock = isOutbound
        ? +(currentStock - numQty).toFixed(2)
        : +(currentStock + numQty).toFixed(2);
    const totalCost = +(numQty * (parseFloat(unitCost) || 0)).toFixed(2);

    if (!open) return null;

    const handleSupplyChange = (newId) => {
        setSelectedSupplyId(newId);
        const found = (Array.isArray(supplies) ? supplies : []).find(s => String(s.id) === String(newId));
        if (found) {
            setUnitCost(found.unit_cost ?? 0);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const foundBatch = (Array.isArray(batches) ? batches : []).find(b => String(b.id) === String(selectedBatchId));
        onSave({
            supply_id: parseInt(selectedSupplyId, 10),
            movement_type: movementType,
            quantity: numQty,
            unit_cost: parseFloat(unitCost) || 0,
            movement_date: movementDate,
            reference_doc: referenceDoc,
            batch_id: foundBatch ? foundBatch.id : null,
            batch_code: foundBatch ? (foundBatch.lot_code || foundBatch.batch_number) : null,
            provider_name: providerName,
            notes
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                            <ArrowUpDown size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900">
                                Registrar Movimiento de Insumo (Kárdex)
                            </h3>
                            <p className="text-[11px] text-slate-500">
                                Entrada por compra, consumo por lote de producción/CIP o ajuste de inventario
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                            Insumo
                        </label>
                        <select
                            value={selectedSupplyId}
                            onChange={(e) => handleSupplyChange(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-bold text-slate-900"
                            required
                        >
                            {(Array.isArray(supplies) ? supplies : []).map((s) => (
                                <option key={s.id} value={s.id}>
                                    [{s.item_code}] {s.item_name} (Stock: {s.current_stock} {s.unit_of_measure})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Tipo de Movimiento
                            </label>
                            <select
                                value={movementType}
                                onChange={(e) => setMovementType(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-bold"
                            >
                                <option value="entrada_compra">Entrada / Compra (+)</option>
                                <option value="salida_produccion">Salida a Producción / Envasado (-)</option>
                                <option value="salida_cip">Salida Lavado CIP (-)</option>
                                <option value="ajuste_positivo">Ajuste Positivo (+)</option>
                                <option value="ajuste_negativo">Ajuste Negativo (-)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Fecha del Movimiento
                            </label>
                            <input
                                type="date"
                                value={movementDate}
                                onChange={(e) => setMovementDate(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-bold"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] font-bold text-slate-500 uppercase">
                                    Cantidad ({activeSupply?.unit_of_measure || 'unid'})
                                </label>
                                {activeSupply?.dose_per_batch > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setQuantity(String(activeSupply.dose_per_batch))}
                                        className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                                    >
                                        Usar dosis ({activeSupply.dose_per_batch})
                                    </button>
                                )}
                            </div>
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="0.00"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-black text-slate-900"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Costo Unitario ($)
                            </label>
                            <MoneyInput
                                value={unitCost}
                                step="0.0001"
                                onChange={(e) => setUnitCost(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-bold"
                            />
                        </div>
                    </div>

                    {isOutbound ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                    Vincular a Lote de Producción (Opcional)
                                </label>
                                <select
                                    value={selectedBatchId}
                                    onChange={(e) => setSelectedBatchId(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                                >
                                    <option value="">— Sin lote específico —</option>
                                    {(Array.isArray(batches) ? batches : []).map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {b.lot_code || b.batch_number} ({b.product_type})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                    Documento / Orden Ref.
                                </label>
                                <input
                                    type="text"
                                    value={referenceDoc}
                                    onChange={(e) => setReferenceDoc(e.target.value)}
                                    placeholder="Ej. REQ-0042"
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                    Factura / CCF / Referencia
                                </label>
                                <input
                                    type="text"
                                    value={referenceDoc}
                                    onChange={(e) => setReferenceDoc(e.target.value)}
                                    placeholder="Ej. DTE-03-000125"
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                    Proveedor (Opcional)
                                </label>
                                <input
                                    type="text"
                                    value={providerName}
                                    onChange={(e) => setProviderName(e.target.value)}
                                    placeholder="Nombre del proveedor..."
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                            Observaciones
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Detalle del movimiento..."
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
                        />
                    </div>

                    {/* Resumen de Proyección de Stock y Costo */}
                    <div className="rounded-xl bg-slate-900 text-white p-3.5 flex items-center justify-between text-xs">
                        <div>
                            <span className="text-[10px] text-slate-400 uppercase block">Proyección de Stock</span>
                            <span className="font-bold">
                                {currentStock} →{' '}
                                <strong className={projectedStock < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                                    {projectedStock} {activeSupply?.unit_of_measure}
                                </strong>
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase block">Valor del Movimiento</span>
                            <Money value={totalCost} className="text-sm font-black text-cyan-300" />
                        </div>
                    </div>

                    <div className="pt-1 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || (isOutbound && projectedStock < 0)}
                            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                        >
                            <CheckCircle2 size={15} />
                            <span>{isSubmitting ? 'Registrando...' : 'Confirmar Movimiento'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
