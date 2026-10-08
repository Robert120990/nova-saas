import { Boxes, Plus, Trash2 } from 'lucide-react';

const WEIGHT_MAP = {
    'cubeta 30LB': '30.00',
    'cubeta 32LB': '32.00',
    'galón 8LB': '8.00',
    'medio galón 4LB': '4.00',
    'litro 2LB': '2.00',
    'bolsa 5LB': '5.00'
};

export default function PackagingItemsSection({ packagingForm, setPackagingForm }) {
    const items = Array.isArray(packagingForm.items) ? packagingForm.items : [];

    const handlePresentationChange = (idx, pres) => {
        const defaultW = WEIGHT_MAP[pres] || '30.00';
        const updated = [...items];
        updated[idx] = { ...items[idx], presentation: pres, weight_per_unit_lbs: defaultW };
        setPackagingForm({ ...packagingForm, items: updated });
    };

    const handleUnitsChange = (idx, units) => {
        const updated = [...items];
        updated[idx] = { ...items[idx], units_packaged: units };
        setPackagingForm({ ...packagingForm, items: updated });
    };

    const handleWeightChange = (idx, weight) => {
        const updated = [...items];
        updated[idx] = { ...items[idx], weight_per_unit_lbs: weight };
        setPackagingForm({ ...packagingForm, items: updated });
    };

    const handleRemoveItem = (idx) => {
        const updated = items.filter((_, i) => i !== idx);
        setPackagingForm({ ...packagingForm, items: updated });
    };

    const handleAddItem = () => {
        setPackagingForm({
            ...packagingForm,
            items: [
                ...items,
                { presentation: 'cubeta 30LB', units_packaged: '', weight_per_unit_lbs: '30.00' }
            ]
        });
    };

    return (
        <div className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-purple-600" />
                    <span>Presentaciones Comerciales a Envasar</span>
                </label>
                <span className="text-[11px] text-slate-500 font-medium">
                    Puede empacar más de una presentación en este lote
                </span>
            </div>

            {items.map((it, idx) => {
                const itemTotal = ((parseFloat(it.units_packaged) || 0) * (parseFloat(it.weight_per_unit_lbs) || 0));
                return (
                    <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-indigo-700 uppercase">
                                Presentación #{idx + 1}
                            </span>
                            {items.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => handleRemoveItem(idx)}
                                    className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                                >
                                    <Trash2 size={13} />
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                            <div className="sm:col-span-5">
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                    Presentación Comercial *
                                </label>
                                <select
                                    value={it.presentation}
                                    onChange={(e) => handlePresentationChange(idx, e.target.value)}
                                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="cubeta 30LB">Cubeta 30 Lbs (Líquido PT)</option>
                                    <option value="cubeta 32LB">Cubeta 32 Lbs (Líquido PT)</option>
                                    <option value="galón 8LB">Galón 8 Lbs</option>
                                    <option value="medio galón 4LB">Medio Galón 4 Lbs</option>
                                    <option value="litro 2LB">Litro 2 Lbs</option>
                                    <option value="bolsa 5LB">Bolsa 5 Lbs (Panadería)</option>
                                    <option value="otro">Otro Formato</option>
                                </select>
                            </div>

                            <div className="sm:col-span-3">
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                    Unidades Envasadas *
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={it.units_packaged}
                                    onChange={(e) => handleUnitsChange(idx, e.target.value)}
                                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-center"
                                    placeholder="Ej: 50"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                    Peso Unit (Lb)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={it.weight_per_unit_lbs}
                                    onChange={(e) => handleWeightChange(idx, e.target.value)}
                                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-right"
                                    placeholder="30.00"
                                />
                            </div>

                            <div className="sm:col-span-2 text-right">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">Subtotal</span>
                                <span className="text-xs font-bold text-teal-700">{itemTotal.toFixed(1)} Lbs</span>
                            </div>
                        </div>
                    </div>
                );
            })}

            <button
                type="button"
                onClick={handleAddItem}
                className="w-full py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition-all border border-purple-200 flex items-center justify-center gap-1.5 shadow-2xs"
            >
                <Plus size={13} />
                + Agregar Otra Presentación Comercial
            </button>
        </div>
    );
}
