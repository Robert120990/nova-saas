import {
    poundsToKilograms,
    getRecipeFormulaName
} from '../../../../constants/eggIndustrialCatalogs';
import {
    Plus,
    Trash2,
    CheckCircle2,
    Sparkles,
    Barcode,
    Pencil,
    Search
} from 'lucide-react';


export default function ConfigCodeMappingsTab({ model }) {
    const { parseMappingItems, activeTab, codeMappings, mappingSearchTerm, setMappingSearchTerm, handleOpenCreateMapping, handleOpenEditMapping, handleAddCodeToMapping, handleDeleteMapping, handleSeedExampleMappings } = model;

    return (<>{activeTab === 'code-mappings' && (
                <div className="space-y-6">
                    {/* Header Banner */}
                    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="space-y-2 max-w-2xl">
                            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[11px] font-bold tracking-wide uppercase">
                                <Sparkles size={12} className="text-amber-300" />
                                Vinculación Multicódigo • Inventario Real & Sincronizado
                            </div>
                            <h2 className="text-xl font-bold tracking-tight">
                                Matriz de Códigos y Presentaciones Industriales
                            </h2>
                            <p className="text-xs text-slate-300 leading-relaxed">
                                Esta relación asocia los diversos códigos utilizados en materia prima, corridas de producción y envasado
                                (ej: <code>HEGL8, hd4kg, 167347</code> para galón o <code>hel2, 48758943</code> para litro).
                                Traduce las existencias hacia el CRM, pedidos y producción sin alterar el inventario de facturación general.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2.5 shrink-0">
                            <button
                                type="button"
                                onClick={handleOpenCreateMapping}
                                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs"
                            >
                                <Plus size={14} />
                                Nueva Vinculación
                            </button>
                        </div>
                    </div>

                    {/* Tabla de Vinculaciones */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <Barcode className="text-indigo-600" size={18} />
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                                    Códigos Registrados ({codeMappings.length})
                                </h3>
                            </div>
                            <div className="relative w-full sm:w-72">
                                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar por código, producto..."
                                    value={mappingSearchTerm}
                                    onChange={(e) => setMappingSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:bg-white focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        {codeMappings.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
                                <Barcode className="h-10 w-10 text-slate-300 mx-auto" />
                                <p className="text-xs text-slate-500 font-medium">No se han registrado vinculaciones de códigos aún.</p>
                                <button
                                    type="button"
                                    onClick={handleSeedExampleMappings}
                                    className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors"
                                >
                                    Cargar códigos de muestra del documento
                                </button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                            <th className="p-3">Producto Comercial</th>
                                            <th className="p-3">Tipo</th>
                                            <th className="p-3">Presentación</th>
                                            <th className="p-3">Códigos Vinculados (Diversos Sistemas)</th>
                                            <th className="p-3 text-right">Peso Equivalente</th>
                                            <th className="p-3">Unidad</th>
                                            <th className="p-3">Producto Catálogo</th>
                                            <th className="p-3 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(Array.isArray(codeMappings.filter(m => {
                                            if (!mappingSearchTerm.trim()) return true;
                                            const term = mappingSearchTerm.toLowerCase();
                                            return (m.product_name || '').toLowerCase().includes(term) ||
                                                (m.codes || '').toLowerCase().includes(term) ||
                                                (m.product_type || '').toLowerCase().includes(term) ||
                                                (m.presentation || '').toLowerCase().includes(term);
                                        })) ? codeMappings.filter(m => {
                                            if (!mappingSearchTerm.trim()) return true;
                                            const term = mappingSearchTerm.toLowerCase();
                                            return (m.product_name || '').toLowerCase().includes(term) ||
                                                (m.codes || '').toLowerCase().includes(term) ||
                                                (m.product_type || '').toLowerCase().includes(term) ||
                                                (m.presentation || '').toLowerCase().includes(term);
                                        }) : []).map(m => {
                                            const items = parseMappingItems(m);
                                            const weights = (Array.isArray(items) ? items : []).map(it => parseFloat(it.weight_lbs) || 0).filter(w => w > 0);
                                            const minW = weights.length > 0 ? Math.min(...weights) : parseFloat(m.unit_weight_lbs || 0);
                                            const maxW = weights.length > 0 ? Math.max(...weights) : parseFloat(m.unit_weight_lbs || 0);
                                            const linkedProductNames = Array.from(new Set((Array.isArray(items) ? items : []).map(it => it.product_name).filter(Boolean)));

                                            return (
                                                <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="p-3 font-bold text-slate-900">
                                                        <div>{m.catalog_product_name || getRecipeFormulaName(m.product_type) || m.product_name || 'Sin descripción'}</div>
                                                        {m.notes && <div className="text-[10px] text-slate-400 font-normal italic">{m.notes}</div>}
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-bold uppercase capitalize">
                                                            {m.product_type}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 font-semibold text-slate-700 capitalize">
                                                        {m.presentation}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {(Array.isArray(items) ? items : []).map((it, ci) => (
                                                                <span
                                                                    key={ci}
                                                                    className="inline-flex items-center gap-1 font-mono text-[11px] font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200"
                                                                    title={`Peso: ${parseFloat(it.weight_lbs).toFixed(2)} lb (~${parseFloat(it.weight_kg).toFixed(2)} kg)${it.product_name ? ` | ${it.product_name}` : ''}`}
                                                                >
                                                                    <span>{it.code}</span>
                                                                    <span className="text-[10px] text-indigo-600 font-semibold font-sans bg-indigo-50 px-1 rounded border border-indigo-100">
                                                                        {parseFloat(it.weight_lbs).toFixed(1)} lb
                                                                    </span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="font-bold text-slate-900">
                                                            {minW === maxW ? `${minW.toFixed(2)} lb` : `${minW.toFixed(1)} - ${maxW.toFixed(1)} lb`}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-medium">
                                                            {minW === maxW ? `~${poundsToKilograms(minW).toFixed(2)} kg` : `~${poundsToKilograms(minW).toFixed(1)} - ${poundsToKilograms(maxW).toFixed(1)} kg`}
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        {(() => {
                                                            const u = String(m.unit_of_measure || 'lb').toLowerCase();
                                                            if (u === 'unidad' || u === 'u') {
                                                                return (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200" title="Comercializado por unidad individual">
                                                                        🥚 UNIDAD
                                                                    </span>
                                                                );
                                                            }
                                                            if (u === 'carton' || u === 'cartón') {
                                                                return (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200" title="Comercializado por cartón de 30 unidades">
                                                                        📋 CARTÓN
                                                                    </span>
                                                                );
                                                            }
                                                            if (u === 'caja') {
                                                                return (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200" title="Comercializado por caja de 360 unidades / 12 cartones">
                                                                        📦 CAJA
                                                                    </span>
                                                                );
                                                            }
                                                            return (
                                                                <span className="font-bold text-slate-700 uppercase">
                                                                    {m.unit_of_measure || 'lb'}
                                                                </span>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="p-3 text-slate-600 font-medium">
                                                        {linkedProductNames.length > 0 ? (
                                                            <div className="space-y-0.5 max-w-[200px]">
                                                                {(Array.isArray(linkedProductNames) ? linkedProductNames : []).map((pName, pIdx) => (
                                                                    <div key={pIdx} className="text-emerald-700 font-bold text-[11px] flex items-center gap-1 truncate" title={pName}>
                                                                        <CheckCircle2 size={11} className="shrink-0" />
                                                                        <span className="truncate">{pName}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : m.catalog_product_name ? (
                                                            <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                                                                <CheckCircle2 size={11} className="shrink-0" />
                                                                {m.catalog_product_name}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 italic text-[11px]">Auto por código / SKU</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAddCodeToMapping(m)}
                                                                className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-colors"
                                                                title="Agregar otro código a este producto"
                                                                aria-label="Agregar otro código a este producto"
                                                            >
                                                                <Plus size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenEditMapping(m)}
                                                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 transition-colors"
                                                                title="Editar Mapeo"
                                                            >
                                                                <Pencil size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteMapping(m.id)}
                                                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors"
                                                                title="Eliminar Mapeo"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}</>);
}
