import { RefreshCw, ArrowRightLeft, Sparkles, Layers, Trash2 } from 'lucide-react';

export default function ProductionCalendarBatchCard({
    isSecondary = false,
    lotNumber = 1,
    lotCode,
    onLotCodeChange,
    onRegenerateLot,
    productProfile,
    onProductProfileChange,
    presentation,
    onPresentationChange,
    quantityLbs,
    onQuantityChange,
    onDelete,
    PRODUCT_PROFILES,
    PRESENTATIONS,
    julianDayStr,
    julianFormat,
    onToggleFormat
}) {
    return (
        <div className={`p-3.5 rounded-xl border space-y-2.5 ${
            isSecondary
                ? 'border-teal-200 bg-teal-50/30'
                : 'border-indigo-200 bg-indigo-50/30'
        }`}>
            <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase flex items-center gap-1.5 ${
                    isSecondary ? 'text-teal-800' : 'text-indigo-700'
                }`}>
                    {isSecondary ? <Sparkles className="w-3.5 h-3.5 text-teal-600" /> : <Layers className="w-3.5 h-3.5" />}
                    {isSecondary ? `LOTE ${lotNumber || 2} (CO-PRODUCTO)` : 'LOTE 1 (PRINCIPAL)'}
                </span>

                <div className="flex items-center gap-1.5">
                    {!isSecondary && onToggleFormat ? (
                        <>
                            <button
                                type="button"
                                onClick={onToggleFormat}
                                className="text-[9px] text-slate-500 hover:text-indigo-600 flex items-center gap-0.5 font-semibold px-1 py-0.5 rounded hover:bg-white"
                                title="Alternar formato con/sin prefijo LOTE"
                            >
                                <ArrowRightLeft className="w-2.5 h-2.5" />
                                <span>{julianFormat === 'standard' ? 'Con LOTE' : 'Sin LOTE'}</span>
                            </button>
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800">
                                Día {julianDayStr}
                            </span>
                        </>
                    ) : isSecondary && (
                        <>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-teal-100 text-teal-800">
                                MP Compartida
                            </span>
                            {onDelete && (
                                <button
                                    type="button"
                                    onClick={onDelete}
                                    className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    title="Quitar este lote co-producto"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                    {isSecondary ? 'Código de Lote Secundario *' : 'Código de Lote Juliano *'}
                </label>
                <div className="relative">
                    <input
                        type="text"
                        required
                        value={lotCode}
                        onChange={(e) => onLotCodeChange(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg pl-2.5 pr-7 py-1.5 text-xs font-bold text-slate-800"
                    />
                    <button
                        type="button"
                        onClick={onRegenerateLot}
                        className={`absolute right-2 top-2 ${isSecondary ? 'text-slate-400 hover:text-teal-600' : 'text-slate-400 hover:text-indigo-600'}`}
                        title={isSecondary ? 'Regenerar Lote 2' : 'Regenerar Lote 1'}
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                        Perfil del Producto *
                    </label>
                    <select
                        value={productProfile}
                        onChange={(e) => onProductProfileChange(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800"
                    >
                        {(Array.isArray(PRODUCT_PROFILES) ? PRODUCT_PROFILES : []).map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                        Presentación
                    </label>
                    <select
                        value={presentation}
                        onChange={(e) => onPresentationChange(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-800"
                    >
                        {(Array.isArray(PRESENTATIONS) ? PRESENTATIONS : []).map(pres => (
                            <option key={pres} value={pres}>{pres}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                    Cantidad Objetivo (Lbs) *
                </label>
                <input
                    type="number"
                    required
                    step="100"
                    min="100"
                    value={quantityLbs}
                    onChange={(e) => onQuantityChange(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800"
                />
            </div>
        </div>
    );
}
