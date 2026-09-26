import {
    Plus, XCircle, ClipboardList, Camera, Search, Layers, Check, Trash2
} from 'lucide-react';

const EggAddTarimasModal = ({
    isOpen,
    onClose,
    addTarimasModal,
    setAddTarimasModal,
    rawMaterials = [],
    onOpenScanner,
    onOpenTarimaSearchPicker,
    handleManualTarimaDigitize,
    handleAddTarimasSubmit,
    handleLoadAllAvailableTarimasToAddModal,
    handleAddSpecificTarimaToAddModal,
    handleRemoveTarimaFromAddModal,
    handleUpdateTarimaBoxesInAddModal,
    handleUpdateTarimaLbsInAddModal
}) => {
    if (!isOpen || !addTarimasModal) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 text-slate-900 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                        <h3 className="text-base font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                            <Plus className="text-indigo-600" size={18} />
                            Agregar Más Tarimas al Quebraje
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Lote Destino: <strong className="text-indigo-700 font-mono">{addTarimasModal.batch?.batch_code_display || addTarimasModal.batch?.batch_uuid}</strong> ({addTarimasModal.batch?.product_type})
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
                    >
                        <XCircle size={20} />
                    </button>
                </div>

                <p className="text-xs text-slate-500 font-medium">
                    Permite adicionar tarimas de materia prima a la corrida en caso de que el quebraje sea menor a lo esperado o se requiera volumen extra.
                </p>

                {/* Histórico de Tarimas / Materia Prima ya Quebradas en este Lote */}
                {addTarimasModal.batch?.raw_materials && addTarimasModal.batch.raw_materials.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                                <ClipboardList size={14} className="text-indigo-600" />
                                Tarimas / Lotes ya Quebrados en esta Producción
                            </span>
                            <span className="text-[11px] text-slate-500 font-semibold">
                                Total previo: <strong className="text-slate-900">{parseFloat(addTarimasModal.batch.input_weight_lbs || 0).toLocaleString()} Lbs</strong>
                            </span>
                        </div>
                        <div className="space-y-1.5">
                            {addTarimasModal.batch.raw_materials.map((rmPrev, pIdx) => (
                                <div key={pIdx} className="bg-white border border-slate-200/80 rounded-lg p-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                    <div>
                                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                            <span>{rmPrev.egg_type || 'Huevo'}</span>
                                            <span className="text-slate-400 font-normal">| Lote:</span>
                                            <span className="font-mono text-indigo-700">{rmPrev.provider_lot || rmPrev.id}</span>
                                        </div>
                                        {Array.isArray(rmPrev.tarimas) && rmPrev.tarimas.length > 0 ? (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {rmPrev.tarimas.map((t, ti) => (
                                                    <span key={ti} className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-semibold inline-flex items-center gap-1">
                                                        <span>Tarima #{t.tarima_number}</span>
                                                        {t.storage_location && (
                                                            <span className={`text-[9px] font-bold px-1 py-0.2 rounded ${
                                                                t.storage_location === 'abajo' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                                                            }`}>
                                                                {t.storage_location === 'abajo' ? '⬇ Abajo' : '⬆ Arriba'}
                                                            </span>
                                                        )}
                                                        <span>({t.boxes_count || 0} cjs • {parseFloat(t.quantity_lbs || 0).toFixed(0)} Lbs)</span>
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-[11px] text-slate-500">{rmPrev.boxes_count ? `${rmPrev.boxes_count} cajas` : ''}</span>
                                        )}
                                    </div>
                                    <div className="text-right font-bold text-slate-900 shrink-0">
                                        {parseFloat(rmPrev.quantity_lbs || 0).toFixed(2)} Lbs
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Barra de Herramientas: Escáner con Teléfono/Cámara & Digitación / Búsqueda Manual */}
                <div className="bg-gradient-to-r from-indigo-50/80 to-slate-50 p-4 rounded-xl border border-indigo-100 space-y-3">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onOpenScanner}
                                className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-500/20"
                                title="Escanear con cámara de teléfono o lector QR"
                            >
                                <Camera size={15} />
                                <span>Escanear Tarima (Cámara / QR)</span>
                            </button>
                            <button
                                type="button"
                                onClick={onOpenTarimaSearchPicker}
                                className="px-3.5 py-2 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                                title="Abrir buscador visual de todos los lotes y tarimas disponibles"
                            >
                                <Search size={14} className="text-indigo-600" />
                                <span>Ver Lotes y Tarimas</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-2 text-xs bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs self-end sm:self-auto">
                            <span className="text-slate-500 font-medium">Cajas: <strong className="text-indigo-700">{addTarimasModal.raw_materials.reduce((s, rm) => s + (parseInt(rm.boxes_count, 10) || (rm.tarimas || []).reduce((ts, t) => ts + (parseInt(t.boxes_count, 10) || 0), 0)), 0)} cjs</strong></span>
                            <span className="text-slate-300">|</span>
                            <span className="text-slate-500 font-medium">Entrada: <strong className="text-emerald-700">{addTarimasModal.raw_materials.reduce((s, rm) => s + parseFloat(rm.quantity_lbs || 0), 0).toFixed(2)} Lbs</strong></span>
                        </div>
                    </div>

                    {/* Digitar Tarima Manualmente o Abrir Selector con Lupa */}
                    <form onSubmit={handleManualTarimaDigitize} className="flex gap-2 items-center">
                        <div className="relative flex-1">
                            <button
                                type="button"
                                onClick={onOpenTarimaSearchPicker}
                                className="absolute left-2.5 top-2 h-4 w-4 text-indigo-600 hover:text-indigo-800 transition-colors"
                                title="Clic para buscar y seleccionar entre todos los lotes y tarimas disponibles"
                            >
                                <Search size={15} />
                            </button>
                            <input
                                type="text"
                                value={addTarimasModal.manualTarimaInput || ''}
                                onChange={(e) => setAddTarimasModal(prev => ({ ...prev, manualTarimaInput: e.target.value }))}
                                placeholder="Digitar código de barras (ej: TAR-LOTE-01) o N° de tarima, o clic en lupa..."
                                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                        </div>
                        <button
                            type="submit"
                            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors"
                        >
                            Buscar / Digitar
                        </button>
                    </form>
                </div>

                {/* Listado de Lotes de Materia Prima y Tarimas Complementarias */}
                <form onSubmit={handleAddTarimasSubmit} className="space-y-4">
                    <div className="space-y-3">
                        {addTarimasModal.raw_materials.map((rm, idx) => {
                            const selectedLot = rawMaterials.find(m => String(m.id) === String(rm.raw_material_id));
                            let lotTarimas = selectedLot?.tarimas_available || [];
                            if (lotTarimas.length === 0 && selectedLot?.tarimas_json) {
                                try {
                                    lotTarimas = typeof selectedLot.tarimas_json === 'string'
                                        ? JSON.parse(selectedLot.tarimas_json || '[]')
                                        : (selectedLot.tarimas_json || []);
                                } catch (e) {
                                    lotTarimas = [];
                                }
                            }

                            return (
                                <div key={idx} className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-3">
                                    {/* Selector del lote */}
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                                                Lote de Materia Prima #{idx + 1} *
                                            </label>
                                            <select
                                                value={rm.raw_material_id}
                                                onChange={(e) => {
                                                    const lotId = e.target.value;
                                                    const updated = [...addTarimasModal.raw_materials];
                                                    updated[idx].raw_material_id = lotId;
                                                    updated[idx].tarimas = [];
                                                    updated[idx].quantity_lbs = '';
                                                    updated[idx].boxes_count = '';
                                                    setAddTarimasModal(prev => ({ ...prev, raw_materials: updated }));
                                                }}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                                                required
                                            >
                                                <option value="">Seleccione Lote de Materia Prima en Bodega...</option>
                                                {rawMaterials.map(m => {
                                                    const isAgotado = m.is_depleted || parseFloat(m.stock_lbs || 0) <= 0.01;
                                                    const isAlreadyChosen = addTarimasModal.raw_materials.some((r, i) => i !== idx && r.raw_material_id === String(m.id));
                                                    return (
                                                        <option
                                                            key={m.id}
                                                            value={m.id}
                                                            disabled={isAgotado || isAlreadyChosen}
                                                            className={isAgotado ? 'text-slate-400 bg-slate-50' : 'text-slate-900'}
                                                        >
                                                            {m.egg_type} - Lote: {m.provider_lot} ({m.provider_name || 'Prov.'}) | {isAgotado ? '🚫 [AGOTADO - 0 Lbs]' : `Stock: ${parseFloat(m.stock_lbs || 0).toFixed(0)} Lbs (${m.total_boxes || 0} cjs)`}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>

                                        <div className="flex items-end gap-2">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                                                    Total Lbs
                                                </label>
                                                <input
                                                    type="number"
                                                    value={rm.quantity_lbs}
                                                    readOnly
                                                    className="w-24 px-2 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-900 font-bold text-right cursor-not-allowed"
                                                    placeholder="0.00"
                                                />
                                            </div>

                                            {addTarimasModal.raw_materials.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAddTarimasModal(prev => ({
                                                            ...prev,
                                                            raw_materials: prev.raw_materials.filter((_, i) => i !== idx)
                                                        }));
                                                    }}
                                                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors mb-0.5"
                                                    title="Eliminar este lote"
                                                >
                                                    <XCircle size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Tarimas disponibles en el lote seleccionado */}
                                    {selectedLot && (
                                        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5">
                                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1">
                                                        <Layers size={13} className="text-indigo-600" />
                                                        Tarimas Registradas en Recepción
                                                    </span>
                                                    {lotTarimas.length > 0 && (
                                                        <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                            {lotTarimas.filter(t => !t.is_depleted && !(t.available_boxes <= 0 && t.available_lbs <= 0.01)).length} disponibles de {lotTarimas.length}
                                                        </span>
                                                    )}
                                                </div>

                                                {lotTarimas.some(t => !t.is_depleted && !(t.available_boxes <= 0 && t.available_lbs <= 0.01) && !(rm.tarimas || []).some(it => parseInt(it.tarima_number, 10) === parseInt(t.tarima_number, 10))) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleLoadAllAvailableTarimasToAddModal(idx, lotTarimas)}
                                                        className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1"
                                                    >
                                                        <Check size={11} /> Cargar todas disponibles
                                                    </button>
                                                )}
                                            </div>

                                            {/* Chips interactivos de tarimas */}
                                            {lotTarimas.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {lotTarimas.map((t) => {
                                                        const isAdded = (rm.tarimas || []).some(it => parseInt(it.tarima_number, 10) === parseInt(t.tarima_number, 10));
                                                        const isDepleted = t.is_depleted || (t.available_boxes <= 0 && t.available_lbs <= 0.01);
                                                        const availBoxes = t.available_boxes ?? t.boxes_count ?? 0;
                                                        const availLbs = t.available_lbs ?? t.net_weight_lbs ?? t.gross_weight_lbs ?? 0;

                                                        return (
                                                            <button
                                                                key={t.tarima_number}
                                                                type="button"
                                                                disabled={isAdded || isDepleted}
                                                                onClick={() => handleAddSpecificTarimaToAddModal(idx, t)}
                                                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 border ${isAdded
                                                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-2xs'
                                                                        : isDepleted
                                                                            ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed line-through'
                                                                            : 'bg-white hover:bg-indigo-50 border-slate-300 hover:border-indigo-400 text-slate-700 hover:text-indigo-700 shadow-2xs'
                                                                    }`}
                                                                title={isDepleted ? 'Tarima 100% consumida' : isAdded ? 'Tarima ya agregada' : 'Hacer clic para agregar'}
                                                            >
                                                                <span>Tarima #{t.tarima_number}</span>
                                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                                                    (t.storage_location || 'abajo') === 'abajo'
                                                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                }`}>
                                                                    {(t.storage_location || 'abajo') === 'abajo' ? '⬇ Abajo' : '⬆ Arriba'}
                                                                </span>
                                                                <span className="text-[10px] font-semibold opacity-80">
                                                                    ({availBoxes} cjs • {parseFloat(availLbs).toFixed(0)} Lbs)
                                                                </span>
                                                                {isAdded && <Check size={12} className="text-emerald-600" />}
                                                                {isDepleted && <span className="text-[9px] text-rose-500 font-bold ml-0.5">Agotada</span>}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 italic py-1">
                                                    Este lote no tiene tarimas registradas en recepción.
                                                </p>
                                            )}

                                            {/* Desglose de tarimas seleccionadas para quebrar */}
                                            {rm.tarimas && rm.tarimas.length > 0 && (
                                                <div className="space-y-2 pt-2 border-t border-slate-200">
                                                    <div className="text-[10px] font-bold text-slate-500 uppercase px-1 flex items-center justify-between">
                                                        <span>Tarimas Adicionales a Quebrar</span>
                                                        <span className="text-indigo-600 font-medium lowercase">admite consumo parcial</span>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        {rm.tarimas.map((t, ti) => {
                                                            const maxBoxes = t.available_boxes || t.boxes_count || 0;
                                                            const maxLbs = t.available_lbs || parseFloat(t.quantity_lbs) || 0;

                                                            return (
                                                                <div key={ti} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/90 space-y-1.5">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md font-bold text-xs flex items-center gap-1.5">
                                                                                <span>Tarima #{t.tarima_number}</span>
                                                                                <span className={`text-[9px] font-black px-1 py-0.2 rounded ${
                                                                                    (t.storage_location || 'abajo') === 'abajo'
                                                                                        ? 'bg-blue-100 text-blue-800'
                                                                                        : 'bg-amber-100 text-amber-800'
                                                                                }`}>
                                                                                    {(t.storage_location || 'abajo') === 'abajo' ? '⬇ Abajo' : '⬆ Arriba'}
                                                                                </span>
                                                                            </span>
                                                                            {t.barcode && (
                                                                                <span className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                                                                    {t.barcode}
                                                                                </span>
                                                                            )}
                                                                            <span className="text-[11px] text-slate-500">
                                                                                (Disponible: <strong className="text-slate-700">{maxBoxes} cjs</strong> • <strong className="text-slate-700">{parseFloat(maxLbs).toFixed(1)} Lbs</strong>)
                                                                            </span>
                                                                        </div>

                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemoveTarimaFromAddModal(idx, ti)}
                                                                            className="p-1 text-slate-600 hover:text-rose-600 rounded transition-colors"
                                                                            title="Quitar esta tarima"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>

                                                                    <div className="grid grid-cols-12 gap-2 items-center">
                                                                        <div className="col-span-6 flex items-center gap-1.5">
                                                                            <label className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Cajas:</label>
                                                                            <input
                                                                                type="number"
                                                                                min="1"
                                                                                max={maxBoxes}
                                                                                value={t.boxes_count}
                                                                                onChange={(e) => handleUpdateTarimaBoxesInAddModal(idx, ti, e.target.value)}
                                                                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 text-center focus:border-indigo-500"
                                                                                placeholder="0 cjs"
                                                                            />
                                                                        </div>

                                                                        <div className="col-span-6 flex items-center gap-1.5">
                                                                            <label className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Peso Lbs:</label>
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                min="0.01"
                                                                                max={maxLbs}
                                                                                value={t.quantity_lbs}
                                                                                onChange={(e) => handleUpdateTarimaLbsInAddModal(idx, ti, e.target.value)}
                                                                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 text-right focus:border-indigo-500"
                                                                                placeholder="0.00 Lbs"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        <button
                            type="button"
                            onClick={() => setAddTarimasModal(prev => ({
                                ...prev,
                                raw_materials: [
                                    ...prev.raw_materials,
                                    { raw_material_id: '', quantity_lbs: '', boxes_count: '', tarimas: [] }
                                ]
                            }))}
                            className="w-full py-2.5 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all border border-indigo-200/80 flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                            <Plus size={14} />
                            + Agregar Otro Lote de Materia Prima
                        </button>
                    </div>

                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                            Motivo / Observaciones
                        </label>
                        <textarea
                            rows={2}
                            value={addTarimasModal.notes || ''}
                            onChange={(e) => setAddTarimasModal(prev => ({ ...prev, notes: e.target.value }))}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            placeholder="Detalle por qué se agregaron estas tarimas al quebraje..."
                        />
                    </div>

                    <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={addTarimasModal.isSubmitting}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                        >
                            {addTarimasModal.isSubmitting ? 'Guardando...' : 'Adicionar Tarimas al Lote'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EggAddTarimasModal;
