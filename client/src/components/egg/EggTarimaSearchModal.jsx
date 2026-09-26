import { Search, XCircle, Barcode } from 'lucide-react';
import { toast } from 'sonner';

const EggTarimaSearchModal = ({
    isOpen,
    onClose,
    rawMaterials = [],
    addTarimasModal,
    setAddTarimasModal,
    handleAddSpecificTarimaToAddModal
}) => {
    if (!isOpen) return null;

    const availableLots = rawMaterials.filter(m => !m.is_depleted && parseFloat(m.stock_lbs || 0) > 0.01);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 text-slate-900">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                            <Search className="text-indigo-600" size={16} />
                            Lotes y Tarimas Disponibles para Quebraje
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">Seleccione con un clic las tarimas o lotes de materia prima que ingresarán al quebraje.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-700 p-1"
                    >
                        <XCircle size={20} />
                    </button>
                </div>

                <div className="space-y-3">
                    {availableLots.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-6">No hay lotes con saldo disponible en bodega de recepción.</p>
                    ) : availableLots.map(lot => {
                        let lotTarimas = lot.tarimas_available || [];
                        if (lotTarimas.length === 0 && lot.tarimas_json) {
                            try {
                                lotTarimas = typeof lot.tarimas_json === 'string' ? JSON.parse(lot.tarimas_json) : lot.tarimas_json;
                            } catch (e) {
                                lotTarimas = [];
                            }
                        }
                        const activeTarimas = (lotTarimas || []).filter(t => !t.is_depleted && !(t.available_boxes <= 0 && t.available_lbs <= 0.01));

                        return (
                            <div key={lot.id} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/70 space-y-2.5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200/60 pb-2">
                                    <div>
                                        <span className="font-bold text-slate-900 text-xs">{lot.egg_type}</span>
                                        <span className="text-slate-500 text-xs ml-1.5 font-mono">Lote: <strong>{lot.provider_lot}</strong></span>
                                        <span className="text-slate-400 text-[11px] ml-1.5">({lot.provider_name || 'Proveedor'})</span>
                                        <span className={`text-[9px] font-bold ml-1.5 px-1.5 py-0.5 rounded ${
                                            (lot.storage_location || 'abajo') === 'abajo' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                        }`}>
                                            {(lot.storage_location || 'abajo') === 'abajo' ? '⬇ Abajo' : '⬆ Arriba'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="bg-white border border-slate-200 px-2 py-0.5 rounded font-bold text-indigo-700">
                                            Stock: {parseFloat(lot.stock_lbs || 0).toFixed(0)} Lbs ({lot.total_boxes || 0} cjs)
                                        </span>
                                    </div>
                                </div>

                                {activeTarimas.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {activeTarimas.map(t => (
                                            <div key={t.tarima_number} className="bg-white border border-slate-200 rounded-lg p-2.5 flex items-center justify-between gap-2 shadow-2xs">
                                                <div>
                                                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                        <Barcode size={12} className="text-indigo-500" />
                                                        <span>Tarima #{t.tarima_number}</span>
                                                        <span className={`text-[9px] font-black px-1 py-0.2 rounded ${
                                                            (t.storage_location || lot.storage_location || 'abajo') === 'abajo'
                                                                ? 'bg-blue-100 text-blue-800'
                                                                : 'bg-amber-100 text-amber-800'
                                                        }`}>
                                                            {(t.storage_location || lot.storage_location || 'abajo') === 'abajo' ? '⬇ Abajo' : '⬆ Arriba'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                        {t.available_boxes ?? t.boxes_count} cjs • <strong className="text-emerald-700">{parseFloat(t.available_lbs ?? t.net_weight_lbs ?? t.gross_weight_lbs ?? 0).toFixed(1)} Lbs</strong>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const updated = [...addTarimasModal.raw_materials];
                                                        let rmIdx = updated.findIndex(r => String(r.raw_material_id) === String(lot.id));
                                                        if (rmIdx === -1) {
                                                            updated.push({ raw_material_id: String(lot.id), quantity_lbs: '', boxes_count: '', tarimas: [] });
                                                            rmIdx = updated.length - 1;
                                                        }
                                                        setAddTarimasModal(prev => ({ ...prev, raw_materials: updated }));
                                                        handleAddSpecificTarimaToAddModal(rmIdx, t);
                                                    }}
                                                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold transition-all"
                                                >
                                                    + Agregar
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between text-xs bg-white p-2.5 rounded-lg border border-slate-200">
                                        <span className="text-slate-600">Lote completo sin desglose individual de tarimas</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const updated = [...addTarimasModal.raw_materials];
                                                let rmIdx = updated.findIndex(r => String(r.raw_material_id) === String(lot.id));
                                                if (rmIdx === -1) {
                                                    updated.push({
                                                        raw_material_id: String(lot.id),
                                                        quantity_lbs: String(lot.stock_lbs || ''),
                                                        boxes_count: String(lot.total_boxes || ''),
                                                        tarimas: []
                                                    });
                                                } else {
                                                    updated[rmIdx].quantity_lbs = String(lot.stock_lbs || '');
                                                    updated[rmIdx].boxes_count = String(lot.total_boxes || '');
                                                }
                                                setAddTarimasModal(prev => ({ ...prev, raw_materials: updated }));
                                                toast.success(`Lote ${lot.provider_lot} seleccionado.`);
                                            }}
                                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold transition-all"
                                        >
                                            + Cargar Lote
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-200">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900"
                    >
                        Listo / Volver al Lote
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EggTarimaSearchModal;
