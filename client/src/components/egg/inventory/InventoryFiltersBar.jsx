import {
    AlertTriangle,
    ExternalLink
} from 'lucide-react';


export default function InventoryFiltersBar({ model }) {
    const { navigate, inventoryData } = model;

    return (<>{inventoryData.unmapped_products?.length > 0 && (
                <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4.5 space-y-3 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl mt-0.5">
                                <AlertTriangle size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-amber-900">
                                    Atención: {inventoryData.unmapped_products.length} productos de huevo sin vincular
                                </h3>
                                <p className="text-xs text-amber-700 font-medium mt-0.5">
                                    Se detectaron productos en el catálogo comercial que no tienen asignado un código de vinculación ni factor de peso. Su inventario no puede traducirse a libras/kilogramos para la planta.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => navigate('/industrial/configuracion')}
                            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap"
                        >
                            Vincular Códigos
                            <ExternalLink size={14} />
                        </button>
                    </div>

                    {/* Chips de productos pendientes */}
                    <div className="flex flex-wrap gap-2 pt-1 border-t border-amber-200/60">
                        {(Array.isArray(inventoryData.unmapped_products.slice(0, 8)) ? inventoryData.unmapped_products.slice(0, 8) : []).map(up => (
                            <span key={up.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs text-amber-900 font-semibold shadow-2xs">
                                <span className="font-mono text-[10px] text-amber-600">{up.codigo || `ID:${up.id}`}</span>
                                <span>{up.nombre}</span>
                            </span>
                        ))}
                        {inventoryData.unmapped_products.length > 8 && (
                            <span className="text-xs text-amber-700 font-bold self-center">
                                +{inventoryData.unmapped_products.length - 8} más...
                            </span>
                        )}
                    </div>
                </div>
            )}</>);
}
