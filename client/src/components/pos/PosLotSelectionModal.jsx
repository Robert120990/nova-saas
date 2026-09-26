import { 
    Layers, 
    X, 
    Search, 
    Loader2, 
    Package, 
    AlertTriangle, 
    CheckCircle2, 
    Plus 
} from 'lucide-react';

/**
 * PosLotSelectionModal Component
 * Modal for selecting egg production lots (Alt + Shift + L) with out-of-stock warning.
 */
const PosLotSelectionModal = ({
    isOpen,
    onClose,
    lotSearch,
    setLotSearch,
    showAllLots,
    setShowAllLots,
    isLoadingLots,
    availableLots = [],
    handleSelectLot,
    lotWarningTarget,
    setLotWarningTarget,
    executeAddLot
}) => {
    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[350] flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
                <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="p-5 md:p-6 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
                                <Layers size={24} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Lotes de Producción Ovoproductos</h3>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                                        Alt + Shift + L
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">Selección de lotes envasados para venta con control de stock y advertencia interactiva</p>
                            </div>
                        </div>
                        <button 
                            type="button"
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Search and Filters Bar */}
                    <div className="p-4 md:p-6 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-center justify-between">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                autoFocus
                                type="text"
                                value={lotSearch}
                                onChange={e => setLotSearch(e.target.value)}
                                placeholder="Buscar por lote, código de barras, producto o presentación..."
                                className="w-full pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all"
                            />
                            {lotSearch && (
                                <button onClick={() => setLotSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none bg-white px-3 py-2 rounded-xl border border-slate-200 hover:border-amber-300 transition-all shrink-0">
                            <input 
                                type="checkbox" 
                                checked={showAllLots} 
                                onChange={e => setShowAllLots(e.target.checked)}
                                className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 accent-amber-600"
                            />
                            <span>Mostrar lotes sin existencias (Stock: 0)</span>
                        </label>
                    </div>

                    {/* Lots List / Cards */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                        {isLoadingLots ? (
                            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
                                <Loader2 size={32} className="animate-spin text-amber-500" />
                                <span className="text-xs font-bold uppercase tracking-wider">Cargando inventario de lotes...</span>
                            </div>
                        ) : availableLots.length === 0 ? (
                            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2 text-center">
                                <Package size={40} className="text-slate-300 mb-2" />
                                <p className="text-sm font-bold text-slate-600">No se encontraron lotes disponibles</p>
                                <p className="text-xs text-slate-400 max-w-sm">Prueba activando la casilla "Mostrar lotes sin existencias" o modificando el término de búsqueda.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {availableLots.map(lot => {
                                    const hasStock = lot.has_stock;
                                    return (
                                        <div 
                                            key={lot.packaging_id}
                                            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${hasStock ? 'bg-white hover:border-amber-400 hover:shadow-md border-slate-200/80' : 'bg-rose-50/40 border-rose-200/80 opacity-90'}`}
                                        >
                                            <div>
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-sm font-black text-slate-900 tracking-tight">
                                                                {lot.lot_code}
                                                            </span>
                                                            {hasStock ? (
                                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                    {lot.units_in_stock} cubetas ({lot.total_weight_lbs} Lbs)
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1">
                                                                    <AlertTriangle size={10} /> Agotado (0)
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs font-bold text-slate-700 mt-1">{lot.product_type} - {lot.presentation}</p>
                                                    </div>
                                                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-600 uppercase">
                                                        {lot.warehouse_zone || 'COOLER'}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 my-2 pt-2 border-t border-slate-100">
                                                    <div>
                                                        <span className="text-[9px] font-bold uppercase text-slate-400 block">Vencimiento</span>
                                                        <span className={`font-semibold ${lot.is_expired ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                                                            {lot.expiry_date ? new Date(lot.expiry_date).toLocaleDateString('es-SV') : 'N/A'}
                                                            {lot.is_expired && ' (Vencido)'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] font-bold uppercase text-slate-400 block">Calidad</span>
                                                        <span className="font-bold text-emerald-600 uppercase flex items-center gap-1">
                                                            <CheckCircle2 size={12} /> {lot.quality_status || 'Aprobado'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                                                <span className="font-mono text-[10px] text-slate-400">
                                                    {lot.barcode || 'Sin CB'}
                                                </span>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleSelectLot(lot)}
                                                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer ${hasStock ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20' : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'}`}
                                                >
                                                    <Plus size={14} />
                                                    {hasStock ? 'Seleccionar' : 'Seleccionar (Sin Stock)'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                        <span>Mostrando {availableLots.length} lotes encontrados</span>
                        <button 
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-all cursor-pointer"
                        >
                            Cerrar (Esc)
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de Advertencia por Lote Sin Existencias */}
            {lotWarningTarget && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[360] flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-[2.5rem] p-6 md:p-8 max-w-md w-full shadow-2xl border border-rose-100 flex flex-col items-center text-center animate-in zoom-in-95 duration-150">
                        <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4 shadow-lg shadow-rose-100">
                            <AlertTriangle size={32} />
                        </div>
                        <h4 className="text-xl font-black text-slate-900 tracking-tight uppercase">Advertencia de Inventario</h4>
                        <p className="text-xs text-slate-600 font-medium mt-3 leading-relaxed">
                            El lote seleccionado <strong className="text-rose-600 font-mono font-bold">#{lotWarningTarget.lot_code}</strong> ({lotWarningTarget.product_type}) <span className="font-bold underline text-rose-700">no cuenta con existencias registradas en inventario</span> (Stock actual: 0 unidades).
                        </p>
                        <p className="text-[11px] text-slate-500 bg-amber-50 p-3 rounded-xl border border-amber-200 mt-3 text-left">
                            ¿Desea forzar la inclusión de este lote en la venta actual de todas formas?
                        </p>

                        <div className="grid grid-cols-2 gap-3 w-full mt-6">
                            <button 
                                type="button"
                                onClick={() => setLotWarningTarget(null)}
                                className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="button"
                                onClick={() => executeAddLot(lotWarningTarget)}
                                className="w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30 transition-all active:scale-95 cursor-pointer"
                            >
                                Sí, agregar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default PosLotSelectionModal;
