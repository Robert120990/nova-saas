import { Boxes, Plus, Trash2, Warehouse, CheckCircle2 } from 'lucide-react';

const WEIGHT_MAP = {
    'cubeta 30LB': '30.00',
    'cubeta 32LB': '32.00',
    'galón 8LB': '8.00',
    'medio galón 4LB': '4.00',
    'litro 2LB': '2.00',
    'bolsa 5LB': '5.00'
};

const resolveCatalogMatch = (productType, presentation, catalogProducts = [], codeMappings = []) => {
    if (!catalogProducts || catalogProducts.length === 0) return null;
    const cleanType = (productType || '').toLowerCase();
    const cleanPres = (presentation || '').toLowerCase();

    // 1. Coincidencia en matriz de mapeo multicódigo
    for (const m of codeMappings) {
        let codeItems = [];
        try {
            codeItems = typeof m.code_weights_json === 'string' ? JSON.parse(m.code_weights_json) : m.code_weights_json;
        } catch {
            codeItems = [];
        }
        if (Array.isArray(codeItems)) {
            const found = codeItems.find(it => {
                const name = (it.product_name || '').toLowerCase();
                const code = (it.code || '').toLowerCase();
                const presMatch = (cleanPres.includes('32') && (name.includes('32') || code.includes('32') || code.includes('c32'))) ||
                                  (cleanPres.includes('30') && (name.includes('30') || code.includes('30') || code.includes('c30'))) ||
                                  (cleanPres.includes('8') && (name.includes('8') || name.includes('galon') || name.includes('galón') || code.includes('8') || code.includes('g') || code.includes('gl'))) ||
                                  (cleanPres.includes('4') && (name.includes('4') || code.includes('4'))) ||
                                  (cleanPres.includes('2') && (name.includes('2') || name.includes('litro') || code.includes('2') || code.includes('l')));
                const typeMatch = cleanType.includes('rapido') ? (name.includes('rapido') || code.includes('rapido') || code.includes('her'))
                                : cleanType.includes('clara ppg') ? (name.includes('ppg') || code.includes('ppg') || code.includes('cppg'))
                                : cleanType.includes('clara') ? (name.includes('clara') && !name.includes('ppg'))
                                : cleanType.includes('azucarada') ? (name.includes('azucarada') || code.includes('ya'))
                                : cleanType.includes('salada') ? (name.includes('salada') || code.includes('ys'))
                                : cleanType.includes('yema') ? name.includes('yema')
                                : (name.includes('entero') || code.includes('he'));
                return presMatch && typeMatch;
            });
            if (found && found.product_id) {
                const prod = catalogProducts.find(p => p.id === Number(found.product_id));
                if (prod) return prod;
            }
        }
    }

    // 2. Coincidencia directa en lista de productos
    const weightNum = cleanPres.includes('32') ? '32' : cleanPres.includes('30') ? '30' : cleanPres.includes('8') ? '8' : cleanPres.includes('4') ? '4' : cleanPres.includes('2') ? '2' : '';
    const match = catalogProducts.find(p => {
        const name = (p.nombre || '').toLowerCase();
        const code = (p.codigo || '').toLowerCase();
        const hasWeight = weightNum ? (name.includes(weightNum) || code.includes(weightNum)) : true;
        const typeMatch = cleanType.includes('rapido') ? (name.includes('rapido') || code.includes('her'))
                        : cleanType.includes('clara ppg') ? (name.includes('ppg') || code.includes('ppg'))
                        : cleanType.includes('clara') ? (name.includes('clara') && !name.includes('ppg'))
                        : cleanType.includes('azucarada') ? name.includes('azucarada')
                        : cleanType.includes('salada') ? name.includes('salada')
                        : cleanType.includes('yema') ? name.includes('yema')
                        : (name.includes('entero') || code.includes('he'));
        return hasWeight && typeMatch;
    });

    return match || null;
};

export default function PackagingItemsSection({
    packagingForm,
    setPackagingForm,
    catalogProducts = [],
    codeMappings = []
}) {
    const items = Array.isArray(packagingForm.items) ? packagingForm.items : [];

    const handlePresentationChange = (idx, pres) => {
        const defaultW = WEIGHT_MAP[pres] || '30.00';
        const updated = [...items];
        const autoProduct = resolveCatalogMatch(packagingForm.product_type, pres, catalogProducts, codeMappings);
        updated[idx] = {
            ...items[idx],
            presentation: pres,
            weight_per_unit_lbs: defaultW,
            product_id: autoProduct?.id || items[idx]?.product_id || null
        };
        setPackagingForm({ ...packagingForm, items: updated });
    };

    const handleProductChange = (idx, prodId) => {
        const updated = [...items];
        updated[idx] = { ...items[idx], product_id: prodId || null };
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
        const defaultPres = 'cubeta 30LB';
        const autoProduct = resolveCatalogMatch(packagingForm.product_type, defaultPres, catalogProducts, codeMappings);
        setPackagingForm({
            ...packagingForm,
            items: [
                ...items,
                {
                    presentation: defaultPres,
                    units_packaged: '',
                    weight_per_unit_lbs: '30.00',
                    product_id: autoProduct?.id || null
                }
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
                    Alimenta automáticamente inventario comercial y Kardex
                </span>
            </div>

            {items.map((it, idx) => {
                const unitsNum = parseInt(it.units_packaged) || 0;
                const itemTotal = (unitsNum * (parseFloat(it.weight_per_unit_lbs) || 0));
                
                // Resolver producto de catálogo seleccionado o coincidente por defecto
                const matchedProduct = (it.product_id && (Array.isArray(catalogProducts) ? catalogProducts : []).find(p => p.id === Number(it.product_id)))
                    || resolveCatalogMatch(packagingForm.product_type, it.presentation, catalogProducts, codeMappings);
                const currentStock = Number(matchedProduct?.stock || 0);
                const projectedStock = currentStock + unitsNum;

                return (
                    <div key={idx} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-indigo-700 uppercase">
                                Presentación #{idx + 1}
                            </span>
                            {items.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => handleRemoveItem(idx)}
                                    className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                                    title="Quitar esta presentación"
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

                        {/* Vinculación Comercial & Impacto de Inventario */}
                        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70 p-2.5 rounded-xl">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Warehouse className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase block leading-tight">
                                        Producto Comercial a Acreditar en Inventario:
                                    </span>
                                    <select
                                        value={it.product_id || matchedProduct?.id || ''}
                                        onChange={(e) => handleProductChange(idx, e.target.value ? Number(e.target.value) : null)}
                                        className="w-full text-[11px] font-bold text-indigo-900 bg-white border border-slate-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-indigo-500 truncate"
                                    >
                                        <option value="">Selección Automática ({matchedProduct ? `[${matchedProduct.codigo}] ${matchedProduct.nombre}` : 'Por receta'})</option>
                                        {(Array.isArray(catalogProducts) ? catalogProducts : []).map(cp => (
                                            <option key={cp.id} value={cp.id}>
                                                [{cp.codigo}] {cp.nombre} (Stock: {Number(cp.stock || 0).toFixed(0)} {cp.unidad_medida || 'Uds'})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 self-end sm:self-auto shrink-0 shadow-2xs">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>Alimenta:</span>
                                <strong className="text-emerald-700 font-bold">+{unitsNum} Uds</strong>
                                {matchedProduct && (
                                    <span className="text-slate-400 border-l border-slate-200 pl-1.5 text-[9px]">
                                        Stock: {currentStock.toFixed(0)} → <strong className="text-slate-800 font-bold">{projectedStock.toFixed(0)}</strong>
                                    </span>
                                )}
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
