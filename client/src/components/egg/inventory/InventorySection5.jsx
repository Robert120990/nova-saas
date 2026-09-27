import {
    Boxes,
    RefreshCw
} from 'lucide-react';


export default function InventorySection5({ model }) {
    const { loading, unitOfMeasure, viewMode, filteredMappings, filteredItems } = model;

    return (<div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                {loading ? (
                    <div className="py-16 text-center text-slate-400 font-medium text-xs flex flex-col items-center gap-3">
                        <RefreshCw size={24} className="animate-spin text-indigo-600" />
                        Cargando inventario traducido...
                    </div>
                ) : viewMode === 'mapping' ? (
                    // VISTA 1: SEGÚN LA VINCULACIÓN DEL PRODUCTO (CÓDIGOS COMBINADOS)
                    filteredMappings.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 font-medium text-xs flex flex-col items-center gap-2">
                            <Boxes size={32} className="text-slate-300" />
                            No se encontraron vinculaciones registradas o coincidentes.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                        <th className="p-3">Códigos Vinculados (Diversos Sistemas)</th>
                                        <th className="p-3">Producto Comercial</th>
                                        <th className="p-3 text-right">Stock Físico (Unidades)</th>
                                        <th className="p-3 text-right">Peso Factor Unit.</th>
                                        <th className="p-3 text-right">
                                            {unitOfMeasure === 'lbs' ? 'Existencia Total (Lbs)' : unitOfMeasure === 'kg' ? 'Existencia Total (Kg)' : 'Existencia (Envases)'}
                                        </th>
                                        <th className="p-3 text-center">Estado Existencia</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(Array.isArray(filteredMappings) ? filteredMappings : []).map((m) => {
                                        let codesList = [];
                                        if (Array.isArray(m.catalog_codes)) {
                                            codesList = m.catalog_codes;
                                        } else if (typeof m.catalog_codes === 'string') {
                                            try {
                                                const parsed = JSON.parse(m.catalog_codes);
                                                codesList = Array.isArray(parsed) ? parsed : [m.catalog_codes];
                                            } catch (e) {
                                                codesList = (Array.isArray(m.catalog_codes.split(',')) ? m.catalog_codes.split(',') : []).map(c => c.trim()).filter(Boolean);
                                            }
                                        }

                                        return (
                                            <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="p-3">
                                                    <div className="flex flex-wrap gap-1 max-w-sm">
                                                        {(Array.isArray(codesList) ? codesList : []).map((c, i) => (
                                                            <span key={i} className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md font-mono text-[10px] font-bold">
                                                                {c}
                                                            </span>
                                                        ))}
                                                        {codesList.length === 0 && (
                                                            <span className="text-slate-400 italic text-[11px]">Sin códigos</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-black text-slate-900 text-sm">
                                                        {m.commercial_name}
                                                    </div>
                                                    {m.matched_items && m.matched_items.length > 0 && (
                                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                                            {m.matched_items.length} producto{m.matched_items.length > 1 ? 's' : ''} asociado{m.matched_items.length > 1 ? 's' : ''} en catálogo
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right font-black text-slate-900">
                                                    {m.total_stock_units.toLocaleString()} u.
                                                </td>
                                                <td className="p-3 text-right text-slate-500 font-medium">
                                                    {m.unit_weight_lbs} Lbs ({m.unit_weight_kg} Kg)
                                                </td>
                                                <td className="p-3 text-right font-black text-emerald-700 text-sm">
                                                    {unitOfMeasure === 'lbs' && (
                                                        <span>{m.total_weight_lbs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lbs</span>
                                                    )}
                                                    {unitOfMeasure === 'kg' && (
                                                        <span>{m.total_weight_kg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Kg</span>
                                                    )}
                                                    {unitOfMeasure === 'units' && (
                                                        <span>{m.total_stock_units.toLocaleString()} Envases</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {m.total_stock_units > 50 ? (
                                                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold">
                                                            En Stock
                                                        </span>
                                                    ) : m.total_stock_units > 0 ? (
                                                        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-bold">
                                                            Stock Bajo
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg text-[10px] font-bold">
                                                            Agotado
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    // VISTA 2: DETALLE POR PRODUCTO DE CATÁLOGO (SIN TIPO NI PRESENTACIÓN)
                    filteredItems.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 font-medium text-xs flex flex-col items-center gap-2">
                            <Boxes size={32} className="text-slate-300" />
                            No se encontraron productos registrados en el inventario.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                        <th className="p-3">Código Catálogo</th>
                                        <th className="p-3">Códigos Industriales Vinculados</th>
                                        <th className="p-3">Producto Comercial</th>
                                        <th className="p-3 text-right">Stock Físico</th>
                                        <th className="p-3 text-right">Peso Unit.</th>
                                        <th className="p-3 text-right">
                                            {unitOfMeasure === 'lbs' ? 'Existencia Total (Lbs)' : unitOfMeasure === 'kg' ? 'Existencia Total (Kg)' : 'Existencia (Unidades)'}
                                        </th>
                                        <th className="p-3 text-center">Estado Existencia</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(Array.isArray(filteredItems) ? filteredItems : []).map((item, idx) => {
                                        const stockNum = parseFloat(item.stock_units) || 0;
                                        const lbsTotal = parseFloat(item.total_lbs) || 0;
                                        const kgTotal = parseFloat(item.total_kg) || 0;

                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="p-3 font-mono font-bold text-slate-700">
                                                    {item.product_code || '-'}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {(Array.isArray((item.matched_code || '').split(',')) ? (item.matched_code || '').split(',') : []).map((c, i) => {
                                                            const clean = c.trim();
                                                            if (!clean) return null;
                                                            return (
                                                                <span key={i} className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md font-mono text-[10px] font-bold">
                                                                    {clean}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                                <td className="p-3 font-black text-slate-900">
                                                    {item.product_name}
                                                </td>
                                                <td className="p-3 text-right font-black text-slate-900">
                                                    {stockNum.toLocaleString()} u.
                                                </td>
                                                <td className="p-3 text-right text-slate-500 font-medium">
                                                    {parseFloat(item.weight_per_unit_lbs || 0).toFixed(1)} Lbs ({parseFloat(item.weight_per_unit_kg || 0).toFixed(2)} Kg)
                                                </td>
                                                <td className="p-3 text-right font-black text-emerald-700 text-sm">
                                                    {unitOfMeasure === 'lbs' && (
                                                        <span>{lbsTotal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lbs</span>
                                                    )}
                                                    {unitOfMeasure === 'kg' && (
                                                        <span>{kgTotal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Kg</span>
                                                    )}
                                                    {unitOfMeasure === 'units' && (
                                                        <span>{stockNum.toLocaleString()} Envases</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {stockNum > 50 ? (
                                                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold">
                                                            Normal
                                                        </span>
                                                    ) : stockNum > 0 ? (
                                                        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-bold">
                                                            Stock Bajo
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg text-[10px] font-bold">
                                                            Agotado
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>);
}
