import {
    DEFAULT_INDUSTRIAL_PRESENTATION,
    DEFAULT_INDUSTRIAL_PRODUCT_CATEGORY,
    getIndustrialPresentationWeightLbs,
    INDUSTRIAL_MEASUREMENT_UNITS,
    INDUSTRIAL_PRESENTATIONS,
    INDUSTRIAL_PRODUCT_CATEGORIES,
    kilogramsToPounds,
    poundsToKilograms,
    RECIPES_CATALOG,
    RECIPE_FORMULA_NAMES,
    getRecipeFormulaName
} from '../../../constants/eggIndustrialCatalogs';
import {
    Plus,
    Trash2,
    XCircle,
    Barcode,
    Search
} from 'lucide-react';


export default function ConfigIsMappingModalOpenModal({ model, open = model.isMappingModalOpen, onClose = () => model.setIsMappingModalOpen(false), onSave = model.handleSaveMapping }) {
    const { inferCategoryAndPresentation, systemProducts, isMappingModalOpen, setIsMappingModalOpen, mappingForm, setMappingForm, handleOpenProductCatalog, handleAddMappingCode, handleUpdateMappingCode, handleRemoveMappingCode } = model;
    if (!open) return null;
    return (<>{isMappingModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150">
                    {/* Datalist para autocompletar códigos del sistema mientras se escribe */}
                    <datalist id="system-product-codes-list">
                        {systemProducts.flatMap(p => {
                            const entries = [];
                            const sku = p.codigo?.trim();
                            const barcode = p.codigo_barra?.trim();
                            const name = p.nombre || p.name || '';
                            if (sku) entries.push(<option key={`sku-${p.id}`} value={sku}>{sku} - {name}</option>);
                            if (barcode && barcode !== sku) {
                                entries.push(<option key={`bar-${p.id}`} value={barcode}>{barcode} - {name}</option>);
                            }
                            return entries;
                        })}
                    </datalist>

                    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-2xl max-w-xl w-full max-h-[92dvh] overflow-y-auto text-slate-900 space-y-4 my-auto">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                                    <Barcode size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                                        {mappingForm.id ? 'Editar Vinculación de Códigos' : 'Nueva Vinculación de Códigos'}
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">Asociación de códigos para inventario y CRM</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="text-slate-400 hover:text-slate-700"
                            >
                                <XCircle size={18} />
                            </button>
                        </div>

                        <form onSubmit={onSave} className="space-y-4">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                                        Producto Comercial / Nombre de la Receta o Fórmula *
                                    </label>
                                    <span className="text-[10px] text-indigo-600 font-semibold">
                                        Mismo nombre que en Formulación
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={mappingForm.product_name}
                                    onChange={(e) => setMappingForm({ ...mappingForm, product_name: e.target.value })}
                                    placeholder="Ej: Clara PPG, Huevo Entero Rápido, Huevo Entero Pasteurizado"
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                                {/* Quick selection chips con las recetas canónicas */}
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase mr-0.5">Recetas Oficiales:</span>
                                    {(Array.isArray(RECIPES_CATALOG) ? RECIPES_CATALOG : []).map((rec) => (
                                        <button
                                            key={rec.type}
                                            type="button"
                                            onClick={() => setMappingForm(prev => ({
                                                ...prev,
                                                product_name: rec.label,
                                                product_type: rec.type
                                            }))}
                                            className={`text-[10px] px-2 py-0.5 rounded-lg font-medium border transition-colors ${
                                                mappingForm.product_name === rec.label || mappingForm.product_type === rec.type
                                                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold shadow-xs'
                                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            {rec.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                                        Categoría industrial *
                                    </label>
                                    <select
                                        value={mappingForm.product_type}
                                        onChange={(e) => {
                                            const nextType = e.target.value;
                                            const suggestedName = getRecipeFormulaName(nextType);
                                            setMappingForm(prev => ({
                                                ...prev,
                                                product_type: nextType,
                                                product_name: (!prev.product_name?.trim() || Object.values(RECIPE_FORMULA_NAMES).includes(prev.product_name))
                                                    ? suggestedName
                                                    : prev.product_name
                                            }));
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:border-indigo-500"
                                    >
                                        {(Array.isArray(INDUSTRIAL_PRODUCT_CATEGORIES) ? INDUSTRIAL_PRODUCT_CATEGORIES : []).map((category) => (
                                            <option key={category.value} value={category.value}>{category.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                                        Presentación *
                                    </label>
                                    <select
                                        value={mappingForm.presentation}
                                        onChange={(e) => {
                                            const presentation = e.target.value;
                                            const lbs = getIndustrialPresentationWeightLbs(presentation, 0);
                                            const presLower = presentation.toLowerCase();
                                            let suggestedUnit = mappingForm.unit_of_measure;
                                            if (presLower.includes('unidad')) suggestedUnit = 'unidad';
                                            else if (presLower.includes('carton') || presLower.includes('cartón')) suggestedUnit = 'carton';
                                            else if (presLower.includes('caja')) suggestedUnit = 'caja';
                                            else if (suggestedUnit === 'unidad' || suggestedUnit === 'carton' || suggestedUnit === 'caja') suggestedUnit = 'lb';

                                            setMappingForm(prev => {
                                                const nextLbs = lbs > 0 ? lbs.toFixed(2) : null;
                                                const nextKg = lbs > 0 ? poundsToKilograms(lbs).toFixed(2) : null;
                                                return {
                                                    ...prev,
                                                    presentation,
                                                    unit_of_measure: suggestedUnit,
                                                    codes: ((Array.isArray(prev.codes || []) ? prev.codes || [] : [])).map((it, idx) => {
                                                        if (nextLbs && (idx === 0 || !it.weight_lbs || it.weight_lbs === '32.00')) {
                                                            return {
                                                                ...it,
                                                                weight_lbs: nextLbs,
                                                                weight_kg: nextKg
                                                            };
                                                        }
                                                        return it;
                                                    })
                                                };
                                            });
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:border-indigo-500"
                                    >
                                        {(Array.isArray(INDUSTRIAL_PRESENTATIONS) ? INDUSTRIAL_PRESENTATIONS : []).map((item) => (
                                            <option key={item.value} value={item.value}>{item.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                                        Unidad de medida *
                                    </label>
                                    <select
                                        value={mappingForm.unit_of_measure}
                                        onChange={(e) => setMappingForm({ ...mappingForm, unit_of_measure: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:border-indigo-500"
                                    >
                                        {(Array.isArray(INDUSTRIAL_MEASUREMENT_UNITS) ? INDUSTRIAL_MEASUREMENT_UNITS : []).map((unit) => (
                                            <option key={unit.value} value={unit.value}>{unit.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                    <div className="flex items-center gap-1.5">
                                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                                            Códigos vinculados y pesos unitarios *
                                        </label>
                                        <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded border border-slate-200">
                                            {(mappingForm.codes || []).filter(c => (c.code || '').trim()).length} vinculados
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenProductCatalog(null)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors shadow-2xs"
                                            title="Buscar códigos de productos registrados en el sistema"
                                        >
                                            <Search size={12} />
                                            Buscar en sistema
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleAddMappingCode}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                                            title="Agregar otro renglón de código manual"
                                        >
                                            <Plus size={12} />
                                            Manual
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-400 mb-2">
                                    Cada código seleccionado tiene su propio peso unitario para calcular con precisión el stock y la equivalencia.
                                </p>
                                <div className="space-y-2.5">
                                    {(Array.isArray(mappingForm.codes) ? mappingForm.codes : []).map((item, index) => (
                                        <div key={index} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex-1 min-w-0">
                                                    <input
                                                        type="text"
                                                        list="system-product-codes-list"
                                                        value={typeof item === 'string' ? item : (item.code || '')}
                                                        onChange={(e) => {
                                                             const val = e.target.value;
                                                             handleUpdateMappingCode(index, 'code', val);
                                                             const match = systemProducts.find(p =>
                                                                 (p.codigo && p.codigo.toLowerCase() === val.toLowerCase()) ||
                                                                 (p.codigo_barra && p.codigo_barra.toLowerCase() === val.toLowerCase())
                                                             );
                                                             if (match && !mappingForm.product_name?.trim()) {
                                                                 const inferred = inferCategoryAndPresentation(match.nombre || match.name || '', val);
                                                                 const formulaName = getRecipeFormulaName(inferred.product_type);
                                                                 setMappingForm(prev => ({
                                                                     ...prev,
                                                                     product_name: formulaName || match.nombre || match.name || prev.product_name,
                                                                     product_type: prev.product_type === DEFAULT_INDUSTRIAL_PRODUCT_CATEGORY ? inferred.product_type : prev.product_type,
                                                                     presentation: prev.presentation === DEFAULT_INDUSTRIAL_PRESENTATION ? inferred.presentation : prev.presentation
                                                                 }));
                                                             }
                                                         }}
                                                        placeholder={index === 0 ? 'Ej: HC, H1 o escribe para buscar...' : 'Otro código (SKU o Barra)'}
                                                        className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenProductCatalog(index)}
                                                        className="absolute right-2.5 top-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                                        title="Buscar y seleccionar código de la lista de productos del sistema"
                                                    >
                                                        <Search size={14} />
                                                    </button>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveMappingCode(index)}
                                                    disabled={mappingForm.codes.length === 1}
                                                    className="inline-flex shrink-0 items-center justify-center p-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                                                    title="Quitar código"
                                                    aria-label="Quitar código"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>

                                            {/* Nombre del producto detectado/vinculado si existe */}
                                            {item.product_name && (
                                                <div className="text-[11px] text-slate-600 font-medium flex items-center gap-1 pl-1">
                                                    <span className="text-slate-400">Producto:</span>
                                                    <span className="font-bold text-slate-700 truncate">{item.product_name}</span>
                                                </div>
                                            )}

                                            {/* Pesos unitarios individuales para este código */}
                                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5">
                                                        Peso Unitario (Lbs) *
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={item.weight_lbs ?? ''}
                                                            onChange={(e) => {
                                                                const lbsVal = e.target.value;
                                                                const lbsNum = parseFloat(lbsVal) || 0;
                                                                handleUpdateMappingCode(index, 'weight_lbs', lbsVal, poundsToKilograms(lbsNum).toFixed(2));
                                                            }}
                                                            placeholder="0.00"
                                                            className="w-full pl-2.5 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                                                        />
                                                        <span className="absolute right-2 top-1.5 text-[10px] font-bold text-slate-400">lb</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5">
                                                        Peso Unitario (Kg) *
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={item.weight_kg ?? ''}
                                                            onChange={(e) => {
                                                                const kgVal = e.target.value;
                                                                const kgNum = parseFloat(kgVal) || 0;
                                                                handleUpdateMappingCode(index, 'weight_kg', kgVal, kilogramsToPounds(kgNum).toFixed(2));
                                                            }}
                                                            placeholder="0.00"
                                                            className="w-full pl-2.5 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                                                        />
                                                        <span className="absolute right-2 top-1.5 text-[10px] font-bold text-slate-400">kg</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <span className="text-[10px] text-slate-400 block mt-1.5">
                                    Escribe para autocompletar por SKU o pulsa <strong>Buscar en sistema</strong> para elegir desde el catálogo.
                                </span>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                                    Notas y Comentarios
                                </label>
                                <textarea
                                    rows={2}
                                    value={mappingForm.notes}
                                    onChange={(e) => setMappingForm({ ...mappingForm, notes: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-indigo-500"
                                    placeholder="Observaciones de vinculación..."
                                />
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setIsMappingModalOpen(false)}
                                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors text-center"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs text-center"
                                >
                                    Guardar Vinculación
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}</>);
}
