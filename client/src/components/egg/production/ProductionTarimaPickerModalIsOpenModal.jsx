import {
    XCircle,
    Layers
} from 'lucide-react';


export default function ProductionTarimaPickerModalIsOpenModal({ model, open = model.tarimaPickerModal.isOpen, onClose = () => model.setTarimaPickerModal({ isOpen: false, lot: null, availableTarimas: [] }) }) {
    const { tarimaPickerModal, setTarimaPickerModal, handleScanTarimaResult } = model;
    if (!open) return null;
    return (<>{tarimaPickerModal.isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 sm:p-6 max-w-lg w-full max-h-[92dvh] overflow-y-auto my-auto space-y-4 text-slate-900">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100 shrink-0">
                                    <Layers size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 leading-snug">
                                        Seleccionar Tarima del Lote
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        {tarimaPickerModal.lot?.provider_lot} - {tarimaPickerModal.lot?.provider_name || 'Proveedor'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                                <XCircle size={18} />
                            </button>
                        </div>

                        <p className="text-xs text-slate-600 font-medium">
                            Este lote tiene múltiples tarimas disponibles en bodega. Selecciona la tarima que vas a ingresar a esta corrida de producción:
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-1">
                            {(Array.isArray(tarimaPickerModal.availableTarimas) ? tarimaPickerModal.availableTarimas : []).map((t) => {
                                const availBoxes = t.available_boxes ?? t.boxes_count ?? 0;
                                const availLbs = t.available_lbs ?? t.net_weight_lbs ?? t.gross_weight_lbs ?? 0;
                                return (
                                    <button
                                        key={t.tarima_number}
                                        type="button"
                                        onClick={() => {
                                            const lotObj = tarimaPickerModal.lot;
                                            setTarimaPickerModal({ isOpen: false, lot: null, availableTarimas: [] });
                                            handleScanTarimaResult({
                                                lotCode: lotObj.provider_lot,
                                                tarimaNumber: t.tarima_number
                                            });
                                        }}
                                        className="p-3.5 bg-white hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-xl text-left transition-all group shadow-xs"
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-xs text-indigo-700 group-hover:text-indigo-900">
                                                    Tarima #{t.tarima_number}
                                                </span>
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${(t.storage_location || tarimaPickerModal.lot?.storage_location || 'abajo') === 'abajo'
                                                        ? 'bg-blue-100 text-blue-800'
                                                        : 'bg-amber-100 text-amber-800'
                                                    }`}>
                                                    {(t.storage_location || tarimaPickerModal.lot?.storage_location || 'abajo') === 'abajo' ? '⬇ Abajo' : '⬆ Arriba'}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                                                {availBoxes} cjs
                                            </span>
                                        </div>
                                        <div className="text-xs font-black text-slate-800">
                                            {parseFloat(availLbs).toFixed(1)} Lbs
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => setTarimaPickerModal({ isOpen: false, lot: null, availableTarimas: [] })}
                                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors text-center"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const lotObj = tarimaPickerModal.lot;
                                    setTarimaPickerModal({ isOpen: false, lot: null, availableTarimas: [] });
                                    handleScanTarimaResult({
                                        lotCode: lotObj.provider_lot,
                                        loadAll: true
                                    });
                                }}
                                className="w-full sm:w-auto px-3.5 py-2.5 sm:py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-colors shadow-xs text-center"
                            >
                                Cargar Todas las Tarimas ({tarimaPickerModal.availableTarimas.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}</>);
}
