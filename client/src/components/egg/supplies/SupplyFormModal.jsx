import { useState, useEffect } from 'react';
import { X, Package, CheckCircle2 } from 'lucide-react';
import { MoneyInput } from '../../ui/Money';

export default function SupplyFormModal({
    open,
    onClose,
    onSave,
    item = null,
    isSubmitting = false
}) {
    const [itemCode, setItemCode] = useState('');
    const [itemName, setItemName] = useState('');
    const [category, setCategory] = useState('empaque');
    const [subcategory, setSubcategory] = useState('recipiente');
    const [unitOfMeasure, setUnitOfMeasure] = useState('unidad');
    const [currentStock, setCurrentStock] = useState(0);
    const [minStock, setMinStock] = useState(100);
    const [unitCost, setUnitCost] = useState(0);
    const [dosePerBatch, setDosePerBatch] = useState('');
    const [location, setLocation] = useState('Bodega de Insumos Planta');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (!open) return;
        if (item) {
            setItemCode(item.item_code || '');
            setItemName(item.item_name || '');
            setCategory(item.category || 'empaque');
            setSubcategory(item.subcategory || 'recipiente');
            setUnitOfMeasure(item.unit_of_measure || 'unidad');
            setCurrentStock(item.current_stock ?? 0);
            setMinStock(item.min_stock ?? 100);
            setUnitCost(item.unit_cost ?? 0);
            setDosePerBatch(item.dose_per_batch !== null && item.dose_per_batch !== undefined ? String(item.dose_per_batch) : '');
            setLocation(item.location || 'Bodega de Insumos Planta');
            setNotes(item.notes || '');
        } else {
            setItemCode('');
            setItemName('');
            setCategory('empaque');
            setSubcategory('recipiente');
            setUnitOfMeasure('unidad');
            setCurrentStock(0);
            setMinStock(100);
            setUnitCost(0);
            setDosePerBatch('');
            setLocation('Bodega de Insumos Planta');
            setNotes('');
        }
    }, [open, item]);

    if (!open) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            id: item?.id || null,
            item_code: itemCode.trim().toUpperCase(),
            item_name: itemName.trim(),
            category,
            subcategory,
            unit_of_measure: unitOfMeasure,
            current_stock: parseFloat(currentStock) || 0,
            min_stock: parseFloat(minStock) || 0,
            unit_cost: parseFloat(unitCost) || 0,
            dose_per_batch: dosePerBatch !== '' ? parseFloat(dosePerBatch) || 0 : null,
            location,
            notes
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
                            <Package size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900">
                                {item ? `Editar Insumo (${item.item_code})` : 'Registrar Nuevo Insumo Industrial'}
                            </h3>
                            <p className="text-[11px] text-slate-500">
                                Configuración de categoría, unidad, stock mínimo y costo unitario
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Código
                            </label>
                            <input
                                type="text"
                                value={itemCode}
                                onChange={(e) => setItemCode(e.target.value.toUpperCase())}
                                placeholder="Ej. CUBETA-30LB"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-bold"
                                required
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Nombre / Descripción del Insumo
                            </label>
                            <input
                                type="text"
                                value={itemName}
                                onChange={(e) => setItemName(e.target.value)}
                                placeholder="Ej. Cubeta Plástica Blanca 30 LBS"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-medium"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Categoría
                            </label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-bold"
                            >
                                <option value="empaque">Material de Empaque</option>
                                <option value="aditivo">Ingredientes y Aditivos</option>
                                <option value="quimico_cip">Químicos CIP / Sanitización</option>
                                <option value="suministro">Suministros de Planta</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Subcategoría
                            </label>
                            <select
                                value={subcategory}
                                onChange={(e) => setSubcategory(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-medium"
                            >
                                <option value="recipiente">Recipiente / Envase</option>
                                <option value="tapadera">Tapadera / Sello</option>
                                <option value="liner">Bolsa Liner</option>
                                <option value="etiqueta">Etiqueta</option>
                                <option value="ingrediente">Ingrediente / Aditivo</option>
                                <option value="sanitizante">Químico Sanitizante</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Unidad de Medida
                            </label>
                            <select
                                value={unitOfMeasure}
                                onChange={(e) => setUnitOfMeasure(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-bold"
                            >
                                <option value="unidad">Unidad</option>
                                <option value="kg">Kilogramo (kg)</option>
                                <option value="lb">Libra (lb)</option>
                                <option value="gal">Galón (gal)</option>
                                <option value="litro">Litro (L)</option>
                                <option value="rollo">Rollo</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {!item && (
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                    Stock Inicial
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={currentStock}
                                    onChange={(e) => setCurrentStock(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-bold"
                                />
                            </div>
                        )}
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Stock Mínimo
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={minStock}
                                onChange={(e) => setMinStock(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-bold"
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
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Dosis / Lote
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={dosePerBatch}
                                onChange={(e) => setDosePerBatch(e.target.value)}
                                placeholder="Opcional"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-medium"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Ubicación en Bodega
                            </label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="Ej. Bodega de Insumos Planta"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-medium"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Observaciones
                            </label>
                            <input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Ej. Estante A2 - Grado alimenticio..."
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-medium"
                            />
                        </div>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                        >
                            <CheckCircle2 size={15} />
                            <span>{isSubmitting ? 'Guardando...' : 'Guardar Insumo'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
